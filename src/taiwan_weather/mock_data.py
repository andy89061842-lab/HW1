"""
離線預設資料與假資料產生器 (Mock Data)
當未設定 CWA_API_KEY 或網路中斷時，確保系統仍可完整展示與測試
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any
from .config import TAIWAN_REGIONS, get_weather_icon
from .models import CityForecast, PeriodForecast, WeatherAlert, ForecastResponse


# 典型縣市的範例氣象狀態
SAMPLE_CITY_CONDITIONS = {
    "基隆市": ("陰短暫雨", 22, 26, 60, "稍有寒意至舒適"),
    "臺北市": ("多雲時晴", 24, 30, 20, "舒適至微熱"),
    "新北市": ("多雲時陰", 23, 29, 30, "舒適"),
    "桃園市": ("晴時多雲", 23, 29, 20, "舒適"),
    "新竹市": ("晴時多雲", 24, 29, 10, "舒適"),
    "新竹縣": ("晴時多雲", 23, 28, 10, "舒適"),
    "苗栗縣": ("晴天", 23, 30, 10, "舒適至微熱"),
    "臺中市": ("晴天", 24, 31, 0, "微熱至悶熱"),
    "彰化縣": ("晴天", 24, 31, 10, "微熱至悶熱"),
    "南投縣": ("多雲午後短暫陣雨", 22, 30, 40, "舒適至微熱"),
    "雲林縣": ("晴時多雲", 24, 31, 10, "微熱至悶熱"),
    "嘉義市": ("晴天", 24, 31, 10, "微熱至悶熱"),
    "嘉義縣": ("晴天", 24, 31, 10, "微熱"),
    "臺南市": ("晴天", 25, 32, 10, "悶熱"),
    "高雄市": ("晴時多雲", 26, 32, 10, "悶熱"),
    "屏東縣": ("多雲短暫陣雨", 25, 32, 30, "悶熱"),
    "宜蘭縣": ("陰短暫雨", 22, 27, 70, "舒適至微涼"),
    "花蓮縣": ("多雲局部雨", 23, 28, 40, "舒適"),
    "臺東縣": ("多雲短暫雨", 24, 29, 30, "舒適"),
    "澎湖縣": ("晴天", 25, 30, 0, "舒適至微熱"),
    "金門縣": ("晴時多雲", 22, 28, 10, "舒適"),
    "連江縣": ("多雲局部雨", 19, 24, 30, "稍有涼意")
}


def get_mock_periods() -> List[Dict[str, Any]]:
    """產生三個標準時段的標籤與時間 (12 小時一個時段)"""
    now = datetime.now()
    periods = []
    
    t1_start = now.replace(minute=0, second=0, microsecond=0)
    t1_end = t1_start + timedelta(hours=12)
    t2_end = t1_end + timedelta(hours=12)
    t3_end = t2_end + timedelta(hours=12)
    
    time_slots = [
        (t1_start, t1_end, "今日白天 (12hr)"),
        (t1_end, t2_end, "今晚明晨 (12hr)"),
        (t2_end, t3_end, "明日白天 (12hr)")
    ]
    return time_slots


def get_mock_forecast_response() -> ForecastResponse:
    """產生完整的 22 縣市模擬預報資料物件"""
    time_slots = get_mock_periods()
    city_forecasts: List[CityForecast] = []
    
    # 建立縣市對應分區
    city_to_region = {}
    for region, cities in TAIWAN_REGIONS.items():
        for c in cities:
            city_to_region[c] = region
            
    for city_name, base_info in SAMPLE_CITY_CONDITIONS.items():
        weather_text, base_min, base_max, base_pop, comfort = base_info
        periods: List[PeriodForecast] = []
        
        # 產生 3 個時段的微幅變動資料
        for i, (st, et, label) in enumerate(time_slots):
            # 晚上稍微降溫，降雨機率略微浮動
            temp_offset = -2 if i == 1 else 0
            cur_min = base_min + temp_offset
            cur_max = base_max + temp_offset
            cur_pop = max(0, min(100, base_pop + (10 if i == 0 else -10)))
            cur_weather = weather_text if i != 1 else ("晴時多雲" if "雨" not in weather_text else "多雲短暫雨")
            
            periods.append(PeriodForecast(
                start_time=st.strftime("%Y-%m-%d %H:%M:%S"),
                end_time=et.strftime("%Y-%m-%d %H:%M:%S"),
                period_label=label,
                weather=cur_weather,
                weather_code="01",
                icon=get_weather_icon(cur_weather),
                min_temp=cur_min,
                max_temp=cur_max,
                pop=cur_pop,
                comfort=comfort
            ))
            
        region = city_to_region.get(city_name, "北部")
        highest_pop = max(p.pop for p in periods)
        approx_temp = (periods[0].min_temp + periods[0].max_temp) // 2
        
        city_forecasts.append(CityForecast(
            city_name=city_name,
            region=region,
            periods=periods,
            current_temp_approx=approx_temp,
            highest_pop=highest_pop
        ))
        
    mock_alerts = [
        WeatherAlert(
            headline="大雨特報",
            hazard_type="大雨",
            severity="特報",
            description="東北季風影響，基隆北海岸及宜蘭山區有局部大雨發生的機率，請注意坍方及落石。",
            affected_areas=["基隆市", "新北市", "宜蘭縣"],
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M")
        )
    ]
    
    return ForecastResponse(
        status="success",
        source="LOCAL_MOCK",
        is_live=False,
        updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        total_cities=len(city_forecasts),
        cities=city_forecasts,
        alerts=mock_alerts
    )
