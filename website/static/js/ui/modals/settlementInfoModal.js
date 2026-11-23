'use strict';
import { state } from '../../core/state.js';
import { addToCompare, removeFromCompare, isInCompare, lsGetCompareItems } from '../../core/compareStore.js';
import { DETAIL_URL_BASE } from '../../core/constants.js';
import { loadTableStructures } from '../../services/settlementsService.js';
import { buildRatingGroups } from '../../core/ratingGroups.js';
import { updateCompareButtonCounter } from '../compareCounter.js';

export function createCompareCheckboxRow(settlementId) {
    const idStr = String(settlementId).trim();
    const already = isInCompare(idStr);
    const wrap = document.createElement('div');
    wrap.className = 'compare-checkbox-wrap';
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;margin:10px 0;background:#eef4ff;border:1.5px solid #4a90e2;border-radius:8px';

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.id = `compare-cb-${idStr}`; cb.checked = already;
    cb.style.cssText = 'width:18px;height:18px;cursor:pointer';

    const label = document.createElement('label'); label.htmlFor = cb.id;
    const setText = on => { label.textContent = on ? 'Добавлено в сравнение (снять галочку, чтобы убрать)' : 'Добавить в сравнение'; };
    setText(already);
    label.style.cssText = 'cursor:pointer;font-weight:600;font-size:14px;color:black';

    cb.addEventListener('change', function () {
        if (this.checked) {
            const r = addToCompare(settlementId);
            if (r.ok || r.reason === 'already') setText(true);
            else { this.checked = false; setText(false); }
        } else {
            removeFromCompare(settlementId);
            setText(false);
        }
        updateCompareButtonCounter();
    });

    wrap.append(cb, label);
    return wrap;
}

export async function openSettlementInfoModal(item) {
    if (!item || item.id === undefined) return;
    await loadTableStructures();

    const settlement = state.settlementsData.items.find(it => String(it.id) === String(item.id)) || item;
    const rating = state.allRatings[String(item.id)] || {};
    const rated = state.settlementsData.items
        .map(it => ({ id: it.id, rating: (state.allRatings[String(it.id)] && state.allRatings[String(it.id)].rating) || 0 }))
        .sort((a, b) => b.rating - a.rating);
    let place = '—';
    const fi = rated.findIndex(r => String(r.id) === String(item.id));
    if (fi !== -1) place = fi + 1;
    const total = rated.length;

    const old = document.getElementById('settlement-info-modal'); if (old) old.remove();
    const modal = document.createElement('div'); modal.id = 'settlement-info-modal'; modal.className = 'res-modal-overlay';
    const content = document.createElement('div'); content.className = 'res-modal-content'; content.style.maxWidth = '800px';

    const title = document.createElement('h3');
    title.textContent = `НП: ${settlement.name || settlement.NAME || item.id}`;
    title.className = 'res-modal-title';

    const badge = document.createElement('div');
    const rv = rating.rating != null ? Number(rating.rating).toFixed(2) : 'не рассчитан';
    badge.textContent = `Обеспеченность: ${rv}`;
    badge.style.cssText = 'display:inline-block;padding:6px 14px;margin-bottom:12px;border-radius:6px;font-size:15px;font-weight:700;color:#fff;background:#4a90e2';

    const tw = document.createElement('div'); tw.className = 'res-table-wrapper';
    tw.style.cssText = 'max-height:60vh;overflow-y:auto;position:relative';
    const table = document.createElement('table'); table.className = 'res-modal-table';
    table.style.cssText = 'width:100%;border-collapse:separate;border-spacing:0';
    const tbody = document.createElement('tbody'); table.appendChild(tbody);

    const addSection = s => {
        const tr = document.createElement('tr');
        const th = document.createElement('th'); th.colSpan = 2; th.textContent = s;
        th.style.cssText = 'text-align:left;padding:8px 12px;background:#4a90e2;color:#fff;font-weight:700;border:1px solid #000;font-size:14px;position:sticky;top:0;z-index:2';
        tr.appendChild(th); tbody.appendChild(tr);
    };
    const addRow = (l, v) => {
        if (v === undefined || v === null || v === '') v = '-';
        const tr = document.createElement('tr');
        const th = document.createElement('th'); th.textContent = l;
        th.style.cssText = 'text-align:left;padding:6px 12px;border:1px solid #000;background:#f2f2f2;width:45%;font-weight:600;color:black;font-size:14px;position:static';
        const td = document.createElement('td'); td.textContent = v;
        td.style.cssText = 'padding:6px 12px;border:1px solid #000;font-size:14px;color:#2a2a2a;background:#fff;font-weight:600;position:static';
        tr.append(th, td); tbody.appendChild(tr);
    };

    addSection('Населённый пункт');
    addRow('ID', settlement.id);
    addRow('Название', settlement.name);
    addRow('Регион', settlement.region_name);
    addRow('Код региона', settlement.region_code);
    addRow('Муниципальное образование', settlement.district_name);
    addRow('Население', settlement.population);
    addRow('Площадь (км²)', settlement.area);
    addRow('Широта', settlement.lat);
    addRow('Долгота', settlement.lon);
    addRow('Код ФИАС', settlement.fias_id);

    addSection('Обеспеченность');
    addRow('Обеспеченность', rating.rating);
    addRow('Место в обеспеченности', `${place} из ${total}`);

    buildRatingGroups().forEach(g => {
        addSection(g.title);
        g.fields.forEach(f => addRow(f.label, rating[f.key]));
    });

    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:15px;display:flex;flex-direction:column;gap:10px';
    footer.appendChild(createCompareCheckboxRow(item.id));

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap';
    const db = document.createElement('button'); db.textContent = 'Детализация обеспеченности НП';
    db.className = 'res-modal-close-btn';
    db.style.cssText = 'background:#0066ff;color:#fff;border:1.5px solid #0044cc';
    db.addEventListener('click', () => {
        const id = item.id ?? null; if (!id) return;
        window.open(`${DETAIL_URL_BASE}${encodeURIComponent(id)}`, '_blank');
    });
    const cb = document.createElement('button'); cb.textContent = 'Закрыть'; cb.className = 'res-modal-close-btn';
    cb.addEventListener('click', () => modal.remove());
    bar.append(db, cb); footer.appendChild(bar);

    content.append(title, badge, tw);
    tw.appendChild(table);
    content.appendChild(footer);
    modal.appendChild(content);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}