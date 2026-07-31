// cityRatings.js
'use strict';

import { Loader } from './Loader.js';
import { getRegions, getResKinds, getSettlementsStream, getResStream } from './db.js';

let loader = null;
let abortControllerSettlements = null;
let abortControllerRes = null;
let settlementsData = [];
let resData = [];
let isCancelledSettlements = false;
let isCancelledRes = false;

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
        return { from: 0, to: 17000000 };
    }

    if (radioRange && radioRange.checked) {
        const from = parseInt(fromInput?.value) || 0;
        const to = parseInt(toInput?.value) || 17000000;
        return { from, to };
    }

    return { from: 0, to: 17000000 };
}

// Создание модального окна с двумя прогресс-барами
function createProgressModal() {
    const existing = document.getElementById('progress-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'progress-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        min-width: 400px;
        max-width: 500px;
        text-align: center;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Загрузка данных';
    title.style.cssText = `
        margin: 0 0 20px 0;
        color: #333;
        font-size: 18px;
    `;

    // Прогресс-бар для населенных пунктов
    const settlementsSection = document.createElement('div');
    settlementsSection.style.cssText = `margin-bottom: 20px;`;

    const settlementsLabel = document.createElement('div');
    settlementsLabel.style.cssText = `
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
        font-size: 14px;
        color: #666;
    `;

    const settlementsTitle = document.createElement('span');
    settlementsTitle.textContent = 'Населенные пункты:';

    const settlementsCount = document.createElement('span');
    settlementsCount.id = 'settlements-count';
    settlementsCount.textContent = '0 / 0';

    settlementsLabel.appendChild(settlementsTitle);
    settlementsLabel.appendChild(settlementsCount);

    const settlementsBar = document.createElement('div');
    settlementsBar.style.cssText = `
        width: 100%;
        height: 20px;
        background: #e0e0e0;
        border-radius: 10px;
        overflow: hidden;
    `;

    const settlementsFill = document.createElement('div');
    settlementsFill.id = 'settlements-fill';
    settlementsFill.style.cssText = `
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #4CAF50, #45a049);
        transition: width 0.3s ease;
        border-radius: 10px;
    `;

    settlementsBar.appendChild(settlementsFill);
    settlementsSection.appendChild(settlementsLabel);
    settlementsSection.appendChild(settlementsBar);

    // Прогресс-бар для РЭС
    const resSection = document.createElement('div');
    resSection.style.cssText = `margin-bottom: 20px;`;

    const resLabel = document.createElement('div');
    resLabel.style.cssText = `
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
        font-size: 14px;
        color: #666;
    `;

    const resTitle = document.createElement('span');
    resTitle.textContent = 'РЭС:';

    const resCount = document.createElement('span');
    resCount.id = 'res-count';
    resCount.textContent = '0 / 0';

    resLabel.appendChild(resTitle);
    resLabel.appendChild(resCount);

    const resBar = document.createElement('div');
    resBar.style.cssText = `
        width: 100%;
        height: 20px;
        background: #e0e0e0;
        border-radius: 10px;
        overflow: hidden;
    `;

    const resFill = document.createElement('div');
    resFill.id = 'res-fill';
    resFill.style.cssText = `
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #2196F3, #1976D2);
        transition: width 0.3s ease;
        border-radius: 10px;
    `;

    resBar.appendChild(resFill);
    resSection.appendChild(resLabel);
    resSection.appendChild(resBar);

    // Кнопки отмены
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 10px;
    `;

    const cancelSettlementsBtn = document.createElement('button');
    cancelSettlementsBtn.id = 'cancel-settlements-btn';
    cancelSettlementsBtn.textContent = 'Отменить загрузку населенных пунктов';
    cancelSettlementsBtn.style.cssText = `
        padding: 8px 20px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.2s;
    `;
    cancelSettlementsBtn.addEventListener('mouseover', () => {
        cancelSettlementsBtn.style.background = '#cc0000';
    });
    cancelSettlementsBtn.addEventListener('mouseout', () => {
        cancelSettlementsBtn.style.background = '#ff4444';
    });
    cancelSettlementsBtn.addEventListener('click', cancelSettlementsLoading);

    const cancelResBtn = document.createElement('button');
    cancelResBtn.id = 'cancel-res-btn';
    cancelResBtn.textContent = 'Отменить загрузку РЭС';
    cancelResBtn.style.cssText = `
        padding: 8px 20px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.2s;
    `;
    cancelResBtn.addEventListener('mouseover', () => {
        cancelResBtn.style.background = '#cc0000';
    });
    cancelResBtn.addEventListener('mouseout', () => {
        cancelResBtn.style.background = '#ff4444';
    });
    cancelResBtn.addEventListener('click', cancelResLoading);

    buttonsContainer.appendChild(cancelSettlementsBtn);
    buttonsContainer.appendChild(cancelResBtn);

    modalContent.appendChild(title);
    modalContent.appendChild(settlementsSection);
    modalContent.appendChild(resSection);
    modalContent.appendChild(buttonsContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    return modal;
}

function updateSettlementsProgress(data) {
    const fill = document.getElementById('settlements-fill');
    const countEl = document.getElementById('settlements-count');

    if (fill && data) {
        let percent = 0;
        if (data.total > 0) {
            percent = Math.min((data.count / data.total) * 100, 100);
        } else {
            percent = Math.min((data.count / 100) * 100, 90);
        }
        fill.style.width = percent + '%';
    }

    if (countEl && data) {
        countEl.textContent = `${data.count} / ${data.total || '?'}`;
    }
}

function updateResProgress(data) {
    const fill = document.getElementById('res-fill');
    const countEl = document.getElementById('res-count');

    if (fill && data) {
        let percent = 0;
        if (data.total > 0) {
            percent = Math.min((data.count / data.total) * 100, 100);
        } else {
            percent = Math.min((data.count / 100) * 100, 90);
        }
        fill.style.width = percent + '%';
    }

    if (countEl && data) {
        countEl.textContent = `${data.count} / ${data.total || '?'}`;
    }
}

function completeSettlementsProgress() {
    const fill = document.getElementById('settlements-fill');
    if (fill) {
        fill.style.width = '100%';
    }
}

function completeResProgress() {
    const fill = document.getElementById('res-fill');
    if (fill) {
        fill.style.width = '100%';
    }
}

function cancelSettlementsLoading() {
    if (abortControllerSettlements) {
        isCancelledSettlements = true;
        abortControllerSettlements.abort();
        const btn = document.getElementById('cancel-settlements-btn');
        if (btn) {
            btn.textContent = 'Отменяется...';
            btn.disabled = true;
            btn.style.background = '#999';
            btn.style.cursor = 'not-allowed';
        }
    }
}

function cancelResLoading() {
    if (abortControllerRes) {
        isCancelledRes = true;
        abortControllerRes.abort();
        const btn = document.getElementById('cancel-res-btn');
        if (btn) {
            btn.textContent = 'Отменяется...';
            btn.disabled = true;
            btn.style.background = '#999';
            btn.style.cursor = 'not-allowed';
        }
    }
}

function closeProgressModal() {
    const modal = document.getElementById('progress-modal');
    if (modal) {
        modal.remove();
    }
}

async function loadSettlementsData(body) {
    isCancelledSettlements = false;
    abortControllerSettlements = new AbortController();

    try {
        const result = await getSettlementsStream(
            body,
            updateSettlementsProgress,
            abortControllerSettlements.signal,
            () => {
                isCancelledSettlements = true;
            }
        );
        return result;
    } catch (error) {
        if (error.name === 'AbortError') {
            return null;
        }
        throw error;
    } finally {
        abortControllerSettlements = null;
    }
}

async function loadResData(body) {
    isCancelledRes = false;
    abortControllerRes = new AbortController();

    try {
        const result = await getResStream(
            body,
            updateResProgress,
            abortControllerRes.signal,
            () => {
                isCancelledRes = true;
            }
        );
        return result;
    } catch (error) {
        if (error.name === 'AbortError') {
            return null;
        }
        throw error;
    } finally {
        abortControllerRes = null;
    }
}

function renderSettlementsTable(data) {
    const rating = document.querySelector('.table__rating');
    if (!rating) return;

    // Удаляем старый заголовок, если есть
    const oldTitle = rating.querySelector('.settlements-title');
    if (oldTitle) oldTitle.remove();

    // Создаём заголовок
    const title = document.createElement('h3');
    title.className = 'settlements-title';
    title.textContent = 'Населенные пункты';
    title.style.cssText = `
        text-align: center;
        font-size: 18px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 0 0 12px 0;
        padding-bottom: 8px;
        border-bottom: 2px solid #1a1a1a;
    `;

    // Находим или создаём таблицу
    let table = rating.querySelector('.table__rating__table');
    if (!table) {
        table = document.createElement('table');
        table.className = 'table__rating__table';
        rating.appendChild(table);
    }

    // Вставляем заголовок перед таблицей
    rating.insertBefore(title, table);

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';

    if (!data || data.length === 0) {
        if (tbody) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.textContent = 'Нет населенных пунктов для отображения';
            cell.style.textAlign = 'center';
            cell.style.padding = '20px';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        return;
    }

    if (thead) {
        const headerRow = document.createElement('tr');
        ['ID', 'Название', 'Координаты', 'Население'].forEach(text => {
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
            idCell.textContent = item.id;
            idCell.style.padding = '6px';
            idCell.style.border = '1px solid #ddd';
            row.appendChild(idCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = item.name;
            nameCell.style.padding = '6px';
            nameCell.style.border = '1px solid #ddd';
            row.appendChild(nameCell);

            const coordCell = document.createElement('td');
            coordCell.textContent = `${item.lat.toFixed(4)}, ${item.lon.toFixed(4)}`;
            coordCell.style.padding = '6px';
            coordCell.style.border = '1px solid #ddd';
            row.appendChild(coordCell);

            const popCell = document.createElement('td');
            popCell.textContent = item.population;
            popCell.style.padding = '6px';
            popCell.style.border = '1px solid #ddd';
            row.appendChild(popCell);

            tbody.appendChild(row);
        });
    }
}

function renderResTable(data) {
    const rating = document.querySelector('.table__rating');
    if (!rating) return;

    // Находим кнопки
    const buttons = rating.querySelector('.table_buttons');

    // Находим первую таблицу (населённые пункты)
    const firstTable = rating.querySelector('.table__rating__table');

    // Удаляем старый заголовок РЭС, если есть
    const oldTitle = rating.querySelector('.res-title');
    if (oldTitle) oldTitle.remove();

    // Удаляем старую таблицу РЭС, если есть
    const existingResTable = document.getElementById('res-table');
    if (existingResTable) existingResTable.remove();

    // Создаём заголовок
    const title = document.createElement('h3');
    title.className = 'res-title';
    title.textContent = 'РЭС';
    title.style.cssText = `
        text-align: center;
        font-size: 18px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 10px 0px 12px 0;
        padding-bottom: 8px;
        border-bottom: 2px solid #1a1a1a;
    `;

    // Создаём новую таблицу для РЭС
    const resTable = document.createElement('table');
    resTable.id = 'res-table';
    resTable.className = 'table__rating__table';

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    resTable.appendChild(thead);
    resTable.appendChild(tbody);

    if (!data || data.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 3;
        cell.textContent = 'Нет РЭС для отображения';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        row.appendChild(cell);
        tbody.appendChild(row);

        // Вставляем заголовок и таблицу ПЕРЕД кнопками, ПОСЛЕ первой таблицы
        if (firstTable && buttons) {
            rating.insertBefore(title, buttons);
            rating.insertBefore(resTable, buttons);
        } else {
            rating.appendChild(title);
            rating.appendChild(resTable);
        }
        return;
    }

    // Заголовки таблицы
    const headerRow = document.createElement('tr');
    ['ID', 'Широта', 'Долгота'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        th.style.padding = '8px';
        th.style.border = '1px solid #ddd';
        th.style.backgroundColor = '#f2f2f2';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Данные
    data.forEach(item => {
        const row = document.createElement('tr');

        const idCell = document.createElement('td');
        idCell.textContent = item.id || '-';
        idCell.style.padding = '6px';
        idCell.style.border = '1px solid #ddd';
        row.appendChild(idCell);

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

        tbody.appendChild(row);
    });

    // Вставляем заголовок и таблицу ПЕРЕД кнопками, ПОСЛЕ первой таблицы
    if (firstTable && buttons) {
        rating.insertBefore(title, buttons);
        rating.insertBefore(resTable, buttons);
    } else {
        rating.appendChild(title);
        rating.appendChild(resTable);
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const regions = getSelectedRegions();
    const kinds = getSelectedKinds();
    const popRange = getPopulationRange();

    console.log('Фильтры:', {
        regions,
        kinds,
        popRange
    });

    if (regions.length === 0) {
        renderPopup('Выберите хотя бы один регион', true);
        return;
    }

    isCancelledSettlements = false;
    isCancelledRes = false;
    settlementsData = [];
    resData = [];

    if (abortControllerSettlements) {
        abortControllerSettlements.abort();
        abortControllerSettlements = null;
    }
    if (abortControllerRes) {
        abortControllerRes.abort();
        abortControllerRes = null;
    }

    createProgressModal();

    const settlementsBody = {
        regions: regions,
        population_filters: [
            {
                from: popRange.from,
                to: popRange.to
            }
        ]
    };

    const resBody = {
        regions: regions,
        kinds: kinds
    };

    try {
        // Загружаем населенные пункты
        const settlementsResult = await loadSettlementsData(settlementsBody);

        if (isCancelledSettlements) {
            if (settlementsResult && settlementsResult.data.length > 0) {
                renderSettlementsTable(settlementsResult.data);
                renderPopup(`Загружено ${settlementsResult.data.length} населенных пунктов (загрузка отменена)`);
            }
        } else if (settlementsResult) {
            settlementsData = settlementsResult.data;

            // ✅ ОТРИСОВКА ТОЛЬКО ПОСЛЕ ПОЛНОЙ ЗАГРУЗКИ
            renderSettlementsTable(settlementsData);

            // ✅ Ставим 100% и показываем точное количество
            completeSettlementsProgress();
            const settlementsCountEl = document.getElementById('settlements-count');
            if (settlementsCountEl) {
                settlementsCountEl.textContent = `${settlementsData.length} / ${settlementsData.length}`;
            }
        }

        // Загружаем РЭС (всегда, независимо от отмены населенных пунктов)
        const resResult = await loadResData(resBody);

        if (isCancelledRes) {
            if (resResult && resResult.data.length > 0) {
                renderResTable(resResult.data);
                renderPopup(`Загружено ${resResult.data.length} РЭС (загрузка отменена)`);
            }
            closeProgressModal();
            return;
        }

        if (resResult) {
            resData = resResult.data;

            // ✅ ОТРИСОВКА ТОЛЬКО ПОСЛЕ ПОЛНОЙ ЗАГРУЗКИ
            renderResTable(resData);

            // ✅ Ставим 100% и показываем точное количество
            completeResProgress();
            const resCountEl = document.getElementById('res-count');
            if (resCountEl) {
                resCountEl.textContent = `${resData.length} / ${resData.length}`;
            }
        }

        setTimeout(() => {
            closeProgressModal();
            const totalSettlementsCount = settlementsData.length;
            const totalResCount = resData.length;
            renderPopup(`Загружено: ${totalSettlementsCount} населенных пунктов, ${totalResCount} РЭС`);
        }, 500);

    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        if (error.name !== 'AbortError') {
            renderPopup(`Ошибка: ${error.message}`, true);
        }
        closeProgressModal();
    }
}

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

    // Очищаем основную таблицу
    const table = document.querySelector('.table__rating__table');
    if (table) {
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '';
    }

    // Удаляем таблицу РЭС
    const resTable = document.getElementById('res-table');
    if (resTable) resTable.remove();

    // Удаляем заголовки таблиц
    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    const resTitle = document.querySelector('.res-title');
    if (resTitle) resTitle.remove();

    // Очищаем данные
    settlementsData = [];
    resData = [];

    // Закрываем модальное окно если открыто
    closeProgressModal();

    renderPopup('Фильтры сброшены');
}

document.addEventListener('DOMContentLoaded', function() {
    initLoader();
    loadRegions();
    loadResKindsSelect();

    const form = document.querySelector('.form__rating');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    const clearBtn = document.querySelector('.form__rating + button.grid-btn') ||
        document.querySelector('button.grid-btn:not([type="submit"])');
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClear);
    }

    const exitBtn = document.getElementById('exit');
    if (exitBtn) {
        exitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.close();
            setTimeout(() => {
                window.location.href = '/';
            }, 100);
        });
    }
});