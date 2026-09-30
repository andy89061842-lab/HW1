"""
氣象署 JSON 資料轉換與解析模組
負責將 CWA 巢狀 JSON 轉換為乾淨的 Pydantic 模型
"""

from typing import Dict, Any, List
from datetime import datetime
from .config import TAIWAN_REGIONS, get_weather_icon
from .models import CityForecast, PeriodForecast, WeatherAlert, ForecastResponse


def _generate_period_label(start_str: str, end_str: str, index: int) -> str:
    """根據預報起訖時間與序號產生易讀的標籤 (例如：今日白天、今晚明晨)"""
    try:
        start_dt = datetime.strptime(start_str, "%Y-%m-%d %H:%M:%S")
        hour = start_dt.hour
        
        if 5 <= hour < 12:
            time_name = "白天"
        elif 12 <= hour < 18:
            time_name = "下午/傍晚"
        else:
            time_name = "晚上/明晨"
            
        weekday_map = {0: "週一", 1: "週二", 2: "週三", 3: "週四", 4: "週五", 5: "週六", 6: "週日"}
        day_label = weekday_map.get(start_dt.weekday(), "")
        return f"{day_label} {time_name}"
    except Exception:
        fallback_labels = ["第 1 時段 (12hr)", "第 2 時段 (12hr)", "第 3 時段 (12hr)"]
        return fallback_labels[index] if index < len(fallback_labels) else f"時段 {index+1}"


def parse_cwa_forecast(cwa_json: Dict[str, Any]) -> List[CityForecast]:
    """
    解析 F-C0032-001 今明 36 小時預報資料
    """
    records = cwa_json.get("records", {})
    locations = records.get("location", [])
    
    # 建立縣市對應分區
    city_to_region = {}
    for region, cities in TAIWAN_REGIONS.items():
        for c in cities:
            city_to_region[c] = region
            
    parsed_cities: List[CityForecast] = []
    
    for loc in locations:
        city_name = loc.get("locationName", "")
        if not city_name:
            continue
            
        elements = {elem.get("elementName"): elem.get("time", []) for elem in loc.get("weatherElement", [])}
        
        wx_times = elements.get("Wx", [])
        pop_times = elements.get("PoP", [])
        mint_times = elements.get("MinT", [])
        maxt_times = elements.get("MaxT", [])
        ci_times = elements.get("CI", [])
        
        # 預期為 3 個時段
        num_periods = len(wx_times)
        periods: List[PeriodForecast] = []
        
        for i in range(num_periods):
            # 取出 Wx
            wx_data = wx_times[i] if i < len(wx_times) else {}
            start_time = wx_data.get("startTime", "")
            end_time = wx_data.get("endTime", "")
            wx_param = wx_data.get("parameter", {})
            weather_desc = wx_param.get("parameterName", "晴時多雲")
            weather_code = wx_param.get("parameterValue", "")
            
            # 取出 PoP (降雨機率)
            pop_data = pop_times[i] if i < len(pop_times) else {}
            try:
                pop_val = int(pop_data.get("parameter", {}).get("parameterName", "0"))
            except ValueError:
                pop_val = 0
                
            # 取出 MinT (最低溫)
            mint_data = mint_times[i] if i < len(mint_times) else {}
            try:
                min_t = int(mint_data.get("parameter", {}).get("parameterName", "20"))
            except ValueError:
                min_t = 20
                
            # 取出 MaxT (最高溫)
            maxt_data = maxt_times[i] if i < len(maxt_times) else {}
            try:
                max_t = int(maxt_data.get("parameter", {}).get("parameterName", "28"))
            except ValueError:
                max_t = 28
                
            # 取出 CI (舒適度)
            ci_data = ci_times[i] if i < len(ci_times) else {}
            comfort_val = ci_data.get("parameter", {}).get("parameterName", "")
            
            period_label = _generate_period_label(start_time, end_time, i)
            
            periods.append(PeriodForecast(
                start_time=start_time,
                end_time=end_time,
                period_label=period_label,
                weather=weather_desc,
                weather_code=weather_code,
                icon=get_weather_icon(weather_desc),
                min_temp=min_t,
                max_temp=max_t,
                pop=pop_val,
                comfort=comfort_val
            ))
            
        region = city_to_region.get(city_name, "其他")
        highest_pop = max((p.pop for p in periods), default=0)
        approx_temp = (periods[0].min_temp + periods[0].max_temp) // 2 if periods else None
        
        parsed_cities.append(CityForecast(
            city_name=city_name,
            region=region,
            periods=periods,
            current_temp_approx=approx_temp,
            highest_pop=highest_pop
        ))
        
    return parsed_cities


def parse_cwa_alerts(alerts_json: Dict[str, Any]) -> List[WeatherAlert]:
    """
    解析 W-C0033-001 氣象預警特報資料
    """
    alerts: List[WeatherAlert] = []
    records = alerts_json.get("records", {})
    record_list = records.get("record", [])
    
    for item in record_list:
        try:
            dataset_info = item.get("datasetInfo", {})
            headline = dataset_info.get("datasetDescription", "氣象特報")
            updated_at = dataset_info.get("issueTime", datetime.now().strftime("%Y-%m-%d %H:%M"))
            
            # 取得警報內容文字
            contents = item.get("contents", {}).get("content", {})
            desc = contents.get("contentText", "")
            
            # 取得受影響縣市
            locations = item.get("location", [])
            affected = [loc.get("locationName") for loc in locations if loc.get("locationName")]
            
            hazard_type = "氣象特報"
            hazard_data = item.get("hazardConditions", {}).get("hazards", {}).get("hazard", [])
            if isinstance(hazard_data, list) and hazard_data:
                hazard_type = hazard_data[0].get("info", {}).get("phenomena", "特報")
            elif isinstance(hazard_data, dict):
                hazard_type = hazard_data.get("info", {}).get("phenomena", "特報")
                
            alerts.append(WeatherAlert(
                headline=headline,
                hazard_type=hazard_type,
                severity="特報",
                description=desc,
                affected_areas=affected,
                updated_at=updated_at
            ))
        except Exception:
            continue
            
    return alerts
