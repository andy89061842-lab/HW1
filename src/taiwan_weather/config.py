"""
系統環境設定模組
負責讀取 .env 檔案與系統參數
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# 專案根目錄
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# 載入 .env 檔案
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# 中央氣象署 (CWA) API 設定
CWA_API_KEY = os.getenv("CWA_API_KEY", "").strip()
CWA_BASE_URL = "https://opendata.cwa.gov.tw/api/v1/rest/datastore"

# 伺服器設定
SERVER_HOST = os.getenv("HOST", "127.0.0.1")
SERVER_PORT = int(os.getenv("PORT", "8000"))
DEBUG_MODE = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

# 台灣 22 縣市分區定義
TAIWAN_REGIONS = {
    "北部": ["基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "宜蘭縣"],
    "中部": ["苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣"],
    "南部": ["嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣"],
    "東部": ["花蓮縣", "臺東縣"],
    "離島": ["澎湖縣", "金門縣", "連江縣"]
}

# 所有縣市扁平化列表 (支援標準寫法與台/臺轉換)
ALL_CITIES = [city for cities in TAIWAN_REGIONS.values() for city in cities]

# 常用氣象圖示與 Emoji 映射表
WEATHER_ICON_MAP = {
    "晴": "☀️",
    "多雲": "⛅",
    "陰": "☁️",
    "雨": "🌧️",
    "雷": "⛈️",
    "陣雨": "🌦️",
    "短暫雨": "🌦️",
    "午後雷陣雨": "⛈️",
    "霧": "🌫️",
    "雪": "❄️"
}

def get_weather_icon(weather_desc: str) -> str:
    """根據天氣現象敘述返回合適的 Emoji 圖示"""
    if "雷" in weather_desc:
        return "⛈️"
    if "短暫雨" in weather_desc or "陣雨" in weather_desc:
        return "🌦️"
    if "雨" in weather_desc:
        return "🌧️"
    if "雪" in weather_desc:
        return "❄️"
    if "霧" in weather_desc:
        return "🌫️"
    if "陰" in weather_desc:
        return "☁️"
    if "多雲" in weather_desc:
        return "⛅"
    if "晴" in weather_desc:
        return "☀️"
    return "🌤️"
