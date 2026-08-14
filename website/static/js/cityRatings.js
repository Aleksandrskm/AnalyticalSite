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
    page: 1,
    pageSize: 10
};

// Данные для РЭС (для модального окна)
let resData = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 10
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

// ==================== КНОПКА "РАССЧИТАТЬ РЕЙТИНГ ВЫБРАННОГО НП" ====================

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

    // Показываем только если мы в режиме рейтингов, есть выбранный НП и это режим расчета (POST разрешен)
    if (!showRatings || !selectedSettlementId || !isCalculateMode) {
        hideCalculateSelectedButton();
        return;
    }

    // Удаляем кнопки РЭС и Проводные УС если они есть (на всякий случай)
    const resBtn = document.getElementById('res-action-btn');
    if (resBtn) resBtn.remove();
    const wiredBtn = document.getElementById('wired-action-btn');
    if (wiredBtn) wiredBtn.remove();

    // Создаем или показываем кнопку расчета
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

    // Если мы в режиме рейтингов
    if (showRatings) {
        // Удаляем кнопки РЭС и Проводные УС
        const resBtn = document.getElementById('res-action-btn');
        if (resBtn) resBtn.remove();
        const wiredBtn = document.getElementById('wired-action-btn');
        if (wiredBtn) wiredBtn.remove();

        // Показываем кнопку расчета выбранного НП только если включен режим расчета
        if (isCalculateMode) {
            showCalculateSelectedButton();
        } else {
            hideCalculateSelectedButton();
        }
        return;
    }

    // Для таблицы населенных пунктов (без рейтингов) - показываем РЭС и Проводные УС
    // Удаляем старые кнопки
    const oldRes = document.getElementById('res-action-btn');
    if (oldRes) oldRes.remove();
    const oldWired = document.getElementById('wired-action-btn');
    if (oldWired) oldWired.remove();
    const oldCalc = document.getElementById('calculate-selected-btn');
    if (oldCalc) oldCalc.remove();

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

// Расчет радиуса НП по формуле из документа (п. 3.1) с округлением до целого
function calculateRadius(area) {
    if (!area || area <= 0) return 1;
    return Math.round(1.1 * Math.sqrt(area / Math.PI));
}

function getPageSize(tableType) {
    const select = document.querySelector(`.page-size-control[data-table="${tableType}"] .page-size-select`);
    if (select) {
        const val = parseInt(select.value);
        if (!isNaN(val) && val > 0) return val;
    }
    return 10;
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

// ==================== ФИЛЬТРАЦИЯ ДАННЫХ С УЧЕТОМ РЕЙТИНГОВ ====================

function filterDataWithRatings(data, ratings, field, value, exactMatch = false) {
    if (!value || !field) return data;

    const ratingFields = ['count_res', 'count_res_tv', 'count_res_rv',
        'count_res_lte', 'count_res_gsm', 'count_res_5g',
        'count_res_wifi', 'count_res_tetra'];

    return data.filter(row => {
        let cellValue;

        // Проверяем, является ли поле рейтинговым
        if (ratingFields.includes(field)) {
            // Получаем значение из рейтинга
            const rating = ratings[row.id] || {};
            cellValue = rating[field];
        } else {
            // Получаем значение из данных НП
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

async function loadSettlements(page = 1, regions, popRange, pageSize) {
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

// ==================== ЗАГРУЗКА РЕЙТИНГОВ ДЛЯ НАСЕЛЕННЫХ ПУНКТОВ ====================

async function loadRatingsForSettlements(items, allowPost = false) {
    const loader = initLoader();
    loader.show('Загрузка рейтингов...');

    let successCount = 0;
    let postCount = 0;

    for (const settlement of items) {
        try {
            // Проверяем, есть ли уже рейтинг для этого НП
            if (!allRatings[settlement.id]) {
                let ratingData = null;
                let status200 = false;

                // Сначала пробуем GET
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

                // Если GET не дал результат и разрешен POST (режим расчета)
                if (!status200 && allowPost) {
                    try {
                        console.log(`▶ НП ${settlement.id}: отправляем POST...`);
                        await postRatingSett(settlement.id);
                        ratingData = await getRatingSett(settlement.id);
                        if (ratingData !== null && ratingData !== undefined) {
                            allRatings[settlement.id] = ratingData;
                            successCount++;
                            postCount++;
                            console.log(`▶ НП ${settlement.id}: рейтинг создан через POST`);
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
        // Небольшая задержка, чтобы не перегружать сервер
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    loader.close();
    console.log(`▶ Загружено ${successCount} рейтингов (из них создано через POST: ${postCount})`);
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
        // Отправляем POST запрос для выбранного НП
        await postRatingSett(selectedSettlementId);

        // Получаем обновленные данные через GET
        const ratingData = await getRatingSett(selectedSettlementId);

        if (ratingData !== null && ratingData !== undefined) {
            // Обновляем рейтинг в кеше
            allRatings[selectedSettlementId] = ratingData;

            // Перерисовываем таблицу с обновленными данными
            const pageSize = getPageSize('settlements');

            // Если есть активный фильтр, применяем его
            if (savedFilterField && savedFilterValue) {
                const filtered = filterDataWithRatings(originalDataForFilter, allRatings, savedFilterField, savedFilterValue, savedFilterExact);
                renderCombinedTable(filtered, filtered.length, 1, pageSize, true);
            } else {
                renderCombinedTable(originalDataForFilter, originalTotalForFilter, settlementsData.page || 1, pageSize, false);
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

// ==================== ОТОБРАЖЕНИЕ ТАБЛИЦЫ (только НП) ====================

function renderSettlementsTableOnly(data, total, page, pageSize, keepFilter = false) {
    const table = document.getElementById('settlements-table');
    if (!table) return;

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

    // Удаляем старый фильтр
    const oldFilter = document.querySelector('.filter-container');
    if (oldFilter) oldFilter.remove();

    // Создаем фильтр
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

    // Восстанавливаем сохраненное значение поля, если keepFilter = true
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

    // Восстанавливаем сохраненное значение, если keepFilter = true
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

    // Восстанавливаем сохраненное состояние чекбокса, если keepFilter = true
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
            // Сохраняем значения
            savedFilterField = field;
            savedFilterValue = value;
            savedFilterExact = exactMatch;

            currentFilterField = field;
            currentFilterValue = value;
            currentFilterExact = exactMatch;

            // Фильтруем исходные данные и показываем на 1 странице
            const filtered = filterData(originalDataForFilter, field, value, exactMatch);
            renderSettlementsTableOnly(filtered, filtered.length, 1, pageSize, true);
        }
    });

    resetBtn.addEventListener('click', () => {
        // Очищаем сохраненные значения
        savedFilterField = '';
        savedFilterValue = '';
        savedFilterExact = false;

        currentFilterField = '';
        currentFilterValue = '';
        currentFilterExact = false;

        // Показываем исходные данные на ТЕКУЩЕЙ странице
        const currentPage = settlementsData.page || 1;
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
            cell.colSpan = 18;
            cell.textContent = 'Нет населенных пунктов для отображения';
            cell.className = 'empty-message';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        renderSettlementsPagination(total, page, pageSize);
        return;
    }

    currentSettlementsFiltered = data;

    // Удаляем старый фильтр
    const oldFilter = document.querySelector('.filter-container');
    if (oldFilter) oldFilter.remove();

    // Создаем фильтр для комбинированной таблицы
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
        'count_res': 'Всего РЭС',
        'count_res_tv': 'РЭС ТВ',
        'count_res_rv': 'РЭС РВ',
        'count_res_lte': 'РЭС LTE',
        'count_res_gsm': 'РЭС GSM',
        'count_res_5g': 'РЭС 5G',
        'count_res_wifi': 'РЭС Wi-Fi',
        'count_res_tetra': 'РЭС TETRA'
    };

    const ratingFieldKeys = [
        'count_res', 'count_res_tv', 'count_res_rv',
        'count_res_lte', 'count_res_gsm', 'count_res_5g',
        'count_res_wifi', 'count_res_tetra'
    ];

    // Добавляем поля из данных НП
    Object.keys(data[0]).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = labels[key] || key;
        fieldSelect.appendChild(opt);
    });

    // Добавляем поля рейтинга (даже если их нет в data)
    ratingFieldKeys.forEach(key => {
        if (!Object.keys(data[0]).includes(key)) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = labels[key] || key;
            fieldSelect.appendChild(opt);
        }
    });

    // Восстанавливаем сохраненное значение поля, если keepFilter = true
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

    // Восстанавливаем сохраненное значение, если keepFilter = true
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

    // Восстанавливаем сохраненное состояние чекбокса, если keepFilter = true
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
            // Сохраняем значения
            savedFilterField = field;
            savedFilterValue = value;
            savedFilterExact = exactMatch;

            currentFilterField = field;
            currentFilterValue = value;
            currentFilterExact = exactMatch;

            // Фильтруем данные с учетом рейтингов и показываем на 1 странице
            const filtered = filterDataWithRatings(originalDataForFilter, allRatings, field, value, exactMatch);
            renderCombinedTable(filtered, filtered.length, 1, pageSize, true);
        }
    });

    resetBtn.addEventListener('click', () => {
        // Очищаем сохраненные значения
        savedFilterField = '';
        savedFilterValue = '';
        savedFilterExact = false;

        currentFilterField = '';
        currentFilterValue = '';
        currentFilterExact = false;

        // Показываем исходные данные на ТЕКУЩЕЙ странице
        const currentPage = settlementsData.page || 1;
        renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentPage, pageSize, false);
    });

    tableContainer.prepend(filterContainer);

    // ===== ЗАГОЛОВКИ =====
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
            { key: 'count_res', label: 'Всего РЭС' },
            { key: 'count_res_tv', label: 'РЭС ТВ' },
            { key: 'count_res_rv', label: 'РЭС РВ' },
            { key: 'count_res_lte', label: 'РЭС LTE' },
            { key: 'count_res_gsm', label: 'РЭС GSM' },
            { key: 'count_res_5g', label: 'РЭС 5G' },
            { key: 'count_res_wifi', label: 'РЭС Wi-Fi' },
            { key: 'count_res_tetra', label: 'РЭС TETRA' }
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

    // ===== СОРТИРОВКА С УЧЕТОМ РЕЙТИНГОВЫХ ПОЛЕЙ =====
    let displayData = [...data];
    if (currentSortField) {
        const ratingFields = ['count_res', 'count_res_tv', 'count_res_rv',
            'count_res_lte', 'count_res_gsm', 'count_res_5g',
            'count_res_wifi', 'count_res_tetra'];

        displayData.sort((a, b) => {
            let valA, valB;

            // Проверяем, является ли поле рейтинговым
            if (ratingFields.includes(currentSortField)) {
                // Получаем значения из рейтинга
                const ratingA = allRatings[a.id] || {};
                const ratingB = allRatings[b.id] || {};
                valA = ratingA[currentSortField];
                valB = ratingB[currentSortField];
            } else {
                // Получаем значения из данных НП
                valA = a[currentSortField];
                valB = b[currentSortField];
            }

            // Если значения undefined или null, заменяем на пустую строку или 0
            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            // Сравнение для чисел
            if (typeof valA === 'number' && typeof valB === 'number') {
                return currentSortOrder === 'asc' ? valA - valB : valB - valA;
            }

            // Сравнение для строк
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            if (currentSortOrder === 'asc') {
                return valA.localeCompare(valB);
            } else {
                return valB.localeCompare(valA);
            }
        });
    }

    // ===== ОТРИСОВКА ТЕЛА ТАБЛИЦЫ =====
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

            const countResCell = document.createElement('td');
            countResCell.textContent = rating.count_res !== undefined ? rating.count_res : '-';
            row.appendChild(countResCell);

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

                // Показываем кнопку расчета выбранного НП, если нужно
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

    // Показываем кнопки в зависимости от режима
    showSettlementButtons();
}

// ==================== ПАГИНАЦИЯ ====================

function renderSettlementsPagination(total, currentPage, pageSize) {
    const container = document.getElementById('settlements-pagination');
    if (!container) return;

    const totalPages = Math.ceil(total / pageSize) || 1;

    let html = `
        <div class="pagination-info">
            Страница ${currentPage} из ${totalPages} (всего НП: ${total})
        </div>
        <div class="pagination-buttons">
            <button class="pagination-btn" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>◀</button>
    `;

    if (currentPage > 1) {
        html += `<button class="pagination-btn" data-page="1">1</button>`;
    } else {
        html += `<button class="pagination-btn active" data-page="1">1</button>`;
    }

    if (currentPage > 3) {
        html += `<span class="pagination-ellipsis">…</span>`;
    }

    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    for (let i = startPage; i <= endPage; i++) {
        if (i === 1 || i === totalPages) continue;
        const isActive = i === currentPage;
        html += `<button class="pagination-btn ${isActive ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (currentPage < totalPages - 2) {
        html += `<span class="pagination-ellipsis">…</span>`;
    }

    if (totalPages > 1) {
        if (currentPage === totalPages) {
            html += `<button class="pagination-btn active" data-page="${totalPages}">${totalPages}</button>`;
        } else {
            html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
    }

    html += `
            <button class="pagination-btn" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>▶</button>
        </div>
    `;

    container.innerHTML = html;

    container.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const page = btn.dataset.page;
            let newPage = currentPage;

            if (page === 'prev' && currentPage > 1) newPage = currentPage - 1;
            else if (page === 'next' && currentPage < totalPages) newPage = currentPage + 1;
            else if (page !== 'prev' && page !== 'next') newPage = parseInt(page);

            if (newPage !== currentPage) {
                const pageSizeVal = getPageSize('settlements');
                const result = await loadSettlements(newPage, currentRegions, currentPopRange, pageSizeVal);

                if (result && result.items) {
                    // Сохраняем новые данные как исходные
                    originalDataForFilter = result.items || [];
                    originalTotalForFilter = result.total || 0;

                    settlementsData.items = result.items || [];
                    settlementsData.total = result.total || 0;
                    settlementsData.page = newPage;
                    settlementsData.pageSize = pageSizeVal;

                    // Если мы в режиме рейтингов, загружаем рейтинги для новых НП
                    if (showRatings) {
                        await loadRatingsForSettlements(settlementsData.items, isCalculateMode);

                        if (savedFilterField && savedFilterValue) {
                            const filtered = filterDataWithRatings(originalDataForFilter, allRatings, savedFilterField, savedFilterValue, savedFilterExact);
                            renderCombinedTable(filtered, filtered.length, 1, pageSizeVal, true);
                        } else {
                            currentSortField = null;
                            currentSortOrder = 'asc';
                            renderCombinedTable(originalDataForFilter, originalTotalForFilter, newPage, pageSizeVal, false);
                        }
                    } else {
                        // Обычный режим без рейтингов
                        if (savedFilterField && savedFilterValue) {
                            const filtered = filterData(originalDataForFilter, savedFilterField, savedFilterValue, savedFilterExact);
                            renderSettlementsTableOnly(filtered, filtered.length, 1, pageSizeVal, true);
                        } else {
                            currentSortField = null;
                            currentSortOrder = 'asc';
                            renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, newPage, pageSizeVal, false);
                        }
                    }
                } else {
                    renderPopup('Нет данных для отображения на этой странице', true);
                }
            }
        });
    });
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
        const result = await getResPage(1, pageSize, body);

        if (result) {
            resData.items = result.res || [];
            resData.total = result.total || 0;
            resData.page = 1;
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
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    function renderResTable(data) {
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
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

        data.forEach(item => {
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

    tableWrapper.appendChild(table);
    renderResTable(data);
}

// ==================== МАССОВЫЙ РАСЧЁТ РЕЙТИНГОВ (GET + POST) ====================

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

    // Загружаем рейтинги для всех НП (только GET, без POST)
    await loadRatingsForSettlements(items, false);

    renderPopup(`Загружено рейтингов для ${total} населенных пунктов`, false);
    renderCombinedTable(settlementsData.items, settlementsData.total, settlementsData.page, settlementsData.pageSize);
}

async function calculateRatingsForData(items) {
    // Включаем режим расчета (POST разрешен)
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

            // Проверяем, есть ли уже рейтинг в кеше
            if (allRatings[settlement.id]) {
                console.log(`▶ НП ${settlement.id}: рейтинг уже есть в кеше`);
                processed++;
                successCount++;
                updateProgress(processed, total, successCount);
                continue;
            }

            // GET запрос
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

            // Если GET не дал данных — POST
            if (!status200) {
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

    renderCombinedTable(settlementsData.items, settlementsData.total, settlementsData.page, settlementsData.pageSize);
}

// ==================== ОБРАБОТЧИКИ КНОПОК ====================

async function handleSettlementsButton() {
    // Сбрасываем режим расчета
    isCalculateMode = false;

    // Сбрасываем сохраненные значения фильтра при новом запросе
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
    const result = await loadSettlements(1, regions, popRange, pageSize);

    if (result) {
        // Сохраняем исходные данные для фильтрации
        originalDataForFilter = result.items || [];
        originalTotalForFilter = result.total || 0;

        settlementsData.items = result.items || [];
        settlementsData.total = result.total || 0;
        settlementsData.page = 1;
        settlementsData.pageSize = pageSize;
        currentSortField = null;
        currentSortOrder = 'asc';
        currentFilterField = '';
        currentFilterValue = '';
        currentFilterExact = false;
        showRatings = false;
        allRatings = {};
        renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, 1, pageSize, false);

        // Показываем кнопки РЭС и Проводные УС
        showSettlementButtons();

        renderPopup(`Загружено ${settlementsData.total} населенных пунктов`);
    }
}

async function handleRatingButton() {
    // Сбрасываем режим расчета (только GET)
    isCalculateMode = false;

    // Сбрасываем сохраненные значения фильтра при новом запросе
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
    const result = await loadSettlements(1, regions, popRange, pageSize);

    if (!result || result.items.length === 0) {
        renderPopup('Нет населенных пунктов для выбранных фильтров', true);
        return;
    }

    // Сохраняем исходные данные для фильтрации
    originalDataForFilter = result.items || [];
    originalTotalForFilter = result.total || 0;

    settlementsData.items = result.items || [];
    settlementsData.total = result.total || 0;
    settlementsData.page = 1;
    settlementsData.pageSize = pageSize;
    currentSortField = null;
    currentSortOrder = 'asc';
    currentFilterField = '';
    currentFilterValue = '';
    currentFilterExact = false;

    showRatings = true;
    allRatings = {};

    await getRatingsOnlyForData(settlementsData.items);

    // После загрузки рейтингов - скрываем все кнопки (для таблицы рейтингов НП)
    hideSettlementButtons();
    hideCalculateSelectedButton();
}

async function handleBothButton() {
    // Включаем режим расчета (POST разрешен)
    isCalculateMode = true;

    // Сбрасываем сохраненные значения фильтра при новом запросе
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
    const result = await loadSettlements(1, regions, popRange, pageSize);

    if (!result || result.items.length === 0) {
        renderPopup('Нет населенных пунктов для выбранных фильтров', true);
        return;
    }

    // Сохраняем исходные данные для фильтрации
    originalDataForFilter = result.items || [];
    originalTotalForFilter = result.total || 0;

    settlementsData.items = result.items || [];
    settlementsData.total = result.total || 0;
    settlementsData.page = 1;
    settlementsData.pageSize = pageSize;
    currentSortField = null;
    currentSortOrder = 'asc';
    currentFilterField = '';
    currentFilterValue = '';
    currentFilterExact = false;

    showRatings = true;
    allRatings = {};

    await calculateRatingsForData(settlementsData.items);

    // После расчета - показываем кнопку "Рассчитать рейтинг выбранного НП"
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

    // Сбрасываем режим расчета
    isCalculateMode = false;

    // Скрываем все кнопки
    hideSettlementButtons();
    hideCalculateSelectedButton();

    // Сбрасываем сохраненные значения фильтра
    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;
    originalDataForFilter = [];
    originalTotalForFilter = 0;

    // Очищаем поле поиска (фильтр)
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

    settlementsData = { items: [], total: 0, page: 1, pageSize: 10 };
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

    renderPopup('Фильтры сброшены');
}

// ==================== ОЧИСТКА ПОЛЯ ПОИСКА ====================

function clearFilterInputs() {
    // Удаляем контейнер фильтра
    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) {
        filterContainer.remove();
    }

    // Также очищаем значения в сохраненных переменных
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
    hideCalculateSelectedButton();

    document.getElementById('btn-settlements').addEventListener('click', handleSettlementsButton);
    document.getElementById('btn-rating').addEventListener('click', handleRatingButton);
    document.getElementById('btn-both').addEventListener('click', handleBothButton);

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

    document.querySelectorAll('.page-size-control .page-size-select').forEach(select => {
        select.addEventListener('change', function() {
            const tableType = this.closest('.page-size-control').dataset.table;
            const newSize = parseInt(this.value);

            if (tableType === 'settlements' && settlementsData.total > 0) {
                settlementsData.pageSize = newSize;
                if (showRatings) {
                    renderCombinedTable(settlementsData.items, settlementsData.total, settlementsData.page, settlementsData.pageSize);
                } else {
                    renderSettlementsTableOnly(settlementsData.items, settlementsData.total, settlementsData.page, settlementsData.pageSize);
                }
            }
        });
    });
});