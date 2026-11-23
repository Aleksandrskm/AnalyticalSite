'use strict';
import { state, resetFilterState } from '../core/state.js';
import { showRegionWarning } from '../ui/common.js';
import { getSelectedRegions, getSelectedKinds, getPopulationRange } from '../ui/form.js';
import { loadSettlements } from '../services/settlementsService.js';
import { clearCompareView } from '../ui/compareView.js';
import { destroyAnalyticsDashboard } from '../ui/analyticsView.js';
import { renderSettlementsTableOnly, resetChartUIState } from '../ui/tableView.js';
import { showSettlementButtons } from './resButtons.js';
import { showResPageSize } from '../ui/common.js';
import { restoreSelectedFromStorage, showSelectedSettlementBlock, setSelectedSettlement } from '../ui/selectedSettlement.js';

export async function handleSettlementsButton() {
    clearCompareView();
    destroyAnalyticsDashboard();

    state.isCalculateMode = false;
    state.isChartMode = false;
    resetFilterState();
    state.currentSortField = null;
    state.currentSortOrder = 'asc';

    document.getElementById('view-mode-toggle')?.remove();
    showResPageSize();

    const regions = getSelectedRegions();
    if (!regions.length) { showRegionWarning(); return; }

    state.currentRegions  = regions;
    state.currentPopRange = getPopulationRange();
    state.currentKinds    = getSelectedKinds();

    const pageSize = state.settlementsData.pageSize || 100;
    const result = await loadSettlements(0, regions, state.currentPopRange, pageSize);
    if (!result) return;

    state.originalDataForFilter  = result.items || [];
    state.originalTotalForFilter = result.total || 0;
    state.settlementsData.items  = result.items || [];
    state.settlementsData.total  = result.total || 0;
    state.settlementsData.page   = 0;
    state.settlementsData.pageSize = pageSize;
    state.showRatings = false;
    state.allRatings = {};

    renderSettlementsTableOnly(state.originalDataForFilter, state.originalTotalForFilter, 0, pageSize, false, true);
    showSettlementButtons();
    resetChartUIState();
    showSelectedSettlementBlock();

    if (!state.selectedSettlementId) restoreSelectedFromStorage();
    if (state.selectedSettlementId) {
        const item = state.settlementsData.items.find(it => String(it.id) === String(state.selectedSettlementId));
        if (item) setSelectedSettlement(item, 'table');
    }
}