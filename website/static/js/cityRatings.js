'use strict';
import { state } from './core/state.js';
import { LS_KEYS, lsGet, lsSet } from './core/storage.js';
import { initLoader, hideResPageSize, hideAutoRating, showPlaceholder } from './ui/common.js';
import { getSelectedRegions, applyRegionsFromStorage, persistSelectedRegions } from './ui/form.js';
import { loadRegions, loadResKindsSelect } from './services/dictionaries.js';
import { initButtons } from './buttons/index.js';
import { hideSettlementButtons } from './buttons/resButtons.js';
import { handleRatingChartButton } from './buttons/ratingChartButton.js';
import { handleAnalyticsDashboardButton } from './buttons/analyticsButton.js';
import { setupDoubleClickHandler } from './ui/tableView.js';
import { updateCompareButtonCounter } from './ui/compareCounter.js';
import { hideSelectedSettlementBlock, resetSelectedOnRegionChange, setSelectedSettlement } from './ui/selectedSettlement.js';
import { highlightSelectedOnChart } from './ui/chartView.js';

document.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
    initLoader();
    loadResKindsSelect();
    hideResPageSize();
    hideAutoRating();
    hideSettlementButtons();
    showPlaceholder();
    hideSelectedSettlementBlock();

    initButtons();
    updateCompareButtonCounter();
    setupDoubleClickHandler();

    document.getElementById('region')?.addEventListener('change', () => {
        persistSelectedRegions();
        resetSelectedOnRegionChange();
    });

    const url = new URLSearchParams(window.location.search);
    const regionsParam = url.get('regions');
    const typeParam    = url.get('type');
    const idNpParam    = url.get('id_np');
    if (regionsParam) lsSet(LS_KEYS.regions, regionsParam);
    if (idNpParam)    lsSet(LS_KEYS.idNp, idNpParam);
    const effectiveIdNp = idNpParam || lsGet(LS_KEYS.idNp, '');

    try { await loadRegions(); } catch (e) { console.error('loadRegions error:', e); }

    const regionSelect = document.getElementById('region');
    if (!regionSelect) return;
    const hasReal = Array.from(regionSelect.querySelectorAll('option'))
        .some(o => o.value !== 'all' && String(o.value).trim() !== '');
    if (!hasReal) { console.warn('Регионы не загрузились — автозапуск отменён'); return; }

    if (!regionSelect.selectedOptions.length) applyRegionsFromStorage();
    if (!getSelectedRegions().length) { console.warn('Выбор регионов пуст — автозапуск отменён'); return; }

    if (typeParam === '2') {
        await handleRatingChartButton();
        if (effectiveIdNp) {
            setTimeout(() => {
                const target = String(effectiveIdNp).trim();
                const item = state.settlementsData.items.find(it => String(it.id) === target);
                if (item) { setSelectedSettlement(item, 'chart'); highlightSelectedOnChart(); }
                else console.warn(`НП с ID ${target} не найден в загруженных данных.`);
            }, 800);
        }
    } else if (typeParam === '1') {
        await handleAnalyticsDashboardButton();
    }
}