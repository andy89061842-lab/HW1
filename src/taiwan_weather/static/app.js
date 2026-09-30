/**
 * 台灣天氣即時預報 - 前端互動邏輯 (Modern Vanilla JS + D3.js + Chart.js)
 */

// 全局狀態儲存
const state = {
    allCities: [],
    filteredCities: [],
    alerts: [],
    currentRegion: "全部",
    searchQuery: "",
    sortBy: "default",
    chartSortBy: "default",
    isLive: false,
    updatedAt: "",
    currentView: "cards", // "cards" | "map" | "charts"
    mapMode: "temp",      // "temp" | "rain"
    selectedCity: null,
    topoData: null,
    mapRendered: false,
    chartsRendered: false,
    chartInstances: {
        countyComparison: null,
        regionalClimate: null,
        rainfallRisk: null,
        modalForecast: null
    }
};

// DOM 元素引用
const DOM = {
    // 導航與連線狀態
    statusBadge: document.getElementById("status-badge"),
    statusText: document.getElementById("status-text"),
    refreshBtn: document.getElementById("refresh-btn"),
    alertBanner: document.getElementById("alert-banner"),
    alertHeadline: document.getElementById("alert-headline"),
    alertDesc: document.getElementById("alert-desc"),
    alertAreas: document.getElementById("alert-areas"),

    // 總覽統計卡片
    statAvgTemp: document.getElementById("stat-avg-temp"),
    statMaxTemp: document.getElementById("stat-max-temp"),
    statMaxCity: document.getElementById("stat-max-city"),
    statMaxPop: document.getElementById("stat-max-pop"),
    statPopCity: document.getElementById("stat-pop-city"),
    statUpdateTime: document.getElementById("stat-update-time"),

    // 檢視切換按鈕與視圖容器
    viewSwitcher: document.getElementById("view-switcher"),
    viewBtns: document.querySelectorAll(".view-btn"),
    viewCards: document.getElementById("view-cards"),
    viewMap: document.getElementById("view-map"),
    viewCharts: document.getElementById("view-charts"),

    // 卡片清單控制項
    regionTabs: document.getElementById("region-tabs"),
    searchInput: document.getElementById("search-input"),
    clearSearchBtn: document.getElementById("clear-search-btn"),
    sortSelect: document.getElementById("sort-select"),
    forecastGrid: document.getElementById("forecast-grid"),

    // 地圖檢視控制項
    mapModeGroup: document.getElementById("map-mode-group"),
    btnModeTemp: document.getElementById("btn-mode-temp"),
    btnModeRain: document.getElementById("btn-mode-rain"),
    legendScale: document.getElementById("legend-scale"),
    legendMin: document.getElementById("legend-min"),
    legendMid: document.getElementById("legend-mid"),
    legendMax: document.getElementById("legend-max"),
    resetMapZoomBtn: document.getElementById("reset-map-zoom"),
    mapSvg: document.getElementById("taiwan-map-svg"),
    mapTooltip: document.getElementById("map-tooltip"),
    mapLoading: document.getElementById("map-loading"),

    // 地圖右側焦點面板
    spotlightRegion: document.getElementById("spotlight-region"),
    spotlightCityName: document.getElementById("spotlight-city-name"),
    spotlightIcon: document.getElementById("spotlight-icon"),
    spotlightTemp: document.getElementById("spotlight-temp"),
    spotlightDesc: document.getElementById("spotlight-desc"),
    spotlightRange: document.getElementById("spotlight-range"),
    spotlightPop: document.getElementById("spotlight-pop"),
    spotlightComfort: document.getElementById("spotlight-comfort"),
    spotlightPeriods: document.getElementById("spotlight-periods"),
    spotlightOpenModalBtn: document.getElementById("spotlight-open-modal-btn"),

    // 圖表檢視控制項
    chartSortSelect: document.getElementById("chart-sort-select"),

    // 詳細彈窗 Modal
    detailModal: document.getElementById("detail-modal"),
    modalCloseBtn: document.getElementById("modal-close-btn"),
    modalCityName: document.getElementById("modal-city-name"),
    modalRegion: document.getElementById("modal-region"),
    modalWeatherIcon: document.getElementById("modal-weather-icon"),
    modalTemp: document.getElementById("modal-temp"),
    modalDesc: document.getElementById("modal-desc"),
    modalTimeline: document.getElementById("modal-timeline"),
    modalTipsText: document.getElementById("modal-tips-text")
};

// =========================================================
// 頁面初始化
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
    initChartJsTheme();
    initEventListeners();
    fetchWeatherData();
});

// 設定 Chart.js 默認暗黑風格樣式
function initChartJsTheme() {
    if (typeof Chart === "undefined") return;
    Chart.defaults.color = "#94a3b8";
    Chart.defaults.borderColor = "rgba(255, 255, 255, 0.08)";
    Chart.defaults.font.family = "'Outfit', 'Noto Sans TC', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = "rgba(15, 23, 42, 0.95)";
    Chart.defaults.plugins.tooltip.borderColor = "rgba(56, 189, 248, 0.3)";
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
}

// =========================================================
// 事件監聽綁定
// =========================================================
function initEventListeners() {
    // 檢視切換 (卡片 / 地圖 / 圖表)
    DOM.viewSwitcher.addEventListener("click", (e) => {
        const btn = e.target.closest(".view-btn");
        if (!btn) return;
        const targetView = btn.dataset.view;
        switchView(targetView);
    });

    // 重新整理按鈕
    DOM.refreshBtn.addEventListener("click", () => {
        const icon = DOM.refreshBtn.querySelector(".refresh-icon");
        icon.classList.add("rotating");
        fetchWeatherData().finally(() => {
            setTimeout(() => icon.classList.remove("rotating"), 600);
        });
    });

    // 分區切換 (卡片視圖)
    DOM.regionTabs.addEventListener("click", (e) => {
        if (!e.target.classList.contains("region-tab")) return;
        DOM.regionTabs.querySelectorAll(".region-tab").forEach(tab => tab.classList.remove("active"));
        e.target.classList.add("active");
        state.currentRegion = e.target.dataset.region;
        applyFiltersAndRender();
    });

    // 搜尋輸入
    DOM.searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        DOM.clearSearchBtn.style.display = state.searchQuery ? "block" : "none";
        applyFiltersAndRender();
    });

    // 清除搜尋
    DOM.clearSearchBtn.addEventListener("click", () => {
        DOM.searchInput.value = "";
        state.searchQuery = "";
        DOM.clearSearchBtn.style.display = "none";
        applyFiltersAndRender();
    });

    // 排序選擇
    DOM.sortSelect.addEventListener("change", (e) => {
        state.sortBy = e.target.value;
        applyFiltersAndRender();
    });

    // 地圖著色模式切換 (氣溫 / 降雨)
    DOM.mapModeGroup.addEventListener("click", (e) => {
        const btn = e.target.closest(".mode-btn");
        if (!btn || btn.classList.contains("active")) return;
        DOM.mapModeGroup.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.mapMode = btn.dataset.mode;
        updateMapColorsAndLegend();
    });

    // 地圖視角重置按鈕
    DOM.resetMapZoomBtn.addEventListener("click", () => {
        if (state.topoData) renderTaiwanMap(state.topoData);
    });

    // 地圖右側 Spotlight 查看完整彈窗按鈕
    DOM.spotlightOpenModalBtn.addEventListener("click", () => {
        if (state.selectedCity) {
            openDetailModal(state.selectedCity);
        }
    });

    // 圖表排序切換
    DOM.chartSortSelect.addEventListener("change", (e) => {
        state.chartSortBy = e.target.value;
        renderCountyComparisonChart();
    });

    // 彈窗關閉按鈕與點擊背景關閉
    DOM.modalCloseBtn.addEventListener("click", closeModal);
    DOM.detailModal.addEventListener("click", (e) => {
        if (e.target === DOM.detailModal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });
}

// 切換主檢視 (Cards / Map / Charts)
function switchView(viewName) {
    state.currentView = viewName;

    DOM.viewBtns.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === viewName);
    });

    DOM.viewCards.style.display = viewName === "cards" ? "block" : "none";
    DOM.viewMap.style.display = viewName === "map" ? "block" : "none";
    DOM.viewCharts.style.display = viewName === "charts" ? "block" : "none";

    if (viewName === "map") {
        if (!state.mapRendered) {
            loadAndRenderMap();
        }
    } else if (viewName === "charts") {
        renderAllCharts();
    }
}

// =========================================================
// 向 API 取得資料
// =========================================================
async function fetchWeatherData() {
    try {
        const res = await fetch("/api/forecast");
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();

        state.allCities = data.cities || [];
        state.alerts = data.alerts || [];
        state.isLive = data.is_live;
        state.updatedAt = data.updated_at;

        // 預設選中臺北市
        if (!state.selectedCity && state.allCities.length > 0) {
            state.selectedCity = state.allCities.find(c => c.city_name === "臺北市") || state.allCities[0];
        }

        updateStatusBadge(data.is_live, data.source);
        renderAlerts(state.alerts);
        renderOverviewStats(state.allCities, state.updatedAt);
        applyFiltersAndRender();

        // 若地圖已載入，更新地圖顏色與焦點
        if (state.mapRendered) {
            updateMapColorsAndLegend();
            if (state.selectedCity) updateSpotlightCard(state.selectedCity);
        }

        // 若圖表已載入，更新圖表
        if (state.currentView === "charts") {
            renderAllCharts();
        }
    } catch (err) {
        console.error("資料載入失敗:", err);
        DOM.forecastGrid.innerHTML = `
            <div class="empty-state">
                <p>⚠️ 無法取得氣象資料，請確認後端服務是否已正常啟動。</p>
                <small>${err.message}</small>
            </div>
        `;
    }
}

// 更新頂部連線狀態標籤
function updateStatusBadge(isLive, source) {
    if (isLive) {
        DOM.statusBadge.className = "status-badge";
        DOM.statusText.textContent = "氣象署即時連線 (LIVE)";
    } else {
        DOM.statusBadge.className = "status-badge mock";
        DOM.statusText.textContent = "本機離線展示 (MOCK)";
    }
}

// 渲染警特報橫幅
function renderAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
        DOM.alertBanner.style.display = "none";
        return;
    }

    const firstAlert = alerts[0];
    DOM.alertBanner.style.display = "flex";
    DOM.alertHeadline.textContent = `${firstAlert.hazard_type}特報：${firstAlert.headline}`;
    DOM.alertDesc.textContent = firstAlert.description;

    DOM.alertAreas.innerHTML = "";
    if (firstAlert.affected_areas && firstAlert.affected_areas.length > 0) {
        firstAlert.affected_areas.forEach(area => {
            const span = document.createElement("span");
            span.className = "alert-tag";
            span.textContent = area;
            DOM.alertAreas.appendChild(span);
        });
    }
}

// 統計數據總覽計算
function renderOverviewStats(cities, updatedAt) {
    if (!cities || cities.length === 0) return;

    let totalTemp = 0;
    let maxTemp = -999;
    let maxTempCity = "";
    let maxPop = -1;
    let maxPopCity = "";

    cities.forEach(c => {
        const curTemp = c.current_temp_approx || ((c.periods[0].min_temp + c.periods[0].max_temp) / 2);
        totalTemp += curTemp;

        const cityHighestTemp = Math.max(...c.periods.map(p => p.max_temp));
        if (cityHighestTemp > maxTemp) {
            maxTemp = cityHighestTemp;
            maxTempCity = c.city_name;
        }

        if (c.highest_pop > maxPop) {
            maxPop = c.highest_pop;
            maxPopCity = c.city_name;
        }
    });

    const avgTemp = Math.round(totalTemp / cities.length);
    DOM.statAvgTemp.textContent = `${avgTemp} °C`;
    DOM.statMaxTemp.textContent = `${maxTemp} °C`;
    DOM.statMaxCity.textContent = `${maxTempCity}`;
    DOM.statMaxPop.textContent = `${maxPop} %`;
    DOM.statPopCity.textContent = `${maxPopCity}`;

    if (updatedAt) {
        const timePart = updatedAt.split(" ")[1] || updatedAt;
        DOM.statUpdateTime.textContent = timePart.substring(0, 5);
    }
}

// =========================================================
// 視圖 1: 卡片清單渲染
// =========================================================
function applyFiltersAndRender() {
    let result = [...state.allCities];

    if (state.currentRegion !== "全部") {
        result = result.filter(c => c.region === state.currentRegion);
    }

    if (state.searchQuery) {
        const queryNorm = state.searchQuery.replace(/台/g, "臺");
        result = result.filter(c => 
            c.city_name.toLowerCase().includes(state.searchQuery) ||
            c.city_name.includes(queryNorm)
        );
    }

    if (state.sortBy === "temp-desc") {
        result.sort((a, b) => (b.periods[0]?.max_temp || 0) - (a.periods[0]?.max_temp || 0));
    } else if (state.sortBy === "temp-asc") {
        result.sort((a, b) => (a.periods[0]?.min_temp || 0) - (b.periods[0]?.min_temp || 0));
    } else if (state.sortBy === "pop-desc") {
        result.sort((a, b) => b.highest_pop - a.highest_pop);
    }

    renderCards(result);
}

function renderCards(cities) {
    if (cities.length === 0) {
        DOM.forecastGrid.innerHTML = `
            <div class="empty-state">
                <p>🔍 沒有找到符合條件的縣市</p>
                <small>請嘗試切換分區或變更搜尋關鍵字</small>
            </div>
        `;
        return;
    }

    DOM.forecastGrid.innerHTML = "";
    cities.forEach(city => {
        const card = createCityCard(city);
        DOM.forecastGrid.appendChild(card);
    });
}

function createCityCard(city) {
    const card = document.createElement("div");
    card.className = "weather-card";
    card.setAttribute("id", `card-${city.city_name}`);

    const p0 = city.periods[0] || {};
    const rainClass = p0.pop >= 40 ? "high-rain" : "";

    let periodsHtml = "";
    city.periods.slice(0, 3).forEach(p => {
        periodsHtml += `
            <div class="period-mini-item">
                <span class="period-label-col">${p.period_label || '時段'}</span>
                <span class="period-weather-col">${p.icon} ${p.weather}</span>
                <span class="period-temp-col">${p.min_temp}° ~ ${p.max_temp}°</span>
                <span class="period-pop-col">💧${p.pop}%</span>
            </div>
        `;
    });

    card.innerHTML = `
        <div class="card-top">
            <div class="city-title-group">
                <h3 class="city-title">${city.city_name}</h3>
                <span class="region-badge">${city.region}</span>
            </div>
            <div class="current-weather-badge">
                <span class="current-icon">${p0.icon || '⛅'}</span>
                <div class="current-desc">${p0.weather || '多雲'}</div>
            </div>
        </div>

        <div class="temp-highlight-row">
            <div class="temp-range-text">
                ${p0.min_temp || '--'}° ~ ${p0.max_temp || '--'}° <span>氣溫</span>
            </div>
            <div class="pop-badge ${rainClass}">
                <span>💧 降雨機率 ${p0.pop || 0}%</span>
            </div>
        </div>

        <div class="pop-progress-bar">
            <div class="pop-progress-fill" style="width: ${p0.pop || 0}%;"></div>
        </div>

        <div class="period-mini-list">
            ${periodsHtml}
        </div>
    `;

    card.addEventListener("click", () => openDetailModal(city));
    return card;
}

// =========================================================
// 視圖 2: 台灣即時氣象地圖 (D3.js + TopoJSON)
// =========================================================
async function loadAndRenderMap() {
    try {
        DOM.mapLoading.style.display = "flex";
        const res = await fetch("/static/vendor/taiwan.topo.json");
        if (!res.ok) throw new Error("無法讀取台灣地理圖資");
        state.topoData = await res.json();
        renderTaiwanMap(state.topoData);
        state.mapRendered = true;
    } catch (err) {
        console.error("地圖載入失敗:", err);
        DOM.mapLoading.innerHTML = `<p style="color: #f43f5e;">⚠️ 地圖載入失敗：${err.message}</p>`;
    } finally {
        setTimeout(() => {
            DOM.mapLoading.style.opacity = "0";
            setTimeout(() => DOM.mapLoading.style.display = "none", 300);
        }, 200);
    }
}

// 顏色尺度計算
function getTemperatureColor(temp) {
    // 漸層: 藍色(16°C) -> 翠綠(24°C) -> 明黃(28°C) -> 橙紅(32°C) -> 炙熱深紅(36°C+)
    const scale = d3.scaleLinear()
        .domain([16, 22, 26, 30, 35])
        .range(["#38bdf8", "#2dd4bf", "#facc15", "#fb923c", "#f43f5e"])
        .clamp(true);
    return scale(temp);
}

function getRainfallColor(pop) {
    // 漸層: 乾爽暗灰藍(0%) -> 輕微藍(20%) -> 陣雨寶藍(50%) -> 大雨青藍(80%) -> 豪雨亮青(100%)
    const scale = d3.scaleLinear()
        .domain([0, 20, 50, 80, 100])
        .range(["#1e293b", "#1e40af", "#2563eb", "#0284c7", "#22d3ee"])
        .clamp(true);
    return scale(pop);
}

function renderTaiwanMap(topo) {
    const svg = d3.select("#taiwan-map-svg");
    svg.selectAll("*").remove();

    const width = 760;
    const height = 820;

    const geojson = topojson.feature(topo, topo.objects.layer1);

    // 針對台灣本島及離島最佳視野投影
    const projection = d3.geoMercator().fitExtent([[35, 30], [width - 35, height - 30]], geojson);
    const pathGenerator = d3.geoPath().projection(projection);

    const gCounties = svg.append("g").attr("class", "counties-group");
    const gLabels = svg.append("g").attr("class", "labels-group");

    // 綁定各縣市圖層
    const paths = gCounties.selectAll("path")
        .data(geojson.features)
        .enter()
        .append("path")
        .attr("class", d => {
            const cName = d.properties.COUNTYNAME;
            const isSelected = state.selectedCity && state.selectedCity.city_name === cName;
            return isSelected ? "county-path selected" : "county-path";
        })
        .attr("id", d => `map-path-${d.properties.COUNTYNAME}`)
        .attr("d", pathGenerator)
        .attr("fill", d => computeCountyFill(d.properties.COUNTYNAME))
        .on("mouseenter", (event, d) => onCountyHover(event, d))
        .on("mousemove", (event) => onCountyMove(event))
        .on("mouseleave", () => onCountyLeave())
        .on("click", (event, d) => onCountyClick(d));

    // 繪製縣市標籤與中心氣溫
    geojson.features.forEach(feat => {
        const cName = feat.properties.COUNTYNAME;
        const centroid = pathGenerator.centroid(feat);
        if (!centroid || isNaN(centroid[0])) return;

        // 特殊微調標籤位置避免過度重疊
        let [x, y] = centroid;
        if (cName === "基隆市") { x += 14; y -= 8; }
        if (cName === "新竹市") { x -= 8; y += 4; }
        if (cName === "嘉義市") { x -= 6; y += 2; }
        if (cName === "連江縣") { x += 6; }

        const cityObj = state.allCities.find(c => c.city_name === cName);
        const curTemp = cityObj ? (cityObj.current_temp_approx || cityObj.periods[0]?.max_temp || "--") : "--";

        const labelGroup = gLabels.append("g")
            .attr("class", "county-label-group")
            .attr("transform", `translate(${x}, ${y})`);

        labelGroup.append("text")
            .attr("class", "county-label-text")
            .attr("y", -2)
            .text(cName.replace("市", "").replace("縣", ""));

        labelGroup.append("text")
            .attr("class", "county-temp-text")
            .attr("y", 11)
            .attr("id", `map-label-temp-${cName}`)
            .text(`${curTemp}°`);
    });

    // 初始右側 Spotlight 面板
    if (state.selectedCity) {
        updateSpotlightCard(state.selectedCity);
    }
}

// 計算縣市填充色彩
function computeCountyFill(cName) {
    const city = state.allCities.find(c => c.city_name === cName);
    if (!city) return "#1e293b";

    const p0 = city.periods[0] || {};
    if (state.mapMode === "temp") {
        const temp = city.current_temp_approx || ((p0.min_temp + p0.max_temp) / 2);
        return getTemperatureColor(temp);
    } else {
        const pop = p0.pop || 0;
        return getRainfallColor(pop);
    }
}

// 更新地圖顏色與圖例標籤
function updateMapColorsAndLegend() {
    d3.selectAll(".county-path")
        .transition()
        .duration(300)
        .attr("fill", d => computeCountyFill(d.properties.COUNTYNAME));

    if (state.mapMode === "temp") {
        DOM.legendScale.style.background = "linear-gradient(to right, #38bdf8, #2dd4bf, #facc15, #fb923c, #f43f5e)";
        DOM.legendMin.textContent = "16°C (涼爽)";
        DOM.legendMid.textContent = "26°C (舒適)";
        DOM.legendMax.textContent = "35°C+ (炎熱)";
    } else {
        DOM.legendScale.style.background = "linear-gradient(to right, #1e293b, #1e40af, #2563eb, #0284c7, #22d3ee)";
        DOM.legendMin.textContent = "0% (乾燥)";
        DOM.legendMid.textContent = "50% (短暫雨)";
        DOM.legendMax.textContent = "100% (強降雨)";
    }
}

// 地圖 Hover 事件
function onCountyHover(event, d) {
    const cName = d.properties.COUNTYNAME;
    const city = state.allCities.find(c => c.city_name === cName);
    if (!city) return;

    const p0 = city.periods[0] || {};
    const curTemp = city.current_temp_approx || ((p0.min_temp + p0.max_temp) / 2);

    DOM.mapTooltip.innerHTML = `
        <div class="map-tooltip-header">
            <span class="map-tooltip-title">${city.city_name}</span>
            <span class="map-tooltip-region">${city.region}</span>
        </div>
        <div class="map-tooltip-body">
            <div class="map-tooltip-row">
                <span>狀態：</span>
                <span class="val">${p0.icon || ''} ${p0.weather || '晴'}</span>
            </div>
            <div class="map-tooltip-row">
                <span>氣溫：</span>
                <span class="val">${curTemp}°C (${p0.min_temp}° ~ ${p0.max_temp}°)</span>
            </div>
            <div class="map-tooltip-row">
                <span>降雨機率：</span>
                <span class="val" style="color: #38bdf8;">💧 ${p0.pop || 0}%</span>
            </div>
            <div class="map-tooltip-row">
                <span>舒適度：</span>
                <span class="val">${p0.comfort || '舒適'}</span>
            </div>
        </div>
    `;

    DOM.mapTooltip.style.display = "block";
    DOM.mapTooltip.style.opacity = "1";
    onCountyMove(event);
}

function onCountyMove(event) {
    const wrapper = document.getElementById("map-svg-wrapper");
    const rect = wrapper.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    DOM.mapTooltip.style.left = `${x}px`;
    DOM.mapTooltip.style.top = `${y}px`;
}

function onCountyLeave() {
    DOM.mapTooltip.style.opacity = "0";
    setTimeout(() => {
        if (DOM.mapTooltip.style.opacity === "0") {
            DOM.mapTooltip.style.display = "none";
        }
    }, 150);
}

// 地圖點選事件
function onCountyClick(d) {
    const cName = d.properties.COUNTYNAME;
    const city = state.allCities.find(c => c.city_name === cName);
    if (!city) return;

    selectMapCounty(city);
}

function selectMapCounty(city) {
    state.selectedCity = city;

    d3.selectAll(".county-path").classed("selected", false);
    d3.select(`#map-path-${city.city_name}`).classed("selected", true);

    updateSpotlightCard(city);
}

// 更新右側焦點面板
function updateSpotlightCard(city) {
    const p0 = city.periods[0] || {};
    const curTemp = city.current_temp_approx || ((p0.min_temp + p0.max_temp) / 2);

    DOM.spotlightRegion.textContent = city.region;
    DOM.spotlightCityName.textContent = city.city_name;
    DOM.spotlightIcon.textContent = p0.icon || "⛅";
    DOM.spotlightTemp.textContent = `${curTemp}°C`;
    DOM.spotlightDesc.textContent = p0.weather || "多雲";

    DOM.spotlightRange.textContent = `${p0.min_temp}° ~ ${p0.max_temp}°`;
    DOM.spotlightPop.textContent = `${p0.pop || 0} %`;
    DOM.spotlightComfort.textContent = p0.comfort || "舒適";

    DOM.spotlightPeriods.innerHTML = "";
    city.periods.slice(0, 3).forEach(p => {
        const row = document.createElement("div");
        row.className = "spotlight-period-row";
        row.innerHTML = `
            <span class="spotlight-p-time">${p.period_label}</span>
            <span class="spotlight-p-weather">${p.icon} ${p.weather}</span>
            <span class="spotlight-p-temp">${p.min_temp}°~${p.max_temp}°</span>
            <span class="spotlight-p-pop">💧${p.pop}%</span>
        `;
        DOM.spotlightPeriods.appendChild(row);
    });
}

// =========================================================
// 視圖 3: 全台氣象分析圖表 (Chart.js)
// =========================================================
function renderAllCharts() {
    if (typeof Chart === "undefined" || state.allCities.length === 0) return;
    renderCountyComparisonChart();
    renderRegionalClimateChart();
    renderRainfallRiskChart();
    state.chartsRendered = true;
}

// 圖表 1: 22 縣市綜合氣溫與降雨對比 (橫向長條圖)
function renderCountyComparisonChart() {
    const ctx = document.getElementById("county-comparison-chart");
    if (!ctx) return;

    if (state.chartInstances.countyComparison) {
        state.chartInstances.countyComparison.destroy();
    }

    let cities = [...state.allCities];
    if (state.chartSortBy === "temp-desc") {
        cities.sort((a, b) => (b.periods[0]?.max_temp || 0) - (a.periods[0]?.max_temp || 0));
    } else if (state.chartSortBy === "temp-asc") {
        cities.sort((a, b) => (a.periods[0]?.min_temp || 0) - (b.periods[0]?.min_temp || 0));
    } else if (state.chartSortBy === "pop-desc") {
        cities.sort((a, b) => (b.periods[0]?.pop || 0) - (a.periods[0]?.pop || 0));
    }

    const labels = cities.map(c => c.city_name);
    const minTemps = cities.map(c => c.periods[0]?.min_temp || 0);
    const maxTemps = cities.map(c => c.periods[0]?.max_temp || 0);
    const pops = cities.map(c => c.periods[0]?.pop || 0);

    state.chartInstances.countyComparison = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "最低氣溫 (°C)",
                    data: minTemps,
                    backgroundColor: "rgba(56, 189, 248, 0.75)",
                    borderColor: "#38bdf8",
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.7
                },
                {
                    label: "最高氣溫 (°C)",
                    data: maxTemps,
                    backgroundColor: "rgba(244, 63, 94, 0.75)",
                    borderColor: "#f43f5e",
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.7
                },
                {
                    label: "降雨機率 (%)",
                    data: pops,
                    type: "line",
                    borderColor: "#22d3ee",
                    backgroundColor: "rgba(34, 211, 238, 0.15)",
                    pointBackgroundColor: "#22d3ee",
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                    yAxisID: "y1"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { maxRotation: 45, minRotation: 30 }
                },
                y: {
                    title: { display: true, text: "氣溫 (°C)" },
                    suggestedMin: 15,
                    suggestedMax: 38,
                    grid: { color: "rgba(255, 255, 255, 0.06)" }
                },
                y1: {
                    position: "right",
                    title: { display: true, text: "降雨機率 (%)" },
                    min: 0,
                    max: 100,
                    grid: { drawOnChartArea: false }
                }
            },
            plugins: {
                legend: {
                    position: "top",
                    labels: { boxWidth: 14, padding: 16 }
                }
            }
        }
    });
}

// 圖表 2: 五大地理分區氣候指標對比
function renderRegionalClimateChart() {
    const ctx = document.getElementById("regional-climate-chart");
    if (!ctx) return;

    if (state.chartInstances.regionalClimate) {
        state.chartInstances.regionalClimate.destroy();
    }

    const regions = ["北部", "中部", "南部", "東部", "離島"];
    const avgTemps = [];
    const avgPops = [];

    regions.forEach(r => {
        const regionalCities = state.allCities.filter(c => c.region === r);
        if (regionalCities.length === 0) {
            avgTemps.push(0);
            avgPops.push(0);
            return;
        }
        let totalT = 0;
        let totalP = 0;
        regionalCities.forEach(c => {
            const p = c.periods[0] || {};
            totalT += (p.min_temp + p.max_temp) / 2;
            totalP += (p.pop || 0);
        });
        avgTemps.push(Number((totalT / regionalCities.length).toFixed(1)));
        avgPops.push(Number((totalP / regionalCities.length).toFixed(1)));
    });

    state.chartInstances.regionalClimate = new Chart(ctx, {
        type: "bar",
        data: {
            labels: regions,
            datasets: [
                {
                    label: "平均氣溫 (°C)",
                    data: avgTemps,
                    backgroundColor: "rgba(251, 191, 36, 0.8)",
                    borderColor: "#fbbf24",
                    borderWidth: 1,
                    borderRadius: 6
                },
                {
                    label: "平均降雨率 (%)",
                    data: avgPops,
                    backgroundColor: "rgba(56, 189, 248, 0.8)",
                    borderColor: "#38bdf8",
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false } },
                y: { grid: { color: "rgba(255, 255, 255, 0.06)" } }
            },
            plugins: {
                legend: { position: "top" }
            }
        }
    });
}

// 圖表 3: 全台降雨風險分級環形圖
function renderRainfallRiskChart() {
    const ctx = document.getElementById("rainfall-risk-chart");
    if (!ctx) return;

    if (state.chartInstances.rainfallRisk) {
        state.chartInstances.rainfallRisk.destroy();
    }

    let dry = 0;       // 0 ~ 10%
    let slight = 0;    // 11 ~ 30%
    let shower = 0;    // 31 ~ 60%
    let heavy = 0;     // > 60%

    state.allCities.forEach(c => {
        const pop = c.periods[0]?.pop || 0;
        if (pop <= 10) dry++;
        else if (pop <= 30) slight++;
        else if (pop <= 60) shower++;
        else heavy++;
    });

    state.chartInstances.rainfallRisk = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["晴朗乾燥 (≤10%)", "局部微雨 (11-30%)", "短暫陣雨 (31-60%)", "顯著降雨 (>60%)"],
            datasets: [
                {
                    data: [dry, slight, shower, heavy],
                    backgroundColor: [
                        "rgba(16, 185, 129, 0.85)",
                        "rgba(56, 189, 248, 0.85)",
                        "rgba(251, 191, 36, 0.85)",
                        "rgba(244, 63, 94, 0.85)"
                    ],
                    borderColor: "rgba(10, 14, 23, 0.9)",
                    borderWidth: 3,
                    hoverOffset: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "68%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { boxWidth: 12, padding: 12 }
                }
            }
        }
    });
}

// =========================================================
// 詳細彈窗 (Modal) 與 36 小時趨勢圖
// =========================================================
function openDetailModal(city) {
    const p0 = city.periods[0] || {};
    DOM.modalCityName.textContent = city.city_name;
    DOM.modalRegion.textContent = `${city.region} • ${p0.comfort || '氣候適中'}`;
    DOM.modalWeatherIcon.textContent = p0.icon || "⛅";
    DOM.modalTemp.textContent = `${(p0.min_temp + p0.max_temp) / 2 | 0}°C`;
    DOM.modalDesc.textContent = p0.weather;

    // 繪製彈窗內 36 小時折線趨勢圖
    renderModalForecastChart(city);

    // 時段時間軸
    DOM.modalTimeline.innerHTML = "";
    city.periods.forEach(p => {
        const item = document.createElement("div");
        item.className = "modal-timeline-item";
        item.innerHTML = `
            <div class="timeline-left">
                <span class="timeline-time">${p.period_label} (${p.start_time.substring(5, 16)} ~ ${p.end_time.substring(5, 16)})</span>
                <div class="timeline-desc">
                    <span>${p.icon}</span>
                    <span>${p.weather}</span>
                    <span style="color: #38bdf8; font-size: 0.85rem; margin-left: 8px;">💧 降雨 ${p.pop}%</span>
                </div>
            </div>
            <div class="timeline-right">
                <div class="timeline-temp">${p.min_temp}°C ~ ${p.max_temp}°C</div>
                <div class="timeline-comfort">${p.comfort || '舒適'}</div>
            </div>
        `;
        DOM.modalTimeline.appendChild(item);
    });

    // 穿著與出行建議
    let advice = "氣溫適宜，外出舒適。";
    if (city.highest_pop >= 50) {
        advice = "⚠️ 今日降雨機率高達 " + city.highest_pop + "%，外出請務必攜帶雨具並注意路面濕滑！";
    } else if (p0.max_temp >= 32) {
        advice = "🔥 氣溫偏高炎熱，外出請注意防曬、多補充水分以防中暑。";
    } else if (p0.min_temp <= 18) {
        advice = "🧥 早晚溫差偏大，早出晚歸建議攜帶保暖外套。";
    }
    DOM.modalTipsText.textContent = advice;

    DOM.detailModal.style.display = "flex";
}

// 彈窗內的 36 小時氣溫與降雨折線圖
function renderModalForecastChart(city) {
    const ctx = document.getElementById("modal-forecast-chart");
    if (!ctx || typeof Chart === "undefined") return;

    if (state.chartInstances.modalForecast) {
        state.chartInstances.modalForecast.destroy();
    }

    const labels = city.periods.map(p => p.period_label || "時段");
    const maxTemps = city.periods.map(p => p.max_temp);
    const minTemps = city.periods.map(p => p.min_temp);
    const pops = city.periods.map(p => p.pop);

    state.chartInstances.modalForecast = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "最高氣溫 (°C)",
                    data: maxTemps,
                    borderColor: "#f43f5e",
                    backgroundColor: "rgba(244, 63, 94, 0.12)",
                    fill: "+1",
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: "#f43f5e"
                },
                {
                    label: "最低氣溫 (°C)",
                    data: minTemps,
                    borderColor: "#38bdf8",
                    backgroundColor: "rgba(56, 189, 248, 0.08)",
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: "#38bdf8"
                },
                {
                    label: "降雨機率 (%)",
                    data: pops,
                    type: "bar",
                    backgroundColor: "rgba(34, 211, 238, 0.35)",
                    borderColor: "rgba(34, 211, 238, 0.8)",
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: "y1",
                    barPercentage: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false } },
                y: {
                    title: { display: true, text: "氣溫 (°C)" },
                    grid: { color: "rgba(255, 255, 255, 0.06)" }
                },
                y1: {
                    position: "right",
                    min: 0,
                    max: 100,
                    title: { display: true, text: "降雨 (%)" },
                    grid: { drawOnChartArea: false }
                }
            },
            plugins: {
                legend: { position: "top", labels: { boxWidth: 12 } }
            }
        }
    });
}

function closeModal() {
    DOM.detailModal.style.display = "none";
}
