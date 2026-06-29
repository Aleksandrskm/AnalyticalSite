'use strict';

import {
    editRow,
    deleteRow,
    insertRow,
    postJSON,
    getRowsTable,
    changeQuery,
    selectQuery,
    getDistanceBeam,
    updateOrInsert,
    getSatelliteGroups,
    getSatellitesByGroup,
    getSatelliteBeams,
    getDbNames
} from './db.js';
import { Loader } from './Loader.js';

// Глобальные переменные
let tableInfoBeams = [];
let tableValuesBeams = [];
let currentSatelliteId = null;
let currentGroup = '';
let currentPage = 1;
let pageSize = 10;
let totalSatellites = 0;
let loader = null;
let currentDbName = 'KA'; // Текущая выбранная БД

// Кэш для информации о таблице
let tableColumnsInfo = null;
let currentTableName = '';

// Инициализация загрузчика
function initLoader() {
    if (!loader) {
        loader = new Loader('.loader-container');
    }
    return loader;
}

// Функция отображения всплывающего сообщения
function renderPopup(popupElement, message) {
    const div = document.createElement("div");
    const p = document.createElement("p");
    popupElement.innerHTML = '';
    p.innerHTML = message;
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

// Функция отрисовки круга на канвасе
function drawCircle(centerY, centerX, radius, color, lineWidth = 1, text = '') {
    const canvas = document.getElementById("canvas");
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    if (text !== "") {
        const fontSize = Math.min(radius * 0.6, 14);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color;
        ctx.fillText(text, centerX, centerY);
    }
}

// Функция отрисовки строки луча
function drawsTrBeam(tr, flagSelected = true, color = 'black', lineWidth = 1) {
    if (!tr) return;

    if (flagSelected) {
        tr.classList.add('selected');
    }

    const children = tr.children;
    if (!children || children.length < 6) return;

    const beamNumber = children[1]?.innerHTML || '';
    const distanceBeam = parseFloat(children[3]?.innerHTML) || 0;
    const radius = (parseFloat(children[5]?.innerHTML) / 1000) * 0.125 || 10;
    const azimuth = parseFloat(children[4]?.innerHTML) || 0;

    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    const angleRad = (180 - azimuth) * (Math.PI / 180);
    const distancePx = (distanceBeam * 0.125) / 1000;

    const centerX = 350 + distancePx * Math.sin(angleRad);
    const centerY = 350 + distancePx * Math.cos(angleRad);

    drawCircle(centerY, centerX, radius, color, lineWidth, beamNumber);
}

// Очистка канваса и перерисовка всех лучей
function clearCanvas() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCircle(350, 350, 312.5, 'gray');

    const trsBeams = document.querySelectorAll('.beams-Table tbody tr');
    trsBeams.forEach((tr) => {
        drawsTrBeam(tr, false);
    });
}

// Закрытие вкладки
function closeTab() {
    window.close();
}

// Получение текущего размера страницы
function getPageSize() {
    const mainInput = document.getElementById('page-size-input');
    if (mainInput && mainInput.value) {
        const val = parseInt(mainInput.value);
        if (!isNaN(val) && val > 0) {
            return val;
        }
    }
    return pageSize;
}

// Получение информации о полях таблицы
async function getTableColumnsInfo(tableName, dbName = 'KA') {
    if (tableColumnsInfo && currentTableName === tableName) {
        return tableColumnsInfo;
    }

    try {
        const data = { name: tableName };
        const result = await postJSON(data, dbName);
        if (result && result.columns_info) {
            tableColumnsInfo = result.columns_info;
            currentTableName = tableName;
            return tableColumnsInfo;
        }
        return null;
    } catch (error) {
        console.error('Ошибка получения информации о таблице:', error);
        return null;
    }
}

// Генерация SQL запроса для обновления всех лучей одним запросом
function generateBeamUpdateQuery(tableName, arrDataBeams, arrIdBeams, idKa, columnsInfo, updateColumns) {
    if (arrIdBeams.length === 0 || updateColumns.length === 0) {
        return '';
    }

    const columnsCount = updateColumns.length;

    const caseStatements = updateColumns.map((column, colIndex) => {
        const cases = arrIdBeams.map((id, idIndex) => {
            const valueIndex = idIndex * columnsCount + colIndex;
            let value = arrDataBeams[valueIndex];
            if (!isNaN(parseFloat(value)) && isFinite(value)) {
                const numVal = parseFloat(value);
                if (Number.isInteger(numVal)) {
                    value = parseInt(numVal);
                } else {
                    value = numVal.toFixed(6);
                }
            }
            return `WHEN ID = ${id} THEN ${value}`;
        }).join(' ');
        return `${column} = CASE ${cases} ELSE ${column} END`;
    }).join(', ');

    return `UPDATE ${tableName} SET ${caseStatements} WHERE ID IN (${arrIdBeams.join(', ')}) AND ID_KA = ${idKa};`;
}

// Функция обновления состояния кнопок
function updateButtonsState() {
    const beamRows = document.querySelectorAll('.beams-Table tbody tr');
    const hasBeams = beamRows && beamRows.length > 0;

    const saveBtn = document.getElementById('save-beams');
    const copyBtn = document.getElementById('copy-beams-Kas');
    const editBtn = document.getElementById('edit-beams');

    if (saveBtn) {
        saveBtn.disabled = !hasBeams;
        saveBtn.style.opacity = hasBeams ? '1' : '0.5';
        saveBtn.style.cursor = hasBeams ? 'pointer' : 'not-allowed';
    }

    if (copyBtn) {
        copyBtn.disabled = !hasBeams;
        copyBtn.style.opacity = hasBeams ? '1' : '0.5';
        copyBtn.style.cursor = hasBeams ? 'pointer' : 'not-allowed';
    }

    if (editBtn) {
        editBtn.disabled = !hasBeams;
        editBtn.style.opacity = hasBeams ? '1' : '0.5';
        editBtn.style.cursor = hasBeams ? 'pointer' : 'not-allowed';
    }
}

// ==================== НОВАЯ ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ СПИСКА БД ====================

async function loadDbNames() {
    const loader = initLoader();
    loader.show('Загрузка списка БД...');

    try {
        const dbNames = await getDbNames();
        const select = document.getElementById('db-select');
        if (!select) return;

        select.innerHTML = '';

        dbNames.forEach(dbName => {
            const option = document.createElement('option');
            option.value = dbName;
            option.textContent = dbName;
            select.appendChild(option);
        });

        // Устанавливаем значение по умолчанию 'KA'
        if (dbNames.includes('KA')) {
            select.value = 'KA';
        } else if (dbNames.length > 0) {
            select.value = dbNames[0];
        }
        currentDbName = select.value;

        loader.close();
        return dbNames;
    } catch (error) {
        loader.close();
        renderPopup(document.querySelector('#dialog-res'), `Ошибка загрузки списка БД: ${error}`);
        return [];
    }
}

// Загрузка группировок
async function loadGroups(dbName = 'KA') {
    const loader = initLoader();
    loader.show('Загрузка группировок...');

    try {
        const groups = await getSatelliteGroups(dbName);
        const select = document.getElementById('ka-group-select');
        if (!select) return;

        select.innerHTML = '';

        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            select.appendChild(option);
        });

        if (groups.length > 0) {
            select.value = groups[0];
            currentGroup = groups[0];
        }

        loader.close();
        return groups;
    } catch (error) {
        loader.close();
        renderPopup(document.querySelector('#dialog-res'), `Ошибка загрузки группировок: ${error}`);
        return [];
    }
}

// Создание таблицы КА с пагинацией
async function createKATable(page = 1, dbName = 'KA') {
    const loader = initLoader();
    loader.show('Загрузка спутников...');

    const groupSelect = document.getElementById('ka-group-select');
    const group = groupSelect ? groupSelect.value : currentGroup;
    currentGroup = group;
    currentPage = page;
    currentDbName = dbName;

    const currentPageSize = getPageSize();
    pageSize = currentPageSize;

    try {
        const data = await getSatellitesByGroup(group, page, currentPageSize, dbName);

        const tbody = document.querySelector('.KA-Table tbody');
        const thead = document.querySelector('.KA-Table thead');
        if (!tbody || !thead) return;

        tbody.innerHTML = '';
        thead.innerHTML = '';

        const trHead = document.createElement('tr');
        ['ID', 'Наименование КА', 'Номер орбиты'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);

        totalSatellites = data.total || data.length || 0;
        const satellites = data.satellites || data.items || data;

        if (Array.isArray(satellites) && satellites.length > 0) {
            satellites.forEach((satellite, index) => {
                const tr = document.createElement('tr');
                const satId = satellite.id || satellite.ID || index;
                tr.id = satId;
                tr.classList.add('ka-element');
                tr.dataset.id = satId;

                const id = satId;
                const name = satellite.name || satellite.NAME || satellite.Наименование_КА || '-';
                const orbit = satellite.orbit_number || satellite.ORBIT_NUMBER || satellite.Номер_орбиты || '-';

                tr.innerHTML = `<td>${id}</td><td>${name}</td><td>${orbit}</td>`;
                tbody.appendChild(tr);
            });
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="3" style="text-align: center;">Нет спутников в группе "${group}"</td>`;
            tbody.appendChild(tr);
        }

        updatePagination();

        document.querySelectorAll('.ka-element').forEach(ka => {
            ka.addEventListener('click', selectFirstKa);
        });

        const firstRow = document.querySelector('.KA-Table tbody tr');
        if (firstRow && firstRow.cells.length > 1) {
            selectFirstRow();
        } else {
            document.querySelector('.beams-Table').innerHTML = '<thead></thead><tbody></tbody>';
            document.getElementById('id-ka').innerHTML = 'КА:';
            document.getElementById('ka-name').innerHTML = '';
            clearCanvas();
            updateButtonsState();
        }

        loader.close();
    } catch (error) {
        loader.close();
        renderPopup(document.querySelector('#dialog-res'), `Ошибка загрузки спутников: ${error}`);
    }
}

// Обновление пагинации
function updatePagination() {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    const currentPageSize = getPageSize();
    const totalPages = Math.ceil(totalSatellites / currentPageSize) || 1;

    paginationContainer.innerHTML = `
        <button class="pagination-btn" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>◀</button>
        <span class="pagination-info">Страница ${currentPage} из ${totalPages} (всего: ${totalSatellites})</span>
        <button class="pagination-btn" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>▶</button>
        <div class="page-size-wrapper">
            <label for="page-size-input-pagination">Размер:</label>
            <input type="number" id="page-size-input-pagination" class="page-size-input" value="${currentPageSize}" min="1" max="100">
        </div>
    `;

    const pageSizeInputPagination = document.getElementById('page-size-input-pagination');
    if (pageSizeInputPagination) {
        pageSizeInputPagination.addEventListener('change', function() {
            const newSize = parseInt(this.value) || 10;
            const mainInput = document.getElementById('page-size-input');
            if (mainInput) mainInput.value = newSize;
            pageSize = newSize;
        });
    }

    paginationContainer.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const direction = btn.dataset.page;
            let newPage = currentPage;
            if (direction === 'prev' && currentPage > 1) newPage = currentPage - 1;
            if (direction === 'next' && currentPage < totalPages) newPage = currentPage + 1;
            if (newPage !== currentPage) {
                createKATable(newPage, currentDbName);
            }
        });
    });
}

// Создание таблицы лучей
async function createBeamTable(satelliteId, dbName = 'KA') {
    const loader = initLoader();
    loader.show('Загрузка лучей...');

    const beamType = document.querySelector('input[name="type_beams"]:checked')?.value || 'KA_BEAM_PRD';
    const beamTypeApi = beamType === 'KA_BEAM_PRD' ? 'transmitting' : 'receiving';

    try {
        const beams = await getSatelliteBeams(satelliteId, beamTypeApi, dbName);
        console.log('Получены лучи:', beams);

        const thead = document.querySelector('.beams-Table thead');
        const tbody = document.querySelector('.beams-Table tbody');
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '';

        if (!beams || beams.length === 0) {
            loader.close();
            document.querySelector('.tab-Beams-name').innerHTML = 'Нет лучей для данного КА';
            clearCanvas();
            updateButtonsState();
            return;
        }

        const typeBeams = beamType === 'KA_BEAM_PRD' ? 'по передаче' : 'по приему';
        document.querySelector('.tab-Beams-name').innerHTML = `Характеристики лучей ${typeBeams}`;

        const trHead = document.createElement('tr');
        const columns = [
            { key: 'id', label: 'ID' },
            { key: 'num_beam', label: 'Номер луча' },
            { key: 'um_beam', label: 'Угол места луча, градус' },
            { key: 'd_t', label: 'Дальность центра луча от подспутниковой точки КА, метры' },
            { key: 'az_t', label: 'Азимут луча относительно орбиты КА, градус' },
            { key: 'r_t', label: 'Усредненный радиус луча, м' }
        ];

        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label;
            th.id = col.key;
            trHead.appendChild(th);
        });
        if (thead) thead.appendChild(trHead);

        tableValuesBeams = [];
        const sortedBeams = [...beams].sort((a, b) => (a.num_beam || a.number || 0) - (b.num_beam || b.number || 0));

        sortedBeams.forEach((beam, index) => {
            const tr = document.createElement('tr');
            tr.classList.add('beams-element');
            tr.dataset.id = beam.id || index;

            const rowData = [];
            columns.forEach(col => {
                const td = document.createElement('td');
                let value = beam[col.key];
                if (value === undefined || value === null) {
                    if (col.key === 'num_beam') value = beam.number;
                    else if (col.key === 'um_beam') value = beam.angle;
                    else if (col.key === 'd_t') value = beam.nadir_offset;
                    else if (col.key === 'az_t') value = beam.azimuth;
                    else if (col.key === 'r_t') value = beam.radius;
                    else value = '-';
                }
                if (typeof value === 'number' && !Number.isInteger(value)) {
                    value = value.toFixed(6);
                }
                td.textContent = value;
                tr.appendChild(td);
                rowData.push(value);
            });

            tableValuesBeams.push(rowData);
            if (tbody) tbody.appendChild(tr);
        });

        setTimeout(() => {
            clearCanvas();
        }, 100);

        document.querySelectorAll('.beams-element').forEach(beam => {
            beam.addEventListener('click', (e) => {
                const trs = document.querySelectorAll('.beams-Table tbody tr');
                trs.forEach((tr) => {
                    if (tr === e.target.parentElement) {
                        tr.classList.add('selected');
                        clearCanvas();
                        drawsTrBeam(tr, true, 'blue', 5);
                    } else {
                        tr.classList.remove('selected');
                    }
                });
            });
        });

        updateButtonsState();
        loader.close();
    } catch (error) {
        loader.close();
        renderPopup(document.querySelector('#dialog-res'), `Ошибка загрузки лучей: ${error}`);
        console.error('Error loading beams:', error);
        updateButtonsState();
    }
}

// Выбор первого КА
function selectFirstRow() {
    const tr = document.querySelector('.KA-Table tbody tr');
    if (!tr || tr.cells.length < 2) return;

    document.querySelectorAll('.KA-Table tbody tr').forEach(row => row.classList.remove('selected'));
    tr.classList.add('selected');

    const id = tr.cells[0]?.textContent || '';
    const name = tr.cells[1]?.textContent || '';
    const orbit = tr.cells[2]?.textContent || '';

    document.getElementById('id-ka').innerHTML = `КА: ${id}`;
    document.getElementById('ka-name').innerHTML = `${name} (орбита ${orbit})`;

    currentSatelliteId = id;
    createBeamTable(id, currentDbName);
}

// Выбор КА
function selectFirstKa(e) {
    const trs = document.querySelectorAll('.KA-Table tbody tr');
    trs.forEach((tr) => {
        if (tr === e.target.parentElement) {
            tr.classList.add('selected');
            const id = tr.cells[0]?.textContent || '';
            const name = tr.cells[1]?.textContent || '';
            const orbit = tr.cells[2]?.textContent || '';

            document.getElementById('id-ka').innerHTML = `КА: ${id}`;
            document.getElementById('ka-name').innerHTML = `${name} (орбита ${orbit})`;

            currentSatelliteId = id;
            createBeamTable(id, currentDbName);
        } else {
            tr.classList.remove('selected');
        }
    });
}

// ==================== DOMContentLoaded ====================
document.addEventListener('DOMContentLoaded', function() {
    initLoader();

    document.getElementById('exit')?.addEventListener('click', closeTab);

    // Загружаем список БД и затем группировки
    loadDbNames().then(() => {
        const dbSelect = document.getElementById('db-select');
        if (dbSelect) {
            dbSelect.addEventListener('change', function() {
                const newDbName = this.value;
                currentDbName = newDbName;
                // Сбрасываем таблицу лучей
                document.querySelector('.beams-Table').innerHTML = '<thead></thead><tbody></tbody>';
                document.getElementById('id-ka').innerHTML = 'КА:';
                document.getElementById('ka-name').innerHTML = '';
                clearCanvas();
                updateButtonsState();
                // Загружаем группировки для новой БД
                loadGroups(newDbName).then(() => {
                    createKATable(1, newDbName);
                });
            });
        }

        // Загружаем группировки для начальной БД
        const initialDb = dbSelect ? dbSelect.value : 'KA';
        loadGroups(initialDb).then(() => {
            createKATable(1, initialDb);
        });
    });

    const canvas = document.getElementById('canvas');
    if (canvas) {
        drawCircle(350, 350, 312.5, 'gray');
    }

    // Кнопка обновления
    document.getElementById('refresh-ka')?.addEventListener('click', () => {
        document.querySelector('.beams-Table').innerHTML = '<thead></thead><tbody></tbody>';
        document.getElementById('id-ka').innerHTML = 'КА:';
        document.getElementById('ka-name').innerHTML = '';
        clearCanvas();
        updateButtonsState();
        createKATable(1, currentDbName);
    });

    // Переключение типа лучей
    const radioButtons = document.querySelectorAll('input[name="type_beams"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
            const idKa = document.getElementById('id-ka').innerHTML.replace(/\D/g, '');
            if (idKa) {
                document.querySelector('.beams-Table').innerHTML = '<thead></thead><tbody></tbody>';
                createBeamTable(idKa, currentDbName);
            } else {
                updateButtonsState();
            }
        });
    });

    // Изменение размера страницы
    document.getElementById('page-size-input')?.addEventListener('change', function() {
        const newSize = parseInt(this.value) || 10;
        pageSize = newSize;
        const paginationInput = document.getElementById('page-size-input-pagination');
        if (paginationInput) {
            paginationInput.value = newSize;
        }
    });

    // ==================== СОХРАНЕНИЕ ТАБЛИЦЫ (ТОЛЬКО ДЛЯ ТЕКУЩЕГО КА) ====================
    document.getElementById('save-beams')?.addEventListener('click', function() {
        const idKaData = document.getElementById('id-ka').innerHTML;
        if (idKaData !== 'КА:') {
            const modal = document.querySelector('.modal-beams-save');
            if (modal) {
                modal.classList.remove('close-modal');
                modal.style.display = 'flex';
            }
        } else {
            renderPopup(document.querySelector('#dialog-res'), 'Для сохранения нужно выбрать КА');
        }
    });

    document.getElementById('close-save-beams')?.addEventListener('click', function() {
        const modal = document.querySelector('.modal-beams-save');
        if (modal) {
            modal.classList.add('close-modal');
            modal.style.display = 'none';
        }
    });

    document.getElementById('save-save-beams')?.addEventListener('click', async function() {
        const idKaData = document.getElementById('id-ka').innerHTML;
        const idKa = idKaData.replace(/\D/g, '');

        if (!idKa) {
            renderPopup(document.querySelector('#dialog-res'), 'Ошибка: ID КА не найден');
            return;
        }

        const selectedValue = document.querySelector('input[name="type_beams"]:checked').value;
        const dbName = currentDbName || 'KA';

        const beamRows = document.querySelectorAll('tr.beams-element');
        if (!beamRows || beamRows.length === 0) {
            renderPopup(document.querySelector('#dialog-res'), 'Нет данных для сохранения');
            return;
        }

        const loader = initLoader();
        loader.show('Сохранение лучей для КА ' + idKa + '...');

        try {
            const columnsInfo = await getTableColumnsInfo(selectedValue, dbName);
            if (!columnsInfo) {
                loader.close();
                renderPopup(document.querySelector('#dialog-res'), 'Ошибка получения структуры таблицы');
                return;
            }

            const cellMapping = {
                'NUM_BEAM': 1,
                'UM_BEAM': 2,
                'D_T': 3,
                'AZ_T': 4,
                'R_T': 5
            };

            const updateColumns = ['NUM_BEAM', 'UM_BEAM', 'D_T', 'AZ_T', 'R_T'];

            const arrIdBeams = [];
            const arrDataBeams = [];

            for (const row of beamRows) {
                const cells = row.children;
                if (cells.length < 6) continue;
                const id = parseInt(cells[0]?.innerHTML) || 0;
                if (id === 0) continue;
                arrIdBeams.push(id);

                updateColumns.forEach(colName => {
                    const cellIndex = cellMapping[colName] || 0;
                    let val = cells[cellIndex]?.innerHTML || '0';
                    if (!isNaN(parseFloat(val)) && isFinite(val)) {
                        const numVal = parseFloat(val);
                        if (Number.isInteger(numVal)) {
                            val = parseInt(numVal);
                        } else {
                            val = numVal.toFixed(6);
                        }
                    }
                    arrDataBeams.push(val);
                });
            }

            if (arrIdBeams.length === 0) {
                loader.close();
                renderPopup(document.querySelector('#dialog-res'), 'Нет данных для сохранения');
                return;
            }

            const query = generateBeamUpdateQuery(
                selectedValue,
                arrDataBeams,
                arrIdBeams,
                idKa,
                columnsInfo,
                updateColumns
            );

            console.log('Update query for KA ' + idKa + ':', query);

            await changeQuery(query, dbName);

            loader.close();
            const modal = document.querySelector('.modal-beams-save');
            if (modal) {
                modal.classList.add('close-modal');
                modal.style.display = 'none';
            }
            renderPopup(document.querySelector('#dialog-res'), 'Сохранено ' + arrIdBeams.length + ' лучей для КА ' + idKa);
            setTimeout(clearCanvas, 300);
        } catch (error) {
            loader.close();
            renderPopup(document.querySelector('#dialog-res'), 'Ошибка сохранения: ' + (error.message || error));
            console.error('Error saving beams:', error);
        }
    });

    // ==================== РЕДАКТИРОВАНИЕ ЛУЧА ====================
    document.getElementById('edit-beams')?.addEventListener('click', function() {
        const modalColumnsEdit = document.querySelector('.modal-columns-edit');
        if (!modalColumnsEdit) return;

        modalColumnsEdit.innerHTML = '';
        const beamSelected = document.querySelector('tr.beams-element.selected');

        if (!beamSelected) {
            renderPopup(document.querySelector('#dialog-res'), 'Выберите луч для редактирования');
            return;
        }

        const modal = document.querySelector('.modal-beams-edit');
        if (!modal) return;

        modal.classList.remove('close-modal');
        modal.style.display = 'flex';

        const children = beamSelected.children;

        const typeCol = document.createElement('div');
        typeCol.classList.add('data-column');
        let typeBeam = '';
        if (document.querySelector('input[name="type_beams"]:checked').value === 'KA_BEAM_PRD') {
            typeBeam = 'Передача';
        } else {
            typeBeam = 'Прием';
        }
        typeCol.innerHTML = '<div class="name-column">Тип луча:</div><div>' + typeBeam + '</div>';
        modalColumnsEdit.appendChild(typeCol);

        const idCol = document.createElement('div');
        idCol.classList.add('data-column');
        idCol.innerHTML = '<div class="name-column">ID</div>';
        idCol.innerHTML += '<input class="beams-input" disabled value="' + (children[0]?.innerHTML || '') + '"></input>';
        modalColumnsEdit.appendChild(idCol);

        const numCol = document.createElement('div');
        numCol.classList.add('data-column');
        numCol.innerHTML = '<div class="name-column">Номер луча</div>';
        numCol.innerHTML += '<input class="beams-input" value="' + (children[1]?.innerHTML || '') + '"></input>';
        modalColumnsEdit.appendChild(numCol);

        const angleCol = document.createElement('div');
        angleCol.classList.add('data-column');
        angleCol.innerHTML = '<div class="name-column">Угол места луча, градус</div>';
        angleCol.innerHTML += '<input class="beams-input" value="' + (children[2]?.innerHTML || '') + '"></input>';

        const butnCulc = document.createElement('button');
        butnCulc.id = 'calcCenterBeam';
        butnCulc.textContent = 'Рассчитать дальность';
        butnCulc.addEventListener('click', function() {
            const inputModalElements = document.querySelectorAll('.modal-columns-edit .data-column input');
            const angleInput = inputModalElements[2];
            const distanceInput = inputModalElements[3];
            if (angleInput && distanceInput) {
                getDistanceBeam(Number(angleInput.value), 1500).then(function(distanse) {
                    distanceInput.value = distanse.toFixed(3);
                }).catch(function() {
                    renderPopup(document.querySelector('#dialog-res'), 'Ошибка расчета дальности');
                });
            }
        });
        angleCol.appendChild(butnCulc);
        modalColumnsEdit.appendChild(angleCol);

        const distCol = document.createElement('div');
        distCol.classList.add('data-column');
        distCol.innerHTML = '<div class="name-column">Дальность (км)</div>';
        var distVal = parseFloat(children[3]?.innerHTML) || 0;
        distVal = distVal / 1000;
        distCol.innerHTML += '<input class="beams-input" value="' + distVal.toFixed(3) + '"></input>';
        modalColumnsEdit.appendChild(distCol);

        const azimCol = document.createElement('div');
        azimCol.classList.add('data-column');
        azimCol.innerHTML = '<div class="name-column">Азимут луча относительно орбиты КА, градус</div>';
        azimCol.innerHTML += '<input class="beams-input" value="' + (children[4]?.innerHTML || '') + '"></input>';
        modalColumnsEdit.appendChild(azimCol);

        const radCol = document.createElement('div');
        radCol.classList.add('data-column');
        radCol.innerHTML = '<div class="name-column">Радиус (км)</div>';
        var radVal = parseFloat(children[5]?.innerHTML) || 0;
        radVal = radVal / 1000;
        radCol.innerHTML += '<input class="beams-input" value="' + radVal.toFixed(3) + '"></input>';
        modalColumnsEdit.appendChild(radCol);
    });

    document.getElementById('close-edit-beams')?.addEventListener('click', function() {
        const modal = document.querySelector('.modal-beams-edit');
        if (modal) {
            modal.classList.add('close-modal');
            modal.style.display = 'none';
        }
    });

    document.getElementById('save-edit-beams')?.addEventListener('click', function() {
        const dataColumns = document.querySelectorAll('.modal-columns-edit .data-column input');
        const beamSelected = document.querySelector('tr.beams-element.selected');

        if (!beamSelected) {
            renderPopup(document.querySelector('#dialog-res'), 'Ошибка: луч не найден');
            return;
        }

        const children = beamSelected.children;
        let hasChanges = false;

        dataColumns.forEach(function(data, i) {
            if (i === 0) return;
            var val = data.value.replace(/,/g, '.').trim();
            if (val === '') return;
            var numVal = parseFloat(val);
            if (isNaN(numVal)) return;
            hasChanges = true;
            if (i === 3 || i === 5) {
                children[i].innerHTML = (numVal * 1000).toString();
            } else if (i === 1) {
                children[i].innerHTML = Math.round(numVal).toString();
            } else {
                children[i].innerHTML = numVal.toFixed(6);
            }
        });

        const modal = document.querySelector('.modal-beams-edit');
        if (modal) {
            modal.classList.add('close-modal');
            modal.style.display = 'none';
        }

        if (hasChanges) {
            setTimeout(function() {
                clearCanvas();
                drawsTrBeam(beamSelected, true, 'blue', 5);
            }, 200);
            renderPopup(document.querySelector('#dialog-res'), 'Данные луча обновлены');
        } else {
            renderPopup(document.querySelector('#dialog-res'), 'Изменений не обнаружено');
        }
    });

    // ==================== ДУБЛИРОВАНИЕ ЛУЧЕЙ НА ВСЕ КА (UPDATE OR INSERT) ====================
    document.getElementById('copy-beams-Kas')?.addEventListener('click', async function() {
        const sourceKaId = document.getElementById('id-ka').innerHTML.replace(/\D/g, '');
        const dbName = currentDbName || 'KA';

        if (!sourceKaId) {
            renderPopup(document.querySelector('#dialog-res'), 'Сначала выберите КА с лучами для копирования');
            return;
        }

        const selectedValue = document.querySelector('input[name="type_beams"]:checked').value;
        const beamTypeApi = selectedValue === 'KA_BEAM_PRD' ? 'transmitting' : 'receiving';

        // Получаем все КА из текущей группировки
        let allSatellites = [];
        let page = 1;
        const pageSizeAll = 100;
        let total = 0;

        try {
            do {
                const data = await getSatellitesByGroup(currentGroup, page, pageSizeAll, dbName);
                const satellites = data.satellites || data.items || [];
                if (satellites.length === 0) break;
                allSatellites = allSatellites.concat(satellites);
                total = data.total || 0;
                page++;
            } while (allSatellites.length < total && page <= 10);
        } catch (err) {
            renderPopup(document.querySelector('#dialog-res'), 'Ошибка получения списка КА: ' + (err.message || err));
            return;
        }

        const targetKaIds = allSatellites
            .map(s => s.id || s.ID)
            .filter(id => id && id.toString() !== sourceKaId);

        if (targetKaIds.length === 0) {
            renderPopup(document.querySelector('#dialog-res'), 'Нет других КА для копирования');
            return;
        }

        if (!confirm('Скопировать лучи с КА ' + sourceKaId + ' на ' + targetKaIds.length + ' других КА?')) {
            return;
        }

        // Получаем лучи исходного КА
        const sourceBeams = await getSatelliteBeams(sourceKaId, beamTypeApi, dbName);
        if (!sourceBeams || sourceBeams.length === 0) {
            renderPopup(document.querySelector('#dialog-res'), 'У текущего КА нет лучей для копирования');
            return;
        }

        const loader = initLoader();
        loader.show('Копирование лучей на ' + targetKaIds.length + ' КА...');

        try {
            // Получаем информацию о полях таблицы
            const columnsInfo = await getTableColumnsInfo(selectedValue, dbName);
            if (!columnsInfo) {
                loader.close();
                renderPopup(document.querySelector('#dialog-res'), 'Ошибка получения структуры таблицы');
                return;
            }

            // Определяем все колонки кроме ID
            const excludeColumns = ['ID'];
            const insertColumns = [];
            columnsInfo.forEach(col => {
                const colName = col.name.toUpperCase();
                if (!excludeColumns.includes(colName) && !excludeColumns.includes(col.name)) {
                    insertColumns.push(col.name);
                }
            });

            if (insertColumns.length === 0) {
                loader.close();
                renderPopup(document.querySelector('#dialog-res'), 'Нет колонок для вставки');
                return;
            }

            // Формируем массив промисов для updateOrInsert
            const promises = [];

            // Для каждого целевого КА
            for (const targetId of targetKaIds) {
                // Для каждого луча из исходного КА
                for (const beam of sourceBeams) {
                    // Создаем объект строки для вставки/обновления
                    const row = {};
                    insertColumns.forEach(col => {
                        const colName = col.toUpperCase();
                        if (colName === 'ID_KA') {
                            row[col] = parseInt(targetId);
                        } else if (colName === 'NUM_BEAM') {
                            row[col] = beam.num_beam || beam.number || 0;
                        } else if (colName === 'AZ_T') {
                            row[col] = beam.az_t || beam.azimuth || 0;
                        } else if (colName === 'D_T') {
                            row[col] = beam.d_t || beam.nadir_offset || 0;
                        } else if (colName === 'R_T') {
                            row[col] = beam.r_t || beam.radius || 0;
                        } else if (colName === 'UM_BEAM') {
                            row[col] = beam.um_beam || beam.angle || 0;
                        } else if (colName === 'WICH_BEAM') {
                            row[col] = beam.wich_beam || 0;
                        } else if (colName === 'HEIGHT_BEAM') {
                            row[col] = beam.height_beam || 0;
                        } else if (colName === 'EIIM_BEAM') {
                            row[col] = beam.eiim_beam || 0;
                        } else if (colName === 'KU_BEAM') {
                            row[col] = beam.ku_beam || 0;
                        } else if (colName === 'POWER_BEAM') {
                            row[col] = beam.power_beam || 0;
                        } else if (colName === 'ID_KA_SOST') {
                            row[col] = beam.id_ka_sost || 1;
                        } else {
                            row[col] = beam[col] || 0;
                        }
                    });

                    const body = {
                        row: row,
                        matching: ['ID_KA', 'NUM_BEAM']
                    };

                    promises.push(updateOrInsert(selectedValue, body, dbName));
                }
            }

            await Promise.all(promises);

            loader.close();
            renderPopup(document.querySelector('#dialog-res'), 'Скопировано на ' + targetKaIds.length + ' КА (всего ' + (sourceBeams.length * targetKaIds.length) + ' лучей)');

            setTimeout(function() {
                createKATable(currentPage, dbName);
            }, 500);
        } catch (error) {
            loader.close();
            renderPopup(document.querySelector('#dialog-res'), 'Ошибка копирования: ' + (error.message || error));
            console.error('Error copying beams:', error);
        }
    });
});