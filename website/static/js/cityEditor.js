'use strict';

import { Loader } from './Loader.js';
import { selectQuery, postJSON, changeQuery } from './db.js';

let loader = null;
let currentLocalityId = null;
let tableStructure = null;

function initLoader() {
    if (!loader) {
        loader = new Loader('.loader-container');
    }
    return loader;
}

function renderPopup(message, isError = false) {
    const popupElement = document.querySelector('#dialog-res');
    if (!popupElement) return;

    let safeMessage = '';
    if (message === undefined || message === null) {
        safeMessage = '';
    } else if (typeof message === 'object') {
        try {
            safeMessage = JSON.stringify(message);
        } catch (e) {
            safeMessage = '';
        }
    } else {
        safeMessage = String(message);
    }

    popupElement.innerHTML = '';
    const div = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = safeMessage;
    if (isError) {
        p.style.color = 'red';
        p.style.fontWeight = 'bold';
    } else {
        p.style.color = 'green';
        p.style.fontWeight = 'bold';
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

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params.entries()) {
        result[key] = value;
    }
    return result;
}

// ПРОВЕРКА: только цифры
function isValidId(value) {
    if (value === undefined || value === null || value === '') return false;
    return /^\d+$/.test(String(value));
}

async function getTableStructure() {
    if (tableStructure) return tableStructure;
    const loader = initLoader();
    loader.show('Загрузка структуры...');
    try {
        const result = await postJSON({ name: 'A_NAS_P' }, 'IO');
        if (result && result.columns_info) {
            tableStructure = result.columns_info;
            loader.close();
            return tableStructure;
        }
        throw new Error('Ошибка структуры');
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка: ${error.message}`, true);
        throw error;
    }
}

function mapValuesToFields(values, structure) {
    const result = {};
    for (let i = 0; i < structure.length; i++) {
        const field = structure[i];
        if (i < values.length) {
            result[field.name] = values[i];
        } else {
            result[field.name] = null;
        }
    }
    return result;
}

function buildMapping(structure) {
    if (!structure || !Array.isArray(structure) || structure.length === 0) {
        return {};
    }

    const mapping = {};

    const inputToFieldMap = {
        'regions-p': 'REGION_NAME',
        'mun-educ': 'DISTRICT'
    };

    for (const [inputId, dbField] of Object.entries(inputToFieldMap)) {
        const fieldExists = structure.some(field => field.name === dbField);
        if (fieldExists) {
            mapping[inputId] = dbField;
        }
    }

    return mapping;
}

function fillFormFromDB(rowObject, structure) {
    if (!rowObject || typeof rowObject !== 'object') return;
    if (!structure || !Array.isArray(structure)) return;

    const mapping = buildMapping(structure);
    if (Object.keys(mapping).length === 0) return;

    for (const [inputId, dbField] of Object.entries(mapping)) {
        const input = document.getElementById(inputId);
        if (!input) continue;
        const val = rowObject[dbField];
        input.value = (val !== undefined && val !== null) ? val : '';
    }
}

async function loadLocalityData(localityId) {
    const loader = initLoader();
    loader.show(`Загрузка ID: ${localityId}...`);
    try {
        const structure = await getTableStructure();
        const data = await selectQuery(`SELECT * FROM A_NAS_P WHERE ID = ${localityId}`, 'IO');

        currentLocalityId = localityId;

        if (Array.isArray(data) && data.length > 0) {
            const rowObject = mapValuesToFields(data[0], structure);
            fillFormFromDB(rowObject, structure);
            loader.close();

            const title = document.getElementById('locality-title');
            if (title) {
                const name = rowObject.NAME || rowObject.name || `ID: ${localityId}`;
                title.textContent = `Населенный пункт — ${name}`;
            }

            renderPopup(`Загружено: "${rowObject.NAME || ''}"`);
        } else {
            loader.close();
            renderPopup(`ID ${localityId} не найден (заполните форму и сохраните)`, true);
        }
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка загрузки: ${error.message}`, true);
        console.error('Ошибка загрузки:', error);
    }
}

async function saveLocality(formData) {
    const loader = initLoader();
    loader.show('Сохранение...');
    try {
        if (!tableStructure) {
            throw new Error('Структура таблицы не загружена');
        }
        if (!currentLocalityId) {
            throw new Error('Нет ID для обновления (сначала загрузите запись через URL)');
        }

        const mapping = buildMapping(tableStructure);

        const setClauses = [];
        for (const [inputId, dbField] of Object.entries(mapping)) {
            const val = formData.get(inputId);
            if (val && val !== '') {
                const escapedVal = String(val).replace(/'/g, "''");
                setClauses.push(`${dbField} = '${escapedVal}'`);
            }
        }

        if (setClauses.length === 0) {
            renderPopup('Нет данных для сохранения', true);
            loader.close();
            return;
        }

        const sql = `UPDATE A_NAS_P SET ${setClauses.join(', ')} WHERE ID = ${currentLocalityId}`;

        console.log('SQL запрос:', sql);

        const result = await changeQuery(sql, 'IO');

        loader.close();
        renderPopup(`Данные для ID ${currentLocalityId} успешно обновлены!`);
        return result;
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка сохранения: ${error.message}`, true);
        console.error('Ошибка сохранения:', error);
        throw error;
    }
}

function handleFormSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const formData = new FormData(event.target);
    if (!formData.get('regions-p')) {
        renderPopup('Выберите регион!', true);
        return false;
    }

    saveLocality(formData);
    return false;
}

// Поиск кнопки "Выход" по тексту
function findExitButton() {
    const buttons = document.querySelectorAll('.grid-btn');
    for (const btn of buttons) {
        if (btn.textContent.trim() === 'Выход') {
            return btn;
        }
    }
    return null;
}

function handleExit() {
    try {
        window.close();
    } catch (e) {}

    if (!window.closed) {
        try {
            window.history.back();
        } catch (e) {}
    }

    setTimeout(() => {
        window.location.href = '/';
    }, 100);
}

document.addEventListener('DOMContentLoaded', function() {
    initLoader();
    const params = getUrlParams();

    // ПРОВЕРКА ID: только цифры
    let idToLoad;
    if (params.id && isValidId(params.id)) {
        idToLoad = params.id;
        console.log(`Загружаем ID из URL: ${idToLoad}`);
    } else {
        idToLoad = 134;
        if (params.id) {
            console.warn(`ID "${params.id}" содержит нецифровые символы, используем значение по умолчанию: ${idToLoad}`);
        } else {
            console.log(`ID не указан, используем значение по умолчанию: ${idToLoad}`);
        }
    }

    loadLocalityData(idToLoad);

    const form = document.getElementById('localityForm') || document.querySelector('.form__rating');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    const exitBtn = findExitButton();
    if (exitBtn) {
        exitBtn.addEventListener('click', handleExit);
        console.log('Кнопка "Выход" найдена и подключена');
    } else {
        console.warn('Кнопка "Выход" не найдена! Проверьте HTML.');
    }
});