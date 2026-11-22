'use strict';
import { state } from '../core/state.js';
import { loadRatingsData } from '../services/ratingsService.js';
import { clearCompareView } from '../ui/compareView.js';
import { renderCombinedTable, resetChartUIState } from '../ui/tableView.js';
import { showSettlementButtons } from './resButtons.js';
import { restoreSelectedFromStorage, showSelectedSettlementBlock, setSelectedSettlement } from '../ui/selectedSettlement.js';

export async function handleRatingTableButton() {
    clearCompareView();
    const ok = await loadRatingsData();
    if (!ok) return;

    const pageSize = state.settlementsData.pageSize || 100;
    // последний аргумент allowAutoPageJump = true — только первичная загрузка
    renderCombinedTable(state.originalDataForFilter, state.originalTotalForFilter, 0, pageSize, false, true);

    showSettlementButtons();
    const radio = document.querySelector('input[name="view-mode"][value="table"]');
    if (radio) radio.checked = true;

    showSelectedSettlementBlock();
    resetChartUIState();

    if (!state.selectedSettlementId) restoreSelectedFromStorage();
    if (!state.selectedSettlementId) return;

    const item = state.settlementsData.items.find(it => String(it.id) === String(state.selectedSettlementId));
    if (item) setSelectedSettlement(item, 'table');
    else {
        const nameEl = document.getElementById('selected-settlement-name');
        if (nameEl) nameEl.textContent = state.selectedSettlementName || `ID: ${state.selectedSettlementId}`;
    }
}