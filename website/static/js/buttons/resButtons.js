'use strict';
import { state } from '../core/state.js';

let resBtn = null;
let wiredBtn = null;

export function createResButton() {
    if (resBtn) resBtn.remove();
    resBtn = document.createElement('button');
    resBtn.id = 'res-action-btn';
    resBtn.className = 'grid-btn res-action-btn';
    resBtn.textContent = 'БС';
    resBtn.style.marginRight = '10px';
    resBtn.style.width = 'auto';
    resBtn.addEventListener('click', handleResButton);
    return resBtn;
}

export function createWiredButton() {
    if (wiredBtn) wiredBtn.remove();
    wiredBtn = document.createElement('button');
    wiredBtn.id = 'wired-action-btn';
    wiredBtn.className = 'grid-btn wired-action-btn';
    wiredBtn.textContent = 'Проводные УС';
    wiredBtn.style.width = 'auto';
    wiredBtn.addEventListener('click', handleWiredButton);
    return wiredBtn;
}

export function showSettlementButtons() {
    const container = document.querySelector('.table_buttons');
    if (!container) return;

    // 1. Убираем контролы формата графика (на случай, если они застряли)
    const formatGroup = document.getElementById('format-controls-group');
    if (formatGroup) formatGroup.remove();

    // 2. Если мы в режиме графика/аналитики/сравнения — прячем все кнопки таблицы
    if (state.isChartMode || state.isAnalyticsMode) {
        hideSettlementButtons();
        return;
    }

    // 3. Полностью очищаем динамические кнопки перед перерисовкой, чтобы не было дублей
    ['calculate-all-btn', 'calculate-selected-btn', 'res-action-btn', 'wired-action-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    // 4. Якорь: перед кнопкой "Печать" (или в конец контейнера)
    const printBtn = document.getElementById('print__btn');
    const anchor = printBtn || container.firstChild;

    // 5. Сначала обычные кнопки: БС → Проводные УС
    const resBtnEl = createResButton();
    const wiredBtnEl = createWiredButton();
    container.insertBefore(resBtnEl, anchor);
    container.insertBefore(wiredBtnEl, resBtnEl.nextSibling);

    // 6. Кнопки расчёта — ТОЛЬКО в режиме "Таблица обеспеченности НП" (showRatings === true).
    //    Вставляем их перед кнопкой "БС", чтобы расчёты шли первыми слева.
    if (state.showRatings) {
        const calcAllBtn = createCalculateAllBtn();
        const calcSelectedBtn = createCalculateSelectedBtn();
        container.insertBefore(calcAllBtn, resBtnEl);
        container.insertBefore(calcSelectedBtn, resBtnEl);

        // "Рассчитать выбранного НП" — только если реально выбран НП
        calcSelectedBtn.style.display = state.selectedSettlementId ? '' : 'none';
    }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function createCalculateAllBtn() {
    const btn = document.createElement('button');
    btn.id = 'calculate-all-btn';
    btn.className = 'grid-btn calculate-all-btn';
    btn.textContent = 'Рассчитать обеспеченность всех НП в таблице';
    btn.style.marginRight = '10px';
    btn.style.width = 'auto';
    btn.addEventListener('click', handleCalculateAll);
    return btn;
}

function createCalculateSelectedBtn() {
    const btn = document.createElement('button');
    btn.id = 'calculate-selected-btn';
    btn.className = 'grid-btn calculate-selected-btn';
    btn.textContent = 'Рассчитать обеспеченность выбранного НП';
    btn.style.marginRight = '10px';
    btn.style.width = 'auto';
    btn.addEventListener('click', handleCalculateSelected);
    return btn;
}

// ===== ЗАГЛУШКИ ДЛЯ ОБРАБОТЧИКОВ РАСЧЁТА =====
// Если у вас уже есть calculateButtons.js с реальной логикой — лучше
// делегировать туда, чтобы не было двух реализаций:
async function handleCalculateAll() {
    const m = await import('./calculateButtons.js');
    return m.handleCalculateAll();
}
async function handleCalculateSelected() {
    const m = await import('./calculateButtons.js');
    return m.handleCalculateSelected();
}

export function hideSettlementButtons() {
    ['res-action-btn', 'wired-action-btn', 'calculate-all-btn', 'calculate-selected-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}

async function handleResButton() {
    if (!state.selectedSettlementId) return;
    const { loadResForModal } = await import('../services/resService.js');
    loadResForModal(
        state.selectedSettlementId,
        state.selectedSettlementLat,
        state.selectedSettlementLon,
        state.selectedSettlementArea
    );
}

function handleWiredButton() {
    // заглушка, как в текущем проекте
}