// cityRatings.js
'use strict';

import { Loader } from './Loader.js';
import {
    getRegions,
    getResKinds,
    getSettlementsPage,
    getResPage,
    getRatingSett,
    postRatingSett
} from './db.js';

let loader = null;

// Данные для населенных пунктов
let settlementsData = {
    items: [],
    total: 0,
    page: 0,
    pageSize: 1
};

// Данные для РЭС (для модального окна)
let resData = {
    items: [],
    total: 0,
    page: 0,
    pageSize: 1
};

// Текущий выбранный НП
let selectedSettlementId = null;
let selectedSettlementLat = null;
let selectedSettlementLon = null;
let selectedSettlementArea = null;
let selectedSettlementName = null;

// Текущие фильтры
let currentRegions = [];
let currentKinds = [];
let currentPopRange = { from: 1, to: 17000000 };

// Флаг отмены массового расчёта
let isCancelled = false;

// Флаг: был ли запущен расчет (POST разрешен)
let isCalculateMode = false;

// Массив всех полученных рейтингов (ключ — id НП)
let allRatings = {};

// Переменные для сортировки в таблице
let currentSortField = null;
let currentSortOrder = 'asc';
let currentSettlementsFiltered = [];

// Переменные для фильтрации
let currentFilterField = '';
let currentFilterValue = '';
let currentFilterExact = false;

// Флаг: показывать ли рейтинги в таблице
let showRatings = false;

// Сохраненные значения фильтра для восстановления
let savedFilterField = '';
let savedFilterValue = '';
let savedFilterExact = false;

// Сохраняем исходные данные для фильтрации
let originalDataForFilter = [];
let originalTotalForFilter = 0;

function initLoader() {
    if (!loader) {
        loader = new Loader('.loader-container');
    }
    return loader;
}

function renderPopup(message, isError = false) {
    const popupElement = document.querySelector('#dialog-res');
    if (!popupElement) return;

    const div = document.createElement('div');
    const p = document.createElement('p');
    popupElement.innerHTML = '';
    p.innerHTML = message;
    if (isError) {
        p.style.color = 'red';
    } else {
        p.style.color = 'green';
    }
    div.append(p);
    div.classList.add('dialog-div');
    popupElement.prepend(div);
    popupElement.classList.add('popup');
    popupElement.showModal();
    setTimeout(() => {
        popupElement.classList.remove('popup');
        popupElement.close();
    }, 3000);
}

// Список ID видов РЭС из Excel файла для фильтрации (числовые значения)
const allowedResKinds = [
    7, 128, 56, 31, 68, 30, 65, 99, 72, 15, 106, 114, 85, 4, 18, 10,
    82, 86, 83, 94, 115, 104, 22, 8, 75, 1, 46, 91, 45, 11, 37, 129,
    21, 112, 103, 92
];

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function showResPageSize() {
    const el = document.getElementById('res-page-size');
    if (el) el.style.display = 'flex';
}

function hideResPageSize() {
    const el = document.getElementById('res-page-size');
    if (el) el.style.display = 'none';
}

function hideAutoRating() {
    const el = document.querySelector('.form__rating .checkbox-container');
    if (el) el.style.display = 'none';
}

// ==================== УПРАВЛЕНИЕ ПОДСКАЗКОЙ ====================

function showPlaceholder() {
    const placeholder = document.getElementById('placeholder-message');
    const table = document.getElementById('settlements-table');
    const pagination = document.getElementById('settlements-pagination');
    const divider = document.getElementById('table-divider');

    if (placeholder) placeholder.style.display = 'flex';
    if (table) table.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    if (divider) divider.style.display = 'none';
}

function hidePlaceholder() {
    const placeholder = document.getElementById('placeholder-message');
    const table = document.getElementById('settlements-table');
    const pagination = document.getElementById('settlements-pagination');
    const divider = document.getElementById('table-divider');

    if (placeholder) placeholder.style.display = 'none';
    if (table) table.style.display = 'block';
    if (pagination) pagination.style.display = 'flex';
    if (divider) divider.style.display = 'block';
}

// ==================== КНОПКИ ====================

// Кнопка "Рассчитать рейтинг всех НП в таблице"
function createCalculateAllBtn() {
    let existing = document.getElementById('calculate-all-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'calculate-all-btn';
    btn.className = 'grid-btn calculate-all-btn';
    btn.textContent = 'Рассчитать рейтинг всех НП в таблице';
    btn.style.marginRight = '10px';
    btn.style.width = 'auto';
    btn.addEventListener('click', handleCalculateAll);
    return btn;
}

function showCalculateAllButton() {
    const container = document.querySelector('.table_buttons');
    if (!container) return;

    if (!showRatings) {
        hideCalculateAllButton();
        return;
    }

    const resBtn = document.getElementById('res-action-btn');
    if (resBtn) resBtn.remove();
    const wiredBtn = document.getElementById('wired-action-btn');
    if (wiredBtn) wiredBtn.remove();

    let btn = document.getElementById('calculate-all-btn');
    if (!btn) {
        btn = createCalculateAllBtn();
        const firstBtn = container.querySelector('.grid-btn');
        if (firstBtn) {
            container.insertBefore(btn, firstBtn);
        } else {
            container.appendChild(btn);
        }
    }
}

function hideCalculateAllButton() {
    const btn = document.getElementById('calculate-all-btn');
    if (btn) btn.remove();
}

// Кнопка "Рассчитать рейтинг выбранного НП"
function createCalculateSelectedBtn() {
    let existing = document.getElementById('calculate-selected-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'calculate-selected-btn';
    btn.className = 'grid-btn calculate-selected-btn';
    btn.textContent = 'Рассчитать рейтинг выбранного НП';
    btn.style.marginRight = '10px';
    btn.style.width = 'auto';
    btn.addEventListener('click', handleCalculateSelected);
    return btn;
}

function showCalculateSelectedButton() {
    const container = document.querySelector('.table_buttons');
    if (!container) return;

    if (!showRatings || !selectedSettlementId) {
        hideCalculateSelectedButton();
        return;
    }

    const resBtn = document.getElementById('res-action-btn');
    if (resBtn) resBtn.remove();
    const wiredBtn = document.getElementById('wired-action-btn');
    if (wiredBtn) wiredBtn.remove();

    let btn = document.getElementById('calculate-selected-btn');
    if (!btn) {
        btn = createCalculateSelectedBtn();
        const firstBtn = container.querySelector('.grid-btn');
        if (firstBtn) {
            container.insertBefore(btn, firstBtn);
        } else {
            container.appendChild(btn);
        }
    }
}

function hideCalculateSelectedButton() {
    const btn = document.getElementById('calculate-selected-btn');
    if (btn) btn.remove();
}

// ==================== КНОПКИ РЭС И ПРОВОДНЫЕ УС ====================

function createResButton() {
    let existing = document.getElementById('res-action-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'res-action-btn';
    btn.className = 'grid-btn res-action-btn';
    btn.textContent = 'РЭС';
    btn.style.marginRight = '10px';
    btn.style.width = 'auto';
    btn.addEventListener('click', handleResButton);
    return btn;
}

function createWiredButton() {
    let existing = document.getElementById('wired-action-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'wired-action-btn';
    btn.className = 'grid-btn wired-action-btn';
    btn.textContent = 'Проводные УС';
    btn.style.width = 'auto';
    btn.addEventListener('click', handleWiredButton);
    return btn;
}

function showSettlementButtons() {
    const container = document.querySelector('.table_buttons');
    if (!container) return;

    if (showRatings) {
        const resBtn = document.getElementById('res-action-btn');
        if (resBtn) resBtn.remove();
        const wiredBtn = document.getElementById('wired-action-btn');
        if (wiredBtn) wiredBtn.remove();

        showCalculateAllButton();
        showCalculateSelectedButton();
        return;
    }

    const oldRes = document.getElementById('res-action-btn');
    if (oldRes) oldRes.remove();
    const oldWired = document.getElementById('wired-action-btn');
    if (oldWired) oldWired.remove();
    const oldCalcAll = document.getElementById('calculate-all-btn');
    if (oldCalcAll) oldCalcAll.remove();
    const oldCalcSelected = document.getElementById('calculate-selected-btn');
    if (oldCalcSelected) oldCalcSelected.remove();

    const resBtn = createResButton();
    const wiredBtn = createWiredButton();

    const firstBtn = container.querySelector('.grid-btn');
    if (firstBtn) {
        container.insertBefore(resBtn, firstBtn);
        container.insertBefore(wiredBtn, firstBtn);
    } else {
        container.appendChild(resBtn);
        container.appendChild(wiredBtn);
    }
}

function hideSettlementButtons() {
    const resBtn = document.getElementById('res-action-btn');
    if (resBtn) resBtn.remove();
    const wiredBtn = document.getElementById('wired-action-btn');
    if (wiredBtn) wiredBtn.remove();
    hideCalculateAllButton();
    hideCalculateSelectedButton();
}

// ==================== ЗАГРУЗКА РЕГИОНОВ И ВИДОВ СВЯЗИ ====================

async function loadRegions() {
    const loader = initLoader();
    loader.show('Загрузка регионов...');

    try {
        const regions = await getRegions();
        const select = document.getElementById('region');
        if (!select) return;

        select.innerHTML = '';

        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Все регионы';
        select.appendChild(allOption);

        regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region.number;
            option.textContent = region.name;
            select.appendChild(option);
        });

        loader.close();
        return regions;
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка загрузки регионов: ${error.message}`, true);
        console.error('Ошибка загрузки регионов:', error);
        return [];
    }
}

async function loadResKindsSelect() {
    const loader = initLoader();
    loader.show('Загрузка видов связи...');

    try {
        const data = await getResKinds();
        const kinds = data.kinds || [];

        const allowedKinds = kinds.filter(kind => {
            const idNum = parseInt(kind.id);
            return allowedResKinds.includes(idNum);
        });

        allowedKinds.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const select = document.getElementById('type-connect');
        if (!select) return;

        select.innerHTML = '';

        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Все виды связи';
        select.appendChild(allOption);

        allowedKinds.forEach(kind => {
            const option = document.createElement('option');
            option.value = kind.id;
            option.textContent = kind.name;
            select.appendChild(option);
        });

        loader.close();
        return allowedKinds;
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка загрузки видов связи: ${error.message}`, true);
        console.error('Ошибка загрузки видов связи:', error);
        return [];
    }
}

function getSelectedRegions() {
    const regionSelect = document.getElementById('region');
    if (!regionSelect) return [];

    const value = regionSelect.value;
    if (value === 'all') {
        const allIds = [];
        const options = regionSelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value !== 'all') {
                allIds.push(option.value);
            }
        });
        return allIds;
    }
    return [value];
}

function getSelectedKinds() {
    const kindSelect = document.getElementById('type-connect');
    if (!kindSelect) return [];

    const value = kindSelect.value;
    if (value === 'all') {
        const allIds = [];
        const options = kindSelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value !== 'all') {
                allIds.push(option.value);
            }
        });
        return allIds;
    }
    return [value];
}

function getPopulationRange() {
    const radioAll = document.getElementById('number-settlements');
    const radioRange = document.getElementById('number-settlement');
    const fromInput = document.getElementById('numbers-settlement');
    const toInput = document.getElementById('numbers-settlements');

    if (radioAll && radioAll.checked) {
        return { from: 1, to: 17000000 };
    }

    if (radioRange && radioRange.checked) {
        const from = parseInt(fromInput?.value) || 1;
        const to = parseInt(toInput?.value) || 17000000;
        return { from, to };
    }

    return { from: 1, to: 17000000 };
}

// ==================== РАСЧЕТ РАДИУСА ====================

function calculateRadius(area) {
    if (!area || area <= 0) return 1;
    const radius = Math.round(1.1 * Math.sqrt(area / Math.PI));
    return radius >= 1 ? radius : 1;
}

// ==================== ФУНКЦИИ СТРАНИЦ ====================

function getPageSize(tableType) {
    return 1;
}

function getPage() {
    return 0;
}

// ==================== ФИЛЬТРАЦИЯ ДАННЫХ ====================

function filterData(data, field, value, exactMatch = false) {
    if (!value || !field) return data;

    return data.filter(row => {
        const cellValue = row[field];
        if (cellValue === null || cellValue === undefined) return false;

        const strValue = String(cellValue);
        const strSearch = String(value);

        if (exactMatch) {
            return strValue.toLowerCase() === strSearch.toLowerCase();
        } else {
            return strValue.toLowerCase().includes(strSearch.toLowerCase());
        }
    });
}

function filterDataWithRatings(data, ratings, field, value, exactMatch = false) {
    if (!value || !field) return data;

    const ratingFields = [
        'count_res_tv', 'count_res_rv',
        'count_res_lte', 'count_res_gsm', 'count_res_5g',
        'count_res_wifi', 'count_res_tetra',
        'count_operators',
        'count_abonents_lte', 'population_percent_lte',
        'communication_coverage_lte', 'communication_coverage_percent_lte',
        'traffic_lte', 'traffic_percent_lte',
        'count_abonents_gsm', 'population_percent_gsm',
        'communication_coverage_gsm', 'communication_coverage_percent_gsm',
        'traffic_gsm', 'traffic_percent_gsm',
        'count_abonents_5g', 'population_percent_5g',
        'communication_coverage_5g', 'communication_coverage_percent_5g',
        'traffic_5g', 'traffic_percent_5g',
        'count_abonents_wifi', 'population_percent_wifi',
        'communication_coverage_wifi', 'communication_coverage_percent_wifi',
        'traffic_wifi', 'traffic_percent_wifi',
        'count_abonents_tetra', 'population_percent_tetra',
        'communication_coverage_tetra', 'communication_coverage_percent_tetra',
        'traffic_tetra', 'traffic_percent_tetra',
        'count_res_mobile', 'count_abonents_mobile',
        'population_percent_mobile', 'communication_coverage_mobile',
        'communication_coverage_percent_mobile', 'traffic_mobile',
        'traffic_percent_mobile'
    ];

    return data.filter(row => {
        let cellValue;

        if (ratingFields.includes(field)) {
            const rating = ratings[row.id] || {};
            cellValue = rating[field];
        } else {
            cellValue = row[field];
        }

        if (cellValue === null || cellValue === undefined) return false;

        const strValue = String(cellValue);
        const strSearch = String(value);

        if (exactMatch) {
            return strValue.toLowerCase() === strSearch.toLowerCase();
        } else {
            return strValue.toLowerCase().includes(strSearch.toLowerCase());
        }
    });
}

// ==================== ЗАГРУЗКА НАСЕЛЕННЫХ ПУНКТОВ ====================

async function loadSettlements(page = 0, regions, popRange, pageSize) {
    const loader = initLoader();
    loader.show('Загрузка населенных пунктов...');

    try {
        const body = {
            regions: regions,
            population_filters: [
                {
                    from: popRange.from,
                    to: popRange.to
                }
            ]
        };

        const result = await getSettlementsPage(page, pageSize, body);

        loader.close();

        if (result) {
            return {
                items: result.settlements || [],
                total: result.total || 0
            };
        }

        return { items: [], total: 0 };
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка загрузки населенных пунктов: ${error.message}`, true);
        console.error('Ошибка загрузки населенных пунктов:', error);
        return { items: [], total: 0 };
    }
}

// ==================== ЗАГРУЗКА РЕЙТИНГОВ С ВОЗМОЖНОСТЬЮ ОТМЕНЫ ====================

async function loadRatingsForSettlements(items, allowPost = false) {
    const total = items.length;
    if (total === 0) {
        renderPopup('Нет населенных пунктов для загрузки рейтингов', true);
        return;
    }

    const modal = createProgressModal(total);

    const titleEl = modal.querySelector('.progress-modal-title');
    if (titleEl) {
        titleEl.textContent = allowPost ? 'Расчет рейтингов' : 'Загрузка рейтингов';
    }

    isCancelled = false;

    let successCount = 0;
    let postCount = 0;
    let processed = 0;

    for (const settlement of items) {
        if (isCancelled) {
            closeProgressModal();
            renderPopup(
                allowPost
                    ? `Расчёт отменён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`
                    : `Загрузка отменена. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`,
                false
            );
            return;
        }

        try {
            if (!allRatings[settlement.id]) {
                let ratingData = null;
                let status200 = false;

                try {
                    ratingData = await getRatingSett(settlement.id);
                    if (ratingData !== null && ratingData !== undefined) {
                        allRatings[settlement.id] = ratingData;
                        successCount++;
                        status200 = true;
                        console.log(`▶ НП ${settlement.id}: рейтинг получен через GET`);
                    } else {
                        console.log(`▶ НП ${settlement.id}: GET вернул null`);
                    }
                } catch (err) {
                    console.warn(`▶ НП ${settlement.id}: ошибка GET`, err);
                }

                if (!status200 && allowPost) {
                    try {
                        console.log(`▶ НП ${settlement.id}: отправляем POST...`);
                        await postRatingSett(settlement.id);
                        ratingData = await getRatingSett(settlement.id);
                        if (ratingData !== null && ratingData !== undefined) {
                            allRatings[settlement.id] = ratingData;
                            successCount++;
                            postCount++;
                            console.log(`▶ НП ${settlement.id}: рейтинг создан через POST и получен через GET`);
                        }
                    } catch (postErr) {
                        console.warn(`▶ НП ${settlement.id}: ошибка POST`, postErr);
                    }
                }
            } else {
                console.log(`▶ НП ${settlement.id}: рейтинг уже есть в кеше`);
            }
        } catch (err) {
            console.warn(`▶ НП ${settlement.id}: ошибка обработки`, err);
        }

        processed++;
        updateProgress(processed, total, successCount);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    closeProgressModal();
    console.log(`▶ Загружено ${successCount} рейтингов (из них создано через POST: ${postCount})`);
}

// ==================== ОПТИМИЗИРОВАННАЯ СОРТИРОВКА ====================

function sortDataWithRatings(data, ratings, sortField, sortOrder) {
    if (!sortField || data.length === 0) return data;

    const ratingFields = [
        'count_res_tv', 'count_res_rv',
        'count_res_lte', 'count_res_gsm', 'count_res_5g',
        'count_res_wifi', 'count_res_tetra',
        'count_operators',
        'count_abonents_lte', 'population_percent_lte',
        'communication_coverage_lte', 'communication_coverage_percent_lte',
        'traffic_lte', 'traffic_percent_lte',
        'count_abonents_gsm', 'population_percent_gsm',
        'communication_coverage_gsm', 'communication_coverage_percent_gsm',
        'traffic_gsm', 'traffic_percent_gsm',
        'count_abonents_5g', 'population_percent_5g',
        'communication_coverage_5g', 'communication_coverage_percent_5g',
        'traffic_5g', 'traffic_percent_5g',
        'count_abonents_wifi', 'population_percent_wifi',
        'communication_coverage_wifi', 'communication_coverage_percent_wifi',
        'traffic_wifi', 'traffic_percent_wifi',
        'count_abonents_tetra', 'population_percent_tetra',
        'communication_coverage_tetra', 'communication_coverage_percent_tetra',
        'traffic_tetra', 'traffic_percent_tetra',
        'count_res_mobile', 'count_abonents_mobile',
        'population_percent_mobile', 'communication_coverage_mobile',
        'communication_coverage_percent_mobile', 'traffic_mobile',
        'traffic_percent_mobile'
    ];

    const isRatingField = ratingFields.includes(sortField);

    const cachedData = data.map(item => {
        let value;
        if (isRatingField) {
            const rating = ratings[item.id] || {};
            value = rating[sortField];
        } else {
            value = item[sortField];
        }

        if (value === undefined || value === null) {
            value = '';
        } else if (typeof value === 'string') {
            value = value.toLowerCase();
        }

        return {
            item: item,
            sortValue: value
        };
    });

    const sorted = cachedData.sort((a, b) => {
        const valA = a.sortValue;
        const valB = b.sortValue;

        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            if (sortOrder === 'asc') {
                return valA.localeCompare(valB);
            } else {
                return valB.localeCompare(valA);
            }
        }

        const strA = String(valA);
        const strB = String(valB);
        if (sortOrder === 'asc') {
            return strA.localeCompare(strB);
        } else {
            return strB.localeCompare(strA);
        }
    });

    return sorted.map(item => item.item);
}

// ==================== РАСЧЕТ РЕЙТИНГА ДЛЯ ВЫБРАННОГО НП ====================

async function handleCalculateSelected() {
    if (!selectedSettlementId) {
        renderPopup('Выберите населенный пункт в таблице', true);
        return;
    }

    const loader = initLoader();
    loader.show(`Расчет рейтинга для НП: ${selectedSettlementName || selectedSettlementId}...`);

    try {
        await postRatingSett(selectedSettlementId);
        const ratingData = await getRatingSett(selectedSettlementId);

        if (ratingData !== null && ratingData !== undefined) {
            allRatings[selectedSettlementId] = ratingData;

            const pageSize = getPageSize('settlements');
            const page = getPage();

            if (savedFilterField && savedFilterValue) {
                const filtered = filterDataWithRatings(originalDataForFilter, allRatings, savedFilterField, savedFilterValue, savedFilterExact);
                renderCombinedTable(filtered, filtered.length, page, pageSize, true);
            } else {
                renderCombinedTable(originalDataForFilter, originalTotalForFilter, page, pageSize, false);
            }

            renderPopup(`Рейтинг для НП "${selectedSettlementName || selectedSettlementId}" успешно рассчитан!`, false);
        } else {
            renderPopup(`Не удалось получить рейтинг для НП "${selectedSettlementName || selectedSettlementId}"`, true);
        }
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка расчета рейтинга: ${error.message}`, true);
        console.error('Ошибка расчета рейтинга:', error);
        return;
    }

    loader.close();
}

// ==================== РАСЧЕТ РЕЙТИНГА ВСЕХ НП В ТАБЛИЦЕ ====================

async function handleCalculateAll() {
    // Берем данные из currentSettlementsFiltered (отфильтрованные данные)
    const items = currentSettlementsFiltered || settlementsData.items || [];

    if (items.length === 0) {
        renderPopup('Нет населенных пунктов для расчета', true);
        return;
    }

    // Проверяем, есть ли активный фильтр
    const hasFilter = savedFilterField && savedFilterValue;
    let settlementsToCalculate = [];

    if (hasFilter) {
        // Если есть фильтр, используем отфильтрованные данные
        settlementsToCalculate = items.map(item => ({
            id: item.id,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            area: parseFloat(item.area) || 1
        }));
    } else {
        // Если фильтра нет, используем все данные
        settlementsToCalculate = items.map(item => ({
            id: item.id,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            area: parseFloat(item.area) || 1
        }));
    }

    const total = settlementsToCalculate.length;
    if (total === 0) {
        renderPopup('Нет населенных пунктов для расчёта', true);
        return;
    }

    // Показываем модалку с количеством
    renderPopup(`Начинаем расчет рейтингов для ${total} населенных пунктов...`, false);

    isCalculateMode = true;
    isCancelled = false;

    const modal = createProgressModal(total);

    let processed = 0;
    let successCount = 0;

    for (const settlement of settlementsToCalculate) {
        if (isCancelled) break;

        console.log(`▶ Обработка НП ID ${settlement.id}...`);

        try {
            let ratingData = null;
            let status200 = false;

            if (allRatings[settlement.id]) {
                console.log(`▶ НП ${settlement.id}: рейтинг уже есть в кеше`);
                processed++;
                successCount++;
                updateProgress(processed, total, successCount);
                continue;
            }

            try {
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                    console.log(`▶ НП ${settlement.id}: данные получены через GET`);
                } else {
                    console.log(`▶ НП ${settlement.id}: GET вернул null, пробуем POST`);
                }
            } catch (err) {
                console.warn(`▶ НП ${settlement.id}: GET ошибка`, err);
            }

            console.log(`▶ НП ${settlement.id}: отправляем POST...`);
            try {
                await postRatingSett(settlement.id);
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                    console.log(`▶ НП ${settlement.id}: данные получены после POST`);
                }
            } catch (postErr) {
                console.warn(`▶ НП ${settlement.id}: POST ошибка`, postErr);
            }

            if (status200 && ratingData) {
                allRatings[settlement.id] = ratingData;
                processed++;
                successCount++;
                console.log(`▶ НП ${settlement.id}: успешно обработан. Всего успешно: ${successCount}`);
            } else {
                console.warn(`▶ НП ${settlement.id}: не удалось получить данные, пропускаем`);
                processed++;
            }

            updateProgress(processed, total, successCount);
            await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
            console.error(`▶ НП ${settlement.id}: критическая ошибка`, error);
            processed++;
        }
    }

    closeProgressModal();

    if (isCancelled) {
        renderPopup(`Расчёт отменён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    } else {
        renderPopup(`Расчёт завершён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    }

    // Обновляем таблицу с новыми рейтингами
    const pageSize = getPageSize('settlements');
    const page = getPage();

    // Если есть активный фильтр, применяем его к данным с новыми рейтингами
    if (savedFilterField && savedFilterValue) {
        const filtered = filterDataWithRatings(originalDataForFilter, allRatings, savedFilterField, savedFilterValue, savedFilterExact);
        renderCombinedTable(filtered, filtered.length, page, pageSize, true);
    } else {
        renderCombinedTable(originalDataForFilter, originalTotalForFilter, page, pageSize, false);
    }
}

// ==================== ОБРАБОТЧИК ДВОЙНОГО КЛИКА ====================

function setupDoubleClickHandler() {
    const table = document.getElementById('settlements-table');
    if (table) {
        table.addEventListener('dblclick', function(e) {
            const row = e.target.closest('tr');
            if (!row) return;

            const headerCells = this.querySelectorAll('thead th');
            let hasRatingColumns = false;
            headerCells.forEach(th => {
                if (th.textContent.includes('РЭС') || th.textContent.includes('Количество РЭС')) {
                    hasRatingColumns = true;
                }
            });

            if (hasRatingColumns) return;

            const id = row.dataset.id;
            const lat = parseFloat(row.dataset.lat);
            const lon = parseFloat(row.dataset.lon);
            const area = parseFloat(row.dataset.area);
            const name = row.dataset.name;

            if (id && !isNaN(lat) && !isNaN(lon)) {
                document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
                    tr.classList.remove('selected');
                });
                row.classList.add('selected');

                selectedSettlementId = id;
                selectedSettlementLat = lat;
                selectedSettlementLon = lon;
                selectedSettlementArea = area || 1;
                selectedSettlementName = name || '';

                console.log('▶ Выбран НП (двойной клик):', selectedSettlementId, selectedSettlementName);

                const rowData = {};
                const cells = row.querySelectorAll('td');
                const headers = this.querySelectorAll('thead th');

                headers.forEach((th, index) => {
                    if (cells[index]) {
                        let key = th.textContent.trim();
                        key = key.replace(/[▲▼]/g, '').trim();
                        rowData[key] = cells[index].textContent.trim();
                    }
                });

                showRowDataModal(rowData, 'settlement');
            }
        });
    }

    document.addEventListener('dblclick', function(e) {
        const table = document.getElementById('settlements-table');
        if (!table) return;

        const headerCells = table.querySelectorAll('thead th');
        let hasRatingColumns = false;
        headerCells.forEach(th => {
            if (th.textContent.includes('РЭС') || th.textContent.includes('Количество РЭС')) {
                hasRatingColumns = true;
            }
        });

        if (!hasRatingColumns) return;

        const row = e.target.closest('#settlements-table tbody tr');
        if (!row) return;

        const rowData = {};
        const cells = row.querySelectorAll('td');
        const headers = table.querySelectorAll('thead th');

        headers.forEach((th, index) => {
            if (cells[index]) {
                let key = th.textContent.trim();
                key = key.replace(/[▲▼]/g, '').trim();
                rowData[key] = cells[index].textContent.trim();
            }
        });

        document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
            tr.classList.remove('selected');
        });
        row.classList.add('selected');

        console.log('▶ Выбрана строка рейтинга (двойной клик):', rowData);

        showRowDataModal(rowData, 'rating');
    });
}

// ==================== МОДАЛЬНОЕ ОКНО ДЛЯ ПОКАЗА ДАННЫХ СТРОКИ ====================

function showRowDataModal(data, type) {
    const existing = document.getElementById('row-data-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'row-data-modal';
    modal.className = 'res-modal-overlay';

    const content = document.createElement('div');
    content.className = 'res-modal-content';
    content.style.maxWidth = '700px';

    let titleText = 'Данные строки';
    if (type === 'settlement') {
        const name = data['Название'] || 'Н/Д';
        titleText = `Данные населенного пункта: ${name}`;
    } else if (type === 'rating') {
        const name = data['Название'] || 'Н/Д';
        titleText = `Данные рейтинга населенного пункта: ${name}`;
    }

    const title = document.createElement('h3');
    title.textContent = titleText;
    title.className = 'res-modal-title';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.className = 'res-modal-close-btn';
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'res-table-wrapper';
    tableWrapper.style.maxHeight = '70vh';

    const table = document.createElement('table');
    table.className = 'res-modal-table';
    table.style.width = '100%';

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    content.appendChild(title);
    content.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    Object.keys(data).forEach(key => {
        if (!key || key.trim() === '') return;

        const cleanKey = key.replace(/[▲▼]/g, '').trim();

        const row = document.createElement('tr');
        const th = document.createElement('th');
        th.textContent = cleanKey;
        th.style.cssText = 'text-align: left; padding: 8px 12px; border: 1px solid #ddd; background: #f2f2f2; width: 40%;';
        const td = document.createElement('td');
        td.textContent = data[key] || '-';
        td.style.cssText = 'padding: 8px 12px; border: 1px solid #ddd;';
        row.appendChild(th);
        row.appendChild(td);
        tbody.appendChild(row);
    });

    if (Object.keys(data).length === 0) {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 2;
        td.textContent = 'Нет данных для отображения';
        td.style.cssText = 'text-align: center; padding: 20px; border: 1px solid #ddd;';
        row.appendChild(td);
        tbody.appendChild(row);
    }
}

// ==================== ОТОБРАЖЕНИЕ ТАБЛИЦЫ (только НП) ====================

function renderSettlementsTableOnly(data, total, page, pageSize, keepFilter = false) {
    const table = document.getElementById('settlements-table');
    if (!table) return;

    hidePlaceholder();

    const oldSettlementsTitle = document.querySelector('.settlements-title');
    if (oldSettlementsTitle) oldSettlementsTitle.remove();

    const settlementsTitle = document.createElement('h3');
    settlementsTitle.className = 'settlements-title';
    settlementsTitle.textContent = 'Населенные пункты';
    table.parentNode.insertBefore(settlementsTitle, table);

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';

    if (!data || data.length === 0) {
        if (tbody) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 10;
            cell.textContent = 'Нет населенных пунктов для отображения';
            cell.className = 'empty-message';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        renderSettlementsPagination(total, page, pageSize);
        return;
    }

    currentSettlementsFiltered = data;

    const oldFilter = document.querySelector('.filter-container');
    if (oldFilter) oldFilter.remove();

    const tableContainer = document.querySelector('.table__rating');

    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'filter-field-group';
    const fieldLabel = document.createElement('label');
    fieldLabel.textContent = 'Поле для фильтрации';
    fieldLabel.className = 'filter-label';
    const fieldSelect = document.createElement('select');
    fieldSelect.className = 'filter-field-select';

    const optionNone = document.createElement('option');
    optionNone.value = '';
    optionNone.textContent = '-- Выберите поле --';
    fieldSelect.appendChild(optionNone);

    const labels = {
        'id': 'ID',
        'name': 'Название',
        'area': 'Площадь (км²)',
        'region_name': 'Регион',
        'region_code': 'Код региона',
        'district_name': 'Муниципальное образование',
        'lat': 'Широта',
        'lon': 'Долгота',
        'population': 'Население',
        'fias_id': 'Код ФИАС'
    };

    if (data && data.length > 0) {
        Object.keys(data[0]).forEach(key => {
            if (labels[key]) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = labels[key] || key;
                fieldSelect.appendChild(opt);
            }
        });
    }

    if (keepFilter && savedFilterField) {
        fieldSelect.value = savedFilterField;
    }

    fieldDiv.appendChild(fieldLabel);
    fieldDiv.appendChild(fieldSelect);
    filterContainer.appendChild(fieldDiv);

    const valueDiv = document.createElement('div');
    valueDiv.className = 'filter-value-group';
    const valueLabel = document.createElement('label');
    valueLabel.textContent = 'Значение';
    valueLabel.className = 'filter-label';
    const valueInput = document.createElement('input');
    valueInput.className = 'filter-value-input';
    valueInput.type = 'text';
    valueInput.placeholder = 'Введите значение...';

    if (keepFilter && savedFilterValue) {
        valueInput.value = savedFilterValue;
    }

    valueDiv.appendChild(valueLabel);
    valueDiv.appendChild(valueInput);
    filterContainer.appendChild(valueDiv);

    const exactDiv = document.createElement('div');
    exactDiv.className = 'filter-exact-group';
    const exactCheckbox = document.createElement('input');
    exactCheckbox.type = 'checkbox';
    exactCheckbox.className = 'filter-exact-checkbox';
    const exactLabel = document.createElement('label');
    exactLabel.textContent = 'Точное совпадение';
    exactDiv.appendChild(exactCheckbox);
    exactDiv.appendChild(exactLabel);
    filterContainer.appendChild(exactDiv);

    if (keepFilter && savedFilterExact) {
        exactCheckbox.checked = true;
    }

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'filter-buttons-group';
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Применить';
    applyBtn.className = 'filter-apply-btn';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Сбросить';
    resetBtn.className = 'filter-reset-btn';

    buttonsDiv.appendChild(applyBtn);
    buttonsDiv.appendChild(resetBtn);
    filterContainer.appendChild(buttonsDiv);

    applyBtn.addEventListener('click', () => {
        const field = fieldSelect.value;
        const value = valueInput.value;
        const exactMatch = exactCheckbox.checked;
        if (field && value) {
            savedFilterField = field;
            savedFilterValue = value;
            savedFilterExact = exactMatch;

            currentFilterField = field;
            currentFilterValue = value;
            currentFilterExact = exactMatch;

            const filtered = filterData(originalDataForFilter, field, value, exactMatch);
            renderSettlementsTableOnly(filtered, filtered.length, 1, pageSize, true);
        }
    });

    resetBtn.addEventListener('click', () => {
        savedFilterField = '';
        savedFilterValue = '';
        savedFilterExact = false;

        currentFilterField = '';
        currentFilterValue = '';
        currentFilterExact = false;

        const currentPage = settlementsData.page || 0;
        renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, currentPage, pageSize, false);
    });

    tableContainer.prepend(filterContainer);

    if (thead) {
        const headerRow = document.createElement('tr');
        const headers = [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Название' },
            { key: 'area', label: 'Площадь (км²)' },
            { key: 'region_name', label: 'Регион' },
            { key: 'region_code', label: 'Код региона' },
            { key: 'district_name', label: 'Муниципальное образование' },
            { key: 'lat', label: 'Широта' },
            { key: 'lon', label: 'Долгота' },
            { key: 'population', label: 'Население' },
            { key: 'fias_id', label: 'Код ФИАС' }
        ];

        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h.label;
            th.className = 'sortable-header';
            th.dataset.key = h.key;

            const icon = document.createElement('span');
            icon.className = 'sort-icon';
            if (currentSortField === h.key) {
                icon.textContent = currentSortOrder === 'asc' ? '▲' : '▼';
            } else {
                icon.textContent = '▲';
            }
            th.appendChild(icon);

            th.addEventListener('click', () => {
                if (currentSortField === h.key) {
                    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortField = h.key;
                    currentSortOrder = 'asc';
                }
                renderSettlementsTableOnly(data, total, page, pageSize, true);
            });

            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
    }

    let displayData = [...data];
    if (currentSortField) {
        displayData.sort((a, b) => {
            let valA = a[currentSortField] !== undefined ? a[currentSortField] : '';
            let valB = b[currentSortField] !== undefined ? b[currentSortField] : '';
            if (typeof valA === 'number' && typeof valB === 'number') {
                return currentSortOrder === 'asc' ? valA - valB : valB - valA;
            }
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            if (currentSortOrder === 'asc') {
                return valA.localeCompare(valB);
            } else {
                return valB.localeCompare(valA);
            }
        });
    }

    if (tbody) {
        displayData.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id;
            row.dataset.lat = item.lat;
            row.dataset.lon = item.lon;
            row.dataset.area = item.area || 1;
            row.dataset.name = item.name || '';
            row.className = 'clickable-row';

            const idCell = document.createElement('td');
            idCell.textContent = item.id;
            row.appendChild(idCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = item.name || '-';
            row.appendChild(nameCell);

            const areaCell = document.createElement('td');
            areaCell.textContent = item.area !== null && item.area !== undefined ? item.area : '-';
            row.appendChild(areaCell);

            const regionNameCell = document.createElement('td');
            regionNameCell.textContent = item.region_name || '-';
            row.appendChild(regionNameCell);

            const regionCodeCell = document.createElement('td');
            regionCodeCell.textContent = item.region_code || '-';
            row.appendChild(regionCodeCell);

            const districtCell = document.createElement('td');
            districtCell.textContent = item.district_name || '-';
            row.appendChild(districtCell);

            const latCell = document.createElement('td');
            latCell.textContent = item.lat !== undefined ? item.lat.toFixed(6) : '-';
            row.appendChild(latCell);

            const lonCell = document.createElement('td');
            lonCell.textContent = item.lon !== undefined ? item.lon.toFixed(6) : '-';
            row.appendChild(lonCell);

            const popCell = document.createElement('td');
            popCell.textContent = item.population || 0;
            row.appendChild(popCell);

            const fiasCell = document.createElement('td');
            fiasCell.textContent = item.fias_id || '-';
            row.appendChild(fiasCell);

            row.addEventListener('click', function() {
                document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
                    tr.classList.remove('selected');
                });
                this.classList.add('selected');

                selectedSettlementId = this.dataset.id;
                selectedSettlementLat = parseFloat(this.dataset.lat);
                selectedSettlementLon = parseFloat(this.dataset.lon);
                selectedSettlementArea = parseFloat(this.dataset.area);
                selectedSettlementName = this.dataset.name;

                console.log('▶ Выбран НП:', selectedSettlementId, selectedSettlementName);
                showResPageSize();
            });

            tbody.appendChild(row);
        });
    }

    renderSettlementsPagination(total, page, pageSize);

    if (data && data.length > 0) {
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
            firstRow.click();
        }
    }
}

// ==================== ОТОБРАЖЕНИЕ ОБЪЕДИНЁННОЙ ТАБЛИЦЫ (НП + рейтинги) ====================

function renderCombinedTable(data, total, page, pageSize, keepFilter = false) {
    const table = document.getElementById('settlements-table');
    if (!table) return;

    hidePlaceholder();

    const oldSettlementsTitle = document.querySelector('.settlements-title');
    if (oldSettlementsTitle) oldSettlementsTitle.remove();

    const settlementsTitle = document.createElement('h3');
    settlementsTitle.className = 'settlements-title';
    settlementsTitle.textContent = 'Рейтинг населенных пунктов';
    table.parentNode.insertBefore(settlementsTitle, table);

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';

    if (!data || data.length === 0) {
        if (tbody) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 57;
            cell.textContent = 'Нет населенных пунктов для отображения';
            cell.className = 'empty-message';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        renderSettlementsPagination(total, page, pageSize);
        return;
    }

    currentSettlementsFiltered = data;

    const oldFilter = document.querySelector('.filter-container');
    if (oldFilter) oldFilter.remove();

    const tableContainer = document.querySelector('.table__rating');

    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'filter-field-group';
    const fieldLabel = document.createElement('label');
    fieldLabel.textContent = 'Поле для фильтрации';
    fieldLabel.className = 'filter-label';
    const fieldSelect = document.createElement('select');
    fieldSelect.className = 'filter-field-select';

    const optionNone = document.createElement('option');
    optionNone.value = '';
    optionNone.textContent = '-- Выберите поле --';
    fieldSelect.appendChild(optionNone);

    const labels = {
        'id': 'ID',
        'name': 'Название',
        'area': 'Площадь (км²)',
        'region_name': 'Регион',
        'region_code': 'Код региона',
        'district_name': 'Муниципальное образование',
        'lat': 'Широта',
        'lon': 'Долгота',
        'population': 'Население',
        'fias_id': 'Код ФИАС',
        'count_res_tv': 'Количество РЭС ТВ',
        'count_res_rv': 'Количество РЭС РВ',
        'count_res_lte': 'Количество РЭС LTE',
        'count_res_gsm': 'Количество РЭС GSM',
        'count_res_5g': 'Количество РЭС 5G',
        'count_res_wifi': 'Количество РЭС Wi-Fi',
        'count_res_tetra': 'Количество РЭС Tetra',
        'count_operators': 'Количество РЭС',
        'count_abonents_lte': 'Количество абонентов LTE',
        'population_percent_lte': 'Процент охвата населения LTE',
        'communication_coverage_lte': 'Покрытие связи LTE',
        'communication_coverage_percent_lte': 'Процент покрытия связи LTE',
        'traffic_lte': 'Объем трафика LTE',
        'traffic_percent_lte': 'Процент трафика LTE',
        'count_abonents_gsm': 'Количество абонентов GSM',
        'population_percent_gsm': 'Процент охвата населения GSM',
        'communication_coverage_gsm': 'Покрытие связи GSM',
        'communication_coverage_percent_gsm': 'Процент покрытия связи GSM',
        'traffic_gsm': 'Объем трафика GSM',
        'traffic_percent_gsm': 'Процент трафика GSM',
        'count_abonents_5g': 'Количество абонентов 5G',
        'population_percent_5g': 'Процент охвата населения 5G',
        'communication_coverage_5g': 'Покрытие связи 5G',
        'communication_coverage_percent_5g': 'Процент покрытия связи 5G',
        'traffic_5g': 'Объем трафика 5G',
        'traffic_percent_5g': 'Процент трафика 5G',
        'count_abonents_wifi': 'Количество абонентов Wi-Fi',
        'population_percent_wifi': 'Процент охвата населения Wi-Fi',
        'communication_coverage_wifi': 'Покрытие связи Wi-Fi',
        'communication_coverage_percent_wifi': 'Процент покрытия связи Wi-Fi',
        'traffic_wifi': 'Объем трафика Wi-Fi',
        'traffic_percent_wifi': 'Процент трафика Wi-Fi',
        'count_abonents_tetra': 'Количество абонентов Tetra',
        'population_percent_tetra': 'Процент охвата населения Tetra',
        'communication_coverage_tetra': 'Покрытие связи Tetra',
        'communication_coverage_percent_tetra': 'Процент покрытия связи Tetra',
        'traffic_tetra': 'Объем трафика Tetra',
        'traffic_percent_tetra': 'Процент трафика Tetra',
        'count_res_mobile': 'Количество РЭС моб. связи',
        'count_abonents_mobile': 'Количество абонентов моб. связи',
        'population_percent_mobile': 'Процент охвата населения моб. связи',
        'communication_coverage_mobile': 'Покрытие моб. связи',
        'communication_coverage_percent_mobile': 'Процент покрытия моб. связи',
        'traffic_mobile': 'Объем трафика моб. связи',
        'traffic_percent_mobile': 'Процент трафика моб. связи'
    };

    const ratingFieldKeys = [
        'count_res_tv', 'count_res_rv',
        'count_res_lte', 'count_res_gsm', 'count_res_5g',
        'count_res_wifi', 'count_res_tetra',
        'count_operators',
        'count_abonents_lte', 'population_percent_lte',
        'communication_coverage_lte', 'communication_coverage_percent_lte',
        'traffic_lte', 'traffic_percent_lte',
        'count_abonents_gsm', 'population_percent_gsm',
        'communication_coverage_gsm', 'communication_coverage_percent_gsm',
        'traffic_gsm', 'traffic_percent_gsm',
        'count_abonents_5g', 'population_percent_5g',
        'communication_coverage_5g', 'communication_coverage_percent_5g',
        'traffic_5g', 'traffic_percent_5g',
        'count_abonents_wifi', 'population_percent_wifi',
        'communication_coverage_wifi', 'communication_coverage_percent_wifi',
        'traffic_wifi', 'traffic_percent_wifi',
        'count_abonents_tetra', 'population_percent_tetra',
        'communication_coverage_tetra', 'communication_coverage_percent_tetra',
        'traffic_tetra', 'traffic_percent_tetra',
        'count_res_mobile', 'count_abonents_mobile',
        'population_percent_mobile', 'communication_coverage_mobile',
        'communication_coverage_percent_mobile', 'traffic_mobile',
        'traffic_percent_mobile'
    ];

    Object.keys(data[0]).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = labels[key] || key;
        fieldSelect.appendChild(opt);
    });

    ratingFieldKeys.forEach(key => {
        if (!Object.keys(data[0]).includes(key)) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = labels[key] || key;
            fieldSelect.appendChild(opt);
        }
    });

    if (keepFilter && savedFilterField) {
        fieldSelect.value = savedFilterField;
    }

    fieldDiv.appendChild(fieldLabel);
    fieldDiv.appendChild(fieldSelect);
    filterContainer.appendChild(fieldDiv);

    const valueDiv = document.createElement('div');
    valueDiv.className = 'filter-value-group';
    const valueLabel = document.createElement('label');
    valueLabel.textContent = 'Значение';
    valueLabel.className = 'filter-label';
    const valueInput = document.createElement('input');
    valueInput.className = 'filter-value-input';
    valueInput.type = 'text';
    valueInput.placeholder = 'Введите значение...';

    if (keepFilter && savedFilterValue) {
        valueInput.value = savedFilterValue;
    }

    valueDiv.appendChild(valueLabel);
    valueDiv.appendChild(valueInput);
    filterContainer.appendChild(valueDiv);

    const exactDiv = document.createElement('div');
    exactDiv.className = 'filter-exact-group';
    const exactCheckbox = document.createElement('input');
    exactCheckbox.type = 'checkbox';
    exactCheckbox.className = 'filter-exact-checkbox';
    const exactLabel = document.createElement('label');
    exactLabel.textContent = 'Точное совпадение';
    exactDiv.appendChild(exactCheckbox);
    exactDiv.appendChild(exactLabel);
    filterContainer.appendChild(exactDiv);

    if (keepFilter && savedFilterExact) {
        exactCheckbox.checked = true;
    }

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'filter-buttons-group';
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Применить';
    applyBtn.className = 'filter-apply-btn';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Сбросить';
    resetBtn.className = 'filter-reset-btn';

    buttonsDiv.appendChild(applyBtn);
    buttonsDiv.appendChild(resetBtn);
    filterContainer.appendChild(buttonsDiv);

    applyBtn.addEventListener('click', () => {
        const field = fieldSelect.value;
        const value = valueInput.value;
        const exactMatch = exactCheckbox.checked;
        if (field && value) {
            savedFilterField = field;
            savedFilterValue = value;
            savedFilterExact = exactMatch;

            currentFilterField = field;
            currentFilterValue = value;
            currentFilterExact = exactMatch;

            const filtered = filterDataWithRatings(originalDataForFilter, allRatings, field, value, exactMatch);
            renderCombinedTable(filtered, filtered.length, 1, pageSize, true);
        }
    });

    resetBtn.addEventListener('click', () => {
        savedFilterField = '';
        savedFilterValue = '';
        savedFilterExact = false;

        currentFilterField = '';
        currentFilterValue = '';
        currentFilterExact = false;

        const currentPage = settlementsData.page || 0;
        renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentPage, pageSize, false);
    });

    tableContainer.prepend(filterContainer);

    if (thead) {
        const headerRow = document.createElement('tr');
        const headers = [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Название' },
            { key: 'area', label: 'Площадь (км²)' },
            { key: 'region_name', label: 'Регион' },
            { key: 'region_code', label: 'Код региона' },
            { key: 'district_name', label: 'Муниципальное образование' },
            { key: 'lat', label: 'Широта' },
            { key: 'lon', label: 'Долгота' },
            { key: 'population', label: 'Население' },
            { key: 'fias_id', label: 'Код ФИАС' },
            { key: 'count_res_tv', label: 'Количество РЭС ТВ' },
            { key: 'count_res_rv', label: 'Количество РЭС РВ' },
            { key: 'count_res_lte', label: 'Количество РЭС LTE' },
            { key: 'count_res_gsm', label: 'Количество РЭС GSM' },
            { key: 'count_res_5g', label: 'Количество РЭС 5G' },
            { key: 'count_res_wifi', label: 'Количество РЭС Wi-Fi' },
            { key: 'count_res_tetra', label: 'Количество РЭС Tetra' },
            { key: 'count_operators', label: 'Количество РЭС' },
            { key: 'count_abonents_lte', label: 'Количество абонентов LTE' },
            { key: 'population_percent_lte', label: 'Процент охвата населения LTE' },
            { key: 'communication_coverage_lte', label: 'Покрытие связи LTE' },
            { key: 'communication_coverage_percent_lte', label: 'Процент покрытия связи LTE' },
            { key: 'traffic_lte', label: 'Объем трафика LTE' },
            { key: 'traffic_percent_lte', label: 'Процент трафика LTE' },
            { key: 'count_abonents_gsm', label: 'Количество абонентов GSM' },
            { key: 'population_percent_gsm', label: 'Процент охвата населения GSM' },
            { key: 'communication_coverage_gsm', label: 'Покрытие связи GSM' },
            { key: 'communication_coverage_percent_gsm', label: 'Процент покрытия связи GSM' },
            { key: 'traffic_gsm', label: 'Объем трафика GSM' },
            { key: 'traffic_percent_gsm', label: 'Процент трафика GSM' },
            { key: 'count_abonents_5g', label: 'Количество абонентов 5G' },
            { key: 'population_percent_5g', label: 'Процент охвата населения 5G' },
            { key: 'communication_coverage_5g', label: 'Покрытие связи 5G' },
            { key: 'communication_coverage_percent_5g', label: 'Процент покрытия связи 5G' },
            { key: 'traffic_5g', label: 'Объем трафика 5G' },
            { key: 'traffic_percent_5g', label: 'Процент трафика 5G' },
            { key: 'count_abonents_wifi', label: 'Количество абонентов Wi-Fi' },
            { key: 'population_percent_wifi', label: 'Процент охвата населения Wi-Fi' },
            { key: 'communication_coverage_wifi', label: 'Покрытие связи Wi-Fi' },
            { key: 'communication_coverage_percent_wifi', label: 'Процент покрытия связи Wi-Fi' },
            { key: 'traffic_wifi', label: 'Объем трафика Wi-Fi' },
            { key: 'traffic_percent_wifi', label: 'Процент трафика Wi-Fi' },
            { key: 'count_abonents_tetra', label: 'Количество абонентов Tetra' },
            { key: 'population_percent_tetra', label: 'Процент охвата населения Tetra' },
            { key: 'communication_coverage_tetra', label: 'Покрытие связи Tetra' },
            { key: 'communication_coverage_percent_tetra', label: 'Процент покрытия связи Tetra' },
            { key: 'traffic_tetra', label: 'Объем трафика Tetra' },
            { key: 'traffic_percent_tetra', label: 'Процент трафика Tetra' },
            { key: 'count_res_mobile', label: 'Количество РЭС моб. связи' },
            { key: 'count_abonents_mobile', label: 'Количество абонентов моб. связи' },
            { key: 'population_percent_mobile', label: 'Процент охвата населения моб. связи' },
            { key: 'communication_coverage_mobile', label: 'Покрытие моб. связи' },
            { key: 'communication_coverage_percent_mobile', label: 'Процент покрытия моб. связи' },
            { key: 'traffic_mobile', label: 'Объем трафика моб. связи' },
            { key: 'traffic_percent_mobile', label: 'Процент трафика моб. связи' }
        ];

        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h.label;
            th.className = 'sortable-header';
            th.dataset.key = h.key;

            const icon = document.createElement('span');
            icon.className = 'sort-icon';
            if (currentSortField === h.key) {
                icon.textContent = currentSortOrder === 'asc' ? '▲' : '▼';
            } else {
                icon.textContent = '▲';
            }
            th.appendChild(icon);

            th.addEventListener('click', () => {
                if (currentSortField === h.key) {
                    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortField = h.key;
                    currentSortOrder = 'asc';
                }
                renderCombinedTable(data, total, page, pageSize, true);
            });

            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
    }

    // ===== ОПТИМИЗИРОВАННАЯ СОРТИРОВКА =====
    let displayData = [...data];
    if (currentSortField) {
        displayData = sortDataWithRatings(displayData, allRatings, currentSortField, currentSortOrder);
    }

    if (tbody) {
        displayData.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id;
            row.dataset.lat = item.lat;
            row.dataset.lon = item.lon;
            row.dataset.area = item.area || 1;
            row.dataset.name = item.name || '';
            row.className = 'clickable-row';

            const idCell = document.createElement('td');
            idCell.textContent = item.id;
            row.appendChild(idCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = item.name || '-';
            row.appendChild(nameCell);

            const areaCell = document.createElement('td');
            areaCell.textContent = item.area !== null && item.area !== undefined ? item.area : '-';
            row.appendChild(areaCell);

            const regionNameCell = document.createElement('td');
            regionNameCell.textContent = item.region_name || '-';
            row.appendChild(regionNameCell);

            const regionCodeCell = document.createElement('td');
            regionCodeCell.textContent = item.region_code || '-';
            row.appendChild(regionCodeCell);

            const districtCell = document.createElement('td');
            districtCell.textContent = item.district_name || '-';
            row.appendChild(districtCell);

            const latCell = document.createElement('td');
            latCell.textContent = item.lat !== undefined ? item.lat.toFixed(6) : '-';
            row.appendChild(latCell);

            const lonCell = document.createElement('td');
            lonCell.textContent = item.lon !== undefined ? item.lon.toFixed(6) : '-';
            row.appendChild(lonCell);

            const popCell = document.createElement('td');
            popCell.textContent = item.population || 0;
            row.appendChild(popCell);

            const fiasCell = document.createElement('td');
            fiasCell.textContent = item.fias_id || '-';
            row.appendChild(fiasCell);

            const rating = allRatings[item.id] || {};

            const countResTvCell = document.createElement('td');
            countResTvCell.textContent = rating.count_res_tv !== undefined ? rating.count_res_tv : '-';
            row.appendChild(countResTvCell);

            const countResRvCell = document.createElement('td');
            countResRvCell.textContent = rating.count_res_rv !== undefined ? rating.count_res_rv : '-';
            row.appendChild(countResRvCell);

            const countResLteCell = document.createElement('td');
            countResLteCell.textContent = rating.count_res_lte !== undefined ? rating.count_res_lte : '-';
            row.appendChild(countResLteCell);

            const countResGsmCell = document.createElement('td');
            countResGsmCell.textContent = rating.count_res_gsm !== undefined ? rating.count_res_gsm : '-';
            row.appendChild(countResGsmCell);

            const countRes5gCell = document.createElement('td');
            countRes5gCell.textContent = rating.count_res_5g !== undefined ? rating.count_res_5g : '-';
            row.appendChild(countRes5gCell);

            const countResWifiCell = document.createElement('td');
            countResWifiCell.textContent = rating.count_res_wifi !== undefined ? rating.count_res_wifi : '-';
            row.appendChild(countResWifiCell);

            const countResTetraCell = document.createElement('td');
            countResTetraCell.textContent = rating.count_res_tetra !== undefined ? rating.count_res_tetra : '-';
            row.appendChild(countResTetraCell);

            const countOperatorsCell = document.createElement('td');
            countOperatorsCell.textContent = rating.count_operators !== undefined ? rating.count_operators : '-';
            row.appendChild(countOperatorsCell);

            const countAbonentsLteCell = document.createElement('td');
            countAbonentsLteCell.textContent = rating.count_abonents_lte !== undefined ? rating.count_abonents_lte : '-';
            row.appendChild(countAbonentsLteCell);

            const populationPercentLteCell = document.createElement('td');
            populationPercentLteCell.textContent = rating.population_percent_lte !== undefined ? rating.population_percent_lte : '-';
            row.appendChild(populationPercentLteCell);

            const communicationCoverageLteCell = document.createElement('td');
            communicationCoverageLteCell.textContent = rating.communication_coverage_lte !== undefined ? rating.communication_coverage_lte : '-';
            row.appendChild(communicationCoverageLteCell);

            const communicationCoveragePercentLteCell = document.createElement('td');
            communicationCoveragePercentLteCell.textContent = rating.communication_coverage_percent_lte !== undefined ? rating.communication_coverage_percent_lte : '-';
            row.appendChild(communicationCoveragePercentLteCell);

            const trafficLteCell = document.createElement('td');
            trafficLteCell.textContent = rating.traffic_lte !== undefined ? rating.traffic_lte : '-';
            row.appendChild(trafficLteCell);

            const trafficPercentLteCell = document.createElement('td');
            trafficPercentLteCell.textContent = rating.traffic_percent_lte !== undefined ? rating.traffic_percent_lte : '-';
            row.appendChild(trafficPercentLteCell);

            const countAbonentsGsmCell = document.createElement('td');
            countAbonentsGsmCell.textContent = rating.count_abonents_gsm !== undefined ? rating.count_abonents_gsm : '-';
            row.appendChild(countAbonentsGsmCell);

            const populationPercentGsmCell = document.createElement('td');
            populationPercentGsmCell.textContent = rating.population_percent_gsm !== undefined ? rating.population_percent_gsm : '-';
            row.appendChild(populationPercentGsmCell);

            const communicationCoverageGsmCell = document.createElement('td');
            communicationCoverageGsmCell.textContent = rating.communication_coverage_gsm !== undefined ? rating.communication_coverage_gsm : '-';
            row.appendChild(communicationCoverageGsmCell);

            const communicationCoveragePercentGsmCell = document.createElement('td');
            communicationCoveragePercentGsmCell.textContent = rating.communication_coverage_percent_gsm !== undefined ? rating.communication_coverage_percent_gsm : '-';
            row.appendChild(communicationCoveragePercentGsmCell);

            const trafficGsmCell = document.createElement('td');
            trafficGsmCell.textContent = rating.traffic_gsm !== undefined ? rating.traffic_gsm : '-';
            row.appendChild(trafficGsmCell);

            const trafficPercentGsmCell = document.createElement('td');
            trafficPercentGsmCell.textContent = rating.traffic_percent_gsm !== undefined ? rating.traffic_percent_gsm : '-';
            row.appendChild(trafficPercentGsmCell);

            const countAbonents5gCell = document.createElement('td');
            countAbonents5gCell.textContent = rating.count_abonents_5g !== undefined ? rating.count_abonents_5g : '-';
            row.appendChild(countAbonents5gCell);

            const populationPercent5gCell = document.createElement('td');
            populationPercent5gCell.textContent = rating.population_percent_5g !== undefined ? rating.population_percent_5g : '-';
            row.appendChild(populationPercent5gCell);

            const communicationCoverage5gCell = document.createElement('td');
            communicationCoverage5gCell.textContent = rating.communication_coverage_5g !== undefined ? rating.communication_coverage_5g : '-';
            row.appendChild(communicationCoverage5gCell);

            const communicationCoveragePercent5gCell = document.createElement('td');
            communicationCoveragePercent5gCell.textContent = rating.communication_coverage_percent_5g !== undefined ? rating.communication_coverage_percent_5g : '-';
            row.appendChild(communicationCoveragePercent5gCell);

            const traffic5gCell = document.createElement('td');
            traffic5gCell.textContent = rating.traffic_5g !== undefined ? rating.traffic_5g : '-';
            row.appendChild(traffic5gCell);

            const trafficPercent5gCell = document.createElement('td');
            trafficPercent5gCell.textContent = rating.traffic_percent_5g !== undefined ? rating.traffic_percent_5g : '-';
            row.appendChild(trafficPercent5gCell);

            const countAbonentsWifiCell = document.createElement('td');
            countAbonentsWifiCell.textContent = rating.count_abonents_wifi !== undefined ? rating.count_abonents_wifi : '-';
            row.appendChild(countAbonentsWifiCell);

            const populationPercentWifiCell = document.createElement('td');
            populationPercentWifiCell.textContent = rating.population_percent_wifi !== undefined ? rating.population_percent_wifi : '-';
            row.appendChild(populationPercentWifiCell);

            const communicationCoverageWifiCell = document.createElement('td');
            communicationCoverageWifiCell.textContent = rating.communication_coverage_wifi !== undefined ? rating.communication_coverage_wifi : '-';
            row.appendChild(communicationCoverageWifiCell);

            const communicationCoveragePercentWifiCell = document.createElement('td');
            communicationCoveragePercentWifiCell.textContent = rating.communication_coverage_percent_wifi !== undefined ? rating.communication_coverage_percent_wifi : '-';
            row.appendChild(communicationCoveragePercentWifiCell);

            const trafficWifiCell = document.createElement('td');
            trafficWifiCell.textContent = rating.traffic_wifi !== undefined ? rating.traffic_wifi : '-';
            row.appendChild(trafficWifiCell);

            const trafficPercentWifiCell = document.createElement('td');
            trafficPercentWifiCell.textContent = rating.traffic_percent_wifi !== undefined ? rating.traffic_percent_wifi : '-';
            row.appendChild(trafficPercentWifiCell);

            const countAbonentsTetraCell = document.createElement('td');
            countAbonentsTetraCell.textContent = rating.count_abonents_tetra !== undefined ? rating.count_abonents_tetra : '-';
            row.appendChild(countAbonentsTetraCell);

            const populationPercentTetraCell = document.createElement('td');
            populationPercentTetraCell.textContent = rating.population_percent_tetra !== undefined ? rating.population_percent_tetra : '-';
            row.appendChild(populationPercentTetraCell);

            const communicationCoverageTetraCell = document.createElement('td');
            communicationCoverageTetraCell.textContent = rating.communication_coverage_tetra !== undefined ? rating.communication_coverage_tetra : '-';
            row.appendChild(communicationCoverageTetraCell);

            const communicationCoveragePercentTetraCell = document.createElement('td');
            communicationCoveragePercentTetraCell.textContent = rating.communication_coverage_percent_tetra !== undefined ? rating.communication_coverage_percent_tetra : '-';
            row.appendChild(communicationCoveragePercentTetraCell);

            const trafficTetraCell = document.createElement('td');
            trafficTetraCell.textContent = rating.traffic_tetra !== undefined ? rating.traffic_tetra : '-';
            row.appendChild(trafficTetraCell);

            const trafficPercentTetraCell = document.createElement('td');
            trafficPercentTetraCell.textContent = rating.traffic_percent_tetra !== undefined ? rating.traffic_percent_tetra : '-';
            row.appendChild(trafficPercentTetraCell);

            const countResMobileCell = document.createElement('td');
            countResMobileCell.textContent = rating.count_res_mobile !== undefined ? rating.count_res_mobile : '-';
            row.appendChild(countResMobileCell);

            const countAbonentsMobileCell = document.createElement('td');
            countAbonentsMobileCell.textContent = rating.count_abonents_mobile !== undefined ? rating.count_abonents_mobile : '-';
            row.appendChild(countAbonentsMobileCell);

            const populationPercentMobileCell = document.createElement('td');
            populationPercentMobileCell.textContent = rating.population_percent_mobile !== undefined ? rating.population_percent_mobile : '-';
            row.appendChild(populationPercentMobileCell);

            const communicationCoverageMobileCell = document.createElement('td');
            communicationCoverageMobileCell.textContent = rating.communication_coverage_mobile !== undefined ? rating.communication_coverage_mobile : '-';
            row.appendChild(communicationCoverageMobileCell);

            const communicationCoveragePercentMobileCell = document.createElement('td');
            communicationCoveragePercentMobileCell.textContent = rating.communication_coverage_percent_mobile !== undefined ? rating.communication_coverage_percent_mobile : '-';
            row.appendChild(communicationCoveragePercentMobileCell);

            const trafficMobileCell = document.createElement('td');
            trafficMobileCell.textContent = rating.traffic_mobile !== undefined ? rating.traffic_mobile : '-';
            row.appendChild(trafficMobileCell);

            const trafficPercentMobileCell = document.createElement('td');
            trafficPercentMobileCell.textContent = rating.traffic_percent_mobile !== undefined ? rating.traffic_percent_mobile : '-';
            row.appendChild(trafficPercentMobileCell);

            row.addEventListener('click', function() {
                document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
                    tr.classList.remove('selected');
                });
                this.classList.add('selected');

                selectedSettlementId = this.dataset.id;
                selectedSettlementLat = parseFloat(this.dataset.lat);
                selectedSettlementLon = parseFloat(this.dataset.lon);
                selectedSettlementArea = parseFloat(this.dataset.area);
                selectedSettlementName = this.dataset.name;

                console.log('▶ Выбран НП:', selectedSettlementId, selectedSettlementName);
                showResPageSize();

                showSettlementButtons();
            });

            tbody.appendChild(row);
        });
    }

    renderSettlementsPagination(total, page, pageSize);

    if (data && data.length > 0) {
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
            firstRow.click();
        }
    }

    showSettlementButtons();
}

// ==================== ПАГИНАЦИЯ (только информация о количестве) ====================

function renderSettlementsPagination(total, currentPage, pageSize) {
    const container = document.getElementById('settlements-pagination');
    if (!container) return;

    container.innerHTML = `
        <div class="pagination-info">
            Всего НП: ${total}
        </div>
    `;
}

// ==================== ЗАГРУЗКА РЭС (для модального окна) ====================

async function loadResForModal(settlementId, lat, lon, area) {
    if (!settlementId || lat === undefined || lon === undefined) {
        renderPopup('Выберите населенный пункт в таблице', true);
        return;
    }

    const loader = initLoader();
    loader.show('Загрузка РЭС...');

    try {
        const radius = calculateRadius(area);

        const body = {
            regions: currentRegions,
            kinds: currentKinds,
            area: {
                lat: lat,
                lon: lon,
                radius: radius
            }
        };

        const pageSize = getPageSize('res');
        const page = getPage();
        const result = await getResPage(page, pageSize, body);

        if (result) {
            resData.items = result.res || [];
            resData.total = result.total || 0;
            resData.page = page;
            resData.pageSize = pageSize;

            openResModal(resData.items, settlementId);
        } else {
            renderPopup('Нет РЭС для выбранного населенного пункта');
        }

        loader.close();
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка загрузки РЭС: ${error.message}`, true);
        console.error('Ошибка загрузки РЭС:', error);
    }
}

// ==================== МОДАЛЬНОЕ ОКНО С РЭС ====================

function openResModal(data, settlementId) {
    const existing = document.getElementById('res-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'res-modal';
    modal.className = 'res-modal-overlay';

    const content = document.createElement('div');
    content.className = 'res-modal-content';

    const title = document.createElement('h3');
    title.textContent = `РЭС для НП: ${selectedSettlementName || settlementId}`;
    title.className = 'res-modal-title';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.className = 'res-modal-close-btn';
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'res-table-wrapper';

    const table = document.createElement('table');
    table.className = 'res-modal-table';

    const thead = document.createElement('thead');
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    content.appendChild(title);
    content.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    function renderResTable(items) {
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!items || items.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 9;
            cell.textContent = 'Нет РЭС для отображения';
            cell.className = 'empty-message';
            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }

        const headerRow = document.createElement('tr');
        const headers = [
            'ID', 'Тип ID', 'Вид ID', 'Название', 'Оператор',
            'Местоположение', 'Регион ID', 'Широта', 'Долгота'
        ];
        headers.forEach(label => {
            const th = document.createElement('th');
            th.textContent = label;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        items.forEach(item => {
            const row = document.createElement('tr');

            const idCell = document.createElement('td');
            idCell.textContent = item.id || '-';
            row.appendChild(idCell);

            const typeIdCell = document.createElement('td');
            typeIdCell.textContent = item.type_id || '-';
            row.appendChild(typeIdCell);

            const kindIdCell = document.createElement('td');
            kindIdCell.textContent = item.kind_id || '-';
            row.appendChild(kindIdCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = item.name || '-';
            row.appendChild(nameCell);

            const operatorCell = document.createElement('td');
            operatorCell.textContent = item.operator || '-';
            row.appendChild(operatorCell);

            const locationCell = document.createElement('td');
            locationCell.textContent = item.location || '-';
            row.appendChild(locationCell);

            const regionIdCell = document.createElement('td');
            regionIdCell.textContent = item.region_id || '-';
            row.appendChild(regionIdCell);

            const latStrCell = document.createElement('td');
            latStrCell.textContent = item.lat_str || '-';
            row.appendChild(latStrCell);

            const lonStrCell = document.createElement('td');
            lonStrCell.textContent = item.lon_str || '-';
            row.appendChild(lonStrCell);

            tbody.appendChild(row);
        });
    }

    renderResTable(data);
}

// ==================== МАССОВЫЙ РАСЧЁТ РЕЙТИНГОВ ====================

function createProgressModal(total) {
    const existing = document.getElementById('rating-progress-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'rating-progress-modal';
    modal.className = 'progress-modal-overlay';

    const content = document.createElement('div');
    content.className = 'progress-modal-content';

    const title = document.createElement('h3');
    title.textContent = 'Расчет рейтингов НП';
    title.className = 'progress-modal-title';

    const progressInfo = document.createElement('div');
    progressInfo.className = 'progress-info';
    progressInfo.id = 'rating-progress-info';
    progressInfo.textContent = `Обработано: 0 / ${total}`;

    const progressBarWrap = document.createElement('div');
    progressBarWrap.className = 'progress-bar-wrap';

    const progressFill = document.createElement('div');
    progressFill.id = 'rating-progress-fill';
    progressFill.className = 'progress-bar-fill';

    progressBarWrap.appendChild(progressFill);

    const statusInfo = document.createElement('div');
    statusInfo.className = 'status-info';
    statusInfo.id = 'rating-status-info';
    statusInfo.textContent = 'Получено рейтингов: 0';

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'rating-cancel-btn';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.className = 'progress-cancel-btn';
    cancelBtn.addEventListener('click', () => {
        isCancelled = true;
        cancelBtn.textContent = 'Отменяется...';
        cancelBtn.disabled = true;
        cancelBtn.className = 'progress-cancel-btn disabled';
    });

    content.appendChild(title);
    content.appendChild(progressInfo);
    content.appendChild(progressBarWrap);
    content.appendChild(statusInfo);
    content.appendChild(cancelBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    return modal;
}

function updateProgress(current, total, successCount) {
    const fill = document.getElementById('rating-progress-fill');
    const info = document.getElementById('rating-progress-info');
    const status = document.getElementById('rating-status-info');

    if (fill) {
        const percent = Math.min((current / total) * 100, 100);
        fill.style.width = percent + '%';
    }
    if (info) {
        info.textContent = `Обработано: ${current} / ${total}`;
    }
    if (status) {
        status.textContent = `Получено рейтингов: ${successCount}`;
    }
}

function closeProgressModal() {
    const modal = document.getElementById('rating-progress-modal');
    if (modal) modal.remove();
}

// ==================== РАБОТА С РЕЙТИНГАМИ ДЛЯ ПЕРЕДАННЫХ ДАННЫХ ====================

async function getRatingsOnlyForData(items) {
    const total = items.length;
    if (total === 0) {
        renderPopup('Нет населенных пунктов для получения рейтингов', true);
        return;
    }

    await loadRatingsForSettlements(items, false);

    const pageSize = getPageSize('settlements');
    const page = getPage();
    renderCombinedTable(settlementsData.items, settlementsData.total, page, pageSize);
}

async function calculateRatingsForData(items) {
    isCalculateMode = true;
    isCancelled = false;

    const settlements = items.map(item => ({
        id: item.id,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        area: parseFloat(item.area) || 1
    }));

    const total = settlements.length;
    if (total === 0) {
        renderPopup('Нет населенных пунктов для расчёта', true);
        return;
    }

    const modal = createProgressModal(total);

    let processed = 0;
    let successCount = 0;

    for (const settlement of settlements) {
        if (isCancelled) break;

        console.log(`▶ Обработка НП ID ${settlement.id}...`);

        try {
            let ratingData = null;
            let status200 = false;

            if (allRatings[settlement.id]) {
                console.log(`▶ НП ${settlement.id}: рейтинг уже есть в кеше`);
                processed++;
                successCount++;
                updateProgress(processed, total, successCount);
                continue;
            }

            try {
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                    console.log(`▶ НП ${settlement.id}: данные получены через GET`);
                } else {
                    console.log(`▶ НП ${settlement.id}: GET вернул null, пробуем POST`);
                }
            } catch (err) {
                console.warn(`▶ НП ${settlement.id}: GET ошибка`, err);
            }

            console.log(`▶ НП ${settlement.id}: отправляем POST...`);
            try {
                await postRatingSett(settlement.id);
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                    console.log(`▶ НП ${settlement.id}: данные получены после POST`);
                }
            } catch (postErr) {
                console.warn(`▶ НП ${settlement.id}: POST ошибка`, postErr);
            }

            if (status200 && ratingData) {
                allRatings[settlement.id] = ratingData;
                processed++;
                successCount++;
                console.log(`▶ НП ${settlement.id}: успешно обработан. Всего успешно: ${successCount}`);
            } else {
                console.warn(`▶ НП ${settlement.id}: не удалось получить данные, пропускаем`);
                processed++;
            }

            updateProgress(processed, total, successCount);
            await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
            console.error(`▶ НП ${settlement.id}: критическая ошибка`, error);
            processed++;
        }
    }

    closeProgressModal();

    if (isCancelled) {
        renderPopup(`Расчёт отменён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    } else {
        renderPopup(`Расчёт завершён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    }

    const pageSize = getPageSize('settlements');
    const page = getPage();
    renderCombinedTable(settlementsData.items, settlementsData.total, page, pageSize);
}

// ==================== ОБРАБОТЧИКИ КНОПОК ====================

async function handleSettlementsButton() {
    isCalculateMode = false;

    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;

    showResPageSize();

    const regions = getSelectedRegions();
    const popRange = getPopulationRange();
    const kinds = getSelectedKinds();

    if (regions.length === 0) {
        renderPopup('Выберите хотя бы один регион', true);
        return;
    }

    currentRegions = regions;
    currentPopRange = popRange;
    currentKinds = kinds;

    const pageSize = getPageSize('settlements');
    const page = getPage();
    const result = await loadSettlements(page, regions, popRange, pageSize);

    if (result) {
        originalDataForFilter = result.items || [];
        originalTotalForFilter = result.total || 0;

        settlementsData.items = result.items || [];
        settlementsData.total = result.total || 0;
        settlementsData.page = page;
        settlementsData.pageSize = pageSize;
        currentSortField = null;
        currentSortOrder = 'asc';
        currentFilterField = '';
        currentFilterValue = '';
        currentFilterExact = false;
        showRatings = false;
        allRatings = {};
        renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, page, pageSize, false);

        showSettlementButtons();

        renderPopup(`Загружено ${settlementsData.total} населенных пунктов`);
    }
}

async function handleRatingButton() {
    isCalculateMode = false;

    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;

    hideResPageSize();

    const regions = getSelectedRegions();
    const popRange = getPopulationRange();
    const kinds = getSelectedKinds();

    if (regions.length === 0) {
        renderPopup('Выберите хотя бы один регион', true);
        return;
    }

    currentRegions = regions;
    currentPopRange = popRange;
    currentKinds = kinds;

    const pageSize = getPageSize('settlements');
    const page = getPage();
    const result = await loadSettlements(page, regions, popRange, pageSize);

    if (!result || result.items.length === 0) {
        renderPopup('Нет населенных пунктов для выбранных фильтров', true);
        return;
    }

    originalDataForFilter = result.items || [];
    originalTotalForFilter = result.total || 0;

    settlementsData.items = result.items || [];
    settlementsData.total = result.total || 0;
    settlementsData.page = page;
    settlementsData.pageSize = pageSize;
    currentSortField = null;
    currentSortOrder = 'asc';
    currentFilterField = '';
    currentFilterValue = '';
    currentFilterExact = false;

    showRatings = true;
    allRatings = {};

    await loadRatingsForSettlements(settlementsData.items, false);

    renderCombinedTable(originalDataForFilter, originalTotalForFilter, page, pageSize, false);

    showSettlementButtons();
}

async function handleResButton() {
    if (!selectedSettlementId) {
        renderPopup('Выберите населенный пункт в таблице', true);
        return;
    }
    await loadResForModal(selectedSettlementId, selectedSettlementLat, selectedSettlementLon, selectedSettlementArea);
}

async function handleWiredButton() {
    renderPopup('Функция "Проводные УС" в разработке');
}

// ==================== ОЧИСТКА ====================

function handleClear() {
    const form = document.querySelector('.form__rating');
    if (form) {
        form.reset();
        const regionSelect = document.getElementById('region');
        if (regionSelect) {
            regionSelect.value = 'all';
        }
        const typeConnectSelect = document.getElementById('type-connect');
        if (typeConnectSelect) {
            typeConnectSelect.value = 'all';
        }
    }

    const radioRange = document.getElementById('number-settlement');
    const radioAll = document.getElementById('number-settlements');
    const fromInput = document.getElementById('numbers-settlement');
    const toInput = document.getElementById('numbers-settlements');

    if (radioRange) radioRange.checked = true;
    if (radioAll) radioAll.checked = false;
    if (fromInput) fromInput.value = 1;
    if (toInput) toInput.value = 10000;

    isCalculateMode = false;

    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();

    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;
    originalDataForFilter = [];
    originalTotalForFilter = 0;

    clearFilterInputs();

    hideResPageSize();

    const resModal = document.getElementById('res-modal');
    if (resModal) resModal.remove();

    const settlementsTable = document.getElementById('settlements-table');
    if (settlementsTable) {
        const thead = settlementsTable.querySelector('thead');
        const tbody = settlementsTable.querySelector('tbody');
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '';
    }

    document.getElementById('settlements-pagination').innerHTML = '';

    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    settlementsData = { items: [], total: 0, page: 0, pageSize: 1 };
    selectedSettlementId = null;
    selectedSettlementLat = null;
    selectedSettlementLon = null;
    selectedSettlementArea = null;
    selectedSettlementName = null;
    currentSortField = null;
    currentSortOrder = 'asc';
    currentSettlementsFiltered = [];
    currentFilterField = '';
    currentFilterValue = '';
    currentFilterExact = false;
    isCancelled = false;
    allRatings = {};
    showRatings = false;

    showPlaceholder();

    renderPopup('Фильтры сброшены к значениям по умолчанию');
}

// ==================== ОЧИСТКА ПОЛЯ ПОИСКА ====================

function clearFilterInputs() {
    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) {
        filterContainer.remove();
    }

    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;
    currentFilterField = '';
    currentFilterValue = '';
    currentFilterExact = false;
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', function() {
    initLoader();
    loadRegions();
    loadResKindsSelect();

    hideResPageSize();
    hideAutoRating();
    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();

    showPlaceholder();

    document.getElementById('btn-settlements').addEventListener('click', handleSettlementsButton);
    document.getElementById('btn-rating').addEventListener('click', handleRatingButton);

    const clearBtn = document.querySelector('.form__rating + button.grid-btn') ||
        document.querySelector('button.grid-btn:not([type="submit"])');
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClear);
    }

    const closeBtn = document.getElementById('close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.close();
            setTimeout(() => {
                if (!window.closed) {
                    window.location.href = '/';
                }
            }, 100);
        });
    }

    setupDoubleClickHandler();
});