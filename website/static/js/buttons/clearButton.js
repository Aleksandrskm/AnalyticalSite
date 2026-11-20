'use strict';
import { state, resetDataState, resetFilterState } from '../core/state.js';
import { removeEl, removeSelector, hideResPageSize, showPlaceholder } from '../ui/common.js';
import { hideChartContainer } from '../ui/chartView.js';
import { destroyAnalyticsDashboard } from '../ui/analyticsView.js';
import { clearCompareView } from '../ui/compareView.js';
import { hideSettlementButtons } from './resButtons.js';
import { resetAndHideSelectedSettlement, hideSelectedSettlementBlock } from '../ui/selectedSettlement.js';

export function handleClear() {
    document.body.classList.remove('analytics-mode');

    const form = document.querySelector('.form__rating');
    if (form) form.reset();
    document.querySelectorAll('#region option').forEach(o => { o.selected = false; });
    const typeConnect = document.getElementById('type-connect');
    if (typeConnect) typeConnect.value = 'all';

    const radioRange = document.getElementById('number-settlement');
    const radioAll   = document.getElementById('number-settlements');
    const from = document.getElementById('numbers-settlement');
    const to   = document.getElementById('numbers-settlements');
    if (radioRange) radioRange.checked = true;
    if (radioAll)   radioAll.checked = false;
    if (from) from.value = 1;
    if (to)   to.value = 10000;

    hideSettlementButtons();
    ['format-controls-group', 'view-mode-toggle', 'res-modal'].forEach(removeEl);
    ['.filter-container', '.settlements-title'].forEach(removeSelector);

    resetAndHideSelectedSettlement();
    resetFilterState();
    hideResPageSize();

    const table = document.getElementById('settlements-table');
    if (table) {
        const thead = table.querySelector('thead'); if (thead) thead.innerHTML = '';
        const tbody = table.querySelector('tbody'); if (tbody) tbody.innerHTML = '';
    }
    const pag = document.getElementById('settlements-pagination');
    if (pag) pag.innerHTML = '';

    hideChartContainer();
    destroyAnalyticsDashboard();
    clearCompareView();          // список сравнения в LS сохраняем (как в исходнике)

    resetDataState();
    showPlaceholder();
    hideSelectedSettlementBlock();

    const hlBtn = document.getElementById('ss-btn-highlight');
    if (hlBtn) { hlBtn.disabled = true; hlBtn.title = 'Выберите НП'; }
}