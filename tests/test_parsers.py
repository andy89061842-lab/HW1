import json
from pathlib import Path
from taiwan_weather.parsers import parse_cwa_forecast, parse_cwa_alerts
from taiwan_weather.models import CityForecast


def test_parse_cwa_forecast_sample():
    fixture_path = Path(__file__).parent / "fixtures" / "sample_cwa_response.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    cities = parse_cwa_forecast(data)
    assert len(cities) == 1
    taipei = cities[0]

    assert isinstance(taipei, CityForecast)
    assert taipei.city_name == "臺北市"
    assert taipei.region == "北部"
    assert len(taipei.periods) == 3

    # 檢查第 1 時段
    p1 = taipei.periods[0]
    assert p1.weather == "多雲短暫雨"
    assert p1.pop == 30
    assert p1.min_temp == 24
    assert p1.max_temp == 30
    assert p1.comfort == "舒適"
    assert "🌧️" in p1.icon or "🌦️" in p1.icon

    # 最高降雨機率
    assert taipei.highest_pop == 30


def test_parse_cwa_forecast_empty():
    cities = parse_cwa_forecast({})
    assert cities == []
