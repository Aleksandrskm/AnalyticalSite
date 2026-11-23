'use strict';
import { loadRatingsData } from '../services/ratingsService.js';
import { clearCompareView } from '../ui/compareView.js';
import { switchToAnalyticsMode } from '../ui/analyticsView.js';
import { restoreSelectedFromStorage } from '../ui/selectedSettlement.js';

export async function handleAnalyticsDashboardButton() {
    clearCompareView();
    const ok = await loadRatingsData();
    if (!ok) return;
    restoreSelectedFromStorage();
    switchToAnalyticsMode();
    const radio = document.querySelector('input[name="view-mode"][value="analytics"]');
    if (radio) radio.checked = true;
}