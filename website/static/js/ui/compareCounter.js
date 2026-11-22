'use strict';
import { lsGetCompareItems } from '../core/compareStore.js';

export function updateCompareButtonCounter() {
    const btn = document.getElementById('btn-compare');
    if (!btn) return;
    const count = lsGetCompareItems().length;
    btn.textContent = count > 0 ? `Сравнение НП (${count})` : 'Сравнение НП';
}