'use strict';
import { state } from '../core/state.js';
import { LS_KEYS, lsRemove, lsSet } from '../core/storage.js';
import { highlightSelectedOnChart, clearChartSelection } from '../ui/chartView.js';
import { jumpToSettlementInTable, rerenderCurrentTable } from '../ui/tableView.js';
import { openSettlementInfoModal } from '../ui/modals/settlementInfoModal.js';
import { openEditModal } from '../ui/modals/editModal.js';
import { renderPopup } from '../ui/common.js';
import { clearSelectedSettlement, showSelectedSettlementBlock } from '../ui/selectedSettlement.js';
import { hideCalculateSelectedButton } from './calculateButtons.js';

/** «Показать» — подсветить на графике или перейти к строке таблицы. */
export function handleSelectedHighlight() {
    if (!state.selectedSettlementId) return;
    if (state.isChartMode && state.ratingChart) { highlightSelectedOnChart(); return; }
    jumpToSettlementInTable(String(state.selectedSettlementId));
}

/** «Инфо» — карточка НП (график) или модалка редактирования (таблица). */
export function handleSelectedInfo() {
    if (!state.selectedSettlementId) return;
    const mode = state.selectedSettlementMode || (state.isChartMode ? 'chart' : 'table');

    if (mode === 'chart') {
        const item = state.settlementsData.items.find(it => String(it.id) === String(state.selectedSettlementId))
            || state.selectedSettlementForInfo;
        if (item) openSettlementInfoModal(item);
        else renderPopup('Нет данных о выбранном НП');
        return;
    }
    openEditModal(
        state.selectedSettlementId,
        state.showRatings ? 'rating' : 'settlement',
        state.showRatings ? 'rating' : 'settlements'
    );
}

/** «Снять выделение». */
export function handleSelectedClear() {
    clearChartSelection();
    clearSelectedSettlement();
    lsRemove(LS_KEYS.idNp);
    lsSet(LS_KEYS.idNp, '');
    showSelectedSettlementBlock();

    if (!state.isChartMode && !state.isAnalyticsMode) {
        hideCalculateSelectedButton();
        rerenderCurrentTable();
    }
}