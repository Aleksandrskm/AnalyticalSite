'use strict';
import { state } from '../../core/state.js';

export function openResModal(data, settlementId) {
    const old = document.getElementById('res-modal'); if (old) old.remove();
    const modal = document.createElement('div'); modal.id = 'res-modal'; modal.className = 'res-modal-overlay';
    const content = document.createElement('div'); content.className = 'res-modal-content';

    const title = document.createElement('h3');
    title.textContent = `БС для НП: ${state.selectedSettlementName || settlementId}`;
    title.className = 'res-modal-title';

    const closeBtn = document.createElement('button'); closeBtn.textContent = 'Закрыть'; closeBtn.className = 'res-modal-close-btn';
    closeBtn.addEventListener('click', () => modal.remove());

    const tw = document.createElement('div'); tw.className = 'res-table-wrapper';
    const table = document.createElement('table'); table.className = 'res-modal-table';
    const thead = document.createElement('thead'); table.appendChild(thead);
    const tbody = document.createElement('tbody'); table.appendChild(tbody);

    const count = document.createElement('div'); count.className = 'res-modal-count';
    count.textContent = `Всего БС: ${data.length}`;

    content.append(title, tw, count, closeBtn);
    tw.appendChild(table);
    modal.appendChild(content);
    document.body.appendChild(modal);

    let sf = null, so = 'asc';
    let current = [...data];

    const fmtDate = d => {
        if (!d) return '-';
        try { const dt = new Date(d); if (isNaN(dt.getTime())) return d; return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
        catch { return d || '-'; }
    };
    const fmtCoord = c => c ? c.trim() : '-';

    function render(items) {
        thead.innerHTML = ''; tbody.innerHTML = '';
        if (!items?.length) {
            const r = document.createElement('tr');
            const c = document.createElement('td'); c.colSpan = 18; c.textContent = 'Нет БС для отображения'; c.className = 'empty-message res-empty-cell';
            r.appendChild(c); tbody.appendChild(r); return;
        }
        const headers = [
            { k: 'id', l: 'ID' }, { k: 'type_id', l: 'Тип ID' }, { k: 'kind_id', l: 'Вид ID' }, { k: 'name', l: 'Название' },
            { k: 'number', l: 'Заводской номер' }, { k: 'network_name', l: 'Сеть связи' }, { k: 'operator', l: 'Оператор' },
            { k: 'location', l: 'Местоположение' }, { k: 'region_id', l: 'Регион ID' }, { k: 'lat_str', l: 'Широта' },
            { k: 'lon_str', l: 'Долгота' }, { k: 'is_active', l: 'Признак действия' }, { k: 'certificate_number', l: 'Номер свидетельства' },
            { k: 'certificate_start_date', l: 'Дата свидетельства' }, { k: 'certificate_end_date', l: 'Окончание свидетельства' },
            { k: 'permission_number', l: 'Номер разрешения' }, { k: 'permission_start_date', l: 'Дата разрешения' }, { k: 'permission_end_date', l: 'Окончание разрешения' }
        ];
        const hr = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th'); th.textContent = h.l; th.className = 'res-modal-th';
            const ic = document.createElement('span'); ic.className = 'sort-icon';
            ic.textContent = sf === h.k ? (so === 'asc' ? '▲' : '▼') : '▲';
            th.appendChild(ic);
            th.addEventListener('click', () => {
                if (sf === h.k) so = so === 'asc' ? 'desc' : 'asc';
                else { sf = h.k; so = 'asc'; }
                sortAndRender();
            });
            hr.appendChild(th);
        });
        thead.appendChild(hr);

        items.forEach(it => {
            const r = document.createElement('tr');
            const cells = [
                it.id || '-', it.type_id || '-', it.kind_id || '-', it.name || '-', it.number || '-',
                it.network_name || '-', it.operator || '-', it.location || '-', it.region_id || '-',
                fmtCoord(it.lat_str), fmtCoord(it.lon_str), it.is_active || '-', it.certificate_number || '-',
                fmtDate(it.certificate_start_date), fmtDate(it.certificate_end_date),
                it.permission_number || '-', fmtDate(it.permission_start_date), fmtDate(it.permission_end_date)
            ];
            cells.forEach(v => { const td = document.createElement('td'); td.textContent = v; td.className = 'res-modal-td'; if (v && v !== '-') td.title = v; r.appendChild(td); });

            const now = new Date();
            let expired = false;
            if (it.permission_end_date) {
                try { const e = new Date(it.permission_end_date); if (!isNaN(e.getTime()) && e < now) { expired = true; r.classList.add('res-modal-tr--expired-permission'); } } catch {}
            }
            if (it.certificate_end_date && !expired) {
                try { const e = new Date(it.certificate_end_date); if (!isNaN(e.getTime()) && e < now) r.classList.add('res-modal-tr--expired-certificate'); } catch {}
            }
            r.addEventListener('dblclick', () => showDetails(it));
            tbody.appendChild(r);
        });
    }

    function sortAndRender() {
        if (!sf) { render(current); return; }
        const s = [...current].sort((a, b) => {
            let va = a[sf] || '', vb = b[sf] || '';
            if (sf.includes('_date')) { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0; }
            if (sf === 'id' || sf === 'kind_id' || sf === 'type_id') { va = parseInt(va) || 0; vb = parseInt(vb) || 0; }
            if (typeof va === 'string') { va = va.toLowerCase().trim(); vb = (vb || '').toLowerCase().trim(); }
            if (va < vb) return so === 'asc' ? -1 : 1;
            if (va > vb) return so === 'asc' ? 1 : -1;
            return 0;
        });
        render(s);
    }

    function showDetails(it) {
        const oldD = document.getElementById('res-details-modal'); if (oldD) oldD.remove();
        const m = document.createElement('div'); m.id = 'res-details-modal'; m.className = 'res-modal-overlay';
        const c = document.createElement('div'); c.className = 'res-modal-content'; c.style.maxWidth = '600px';
        const t = document.createElement('h3'); t.textContent = `БС #${it.id || 'Н/Д'}`; t.className = 'res-modal-title';
        const d = document.createElement('div'); d.className = 'res-details';
        const fields = [
            { k: 'id', l: 'ID' }, { k: 'type_id', l: 'Тип ID' }, { k: 'kind_id', l: 'Вид ID' }, { k: 'name', l: 'Название' },
            { k: 'number', l: 'Заводской номер' }, { k: 'network_name', l: 'Сеть связи' }, { k: 'operator', l: 'Оператор' },
            { k: 'location', l: 'Местоположение' }, { k: 'region_id', l: 'Регион ID' }, { k: 'lat_str', l: 'Широта' },
            { k: 'lon_str', l: 'Долгота' }, { k: 'is_active', l: 'Признак действия' }, { k: 'certificate_number', l: 'Номер свидетельства' },
            { k: 'certificate_start_date', l: 'Дата свидетельства' }, { k: 'certificate_end_date', l: 'Окончание свидетельства' },
            { k: 'permission_number', l: 'Номер разрешения' }, { k: 'permission_start_date', l: 'Дата разрешения' }, { k: 'permission_end_date', l: 'Окончание разрешения' }
        ];
        fields.forEach(f => {
            const row = document.createElement('div'); row.className = 'res-details__row';
            const lb = document.createElement('div'); lb.className = 'res-details__label'; lb.textContent = f.l + ':';
            let v = it[f.k];
            if (f.k.includes('_date')) v = fmtDate(v); else v = v || '-';
            const ve = document.createElement('div'); ve.className = 'res-details__value'; ve.textContent = v;
            row.append(lb, ve); d.appendChild(row);
        });
        const cb = document.createElement('button'); cb.textContent = 'Закрыть'; cb.className = 'res-modal-close-btn';
        cb.addEventListener('click', () => m.remove());
        c.append(t, d, cb); m.appendChild(c); document.body.appendChild(m);
        m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    }

    render(current);
}