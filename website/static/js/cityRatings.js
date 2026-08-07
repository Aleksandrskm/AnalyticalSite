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

// Данные для РЭС
let resData = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 10
};

// Текущий выбранный НП для загрузки РЭС и рейтинга
let selectedSettlementId = null;
let selectedSettlementLat = null;
let selectedSettlementLon = null;
let selectedSettlementArea = null;

// Текущие фильтры
let currentRegions = [];
let currentKinds = [];
let currentPopRange = { from: 1, to: 17000000 };

// Флаг отмены массового расчёта
let isCancelled = false;

// Массив всех полученных рейтингов
let allRatings = [];

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

// Загрузка регионов в select
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

// Загрузка видов РЭС в select
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
    // R = 1.1 * sqrt(S / pi)
    if (!area || area <= 0) return 1; // если нет площади, радиус 1 км
    return Math.round(1.1 * Math.sqrt(area / Math.PI));
}

// Получение размера страницы для таблицы (из селекта)
function getPageSize(tableType) {
    const select = document.querySelector(`.page-size-control[data-table="${tableType}"] .page-size-select`);
    if (select) {
        const val = parseInt(select.value);
        if (!isNaN(val) && val > 0) return val;
    }
    return 10;
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

// ==================== ОТОБРАЖЕНИЕ ТАБЛИЦЫ НАСЕЛЕННЫХ ПУНКТОВ ====================

function renderSettlementsTable(data, total, page, pageSize) {
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
            cell.style.textAlign = 'center';
            cell.style.padding = '20px';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        renderSettlementsPagination(total, page, pageSize);
        return;
    }

    if (thead) {
        const headerRow = document.createElement('tr');
        [
            'ID',
            'Название',
            'Площадь (км²)',
            'Регион',
            'Код региона',
            'Муниципальное образование',
            'Широта',
            'Долгота',
            'Население',
            'Код ФИАС'
        ].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.padding = '8px';
            th.style.border = '1px solid #ddd';
            th.style.backgroundColor = '#f2f2f2';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
    }

    if (tbody) {
        data.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id;
            row.dataset.lat = item.lat;
            row.dataset.lon = item.lon;
            row.dataset.area = item.area || 1;
            row.style.cursor = 'pointer';

            const idCell = document.createElement('td');
            idCell.textContent = item.id;
            idCell.style.padding = '6px';
            idCell.style.border = '1px solid #ddd';
            row.appendChild(idCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = item.name || '-';
            nameCell.style.padding = '6px';
            nameCell.style.border = '1px solid #ddd';
            row.appendChild(nameCell);

            const areaCell = document.createElement('td');
            areaCell.textContent = item.area !== null && item.area !== undefined ? item.area : '-';
            areaCell.style.padding = '6px';
            areaCell.style.border = '1px solid #ddd';
            row.appendChild(areaCell);

            const regionNameCell = document.createElement('td');
            regionNameCell.textContent = item.region_name || '-';
            regionNameCell.style.padding = '6px';
            regionNameCell.style.border = '1px solid #ddd';
            row.appendChild(regionNameCell);

            const regionCodeCell = document.createElement('td');
            regionCodeCell.textContent = item.region_code || '-';
            regionCodeCell.style.padding = '6px';
            regionCodeCell.style.border = '1px solid #ddd';
            row.appendChild(regionCodeCell);

            const districtCell = document.createElement('td');
            districtCell.textContent = item.district_name || '-';
            districtCell.style.padding = '6px';
            districtCell.style.border = '1px solid #ddd';
            row.appendChild(districtCell);

            const latCell = document.createElement('td');
            latCell.textContent = item.lat !== undefined ? item.lat.toFixed(6) : '-';
            latCell.style.padding = '6px';
            latCell.style.border = '1px solid #ddd';
            row.appendChild(latCell);

            const lonCell = document.createElement('td');
            lonCell.textContent = item.lon !== undefined ? item.lon.toFixed(6) : '-';
            lonCell.style.padding = '6px';
            lonCell.style.border = '1px solid #ddd';
            row.appendChild(lonCell);

            const popCell = document.createElement('td');
            popCell.textContent = item.population || 0;
            popCell.style.padding = '6px';
            popCell.style.border = '1px solid #ddd';
            row.appendChild(popCell);

            const fiasCell = document.createElement('td');
            fiasCell.textContent = item.fias_id || '-';
            fiasCell.style.padding = '6px';
            fiasCell.style.border = '1px solid #ddd';
            row.appendChild(fiasCell);

            // КЛИК ПО СТРОКЕ: обновляем selectedSettlementId и загружаем РЭС
            row.addEventListener('click', function() {
                // Снимаем выделение
                document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
                    tr.classList.remove('selected');
                    tr.style.backgroundColor = '';
                });
                // Выделяем текущую
                this.classList.add('selected');

                // Сохраняем данные
                selectedSettlementId = this.dataset.id;
                selectedSettlementLat = parseFloat(this.dataset.lat);
                selectedSettlementLon = parseFloat(this.dataset.lon);
                selectedSettlementArea = parseFloat(this.dataset.area);

                console.log('▶ Клик по НП: ID =', selectedSettlementId);

                // Загружаем РЭС
                loadResForSettlement(selectedSettlementId, selectedSettlementLat, selectedSettlementLon, selectedSettlementArea);

                // Если рейтинг уже открыт — обновляем его
                const existingRatingTable = document.getElementById('rating-table');
                if (existingRatingTable) {
                    handleRatingButton();
                }
            });

            tbody.appendChild(row);
        });
    }

    renderSettlementsPagination(total, page, pageSize);

    // Автовыбор первого НП
    if (data && data.length > 0) {
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
            firstRow.click();
        }
    }
}

// ==================== ПАГИНАЦИЯ С НОМЕРАМИ СТРАНИЦ (всегда видно 1 и последнюю) ====================

function renderSettlementsPagination(total, currentPage, pageSize) {
    const container = document.getElementById('settlements-pagination');
    if (!container) return;

    const totalPages = Math.ceil(total / pageSize) || 1;

    let html = `
        <div class="pagination-info">
            Страница ${currentPage} из ${totalPages} (всего: ${total})
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
                const pageSize = getPageSize('settlements');
                const result = await loadSettlements(newPage, currentRegions, currentPopRange, pageSize);
                if (result) {
                    settlementsData.items = result.items || [];
                    settlementsData.total = result.total || 0;
                    settlementsData.page = newPage;
                    settlementsData.pageSize = pageSize;
                    renderSettlementsTable(settlementsData.items, settlementsData.total, settlementsData.page, settlementsData.pageSize);
                }
            }
        });
    });
}

// ==================== ЗАГРУЗКА РЭС ДЛЯ ВЫБРАННОГО НП ====================

async function loadResForSettlement(settlementId, lat, lon, area) {
    if (!settlementId || lat === undefined || lon === undefined) {
        renderPopup('Выберите населенный пункт для загрузки РЭС', true);
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

            renderResTable(resData.items, resData.total, resData.page, resData.pageSize);
            renderPopup(`Загружено ${resData.total} РЭС для НП ID ${settlementId}`);
        } else {
            renderResTable([], 0, 1, pageSize);
            renderPopup('Нет РЭС для выбранного населенного пункта');
        }

        loader.close();
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка загрузки РЭС: ${error.message}`, true);
        console.error('Ошибка загрузки РЭС:', error);
    }
}

// ==================== ОТОБРАЖЕНИЕ ТАБЛИЦЫ РЭС ====================

function renderResTable(data, total, page, pageSize) {
    const table = document.getElementById('res-table');
    if (!table) return;

    const oldResTitle = document.querySelector('.res-title');
    if (oldResTitle) oldResTitle.remove();

    const resTitle = document.createElement('h3');
    resTitle.className = 'res-title';
    resTitle.textContent = 'РЭС';
    table.parentNode.insertBefore(resTitle, table);

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';

    if (!data || data.length === 0) {
        if (tbody) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 9;
            cell.textContent = 'Нет РЭС для отображения';
            cell.style.textAlign = 'center';
            cell.style.padding = '20px';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        renderResPagination(total, page, pageSize);
        return;
    }

    if (thead) {
        const headerRow = document.createElement('tr');
        [
            'ID',
            'Тип ID',
            'Вид ID',
            'Название',
            'Оператор',
            'Местоположение',
            'Регион ID',
            'Широта (строка)',
            'Долгота (строка)'
        ].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.padding = '8px';
            th.style.border = '1px solid #ddd';
            th.style.backgroundColor = '#f2f2f2';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
    }

    if (tbody) {
        data.forEach(item => {
            const row = document.createElement('tr');

            const idCell = document.createElement('td');
            idCell.textContent = item.id || '-';
            idCell.style.padding = '6px';
            idCell.style.border = '1px solid #ddd';
            row.appendChild(idCell);

            const typeIdCell = document.createElement('td');
            typeIdCell.textContent = item.type_id || '-';
            typeIdCell.style.padding = '6px';
            typeIdCell.style.border = '1px solid #ddd';
            row.appendChild(typeIdCell);

            const kindIdCell = document.createElement('td');
            kindIdCell.textContent = item.kind_id || '-';
            kindIdCell.style.padding = '6px';
            kindIdCell.style.border = '1px solid #ddd';
            row.appendChild(kindIdCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = item.name || '-';
            nameCell.style.padding = '6px';
            nameCell.style.border = '1px solid #ddd';
            row.appendChild(nameCell);

            const operatorCell = document.createElement('td');
            operatorCell.textContent = item.operator || '-';
            operatorCell.style.padding = '6px';
            operatorCell.style.border = '1px solid #ddd';
            row.appendChild(operatorCell);

            const locationCell = document.createElement('td');
            locationCell.textContent = item.location || '-';
            locationCell.style.padding = '6px';
            locationCell.style.border = '1px solid #ddd';
            row.appendChild(locationCell);

            const regionIdCell = document.createElement('td');
            regionIdCell.textContent = item.region_id || '-';
            regionIdCell.style.padding = '6px';
            regionIdCell.style.border = '1px solid #ddd';
            row.appendChild(regionIdCell);

            const latStrCell = document.createElement('td');
            latStrCell.textContent = item.lat_str || '-';
            latStrCell.style.padding = '6px';
            latStrCell.style.border = '1px solid #ddd';
            row.appendChild(latStrCell);

            const lonStrCell = document.createElement('td');
            lonStrCell.textContent = item.lon_str || '-';
            lonStrCell.style.padding = '6px';
            lonStrCell.style.border = '1px solid #ddd';
            row.appendChild(lonStrCell);

            tbody.appendChild(row);
        });
    }

    renderResPagination(total, page, pageSize);
}

// ==================== ПАГИНАЦИЯ РЭС С НОМЕРАМИ СТРАНИЦ ====================

function renderResPagination(total, currentPage, pageSize) {
    const container = document.getElementById('res-pagination');
    if (!container) return;

    const totalPages = Math.ceil(total / pageSize) || 1;

    let html = `
        <div class="pagination-info">
            Страница ${currentPage} из ${totalPages} (всего: ${total})
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
                const pageSize = getPageSize('res');
                const body = {
                    regions: currentRegions,
                    kinds: currentKinds,
                    area: {
                        lat: selectedSettlementLat,
                        lon: selectedSettlementLon,
                        radius: calculateRadius(selectedSettlementArea)
                    }
                };
                const result = await getResPage(newPage, pageSize, body);
                if (result) {
                    resData.items = result.res || [];
                    resData.total = result.total || 0;
                    resData.page = newPage;
                    resData.pageSize = pageSize;
                    renderResTable(resData.items, resData.total, resData.page, resData.pageSize);
                }
            }
        });
    });
}

// ==================== ОТОБРАЖЕНИЕ ТАБЛИЦЫ РЕЙТИНГА (для одного НП) ====================

function renderRatingTableSingle(data) {
    const tableContainer = document.querySelector('.table__rating');
    if (!tableContainer) return;

    // Удаляем старую таблицу рейтинга
    const existingRatingTable = document.getElementById('rating-table');
    if (existingRatingTable) existingRatingTable.remove();

    const existingRatingTitle = document.querySelector('.rating-title');
    if (existingRatingTitle) existingRatingTitle.remove();

    const ratingTitle = document.createElement('h3');
    ratingTitle.className = 'rating-title';
    ratingTitle.textContent = 'Рейтинг НП (выбранный)';
    ratingTitle.style.cssText = `
        text-align: center;
        font-size: 18px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 15px 0 10px 0;
        padding-bottom: 8px;
        border-bottom: 2px solid #1a1a1a;
    `;

    const ratingTable = document.createElement('table');
    ratingTable.id = 'rating-table';
    ratingTable.className = 'table__rating__table';

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    ratingTable.appendChild(thead);
    ratingTable.appendChild(tbody);

    if (!data || Object.keys(data).length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 2;
        cell.textContent = 'Нет данных рейтинга для отображения';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        row.appendChild(cell);
        tbody.appendChild(row);

        const buttons = tableContainer.querySelector('.table_buttons');
        if (buttons) {
            tableContainer.insertBefore(ratingTitle, buttons);
            tableContainer.insertBefore(ratingTable, buttons);
        } else {
            tableContainer.appendChild(ratingTitle);
            tableContainer.appendChild(ratingTable);
        }
        return;
    }

    // Маппинг полей для одного НП (русские названия)
    const fieldMap = {
        'id': 'ID НП',
        'count_res': 'Всего РЭС',
        'count_res_tv': 'РЭС ТВ',
        'count_res_rv': 'РЭС РВ',
        'count_res_lte': 'РЭС LTE',
        'count_res_gsm': 'РЭС GSM',
        'count_res_5g': 'РЭС 5G',
        'count_res_wifi': 'РЭС Wi-Fi',
        'count_res_tetra': 'РЭС TETRA'
    };

    // Заголовки
    const headerRow = document.createElement('tr');
    ['Показатель', 'Значение'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        th.style.padding = '8px';
        th.style.border = '1px solid #ddd';
        th.style.backgroundColor = '#f2f2f2';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Данные
    const fields = [
        { key: 'id', label: 'ID НП' },
        { key: 'count_res', label: 'Всего РЭС' },
        { key: 'count_res_tv', label: 'РЭС ТВ' },
        { key: 'count_res_rv', label: 'РЭС РВ' },
        { key: 'count_res_lte', label: 'РЭС LTE' },
        { key: 'count_res_gsm', label: 'РЭС GSM' },
        { key: 'count_res_5g', label: 'РЭС 5G' },
        { key: 'count_res_wifi', label: 'РЭС Wi-Fi' },
        { key: 'count_res_tetra', label: 'РЭС TETRA' }
    ];

    fields.forEach(field => {
        const row = document.createElement('tr');

        const labelCell = document.createElement('td');
        labelCell.textContent = field.label;
        labelCell.style.padding = '6px';
        labelCell.style.border = '1px solid #ddd';
        labelCell.style.fontWeight = 'bold';
        row.appendChild(labelCell);

        const valueCell = document.createElement('td');
        valueCell.textContent = data[field.key] !== undefined ? data[field.key] : '-';
        valueCell.style.padding = '6px';
        valueCell.style.border = '1px solid #ddd';
        row.appendChild(valueCell);

        tbody.appendChild(row);
    });

    const buttons = tableContainer.querySelector('.table_buttons');
    if (buttons) {
        tableContainer.insertBefore(ratingTitle, buttons);
        tableContainer.insertBefore(ratingTable, buttons);
    } else {
        tableContainer.appendChild(ratingTitle);
        tableContainer.appendChild(ratingTable);
    }
}

// ==================== МАССОВЫЙ РАСЧЁТ РЕЙТИНГОВ ====================

/**
 * Создаёт модальное окно с прогрессом для массового расчёта.
 */
function createProgressModal(total) {
    const existing = document.getElementById('rating-progress-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'rating-progress-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 99999;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        min-width: 400px;
        max-width: 500px;
        text-align: center;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Расчет рейтингов НП';
    title.style.cssText = 'margin: 0 0 20px 0; font-size: 18px;';

    const progressInfo = document.createElement('div');
    progressInfo.style.cssText = 'margin-bottom: 15px; font-size: 14px; color: #333;';
    progressInfo.id = 'rating-progress-info';
    progressInfo.textContent = `Обработано: 0 / ${total}`;

    const progressBarWrap = document.createElement('div');
    progressBarWrap.style.cssText = 'width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin-bottom: 10px;';

    const progressFill = document.createElement('div');
    progressFill.id = 'rating-progress-fill';
    progressFill.style.cssText = 'height: 100%; width: 0%; background: #4CAF50; transition: width 0.3s;';

    progressBarWrap.appendChild(progressFill);

    const statusInfo = document.createElement('div');
    statusInfo.id = 'rating-status-info';
    statusInfo.style.cssText = 'margin-bottom: 15px; font-size: 13px; color: #666;';
    statusInfo.textContent = 'Получено рейтингов: 0';

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'rating-cancel-btn';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.style.cssText = `
        padding: 8px 24px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    cancelBtn.addEventListener('click', () => {
        isCancelled = true;
        cancelBtn.textContent = 'Отменяется...';
        cancelBtn.disabled = true;
        cancelBtn.style.background = '#999';
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

/**
 * Массовый расчёт для всех НП.
 */
/**
 * Массовый расчёт рейтингов для всех НП из текущей таблицы.
 * processed увеличивается только при успешном ответе 200 от GET или POST.
 */
async function calculateRatingsForAllSettlements() {
    // Проверяем галочку
    const isAuto = document.getElementById('auto-rating').checked;
    if (!isAuto) {
        renderPopup('Галочка "Автоматический расчет" не стоит. Выберите НП и нажмите "Таблица рейтингов НП"', true);
        return;
    }

    // Собираем все НП из текущей таблицы (только видимые в DOM)
    const rows = document.querySelectorAll('#settlements-table tbody tr');
    const settlements = [];
    rows.forEach(row => {
        if (row.dataset.id && row.dataset.lat && row.dataset.lon && row.dataset.area) {
            settlements.push({
                id: row.dataset.id,
                lat: parseFloat(row.dataset.lat),
                lon: parseFloat(row.dataset.lon),
                area: parseFloat(row.dataset.area)
            });
        }
    });

    const total = settlements.length;
    if (total === 0) {
        renderPopup('Нет населенных пунктов для расчёта', true);
        return;
    }

    // Сбрасываем флаг отмены и массив результатов
    isCancelled = false;
    allRatings = [];

    // Показываем модальное окно
    const modal = createProgressModal(total);

    let processed = 0;
    let successCount = 0;

    for (const settlement of settlements) {
        if (isCancelled) break;

        console.log(`▶ Обработка НП ID ${settlement.id}...`);

        try {
            let ratingData = null;
            let status200 = false;

            // 1. GET запрос
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

            // 2. Если GET не дал данных — POST
            if (!status200) {
                console.log(`▶ НП ${settlement.id}: отправляем POST...`);
                try {
                    await postRatingSett(settlement.id);
                    // После POST снова GET
                    ratingData = await getRatingSett(settlement.id);
                    if (ratingData !== null && ratingData !== undefined) {
                        status200 = true;
                        console.log(`▶ НП ${settlement.id}: данные получены после POST`);
                    }
                } catch (postErr) {
                    console.warn(`▶ НП ${settlement.id}: POST ошибка`, postErr);
                }
            }

            // 3. Если получили данные — сохраняем и увеличиваем счётчики
            if (status200 && ratingData) {
                allRatings.push(ratingData);
                processed++;
                successCount++;
                console.log(`▶ НП ${settlement.id}: успешно обработан. Всего успешно: ${successCount}`);
            } else {
                console.warn(`▶ НП ${settlement.id}: не удалось получить данные, пропускаем`);
                // Не увеличиваем processed
            }

            // Обновляем прогресс-бар только если НП был успешно обработан
            if (status200) {
                updateProgress(processed, total, successCount);
            }

            // Небольшая задержка, чтобы не перегружать сервер
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`▶ НП ${settlement.id}: критическая ошибка`, error);
            // Не увеличиваем processed
        }
    }

    // Закрываем модальное окно
    closeProgressModal();

    if (isCancelled) {
        renderPopup(`Расчёт отменён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    } else {
        renderPopup(`Расчёт завершён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    }

    // Отображаем все полученные рейтинги в одной таблице
    if (allRatings.length > 0) {
        renderAllRatingsTable(allRatings);
    } else {
        renderPopup('Не удалось получить ни одного рейтинга', true);
    }
}

/**
 * Отображает все полученные рейтинги в одной таблице с русскими названиями.
 */
function renderAllRatingsTable(data) {
    const tableContainer = document.querySelector('.table__rating');
    if (!tableContainer) return;

    const existingRatingTable = document.getElementById('rating-table');
    if (existingRatingTable) existingRatingTable.remove();

    const existingRatingTitle = document.querySelector('.rating-title');
    if (existingRatingTitle) existingRatingTitle.remove();

    const ratingTitle = document.createElement('h3');
    ratingTitle.className = 'rating-title';
    ratingTitle.textContent = 'Рейтинг НП (все)';
    ratingTitle.style.cssText = `
        text-align: center;
        font-size: 18px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 15px 0 10px 0;
        padding-bottom: 8px;
        border-bottom: 2px solid #1a1a1a;
    `;

    const ratingTable = document.createElement('table');
    ratingTable.id = 'rating-table';
    ratingTable.className = 'table__rating__table';

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    ratingTable.appendChild(thead);
    ratingTable.appendChild(tbody);

    if (!data || data.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 2;
        cell.textContent = 'Нет данных рейтинга для отображения';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        row.appendChild(cell);
        tbody.appendChild(row);

        const buttons = tableContainer.querySelector('.table_buttons');
        if (buttons) {
            tableContainer.insertBefore(ratingTitle, buttons);
            tableContainer.insertBefore(ratingTable, buttons);
        } else {
            tableContainer.appendChild(ratingTitle);
            tableContainer.appendChild(ratingTable);
        }
        return;
    }

    const fieldMap = {
        'id': 'ID НП',
        'count_res': 'Всего РЭС',
        'count_res_tv': 'РЭС ТВ',
        'count_res_rv': 'РЭС РВ',
        'count_res_lte': 'РЭС LTE',
        'count_res_gsm': 'РЭС GSM',
        'count_res_5g': 'РЭС 5G',
        'count_res_wifi': 'РЭС Wi-Fi',
        'count_res_tetra': 'РЭС TETRA'
    };

    const allKeys = new Set();
    data.forEach(item => {
        Object.keys(item).forEach(key => allKeys.add(key));
    });
    const fields = Array.from(allKeys).filter(key => key !== 'id');

    const headerRow = document.createElement('tr');
    const idTh = document.createElement('th');
    idTh.textContent = 'ID НП';
    idTh.style.padding = '8px';
    idTh.style.border = '1px solid #ddd';
    idTh.style.backgroundColor = '#f2f2f2';
    headerRow.appendChild(idTh);

    fields.forEach(key => {
        const th = document.createElement('th');
        th.textContent = fieldMap[key] || key;
        th.style.padding = '8px';
        th.style.border = '1px solid #ddd';
        th.style.backgroundColor = '#f2f2f2';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    data.forEach(item => {
        const row = document.createElement('tr');

        const idCell = document.createElement('td');
        idCell.textContent = item.id || '-';
        idCell.style.padding = '6px';
        idCell.style.border = '1px solid #ddd';
        row.appendChild(idCell);

        fields.forEach(key => {
            const cell = document.createElement('td');
            cell.textContent = item[key] !== undefined ? item[key] : '-';
            cell.style.padding = '6px';
            cell.style.border = '1px solid #ddd';
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });

    const buttons = tableContainer.querySelector('.table_buttons');
    if (buttons) {
        tableContainer.insertBefore(ratingTitle, buttons);
        tableContainer.insertBefore(ratingTable, buttons);
    } else {
        tableContainer.appendChild(ratingTitle);
        tableContainer.appendChild(ratingTable);
    }
}

// ==================== ОБРАБОТЧИКИ КНОПОК ====================

// Кнопка "Таблица населенных пунктов"
async function handleSettlementsButton() {
    const regions = getSelectedRegions();
    const popRange = getPopulationRange();
    currentKinds = getSelectedKinds();

    if (regions.length === 0) {
        renderPopup('Выберите хотя бы один регион', true);
        return;
    }

    currentRegions = regions;
    currentPopRange = popRange;

    const pageSize = getPageSize('settlements');
    const result = await loadSettlements(1, regions, popRange, pageSize);

    if (result) {
        settlementsData.items = result.items || [];
        settlementsData.total = result.total || 0;
        settlementsData.page = 1;
        settlementsData.pageSize = pageSize;
        renderSettlementsTable(settlementsData.items, settlementsData.total, settlementsData.page, settlementsData.pageSize);

        renderResTable([], 0, 1, getPageSize('res'));
        selectedSettlementId = null;
        selectedSettlementLat = null;
        selectedSettlementLon = null;
        selectedSettlementArea = null;
        allRatings = [];

        renderPopup(`Загружено ${settlementsData.total} населенных пунктов`);
    }
}

// Кнопка "Таблица рейтингов НП"
async function handleRatingButton() {
    console.log('▶ handleRatingButton: НАЧАЛО');

    const rows = document.querySelectorAll('#settlements-table tbody tr');
    if (rows.length === 0) {
        renderPopup('Сначала загрузите населенные пункты', true);
        return;
    }

    const autoCheckbox = document.getElementById('auto-rating');
    const isAuto = autoCheckbox ? autoCheckbox.checked : false;
    console.log('▶ Галочка "Автоматический расчет":', isAuto ? 'ВКЛ' : 'ВЫКЛ');

    if (isAuto) {
        console.log('▶ Запускаем МАССОВЫЙ расчёт для всех НП');
        await calculateRatingsForAllSettlements();
    } else {
        console.log('▶ Запускаем РУЧНОЙ расчёт для выбранного НП');

        // Если НП не выбран — принудительно выбираем первый
        if (!selectedSettlementId) {
            console.log('▶ selectedSettlementId = null, выбираем первый НП...');
            const firstRow = document.querySelector('#settlements-table tbody tr');
            if (firstRow) {
                firstRow.click();
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        if (!selectedSettlementId) {
            renderPopup('Выберите населенный пункт в таблице', true);
            return;
        }

        console.log('▶ Начинаем загрузку рейтинга для НП', selectedSettlementId);
        const loader = initLoader();
        loader.show('Загрузка рейтинга для НП ' + selectedSettlementId + '...');

        try {
            console.log('▶ Вызываем getRatingSett для ID', selectedSettlementId);
            let ratingData = await getRatingSett(selectedSettlementId);
            console.log('▶ ratingData после getRatingSett:', ratingData);

            if (ratingData === null) {
                console.log('▶ Рейтинг не найден, вызываем postRatingSett');
                await postRatingSett(selectedSettlementId);
                ratingData = await getRatingSett(selectedSettlementId);
                console.log('▶ ratingData после повторного getRatingSett:', ratingData);
            }

            if (ratingData) {
                renderRatingTableSingle(ratingData);
                renderPopup('Рейтинг для НП ' + selectedSettlementId + ' загружен');
            } else {
                renderPopup('Не удалось получить рейтинг для НП ' + selectedSettlementId, true);
            }
            loader.close();
        } catch (error) {
            loader.close();
            renderPopup(`Ошибка загрузки рейтинга: ${error.message}`, true);
            console.error('Ошибка загрузки рейтинга:', error);
        }
    }
}

// Кнопка "Рассчитать рейтинг НП"
async function handleBothButton() {
    await handleSettlementsButton();
    await handleRatingButton();
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

    const settlementsTable = document.getElementById('settlements-table');
    if (settlementsTable) {
        const thead = settlementsTable.querySelector('thead');
        const tbody = settlementsTable.querySelector('tbody');
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '';
    }

    const resTable = document.getElementById('res-table');
    if (resTable) {
        const thead = resTable.querySelector('thead');
        const tbody = resTable.querySelector('tbody');
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '';
    }

    document.getElementById('settlements-pagination').innerHTML = '';
    document.getElementById('res-pagination').innerHTML = '';

    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    const resTitle = document.querySelector('.res-title');
    if (resTitle) resTitle.remove();

    const ratingTable = document.getElementById('rating-table');
    if (ratingTable) ratingTable.remove();

    const ratingTitle = document.querySelector('.rating-title');
    if (ratingTitle) ratingTitle.remove();

    settlementsData = { items: [], total: 0, page: 1, pageSize: 10 };
    resData = { items: [], total: 0, page: 1, pageSize: 10 };
    selectedSettlementId = null;
    selectedSettlementLat = null;
    selectedSettlementLon = null;
    selectedSettlementArea = null;
    allRatings = [];
    isCancelled = false;

    closeProgressModal();

    renderPopup('Фильтры сброшены');
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', function() {
    initLoader();
    loadRegions();
    loadResKindsSelect();

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
                handleSettlementsButton();
            }
            else if (tableType === 'res' && selectedSettlementId) {
                resData.pageSize = newSize;
                loadResForSettlement(
                    selectedSettlementId,
                    selectedSettlementLat,
                    selectedSettlementLon,
                    selectedSettlementArea
                );
            }
        });
    });
});