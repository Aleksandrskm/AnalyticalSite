'use strict';
import { getResPage } from '../db.js';
import { state } from '../core/state.js';
import { initLoader } from '../ui/common.js';
import { calculateRadius, getPageSize, getPage } from './settlementsService.js';
import { openResModal } from '../ui/modals/resModal.js';

export async function loadResForModal(settlementId, lat, lon, area) {
    if (!settlementId || lat === undefined || lon === undefined) return;
    const loader = initLoader();
    loader.show('Загрузка БС...');
    try {
        const radius = calculateRadius(area);
        const body = {
            regions: state.currentRegions,
            kinds: state.currentKinds,
            area: { lat, lon, radius }
        };
        const pageSize = getPageSize();
        const page = getPage();
        const result = await getResPage(page, pageSize, body);
        if (result) {
            state.resData.items = result.res || [];
            state.resData.total = result.total || 0;
            state.resData.page = page;
            state.resData.pageSize = pageSize;
            openResModal(state.resData.items, settlementId);
        }
        loader.close();
    } catch (e) {
        loader.close();
        console.error('Ошибка загрузки БС:', e);
    }
}