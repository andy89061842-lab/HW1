"""
台灣天氣預報系統 - 快速啟動入口腳本
Usage:
    python run.py               # 啟動現代化 Web 儀表板
    python run.py --cli         # 終端彩色查詢全台天氣
    python run.py --cli 臺北市  # 查詢指定縣市
"""

import sys
import argparse

# 解決 Windows 終端 (cp950) 編碼相容問題
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def main():
    parser = argparse.ArgumentParser(description="台灣天氣預報系統 (Taiwan Weather Forecast)")
    parser.add_argument("--cli", action="store_true", help="使用終端命令列模式 (Rich)")
    parser.add_argument("city", nargs="?", default=None, help="指定查詢縣市 (例: 臺北市)")
    parser.add_argument("--port", type=int, default=None, help="指定 Web 伺服器埠號 (預設 8000)")
    args = parser.parse_args()

    # 確保當前目錄與 src 在 Python 路徑中
    import sys
    from pathlib import Path
    src_dir = Path(__file__).resolve().parent / "src"
    if str(src_dir) not in sys.path:
        sys.path.insert(0, str(src_dir))

    if args.cli:
        from taiwan_weather.cli import main as cli_main
        sys.argv = [sys.argv[0]]
        if args.city:
            sys.argv.append(args.city)
        cli_main()
    else:
        import uvicorn
        from taiwan_weather.config import SERVER_HOST, SERVER_PORT, DEBUG_MODE
        port = args.port or SERVER_PORT
        print(f"==================================================")
        print(f"🌦️  台灣天氣預報系統 (Taiwan Weather Forecast)")
        print(f"🌐  網頁儀表板網址: http://{SERVER_HOST}:{port}")
        print(f"📖  API 互動文件網址: http://{SERVER_HOST}:{port}/docs")
        print(f"==================================================")
        uvicorn.run("taiwan_weather.api:app", host=SERVER_HOST, port=port, reload=DEBUG_MODE)


if __name__ == "__main__":
    main()
