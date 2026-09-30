from fastapi.testclient import TestClient
from taiwan_weather.api import app

client = TestClient(app)


def test_api_status_endpoint():
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "cwa_api_key_configured" in data
    assert "api_source" in data


def test_api_cities_endpoint():
    response = client.get("/api/cities")
    assert response.status_code == 200
    data = response.json()
    assert "regions" in data
    assert "all_cities" in data
    assert data["total"] == 22
    assert "臺北市" in data["all_cities"]


def test_api_forecast_endpoint():
    response = client.get("/api/forecast")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "cities" in data
    assert len(data["cities"]) > 0


def test_api_single_city_forecast():
    response = client.get("/api/forecast/臺北市")
    assert response.status_code == 200
    data = response.json()
    assert data["city_name"] == "臺北市"
    assert len(data["periods"]) == 3
