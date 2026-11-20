'use strict';
import { state } from './state.js';
import { LS_KEYS, lsGet, lsSet } from './storage.js';

export function lsGetCompareItems() {
    try {
        const raw = lsGet(LS_KEYS.compare);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

export function lsSetCompareItems(items) {
    lsSet(LS_KEYS.compare, JSON.stringify(items));
}

export function isInCompare(id) {
    if (id === undefined || id === null) return false;
    const target = String(id).trim();
    return lsGetCompareItems().some(it => String(it.id).trim() === target);
}

export function addToCompare(settlementId) {
    const idStr = String(settlementId);
    const items = lsGetCompareItems();
    if (items.some(it => String(it.id) === idStr)) return { ok: false, reason: 'already' };

    const settlement = (state.settlementsData.items || []).find(it => String(it.id) === idStr)
        || { id: settlementId };
    const rating = state.allRatings[idStr] || {};

    items.push({
        id: settlementId,
        name: settlement.name || settlement.NAME || `ID: ${settlementId}`,
        region_name: settlement.region_name || null,
        district_name: settlement.district_name || null,
        region_code: settlement.region_code || null,
        population: settlement.population || 0,
        area: settlement.area ?? null,
        lat: settlement.lat ?? null,
        lon: settlement.lon ?? null,
        fias_id: settlement.fias_id || null,
        ...rating,
        rating: (rating.rating !== undefined && rating.rating !== null) ? Number(rating.rating) : null,
        _addedAt: Date.now()
    });

    lsSetCompareItems(items);
    return { ok: true };
}

export function removeFromCompare(settlementId) {
    const idStr = String(settlementId);
    const items = lsGetCompareItems().filter(it => String(it.id) !== idStr);
    lsSetCompareItems(items);
    return items;
}

export function clearCompare() { lsSetCompareItems([]); }