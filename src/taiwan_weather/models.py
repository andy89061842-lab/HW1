"""
資料模型定義模組 (Pydantic Models)
定義強型別資料結構，確保資料完整性與 API 輸出標準化
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class PeriodForecast(BaseModel):
    """單一時段的天氣預報資料 (約 12 小時區間)"""
    start_time: str = Field(description="預報起始時間 (YYYY-MM-DD HH:MM:SS)")
    end_time: str = Field(description="預報結束時間 (YYYY-MM-DD HH:MM:SS)")
    period_label: str = Field(default="", description="時段標籤 (例: 今日白天、今晚明晨、明日白天)")
    weather: str = Field(description="天氣現象文字 (例: 晴時多雲、午後短暫雷陣雨)")
    weather_code: Optional[str] = Field(default="", description="天氣代碼")
    icon: str = Field(default="🌤️", description="對應 Emoji 圖示")
    min_temp: int = Field(description="最低氣溫 (°C)")
    max_temp: int = Field(description="最高氣溫 (°C)")
    pop: int = Field(description="降雨機率 (%)")
    comfort: str = Field(default="", description="舒適度指數描述 (例: 舒適、悶熱)")


class CityForecast(BaseModel):
    """單一縣市的 36 小時天氣預報"""
    city_name: str = Field(description="縣市名稱 (例: 臺北市)")
    region: str = Field(description="分區 (北部、中部、南部、東部、離島)")
    periods: List[PeriodForecast] = Field(description="未來 3 個預報時段")
    current_temp_approx: Optional[int] = Field(default=None, description="目前概估溫度")
    highest_pop: int = Field(default=0, description="三個時段中最高的降雨機率 (%)")


class WeatherAlert(BaseModel):
    """即時氣象特報/警報"""
    headline: str = Field(description="特報標題 (例: 大雨特報、低溫特報)")
    hazard_type: str = Field(description="危害類型 (例: 豪雨、強風、低溫)")
    severity: str = Field(default="一般", description="警報等級 (特報、警報)")
    description: str = Field(description="詳細警報內容")
    affected_areas: List[str] = Field(default_factory=list, description="受影響縣市清單")
    updated_at: str = Field(description="發布與更新時間")


class ForecastResponse(BaseModel):
    """前端與 API 取得的綜合預報回應"""
    status: str = Field(default="success")
    source: str = Field(description="資料來源: 'CWA_API' 或 'LOCAL_MOCK'")
    is_live: bool = Field(description="是否為氣象署即時連線資料")
    updated_at: str = Field(description="資料更新時間")
    total_cities: int = Field(description="回傳縣市數量")
    cities: List[CityForecast] = Field(description="各縣市預報清單")
    alerts: List[WeatherAlert] = Field(default_factory=list, description="當前發布中的氣象特報")
