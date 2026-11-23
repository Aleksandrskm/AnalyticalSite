'use strict';
import { getRegions, getResKinds } from '../db.js';
import { state } from '../core/state.js';
import { LS_KEYS, DEFAULT_REGION, lsGet, lsSet } from '../core/storage.js';
import { allowedResKinds } from '../core/constants.js';
import { initLoader } from '../ui/common.js';
import { persistSelectedRegions } from '../ui/form.js';

export async function loadRegions() {
    const loader = initLoader();
    loader.show('Загрузка регионов...');
    try {
        const regions = await getRegions();
        const select = document.getElementById('region');
        if (!select) return [];
        select.innerHTML = '';

        const allOpt = document.createElement('option');
        allOpt.value = 'all'; allOpt.textContent = 'Все регионы';
        select.appendChild(allOpt);

        regions.forEach(r => {
            const o = document.createElement('option');
            o.value = String(r.number).trim();
            o.textContent = r.name;
            select.appendChild(o);
        });

        const url = new URLSearchParams(window.location.search);
        const regionsParam = url.get('regions');
        const idNpParam    = url.get('id_np');

        let regionIds = null;
        if (regionsParam) {
            regionIds = regionsParam.split(',').map(s => s.trim()).filter(Boolean);
            lsSet(LS_KEYS.regions, regionsParam);
        } else {
            const stored = lsGet(LS_KEYS.regions, DEFAULT_REGION);
            regionIds = stored ? String(stored).split(',').map(s => s.trim()).filter(Boolean) : [DEFAULT_REGION];
        }
        if (idNpParam) lsSet(LS_KEYS.idNp, idNpParam);

        const opts = select.querySelectorAll('option');
        opts.forEach(o => { o.selected = false; });
        let found = 0;
        opts.forEach(o => {
            if (o.value === 'all') return;
            if (regionIds.includes(String(o.value).trim())) { o.selected = true; found++; }
        });
        if (found === 0) {
            opts.forEach(o => {
                if (String(o.value).trim() === DEFAULT_REGION) { o.selected = true; found++; }
            });
        }
        if (found === 0) {
            const allO = select.querySelector('option[value="all"]');
            if (allO) allO.selected = true;
        }
        persistSelectedRegions();
        loader.close();
        return regions;
    } catch (e) {
        loader.close();
        console.error('Ошибка загрузки регионов:', e);
        return [];
    }
}

export async function loadResKindsSelect() {
    const loader = initLoader();
    loader.show('Загрузка видов связи...');
    try {
        const data = await getResKinds();
        const kinds = (data.kinds || []).filter(k => allowedResKinds.includes(parseInt(k.id)));
        kinds.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const sel = document.getElementById('type-connect');
        if (!sel) return;
        sel.innerHTML = '';

        const allOpt = document.createElement('option');
        allOpt.value = 'all'; allOpt.textContent = 'Все виды связи';
        sel.appendChild(allOpt);

        kinds.forEach(k => {
            const o = document.createElement('option');
            o.value = k.id; o.textContent = k.name;
            sel.appendChild(o);
        });
        loader.close();
        return kinds;
    } catch (e) {
        loader.close();
        console.error('Ошибка загрузки видов связи:', e);
        return [];
    }
}