'use strict';
import { state } from '../core/state.js';
import { renderPopup } from './common.js';
import { showSettlementButtons, hideSettlementButtons } from '../buttons/resButtons.js';
import { hideCalculateAllButton, hideCalculateSelectedButton } from '../buttons/calculateButtons.js';
import { destroyAnalyticsDashboard } from './analyticsView.js';
import { setSelectedSettlement, showSelectedSettlementBlock } from './selectedSettlement.js';
import { openSettlementInfoModal } from './modals/settlementInfoModal.js';

/* ================= КОНТЕЙНЕР ================= */
export function destroyChart() {
    if (state.ratingChart) { state.ratingChart.destroy(); state.ratingChart = null; }
    state.isChartMode = false;
    state.zoomStartIndex = 0; state.zoomEndIndex = 0; state.currentDisplayDataLength = 0;
    state.chartDisplayData = [];
    const tt = document.getElementById('chart-item-tooltip'); if (tt) tt.remove();
}

export function hideChartContainer() {
    const c = document.getElementById('chart-container');
    if (c) c.style.display = 'none';
    const inner = c ? c.querySelector('.chart-inner') : null;
    if (inner) { inner.scrollTop = 0; inner.scrollLeft = 0; }
    destroyChart();
    state.chartAllData = []; state.chartCurrentData = []; state.chartDisplayData = [];
}

export function showChartContainer() {
    const c = document.getElementById('chart-container');
    const table = document.getElementById('settlements-table');
    const pag = document.getElementById('settlements-pagination');
    const div = document.getElementById('table-divider');
    const ph = document.getElementById('placeholder-message');
    if (c) {
        let header = c.querySelector('.chart-header');
        if (!header) { header = document.createElement('div'); header.className = 'chart-header'; c.appendChild(header); }
        let inner = c.querySelector('.chart-inner');
        if (!inner) {
            inner = document.createElement('div'); inner.className = 'chart-inner'; c.appendChild(inner);
            const content = document.createElement('div'); content.className = 'chart-content'; inner.appendChild(content);
            const canvas = document.getElementById('rating-chart');
            if (canvas && canvas.parentNode !== content) content.appendChild(canvas);
        }
        c.style.display = 'flex'; c.style.flexDirection = 'column';
        inner.style.display = 'flex';
    }
    if (table) table.style.display = 'none';
    if (pag) { pag.style.display = 'none'; pag.innerHTML = ''; }
    if (div) div.style.display = 'none';
    if (ph) ph.style.display = 'none';
    hideSettlementButtons(); hideCalculateAllButton(); hideCalculateSelectedButton();
    document.querySelector('.filter-container')?.remove();
    document.querySelector('.settlements-title')?.remove();
}

/* ================= ДАННЫЕ ГРАФИКА ================= */
export function getChartDisplayData() {
    if (state.chartDisplayData?.length) return state.chartDisplayData;
    if (state.chartAllData?.length) return state.chartAllData;
    return state.chartCurrentData?.length ? state.chartCurrentData : [];
}

/* ================= ПЕРЕКЛЮЧЕНИЕ РЕЖИМА ================= */
export function switchToChartMode() {
    destroyAnalyticsDashboard();
    state.chartType = 'provided';
    state.isChartMode = true;
    const chartData = state.settlementsData.items.map(it => {
        const r = state.allRatings[String(it.id)] || {};
        return { id: it.id, name: it.name, region_name: it.region_name, district_name: it.district_name,
            population: it.population, rating: r.rating || 0 };
    });
    chartData.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    showChartContainer();
    createRatingChart(chartData, 'provided');
    hideSettlementButtons(); hideCalculateAllButton(); hideCalculateSelectedButton();
    document.querySelector('.filter-container')?.remove();
    document.querySelector('.settlements-title')?.remove();
    const pag = document.getElementById('settlements-pagination');
    if (pag) { pag.style.display = 'none'; pag.innerHTML = ''; }
    const hlBtn = document.getElementById('ss-btn-highlight');
    if (hlBtn && state.selectedSettlementId) { hlBtn.disabled = false; hlBtn.title = 'Отобразить на графике'; }
    renderFormatControls();
    if (state.selectedSettlementId) {
        state.selectedSettlementHighlighted = true;
        setTimeout(() => restoreSelectionById(), 150);
    }
}

/* ================= ПОИСК ================= */
function renderSearchResults(results, query, container) {
    if (!container) container = document.getElementById('chart-search-results');
    if (!container) return;
    container.innerHTML = '';
    if (!results?.length) {
        const e = document.createElement('div'); e.textContent = 'Ничего не найдено'; e.className = 'search-result-empty';
        container.appendChild(e); container.style.display = 'block'; return;
    }
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    results.forEach((it, i) => {
        const ri = document.createElement('div'); ri.className = 'search-result-item'; ri.dataset.index = i;
        const name = it.name || `ID: ${it.id}`;
        const ql = query.toLowerCase(), nl = name.toLowerCase();
        const idx = nl.indexOf(ql);
        let nameHtml = esc(name);
        if (idx !== -1) {
            const b = name.substring(0, idx), m = name.substring(idx, idx + query.length), a = name.substring(idx + query.length);
            nameHtml = `${esc(b)}<strong>${esc(m)}</strong>${esc(a)}`;
        }
        const ns = document.createElement('span'); ns.className = 'search-result-item__name'; ns.innerHTML = nameHtml;
        const is = document.createElement('span');
        const r = it.rating;
        const rt = (r !== undefined && r !== null && !isNaN(r)) ? r.toFixed(1) : 'не получен';
        is.textContent = `Обеспеченность: ${rt} | ${it.region_name || '—'}`;
        is.className = 'search-result-item__info';
        ri.append(ns, is);
        ri.addEventListener('click', () => selectSearchResult(results[i], i));
        container.appendChild(ri);
    });
    const c = document.createElement('div'); c.textContent = `Найдено: ${results.length}`; c.className = 'search-result-counter';
    container.appendChild(c); container.style.display = 'block';
}

function selectSearchResult(item, index) {
    if (!state.ratingChart) return;
    setSelectedSettlement(item, 'chart');
    const dd = getChartDisplayData(); if (!dd?.length) return;
    let ci = -1;
    for (let i = 0; i < dd.length; i++) {
        if (item.id != null && dd[i].id != null && String(dd[i].id) === String(item.id)) { ci = i; break; }
        else if (dd[i].name && item.name && dd[i].name === item.name) { ci = i; break; }
    }
    if (ci === -1) ci = index;
    const isSel = i => (item.id != null && dd[i].id != null) ? String(dd[i].id) === String(item.id) : (dd[i].name && item.name && dd[i].name === item.name);
    const ds0 = state.ratingChart.data.datasets[0];
    ds0.backgroundColor = dd.map((d, i) => isSel(i) ? '#ff0000' : '#4AC15D');
    ds0.borderColor = ds0.backgroundColor;
    ds0.borderWidth = dd.map((d, i) => isSel(i) ? 3 : 0);
    if (state.ratingChart.data.datasets[1]) {
        const ds1 = state.ratingChart.data.datasets[1];
        ds1.backgroundColor = dd.map((d, i) => isSel(i) ? '#cc0000' : '#ED933B');
        ds1.borderColor = ds1.backgroundColor;
        ds1.borderWidth = dd.map((d, i) => isSel(i) ? 3 : 0);
    }
    state.ratingChart.update();
    state.selectedSearchItem = item; state.selectedSearchIndex = ci;
    state.selectedSettlementHighlighted = true;
    const c = document.getElementById('chart-search-results'); if (c) c.style.display = 'none';
    requestAnimationFrame(() => {
        const d2 = getChartDisplayData();
        let idx = -1;
        for (let i = 0; i < d2.length; i++) if (item.id != null && String(d2[i].id) === String(item.id)) { idx = i; break; }
        if (idx === -1) idx = ci;
        if (idx !== -1 && d2[idx]) { state.selectedSearchIndex = idx; showItemTooltip(d2[idx], idx); }
    });
    const si = document.getElementById('chart-search-input'); if (si) si.value = item.name || `ID: ${item.id}`;
}

/* ================= ТУЛТИП ================= */
function showItemTooltip(item, chartIndex) {
    const old = document.getElementById('chart-item-tooltip'); if (old) old.remove();
    if (!item) return;
    const dd = getChartDisplayData();
    let idx = chartIndex;
    if (!Array.isArray(dd) || !dd.length) return;
    if (idx < 0 || idx >= dd.length) {
        idx = dd.findIndex(d => (item.id != null && d.id != null) ? String(d.id) === String(item.id) : (d.name && item.name && d.name === item.name));
    }
    if (idx === -1) idx = 0;
    const tt = document.createElement('div'); tt.id = 'chart-item-tooltip'; tt.className = 'chart-tooltip';
    const r = Number(item.rating) || 0;
    const has = item.rating != null && !isNaN(item.rating);
    const rt = has ? `${Math.round(r)}%` : 'не получен';
    const dt = has ? `${Math.round(100 - r)}%` : 'не получен';
    const pop = item.population || 0;
    const reg = item.region_name || 'Н/Д';
    const dist = item.district_name || 'Н/Д';
    const name = item.name || `ID: ${item.id}`;
    let place = '—', total = state.ratingPlacesTotal;
    if (state.ratingPlacesMap?.size) {
        const f = state.ratingPlacesMap.get(String(item.id));
        if (f !== undefined) place = f;
    } else if (state.chartAllData.length) {
        const ordered = [...state.chartAllData].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        total = ordered.length;
        const pos = ordered.findIndex(d => (d.id != null && item.id != null && d.id === item.id) || (d.name && item.name && d.name === item.name));
        if (pos !== -1) place = pos + 1;
    }
    const t = document.createElement('div'); t.className = 'chart-tooltip__title'; t.textContent = name; tt.appendChild(t);
    const b = document.createElement('div'); b.className = 'chart-tooltip__body';
    const addRow = (color, text) => {
        const row = document.createElement('div');
        if (color) { const s = document.createElement('span'); s.className = 'chart-tooltip__swatch'; s.style.backgroundColor = color; row.appendChild(s); }
        row.appendChild(document.createTextNode(text)); b.appendChild(row);
    };
    addRow('#4AC15D', `Обеспеченность: ${rt}`);
    addRow('#ED933B', `Дефицит: ${dt}`);
    addRow(null, `Место в обеспеченности: ${place} из ${total}`);
    addRow(null, `Население: ${pop.toLocaleString()} чел.`);
    addRow(null, reg); addRow(null, dist); addRow(null, `ID: ${item.id}`);
    tt.appendChild(b); document.body.appendChild(tt);
    tt.style.left = '-9999px'; tt.style.top = '-9999px';
    tt.style.maxWidth = Math.min(400, window.innerWidth - 40) + 'px';
    let attempts = 0;
    const tryPos = () => {
        if (!state.ratingChart || !state.ratingChart.chartArea) {
            if (attempts < 20) { attempts++; requestAnimationFrame(tryPos); } return;
        }
        positionTooltipOverBar(tt, idx);
    };
    requestAnimationFrame(tryPos);
}

function positionTooltipOverBar(tooltip, chartIndex) {
    if (!state.ratingChart) { positionTooltipInChartArea(tooltip, null); return; }
    try {
        const dd = getChartDisplayData();
        if (!dd?.length) { positionTooltipInChartArea(tooltip, null); return; }
        let idx = -1;
        if (state.selectedSettlementId != null) {
            for (let i = 0; i < dd.length; i++) if (String(dd[i].id) === String(state.selectedSettlementId)) { idx = i; break; }
        }
        if (idx === -1 && typeof chartIndex === 'number' && chartIndex >= 0 && chartIndex < dd.length) idx = chartIndex;
        if (idx === -1) { positionTooltipInChartArea(tooltip, null); return; }
        const meta = state.ratingChart.getDatasetMeta(0);
        if (!meta?.data?.[idx]) { positionTooltipInChartArea(tooltip, null); return; }
        const bar = meta.data[idx];
        const canvas = state.ratingChart.canvas;
        const rect = canvas.getBoundingClientRect();
        const ca = state.ratingChart.chartArea;
        const sx = rect.width / state.ratingChart.width;
        const sy = rect.height / state.ratingChart.height;
        const px = rect.left + bar.x * sx;
        const py = rect.top + bar.y * sy;
        const cL = rect.left + ca.left * sx, cR = rect.left + ca.right * sx;
        const cT = rect.top + ca.top * sy, cB = rect.top + ca.bottom * sy;
        const tw = Math.min(parseInt(tooltip.style.maxWidth) || 400, window.innerWidth - 40);
        const th = 220;
        let left = px - tw / 2, top = py - 15;
        if (left < cL + 10) left = cL + 10;
        if (left + tw > cR - 10) left = cR - tw - 10;
        if (top - th > cT + 10) { top -= 10; tooltip.style.transform = 'translateY(-100%)'; }
        else { top = py + 30; tooltip.style.transform = 'translateY(0)'; }
        if (top < cT + 10) { top = cT + 10; tooltip.style.transform = 'translateY(0)'; }
        if (top + th > cB - 10) { top = cB - th - 10; tooltip.style.transform = 'translateY(-100%)'; }
        tooltip.style.left = left + 'px'; tooltip.style.top = top + 'px';
    } catch (e) { positionTooltipInChartArea(tooltip, null); }
}

function positionTooltipInChartArea(tooltip, chartArea) {
    if (!state.ratingChart) { tooltip.style.left = '50%'; tooltip.style.top = '20px'; tooltip.style.transform = 'translateX(-50%)'; return; }
    try {
        const canvas = state.ratingChart.canvas;
        const rect = canvas.getBoundingClientRect();
        const area = chartArea || state.ratingChart.chartArea;
        if (area) {
            const sx = rect.width / state.ratingChart.width;
            const sy = rect.height / state.ratingChart.height;
            const cL = rect.left + area.left * sx, cR = rect.left + area.right * sx;
            const cT = rect.top + area.top * sy, cB = rect.top + area.bottom * sy;
            const tw = Math.min(parseInt(tooltip.style.maxWidth) || 400, window.innerWidth - 40);
            const th = 220;
            let left = (cL + cR) / 2 - tw / 2, top = cT + 20;
            if (left < cL + 10) left = cL + 10;
            if (left + tw > cR - 10) left = cR - tw - 10;
            if (top + th > cB - 10) top = cB - th - 10;
            if (top < cT + 10) top = cT + 10;
            tooltip.style.left = left + 'px'; tooltip.style.top = top + 'px'; tooltip.style.transform = 'translateY(0)';
        } else { tooltip.style.left = '50%'; tooltip.style.top = '20px'; tooltip.style.transform = 'translateX(-50%)'; }
    } catch (e) { tooltip.style.left = '50%'; tooltip.style.top = '20px'; tooltip.style.transform = 'translateX(-50%)'; }
}

function updateTooltipPosition() {
    const tt = document.getElementById('chart-item-tooltip'); if (!tt) return;
    if (state.selectedSettlementId != null) positionTooltipOverBar(tt, state.selectedSearchIndex);
}
window.removeEventListener('resize', updateTooltipPosition);
window.removeEventListener('scroll', updateTooltipPosition);
window.addEventListener('resize', updateTooltipPosition);
window.addEventListener('scroll', updateTooltipPosition);
if (window.ResizeObserver) {
    const cc = document.getElementById('chart-container');
    if (cc) new ResizeObserver(updateTooltipPosition).observe(cc);
}

/* ================= ПОДСВЕТКА / СБРОС ================= */
export function clearChartSelection() {
    if (!state.ratingChart) return;
    state.selectedSearchItem = null; state.selectedSearchIndex = -1;
    const dd = getChartDisplayData(); if (!dd?.length) return;
    state.ratingChart.data.datasets[0].backgroundColor = '#4AC15D';
    state.ratingChart.data.datasets[0].borderColor = '#4AC15D';
    state.ratingChart.data.datasets[0].borderWidth = 0;
    if (state.ratingChart.data.datasets[1]) {
        state.ratingChart.data.datasets[1].backgroundColor = '#ED933B';
        state.ratingChart.data.datasets[1].borderColor = '#ED933B';
        state.ratingChart.data.datasets[1].borderWidth = 0;
    }
    state.ratingChart.update();
    const tt = document.getElementById('chart-item-tooltip'); if (tt) tt.remove();
}

export function highlightSelectedOnChart() {
    if (!state.selectedSettlementId) return;
    if (!state.isChartMode || !state.ratingChart) return;
    const dd = getChartDisplayData(); if (!dd?.length) return;
    let fi = -1, found = null;
    for (let i = 0; i < dd.length; i++) if (String(dd[i].id) === String(state.selectedSettlementId)) { fi = i; found = dd[i]; break; }
    if (fi === -1) { renderPopup('НП не найден среди отображаемых на графике'); return; }
    const totalLen = state.currentDisplayDataLength || dd.length;
    const curMin = state.ratingChart.options.scales.x.min || 0;
    const curMax = state.ratingChart.options.scales.x.max || totalLen;
    const vis = curMax - curMin;
    if (fi < curMin || fi >= curMin + vis) {
        const nMin = Math.max(0, fi - Math.floor(vis / 2));
        const nMax = Math.min(totalLen, nMin + vis);
        state.ratingChart.options.scales.x.min = nMin;
        state.ratingChart.options.scales.x.max = nMax;
    }
    state.selectedSearchItem = found; state.selectedSearchIndex = fi;
    state.selectedSettlementHighlighted = true;
    const isSel = d => String(d.id) === String(state.selectedSettlementId);
    const ds0 = state.ratingChart.data.datasets[0];
    ds0.backgroundColor = dd.map(d => isSel(d) ? '#ff0000' : '#4AC15D');
    ds0.borderColor = ds0.backgroundColor;
    ds0.borderWidth = dd.map(d => isSel(d) ? 3 : 0);
    if (state.ratingChart.data.datasets[1]) {
        const ds1 = state.ratingChart.data.datasets[1];
        ds1.backgroundColor = dd.map(d => isSel(d) ? '#cc0000' : '#ED933B');
        ds1.borderColor = ds1.backgroundColor;
        ds1.borderWidth = dd.map(d => isSel(d) ? 3 : 0);
    }
    state.ratingChart.update();
    requestAnimationFrame(() => {
        const d2 = getChartDisplayData();
        let idx = -1;
        for (let i = 0; i < d2.length; i++) if (String(d2[i].id) === String(state.selectedSettlementId)) { idx = i; break; }
        if (idx !== -1) { state.selectedSearchIndex = idx; showItemTooltip(d2[idx], idx); }
    });
}

export function restoreSelectionById(attempt = 0) {
    if (!state.ratingChart || !state.selectedSettlementId) return;
    const dd = getChartDisplayData(); if (!dd?.length) return;
    const ca = state.ratingChart.chartArea;
    const meta = state.ratingChart.getDatasetMeta(0);
    const metaReady = meta?.data?.length === dd.length;
    if ((!ca || !metaReady) && attempt < 20) { requestAnimationFrame(() => restoreSelectionById(attempt + 1)); return; }
    let fi = -1;
    for (let i = 0; i < dd.length; i++) if (String(dd[i].id) === String(state.selectedSettlementId)) { fi = i; break; }
    if (fi !== -1) { state.selectedSearchItem = dd[fi]; state.selectedSearchIndex = fi; state.selectedSettlementHighlighted = true; }
    else { state.selectedSearchItem = null; state.selectedSearchIndex = -1; state.selectedSettlementHighlighted = false; }
    const isSel = i => state.selectedSettlementHighlighted && dd[i] && String(dd[i].id) === String(state.selectedSettlementId);
    const ds0 = state.ratingChart.data.datasets[0];
    ds0.backgroundColor = dd.map((d, i) => isSel(i) ? '#ff0000' : '#4AC15D');
    ds0.borderColor = ds0.backgroundColor;
    ds0.borderWidth = dd.map((d, i) => isSel(i) ? 3 : 0);
    if (state.ratingChart.data.datasets[1]) {
        const ds1 = state.ratingChart.data.datasets[1];
        ds1.backgroundColor = dd.map((d, i) => isSel(i) ? '#cc0000' : '#ED933B');
        ds1.borderColor = ds1.backgroundColor;
        ds1.borderWidth = dd.map((d, i) => isSel(i) ? 3 : 0);
    }
    state.ratingChart.update('none');
    if (fi !== -1) {
        requestAnimationFrame(() => {
            const d2 = getChartDisplayData();
            let idx = -1;
            for (let i = 0; i < d2.length; i++) if (String(d2[i].id) === String(state.selectedSettlementId)) { idx = i; break; }
            if (idx !== -1 && d2[idx]) { state.selectedSearchIndex = idx; showItemTooltip(d2[idx], idx); }
        });
    }
}

function restoreSelectionAfterUpdate() {
    if (!state.selectedSearchItem || !state.ratingChart) return;
    const dd = getChartDisplayData(); if (!dd?.length) return;
    let fi = -1;
    for (let i = 0; i < dd.length; i++) {
        const d = dd[i];
        if (state.selectedSearchItem.id != null && d.id != null && String(d.id) === String(state.selectedSearchItem.id)) { fi = i; break; }
        else if (d.name && state.selectedSearchItem.name && d.name === state.selectedSearchItem.name) { fi = i; break; }
    }
    if (fi === -1) return;
    const isSel = i => {
        const d = dd[i];
        if (state.selectedSearchItem.id != null && d.id != null) return String(d.id) === String(state.selectedSearchItem.id);
        return d.name && state.selectedSearchItem.name && d.name === state.selectedSearchItem.name;
    };
    const ds0 = state.ratingChart.data.datasets[0];
    ds0.backgroundColor = dd.map((d, i) => isSel(i) ? '#ff0000' : '#4AC15D');
    ds0.borderColor = ds0.backgroundColor;
    ds0.borderWidth = dd.map((d, i) => isSel(i) ? 3 : 0);
    if (state.ratingChart.data.datasets[1]) {
        const ds1 = state.ratingChart.data.datasets[1];
        ds1.backgroundColor = dd.map((d, i) => isSel(i) ? '#cc0000' : '#ED933B');
        ds1.borderColor = ds1.backgroundColor;
        ds1.borderWidth = dd.map((d, i) => isSel(i) ? 3 : 0);
    }
    state.ratingChart.update();
    requestAnimationFrame(() => {
        const d2 = getChartDisplayData();
        let idx = -1;
        for (let i = 0; i < d2.length; i++) if (state.selectedSearchItem.id != null && String(d2[i].id) === String(state.selectedSearchItem.id)) { idx = i; break; }
        if (idx === -1) idx = fi;
        if (idx !== -1 && d2[idx]) { state.selectedSearchIndex = idx; showItemTooltip(d2[idx], idx); }
    });
}

/* ================= ЗУМ ================= */
function updateZoomInfo() {
    const info = document.getElementById('zoom-info'); if (!info) return;
    if (!state.ratingChart) { info.textContent = ' Нет данных'; return; }
    const dl = state.currentDisplayDataLength || state.ratingChart.data.labels.length || 0;
    if (!dl) { info.textContent = ' Нет данных'; return; }
    let aMin = state.ratingChart.options.scales.x.min, aMax = state.ratingChart.options.scales.x.max;
    if (aMin === undefined || aMax === undefined) { aMin = state.zoomStartIndex; aMax = state.zoomEndIndex; }
    const s = Math.max(0, Math.min(Math.round(aMin), dl - 1));
    const e = Math.max(1, Math.min(Math.round(aMax), dl));
    const vis = e - s;
    state.zoomStartIndex = s; state.zoomEndIndex = e;
    info.textContent = vis >= dl ? ` Видно: все ${dl} записей (100%)` : ` Видно: ${vis} из ${dl} (${Math.round(vis / dl * 100)}%)`;
}

function applyZoom() {
    if (!state.ratingChart) return;
    const dl = state.currentDisplayDataLength || state.ratingChart.data.labels.length || 0;
    if (!dl) return;
    let s = Math.max(0, Math.round(state.zoomStartIndex));
    let e = Math.min(dl, Math.round(state.zoomEndIndex));
    if (e - s < 2) {
        if (s >= dl - 1) { s = Math.max(0, dl - 2); e = dl; } else e = Math.min(dl, s + 2);
    }
    if (s >= e) s = Math.max(0, e - 2);
    if (s >= dl) { s = Math.max(0, dl - 2); e = dl; }
    state.zoomStartIndex = s; state.zoomEndIndex = e;
    state.ratingChart.options.scales.x.min = s;
    state.ratingChart.options.scales.x.max = e;
    state.ratingChart.update();
    updateZoomInfo();
    requestAnimationFrame(updateTooltipPosition);
}

function zoomIn() {
    if (!state.ratingChart) return;
    const dl = state.currentDisplayDataLength || state.ratingChart.data.labels.length || 0; if (!dl) return;
    let cMin = state.ratingChart.options.scales.x.min, cMax = state.ratingChart.options.scales.x.max;
    if (cMin === undefined || cMax === undefined) { cMin = state.zoomStartIndex; cMax = state.zoomEndIndex; }
    const vis = Math.round(cMax - cMin);
    const nv = Math.max(2, Math.floor(vis * 0.7));
    state.zoomStartIndex = Math.round(cMin);
    state.zoomEndIndex = Math.min(dl, state.zoomStartIndex + nv);
    applyZoom();
}

function zoomOut() {
    if (!state.ratingChart) return;
    const dl = state.currentDisplayDataLength || state.ratingChart.data.labels.length || 0; if (!dl) return;
    let cMin = state.ratingChart.options.scales.x.min, cMax = state.ratingChart.options.scales.x.max;
    if (cMin === undefined || cMax === undefined) { cMin = state.zoomStartIndex; cMax = state.zoomEndIndex; }
    const vis = Math.round(cMax - cMin);
    const nv = Math.min(dl, Math.floor(vis * 1.5));
    state.zoomStartIndex = Math.round(cMin);
    state.zoomEndIndex = Math.min(dl, state.zoomStartIndex + nv);
    applyZoom();
}

function resetZoom() {
    if (!state.ratingChart) return;
    const dl = state.currentDisplayDataLength || state.ratingChart.data.labels.length || 0;
    state.zoomStartIndex = 0; state.zoomEndIndex = dl;
    applyZoom();
}

export function rebuildChartPreservingZoom() {
    if (!state.ratingChart) return;
    const sMin = state.ratingChart.options.scales.x.min;
    const sMax = state.ratingChart.options.scales.x.max;
    const saved = state.selectedSearchItem;
    const q = state.chartSearchQuery.trim().toLowerCase();
    const ss = document.getElementById('chart-sort-select');
    const sf = ss ? ss.value : 'rating';
    let sd = [...state.chartAllData];
    if (sf === 'rating') sd.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sf === 'rating_asc') sd.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    let dd = sd;
    if (q) dd = sd.filter(it => (it.name || '').toLowerCase().includes(q) || (it.region_name || '').toLowerCase().includes(q) || (it.district_name || '').toLowerCase().includes(q));
    state.currentDisplayDataLength = dd.length;
    state.chartDisplayData = dd;
    state.ratingChart.data.labels = dd.map(it => it.name || `ID: ${it.id}`);
    state.ratingChart.data.datasets[0].data = dd.map(it => Math.max(0, Math.min(100, it.rating || 0)));
    state.ratingChart.data.datasets[0].backgroundColor = '#4AC15D';
    state.ratingChart.data.datasets[0].borderColor = '#4AC15D';
    state.ratingChart.data.datasets[1].data = dd.map(it => 100 - Math.max(0, Math.min(100, it.rating || 0)));
    state.ratingChart.data.datasets[1].backgroundColor = '#ED933B';
    state.ratingChart.data.datasets[1].borderColor = '#ED933B';
    if (sMin !== undefined && sMax !== undefined) {
        state.ratingChart.options.scales.x.min = sMin;
        state.ratingChart.options.scales.x.max = sMax;
    } else {
        state.ratingChart.options.scales.x.min = 0;
        state.ratingChart.options.scales.x.max = state.currentDisplayDataLength;
    }
    state.ratingChart.update();
    const ce = document.querySelector('.chart-count'); if (ce) ce.textContent = `Всего НП: ${sd.length}`;
    if (saved) { state.selectedSearchItem = saved; setTimeout(() => restoreSelectionAfterUpdate(), 100); }
}

/* ================= РАЗМЕР ================= */
export function resizeRatingChart() {
    if (!state.ratingChart) return;
    const c = document.getElementById('chart-container');
    const h = c?.querySelector('.chart-header');
    const inner = c?.querySelector('.chart-inner');
    const content = c?.querySelector('.chart-content');
    const canvas = document.getElementById('rating-chart');
    if (!c || !inner || !content || !canvas) return;
    const MIN_W = 1500, MIN_H = 430;
    const cr = c.getBoundingClientRect();
    const hh = h ? h.getBoundingClientRect().height : 0;
    const ah = Math.max(cr.height - hh - 16, MIN_H);
    const aw = Math.max(cr.width, MIN_W);
    inner.style.width = '100%';
    inner.style.height = (cr.height - hh) + 'px';
    content.style.width = aw + 'px'; content.style.height = ah + 'px';
    canvas.style.width = aw + 'px'; canvas.style.height = ah + 'px';
    state.ratingChart.resize();
    state.ratingChart.update('none');
    requestAnimationFrame(updateTooltipPosition);
}

/* ================= КОНТРОЛЫ ================= */
export function renderFormatControls() {
    const c = document.querySelector('.table_buttons'); if (!c) return;
    const old = document.getElementById('format-controls-group'); if (old) old.remove();
    if (!state.isChartMode) return;
    const g = document.createElement('div');
    g.id = 'format-controls-group';
    g.style.cssText = 'display:none;align-items:center;gap:12px;margin-right:auto;padding-left:4px';
    const lbl = document.createElement('label');
    lbl.textContent = 'Формат графика';
    lbl.style.cssText = 'font-weight:600;font-size:14px';
    g.appendChild(lbl);
    const mk = (val, text) => {
        const l = document.createElement('label');
        l.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:14px;cursor:pointer;font-weight:600';
        const r = document.createElement('input');
        r.type = 'radio'; r.name = 'chart-format-bottom'; r.value = val;
        r.checked = state.currentChartFormat === val;
        r.addEventListener('change', function () {
            if (!this.checked) return;
            state.currentChartFormat = val;
            const sMin = state.ratingChart?.options.scales.x.min;
            const sMax = state.ratingChart?.options.scales.x.max;
            createRatingChart(state.chartAllData.length ? state.chartAllData : [], state.chartType);
            if (state.ratingChart && sMin !== undefined && sMax !== undefined) {
                state.ratingChart.options.scales.x.min = sMin;
                state.ratingChart.options.scales.x.max = sMax;
                state.ratingChart.update('none');
            }
            if (state.selectedSearchItem) setTimeout(restoreSelectionAfterUpdate, 100);
        });
        l.append(r, document.createTextNode(text));
        return l;
    };
    g.append(mk('full', 'Полный'), mk('short', 'Краткий'));
    c.insertBefore(g, c.firstChild);
}

export function renderChartControls(currentSortField) {
    const cc = document.getElementById('chart-container'); if (!cc) return;
    const old = document.getElementById('chart-controls'); if (old) old.remove();
    const ctrl = document.createElement('div'); ctrl.id = 'chart-controls'; ctrl.className = 'chart-controls';
    const sl = document.createElement('label'); sl.textContent = 'Сортировка:'; sl.className = 'chart-controls__label'; ctrl.appendChild(sl);
    const ss = document.createElement('select'); ss.id = 'chart-sort-select'; ss.className = 'chart-controls__select';
    [{ v: 'rating', t: 'По убыванию обесп. ТИ' }, { v: 'rating_asc', t: 'По возрастанию обесп.ТИ' }].forEach(o => {
        const op = document.createElement('option'); op.value = o.v; op.textContent = o.t;
        if (o.v === currentSortField) op.selected = true;
        ss.appendChild(op);
    });
    ss.addEventListener('change', () => {
        state.chartSearchQuery = ''; state.searchResults = [];
        state.selectedSearchItem = null; state.selectedSearchIndex = -1;
        state.zoomStartIndex = 0; state.zoomEndIndex = 0;
        const si = document.getElementById('chart-search-input'); if (si) si.value = '';
        const rc = document.getElementById('chart-search-results'); if (rc) { rc.style.display = 'none'; rc.innerHTML = ''; }
        const tt = document.getElementById('chart-item-tooltip'); if (tt) tt.remove();
        createRatingChart(state.chartAllData.length ? state.chartAllData : [], state.chartType);
    });
    ctrl.appendChild(ss);
    const d1 = document.createElement('span'); d1.textContent = '|'; d1.className = 'chart-controls__divider'; ctrl.appendChild(d1);
    const scl = document.createElement('label'); scl.textContent = 'Поиск:'; scl.className = 'chart-controls__label'; ctrl.appendChild(scl);
    const sc = document.createElement('div'); sc.id = 'chart-search-container'; sc.className = 'chart-search';
    const si = document.createElement('input'); si.id = 'chart-search-input'; si.type = 'text';
    si.placeholder = 'Введите название НП...'; si.value = state.chartSearchQuery; si.className = 'chart-search__input';
    const src = document.createElement('div'); src.id = 'chart-search-results'; src.className = 'chart-search__results';
    sc.appendChild(src);
    si.addEventListener('input', function () {
        const q = this.value.trim(); state.chartSearchQuery = q;
        if (!src) return;
        if (!q.length) { src.style.display = 'none'; src.innerHTML = ''; state.searchResults = []; return; }
        const data = state.chartAllData.length ? state.chartAllData : [];
        const ql = q.toLowerCase();
        const res = data.filter(it => (it.name || '').toLowerCase().includes(ql));
        state.searchResults = res;
        renderSearchResults(res, q, src);
    });
    si.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); if (state.searchResults.length) selectSearchResult(state.searchResults[0], 0); }
        if (e.key === 'Escape') { src.style.display = 'none'; this.blur(); }
    });
    si.addEventListener('blur', () => setTimeout(() => { src.style.display = 'none'; }, 300));
    si.addEventListener('focus', function () { if (this.value.trim().length && state.searchResults.length) src.style.display = 'block'; });
    sc.appendChild(si);
    const clr = document.createElement('button'); clr.textContent = '✕'; clr.title = 'Очистить поиск и снять выделение'; clr.className = 'chart-search__clear';
    clr.addEventListener('click', () => {
        state.chartSearchQuery = ''; si.value = ''; state.searchResults = [];
        src.style.display = 'none'; src.innerHTML = '';
        clearChartSelection();
        state.selectedSearchItem = null; state.selectedSearchIndex = -1;
        rebuildChartPreservingZoom();
    });
    sc.appendChild(clr);
    ctrl.appendChild(sc);
    const d2 = document.createElement('span'); d2.textContent = '|'; d2.className = 'chart-controls__divider'; ctrl.appendChild(d2);
    const zl = document.createElement('label'); zl.textContent = 'Масштаб:'; zl.className = 'chart-controls__label'; ctrl.appendChild(zl);
    const zi = document.createElement('button'); zi.textContent = '+'; zi.title = 'Увеличить масштаб'; zi.className = 'chart-zoom__btn chart-zoom__btn--in'; zi.addEventListener('click', zoomIn); ctrl.appendChild(zi);
    const zo = document.createElement('button'); zo.textContent = '−'; zo.title = 'Уменьшить масштаб'; zo.className = 'chart-zoom__btn chart-zoom__btn--out'; zo.addEventListener('click', zoomOut); ctrl.appendChild(zo);
    const zr = document.createElement('button'); zr.textContent = 'Сброс'; zr.title = 'Сбросить масштаб'; zr.className = 'chart-zoom__btn chart-zoom__btn--reset'; zr.addEventListener('click', resetZoom); ctrl.appendChild(zr);
    const zinfo = document.createElement('span'); zinfo.id = 'zoom-info'; zinfo.textContent = 'Видно: все'; zinfo.className = 'chart-zoom__info'; ctrl.appendChild(zinfo);
    const header = cc.querySelector('.chart-header') || cc;
    header.appendChild(ctrl);
    const dl = state.currentDisplayDataLength || state.chartAllData.length || 0;
    state.zoomStartIndex = 0; state.zoomEndIndex = dl;
    if (state.ratingChart) {
        state.ratingChart.options.scales.x.min = 0;
        state.ratingChart.options.scales.x.max = dl;
        state.ratingChart.update();
    }
    updateZoomInfo();
}

function renderChartStatsCards(container, stats, rowClass = 'chart-stats-row') {
    const old = container.querySelector('.' + rowClass); if (old) old.remove();
    const row = document.createElement('div'); row.className = rowClass;
    const mk = (label, value, color) => {
        const card = document.createElement('div'); card.className = 'chart-stat-card';
        card.style.setProperty('--kpi-color', color);
        const v = document.createElement('div'); v.className = 'chart-stat-card__value';
        const pct = ['Медианная обеспеченность','Медианный дефицит','Средняя обеспеченность','Средний дефицит'];
        v.textContent = pct.includes(label) ? `${value}%` : value;
        const l = document.createElement('div'); l.className = 'chart-stat-card__label'; l.textContent = label;
        card.title = `${label}: ${v.textContent}`;
        v.title = v.textContent; l.title = label;
        card.append(v, l);
        return card;
    };
    stats.forEach(s => row.appendChild(mk(s.label, s.value, s.color)));
    container.appendChild(row);
}

/* ================= ПЛАГИН: БЛОКИ ================= */
const blockCountsPlugin = {
    id: 'blockCountsPlugin',
    afterDatasetsDraw(chart) {
        if (state.currentChartFormat !== 'full') return;
        const dd = getChartDisplayData(); if (!dd?.length) return;
        const { ctx, chartArea, scales } = chart; if (!chartArea) return;
        const total = dd.length;
        const blocks = [
            { label: '100%',   from: 100, to: 100, yPos: 104, count: 0, color: '#3BC35D' },
            { label: '81–99%', from: 81,  to: 99,  yPos: 90,  count: 0, color: '#3BC35D' },
            { label: '61–80%', from: 61,  to: 80,  yPos: 70,  count: 0, color: '#A7E431' },
            { label: '41–60%', from: 41,  to: 60,  yPos: 50,  count: 0, color: '#618CEA' },
            { label: '21–40%', from: 21,  to: 40,  yPos: 30,  count: 0, color: '#4CBDF7' },
            { label: '1–20%',  from: 1,   to: 20,  yPos: 10,  count: 0, color: '#ED933B' },
            { label: '0%',     from: 0,   to: 0,   yPos: -4,  count: 0, color: '#ED933B' }
        ];
        dd.forEach(it => {
            let v = Number(it.rating); if (!isFinite(v)) v = 0;
            v = Math.max(0, Math.min(100, v));
            const b = blocks.find(bl => v >= bl.from && v <= bl.to);
            if (b) b.count++;
        });
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
        [20,40,60,80,100].forEach(val => {
            const y = scales.y.getPixelForValue(val);
            if (y >= chartArea.top && y <= chartArea.bottom) {
                ctx.beginPath(); ctx.moveTo(chartArea.left, y); ctx.lineTo(chartArea.right, y); ctx.stroke();
            }
        });
        ctx.restore();
        const meta = chart.getDatasetMeta(0);
        const last = meta.data[meta.data.length - 1];
        const startX = (last ? last.x + (last.width || 0) / 2 : chartArea.right) + 20;
        ctx.save();
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        blocks.forEach(b => {
            let yMid = scales.y.getPixelForValue(b.yPos);
            yMid = Math.max(20, Math.min(chart.height - 20, yMid));
            const pct = ((b.count / total) * 100).toFixed(2);
            ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = b.color;
            ctx.fillText(b.label, startX, yMid - 8);
            ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = 'black';
            ctx.fillText(`${b.count} НП (${pct}%)`, startX, yMid + 10);
        });
        ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = 'black';
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(`Всего НП: ${total}`, chartArea.right, chartArea.bottom + 25);
        ctx.restore();
    }
};

/* ================= СОЗДАНИЕ ГРАФИКА ================= */
export function createRatingChart(data, type) {
    const canvas = document.getElementById('rating-chart');
    if (!canvas) { console.error('Canvas для диаграммы не найден'); return; }
    destroyChart();
    canvas.style.border = 'none';
    canvas.style.outline = 'none';
    canvas.style.boxShadow = 'none';
    canvas.style.background = 'transparent';
    const pi = canvas.closest('.chart-inner');
    if (pi) {
        pi.style.border = 'none';
        pi.style.outline = 'none';
        pi.style.boxShadow = 'none';
    }
    const pc = canvas.closest('.chart-content');
    if (pc) {
        pc.style.border = 'none';
        pc.style.outline = 'none';
        pc.style.boxShadow = 'none';
    }
    const cc = document.getElementById('chart-container');
    if (cc) {
        cc.style.border = 'none';
        cc.style.outline = 'none';
        cc.style.boxShadow = 'none';
    }
    const ctx = canvas.getContext('2d');
    state.chartAllData = [...data];
    state.chartCurrentData = [...data];
    state.chartType = type;
    const ss = document.getElementById('chart-sort-select');
    const sf = ss ? ss.value : 'rating';
    let sd = [...state.chartAllData];
    if (sf === 'rating') sd.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sf === 'rating_asc') sd.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    const gro = [...state.chartAllData].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    state.ratingPlacesMap = new Map();
    gro.forEach((it, idx) => state.ratingPlacesMap.set(String(it.id), idx + 1));
    state.ratingPlacesTotal = gro.length;
    let dd = sd;
    if (state.chartSearchQuery.trim()) {
        const q = state.chartSearchQuery.trim().toLowerCase();
        dd = sd.filter(it => (it.name || '').toLowerCase().includes(q) || (it.region_name || '').toLowerCase().includes(q) || (it.district_name || '').toLowerCase().includes(q));
    }
    state.currentDisplayDataLength = dd.length;
    state.chartDisplayData = dd;
    const labels = dd.map(it => it.name || `ID: ${it.id}`);
    const pv = dd.map(it => Math.max(0, Math.min(100, it.rating || 0)));
    const dv = dd.map(it => 100 - Math.max(0, Math.min(100, it.rating || 0)));
    const pc1 = dd.map(() => '#4AC15D');
    const pc2 = dd.map(() => '#ED933B');
    const ratingsAll = sd.map(it => Number(it.rating) || 0);
    const n = ratingsAll.length;
    const sum = ratingsAll.reduce((a, b) => a + b, 0);
    const avg = n ? sum / n : 0;
    const avgD = n ? 100 - avg : 0;
    const sorted = [...ratingsAll].sort((a, b) => a - b);
    let med = 0;
    if (n) {
        const mid = Math.floor(n / 2);
        med = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    const medD = n ? 100 - med : 0;
    const radioAll = document.getElementById('number-settlements');
    const fromI = document.getElementById('numbers-settlement');
    const toI = document.getElementById('numbers-settlements');
    const isAll = !!(radioAll && radioAll.checked);
    const popFrom = isAll ? 1 : (parseInt(fromI?.value) || 1);
    const popTo = isAll ? 17000000 : (parseInt(toI?.value) || 17000000);
    const popLabel = isAll ? 'Все НП' : `${popFrom.toLocaleString('ru-RU')}–${popTo.toLocaleString('ru-RU')}`;
    state.ratingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Обеспеченность,%', data: pv, backgroundColor: pc1, borderColor: pc1, borderWidth: 0, borderRadius: 0,
                    barPercentage: 0.97, categoryPercentage: 0.97, stack: 'total', minBarLength: 0,
                    hoverBackgroundColor: '#ff1a1a', hoverBorderColor: '#ff1a1a', hoverBorderWidth: 0 },
                { label: 'Дефицит,%', data: dv, backgroundColor: pc2, borderColor: pc2, borderWidth: 0, borderRadius: 0,
                    barPercentage: 0.97, categoryPercentage: 0.97, stack: 'total', minBarLength: 0,
                    hoverBackgroundColor: '#cc0000', hoverBorderColor: '#cc0000', hoverBorderWidth: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 8, bottom: state.currentChartFormat === 'full' ? 40 : 90, right: 210 } },
            interaction: { mode: 'index', intersect: true, axis: 'x' },
            onClick: (evt, elements) => {
                if (!elements?.length) return;
                const idx = elements[0].index;
                const item = dd[idx]; if (!item) return;
                setSelectedSettlement(item, 'chart');
                highlightSelectedOnChart();
                openSettlementInfoModal(item);
            },
            onHover: (event, elements) => {
                const ne = event?.native ? event.native : event;
                const cnv = ne?.target ? ne.target : state.ratingChart.canvas; if (!cnv) return;
                const ds0 = state.ratingChart.data.datasets[0];
                const ds1 = state.ratingChart.data.datasets[1];
                const isSel = i => {
                    if (!state.selectedSettlementHighlighted || state.selectedSettlementId == null) return false;
                    const d = dd[i]; if (!d || d.id === undefined) return false;
                    return String(d.id) === String(state.selectedSettlementId);
                };
                if (elements?.length) {
                    const hi = elements[0].index;
                    cnv.style.cursor = 'pointer';
                    ds0.backgroundColor = dd.map((_, i) => i === hi ? '#ff1a1a' : isSel(i) ? '#ff0000' : '#4AC15D');
                    ds0.borderColor = ds0.backgroundColor; ds0.hoverBackgroundColor = '#ff1a1a';
                    ds1.backgroundColor = dd.map((_, i) => i === hi ? '#cc0000' : isSel(i) ? '#cc0000' : '#ED933B');
                    ds1.borderColor = ds1.backgroundColor; ds1.hoverBackgroundColor = '#cc0000';
                } else {
                    cnv.style.cursor = 'default';
                    ds0.backgroundColor = dd.map((_, i) => isSel(i) ? '#ff0000' : '#4AC15D');
                    ds0.borderColor = ds0.backgroundColor;
                    ds1.backgroundColor = dd.map((_, i) => isSel(i) ? '#cc0000' : '#ED933B');
                    ds1.borderColor = ds1.backgroundColor;
                }
                state.ratingChart.update('none');
            },
            plugins: {
                legend: {
                    display: true, position: 'top',
                    labels: {
                        font: { size: 16, weight: 'bold' }, color: 'black', boxWidth: 22, boxHeight: 14, padding: 12,
                        generateLabels: () => [
                            { text: 'Обеспеченность,%', fillStyle: '#4AC15D', strokeStyle: '#4AC15D', lineWidth: 1, hidden: false, index: 0 },
                            { text: 'Дефицит,%', fillStyle: '#ED933B', strokeStyle: '#ED933B', lineWidth: 1, hidden: false, index: 1 }
                        ]
                    }
                },
                tooltip: {
                    enabled: true, intersect: false, mode: 'index',
                    backgroundColor: '#bdbdbd', titleColor: '#000', bodyColor: '#000',
                    borderColor: '#000', borderWidth: 2, padding: 12, cornerRadius: 8,
                    titleFont: { size: 16, weight: 'bold' }, bodyFont: { size: 14, weight: 'bold' },
                    bodySpacing: 6,
                    callbacks: {
                        title: ctx => { const it = dd[ctx[0].dataIndex]; return it ? (it.name || `ID: ${it.id}`) : ''; },
                        label: ctx => {
                            const it = dd[ctx.dataIndex]; if (!it) return '';
                            const r = Number(it.rating) || 0;
                            return ctx.datasetIndex === 0 ? `Обеспеченность: ${Math.round(r)}%` : `Дефицит: ${Math.round(100 - r)}%`;
                        },
                        labelColor: ctx => ctx.datasetIndex === 0
                            ? { borderColor: '#4AC15D', backgroundColor: '#4AC15D', borderWidth: 1, borderRadius: 2 }
                            : { borderColor: '#ED933B', backgroundColor: '#ED933B', borderWidth: 1, borderRadius: 2 },
                        labelTextColor: () => '#000',
                        afterBody: ctx => {
                            const it = dd[ctx[0].dataIndex]; if (!it) return [];
                            const p = state.ratingPlacesMap.get(String(it.id)) || '—';
                            const t = state.ratingPlacesTotal || 0;
                            return [`Место в обеспеченности: ${p} из ${t}`, `Население: ${it.population || 0} чел.`,
                                `${it.region_name || 'Н/Д'}`, `${it.district_name || 'Н/Д'}`, `ID: ${it.id}`];
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false }, title: { display: false }, ticks: { display: false }, border: { color: '#000', width: 2 } },
                y: {
                    stacked: true, beginAtZero: true, min: 0, max: 100,
                    grid: { display: false, drawBorder: true },
                    ticks: { stepSize: 20, font: { size: 14 }, color: '#000', callback: v => v + '%' },
                    title: { display: true, text: 'Обеспеченность', color: '#000', font: { size: 16, weight: 'bold' } },
                    border: { color: '#000', width: 2 }
                }
            },
            animation: { duration: 0 },
            hover: { mode: 'index', intersect: false, animationDuration: 200 },
            elements: { bar: { borderRadius: 0 } }
        },
        plugins: [
            {
                id: 'referenceLines',
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart; if (!chartArea) return;
                    const yS = chart.scales.y, xS = chart.scales.x; if (!yS || !xS) return;
                    const d = getChartDisplayData(); const len = d.length; if (!len) return;
                    ctx.save();
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([]);
                    [20,40,60,80,100].forEach(yL => {
                        const yp = yS.getPixelForValue(yL);
                        if (yp >= chartArea.top && yp <= chartArea.bottom) {
                            ctx.beginPath(); ctx.moveTo(chartArea.left, yp); ctx.lineTo(chartArea.right, yp); ctx.stroke();
                        }
                    });
                    ctx.setLineDash([4,4]); ctx.strokeStyle = 'rgba(70,70,70,0.5)'; ctx.fillStyle = 'black';
                    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                    const target = 3, rawStep = len / (target + 1);
                    let mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
                    let step = mag;
                    if (rawStep > 2 * mag) step = 2 * mag;
                    if (rawStep > 5 * mag) step = 5 * mag;
                    if (step === 0) step = 1;
                    for (let i = step; i < len; i += step) {
                        const xp = xS.getPixelForValue(i);
                        if (xp > chartArea.left + 10 && xp < chartArea.right - 10) {
                            ctx.beginPath(); ctx.moveTo(xp, chartArea.top); ctx.lineTo(xp, chartArea.bottom); ctx.stroke();
                            ctx.fillText(i.toLocaleString('ru-RU'), xp, chartArea.bottom + 5);
                        }
                    }
                    const x0 = xS.getPixelForValue(0);
                    const tx = x0 < chartArea.left + 15 ? chartArea.left + 15 : x0;
                    ctx.textAlign = 'center';
                    ctx.fillText('0', tx, chartArea.bottom + 5);
                    ctx.restore();
                }
            },
            { id: 'shortLabels', afterDatasetsDraw(chart) { if (state.currentChartFormat === 'short') drawShortLabels(chart, dd); } },
            blockCountsPlugin,
            {
                id: 'highlightMarker',
                afterDatasetsDraw(chart) {
                    if (!state.selectedSettlementId || !state.selectedSettlementHighlighted) return;
                    const { ctx, chartArea } = chart; if (!chartArea) return;
                    const d = getChartDisplayData(); if (!d?.length) return;
                    const meta = chart.getDatasetMeta(0); if (!meta?.data?.length) return;
                    let fi = -1;
                    for (let i = 0; i < d.length; i++) if (String(d[i].id) === String(state.selectedSettlementId)) { fi = i; break; }
                    if (fi === -1) return;
                    const bar = meta.data[fi]; if (!bar) return;
                    const bw = bar.width || 1;
                    const mw = Math.max(bw, 6);
                    const x = bar.x - mw / 2;
                    ctx.save();
                    ctx.fillStyle = 'rgba(255,26,26,0.45)';
                    ctx.fillRect(x, chartArea.top, mw, chartArea.bottom - chartArea.top);
                    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(bar.x, chartArea.top); ctx.lineTo(bar.x, chartArea.bottom); ctx.stroke();
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath(); ctx.arc(bar.x, chartArea.top + 6, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
            }
        ]
    });
    canvas.style.border = 'none';
    canvas.style.outline = 'none';
    canvas.style.boxShadow = 'none';
    state.isChartMode = true;
    const cc2 = document.getElementById('chart-container');
    const h = cc2?.querySelector('.chart-header');
    if (h) {
        h.innerHTML = '';
        const t = document.createElement('div'); t.className = 'chart-title'; t.textContent = 'График обеспеченности НП региона';
        h.appendChild(t);
    }
    renderChartControls(sf);
    if (h) {
        const stats = [
            { label: 'Количество НП',            value: n.toLocaleString('ru-RU'), color: '#0066ff' },
            { label: 'Численность населения',    value: popLabel,                  color: '#4c00a8' },
            { label: 'Средняя обеспеченность',   value: avg.toFixed(2),            color: '#228028' },
            { label: 'Средний дефицит',          value: avgD.toFixed(2),           color: '#cc0000' },
            { label: 'Медианная обеспеченность', value: med.toFixed(2),            color: '#228028' },
            { label: 'Медианный дефицит',        value: medD.toFixed(2),           color: '#cc0000' }
        ];
        renderChartStatsCards(h, stats, 'chart-stats-row');
    }
    const pag = document.getElementById('settlements-pagination'); if (pag) pag.style.display = 'none';
    state.zoomStartIndex = 0; state.zoomEndIndex = state.currentDisplayDataLength;
    if (state.ratingChart) {
        state.ratingChart.options.scales.x.min = 0;
        state.ratingChart.options.scales.x.max = state.currentDisplayDataLength;
        state.ratingChart.update();
    }
    updateZoomInfo();
    setTimeout(resizeRatingChart, 0);
    if (state.selectedSettlementId) {
        state.selectedSettlementHighlighted = true;
        setTimeout(restoreSelectionById, 0);
    }
}

/* ================= КРАТКИЙ РЕЖИМ ================= */
function drawShortLabels(chart, displayData) {
    if (state.currentChartFormat !== 'short') return;
    const { ctx, chartArea } = chart; if (!chartArea) return;
    const meta = chart.getDatasetMeta(0); if (!meta?.data?.length) return;
    const len = displayData.length; if (!len) return;
    const asc = (document.getElementById('chart-sort-select') || {}).value === 'rating_asc';
    const getX = idx => {
        if (idx < 0) return chartArea.left;
        if (idx >= len) { const l = meta.data[len - 1]; return l ? l.x : chartArea.right; }
        return meta.data[idx].x;
    };
    ctx.save();
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
    ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.lineWidth = 1;
    const fs = 12, lh = 14;
    const yBase = chartArea.bottom + 6, gap = 10;
    ctx.font = `bold ${fs}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif`;
    const items = [];
    const ratings = displayData.map(d => Number(d.rating) || 0);
    const steps = asc
        ? [{ t: 0, y: 0 }, { t: 20, y: 20 }, { t: 40, y: 40 }, { t: 60, y: 60 }, { t: 80, y: 80 }]
        : [{ t: 80, y: 80 }, { t: 60, y: 60 }, { t: 40, y: 40 }, { t: 20, y: 20 }, { t: 0, y: 0 }];
    steps.forEach(({ t, y }) => {
        let c = 0;
        for (let i = 0; i < len; i++) c += asc ? (ratings[i] <= t ? 1 : 0) : (ratings[i] > t ? 1 : 0);
        if (!c) return;
        const bi = c - 1;
        const x = getX(bi);
        if (x < chartArea.left - 1 || x > chartArea.right + 1) return;
        const pr = Math.round(c / len * 100);
        const lines = asc
            ? [`${c} (${pr}%) НП`, `Обесп. <${y}%`]
            : [`${c} (${pr}%) НП`, `Ур.обесп.>${y}%`];
        let mw = 0;
        lines.forEach(l => { const w = ctx.measureText(l).width; if (w > mw) mw = w; });
        let tx = x - mw / 2;
        if (items.length) {
            const p = items[items.length - 1];
            if (tx < p.x + p.width + gap) tx = p.x + p.width + gap;
        }
        items.push({ x: tx, centerX: x, lines, width: mw });
    });
    items.forEach(it => {
        ctx.beginPath(); ctx.moveTo(it.centerX, chartArea.bottom); ctx.lineTo(it.centerX, yBase - 4); ctx.stroke();
    });
    ctx.textAlign = 'left';
    items.forEach(it => it.lines.forEach((l, i) => ctx.fillText(l, it.x, yBase + i * lh)));
    ctx.font = `bold 13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`Всего ${len} НП`, chartArea.right + 6, yBase - 16);
    ctx.restore();
}