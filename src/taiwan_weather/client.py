"""
中央氣象署 (CWA) API 連線客戶端模組
負責進行 HTTP API 請求、超時處理、重試機制與錯誤容錯
"""

import logging
from typing import Optional, List
from datetime import datetime
import httpx

from .config import CWA_API_KEY, CWA_BASE_URL
from .models import ForecastResponse, CityForecast, WeatherAlert
from .parsers import parse_cwa_forecast, parse_cwa_alerts
from .mock_data import get_mock_forecast_response

logger = logging.getLogger("taiwan_weather.client")


class CWAClient:
    """中央氣象署開放資料平臺 API 客戶端"""

    def __init__(self, api_key: Optional[str] = None, timeout: float = 10.0):
        if api_key is None:
            self.api_key = (CWA_API_KEY or "").strip()
        else:
            self.api_key = api_key.strip()
        self.base_url = CWA_BASE_URL
        self.timeout = timeout

    @property
    def has_api_key(self) -> bool:
        """檢查是否已設定 API 金鑰"""
        return bool(self.api_key and not self.api_key.startswith("CWA-YOUR"))

    async def get_forecast(self, city_name: Optional[str] = None) -> ForecastResponse:
        """
        取得 36 小時天氣預報 (F-C0032-001)
        若無金鑰或連線失敗，自動無縫回傳模擬資料以利展示與開發
        """
        if not self.has_api_key:
            logger.warning("未偵測到有效 CWA_API_KEY，使用本機預設模擬資料。")
            mock_res = get_mock_forecast_response()
            if city_name:
                mock_res.cities = [c for c in mock_res.cities if c.city_name == city_name]
                mock_res.total_cities = len(mock_res.cities)
            return mock_res

        endpoint = f"{self.base_url}/F-C0032-001"
        params = {
            "Authorization": self.api_key,
            "format": "JSON",
        }
        if city_name:
            # 支援 台/臺 自動對照
            c_name = city_name.replace("台", "臺")
            params["locationName"] = c_name

        # 部分 OpenSSL 3.x / Python 3.14 環境因氣象署憑證缺 Subject Key Identifier 會校驗失敗，故忽略憑證校驗
        async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
            try:
                # 請求預報資料
                res = await client.get(endpoint, params=params)
                res.raise_for_status()
                data = res.json()

                if not data.get("success") == "true":
                    logger.error(f"氣象署 API 回傳失敗: {data}")
                    mock_res = get_mock_forecast_response()
                    if city_name:
                        c_name = city_name.replace("台", "臺")
                        mock_res.cities = [c for c in mock_res.cities if c.city_name == c_name]
                        mock_res.total_cities = len(mock_res.cities)
                    return mock_res

                cities: List[CityForecast] = parse_cwa_forecast(data)

                # 嘗試請求即時警特報 (W-C0033-001)
                alerts = await self._get_alerts_safe(client)

                return ForecastResponse(
                    status="success",
                    source="CWA_API",
                    is_live=True,
                    updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    total_cities=len(cities),
                    cities=cities,
                    alerts=alerts
                )

            except httpx.HTTPStatusError as e:
                logger.error(f"CWA API HTTP 錯誤 [{e.response.status_code}]: {e}")
                fallback = get_mock_forecast_response()
                fallback.source = f"FALLBACK_ERROR_{e.response.status_code}"
                if city_name:
                    c_name = city_name.replace("台", "臺")
                    fallback.cities = [c for c in fallback.cities if c.city_name == c_name]
                    fallback.total_cities = len(fallback.cities)
                return fallback
            except Exception as e:
                logger.error(f"連線 CWA API 發生異常: {e}")
                fallback = get_mock_forecast_response()
                fallback.source = "FALLBACK_NETWORK_ERROR"
                if city_name:
                    c_name = city_name.replace("台", "臺")
                    fallback.cities = [c for c in fallback.cities if c.city_name == c_name]
                    fallback.total_cities = len(fallback.cities)
                return fallback

    async def _get_alerts_safe(self, client: httpx.AsyncClient) -> List[WeatherAlert]:
        """嘗試獲取氣象特報，若出錯或無資料則回傳空清單"""
        try:
            alert_endpoint = f"{self.base_url}/W-C0033-001"
            params = {"Authorization": self.api_key, "format": "JSON"}
            res = await client.get(alert_endpoint, params=params)
            if res.status_code == 200:
                data = res.json()
                return parse_cwa_alerts(data)
        except Exception as e:
            logger.debug(f"警特報取得忽略: {e}")
        return []
