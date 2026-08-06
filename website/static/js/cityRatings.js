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

// Текущий выбранный НП для загрузки РЭС
let selectedSettlementId = null;
let selectedSettlementLat = null;
let selectedSettlementLon = null;
let selectedSettlementArea = null;

// Текущие фильтры
let currentRegions = [];
let currentKinds = [];
let currentPopRange = { from: 1, to: 17000000 };

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

        // Преобразуем ответ сервера в ожидаемый формат
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

    // ===== ДОБАВЛЕНО: ЗАГОЛОВОК ТАБЛИЦЫ =====
    const oldSettlementsTitle = document.querySelector('.settlements-title');
    if (oldSettlementsTitle) oldSettlementsTitle.remove();

    const settlementsTitle = document.createElement('h3');
    settlementsTitle.className = 'settlements-title';
    settlementsTitle.textContent = 'Населенные пункты';
    table.parentNode.insertBefore(settlementsTitle, table);

    // ===== ДАЛЬШЕ ВАШ КОД БЕЗ ИЗМЕНЕНИЙ =====
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

    // Заголовки (все поля из ответа сервера)
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

    // Данные
    if (tbody) {
        data.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id;
            row.dataset.lat = item.lat;
            row.dataset.lon = item.lon;
            row.dataset.area = item.area || 1;
            row.style.cursor = 'pointer';

            // ID
            const idCell = document.createElement('td');
            idCell.textContent = item.id;
            idCell.style.padding = '6px';
            idCell.style.border = '1px solid #ddd';
            row.appendChild(idCell);

            // Название
            const nameCell = document.createElement('td');
            nameCell.textContent = item.name || '-';
            nameCell.style.padding = '6px';
            nameCell.style.border = '1px solid #ddd';
            row.appendChild(nameCell);

            // Площадь
            const areaCell = document.createElement('td');
            areaCell.textContent = item.area !== null && item.area !== undefined ? item.area : '-';
            areaCell.style.padding = '6px';
            areaCell.style.border = '1px solid #ddd';
            row.appendChild(areaCell);

            // Регион
            const regionNameCell = document.createElement('td');
            regionNameCell.textContent = item.region_name || '-';
            regionNameCell.style.padding = '6px';
            regionNameCell.style.border = '1px solid #ddd';
            row.appendChild(regionNameCell);

            // Код региона
            const regionCodeCell = document.createElement('td');
            regionCodeCell.textContent = item.region_code || '-';
            regionCodeCell.style.padding = '6px';
            regionCodeCell.style.border = '1px solid #ddd';
            row.appendChild(regionCodeCell);

            // Муниципальное образование
            const districtCell = document.createElement('td');
            districtCell.textContent = item.district_name || '-';
            districtCell.style.padding = '6px';
            districtCell.style.border = '1px solid #ddd';
            row.appendChild(districtCell);

            // Широта
            const latCell = document.createElement('td');
            latCell.textContent = item.lat !== undefined ? item.lat.toFixed(6) : '-';
            latCell.style.padding = '6px';
            latCell.style.border = '1px solid #ddd';
            row.appendChild(latCell);

            // Долгота
            const lonCell = document.createElement('td');
            lonCell.textContent = item.lon !== undefined ? item.lon.toFixed(6) : '-';
            lonCell.style.padding = '6px';
            lonCell.style.border = '1px solid #ddd';
            row.appendChild(lonCell);

            // Население
            const popCell = document.createElement('td');
            popCell.textContent = item.population || 0;
            popCell.style.padding = '6px';
            popCell.style.border = '1px solid #ddd';
            row.appendChild(popCell);

            // Код ФИАС
            const fiasCell = document.createElement('td');
            fiasCell.textContent = item.fias_id || '-';
            fiasCell.style.padding = '6px';
            fiasCell.style.border = '1px solid #ddd';
            row.appendChild(fiasCell);

            // Клик по строке - загружаем РЭС для этого НП
            row.addEventListener('click', function() {
                // Снимаем выделение со всех строк
                document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
                    tr.classList.remove('selected');
                    tr.style.backgroundColor = '';
                });
                // Выделяем текущую строку через класс
                this.classList.add('selected');

                // Сохраняем данные выбранного НП
                selectedSettlementId = this.dataset.id;
                selectedSettlementLat = parseFloat(this.dataset.lat);
                selectedSettlementLon = parseFloat(this.dataset.lon);
                selectedSettlementArea = parseFloat(this.dataset.area);

                // Загружаем РЭС для этого НП
                loadResForSettlement(selectedSettlementId, selectedSettlementLat, selectedSettlementLon, selectedSettlementArea);

                // ✅ ДОБАВЛЕНО: обновляем таблицу рейтинга, если она уже была открыта
                const existingRatingTable = document.getElementById('rating-table');
                if (existingRatingTable) {
                    handleRatingButton();
                }
            });

            tbody.appendChild(row);
        });
    }

    renderSettlementsPagination(total, page, pageSize);

    // ✅ Автоматически выбираем первый населенный пункт и загружаем РЭС
    if (data && data.length > 0) {
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
            // Имитируем клик по первой строке
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

    // Всегда показываем первую страницу
    if (currentPage > 1) {
        html += `<button class="pagination-btn" data-page="1">1</button>`;
    } else {
        html += `<button class="pagination-btn active" data-page="1">1</button>`;
    }

    // Если между 1 и текущей страницей есть пропуск — показываем троеточие
    if (currentPage > 3) {
        html += `<span class="pagination-ellipsis">…</span>`;
    }

    // Показываем страницы вокруг текущей (кроме 1 и последней, если они уже показаны)
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    for (let i = startPage; i <= endPage; i++) {
        if (i === 1 || i === totalPages) continue; // уже показаны
        const isActive = i === currentPage;
        html += `<button class="pagination-btn ${isActive ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    // Если между текущей и последней страницей есть пропуск — показываем троеточие
    if (currentPage < totalPages - 2) {
        html += `<span class="pagination-ellipsis">…</span>`;
    }

    // Всегда показываем последнюю страницу (если она не равна 1)
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

    // Обработчики кликов
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
        // Рассчитываем радиус НП по формуле (округляем до целого)
        const radius = calculateRadius(area);

        // Формируем body для getResPage
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

    // ===== ДОБАВЛЕНО: ЗАГОЛОВОК ТАБЛИЦЫ =====
    const oldResTitle = document.querySelector('.res-title');
    if (oldResTitle) oldResTitle.remove();

    const resTitle = document.createElement('h3');
    resTitle.className = 'res-title';
    resTitle.textContent = 'РЭС';
    table.parentNode.insertBefore(resTitle, table);

    // ===== ДАЛЬШЕ ВАШ КОД БЕЗ ИЗМЕНЕНИЙ =====
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

    // Заголовки (все поля из ответа сервера)
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

    // Данные
    if (tbody) {
        data.forEach(item => {
            const row = document.createElement('tr');

            // ID
            const idCell = document.createElement('td');
            idCell.textContent = item.id || '-';
            idCell.style.padding = '6px';
            idCell.style.border = '1px solid #ddd';
            row.appendChild(idCell);

            // type_id
            const typeIdCell = document.createElement('td');
            typeIdCell.textContent = item.type_id || '-';
            typeIdCell.style.padding = '6px';
            typeIdCell.style.border = '1px solid #ddd';
            row.appendChild(typeIdCell);

            // kind_id
            const kindIdCell = document.createElement('td');
            kindIdCell.textContent = item.kind_id || '-';
            kindIdCell.style.padding = '6px';
            kindIdCell.style.border = '1px solid #ddd';
            row.appendChild(kindIdCell);

            // name
            const nameCell = document.createElement('td');
            nameCell.textContent = item.name || '-';
            nameCell.style.padding = '6px';
            nameCell.style.border = '1px solid #ddd';
            row.appendChild(nameCell);

            // operator
            const operatorCell = document.createElement('td');
            operatorCell.textContent = item.operator || '-';
            operatorCell.style.padding = '6px';
            operatorCell.style.border = '1px solid #ddd';
            row.appendChild(operatorCell);

            // location
            const locationCell = document.createElement('td');
            locationCell.textContent = item.location || '-';
            locationCell.style.padding = '6px';
            locationCell.style.border = '1px solid #ddd';
            row.appendChild(locationCell);

            // region_id
            const regionIdCell = document.createElement('td');
            regionIdCell.textContent = item.region_id || '-';
            regionIdCell.style.padding = '6px';
            regionIdCell.style.border = '1px solid #ddd';
            row.appendChild(regionIdCell);

            // lat_str
            const latStrCell = document.createElement('td');
            latStrCell.textContent = item.lat_str || '-';
            latStrCell.style.padding = '6px';
            latStrCell.style.border = '1px solid #ddd';
            row.appendChild(latStrCell);

            // lon_str
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

    // Всегда показываем первую страницу
    if (currentPage > 1) {
        html += `<button class="pagination-btn" data-page="1">1</button>`;
    } else {
        html += `<button class="pagination-btn active" data-page="1">1</button>`;
    }

    // Если между 1 и текущей страницей есть пропуск — показываем троеточие
    if (currentPage > 3) {
        html += `<span class="pagination-ellipsis">…</span>`;
    }

    // Показываем страницы вокруг текущей (кроме 1 и последней)
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    for (let i = startPage; i <= endPage; i++) {
        if (i === 1 || i === totalPages) continue;
        const isActive = i === currentPage;
        html += `<button class="pagination-btn ${isActive ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    // Если между текущей и последней страницей есть пропуск — показываем троеточие
    if (currentPage < totalPages - 2) {
        html += `<span class="pagination-ellipsis">…</span>`;
    }

    // Всегда показываем последнюю страницу
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

// ==================== ОТОБРАЖЕНИЕ ТАБЛИЦЫ РЕЙТИНГА ====================

function renderRatingTable(data) {
    const tableContainer = document.querySelector('.table__rating');
    if (!tableContainer) return;

    // Удаляем старую таблицу рейтинга и заголовок, если есть
    const existingRatingTable = document.getElementById('rating-table');
    if (existingRatingTable) existingRatingTable.remove();

    const existingRatingTitle = document.querySelector('.rating-title');
    if (existingRatingTitle) existingRatingTitle.remove();

    // Создаём заголовок ВСЕГДА (даже если данных нет)
    const ratingTitle = document.createElement('h3');
    ratingTitle.className = 'rating-title';
    ratingTitle.textContent = 'Рейтинг НП';
    ratingTitle.style.cssText = `
        text-align: center;
        font-size: 18px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 15px 0 10px 0;
        padding-bottom: 8px;
        border-bottom: 2px solid #1a1a1a;
    `;

    // Создаём таблицу ВСЕГДА
    const ratingTable = document.createElement('table');
    ratingTable.id = 'rating-table';
    ratingTable.className = 'table__rating__table';

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    ratingTable.appendChild(thead);
    ratingTable.appendChild(tbody);

    // Вставляем заголовок и таблицу в конец .table__rating (перед кнопками)
    const buttons = tableContainer.querySelector('.table_buttons');
    if (buttons) {
        tableContainer.insertBefore(ratingTitle, buttons);
        tableContainer.insertBefore(ratingTable, buttons);
    } else {
        tableContainer.appendChild(ratingTitle);
        tableContainer.appendChild(ratingTable);
    }

    // Если данных нет — показываем сообщение и выходим
    if (!data || Object.keys(data).length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 2;
        cell.textContent = 'Нет данных рейтинга для отображения';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    // Заголовки таблицы
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

        // Сбрасываем таблицу РЭС
        renderResTable([], 0, 1, getPageSize('res'));
        selectedSettlementId = null;
        selectedSettlementLat = null;
        selectedSettlementLon = null;
        selectedSettlementArea = null;

        renderPopup(`Загружено ${settlementsData.total} населенных пунктов`);
    }
}

// Кнопка "Таблица рейтингов НП"
async function handleRatingButton() {
    console.log('▶ handleRatingButton: НАЧАЛО');

    // Получаем текущие фильтры из формы
    const regions = getSelectedRegions();
    const popRange = getPopulationRange();
    const kinds = getSelectedKinds();

    // Если фильтры изменились — сбрасываем выбранный НП и перезагружаем таблицу НП
    const regionsChanged = JSON.stringify(regions) !== JSON.stringify(currentRegions);
    const popRangeChanged = popRange.from !== currentPopRange.from || popRange.to !== currentPopRange.to;
    const kindsChanged = JSON.stringify(kinds) !== JSON.stringify(currentKinds);

    if (regionsChanged || popRangeChanged || kindsChanged) {
        console.log('▶ Фильтры изменились, перезагружаем таблицу НП...');
        selectedSettlementId = null;
        currentRegions = regions;
        currentPopRange = popRange;
        currentKinds = kinds;
        await handleSettlementsButton();
    }

    // Если нет выбранного НП — выбираем первый
    if (!selectedSettlementId) {
        console.log('▶ Нет выбранного НП, выбираем первый...');
        const firstRow = document.querySelector('#settlements-table tbody tr');
        if (firstRow) {
            firstRow.click();
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (!selectedSettlementId) {
            renderPopup('Не удалось выбрать населенный пункт', true);
            return;
        }
    }

    console.log('▶ Загружаем рейтинг для НП', selectedSettlementId);
    const loader = initLoader();
    loader.show('Загрузка рейтинга для НП ' + selectedSettlementId + '...');

    try {
        let ratingData = await getRatingSett(selectedSettlementId);
        console.log('▶ ratingData после getRatingSett:', ratingData);

        if (ratingData === null) {
            console.log('▶ Рейтинг не найден, вызываем POST');

            // Закрываем текущий лоадер и показываем новый для POST
            loader.close();

            const postLoader = initLoader();
            postLoader.show('Создание рейтинга для НП ' + selectedSettlementId + '...');

            await postRatingSett(selectedSettlementId);

            postLoader.close();

            // Снова пытаемся получить рейтинг
            ratingData = await getRatingSett(selectedSettlementId);
        }

        if (ratingData) {
            renderRatingTable(ratingData);
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

// Кнопка "Рассчитать рейтинг НП" (выполняет обе функции последовательно)
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

    // Очищаем таблицы
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

    // Очищаем пагинацию
    document.getElementById('settlements-pagination').innerHTML = '';
    document.getElementById('res-pagination').innerHTML = '';

    // Удаляем заголовки таблиц НП и РЭС
    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    const resTitle = document.querySelector('.res-title');
    if (resTitle) resTitle.remove();

    // Удаляем таблицу рейтинга и её заголовок
    const ratingTable = document.getElementById('rating-table');
    if (ratingTable) ratingTable.remove();

    const ratingTitle = document.querySelector('.rating-title');
    if (ratingTitle) ratingTitle.remove();

    // Очищаем данные
    settlementsData = { items: [], total: 0, page: 1, pageSize: 10 };
    resData = { items: [], total: 0, page: 1, pageSize: 10 };
    selectedSettlementId = null;
    selectedSettlementLat = null;
    selectedSettlementLon = null;
    selectedSettlementArea = null;

    renderPopup('Фильтры сброшены');
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', function() {
    initLoader();
    loadRegions();
    loadResKindsSelect();

    // Привязка кнопок
    document.getElementById('btn-settlements').addEventListener('click', handleSettlementsButton);
    document.getElementById('btn-rating').addEventListener('click', handleRatingButton);
    document.getElementById('btn-both').addEventListener('click', handleBothButton);

    // Привязка очистки
    const clearBtn = document.querySelector('.form__rating + button.grid-btn') ||
        document.querySelector('button.grid-btn:not([type="submit"])');
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClear);
    }

    // Привязка кнопки "Закрыть"
    const closeBtn = document.getElementById('close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.close(); // закрываем вкладку
            // Если окно не закрылось (например, открыто не через window.open), то запасной вариант:
            setTimeout(() => {
                if (!window.closed) {
                    window.location.href = '/';
                }
            }, 100);
        });
    }

    // Слушатели изменения размера страницы (селекты)
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