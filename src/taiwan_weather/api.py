"""
FastAPI 後端應用程式
提供 RESTful API 端點與現代化前端儀表板靜態檔案託管
"""

import os
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .config import (
    SERVER_HOST,
    SERVER_PORT,
    DEBUG_MODE,
    TAIWAN_REGIONS,
    ALL_CITIES,
    CWA_API_KEY,
)
from .client import CWAClient
from .models import ForecastResponse

app = FastAPI(
    title="台灣天氣預報 API (Taiwan Weather API)",
    description="串接中央氣象署 (CWA) 開放資料平臺，提供全台 22 縣市即時預報與警特報",
    version="0.1.0"
)

# 允許跨來源請求 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 靜態檔案路徑
STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# CWA 客戶端單例
client = CWAClient()


@app.get("/", summary="首頁儀表板")
async def index():
    """提供現代化天氣預報前端網頁"""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Taiwan Weather API is running. Static dashboard not found."}


@app.get("/api/forecast", response_model=ForecastResponse, summary="取得全台或指定縣市天氣預報")
async def get_forecast(
    city: Optional[str] = Query(None, description="縣市名稱 (例: 臺北市 或 高雄市)")
):
    """
    取得 36 小時天氣預報。
    若未指定 city，回傳全台 22 縣市；若指定 city，僅回傳該縣市資料。
    """
    return await client.get_forecast(city_name=city)


@app.get("/api/forecast/{city_name}", summary="取得單一縣市天氣預報")
async def get_city_forecast(city_name: str):
    """取得指定特定縣市的天氣預報資料"""
    normalized_name = city_name.replace("台", "臺")
    res = await client.get_forecast(city_name=normalized_name)
    matched = [c for c in res.cities if c.city_name == normalized_name]
    if not matched:
        raise HTTPException(status_code=404, detail=f"找不到縣市：{city_name}")
    return matched[0]


@app.get("/api/cities", summary="取得台灣分區與縣市清單")
async def get_cities():
    """回傳台灣各分區 (北部、中部、南部、東部、離島) 及所有縣市列表"""
    return {
        "regions": TAIWAN_REGIONS,
        "all_cities": ALL_CITIES,
        "total": len(ALL_CITIES)
    }


@app.get("/api/alerts", summary="取得即時氣象警特報")
async def get_alerts():
    """取得當前中央氣象署發布之氣象警報或特報"""
    forecast_data = await client.get_forecast()
    return {
        "count": len(forecast_data.alerts),
        "alerts": forecast_data.alerts
    }


@app.get("/api/status", summary="取得系統連線狀態")
async def get_status():
    """回傳 API 金鑰配置與連線狀態"""
    has_key = client.has_api_key
    masked_key = f"{CWA_API_KEY[:4]}...{CWA_API_KEY[-4:]}" if has_key and len(CWA_API_KEY) > 8 else "未設定"
    return {
        "cwa_api_key_configured": has_key,
        "masked_key": masked_key,
        "api_source": "CWA_LIVE" if has_key else "LOCAL_MOCK"
    }


def start_server():
    """啟動 Uvicorn 伺服器"""
    print(f"🚀 台灣天氣預報 Web 伺服器啟動於: http://{SERVER_HOST}:{SERVER_PORT}")
    uvicorn.run(
        "taiwan_weather.api:app",
        host=SERVER_HOST,
        port=SERVER_PORT,
        reload=DEBUG_MODE
    )


if __name__ == "__main__":
    start_server()
