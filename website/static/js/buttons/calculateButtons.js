'use strict';
import { state } from '../core/state.js';
import { initLoader } from '../ui/common.js';
import { postRatingSett } from '../db.js';
import { loadRatingsBulk } from '../services/ratingsService.js';
import { createProgressModal, updateProgress, closeProgressModal } from '../ui/modals/progressModal.js';
import { rerenderCurrentTable } from '../ui/tableView.js';

export function showCalculateAllButton() {
    const box = document.querySelector('.table_buttons');
    if (!box) return;
    if (!state.showRatings || state.isChartMode || state.isAnalyticsMode) { hideCalculateAllButton(); return; }
    if (document.getElementById('calculate-all-btn')) return;
    const btn = makeBtn('calculate-all-btn', 'Рассчитать обеспеченность всех НП в таблице', handleCalculateAll);
    const first = box.querySelector('.grid-btn');
    if (first) box.insertBefore(btn, first); else box.appendChild(btn);
}
export function hideCalculateAllButton() { document.getElementById('calculate-all-btn')?.remove(); }

export function showCalculateSelectedButton() {
    const box = document.querySelector('.table_buttons');
    if (!box) return;
    if (!state.showRatings || !state.selectedSettlementId || state.isChartMode || state.isAnalyticsMode) {
        hideCalculateSelectedButton(); return;
    }
    if (document.getElementById('calculate-selected-btn')) return;
    const btn = makeBtn('calculate-selected-btn', 'Рассчитать обеспеченность выбранного НП', handleCalculateSelected);
    const all = document.getElementById('calculate-all-btn');
    if (all) box.insertBefore(btn, all.nextSibling);
    else {
        const first = box.querySelector('.grid-btn');
        if (first) box.insertBefore(btn, first); else box.appendChild(btn);
    }
}
export function hideCalculateSelectedButton() { document.getElementById('calculate-selected-btn')?.remove(); }

function makeBtn(id, text, handler) {
    document.getElementById(id)?.remove();
    const b = document.createElement('button');
    b.id = id; b.className = `grid-btn ${id}`; b.textContent = text;
    b.style.cssText = 'margin-right:10px;width:auto';
    b.addEventListener('click', handler);
    return b;
}

async function mergeBulk() {
    const bulk = await loadRatingsBulk(state.currentRegions, state.currentPopRange);
    Object.assign(state.allRatings, bulk);
}

export async function handleCalculateSelected() {
    if (!state.selectedSettlementId) return;
    const loader = initLoader();
    loader.show(`Расчет обеспеченности для НП: ${state.selectedSettlementName || state.selectedSettlementId}...`);
    try {
        await postRatingSett(state.selectedSettlementId);
        await mergeBulk();
        loader.close();
        rerenderCurrentTable();
    } catch (e) {
        loader.close();
        console.error('Ошибка расчета обеспеченности:', e);
    }
}

export async function handleCalculateAll() {
    const items = state.currentSettlementsFiltered.length
        ? state.currentSettlementsFiltered
        : state.settlementsData.items;
    if (!items.length) return;

    await mergeBulk();
    const toCalc = items.filter(it => !state.allRatings[String(it.id)]);
    if (!toCalc.length) { rerenderCurrentTable(); return; }

    state.isCalculateMode = true;
    state.isCancelled = false;
    createProgressModal(toCalc.length);

    let processed = 0;
    for (const s of toCalc) {
        if (state.isCancelled) break;
        try { await postRatingSett(s.id); }
        catch (e) { console.warn(`▶ НП ${s.id}: POST ошибка`, e); }
        updateProgress(++processed, toCalc.length, 0);
        await new Promise(r => setTimeout(r, 300));
    }

    await mergeBulk();
    const success = toCalc.filter(s => state.allRatings[String(s.id)]).length;
    updateProgress(processed, toCalc.length, success);
    closeProgressModal();
    rerenderCurrentTable();
}