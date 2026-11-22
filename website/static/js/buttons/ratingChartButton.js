'use strict';
import { state } from '../core/state.js';
import { loadRatingsData } from '../services/ratingsService.js';
import { clearCompareView } from '../ui/compareView.js';
import { switchToChartMode, restoreSelectionById } from '../ui/chartView.js';
import { restoreSelectedFromStorage, showSelectedSettlementBlock } from '../ui/selectedSettlement.js';

export async function handleRatingChartButton() {
    clearCompareView();
    const ok = await loadRatingsData();
    if (!ok) return;

    if (!state.selectedSettlementId) restoreSelectedFromStorage();

    switchToChartMode();
    const radio = document.querySelector('input[name="view-mode"][value="chart"]');
    if (radio) radio.checked = true;

    showSelectedSettlementBlock();
    if (state.selectedSettlementId) setTimeout(() => restoreSelectionById(), 200);
}