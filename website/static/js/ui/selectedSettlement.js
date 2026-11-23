'use strict';
import { state } from '../core/state.js';
import { LS_KEYS, lsGet, lsSet, lsRemove } from '../core/storage.js';
import { clearChartSelection } from './chartView.js';

export function persistSelectedIdNp(id) {
    if (id !== undefined && id !== null && String(id).trim() !== '') lsSet(LS_KEYS.idNp, String(id).trim());
    else { lsRemove(LS_KEYS.idNp); lsSet(LS_KEYS.idNp, ''); }
}

export function hideSelectedSettlementBlock() {
    const el = document.getElementById('selected-settlement-block');
    if (el) el.style.display = 'none';
}

export function showSelectedSettlementBlock() {
    const inChart = state.isChartMode === true;
    const inTable = !state.isChartMode && !state.isAnalyticsMode &&
        (state.showRatings === true || state.settlementsData.items.length > 0);
    if (!inChart && !inTable) { hideSelectedSettlementBlock(); return; }

    const el = document.getElementById('selected-settlement-block');
    if (el) el.style.display = 'flex';

    const hlBtn = document.getElementById('ss-btn-highlight');
    if (!hlBtn) return;

    if (state.isAnalyticsMode) { hlBtn.disabled = true; hlBtn.title = 'Недоступно в режиме диаграммы'; return; }
    if (!state.selectedSettlementId) { hlBtn.disabled = true; hlBtn.title = 'Выберите НП'; return; }
    hlBtn.disabled = false;
    hlBtn.title = state.isChartMode ? 'Отобразить на графике' : 'Перейти к НП в таблице';
}

function paintName() {
    const nameEl = document.getElementById('selected-settlement-name');
    if (!nameEl) return;
    nameEl.textContent = state.selectedSettlementName || '—';
    nameEl.title = state.selectedSettlementName || '';
}

export function setSelectedSettlement(item, mode) {
    if (!item || item.id === undefined || item.id === null) { clearSelectedSettlement(); return; }
    persistSelectedIdNp(item.id);
    const newId = String(item.id);

    document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
        if (String(tr.dataset.id) !== newId) tr.classList.remove('selected');
    });

    clearChartSelection(); // сброс красных столбцов + тултипа + selectedSearch*

    state.selectedSettlementForInfo = item;
    state.selectedSettlementId = newId;
    state.selectedSettlementName = item.name || item.NAME || `ID: ${item.id}`;
    state.selectedSettlementLat  = item.lat ?? null;
    state.selectedSettlementLon  = item.lon ?? null;
    state.selectedSettlementArea = item.area ?? null;
    state.selectedSettlementMode = mode;
    state.selectedSettlementHighlighted = true;

    paintName();
    showSelectedSettlementBlock();
}

export function clearSelectedSettlement() {
    Object.assign(state, {
        selectedSettlementForInfo: null, selectedSettlementId: null, selectedSettlementName: null,
        selectedSettlementLat: null, selectedSettlementLon: null, selectedSettlementArea: null,
        selectedSettlementMode: null, selectedSettlementHighlighted: false,
        selectedSearchItem: null, selectedSearchIndex: -1
    });
    paintName();
    document.querySelectorAll('#settlements-table tbody tr').forEach(tr => tr.classList.remove('selected'));
    clearChartSelection();
    const hlBtn = document.getElementById('ss-btn-highlight');
    if (hlBtn) hlBtn.disabled = true;
}

export function resetAndHideSelectedSettlement() {
    clearSelectedSettlement();
    hideSelectedSettlementBlock();
}

export function resetSelectedOnRegionChange() {
    clearSelectedSettlement();
    lsSet(LS_KEYS.idNp, '');
    hideSelectedSettlementBlock();
}

export function restoreSelectedFromStorage() {
    const storedId = lsGet(LS_KEYS.idNp, null);
    if (!storedId) return false;
    const targetId = String(storedId).trim();
    if (!targetId) return false;

    const item = (state.settlementsData.items || []).find(it => String(it.id) === targetId);
    if (item) {
        state.selectedSettlementId = String(item.id);
        state.selectedSettlementName = item.name || `ID: ${item.id}`;
        state.selectedSettlementLat = item.lat;
        state.selectedSettlementLon = item.lon;
        state.selectedSettlementArea = item.area;
        state.selectedSettlementForInfo = item;
    } else {
        state.selectedSettlementId = targetId;
        state.selectedSettlementName = `ID: ${targetId}`;
    }
    paintName();
    showSelectedSettlementBlock();
    return !!item;
}

export function onTableRowSelected(row) {
    if (!row || !row.dataset.id) return;
    const id = row.dataset.id;
    const item = state.settlementsData.items.find(it => String(it.id) === String(id)) || {
        id, name: row.dataset.name || `ID: ${id}`,
        lat: row.dataset.lat, lon: row.dataset.lon, area: row.dataset.area
    };
    const mode = state.isChartMode ? 'chart' : (state.showRatings ? 'rating' : 'table');
    setSelectedSettlement(item, mode);
}