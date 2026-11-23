'use strict';
import { state } from '../../core/state.js';

export function createProgressModal(total) {
    const old = document.getElementById('rating-progress-modal'); if (old) old.remove();
    const m = document.createElement('div'); m.id = 'rating-progress-modal'; m.className = 'progress-modal-overlay';
    const c = document.createElement('div'); c.className = 'progress-modal-content';
    const t = document.createElement('h3'); t.textContent = 'Расчет обеспеченности НП'; t.className = 'progress-modal-title';

    const pi = document.createElement('div'); pi.className = 'progress-info'; pi.id = 'rating-progress-info';
    pi.textContent = `Обработано: 0 / ${total}`;

    const pbw = document.createElement('div'); pbw.className = 'progress-bar-wrap';
    const pf = document.createElement('div'); pf.id = 'rating-progress-fill'; pf.className = 'progress-bar-fill';
    pbw.appendChild(pf);

    const si = document.createElement('div'); si.className = 'status-info'; si.id = 'rating-status-info';
    si.textContent = 'Получено обеспеченности: 0';

    const cb = document.createElement('button'); cb.id = 'rating-cancel-btn'; cb.textContent = 'Отмена';
    cb.className = 'progress-cancel-btn';
    cb.addEventListener('click', () => {
        state.isCancelled = true;
        cb.textContent = 'Отменяется...'; cb.disabled = true; cb.className = 'progress-cancel-btn disabled';
    });

    c.append(t, pi, pbw, si, cb);
    m.appendChild(c);
    document.body.appendChild(m);
    return m;
}

export function updateProgress(current, total, successCount) {
    const fill = document.getElementById('rating-progress-fill');
    const info = document.getElementById('rating-progress-info');
    const status = document.getElementById('rating-status-info');
    if (fill) fill.style.width = Math.min(current / total * 100, 100) + '%';
    if (info) info.textContent = `Обработано: ${current} / ${total}`;
    if (status) status.textContent = `Получено обеспеченности: ${successCount}`;
}

export function closeProgressModal() {
    const m = document.getElementById('rating-progress-modal'); if (m) m.remove();
}