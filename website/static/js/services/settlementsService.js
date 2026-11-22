'use strict';
import { getSettlementsPage, postJSON } from '../db.js';
import { state } from '../core/state.js';
import { TABLE_SETTLEMENTS, TABLE_RANKING, EDIT_DB_NAME } from '../core/constants.js';
import { initLoader } from '../ui/common.js';

export async function loadTableStructures() {
    if (!state.settlementsColumnsCache) {
        try {
            const info = await postJSON({ name: TABLE_SETTLEMENTS }, EDIT_DB_NAME);
            state.settlementsColumnsCache = (info && info.columns_info) ? info.columns_info : [];
        } catch (e) {
            console.error('Ошибка загрузки структуры A_NAS_P:', e);
            state.settlementsColumnsCache = [];
        }
    }
    if (!state.rankingColumnsCache) {
        try {
            const info = await postJSON({ name: TABLE_RANKING }, EDIT_DB_NAME);
            state.rankingColumnsCache = (info && info.columns_info) ? info.columns_info : [];
        } catch (e) {
            console.error('Ошибка загрузки структуры A_NAS_P_RANKING:', e);
            state.rankingColumnsCache = [];
        }
    }
    return {
        settlementsColumns: state.settlementsColumnsCache,
        rankingColumns: state.rankingColumnsCache
    };
}

export function getValueByDbColumn(obj, dbColumn, map) {
    if (!obj) return '';
    const mapped = map ? map[dbColumn] : null;
    if (mapped && obj[mapped] !== undefined && obj[mapped] !== null) return obj[mapped];
    if (obj[dbColumn] !== undefined && obj[dbColumn] !== null) return obj[dbColumn];
    if (obj[dbColumn.toUpperCase()] !== undefined && obj[dbColumn.toUpperCase()] !== null) return obj[dbColumn.toUpperCase()];
    if (obj[dbColumn.toLowerCase()] !== undefined && obj[dbColumn.toLowerCase()] !== null) return obj[dbColumn.toLowerCase()];
    return '';
}

export async function loadSettlements(page = 0, regions, popRange, pageSize) {
    const loader = initLoader();
    loader.show('Загрузка населенных пунктов...');
    try {
        await loadTableStructures();
        const body = {
            regions,
            population_filters: popRange ? [{ from: popRange.from, to: popRange.to }] : []
        };
        const result = await getSettlementsPage(0, 1, body);
        loader.close();
        if (result) {
            const allItems = result.settlements || [];
            return { items: allItems, total: allItems.length };
        }
        return { items: [], total: 0 };
    } catch (e) {
        loader.close();
        console.error('Ошибка загрузки населенных пунктов:', e);
        return { items: [], total: 0 };
    }
}

export function calculateRadius(area) {
    if (!area || area <= 0) return 1;
    const r = Math.round(1.1 * Math.sqrt(area / Math.PI));
    return r >= 1 ? r : 1;
}

export function getPageSize() { return state.settlementsData.pageSize || 100; }
export function getPage()     { return 0; }