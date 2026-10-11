#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  use std::{
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::Mutex,
  };
  use tauri::{Manager, RunEvent, State};

  struct ConnectorProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
  }

  struct ConnectorManager {
    executable: Mutex<Option<PathBuf>>,
    process: Mutex<Option<ConnectorProcess>>,
  }

  impl ConnectorManager {
    fn new() -> Self {
      Self {
        executable: Mutex::new(None),
        process: Mutex::new(None),
      }
    }

    fn start(&self, executable: PathBuf) -> Result<(), String> {
      if !cfg!(windows) {
        return Ok(());
      }
      if executable.is_file() {
        *self.executable.lock().map_err(|_| "Connector path lock failed.")? = Some(executable.clone());
        let process = Self::spawn(&executable)?;
        *self.process.lock().map_err(|_| "Connector process lock failed.")? = Some(process);
      }
      Ok(())
    }

    fn spawn(executable: &PathBuf) -> Result<ConnectorProcess, String> {
      let mut command = Command::new(executable);
      command
        .arg("--stdio")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
      #[cfg(windows)]
      {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
      }
      let mut child = command.spawn().map_err(|_| "The bundled XM connector could not be started.")?;
      let stdin = child.stdin.take().ok_or("The bundled XM connector input pipe is unavailable.")?;
      let stdout = child.stdout.take().ok_or("The bundled XM connector output pipe is unavailable.")?;
      Ok(ConnectorProcess {
        child,
        stdin,
        stdout: BufReader::new(stdout),
      })
    }

    fn request(&self, request: serde_json::Value) -> Result<serde_json::Value, String> {
      #[cfg(not(windows))]
      {
        return Ok(serde_json::json!({
          "state": "UNSUPPORTED_PLATFORM",
          "message": "XM MT5 execution is currently supported only by the Windows app.",
          "order_submission": false
        }));
      }

      #[cfg(windows)]
      {
      let executable = self
        .executable
        .lock()
        .map_err(|_| "Connector path lock failed.")?
        .clone()
        .ok_or("The bundled XM connector is unavailable. Reinstall the Windows app.")?;
      let mut process_guard = self.process.lock().map_err(|_| "Connector process lock failed.")?;
      let needs_restart = match process_guard.as_mut() {
        Some(process) => process
          .child
          .try_wait()
          .map_err(|_| "The XM connector process state is unavailable.")?
          .is_some(),
        None => true,
      };
      if needs_restart {
        *process_guard = Some(Self::spawn(&executable)?);
      }
      let process = process_guard.as_mut().ok_or("The XM connector is unavailable.")?;
      writeln!(process.stdin, "{}", serde_json::to_string(&request).map_err(|_| "Connector request could not be encoded.")?)
        .and_then(|()| process.stdin.flush())
        .map_err(|_| "The XM connector stopped before responding.")?;
      let mut response = String::new();
      process
        .stdout
        .read_line(&mut response)
        .map_err(|_| "The XM connector response could not be read.")?;
      if response.is_empty() {
        let _ = process.child.kill();
        *process_guard = Some(Self::spawn(&executable)?);
        return Err("The XM connector stopped before responding; retrying connection.".to_string());
      }
      serde_json::from_str(&response).map_err(|_| "The XM connector returned invalid status data.".to_string())
      }
    }

    fn snapshot(&self) -> Result<serde_json::Value, String> {
      self.request(serde_json::json!({ "action": "snapshot" }))
    }

    fn stop(&self) {
      if let Ok(mut process_guard) = self.process.lock() {
        if let Some(mut process) = process_guard.take() {
          let _ = writeln!(process.stdin, "{{\"action\":\"shutdown\"}}");
          let _ = process.stdin.flush();
          for _ in 0..20 {
            if process.child.try_wait().ok().flatten().is_some() {
              return;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
          }
          let _ = process.child.kill();
          let _ = process.child.wait();
        }
      }
    }
  }

  impl Drop for ConnectorManager {
    fn drop(&mut self) {
      self.stop();
    }
  }

  #[tauri::command]
  fn mt5_connector_snapshot(state: State<'_, ConnectorManager>) -> Result<serde_json::Value, String> {
    state.snapshot()
  }

  #[tauri::command]
  fn mt5_connector_request(
    state: State<'_, ConnectorManager>,
    request: serde_json::Value,
  ) -> Result<serde_json::Value, String> {
    let action = request.get("action").and_then(serde_json::Value::as_str)
      .ok_or("Connector action is required.")?;
    if !matches!(
      action,
      "enable_trading"
        | "disable_trading"
        | "prepare_order"
        | "submit_order"
        | "candle_history"
        | "reconciliation"
        | "quotes"
    ) {
      return Err("The requested connector action is unavailable.".to_string());
    }
    state.request(request)
  }

  let app = tauri::Builder::default()
    .manage(ConnectorManager::new())
    .invoke_handler(tauri::generate_handler![
      mt5_connector_snapshot,
      mt5_connector_request,



    ])
    .setup(|app| {
      let connector = app.path().resource_dir()?.join("mt5-connector").join("mt5-connector.exe");
      #[cfg(debug_assertions)]
      let connector = if !connector.is_file() {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
          .join("..")
          .join("local-adapter")
          .join("dist")
          .join("mt5-connector")
          .join("mt5-connector.exe")
      } else {
        connector
      };
      app.state::<ConnectorManager>().start(connector).map_err(std::io::Error::other)?;
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|handle, event| {
    if matches!(event, RunEvent::Exit) {
      handle.state::<ConnectorManager>().stop();
    }
  });
}
