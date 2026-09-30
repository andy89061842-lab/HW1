import pytest
from taiwan_weather.client import CWAClient


@pytest.mark.asyncio
async def test_client_fallback_without_key():
    # 當沒有設定金鑰時，應該優雅地回退到 mock 資料
    client = CWAClient(api_key="")
    assert not client.has_api_key

    res = await client.get_forecast()
    assert res.status == "success"
    assert not res.is_live
    assert res.total_cities == 22


@pytest.mark.asyncio
async def test_client_filter_single_city():
    client = CWAClient(api_key="")
    res = await client.get_forecast(city_name="高雄市")
    assert res.total_cities == 1
    assert res.cities[0].city_name == "高雄市"
