'use strict';
import { Loader } from '../Loader.js';

// ⚠️ Циклические импорты — работают, потому что функции вызываются
// только после полной загрузки модулей (по клику / в DOMContentLoaded).
import { hideSettlementButtons } from '../buttons/resButtons.js';
import { hideCalculateAllButton, hideCalculateSelectedButton } from '../buttons/calculateButtons.js';
import { resetAndHideSelectedSettlement } from './selectedSettlement.js';
import { destroyChart } from './chartView.js';
import { destroyAnalyticsDashboard } from './analyticsView.js';

let loader = null;
export function initLoader() {
    if (!loader) loader = new Loader('.loader-container');
    return loader;
}

export function removeEl(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

export function removeSelector(sel) {
    const el = document.querySelector(sel);
    if (el) el.remove();
}

export function renderPopup(message, isError = false) {
    const popup = document.querySelector('#dialog-res');
    if (!popup) return;

    // Защита от «dialog already open»
    if (popup.open) { try { popup.close(); } catch (e) {} }

    popup.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'dialog-div';
    const p = document.createElement('p');
    p.innerHTML = message;
    p.style.color = isError ? 'red' : 'green';
    div.append(p);
    popup.prepend(div);
    popup.classList.add('popup');
    popup.showModal();
    setTimeout(() => {
        popup.classList.remove('popup');
        try { popup.close(); } catch (e) {}
    }, 3000);
}

export function showRegionWarning() {
    let popup = document.getElementById('dialog-res');
    if (!popup) {
        popup = document.createElement('dialog');
        popup.id = 'dialog-res';
        document.body.appendChild(popup);
    }
    if (popup._regionWarningTimer) {
        clearTimeout(popup._regionWarningTimer);
        popup._regionWarningTimer = null;
    }
    if (popup.open) { try { popup.close(); } catch (e) {} }

    popup.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'dialog-div';
    div.style.cssText = 'padding:16px 24px;text-align:center;min-width:260px';
    const p = document.createElement('p');
    p.textContent = 'Необходимо выбрать хотя бы один регион';
    p.style.cssText = 'color:red;font-weight:600;margin:0;font-size:16px';
    div.appendChild(p);
    popup.appendChild(div);
    popup.classList.add('popup');
    popup.showModal();
    popup._regionWarningTimer = setTimeout(() => {
        popup.classList.remove('popup');
        try { popup.close(); } catch (e) {}
        popup._regionWarningTimer = null;
    }, 3000);
}

export function showResPageSize() {
    const el = document.getElementById('res-page-size');
    if (el) el.style.display = 'flex';
}

export function hideResPageSize() {
    const el = document.getElementById('res-page-size');
    if (el) el.style.display = 'none';
}

export function hideAutoRating() {
    const el = document.querySelector('.form__rating .checkbox-container');
    if (el) el.style.display = 'none';
}

export function hidePlaceholder() {
    const el = document.getElementById('placeholder-message');
    if (el) el.style.display = 'none';
}

/**
 * Показывает плейсхолдер и полностью сбрасывает UI:
 * скрывает таблицу/график/аналитику/сравнение, очищает фильтры,
 * снимает выделение НП, уничтожает Chart.js-инстансы.
 */
export function showPlaceholder() {
    const placeholder = document.getElementById('placeholder-message');
    const table       = document.getElementById('settlements-table');
    const pagination  = document.getElementById('settlements-pagination');
    const divider     = document.getElementById('table-divider');
    const chartCont   = document.getElementById('chart-container');

    if (placeholder) placeholder.style.display = 'flex';
    if (table)       table.style.display = 'none';
    if (pagination)  { pagination.style.display = 'none'; pagination.innerHTML = ''; }
    if (divider)     divider.style.display = 'none';
    if (chartCont)   chartCont.style.display = 'none';

    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();
    resetAndHideSelectedSettlement();

    document.querySelector('.filter-container')?.remove();
    document.querySelector('.settlements-title')?.remove();

    destroyChart();
    destroyAnalyticsDashboard();
}