'use strict';
import { getRatingsPage, postRatingSett } from '../db.js';
import { state } from '../core/state.js';
import { initLoader } from '../ui/common.js';
import { loadTableStructures } from './settlementsService.js';
import { createProgressModal, updateProgress, closeProgressModal } from '../ui/modals/progressModal.js';
import { rerenderCurrentTable } from '../ui/tableView.js';

export async function loadRatingsBulk(regions, popRange) {
    const loader = initLoader();
    loader.show('Загрузка обеспеченности...');
    const result = {};
    try {
        await loadTableStructures();
        const body = {
            regions: Array.isArray(regions) ? regions : [],
            population_filters: popRange ? [{ from: popRange.from, to: popRange.to }] : []
        };
        const response = await getRatingsPage(0, 1, body);
        if (!response) { loader.close(); return result; }
        const ratings = Array.isArray(response) ? response : (response.ratings || []);
        ratings.forEach(r => {
            if (r && r.id !== undefined && r.id !== null) result[String(r.id)] = r;
        });
        loader.close();
        return result;
    } catch (e) {
        loader.close();
        console.error('Ошибка массовой загрузки обеспеченности:', e);
        return result;
    }
}

export async function loadRatingsForSettlements(items, allowPost = false) {
    if (!items.length) return;
    const bulk = await loadRatingsBulk(state.currentRegions, state.currentPopRange);
    Object.keys(bulk).forEach(id => { state.allRatings[id] = bulk[id]; });

    if (!allowPost) return;
    const missing = items.filter(it => !state.allRatings[String(it.id)]);
    if (!missing.length) return;

    createProgressModal(missing.length);
    const titleEl = document.querySelector('.progress-modal-title');
    if (titleEl) titleEl.textContent = 'Расчет обеспеченности';
    state.isCancelled = false;

    let processed = 0, successCount = 0;
    for (const s of missing) {
        if (state.isCancelled) { closeProgressModal(); return; }
        try { await postRatingSett(s.id); }
        catch (e) { console.warn(`▶ НП ${s.id}: ошибка POST`, e); }
        processed++;
        updateProgress(processed, missing.length, successCount);
        await new Promise(r => setTimeout(r, 100));
    }
    const refreshed = await loadRatingsBulk(state.currentRegions, state.currentPopRange);
    Object.keys(refreshed).forEach(id => { state.allRatings[id] = refreshed[id]; });
    successCount = missing.filter(s => state.allRatings[String(s.id)]).length;
    closeProgressModal();
}

export async function loadRatingsData() {
    state.isCalculateMode = false;
    state.isChartMode = false;
    state.savedFilterField = ''; state.savedFilterValue = ''; state.savedFilterExact = false;
    state.currentDisplayPage = 0;

    const { getSelectedRegions, getPopulationRange, getSelectedKinds } = await import('../ui/form.js');
    const { showRegionWarning } = await import('../ui/common.js');
    const { hideResPageSize } = await import('../ui/common.js');
    hideResPageSize();

    const regions  = getSelectedRegions();
    const popRange = getPopulationRange();
    const kinds    = getSelectedKinds();
    if (!regions.length) { showRegionWarning(); return false; }

    state.currentRegions = regions;
    state.currentPopRange = popRange;
    state.currentKinds = kinds;

    const { loadSettlements, getPageSize, getPage } = await import('./settlementsService.js');
    const pageSize = getPageSize();
    const page = getPage();
    const result = await loadSettlements(page, regions, popRange, pageSize);
    if (!result || !result.items.length) return false;

    state.originalDataForFilter = result.items || [];
    state.originalTotalForFilter = result.total || 0;
    state.settlementsData.items = result.items || [];
    state.settlementsData.total = result.total || 0;
    state.settlementsData.page = page;
    state.settlementsData.pageSize = pageSize;

    state.currentSortField = null; state.currentSortOrder = 'asc';
    state.currentFilterField = ''; state.currentFilterValue = ''; state.currentFilterExact = false;
    state.showRatings = true;
    state.allRatings = {};

    await loadRatingsForSettlements(state.settlementsData.items, false);
    return true;
}

export async function getRatingsOnlyForData() {
    const bulk = await loadRatingsBulk(state.currentRegions, state.currentPopRange);
    Object.keys(bulk).forEach(id => { state.allRatings[id] = bulk[id]; });
    rerenderCurrentTable();
}

export async function calculateRatingsForData(items) {
    state.isCalculateMode = true;
    state.isCancelled = false;
    const settlements = items.map(it => ({
        id: it.id, lat: parseFloat(it.lat), lon: parseFloat(it.lon), area: parseFloat(it.area) || 1
    }));
    if (!settlements.length) return;

    const existing = await loadRatingsBulk(state.currentRegions, state.currentPopRange);
    Object.keys(existing).forEach(id => { state.allRatings[id] = existing[id]; });

    const toCalc = settlements.filter(s => !state.allRatings[String(s.id)]);
    if (!toCalc.length) { rerenderCurrentTable(); return; }

    createProgressModal(toCalc.length);
    let processed = 0;
    for (const s of toCalc) {
        if (state.isCancelled) break;
        try { await postRatingSett(s.id); }
        catch (e) { console.warn(`▶ НП ${s.id}: POST ошибка`, e); }
        processed++;
        updateProgress(processed, toCalc.length, 0);
        await new Promise(r => setTimeout(r, 300));
    }
    const bulk = await loadRatingsBulk(state.currentRegions, state.currentPopRange);
    Object.keys(bulk).forEach(id => { state.allRatings[id] = bulk[id]; });
    closeProgressModal();
    rerenderCurrentTable();
}