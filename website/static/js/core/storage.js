'use strict';

export const LS_KEYS = {
    regions: 'rating:regions',
    idNp:    'rating:id_np',
    compare: 'rating:compare_items'
};

export const DEFAULT_REGION = '29';
export const DEFAULT_ID_NP  = '';

export function lsGet(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v !== null ? v : fallback; }
    catch (e) { return fallback; }
}

export function lsSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) {}
}

export function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
}