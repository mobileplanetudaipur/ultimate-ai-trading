from bridge import LocalMT5Connector, serve_stdio


def main() -> int:
    try:
        import MetaTrader5 as mt5
    except ImportError:
        serve_stdio(LocalMT5Connector(None))
        return 2

    serve_stdio(LocalMT5Connector(mt5))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
