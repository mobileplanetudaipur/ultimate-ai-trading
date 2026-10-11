export type PersistentRunState = 'RUNNING' | 'STOPPED';

const STORAGE_KEY = 'ultimate_ai_trading_run_control_v1';

export const persistentRunControl = {
  load(): PersistentRunState {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved === 'RUNNING' ? 'RUNNING' : 'STOPPED';
    } catch {
      return 'STOPPED';
    }
  },
  save(state: PersistentRunState): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, state);
    } catch (error) {
      throw new Error('Run/stop state could not be saved on this device.', { cause: error });
    }
  }
};
