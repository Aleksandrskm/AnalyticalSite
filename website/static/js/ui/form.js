'use strict';
import { LS_KEYS, DEFAULT_REGION, lsGet, lsSet } from '../core/storage.js';

export function getSelectedRegions() {
    const sel = document.getElementById('region');
    if (!sel) return [];
    const values = [];
    for (const opt of sel.selectedOptions) {
        const val = String(opt.value).trim();
        if (val === 'all') {
            return Array.from(sel.querySelectorAll('option'))
                .map(o => String(o.value).trim())
                .filter(v => v && v !== 'all');
        }
        if (val) values.push(val);
    }
    return values;
}

export function getSelectedKinds() {
    const sel = document.getElementById('type-connect');
    if (!sel) return [];
    if (sel.value === 'all') {
        return Array.from(sel.querySelectorAll('option')).map(o => o.value).filter(v => v !== 'all');
    }
    return [sel.value];
}

export function getPopulationRange() {
    const radioAll   = document.getElementById('number-settlements');
    const radioRange = document.getElementById('number-settlement');
    if (radioAll && radioAll.checked) return null;
    if (radioRange && radioRange.checked) {
        return {
            from: parseInt(document.getElementById('numbers-settlement')?.value) || 1,
            to:   parseInt(document.getElementById('numbers-settlements')?.value) || 17000000
        };
    }
    return null;
}

export function persistSelectedRegions() {
    const regions = getSelectedRegions();
    lsSet(LS_KEYS.regions, regions.length ? regions.join(',') : DEFAULT_REGION);
}

export function applyRegionsFromStorage() {
    const sel = document.getElementById('region');
    if (!sel) return false;
    const real = Array.from(sel.querySelectorAll('option'))
        .filter(o => o.value !== 'all' && String(o.value).trim() !== '');
    if (!real.length) return false;

    const stored = lsGet(LS_KEYS.regions, DEFAULT_REGION);
    if (!stored) return false;
    let ids = String(stored).split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) ids = [DEFAULT_REGION];

    const options = sel.querySelectorAll('option');
    options.forEach(o => { o.selected = false; });
    let found = 0;
    options.forEach(o => {
        if (o.value === 'all') return;
        if (ids.includes(String(o.value).trim())) { o.selected = true; found++; }
    });
    if (!found) {
        options.forEach(o => { if (String(o.value).trim() === DEFAULT_REGION) { o.selected = true; found++; } });
    }
    return found > 0;
}