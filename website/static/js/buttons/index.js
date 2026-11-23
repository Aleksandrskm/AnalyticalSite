'use strict';
import { handleRatingChartButton } from './ratingChartButton.js';
import { handleRatingTableButton } from './ratingTableButton.js';
import { handleSettlementsButton } from './settlementsButton.js';
import { handleAnalyticsDashboardButton } from './analyticsButton.js';
import { handleCompareButton } from './compareButton.js';
import { handleClear } from './clearButton.js';
import { handleClose } from './closeButton.js';
import { handleSelectedHighlight, handleSelectedInfo, handleSelectedClear } from './selectedSettlementButtons.js';

const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

export function initButtons() {
    on('btn-rating-chart',        handleRatingChartButton);
    on('btn-rating-table',        handleRatingTableButton);
    on('btn-settlements',         handleSettlementsButton);
    on('btn-analytics-dashboard', handleAnalyticsDashboardButton);
    on('btn-compare',             handleCompareButton);
    on('clear-btn',               handleClear);
    on('close-btn',               handleClose);

    on('ss-btn-highlight', handleSelectedHighlight);
    on('ss-btn-info',      handleSelectedInfo);
    on('ss-btn-clear',     handleSelectedClear);

    document.getElementById('btn-norm-consumption')?.remove();
}