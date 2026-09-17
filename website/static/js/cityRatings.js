// cityRatings.js
'use strict';

import { Loader } from './Loader.js';
import {
    getRegions,
    getResKinds,
    getSettlementsPage,
    getResPage,
    postRatingSett,
    getRatingsPage,
    postJSON,
    editRow
} from './db.js';

let loader = null;

// ==================== КОНСТАНТЫ РЕДАКТИРОВАНИЯ ====================
/**
 * Показывает предупреждение «Необходимо выбрать хотя бы один регион»
 * и автоматически скрывает его через 3 секунды.
 */
/**
 * Показывает предупреждение «Необходимо выбрать хотя бы один регион».
 * Если элемента <dialog id="dialog-res"> нет — создаёт его сам.
 * Автоматически закрывает через 3 секунды.
 */
function showRegionWarning() {
    let popupElement = document.getElementById('dialog-res');

    // Если модалки нет — создаём её и добавляем в body
    if (!popupElement) {
        popupElement = document.createElement('dialog');
        popupElement.id = 'dialog-res';
        document.body.appendChild(popupElement);
    }

    // Сбрасываем предыдущий таймер, если он был
    if (popupElement._regionWarningTimer) {
        clearTimeout(popupElement._regionWarningTimer);
        popupElement._regionWarningTimer = null;
    }

    // Если модалка уже открыта — сначала закрываем её, чтобы не было ошибки showModal
    if (popupElement.open) {
        try {
            popupElement.close();
        } catch (e) {}
    }

    popupElement.innerHTML = '';

    const div = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = 'Необходимо выбрать хотя бы один регион';
    p.style.color = 'red';
    p.style.fontWeight = '600';
    p.style.margin = '0';
    p.style.fontSize = '16px';

    div.appendChild(p);
    div.classList.add('dialog-div');
    div.style.padding = '16px 24px';
    div.style.textAlign = 'center';
    div.style.minWidth = '260px';

    popupElement.appendChild(div);
    popupElement.classList.add('popup');

    popupElement.showModal();

    popupElement._regionWarningTimer = setTimeout(() => {
        popupElement.classList.remove('popup');
        try {
            popupElement.close();
        } catch (e) {}
        popupElement._regionWarningTimer = null;

        // Удаляем диалог из DOM, если он был создан только для этого предупреждения
        // (если он уже был раньше — оставляем)
        // → если нужно оставлять — закомментируйте блок ниже
        // if (popupElement && popupElement.parentNode) {
        //     popupElement.parentNode.removeChild(popupElement);
        // }
    }, 3000);
}
const TABLE_SETTLEMENTS = 'A_NAS_P';
const TABLE_RANKING = 'A_NAS_P_RANKING '; // пробел в конце важен
const EDIT_DB_NAME = 'IO';

// Кэш структур таблиц (columns_info)
let settlementsColumnsCache = null;
let rankingColumnsCache = null;

// ---- Русские названия колонок A_NAS_P ----
const SETTLEMENTS_COLUMN_LABELS = {
    'ID': 'ID',
    'NAME': 'Название',
    'ADMIN_BOUNDARY_AREA_KM2': 'Площадь (км²)',
    'REGION_NAME': 'Регион',
    'DISTRICT': 'Муниципальное образование',
    'LON': 'Долгота',
    'LAT': 'Широта',
    'POPULATION': 'Население',
    'FIAS_GUID': 'Код ФИАС',
    'REGION_CODE': 'Код региона'
};

// ---- Русские названия колонок A_NAS_P_RANKING ----
const RANKING_COLUMN_LABELS = {
    'ID': 'ID',
    'KOL_OPERATOR': 'Количество операторов',
    'TV_KOL_RES': 'Количество РЭС ТВ',
    'TV_KOL_CHANNELS': 'Количество каналов ТВ',
    'TV_POKRITIE': 'Покрытие ТВ',
    'TV_PROC_POKRITIE': 'Процент покрытия ТВ',
    'RV_KOL_RES': 'Количество РЭС РВ',
    'RV_WIDTH': 'Ширина полосы РВ',
    'RV_KOL_CHANNELS': 'Количество каналов РВ',
    'RV_POKRITIE': 'Покрытие РВ',
    'RV_PROC_POKRITIE': 'Процент покрытия РВ',
    'LTE_KOL_RES': 'Количество РЭС LTE',
    'LTE_KOL_AB': 'Количество абонентов LTE',
    'LTE_PROC_NAS': 'Процент охвата населения LTE',
    'LTE_POKRITIE': 'Покрытие связи LTE',
    'LTE_PROC_POKRITIE': 'Процент покрытия связи LTE',
    'LTE_TRAFIK': 'Объем трафика LTE',
    'LTE_PROC_TRAFIK': 'Процент трафика LTE',
    'GSM_KOL_RES': 'Количество РЭС GSM',
    'GSM_KOL_AB': 'Количество абонентов GSM',
    'GSM_PROC_NAS': 'Процент охвата населения GSM',
    'GSM_POKRITIE': 'Покрытие связи GSM',
    'GSM_PROC_POKRITIE': 'Процент покрытия связи GSM',
    'GSM_TRAFIK': 'Объем трафика GSM',
    'GSM_PROC_TRAFIK': 'Процент трафика GSM',
    'G5_KOL_RES': 'Количество РЭС 5G',
    'G5_KOL_AB': 'Количество абонентов 5G',
    'G5_PROC_NAS': 'Процент охвата населения 5G',
    'G5_POKRITIE': 'Покрытие связи 5G',
    'G5_PROC_POKRITIE': 'Процент покрытия связи 5G',
    'G5_TRAFIK': 'Объем трафика 5G',
    'G5_PROC_TRAFIK': 'Процент трафика 5G',
    'WIFI_KOL_RES': 'Количество РЭС Wi-Fi',
    'WIFI_KOL_AB': 'Количество абонентов Wi-Fi',
    'WIFI_PROC_NAS': 'Процент охвата населения Wi-Fi',
    'WIFI_POKRITIE': 'Покрытие связи Wi-Fi',
    'WIFI_PROC_POKRITIE': 'Процент покрытия связи Wi-Fi',
    'WIFI_TRAFIK': 'Объем трафика Wi-Fi',
    'WIFI_PROC_TRAFIK': 'Процент трафика Wi-Fi',
    'TETRA_KOL_RES': 'Количество РЭС Tetra',
    'TETRA_KOL_AB': 'Количество абонентов Tetra',
    'TETRA_PROC_NAS': 'Процент охвата населения Tetra',
    'TETRA_POKRITIE': 'Покрытие связи Tetra',
    'TETRA_PROC_POKRITIE': 'Процент покрытия связи Tetra',
    'TETRA_TRAFIK': 'Объем трафика Tetra',
    'TETRA_PROC_TRAFIK': 'Процент трафика Tetra',
    'US_KOL_US': 'Количество УС',
    'US_KOL_AB': 'Количество абонентов УС',
    'US_PROC_NAS': 'Процент охвата населения УС',
    'US_POKRITIE': 'Покрытие УС',
    'US_PROC_POKRITIE': 'Процент покрытия УС',
    'US_TRAFIK': 'Объем трафика УС',
    'US_PROC_TRAFIK': 'Процент трафика УС',
    'POST_KOL_POST': 'Количество почтовых отделений',
    'POST_KOL_AB': 'Количество абонентов почты',
    'POST_PROC_NAS': 'Процент охвата населения почтой',
    'POST_POKRITIE': 'Покрытие почты',
    'POST_PROC_POKRITIE': 'Процент покрытия почты',
    'POST_TRAFIK': 'Объем трафика почты',
    'POST_PROC_TRAFIK': 'Процент трафика почты',
    'VOLS_KOL_VOLS': 'Количество ВОЛС',
    'VOLS_KOL_AB': 'Количество абонентов ВОЛС',
    'VOLS_PROC_NAS': 'Процент охвата населения ВОЛС',
    'VOLS_POKRITIE': 'Покрытие ВОЛС',
    'VOLS_PROC_POKRITIE': 'Процент покрытия ВОЛС',
    'VOLS_TRAFIK': 'Объем трафика ВОЛС',
    'VOLS_PROC_TRAFIK': 'Процент трафика ВОЛС',
    'TAKS_KOL_TAKS': 'Количество таксофонов',
    'TAKS_KOL_AB': 'Количество абонентов таксофонов',
    'TAKS_PROC_NAS': 'Процент охвата населения таксофонами',
    'TAKS_POKRITIE': 'Покрытие таксофонов',
    'TAKS_PROC_POKRITIE': 'Процент покрытия таксофонов',
    'TAKS_TRAFIK': 'Объем трафика таксофонов',
    'TAKS_PROC_TRAFIK': 'Процент трафика таксофонов',
    'MOB_KOL_RES': 'Количество РЭС моб. связи',
    'MOB_KOL_AB': 'Количество абонентов моб. связи',
    'MOB_PROC_NAS': 'Процент охвата населения моб. связи',
    'MOB_POKRITIE': 'Покрытие моб. связи',
    'MOB_PROC_POKRITIE': 'Процент покрытия моб. связи',
    'MOB_TRAFIK': 'Объем трафика моб. связи',
    'MOB_PROC_TRAFIK': 'Процент трафика моб. связи',
    'RAT_NP_KOL_AB': 'Рейтинг: количество абонентов',
    'RAT_NP_PROC_NAS': 'Рейтинг: процент охвата населения',
    'RAT_NP_POKRITIE': 'Рейтинг: покрытие',
    'RAT_NP_PROC_POKRITIE': 'Рейтинг: процент покрытия',
    'RAT_NP_TRAFIK': 'Рейтинг: трафик',
    'RAT_NP_PROC_TRAFIK': 'Рейтинг: процент трафика',
    'RAT_SUM_NP': 'Суммарная оценка'
};

// ---- Соответствия DB-колонка A_NAS_P -> ключ в объекте НП ----
const SETTLEMENTS_DB_TO_OBJECT_KEY = {
    'ID': 'id',
    'NAME': 'name',
    'ADMIN_BOUNDARY_AREA_KM2': 'area',
    'REGION_NAME': 'region_name',
    'DISTRICT': 'district_name',
    'LON': 'lon',
    'LAT': 'lat',
    'POPULATION': 'population',
    'FIAS_GUID': 'fias_id',
    'REGION_CODE': 'region_code'
};

// ---- Соответствия DB-колонка A_NAS_P_RANKING -> ключ в объекте ratings ----
const RANKING_DB_TO_OBJECT_KEY = {
    'ID': 'id',
    'KOL_OPERATOR': 'count_operators',
    'TV_KOL_RES': 'count_res_tv',
    'TV_KOL_CHANNELS': 'count_channels_tv',
    'TV_POKRITIE': 'communication_coverage_tv',
    'TV_PROC_POKRITIE': 'communication_coverage_percent_tv',
    'RV_KOL_RES': 'count_res_rv',
    'RV_WIDTH': 'frequency_width_rv',
    'RV_KOL_CHANNELS': 'count_channels_rv',
    'RV_POKRITIE': 'communication_coverage_rv',
    'RV_PROC_POKRITIE': 'communication_coverage_percent_rv',
    'LTE_KOL_RES': 'count_res_lte',
    'LTE_KOL_AB': 'count_abonents_lte',
    'LTE_PROC_NAS': 'population_percent_lte',
    'LTE_POKRITIE': 'communication_coverage_lte',
    'LTE_PROC_POKRITIE': 'communication_coverage_percent_lte',
    'LTE_TRAFIK': 'traffic_lte',
    'LTE_PROC_TRAFIK': 'traffic_percent_lte',
    'GSM_KOL_RES': 'count_res_gsm',
    'GSM_KOL_AB': 'count_abonents_gsm',
    'GSM_PROC_NAS': 'population_percent_gsm',
    'GSM_POKRITIE': 'communication_coverage_gsm',
    'GSM_PROC_POKRITIE': 'communication_coverage_percent_gsm',
    'GSM_TRAFIK': 'traffic_gsm',
    'GSM_PROC_TRAFIK': 'traffic_percent_gsm',
    'G5_KOL_RES': 'count_res_5g',
    'G5_KOL_AB': 'count_abonents_5g',
    'G5_PROC_NAS': 'population_percent_5g',
    'G5_POKRITIE': 'communication_coverage_5g',
    'G5_PROC_POKRITIE': 'communication_coverage_percent_5g',
    'G5_TRAFIK': 'traffic_5g',
    'G5_PROC_TRAFIK': 'traffic_percent_5g',
    'WIFI_KOL_RES': 'count_res_wifi',
    'WIFI_KOL_AB': 'count_abonents_wifi',
    'WIFI_PROC_NAS': 'population_percent_wifi',
    'WIFI_POKRITIE': 'communication_coverage_wifi',
    'WIFI_PROC_POKRITIE': 'communication_coverage_percent_wifi',
    'WIFI_TRAFIK': 'traffic_wifi',
    'WIFI_PROC_TRAFIK': 'traffic_percent_wifi',
    'TETRA_KOL_RES': 'count_res_tetra',
    'TETRA_KOL_AB': 'count_abonents_tetra',
    'TETRA_PROC_NAS': 'population_percent_tetra',
    'TETRA_POKRITIE': 'communication_coverage_tetra',
    'TETRA_PROC_POKRITIE': 'communication_coverage_percent_tetra',
    'TETRA_TRAFIK': 'traffic_tetra',
    'TETRA_PROC_TRAFIK': 'traffic_percent_tetra',
    'US_KOL_US': 'count_comm_hubs',
    'US_KOL_AB': 'count_abonents_comm_hubs',
    'US_PROC_NAS': 'population_percent_comm_hubs',
    'US_POKRITIE': 'communication_coverage_comm_hubs',
    'US_PROC_POKRITIE': 'communication_coverage_percent_comm_hubs',
    'US_TRAFIK': 'traffic_comm_hubs',
    'US_PROC_TRAFIK': 'traffic_percent_comm_hubs',
    'POST_KOL_POST': 'count_posts',
    'POST_KOL_AB': 'count_abonents_posts',
    'POST_PROC_NAS': 'population_percent_posts',
    'POST_POKRITIE': 'communication_coverage_posts',
    'POST_PROC_POKRITIE': 'communication_coverage_percent_posts',
    'POST_TRAFIK': 'traffic_posts',
    'POST_PROC_TRAFIK': 'traffic_percent_posts',
    'VOLS_KOL_VOLS': 'count_focl',
    'VOLS_KOL_AB': 'count_abonents_focl',
    'VOLS_PROC_NAS': 'population_percent_focl',
    'VOLS_POKRITIE': 'communication_coverage_focl',
    'VOLS_PROC_POKRITIE': 'communication_coverage_percent_focl',
    'VOLS_TRAFIK': 'traffic_focl',
    'VOLS_PROC_TRAFIK': 'traffic_percent_focl',
    'TAKS_KOL_TAKS': 'count_payphones',
    'TAKS_KOL_AB': 'count_abonents_payphones',
    'TAKS_PROC_NAS': 'population_percent_payphones',
    'TAKS_POKRITIE': 'communication_coverage_payphones',
    'TAKS_PROC_POKRITIE': 'communication_coverage_percent_payphones',
    'TAKS_TRAFIK': 'traffic_payphones',
    'TAKS_PROC_TRAFIK': 'traffic_percent_payphones',
    'MOB_KOL_RES': 'count_res_mobile',
    'MOB_KOL_AB': 'count_abonents_mobile',
    'MOB_PROC_NAS': 'population_percent_mobile',
    'MOB_POKRITIE': 'communication_coverage_mobile',
    'MOB_PROC_POKRITIE': 'communication_coverage_percent_mobile',
    'MOB_TRAFIK': 'traffic_mobile',
    'MOB_PROC_TRAFIK': 'traffic_percent_mobile',
    'RAT_NP_KOL_AB': 'count_abonents_summary',
    'RAT_NP_PROC_NAS': 'population_percent_summary',
    'RAT_NP_POKRITIE': 'communication_coverage_summary',
    'RAT_NP_PROC_POKRITIE': 'communication_coverage_percent_summary',
    'RAT_NP_TRAFIK': 'traffic_summary',
    'RAT_NP_PROC_TRAFIK': 'traffic_percent_summary',
    'RAT_SUM_NP': 'rating'
};

// ==================== ДАННЫЕ ====================

let settlementsData = {
    items: [],
    total: 0,
    page: 0,
    pageSize: 100,
    allItems: []
};

let resData = {
    items: [],
    total: 0,
    page: 0,
    pageSize: 1
};

let chartAllData = [];
let chartCurrentData = [];
let chartDisplayData = [];

let selectedSettlementId = null;
let selectedSettlementLat = null;
let selectedSettlementLon = null;
let selectedSettlementArea = null;
let selectedSettlementName = null;

let currentRegions = [];
let currentKinds = [];
let currentPopRange = { from: 1, to: 17000000 };

let isCancelled = false;
let isCalculateMode = false;

let allRatings = {};

let currentSortField = null;
let currentSortOrder = 'asc';
let currentSettlementsFiltered = [];

let currentFilterField = '';
let currentFilterValue = '';
let currentFilterExact = false;

let showRatings = false;

let savedFilterField = '';
let savedFilterValue = '';
let savedFilterExact = false;

let originalDataForFilter = [];
let originalTotalForFilter = 0;

let currentDisplayPage = 0;

let ratingChart = null;
let isChartMode = false;
let chartType = 'provided';


let chartSearchQuery = '';
let searchResults = [];
let selectedSearchItem = null;
let selectedSearchIndex = -1;

let zoomLevel = 1;
const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
let zoomStartIndex = 0;
let zoomEndIndex = 0;
let currentDisplayDataLength = 0;

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

const allowedResKinds = [
    7, 128, 56, 31, 68, 30, 65, 99, 72, 15, 106, 114, 85, 4, 18, 10,
    82, 86, 83, 94, 115, 104, 22, 8, 75, 1, 46, 91, 45, 11, 37, 129,
    21, 112, 103, 92
];

// ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

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

// ==================== СТРУКТУРЫ ТАБЛИЦ ====================

async function loadTableStructures() {
    if (!settlementsColumnsCache) {
        try {
            const info = await postJSON({ name: TABLE_SETTLEMENTS }, EDIT_DB_NAME);
            settlementsColumnsCache = (info && info.columns_info) ? info.columns_info : [];
            console.log('A_NAS_P columns:', settlementsColumnsCache);
        } catch (e) {
            console.error('Ошибка загрузки структуры A_NAS_P:', e);
            settlementsColumnsCache = [];
        }
    }

    if (!rankingColumnsCache) {
        try {
            const info = await postJSON({ name: TABLE_RANKING }, EDIT_DB_NAME);
            rankingColumnsCache = (info && info.columns_info) ? info.columns_info : [];
            console.log('A_NAS_P_RANKING columns:', rankingColumnsCache);
        } catch (e) {
            console.error('Ошибка загрузки структуры A_NAS_P_RANKING:', e);
            rankingColumnsCache = [];
        }
    }

    return {
        settlementsColumns: settlementsColumnsCache,
        rankingColumns: rankingColumnsCache
    };
}

function getValueByDbColumn(obj, dbColumn, map) {
    if (!obj) return '';
    const mappedKey = map ? map[dbColumn] : null;
    if (mappedKey && obj[mappedKey] !== undefined && obj[mappedKey] !== null) {
        return obj[mappedKey];
    }
    if (obj[dbColumn] !== undefined && obj[dbColumn] !== null) {
        return obj[dbColumn];
    }
    if (obj[dbColumn.toUpperCase()] !== undefined && obj[dbColumn.toUpperCase()] !== null) {
        return obj[dbColumn.toUpperCase()];
    }
    if (obj[dbColumn.toLowerCase()] !== undefined && obj[dbColumn.toLowerCase()] !== null) {
        return obj[dbColumn.toLowerCase()];
    }
    return '';
}

// ==================== МАССОВАЯ ЗАГРУЗКА РЕЙТИНГОВ ====================

async function loadRatingsBulk(regions, popRange) {
    const result = {};
    try {
        await loadTableStructures();

        const body = {
            regions: Array.isArray(regions) ? regions : [],
            population_filters: [
                {
                    from: popRange && popRange.from !== undefined ? popRange.from : 0,
                    to: popRange && popRange.to !== undefined ? popRange.to : 17000000
                }
            ]
        };

        const response = await getRatingsPage(0, 1, body);
        if (!response) return result;

        const ratings = Array.isArray(response)
            ? response
            : (response.ratings || []);

        ratings.forEach(rating => {
            if (rating && rating.id !== undefined && rating.id !== null) {
                result[String(rating.id)] = rating;
            }
        });

        console.log(`Массово загружено рейтингов: ${Object.keys(result).length}`);
        return result;
    } catch (error) {
        console.error('Ошибка массовой загрузки рейтингов:', error);
        return result;
    }
}

// ==================== ПЛЕЙСХОЛДЕР ====================

function showPlaceholder() {
    const placeholder = document.getElementById('placeholder-message');
    const table = document.getElementById('settlements-table');
    const pagination = document.getElementById('settlements-pagination');
    const divider = document.getElementById('table-divider');
    const chartContainer = document.getElementById('chart-container');

    if (placeholder) placeholder.style.display = 'flex';
    if (table) table.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    if (divider) divider.style.display = 'none';
    if (chartContainer) chartContainer.style.display = 'none';

    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();

    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) filterContainer.remove();

    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    destroyChart();
}

function hidePlaceholder() {
    const placeholder = document.getElementById('placeholder-message');
    if (placeholder) placeholder.style.display = 'none';
}

// ==================== ДИАГРАММА: УПРАВЛЕНИЕ ====================

function destroyChart() {
    if (ratingChart) {
        ratingChart.destroy();
        ratingChart = null;
    }
    isChartMode = false;
    zoomStartIndex = 0;
    zoomEndIndex = 0;
    currentDisplayDataLength = 0;
    chartDisplayData = [];

    const tooltip = document.getElementById('chart-item-tooltip');
    if (tooltip) tooltip.remove();
}

function hideChartContainer() {
    const chartContainer = document.getElementById('chart-container');
    if (chartContainer) {
        chartContainer.style.display = 'none';
    }
    destroyChart();
    chartAllData = [];
    chartCurrentData = [];
    chartDisplayData = [];
}

function showChartContainer() {
    const chartContainer = document.getElementById('chart-container');
    const table = document.getElementById('settlements-table');
    const pagination = document.getElementById('settlements-pagination');
    const divider = document.getElementById('table-divider');
    const placeholder = document.getElementById('placeholder-message');

    if (chartContainer) {
        chartContainer.style.display = 'flex';
        chartContainer.style.flexDirection = 'column';
        chartContainer.style.height = '600px';
    }

    if (table) table.style.display = 'none';
    if (pagination) {
        pagination.style.display = 'none';
        pagination.innerHTML = '';
    }
    if (divider) divider.style.display = 'none';
    if (placeholder) placeholder.style.display = 'none';

    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();

    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) filterContainer.remove();

    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();
}

// ==================== ЦВЕТ И ПОИСК ====================

function getDefaultColor(value) {
    if (value === undefined || value === null || isNaN(value)) {
        return '#999999';
    }
    if (value > 50) return '#00cc44';
    if (value > 25) return '#0066ff';
    return '#ff6600';
}

function getChartDisplayData() {
    if (chartDisplayData && chartDisplayData.length > 0) {
        return chartDisplayData;
    }
    if (chartAllData && chartAllData.length > 0) {
        return chartAllData;
    }
    return chartCurrentData && chartCurrentData.length > 0 ? chartCurrentData : [];
}

function renderSearchResults(results, query, container) {
    if (!container) {
        container = document.getElementById('chart-search-results');
    }
    if (!container) return;

    container.innerHTML = '';

    if (!results || results.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.textContent = 'Ничего не найдено';
        emptyItem.style.cssText = `
            padding: 10px 15px;
            color: #999;
            font-style: italic;
            text-align: center;
        `;
        container.appendChild(emptyItem);
        container.style.display = 'block';
        return;
    }

    results.forEach((item, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.dataset.index = index;
        resultItem.style.cssText = `
            padding: 8px 15px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background-color 0.15s;
            font-size: 13px;
        `;

        const name = item.name || `ID: ${item.id}`;
        const queryLower = query.toLowerCase();
        const nameLower = name.toLowerCase();
        const indexMatch = nameLower.indexOf(queryLower);

        let nameDisplay = name;
        if (indexMatch !== -1) {
            const before = name.substring(0, indexMatch);
            const match = name.substring(indexMatch, indexMatch + query.length);
            const after = name.substring(indexMatch + query.length);
            nameDisplay = `${before}<strong style="color: #0066ff;">${match}</strong>${after}`;
        }

        const nameSpan = document.createElement('span');
        nameSpan.innerHTML = nameDisplay;
        nameSpan.style.cssText = `
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;

        const infoSpan = document.createElement('span');
        const rating = item.rating;
        const ratingText = (rating !== undefined && rating !== null && !isNaN(rating)) ?
            rating.toFixed(1) : 'не получен';
        const regionText = item.region_name || '—';
        infoSpan.textContent = `Рейтинг: ${ratingText} | ${regionText}`;
        infoSpan.style.cssText = `
            font-size: 12px;
            color: #666;
            margin-left: 10px;
            flex-shrink: 0;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;

        resultItem.appendChild(nameSpan);
        resultItem.appendChild(infoSpan);

        resultItem.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#e8f0fe';
        });
        resultItem.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '';
        });

        resultItem.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            if (!isNaN(idx) && results[idx]) {
                selectSearchResult(results[idx], idx);
            }
        });

        container.appendChild(resultItem);
    });

    const counter = document.createElement('div');
    counter.textContent = `Найдено: ${results.length}`;
    counter.style.cssText = `
        padding: 6px 15px;
        background: #f5f5f5;
        color: #666;
        font-size: 12px;
        border-top: 1px solid #eee;
        text-align: center;
    `;
    container.appendChild(counter);

    container.style.display = 'block';
}

function selectSearchResult(item, index) {
    if (!ratingChart) return;

    selectedSearchItem = item;
    selectedSearchIndex = index;

    const displayData = getChartDisplayData();
    if (!displayData || displayData.length === 0) return;

    let chartIndex = -1;
    for (let i = 0; i < displayData.length; i++) {
        const d = displayData[i];
        if ((d.id !== undefined && item.id !== undefined && d.id === item.id) ||
            (d.name && item.name && d.name === item.name)) {
            chartIndex = i;
            break;
        }
    }
    if (chartIndex === -1) chartIndex = index;

    const bgColors = displayData.map(d => getDefaultColor(d.rating || 0));

    const borderColors = displayData.map(d => {
        const isSelected = (d.id !== undefined && item.id !== undefined && d.id === item.id) ||
            (d.name && item.name && d.name === item.name);
        return isSelected ? '#cc0000' : getDefaultColor(d.rating || 0);
    });

    const borderWidths = displayData.map(d => {
        const isSelected = (d.id !== undefined && item.id !== undefined && d.id === item.id) ||
            (d.name && item.name && d.name === item.name);
        return isSelected ? 3 : 1;
    });

    ratingChart.data.datasets[0].backgroundColor = bgColors;
    ratingChart.data.datasets[0].borderColor = borderColors;
    ratingChart.data.datasets[0].borderWidth = borderWidths;
    ratingChart.update();

    const container = document.getElementById('chart-search-results');
    if (container) {
        container.style.display = 'none';
    }

    showItemTooltip(item, chartIndex);

    const searchInput = document.getElementById('chart-search-input');
    if (searchInput) {
        searchInput.value = item.name || `ID: ${item.id}`;
    }
}

function showItemTooltip(item, chartIndex) {
    const oldTooltip = document.getElementById('chart-item-tooltip');
    if (oldTooltip) oldTooltip.remove();

    if (!item) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'chart-item-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.92);
        color: #fff;
        padding: 14px 20px;
        border-radius: 10px;
        font-size: 14px;
        z-index: 9999;
        max-width: 400px;
        min-width: 250px;
        box-shadow: 0 4px 25px rgba(0,0,0,0.6);
        pointer-events: none;
        border: 2px solid #cc0000;
        transition: opacity 0.2s;
    `;

    const rating = item.rating;
    const ratingText = (rating !== undefined && rating !== null && !isNaN(rating)) ?
        rating.toFixed(2) : 'не получен';
    const population = item.population || 0;
    const region = item.region_name || 'Н/Д';
    const district = item.district_name || 'Н/Д';
    const name = item.name || `ID: ${item.id}`;

    const ratingColor = (rating !== undefined && rating !== null && !isNaN(rating)) ? '#ffd700' : '#ff6b6b';

    tooltip.innerHTML = `
        <div style="font-weight: bold; font-size: 16px; color: #ff6b6b; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 6px;">
             ${name}
        </div>
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 15px; font-size: 13px;">
            <span style="color: #aaa;">Рейтинг:</span>
            <span style="color: ${ratingColor}; font-weight: bold;">${ratingText}</span>
            <span style="color: #aaa;">Население:</span>
            <span style="color: #fff;">${population.toLocaleString()}</span>
            <span style="color: #aaa;">Регион:</span>
            <span style="color: #fff;">${region}</span>
            <span style="color: #aaa;">Район:</span>
            <span style="color: #fff;">${district}</span>
            <span style="color: #aaa;">ID:</span>
            <span style="color: #fff;">${item.id}</span>
        </div>
    `;

    document.body.appendChild(tooltip);
    positionTooltipOverBar(tooltip, chartIndex);
}

// ==================== ПОЗИЦИОНИРОВАНИЕ ПЛАШКИ ====================

function positionTooltipOverBar(tooltip, chartIndex) {
    if (!ratingChart || chartIndex === undefined || chartIndex === -1) {
        positionTooltipInChartArea(tooltip, null);
        return;
    }

    try {
        const meta = ratingChart.getDatasetMeta(0);
        if (meta && meta.data && meta.data[chartIndex]) {
            const bar = meta.data[chartIndex];
            const canvas = ratingChart.canvas;
            const rect = canvas.getBoundingClientRect();
            const chartArea = ratingChart.chartArea;

            const barX = bar.x;
            const barY = bar.y;

            const scaleX = rect.width / ratingChart.width;
            const scaleY = rect.height / ratingChart.height;

            let pixelX = rect.left + barX * scaleX;
            let pixelY = rect.top + barY * scaleY;

            const chartLeft = rect.left + chartArea.left * scaleX;
            const chartRight = rect.left + chartArea.right * scaleX;
            const chartTop = rect.top + chartArea.top * scaleY;
            const chartBottom = rect.top + chartArea.bottom * scaleY;

            const tooltipWidth = Math.min(parseInt(tooltip.style.maxWidth) || 400, window.innerWidth - 40);
            const tooltipHeight = 220;

            let left = pixelX - tooltipWidth / 2;
            let top = pixelY - 15;

            if (left < chartLeft + 10) {
                left = chartLeft + 10;
            }
            if (left + tooltipWidth > chartRight - 10) {
                left = chartRight - tooltipWidth - 10;
            }

            const showAbove = top - tooltipHeight > chartTop + 10;

            if (showAbove) {
                top = top - 10;
                tooltip.style.transform = 'translateY(-100%)';
                if (top - tooltipHeight < chartTop + 10) {
                    top = chartTop + 10 + tooltipHeight;
                    tooltip.style.transform = 'translateY(0)';
                }
            } else {
                top = pixelY + 30;
                tooltip.style.transform = 'translateY(0)';
                if (top + tooltipHeight > chartBottom - 10) {
                    top = pixelY - 15;
                    tooltip.style.transform = 'translateY(-100%)';
                    if (top - tooltipHeight < chartTop + 10) {
                        positionTooltipInChartArea(tooltip, chartArea);
                        return;
                    }
                }
            }

            if (left < chartLeft + 10) left = chartLeft + 10;
            if (left + tooltipWidth > chartRight - 10) left = chartRight - tooltipWidth - 10;

            if (top < chartTop + 10) {
                top = chartTop + 10;
                tooltip.style.transform = 'translateY(0)';
            }
            if (top + tooltipHeight > chartBottom - 10) {
                top = chartBottom - tooltipHeight - 10;
                tooltip.style.transform = 'translateY(-100%)';
            }

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.style.maxWidth = Math.min(400, window.innerWidth - 40) + 'px';

        } else {
            positionTooltipInChartArea(tooltip, null);
        }
    } catch (e) {
        console.warn('Ошибка позиционирования плашки:', e);
        positionTooltipInChartArea(tooltip, null);
    }
}

function positionTooltipInChartArea(tooltip, chartArea) {
    if (!ratingChart) {
        tooltip.style.left = '50%';
        tooltip.style.top = '20px';
        tooltip.style.transform = 'translateX(-50%)';
        return;
    }

    try {
        const canvas = ratingChart.canvas;
        const rect = canvas.getBoundingClientRect();
        const area = chartArea || ratingChart.chartArea;

        if (area) {
            const scaleX = rect.width / ratingChart.width;
            const scaleY = rect.height / ratingChart.height;

            const chartLeft = rect.left + area.left * scaleX;
            const chartRight = rect.left + area.right * scaleX;
            const chartTop = rect.top + area.top * scaleY;
            const chartBottom = rect.top + area.bottom * scaleY;

            const tooltipWidth = Math.min(parseInt(tooltip.style.maxWidth) || 400, window.innerWidth - 40);
            const tooltipHeight = 220;

            let left = (chartLeft + chartRight) / 2 - tooltipWidth / 2;
            let top = chartTop + 20;

            if (left < chartLeft + 10) left = chartLeft + 10;
            if (left + tooltipWidth > chartRight - 10) left = chartRight - tooltipWidth - 10;
            if (top + tooltipHeight > chartBottom - 10) {
                top = chartBottom - tooltipHeight - 10;
            }
            if (top < chartTop + 10) top = chartTop + 10;

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.style.transform = 'translateY(0)';
            tooltip.style.maxWidth = Math.min(400, window.innerWidth - 40) + 'px';
        } else {
            tooltip.style.left = '50%';
            tooltip.style.top = '20px';
            tooltip.style.transform = 'translateX(-50%)';
        }
    } catch (e) {
        tooltip.style.left = '50%';
        tooltip.style.top = '20px';
        tooltip.style.transform = 'translateX(-50%)';
    }
}

window.removeEventListener('resize', updateTooltipPosition);
window.removeEventListener('scroll', updateTooltipPosition);
window.addEventListener('resize', updateTooltipPosition);
window.addEventListener('scroll', updateTooltipPosition);

if (window.ResizeObserver) {
    const chartContainer = document.getElementById('chart-container');
    if (chartContainer) {
        const resizeObserver = new ResizeObserver(() => {
            updateTooltipPosition();
        });
        resizeObserver.observe(chartContainer);
    }
}

function updateTooltipPosition() {
    const tooltip = document.getElementById('chart-item-tooltip');
    if (tooltip && selectedSearchItem && selectedSearchIndex !== -1) {
        positionTooltipOverBar(tooltip, selectedSearchIndex);
    }
}

window.addEventListener('resize', updateTooltipPosition);
window.addEventListener('scroll', updateTooltipPosition);

function clearChartSelection() {
    if (!ratingChart) return;

    selectedSearchItem = null;
    selectedSearchIndex = -1;

    const displayData = getChartDisplayData();
    if (!displayData || displayData.length === 0) return;

    const colors = displayData.map(item => getDefaultColor(item.rating || 0));

    ratingChart.data.datasets[0].backgroundColor = colors;
    ratingChart.data.datasets[0].borderColor = colors.map(c => c);
    ratingChart.data.datasets[0].borderWidth = displayData.map(() => 1);
    ratingChart.update();

    const tooltip = document.getElementById('chart-item-tooltip');
    if (tooltip) tooltip.remove();
}

function restoreSelectionAfterUpdate() {
    if (!selectedSearchItem || !ratingChart) return;

    const displayData = getChartDisplayData();
    if (!displayData || displayData.length === 0) return;

    let foundIndex = -1;
    for (let i = 0; i < displayData.length; i++) {
        const d = displayData[i];
        if ((d.id !== undefined && selectedSearchItem.id !== undefined && d.id === selectedSearchItem.id) ||
            (d.name && selectedSearchItem.name && d.name === selectedSearchItem.name)) {
            foundIndex = i;
            break;
        }
    }

    if (foundIndex === -1) return;

    const bgColors = displayData.map(d => getDefaultColor(d.rating || 0));

    const borderColors = displayData.map(d => {
        const isSelected = (d.id !== undefined && selectedSearchItem.id !== undefined && d.id === selectedSearchItem.id) ||
            (d.name && selectedSearchItem.name && d.name === selectedSearchItem.name);
        return isSelected ? '#cc0000' : getDefaultColor(d.rating || 0);
    });

    const borderWidths = displayData.map(d => {
        const isSelected = (d.id !== undefined && selectedSearchItem.id !== undefined && d.id === selectedSearchItem.id) ||
            (d.name && selectedSearchItem.name && d.name === selectedSearchItem.name);
        return isSelected ? 3 : 1;
    });

    ratingChart.data.datasets[0].backgroundColor = bgColors;
    ratingChart.data.datasets[0].borderColor = borderColors;
    ratingChart.data.datasets[0].borderWidth = borderWidths;
    ratingChart.update();

    showItemTooltip(selectedSearchItem, foundIndex);
}

// ==================== МАСШТАБИРОВАНИЕ ====================

function updateZoomInfo() {
    const info = document.getElementById('zoom-info');
    if (!info) return;

    if (!ratingChart) {
        info.textContent = ' Нет данных';
        return;
    }

    const dataLength = currentDisplayDataLength || ratingChart.data.labels.length || 0;

    if (dataLength === 0) {
        info.textContent = ' Нет данных';
        return;
    }

    let actualMin = ratingChart.options.scales.x.min;
    let actualMax = ratingChart.options.scales.x.max;

    if (actualMin === undefined || actualMax === undefined) {
        actualMin = zoomStartIndex;
        actualMax = zoomEndIndex;
    }

    const safeStart = Math.max(0, Math.min(Math.round(actualMin), dataLength - 1));
    const safeEnd = Math.max(1, Math.min(Math.round(actualMax), dataLength));
    const safeVisible = safeEnd - safeStart;

    zoomStartIndex = safeStart;
    zoomEndIndex = safeEnd;

    const percent = Math.round((safeVisible / dataLength) * 100);

    if (safeVisible >= dataLength) {
        info.textContent = ` Видно: все ${dataLength} записей (100%)`;
    } else {
        info.textContent = ` Видно: ${safeVisible} из ${dataLength} (${percent}%)`;
    }
}

function zoomIn() {
    if (!ratingChart) return;

    const dataLength = currentDisplayDataLength || ratingChart.data.labels.length || 0;
    if (dataLength === 0) return;

    let currentMin = ratingChart.options.scales.x.min;
    let currentMax = ratingChart.options.scales.x.max;

    if (currentMin === undefined || currentMax === undefined) {
        currentMin = zoomStartIndex;
        currentMax = zoomEndIndex;
    }

    const currentVisible = Math.round(currentMax - currentMin);
    const newVisible = Math.max(2, Math.floor(currentVisible * 0.7));

    const newStart = Math.round(currentMin);
    const newEnd = Math.min(dataLength, newStart + newVisible);

    zoomStartIndex = newStart;
    zoomEndIndex = newEnd;

    applyZoom();
}

function zoomOut() {
    if (!ratingChart) return;

    const dataLength = currentDisplayDataLength || ratingChart.data.labels.length || 0;
    if (dataLength === 0) return;

    let currentMin = ratingChart.options.scales.x.min;
    let currentMax = ratingChart.options.scales.x.max;

    if (currentMin === undefined || currentMax === undefined) {
        currentMin = zoomStartIndex;
        currentMax = zoomEndIndex;
    }

    const currentVisible = Math.round(currentMax - currentMin);
    const newVisible = Math.min(dataLength, Math.floor(currentVisible * 1.5));

    const newStart = Math.round(currentMin);
    const newEnd = Math.min(dataLength, newStart + newVisible);

    zoomStartIndex = newStart;
    zoomEndIndex = newEnd;

    applyZoom();
}

function resetZoom() {
    if (!ratingChart) return;

    const dataLength = currentDisplayDataLength || ratingChart.data.labels.length || 0;
    zoomStartIndex = 0;
    zoomEndIndex = dataLength;
    applyZoom();
}

function applyZoom() {
    if (!ratingChart) return;

    const dataLength = currentDisplayDataLength || ratingChart.data.labels.length || 0;
    if (dataLength === 0) return;

    let start = Math.max(0, Math.round(zoomStartIndex));
    let end = Math.min(dataLength, Math.round(zoomEndIndex));

    if (end - start < 2) {
        if (start >= dataLength - 1) {
            start = Math.max(0, dataLength - 2);
            end = dataLength;
        } else {
            end = Math.min(dataLength, start + 2);
        }
    }

    if (start >= end) {
        start = Math.max(0, end - 2);
    }
    if (start >= dataLength) {
        start = Math.max(0, dataLength - 2);
        end = dataLength;
    }

    zoomStartIndex = start;
    zoomEndIndex = end;

    ratingChart.options.scales.x.min = start;
    ratingChart.options.scales.x.max = end;
    ratingChart.update();

    updateZoomInfo();
}

// ==================== ПАНЕЛЬ УПРАВЛЕНИЯ ДИАГРАММОЙ ====================

function renderChartControls(currentSortField) {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) return;

    const oldControls = document.getElementById('chart-controls');
    if (oldControls) oldControls.remove();

    const controls = document.createElement('div');
    controls.id = 'chart-controls';
    controls.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 15px !important;
        padding: 10px 15px !important;
        flex-shrink: 0 !important;
        margin-bottom: 10px !important;
        background: #f5f5f5 !important;
        border-radius: 8px !important;
        border: 1px solid #ddd !important;
        flex-wrap: wrap !important;
    `;

    const sortLabel = document.createElement('label');
    sortLabel.textContent = 'Сортировка:';
    sortLabel.style.cssText = `
        font-weight: 600 !important;
        font-size: 15px !important;
        color: #1a1a1a !important;
        white-space: nowrap !important;
    `;
    controls.appendChild(sortLabel);

    const sortSelect = document.createElement('select');
    sortSelect.id = 'chart-sort-select';
    sortSelect.style.cssText = `
        padding: 5px 10px !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        font-size: 14px !important;
        height: 34px !important;
        background: #fff !important;
        cursor: pointer !important;
    `;

    const options = [
        { value: 'rating', label: 'По рейтингу (убывание)' },
        { value: 'name', label: 'По названию (А-Я)' }
    ];
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === currentSortField) {
            option.selected = true;
        }
        sortSelect.appendChild(option);
    });

    sortSelect.addEventListener('change', function() {
        // Полный сброс перед пересборкой
        chartSearchQuery = '';
        searchResults = [];
        selectedSearchItem = null;
        selectedSearchIndex = -1;
        zoomStartIndex = 0;
        zoomEndIndex = 0;

        // Очищаем поле поиска и подсказки
        const searchInput = document.getElementById('chart-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        const resultsContainer = document.getElementById('chart-search-results');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
        }

        // Убираем тултип выделенного элемента
        const tooltip = document.getElementById('chart-item-tooltip');
        if (tooltip) tooltip.remove();

        // Пересобираем диаграмму с нуля — без сохранения зума и выделения
        const currentData = chartAllData.length > 0 ? chartAllData : [];
        createRatingChart(currentData, chartType);
    });
    controls.appendChild(sortSelect);

    const divider = document.createElement('span');
    divider.textContent = '|';
    divider.style.cssText = `
        color: #ccc !important;
        font-size: 22px !important;
        padding: 0 5px !important;
    `;
    controls.appendChild(divider);

    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Поиск:';
    searchLabel.style.cssText = `
        font-weight: 600 !important;
        font-size: 15px !important;
        color: #1a1a1a !important;
        white-space: nowrap !important;
    `;
    controls.appendChild(searchLabel);

    const searchContainer = document.createElement('div');
    searchContainer.id = 'chart-search-container';
    searchContainer.style.cssText = `
        position: relative;
        flex: 1;
        min-width: 200px;
        display: flex;
        gap: 8px;
        align-items: center;
    `;

    const searchInput = document.createElement('input');
    searchInput.id = 'chart-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Введите название НП...';
    searchInput.value = chartSearchQuery;
    searchInput.style.cssText = `
        flex: 1;
        min-width: 150px;
        padding: 5px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
        height: 34px;
        box-sizing: border-box;
    `;

    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'chart-search-results';
    resultsContainer.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 300px;
        overflow-y: auto;
        background: #ffffff;
        border: 1px solid #ccc;
        border-top: none;
        border-radius: 0 0 4px 4px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: none;
        margin-top: -1px;
    `;
    searchContainer.appendChild(resultsContainer);

    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        chartSearchQuery = query;

        const resultsContainer = document.getElementById('chart-search-results');
        if (!resultsContainer) return;

        if (query.length === 0) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
            clearChartSelection();
            rebuildChartPreservingZoom();
            return;
        }

        const data = chartAllData.length > 0 ? chartAllData : [];
        const queryLower = query.toLowerCase();

        const results = data.filter(item => {
            const name = (item.name || '').toLowerCase();
            return name.includes(queryLower);
        });

        searchResults = results;
        renderSearchResults(results, query, resultsContainer);

        rebuildChartPreservingZoom();
    });

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (searchResults.length > 0) {
                selectSearchResult(searchResults[0], 0);
            }
        }
        if (e.key === 'Escape') {
            resultsContainer.style.display = 'none';
            this.blur();
        }
    });

    searchInput.addEventListener('blur', function() {
        setTimeout(() => {
            resultsContainer.style.display = 'none';
        }, 300);
    });

    searchInput.addEventListener('focus', function() {
        const query = this.value.trim();
        if (query.length > 0 && searchResults.length > 0) {
            resultsContainer.style.display = 'block';
        }
    });

    searchContainer.appendChild(searchInput);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '✕';
    clearBtn.title = 'Очистить поиск и снять выделение';
    clearBtn.style.cssText = `
        padding: 0 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
        cursor: pointer;
        font-size: 16px;
        height: 34px;
        color: #666;
        flex-shrink: 0;
    `;
    clearBtn.addEventListener('click', function() {
        chartSearchQuery = '';
        searchInput.value = '';
        searchResults = [];

        const resultsContainer = document.getElementById('chart-search-results');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
        }

        clearChartSelection();
        selectedSearchItem = null;
        selectedSearchIndex = -1;

        rebuildChartPreservingZoom();
    });
    searchContainer.appendChild(clearBtn);

    controls.appendChild(searchContainer);

    const divider2 = document.createElement('span');
    divider2.textContent = '|';
    divider2.style.cssText = `
        color: #ccc !important;
        font-size: 22px !important;
        padding: 0 5px !important;
    `;
    controls.appendChild(divider2);

    const zoomLabel = document.createElement('label');
    zoomLabel.textContent = 'Масштаб:';
    zoomLabel.style.cssText = `
        font-weight: 600 !important;
        font-size: 15px !important;
        color: #1a1a1a !important;
        white-space: nowrap !important;
    `;
    controls.appendChild(zoomLabel);

    const zoomInBtn = document.createElement('button');
    zoomInBtn.textContent = '+';
    zoomInBtn.title = 'Увеличить масштаб';
    zoomInBtn.style.cssText = `
        padding: 0 14px !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        background: #fff !important;
        cursor: pointer !important;
        font-size: 18px !important;
        height: 34px !important;
        font-weight: 700 !important;
        color: #1a1a1a !important;
    `;
    zoomInBtn.addEventListener('click', zoomIn);
    controls.appendChild(zoomInBtn);

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '−';
    zoomOutBtn.title = 'Уменьшить масштаб';
    zoomOutBtn.style.cssText = `
        padding: 0 14px !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        background: #fff !important;
        cursor: pointer !important;
        font-size: 18px !important;
        height: 34px !important;
        font-weight: 700 !important;
        color: #1a1a1a !important;
    `;
    zoomOutBtn.addEventListener('click', zoomOut);
    controls.appendChild(zoomOutBtn);

    const resetZoomBtn = document.createElement('button');
    resetZoomBtn.textContent = 'Сброс';
    resetZoomBtn.title = 'Сбросить масштаб';
    resetZoomBtn.style.cssText = `
        padding: 0 14px !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        background: #fff !important;
        cursor: pointer !important;
        font-size: 14px !important;
        height: 34px !important;
        font-weight: 500 !important;
        color: #1a1a1a !important;
    `;
    resetZoomBtn.addEventListener('click', resetZoom);
    controls.appendChild(resetZoomBtn);

    const zoomInfo = document.createElement('span');
    zoomInfo.id = 'zoom-info';
    zoomInfo.textContent = 'Видно: все';
    zoomInfo.style.cssText = `
        font-size: 14px !important;
        color: #555 !important;
        margin-left: auto !important;
        font-weight: 500 !important;
        display:none;
    `;
    controls.appendChild(zoomInfo);

    const title = chartContainer.querySelector('.chart-title');
    if (title) {
        chartContainer.insertBefore(controls, title.nextSibling);
    } else {
        chartContainer.prepend(controls);
    }

    const dataLength = currentDisplayDataLength || chartAllData.length || 0;
    zoomStartIndex = 0;
    zoomEndIndex = dataLength;

    if (ratingChart) {
        ratingChart.options.scales.x.min = 0;
        ratingChart.options.scales.x.max = dataLength;
        ratingChart.update();
    }

    updateZoomInfo();
}

// ==================== СОЗДАНИЕ ДИАГРАММЫ ====================

function createRatingChart(data, type) {
    const canvas = document.getElementById('rating-chart');
    if (!canvas) {
        console.error('Canvas для диаграммы не найден');
        return;
    }

    destroyChart();

    const ctx = canvas.getContext('2d');

    chartAllData = [...data];
    chartCurrentData = [...data];
    chartType = type;

    const existingSortSelect = document.getElementById('chart-sort-select');
    let sortField = 'rating';
    if (existingSortSelect) {
        sortField = existingSortSelect.value;
    }

    let sortedData = [...chartAllData];
    if (sortField === 'rating') {
        sortedData.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortField === 'name') {
        sortedData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    let displayData = sortedData;
    if (chartSearchQuery.trim()) {
        const query = chartSearchQuery.trim().toLowerCase();
        displayData = sortedData.filter(item =>
            (item.name || '').toLowerCase().includes(query) ||
            (item.region_name || '').toLowerCase().includes(query) ||
            (item.district_name || '').toLowerCase().includes(query)
        );
    }

    currentDisplayDataLength = displayData.length;
    chartDisplayData = displayData;

    const labels = displayData.map(item => item.name || `ID: ${item.id}`);
    const values = displayData.map(item => item.rating || 0);

    const bgColors = displayData.map(item => getDefaultColor(item.rating || 0));

    const borderColors = displayData.map(item => {
        if (selectedSearchItem &&
            (item.id === selectedSearchItem.id || item.name === selectedSearchItem.name)) {
            return '#cc0000';
        }
        return getDefaultColor(item.rating || 0);
    });

    const borderWidths = displayData.map(item => {
        if (selectedSearchItem &&
            (item.id === selectedSearchItem.id || item.name === selectedSearchItem.name)) {
            return 3;
        }
        return 1;
    });

    let labelText = '';
    switch (type) {
        case 'provided': labelText = 'Обеспеченность НП'; break;
        case 'deficit': labelText = 'Рейтинг дефицита'; break;
        case 'norms_provided': labelText = 'Нормы обеспеченности'; break;
        default: labelText = 'Рейтинг';
    }

    ratingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: labelText,
                data: values,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: borderWidths,
                borderRadius: 0,
                barPercentage: 0.8,
                categoryPercentage: 0.9,
                minBarLength: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
                axis: 'x'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    intersect: false,
                    mode: 'index',
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#e67e22',
                    borderWidth: 2,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            const item = displayData[context.dataIndex];
                            const rating = item.rating;
                            const ratingText = (rating !== undefined && rating !== null && !isNaN(rating)) ?
                                rating.toFixed(2) : 'не получен';
                            let label = `${context.dataset.label}: ${ratingText}`;
                            if (item) {
                                label += `\nНаселение: ${item.population || 0}`;
                                label += `\nРегион: ${item.region_name || 'Н/Д'}`;
                                label += `\nРайон: ${item.district_name || 'Н/Д'}`;
                                label += `\nID: ${item.id}`;
                            }
                            return label;
                        },
                        title: function(context) {
                            const item = displayData[context[0].dataIndex];
                            return item ? item.name || `ID: ${item.id}` : '';
                        }
                    }
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: false },
                        pinch: { enabled: false },
                        mode: 'x'
                    },
                    pan: {
                        enabled: false
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Населенные пункты',
                        color: '#000000',
                        font: {
                            size: 15,
                            weight: 'bold'
                        }
                    },
                    ticks: { display: false },
                    border: {
                        color: '#000000',
                        width: 2
                    }
                },
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 100,
                    grid: {
                        color: 'rgba(0,0,0,0.1)',
                        drawBorder: true
                    },
                    ticks: {
                        stepSize: 5,
                        font: {
                            size: 13
                        },
                        color: '#000000',
                        callback: function(value) {
                            return value.toFixed(0);
                        }
                    },
                    title: {
                        display: true,
                        text: 'Значение рейтинга',
                        color: '#000000',
                        font: {
                            size: 15,
                            weight: 'bold'
                        }
                    },
                    border: {
                        color: '#000000',
                        width: 2
                    }
                }
            },
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
            hover: {
                mode: 'index',
                intersect: false,
                animationDuration: 200
            },
            elements: {
                bar: {
                    borderRadius: 0,
                    hoverBackgroundColor: function(context) {
                        const index = context.dataIndex;
                        const item = displayData[index];
                        if (item) {
                            const value = item.rating || 0;
                            if (value > 50) return '#009933';
                            if (value > 25) return '#0055cc';
                            return '#cc5500';
                        }
                        return '#ff6600';
                    },
                    hoverBorderColor: '#000000',
                    hoverBorderWidth: 2
                }
            }
        },
        plugins: [{
            id: 'thresholdLines',
            afterDraw: function(chart) {
                const yScale = chart.scales.y;
                const xScale = chart.scales.x;

                if (!yScale || !xScale) return;

                const ctx2 = chart.ctx;
                const y25 = yScale.getPixelForValue(25);
                const y50 = yScale.getPixelForValue(50);

                ctx2.save();
                ctx2.beginPath();
                ctx2.setLineDash([]);
                ctx2.strokeStyle = '#0055cc';
                ctx2.lineWidth = 2.5;
                ctx2.moveTo(xScale.left, y25);
                ctx2.lineTo(xScale.right, y25);
                ctx2.stroke();
                ctx2.restore();

                ctx2.save();
                ctx2.fillStyle = '#0055cc';
                ctx2.font = 'bold 12px Arial';
                ctx2.textAlign = 'right';
                ctx2.textBaseline = 'bottom';
                ctx2.fillText('25', xScale.right - 5, y25 - 3);
                ctx2.restore();

                ctx2.save();
                ctx2.beginPath();
                ctx2.setLineDash([]);
                ctx2.strokeStyle = '#00cc44';
                ctx2.lineWidth = 2.5;
                ctx2.moveTo(xScale.left, y50);
                ctx2.lineTo(xScale.right, y50);
                ctx2.stroke();
                ctx2.restore();

                ctx2.save();
                ctx2.fillStyle = '#00cc44';
                ctx2.font = 'bold 12px Arial';
                ctx2.textAlign = 'right';
                ctx2.textBaseline = 'bottom';
                ctx2.fillText('50', xScale.right - 5, y50 - 3);
                ctx2.restore();
            }
        }]
    });

    isChartMode = true;

    const chartContainer = document.getElementById('chart-container');
    if (chartContainer) {
        const existingTitle = chartContainer.querySelector('.chart-title');
        if (existingTitle) existingTitle.remove();
        const existingCount = chartContainer.querySelector('.chart-count');
        if (existingCount) existingCount.remove();

        const title = document.createElement('div');
        title.className = 'chart-title';
        title.textContent = 'Диаграмма рейтинга НП';
        title.style.cssText = `
            text-align: center;
            font-size: 22px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 4px 0;
            flex-shrink: 0;
        `;
        chartContainer.prepend(title);

        const countEl = document.createElement('div');
        countEl.className = 'chart-count';
        const totalCount = sortedData.length;
        countEl.textContent = `Всего НП: ${totalCount}`;
        countEl.style.cssText = `
            text-align: center;
            font-size: 14px;
            color: #666;
            margin: 0 0 8px 0;
            flex-shrink: 0;
        `;

        if (title.nextSibling) {
            chartContainer.insertBefore(countEl, title.nextSibling);
        } else {
            chartContainer.appendChild(countEl);
        }
    }

    renderChartControls(sortField);

    const paginationContainer = document.getElementById('settlements-pagination');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
    }

    zoomStartIndex = 0;
    zoomEndIndex = currentDisplayDataLength;

    if (ratingChart) {
        ratingChart.options.scales.x.min = 0;
        ratingChart.options.scales.x.max = currentDisplayDataLength;
        ratingChart.update();
    }

    updateZoomInfo();

    if (selectedSearchItem) {
        setTimeout(() => restoreSelectionAfterUpdate(), 100);
    }
}

// ==================== КНОПКИ ====================

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

    if (!showRatings || isChartMode) {
        hideCalculateAllButton();
        return;
    }

    const resBtn = document.getElementById('res-action-btn');
    if (resBtn) resBtn.remove();
    const wiredBtn = document.getElementById('wired-action-btn');


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

    if (!showRatings || !selectedSettlementId || isChartMode) {
        hideCalculateSelectedButton();
        return;
    }

    let btn = document.getElementById('calculate-selected-btn');
    if (!btn) {
        btn = createCalculateSelectedBtn();
        const calcAllBtn = document.getElementById('calculate-all-btn');
        if (calcAllBtn) {
            container.insertBefore(btn, calcAllBtn.nextSibling);
        } else {
            const firstBtn = container.querySelector('.grid-btn');
            if (firstBtn) {
                container.insertBefore(btn, firstBtn);
            } else {
                container.appendChild(btn);
            }
        }
    }
}

function hideCalculateSelectedButton() {
    const btn = document.getElementById('calculate-selected-btn');
    if (btn) btn.remove();
}

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

async function handleWiredButton() {
    //renderPopup('Функция "Проводные УС" в разработке');
}

function showSettlementButtons() {
    const container = document.querySelector('.table_buttons');
    if (!container) return;

    if (isChartMode) {
        hideSettlementButtons();
        return;
    }

    // Удаляем все прежние кнопки
    ['res-action-btn', 'wired-action-btn', 'calculate-all-btn', 'calculate-selected-btn']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

    // Кнопка РЭС нужна всегда
    const resBtn = createResButton();

    const firstBtn = container.querySelector('.grid-btn');
    if (firstBtn) {
        container.insertBefore(resBtn, firstBtn);
    } else {
        container.appendChild(resBtn);
    }

    // 🔽 Кнопка «Проводные УС» — ТОЛЬКО для таблицы НП (не для рейтингов)
    if (!showRatings) {
        const wiredBtn = createWiredButton();
        const resBtnNow = document.getElementById('res-action-btn');
        if (resBtnNow) {
            container.insertBefore(wiredBtn, resBtnNow.nextSibling);
        } else {
            container.appendChild(wiredBtn);
        }
    }

    // Дополнительные кнопки для режима рейтингов
    if (showRatings) {
        const calcAllBtn = createCalculateAllBtn();
        const calcSelectedBtn = createCalculateSelectedBtn();

        const resBtnNow = document.getElementById('res-action-btn');
        if (resBtnNow) {
            container.insertBefore(calcAllBtn, resBtnNow);
            container.insertBefore(calcSelectedBtn, resBtnNow);
        } else {
            container.appendChild(calcAllBtn);
            container.appendChild(calcSelectedBtn);
        }
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
// ==================== ЗАГРУЗКА РЕГИОНОВ ====================

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
            option.value = String(region.number).trim();
            option.textContent = region.name;
            select.appendChild(option);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const regionsParam = urlParams.get('regions');

        if (regionsParam) {
            const regionIds = regionsParam.split(',').map(id => id.trim());

            const allOptions = select.querySelectorAll('option');
            allOptions.forEach(opt => opt.selected = false);

            let foundCount = 0;
            allOptions.forEach(opt => {
                if (opt.value === 'all') return;
                const optValue = String(opt.value).trim();
                if (regionIds.includes(optValue)) {
                    opt.selected = true;
                    foundCount++;
                }
            });

            if (foundCount === 0) {
                const allOpt = select.querySelector('option[value="all"]');
                if (allOpt) allOpt.selected = true;
            }
        }

        loader.close();
        return regions;
    } catch (error) {
        loader.close();
        //renderPopup(`Ошибка загрузки регионов: ${error.message}`, true);
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
        //renderPopup(`Ошибка загрузки видов связи: ${error.message}`, true);
        console.error('Ошибка загрузки видов связи:', error);
        return [];
    }
}

function getSelectedRegions() {
    const regionSelect = document.getElementById('region');
    if (!regionSelect) return [];

    const selectedOptions = regionSelect.selectedOptions;
    const values = [];

    for (let i = 0; i < selectedOptions.length; i++) {
        let val = String(selectedOptions[i].value).trim();
        if (val === 'all') {
            const allOptions = regionSelect.querySelectorAll('option');
            const allIds = [];
            allOptions.forEach(opt => {
                const optVal = String(opt.value).trim();
                if (optVal !== 'all' && optVal) {
                    allIds.push(optVal);
                }
            });
            return allIds;
        }
        if (val) {
            values.push(val);
        }
    }

    return values;
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

// ==================== ФУНКЦИИ СТРАНИЦ ====================

function getPageSize(tableType) {
    return settlementsData.pageSize || 100;
}

function getPage() {
    return 0;
}

// ==================== РАСЧЕТ РАДИУСА ====================

function calculateRadius(area) {
    if (!area || area <= 0) return 1;
    const radius = Math.round(1.1 * Math.sqrt(area / Math.PI));
    return radius >= 1 ? radius : 1;
}

// ==================== ФИЛЬТРАЦИЯ ====================

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
        'rating',
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
            const rating = ratings[String(row.id)] || {};
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

// ==================== ЗАГРУЗКА НП ====================

async function loadSettlements(page = 0, regions, popRange, pageSize) {
    const loader = initLoader();
    loader.show('Загрузка населенных пунктов...');

    try {
        await loadTableStructures();

        const body = {
            regions: regions,
            population_filters: [
                {
                    from: popRange.from,
                    to: popRange.to
                }
            ]
        };

        const result = await getSettlementsPage(0, 1, body);

        loader.close();

        if (result) {
            const allItems = result.settlements || [];
            return {
                items: allItems,
                total: allItems.length
            };
        }

        return { items: [], total: 0 };
    } catch (error) {
        loader.close();
        //renderPopup(`Ошибка загрузки населенных пунктов: ${error.message}`, true);
        console.error('Ошибка загрузки населенных пунктов:', error);
        return { items: [], total: 0 };
    }
}

// ==================== ЗАГРУЗКА РЕЙТИНГОВ ====================

async function loadRatingsForSettlements(items, allowPost = false) {
    const total = items.length;
    if (total === 0) {
        //renderPopup('Нет населенных пунктов для загрузки рейтингов', true);
        return;
    }

    const bulkRatings = await loadRatingsBulk(currentRegions, currentPopRange);

    Object.keys(bulkRatings).forEach(id => {
        allRatings[id] = bulkRatings[id];
    });

    if (allowPost) {
        const missing = items.filter(it => !allRatings[String(it.id)]);
        if (missing.length === 0) {
            //renderPopup(`Все рейтинги уже загружены (${total} НП)`, false);
            return;
        }

        const modal = createProgressModal(missing.length);
        const titleEl = modal.querySelector('.progress-modal-title');
        if (titleEl) titleEl.textContent = 'Расчет рейтингов';

        isCancelled = false;
        let processed = 0;
        let successCount = 0;

        for (const settlement of missing) {
            if (isCancelled) {
                closeProgressModal();
                //renderPopup(`Расчёт отменён. Обработано ${processed} из ${missing.length}, получено ${successCount}.`, false);
                return;
            }

            try {
                await postRatingSett(settlement.id);
            } catch (postErr) {
                console.warn(`▶ НП ${settlement.id}: ошибка POST`, postErr);
            }

            processed++;
            updateProgress(processed, missing.length, successCount);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const refreshed = await loadRatingsBulk(currentRegions, currentPopRange);
        Object.keys(refreshed).forEach(id => {
            allRatings[id] = refreshed[id];
        });

        successCount = missing.filter(s => allRatings[String(s.id)]).length;

        closeProgressModal();
        //renderPopup(`Расчёт завершён. Обработано ${processed}, получено ${successCount}.`, false);
    } else {
        //renderPopup(`Загружено рейтингов: ${Object.keys(bulkRatings).length} из ${total}`, false);
    }
}

// ==================== СОРТИРОВКА ====================

function sortDataWithRatings(data, ratings, sortField, sortOrder) {
    if (!sortField || data.length === 0) return data;

    const ratingFields = [
        'rating',
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
            const rating = ratings[String(item.id)] || {};
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

function getPageData(allData, page, pageSize) {
    const start = page * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    return allData.slice(start, end);
}

// ==================== РАСЧЕТ РЕЙТИНГА (ВЫБРАННЫЙ) ====================

async function handleCalculateSelected() {
    if (!selectedSettlementId) {
        //renderPopup('Выберите населенный пункт в таблице', true);
        return;
    }

    const loader = initLoader();
    loader.show(`Расчет рейтинга для НП: ${selectedSettlementName || selectedSettlementId}...`);

    try {
        await postRatingSett(selectedSettlementId);

        const bulkRatings = await loadRatingsBulk(currentRegions, currentPopRange);
        Object.keys(bulkRatings).forEach(id => {
            allRatings[id] = bulkRatings[id];
        });

        const ratingData = allRatings[String(selectedSettlementId)];

        loader.close();

        if (ratingData !== null && ratingData !== undefined) {
            const pageSize = getPageSize('settlements');

            if (savedFilterField && savedFilterValue) {
                renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
            } else {
                renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
            }

            //renderPopup(`Рейтинг для НП "${selectedSettlementName || selectedSettlementId}" успешно рассчитан!`, false);
        } else {
            //renderPopup(`Не удалось получить рейтинг для НП "${selectedSettlementName || selectedSettlementId}"`, true);
        }
    } catch (error) {
        loader.close();
        //renderPopup(`Ошибка расчета рейтинга: ${error.message}`, true);
        console.error('Ошибка расчета рейтинга:', error);
    }
}

// ==================== РАСЧЕТ РЕЙТИНГА (ВСЕ) ====================

async function handleCalculateAll() {
    const items = currentSettlementsFiltered || settlementsData.items || [];

    if (items.length === 0) {
        //renderPopup('Нет населенных пунктов для расчета', true);
        return;
    }

    const existing = await loadRatingsBulk(currentRegions, currentPopRange);
    Object.keys(existing).forEach(id => {
        allRatings[id] = existing[id];
    });

    const settlementsToCalculate = items
        .filter(it => !allRatings[String(it.id)])
        .map(item => ({
            id: item.id,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            area: parseFloat(item.area) || 1
        }));

    const total = settlementsToCalculate.length;

    if (total === 0) {
        //renderPopup('Рейтинги для всех НП уже загружены', false);
        const pageSize = getPageSize('settlements');
        if (savedFilterField && savedFilterValue) {
            renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
        } else {
            renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
        }
        return;
    }

    //renderPopup(`Начинаем расчет рейтингов для ${total} населенных пунктов...`, false);

    isCalculateMode = true;
    isCancelled = false;

    const modal = createProgressModal(total);

    let processed = 0;
    let successCount = 0;

    for (const settlement of settlementsToCalculate) {
        if (isCancelled) break;

        try {
            await postRatingSett(settlement.id);
        } catch (postErr) {
            console.warn(`▶ НП ${settlement.id}: POST ошибка`, postErr);
        }

        processed++;
        updateProgress(processed, total, successCount);
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    const bulkRatings = await loadRatingsBulk(currentRegions, currentPopRange);
    Object.keys(bulkRatings).forEach(id => {
        allRatings[id] = bulkRatings[id];
    });

    successCount = settlementsToCalculate.filter(
        s => allRatings[String(s.id)]
    ).length;

    closeProgressModal();

    if (isCancelled) {
        //renderPopup(`Расчёт отменён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    } else {
        //renderPopup(`Расчёт завершён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    }

    const pageSize = getPageSize('settlements');

    if (savedFilterField && savedFilterValue) {
        renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
    } else {
        renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
    }
}

// ==================== ДВОЙНОЙ КЛИК ====================

function setupDoubleClickHandler() {
    const table = document.getElementById('settlements-table');
    if (table) {
        table.addEventListener('dblclick', function(e) {
            const row = e.target.closest('tr');
            if (!row) return;

            const headerCells = this.querySelectorAll('thead th');
            let hasRatingColumns = false;
            headerCells.forEach(th => {
                if (th.textContent.includes('РЭС') || th.textContent.includes('Количество РЭС') || th.textContent.includes('Суммарная оценка')) {
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

                openEditModal(id, 'settlement');
            }
        });
    }

    document.addEventListener('dblclick', function(e) {
        const table = document.getElementById('settlements-table');
        if (!table) return;

        const headerCells = table.querySelectorAll('thead th');
        let hasRatingColumns = false;
        headerCells.forEach(th => {
            if (th.textContent.includes('РЭС') || th.textContent.includes('Количество РЭС') || th.textContent.includes('Суммарная оценка')) {
                hasRatingColumns = true;
            }
        });

        if (!hasRatingColumns) return;

        const row = e.target.closest('#settlements-table tbody tr');
        if (!row) return;

        document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
            tr.classList.remove('selected');
        });
        row.classList.add('selected');

        openEditModal(row.dataset.id, 'rating');
    });
}

// ==================== ЛОКАЛЬНОЕ ОБНОВЛЕНИЕ ДАННЫХ ====================

/**
 * Применяет изменения к локальным данным без повторной загрузки с сервера.
 * Пустое значение инпута приходит как null — так и сохраняем.
 * @param {string|number} settlementId
 * @param {'settlements'|'ranking'} table
 * @param {Object} updates - { dbColumn: newValue | null }
 */
function applyLocalUpdates(settlementId, table, updates) {
    if (!updates || Object.keys(updates).length === 0) return;

    if (table === 'settlements') {
        const item = settlementsData.items.find(
            it => String(it.id) === String(settlementId)
        );
        if (!item) return;

        Object.keys(updates).forEach(dbColumn => {
            const objKey = SETTLEMENTS_DB_TO_OBJECT_KEY[dbColumn] || dbColumn;
            let newValue = updates[dbColumn];

            // null оставляем как есть
            if (newValue === null) {
                item[objKey] = null;
                return;
            }

            if (newValue !== '' && !isNaN(newValue)) {
                const textFields = [
                    'NAME', 'OTHER_NAME', 'REGION_NAME',
                    'DISTRICT', 'FIAS_GUID'
                ];
                if (!textFields.includes(dbColumn)) {
                    newValue = Number(newValue);
                }
            }

            item[objKey] = newValue;
        });
    } else if (table === 'ranking') {
        const idStr = String(settlementId);
        const rating = allRatings[idStr];
        if (!rating) return;

        Object.keys(updates).forEach(dbColumn => {
            const objKey = RANKING_DB_TO_OBJECT_KEY[dbColumn] || dbColumn;
            let newValue = updates[dbColumn];

            if (newValue === null) {
                rating[objKey] = null;
                return;
            }

            if (newValue !== '' && !isNaN(newValue)) {
                newValue = Number(newValue);
            }

            rating[objKey] = newValue;
        });
    }
}

function refreshCurrentView(settlementId) {
    const pageSize = getPageSize('settlements');

    if (isChartMode) {
        const chartData = settlementsData.items.map(item => {
            const rating = allRatings[String(item.id)] || {};
            return {
                id: item.id,
                name: item.name,
                region_name: item.region_name,
                district_name: item.district_name,
                population: item.population,
                rating: rating.rating || 0
            };
        });

        chartData.sort((a, b) => (b.rating || 0) - (a.rating || 0));

        showChartContainer();
        createRatingChart(chartData, chartType);
        return;
    }

    const keepFilter = !!(savedFilterField && savedFilterValue);

    if (showRatings) {
        renderCombinedTable(
            originalDataForFilter,
            originalTotalForFilter,
            currentDisplayPage,
            pageSize,
            keepFilter
        );
    } else {
        renderSettlementsTableOnly(
            originalDataForFilter,
            originalTotalForFilter,
            currentDisplayPage,
            pageSize,
            keepFilter
        );
    }

    if (settlementId !== undefined && settlementId !== null) {
        const rows = document.querySelectorAll('#settlements-table tbody tr');
        rows.forEach(tr => {
            if (String(tr.dataset.id) === String(settlementId)) {
                tr.classList.add('selected');
            } else {
                tr.classList.remove('selected');
            }
        });
    }
}

// ==================== НОВЫЕ ОБРАБОТЧИКИ ====================

/**
 * Общая загрузка данных для режимов "Диаграмма рейтинга НП" и "Цифровой дефицит НП".
 * Возвращает true при успехе.
 */
async function loadRatingsData() {
    isCalculateMode = false;
    isChartMode = false;

    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;
    currentDisplayPage = 0;

    hideResPageSize();

    const regions = getSelectedRegions();
    const popRange = getPopulationRange();
    const kinds = getSelectedKinds();

    if (regions.length === 0) {
        showRegionWarning();
        return false;
    }

    currentRegions = regions;
    currentPopRange = popRange;
    currentKinds = kinds;

    const pageSize = getPageSize('settlements');
    const page = getPage();
    const result = await loadSettlements(page, regions, popRange, pageSize);

    if (!result || result.items.length === 0) {
        return false;
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

    return true;
}

/**
 * Кнопка «Диаграмма рейтинга НП» — загружает данные и открывает диаграмму.
 */
async function handleRatingChartButton() {
    const ok = await loadRatingsData();
    if (!ok) return;

    //createViewModeToggle();

    switchToChartMode();

    // Устанавливаем радио "Диаграмма" в активное состояние
    const chartRadio = document.querySelector('input[name="view-mode"][value="chart"]');
    if (chartRadio) chartRadio.checked = true;
}

/**
 * Кнопка «Цифровой дефицит НП» — загружает данные и открывает таблицу с рейтингами.
 */
async function handleRatingTableButton() {
    const ok = await loadRatingsData();
    if (!ok) return;

    //createViewModeToggle();

    const pageSize = getPageSize('settlements');
    renderCombinedTable(originalDataForFilter, originalTotalForFilter, 0, pageSize, false);

    showSettlementButtons();

    const tableRadio = document.querySelector('input[name="view-mode"][value="table"]');
    if (tableRadio) tableRadio.checked = true;
}
// ==================== МОДАЛКА РЕДАКТИРОВАНИЯ ====================

async function openEditModal(settlementId, type) {
    if (!settlementId) return;

    await loadTableStructures();

    const settlementsColumns = settlementsColumnsCache || [];
    const rankingColumns = rankingColumnsCache || [];

    const settlement = settlementsData.items.find(it => String(it.id) === String(settlementId)) || {};
    const ranking = allRatings[String(settlementId)] || {};

    // ---- Порядок колонок такой же, как в отображаемой таблице ----
    const getColumnOrderFromTable = (tableSelector) => {
        const order = [];
        const table = document.querySelector(tableSelector);
        if (!table) return order;
        const ths = table.querySelectorAll('thead th');
        ths.forEach(th => {
            let text = th.textContent || '';
            text = text.replace(/[▲▼]/g, '').trim();
            if (text) order.push(text);
        });
        return order;
    };

    const settlementsLabelToColumn = {};
    Object.keys(SETTLEMENTS_COLUMN_LABELS).forEach(col => {
        settlementsLabelToColumn[SETTLEMENTS_COLUMN_LABELS[col]] = col;
    });

    const rankingLabelToColumn = {};
    Object.keys(RANKING_COLUMN_LABELS).forEach(col => {
        rankingLabelToColumn[RANKING_COLUMN_LABELS[col]] = col;
    });

    const tableHeaderOrder = getColumnOrderFromTable('#settlements-table');

    const sortColumnsByTableOrder = (columns, labelToColumn) => {
        const orderMap = {};
        tableHeaderOrder.forEach((label, idx) => {
            const colName = labelToColumn[label];
            if (colName) orderMap[colName] = idx;
        });

        return [...columns].sort((a, b) => {
            const idxA = orderMap[a.name] !== undefined ? orderMap[a.name] : Number.MAX_SAFE_INTEGER;
            const idxB = orderMap[b.name] !== undefined ? orderMap[b.name] : Number.MAX_SAFE_INTEGER;
            return idxA - idxB;
        });
    };

    const settlementsColumnsSorted = sortColumnsByTableOrder(settlementsColumns, settlementsLabelToColumn);
    const rankingColumnsSorted = sortColumnsByTableOrder(rankingColumns, rankingLabelToColumn);

    const existing = document.getElementById('row-data-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'row-data-modal';
    modal.className = 'res-modal-overlay';

    const content = document.createElement('div');
    content.className = 'res-modal-content';
    content.style.maxWidth = '800px';

    const nameForTitle =
        settlement['name'] ||
        settlement['NAME'] ||
        settlementId;

    const titleText = (type === 'rating')
        ? `Рейтинг НП: ${nameForTitle}`
        : `НП: ${nameForTitle}`;

    const title = document.createElement('h3');
    title.textContent = titleText;
    title.className = 'res-modal-title';

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'res-table-wrapper';
    tableWrapper.style.maxHeight = '65vh';
    tableWrapper.style.overflowY = 'auto';

    const table = document.createElement('table');
    table.className = 'res-modal-table';
    table.style.width = '100%';

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    const fieldRefs = [];

    // --- Поля НП (A_NAS_P) ---
    settlementsColumnsSorted.forEach(col => {
        if (col.name === 'OTHER_NAME') return;
        if (col.name === 'APPROX') return;

        const tr = document.createElement('tr');

        const label = SETTLEMENTS_COLUMN_LABELS[col.name] || col.name;

        const th = document.createElement('th');
        th.textContent = label;
        th.style.cssText = 'text-align: left; padding: 8px 12px; border: 1px solid #000; background: #f2f2f2; width: 40%; font-weight: 600; color: #1a1a1a;';

        const td = document.createElement('td');
        td.style.cssText = 'padding: 8px 12px; border: 1px solid #000;';

        const value = getValueByDbColumn(settlement, col.name, SETTLEMENTS_DB_TO_OBJECT_KEY);

        if (col.name === 'ID') {
            td.textContent = value !== '' ? value : '-';
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.dataset.dbColumn = col.name;
            input.dataset.tableName = 'settlements';
            input.style.cssText = `
                width: 100%;
                box-sizing: border-box;
                padding: 6px 8px;
                border: 1px solid #000;
                border-radius: 4px;
                font-size: 13px;
            `;
            td.appendChild(input);
            fieldRefs.push({
                table: 'settlements',
                dbColumn: col.name,
                input: input,
                originalValue: String(value)
            });
        }

        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
    });

    // --- Поля рейтинга (A_NAS_P_RANKING) — только если открыта таблица с рейтингами ---
    if (type === 'rating' || showRatings) {
        rankingColumnsSorted.forEach(col => {
            if (col.name === 'ID') return;

            const tr = document.createElement('tr');

            const label = RANKING_COLUMN_LABELS[col.name] || col.name;

            const th = document.createElement('th');
            th.textContent = label;
            th.style.cssText = 'text-align: left; padding: 8px 12px; border: 1px solid #000; background: #f2f2f2; width: 40%; font-weight: 600; color: #1a1a1a;';

            const td = document.createElement('td');
            td.style.cssText = 'padding: 8px 12px; border: 1px solid #000;';

            const value = getValueByDbColumn(ranking, col.name, RANKING_DB_TO_OBJECT_KEY);

            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.dataset.dbColumn = col.name;
            input.dataset.tableName = 'ranking';
            input.style.cssText = `
                width: 100%;
                box-sizing: border-box;
                padding: 6px 8px;
                border: 1px solid #000;
                border-radius: 4px;
                font-size: 13px;
            `;
            td.appendChild(input);
            fieldRefs.push({
                table: 'ranking',
                dbColumn: col.name,
                input: input,
                originalValue: String(value)
            });

            tr.appendChild(th);
            tr.appendChild(td);
            tbody.appendChild(tr);
        });
    }

    // --- Кнопки ---
    const buttonsBar = document.createElement('div');
    buttonsBar.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Сохранить изменения';
    editBtn.className = 'res-modal-close-btn';
    editBtn.style.background = '#0066ff';
    editBtn.style.color = '#fff';
    editBtn.addEventListener('click', async () => {
        await handleEditRow(fieldRefs, settlementId, modal);
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.className = 'res-modal-close-btn';
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    buttonsBar.appendChild(editBtn);
    buttonsBar.appendChild(closeBtn);

    content.appendChild(title);
    content.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    content.appendChild(buttonsBar);
    modal.appendChild(content);
    document.body.appendChild(modal);
}

async function handleEditRow(fieldRefs, settlementId, modal) {
    const changedSettlements = {};
    const changedRanking = {};

    fieldRefs.forEach(ref => {
        const currentValue = String(ref.input.value);
        const originalValue = String(ref.originalValue);

        if (currentValue !== originalValue) {
            // Пустой инпут → null, иначе строка как есть
            const newValue = currentValue === '' ? null : currentValue;

            if (ref.table === 'settlements') {
                changedSettlements[ref.dbColumn] = newValue;
            } else if (ref.table === 'ranking') {
                changedRanking[ref.dbColumn] = newValue;
            }
        }
    });

    const settlementsChangedCount = Object.keys(changedSettlements).length;
    const rankingChangedCount = Object.keys(changedRanking).length;

    if (settlementsChangedCount === 0 && rankingChangedCount === 0) {
        //renderPopup('Нет изменений для сохранения', false);
        return;
    }

    const loader = initLoader();
    loader.show('Сохранение изменений...');

    try {
        // --- Таблица НП (A_NAS_P) ---
        if (settlementsChangedCount > 0) {
            const bodySettlements = {
                updates: changedSettlements,
                where: {
                    column: 'ID',
                    operator: '=',
                    value: String(settlementId)
                }
            };
            console.log('PATCH A_NAS_P body:', bodySettlements);
            await editRow(bodySettlements, TABLE_SETTLEMENTS, EDIT_DB_NAME);

            applyLocalUpdates(settlementId, 'settlements', changedSettlements);
        }

        // --- Таблица рейтингов (A_NAS_P_RANKING) ---
        if (rankingChangedCount > 0) {
            const bodyRanking = {
                updates: changedRanking,
                where: {
                    column: 'ID',
                    operator: '=',
                    value: String(settlementId)
                }
            };
            console.log('PATCH A_NAS_P_RANKING body:', bodyRanking);
            await editRow(bodyRanking, TABLE_RANKING, EDIT_DB_NAME);

            applyLocalUpdates(settlementId, 'ranking', changedRanking);
        }

        loader.close();
        modal.remove();

        refreshCurrentView(settlementId);

        if (document.querySelector('#dialog-res')) {
            //renderPopup(document.querySelector('#dialog-res'), 'Данные успешно обновлены');
        }
    } catch (e) {
        loader.close();
        console.error('Ошибка сохранения изменений:', e);
        if (document.querySelector('#dialog-res')) {
            //renderPopup(document.querySelector('#dialog-res'), `Ошибка сохранения: ${e.message}`, true);
        }
    }
}

// ==================== ОТОБРАЖЕНИЕ ТАБЛИЦЫ (только НП) ====================

function renderSettlementsTableOnly(data, total, page, pageSize, keepFilter = false) {
    const table = document.getElementById('settlements-table');
    if (!table) {
        console.error('Таблица settlements-table не найдена');
        return;
    }

    hideChartContainer();
    isChartMode = false;

    table.style.display = 'block';

    hidePlaceholder();

    const oldSettlementsTitle = document.querySelector('.settlements-title');
    if (oldSettlementsTitle) oldSettlementsTitle.remove();

    const settlementsTitle = document.createElement('h3');
    settlementsTitle.className = 'settlements-title';
    settlementsTitle.textContent = 'Таблица населенных пунктов';
    table.parentNode.insertBefore(settlementsTitle, table);

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';

    const allData = data;
    const allTotal = total;

    let filteredData = allData;
    if (keepFilter && savedFilterField && savedFilterValue) {
        filteredData = filterData(allData, savedFilterField, savedFilterValue, savedFilterExact);
    }

    let sortedData = [...filteredData];
    if (currentSortField) {
        sortedData.sort((a, b) => {
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

    const pageData = getPageData(sortedData, page, pageSize);
    const totalPages = Math.ceil(sortedData.length / pageSize);

    if (pageData.length === 0) {
        if (tbody) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 10;
            cell.textContent = 'Нет населенных пунктов для отображения';
            cell.className = 'empty-message';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        const paginationContainer = document.getElementById('settlements-pagination');
        if (paginationContainer) {
            paginationContainer.style.display = 'flex';
        }
        renderSettlementsPagination(sortedData.length, page, totalPages, pageSize);
        return;
    }

    currentSettlementsFiltered = sortedData;
    originalDataForFilter = allData;
    originalTotalForFilter = allTotal;

    const oldFilter = document.querySelector('.filter-container');
    if (oldFilter) oldFilter.remove();

    const tableContainer = document.querySelector('.table__rating');
    if (!tableContainer) {
        console.error('Контейнер .table__rating не найден');
        return;
    }

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

    if (allData && allData.length > 0) {
        Object.keys(allData[0]).forEach(key => {
            if (labels[key]) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = labels[key] || key;
                fieldSelect.appendChild(opt);
            }
        });
    }
    fieldSelect.value = 'name';
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

            currentDisplayPage = 0;
            renderSettlementsTableOnly(allData, allTotal, 0, pageSize, true);
        }
    });

    resetBtn.addEventListener('click', () => {
        savedFilterField = '';
        savedFilterValue = '';
        savedFilterExact = false;

        currentFilterField = '';
        currentFilterValue = '';
        currentFilterExact = false;

        currentDisplayPage = 0;

        fieldSelect.value = '';
        valueInput.value = '';
        exactCheckbox.checked = false;

        renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, 0, pageSize, false);
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
                currentDisplayPage = 0;
                renderSettlementsTableOnly(allData, allTotal, 0, pageSize, true);
            });

            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
    }

    if (tbody) {
        pageData.forEach(item => {
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

                showResPageSize();
                showSettlementButtons();
            });

            tbody.appendChild(row);
        });
    }

    const paginationContainer = document.getElementById('settlements-pagination');
    if (paginationContainer) {
        paginationContainer.style.display = 'flex';
    }

    renderSettlementsPagination(sortedData.length, page, totalPages, pageSize);

    if (pageData && pageData.length > 0) {
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
            firstRow.click();
        }
    }

    showSettlementButtons();
}

// ==================== ОТОБРАЖЕНИЕ ОБЪЕДИНЁННОЙ ТАБЛИЦЫ ====================

function renderCombinedTable(data, total, page, pageSize, keepFilter = false) {
    const table = document.getElementById('settlements-table');
    if (!table) {
        console.error('Таблица settlements-table не найдена');
        return;
    }

    hideChartContainer();
    isChartMode = false;

    table.style.display = 'block';

    hidePlaceholder();

    const oldSettlementsTitle = document.querySelector('.settlements-title');
    if (oldSettlementsTitle) oldSettlementsTitle.remove();

    const settlementsTitle = document.createElement('h3');
    settlementsTitle.className = 'settlements-title';
    settlementsTitle.textContent = 'Цифровой дефицит НП';
    table.parentNode.insertBefore(settlementsTitle, table);

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';

    const allData = data;
    const allTotal = total;

    let filteredData = allData;
    if (keepFilter && savedFilterField && savedFilterValue) {
        filteredData = filterDataWithRatings(allData, allRatings, savedFilterField, savedFilterValue, savedFilterExact);
    }

    let sortedData = [...filteredData];
    if (currentSortField) {
        sortedData = sortDataWithRatings(sortedData, allRatings, currentSortField, currentSortOrder);
    }

    const pageData = getPageData(sortedData, page, pageSize);
    const totalPages = Math.ceil(sortedData.length / pageSize);

    if (pageData.length === 0) {
        if (tbody) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 58;
            cell.textContent = 'Нет населенных пунктов для отображения';
            cell.className = 'empty-message';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        const paginationContainer = document.getElementById('settlements-pagination');
        if (paginationContainer) {
            paginationContainer.style.display = 'flex';
        }
        renderSettlementsPagination(sortedData.length, page, totalPages, pageSize);
        return;
    }

    currentSettlementsFiltered = sortedData;
    originalDataForFilter = allData;
    originalTotalForFilter = allTotal;

    const oldFilter = document.querySelector('.filter-container');
    if (oldFilter) oldFilter.remove();

    const tableContainer = document.querySelector('.table__rating');
    if (!tableContainer) {
        console.error('Контейнер .table__rating не найден');
        return;
    }

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
        'rating': 'Суммарная оценка',
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
        'rating',
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

    if (allData && allData.length > 0) {
        Object.keys(allData[0]).forEach(key => {
            if (labels[key] && !ratingFieldKeys.includes(key)) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = labels[key];
                fieldSelect.appendChild(opt);
            }
        });
    }

    ratingFieldKeys.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = labels[key] || key;
        fieldSelect.appendChild(opt);
    });
    fieldSelect.value = 'name';
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

            currentDisplayPage = 0;
            renderCombinedTable(allData, allTotal, 0, pageSize, true);
        }
    });

    resetBtn.addEventListener('click', () => {
        savedFilterField = '';
        savedFilterValue = '';
        savedFilterExact = false;

        currentFilterField = '';
        currentFilterValue = '';
        currentFilterExact = false;

        currentDisplayPage = 0;

        fieldSelect.value = '';
        valueInput.value = '';
        exactCheckbox.checked = false;

        renderCombinedTable(originalDataForFilter, originalTotalForFilter, 0, pageSize, false);
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
            { key: 'rating', label: 'Суммарная оценка' },
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
                currentDisplayPage = 0;
                renderCombinedTable(allData, allTotal, 0, pageSize, true);
            });

            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
    }

    if (tbody) {
        pageData.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id;
            row.dataset.lat = item.lat;
            row.dataset.lon = item.lon;
            row.dataset.area = item.area || 1;
            row.dataset.name = item.name || '';
            row.className = 'clickable-row';

            const rating = allRatings[String(item.id)] || {};

            const cells = [
                { value: item.id },
                { value: item.name || '-' },
                { value: item.area !== null && item.area !== undefined ? item.area : '-' },
                { value: item.region_name || '-' },
                { value: item.region_code || '-' },
                { value: item.district_name || '-' },
                { value: item.lat !== undefined ? item.lat.toFixed(6) : '-' },
                { value: item.lon !== undefined ? item.lon.toFixed(6) : '-' },
                { value: item.population || 0 },
                { value: item.fias_id || '-' },
                { value: rating.rating !== undefined ? rating.rating : '-' },
                { value: rating.count_res_tv !== undefined ? rating.count_res_tv : '-' },
                { value: rating.count_res_rv !== undefined ? rating.count_res_rv : '-' },
                { value: rating.count_res_lte !== undefined ? rating.count_res_lte : '-' },
                { value: rating.count_res_gsm !== undefined ? rating.count_res_gsm : '-' },
                { value: rating.count_res_5g !== undefined ? rating.count_res_5g : '-' },
                { value: rating.count_res_wifi !== undefined ? rating.count_res_wifi : '-' },
                { value: rating.count_res_tetra !== undefined ? rating.count_res_tetra : '-' },
                { value: rating.count_operators !== undefined ? rating.count_operators : '-' },
                { value: rating.count_abonents_lte !== undefined ? rating.count_abonents_lte : '-' },
                { value: rating.population_percent_lte !== undefined ? rating.population_percent_lte : '-' },
                { value: rating.communication_coverage_lte !== undefined ? rating.communication_coverage_lte : '-' },
                { value: rating.communication_coverage_percent_lte !== undefined ? rating.communication_coverage_percent_lte : '-' },
                { value: rating.traffic_lte !== undefined ? rating.traffic_lte : '-' },
                { value: rating.traffic_percent_lte !== undefined ? rating.traffic_percent_lte : '-' },
                { value: rating.count_abonents_gsm !== undefined ? rating.count_abonents_gsm : '-' },
                { value: rating.population_percent_gsm !== undefined ? rating.population_percent_gsm : '-' },
                { value: rating.communication_coverage_gsm !== undefined ? rating.communication_coverage_gsm : '-' },
                { value: rating.communication_coverage_percent_gsm !== undefined ? rating.communication_coverage_percent_gsm : '-' },
                { value: rating.traffic_gsm !== undefined ? rating.traffic_gsm : '-' },
                { value: rating.traffic_percent_gsm !== undefined ? rating.traffic_percent_gsm : '-' },
                { value: rating.count_abonents_5g !== undefined ? rating.count_abonents_5g : '-' },
                { value: rating.population_percent_5g !== undefined ? rating.population_percent_5g : '-' },
                { value: rating.communication_coverage_5g !== undefined ? rating.communication_coverage_5g : '-' },
                { value: rating.communication_coverage_percent_5g !== undefined ? rating.communication_coverage_percent_5g : '-' },
                { value: rating.traffic_5g !== undefined ? rating.traffic_5g : '-' },
                { value: rating.traffic_percent_5g !== undefined ? rating.traffic_percent_5g : '-' },
                { value: rating.count_abonents_wifi !== undefined ? rating.count_abonents_wifi : '-' },
                { value: rating.population_percent_wifi !== undefined ? rating.population_percent_wifi : '-' },
                { value: rating.communication_coverage_wifi !== undefined ? rating.communication_coverage_wifi : '-' },
                { value: rating.communication_coverage_percent_wifi !== undefined ? rating.communication_coverage_percent_wifi : '-' },
                { value: rating.traffic_wifi !== undefined ? rating.traffic_wifi : '-' },
                { value: rating.traffic_percent_wifi !== undefined ? rating.traffic_percent_wifi : '-' },
                { value: rating.count_abonents_tetra !== undefined ? rating.count_abonents_tetra : '-' },
                { value: rating.population_percent_tetra !== undefined ? rating.population_percent_tetra : '-' },
                { value: rating.communication_coverage_tetra !== undefined ? rating.communication_coverage_tetra : '-' },
                { value: rating.communication_coverage_percent_tetra !== undefined ? rating.communication_coverage_percent_tetra : '-' },
                { value: rating.traffic_tetra !== undefined ? rating.traffic_tetra : '-' },
                { value: rating.traffic_percent_tetra !== undefined ? rating.traffic_percent_tetra : '-' },
                { value: rating.count_res_mobile !== undefined ? rating.count_res_mobile : '-' },
                { value: rating.count_abonents_mobile !== undefined ? rating.count_abonents_mobile : '-' },
                { value: rating.population_percent_mobile !== undefined ? rating.population_percent_mobile : '-' },
                { value: rating.communication_coverage_mobile !== undefined ? rating.communication_coverage_mobile : '-' },
                { value: rating.communication_coverage_percent_mobile !== undefined ? rating.communication_coverage_percent_mobile : '-' },
                { value: rating.traffic_mobile !== undefined ? rating.traffic_mobile : '-' },
                { value: rating.traffic_percent_mobile !== undefined ? rating.traffic_percent_mobile : '-' }
            ];

            cells.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell.value;
                row.appendChild(td);
            });

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

                showResPageSize();
                showSettlementButtons();
            });

            tbody.appendChild(row);
        });
    }

    const paginationContainer = document.getElementById('settlements-pagination');
    if (paginationContainer) {
        paginationContainer.style.display = 'flex';
    }

    renderSettlementsPagination(sortedData.length, page, totalPages, pageSize);

    if (pageData && pageData.length > 0) {
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
            firstRow.click();
        }
    }

    showSettlementButtons();
}

// ==================== ПАГИНАЦИЯ ====================

function renderSettlementsPagination(total, currentPage, totalPages, pageSize) {
    const container = document.getElementById('settlements-pagination');
    if (!container) {
        console.error('Контейнер пагинации не найден');
        return;
    }

    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    container.style.flexWrap = 'wrap';
    container.style.gap = '10px';
    container.style.padding = '10px 0';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'pagination-info';
    infoDiv.textContent = `Всего НП: ${total}, Страница ${currentPage + 1} из ${totalPages || 1}`;
    container.appendChild(infoDiv);

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'pagination-controls';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.alignItems = 'center';
    controlsDiv.style.gap = '6px';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.className = 'pagination-btn';
    prevBtn.disabled = currentPage === 0;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 0) {
            currentDisplayPage = currentPage - 1;
            if (savedFilterField && savedFilterValue) {
                if (showRatings) {
                    renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
                } else {
                    renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
                }
            } else {
                if (showRatings) {
                    renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
                } else {
                    renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
                }
            }
        }
    });
    controlsDiv.appendChild(prevBtn);

    const pageInput = document.createElement('input');
    pageInput.type = 'number';
    pageInput.className = 'page-input';
    pageInput.min = 1;
    pageInput.max = totalPages || 1;
    pageInput.value = currentPage + 1;
    pageInput.style.width = '40px';
    pageInput.style.textAlign = 'center';
    pageInput.addEventListener('change', function() {
        let val = parseInt(this.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > totalPages) val = totalPages || 1;
        this.value = val;
        const pageIndex = val - 1;
        if (pageIndex !== currentPage) {
            currentDisplayPage = pageIndex;
            if (savedFilterField && savedFilterValue) {
                if (showRatings) {
                    renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
                } else {
                    renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
                }
            } else {
                if (showRatings) {
                    renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
                } else {
                    renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
                }
            }
        }
    });
    controlsDiv.appendChild(pageInput);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.className = 'pagination-btn';
    nextBtn.disabled = currentPage >= totalPages - 1 || totalPages === 0;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages - 1) {
            currentDisplayPage = currentPage + 1;
            if (savedFilterField && savedFilterValue) {
                if (showRatings) {
                    renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
                } else {
                    renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
                }
            } else {
                if (showRatings) {
                    renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
                } else {
                    renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
                }
            }
        }
    });
    controlsDiv.appendChild(nextBtn);

    const pageSizeSelect = document.createElement('select');
    pageSizeSelect.className = 'page-size-select';
    pageSizeSelect.style.minWidth = '50px';
    pageSizeSelect.style.padding = '4px 8px';

    const sizes = [10, 25, 50, 100, 200, 500];
    sizes.forEach(size => {
        const opt = document.createElement('option');
        opt.value = size;
        opt.textContent = size;
        if (size === pageSize) opt.selected = true;
        pageSizeSelect.appendChild(opt);
    });

    pageSizeSelect.addEventListener('change', function() {
        const newSize = parseInt(this.value);
        settlementsData.pageSize = newSize;
        currentDisplayPage = 0;
        if (savedFilterField && savedFilterValue) {
            if (showRatings) {
                renderCombinedTable(originalDataForFilter, originalTotalForFilter, 0, newSize, true);
            } else {
                renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, 0, newSize, true);
            }
        } else {
            if (showRatings) {
                renderCombinedTable(originalDataForFilter, originalTotalForFilter, 0, newSize, false);
            } else {
                renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, 0, newSize, false);
            }
        }
    });
    controlsDiv.appendChild(pageSizeSelect);

    container.appendChild(controlsDiv);
}

// ==================== ЗАГРУЗКА РЭС ====================

async function loadResForModal(settlementId, lat, lon, area) {
    if (!settlementId || lat === undefined || lon === undefined) {
        //renderPopup('Выберите населенный пункт в таблице', true);
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
            //renderPopup('Нет РЭС для выбранного населенного пункта');
        }

        loader.close();
    } catch (error) {
        loader.close();
        //renderPopup(`Ошибка загрузки РЭС: ${error.message}`, true);
        console.error('Ошибка загрузки РЭС:', error);
    }
}

// ==================== МОДАЛКА РЭС ====================

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

    const countInfo = document.createElement('div');
    countInfo.style.cssText = `
        padding: 8px 12px;
        background: #f0f0f0;
        border-radius: 4px;
        margin-bottom: 10px;
        font-size: 14px;
        font-weight: 600;
        color: #1a1a1a;
        border: 1px solid #000;
        flex-shrink: 0;
    `;
    countInfo.textContent = `Всего РЭС: ${data.length}`;

    content.appendChild(title);
    content.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    content.appendChild(countInfo);
    content.appendChild(closeBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);

    let currentSortField = null;
    let currentSortOrder = 'asc';
    let currentData = [...data];

    function renderResTable(items) {
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!items || items.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 18;
            cell.textContent = 'Нет РЭС для отображения';
            cell.className = 'empty-message';
            cell.style.cssText = 'text-align: center; padding: 30px; font-size: 16px; color: #666; border: 1px solid #000;';
            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }

        const headerRow = document.createElement('tr');
        const headers = [
            { key: 'id', label: 'ID' },
            { key: 'type_id', label: 'Тип ID' },
            { key: 'kind_id', label: 'Вид ID' },
            { key: 'name', label: 'Название' },
            { key: 'number', label: 'Заводской номер' },
            { key: 'network_name', label: 'Сеть связи' },
            { key: 'operator', label: 'Оператор' },
            { key: 'location', label: 'Местоположение' },
            { key: 'region_id', label: 'Регион ID' },
            { key: 'lat_str', label: 'Широта' },
            { key: 'lon_str', label: 'Долгота' },
            { key: 'is_active', label: 'Признак действия' },
            { key: 'certificate_number', label: 'Номер свидетельства' },
            { key: 'certificate_start_date', label: 'Дата свидетельства' },
            { key: 'certificate_end_date', label: 'Окончание свидетельства' },
            { key: 'permission_number', label: 'Номер разрешения' },
            { key: 'permission_start_date', label: 'Дата разрешения' },
            { key: 'permission_end_date', label: 'Окончание разрешения' }
        ];

        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header.label;
            th.style.cssText = `
                min-width: 80px;
                padding: 8px 10px;
                border: 1px solid #000;
                font-weight: 700;
                color: #1a1a1a;
                background: #e8e8e8;
                font-size: 12px;
                text-align: left;
                white-space: nowrap;
                cursor: pointer;
                user-select: none;
                position: sticky;
                top: 0;
                z-index: 10;
            `;

            const sortIcon = document.createElement('span');
            sortIcon.style.cssText = 'margin-left: 5px; font-size: 10px;';
            if (currentSortField === header.key) {
                sortIcon.textContent = currentSortOrder === 'asc' ? '▲' : '▼';
            } else {
                sortIcon.textContent = '▲';
            }
            th.appendChild(sortIcon);

            th.addEventListener('click', () => {
                if (currentSortField === header.key) {
                    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortField = header.key;
                    currentSortOrder = 'asc';
                }
                sortAndRender();
            });

            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return dateStr;
                return date.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            } catch (e) {
                return dateStr || '-';
            }
        };

        const formatCoord = (coord) => {
            if (!coord) return '-';
            return coord.trim();
        };

        items.forEach(item => {
            const row = document.createElement('tr');

            const cells = [
                { value: item.id || '-' },
                { value: item.type_id || '-' },
                { value: item.kind_id || '-' },
                { value: item.name || '-' },
                { value: item.number || '-' },
                { value: item.network_name || '-' },
                { value: item.operator || '-' },
                { value: item.location || '-' },
                { value: item.region_id || '-' },
                { value: formatCoord(item.lat_str) },
                { value: formatCoord(item.lon_str) },
                { value: item.is_active || '-' },
                { value: item.certificate_number || '-' },
                { value: formatDate(item.certificate_start_date) },
                { value: formatDate(item.certificate_end_date) },
                { value: item.permission_number || '-' },
                { value: formatDate(item.permission_start_date) },
                { value: formatDate(item.permission_end_date) }
            ];

            cells.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell.value;
                td.style.cssText = `
                    padding: 6px 10px;
                    border: 1px solid #000;
                    font-size: 12px;
                    color: #2a2a2a;
                    word-break: break-word;
                    max-width: 150px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;
                if (cell.value && cell.value !== '-') {
                    td.title = cell.value;
                }
                row.appendChild(td);
            });

            const permissionEnd = item.permission_end_date;
            const certificateEnd = item.certificate_end_date;
            const now = new Date();
            let isExpired = false;
            let statusColor = '';

            if (permissionEnd) {
                try {
                    const endDate = new Date(permissionEnd);
                    if (!isNaN(endDate.getTime()) && endDate < now) {
                        isExpired = true;
                        statusColor = '#fff3f3';
                    }
                } catch (e) {}
            }

            if (certificateEnd && !isExpired) {
                try {
                    const endDate = new Date(certificateEnd);
                    if (!isNaN(endDate.getTime()) && endDate < now) {
                        statusColor = '#fff8e1';
                    }
                } catch (e) {}
            }

            if (statusColor) {
                row.style.backgroundColor = statusColor;
            }

            row.addEventListener('dblclick', () => {
                showResDetailsModal(item);
            });

            tbody.appendChild(row);
        });
    }

    function sortAndRender() {
        if (!currentSortField) {
            renderResTable(currentData);
            return;
        }

        const sorted = [...currentData].sort((a, b) => {
            let valA = a[currentSortField] || '';
            let valB = b[currentSortField] || '';

            if (currentSortField.includes('_date')) {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            }

            if (currentSortField === 'id' || currentSortField === 'kind_id' || currentSortField === 'type_id') {
                valA = parseInt(valA) || 0;
                valB = parseInt(valB) || 0;
            }

            if (typeof valA === 'string') {
                valA = valA.toLowerCase().trim();
                valB = valB.toLowerCase().trim();
            }

            if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        renderResTable(sorted);
    }

    function showResDetailsModal(item) {
        const existing = document.getElementById('res-details-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'res-details-modal';
        modal.className = 'res-modal-overlay';

        const content = document.createElement('div');
        content.className = 'res-modal-content';
        content.style.maxWidth = '600px';

        const title = document.createElement('h3');
        title.textContent = `Детальная информация о РЭС #${item.id || 'Н/Д'}`;
        title.className = 'res-modal-title';

        const details = document.createElement('div');
        details.style.cssText = `
            padding: 15px;
            background: #f8f8f8;
            border-radius: 8px;
            margin-bottom: 15px;
            max-height: 60vh;
            overflow-y: auto;
            border: 1px solid #000;
        `;

        const fields = [
            { key: 'id', label: 'ID' },
            { key: 'type_id', label: 'Тип ID' },
            { key: 'kind_id', label: 'Вид ID' },
            { key: 'name', label: 'Название' },
            { key: 'number', label: 'Заводской номер' },
            { key: 'network_name', label: 'Сеть связи' },
            { key: 'operator', label: 'Оператор' },
            { key: 'location', label: 'Местоположение' },
            { key: 'region_id', label: 'Регион ID' },
            { key: 'lat_str', label: 'Широта' },
            { key: 'lon_str', label: 'Долгота' },
            { key: 'is_active', label: 'Признак действия' },
            { key: 'certificate_number', label: 'Номер свидетельства' },
            { key: 'certificate_start_date', label: 'Дата свидетельства' },
            { key: 'certificate_end_date', label: 'Окончание свидетельства' },
            { key: 'permission_number', label: 'Номер разрешения' },
            { key: 'permission_start_date', label: 'Дата разрешения' },
            { key: 'permission_end_date', label: 'Окончание разрешения' }
        ];

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return dateStr;
                return date.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            } catch (e) {
                return dateStr || '-';
            }
        };

        fields.forEach(field => {
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex;
                padding: 8px 0;
                border-bottom: 1px solid #000;
            `;

            const label = document.createElement('div');
            label.textContent = field.label + ':';
            label.style.cssText = `
                font-weight: 600;
                color: #1a1a1a;
                min-width: 180px;
                flex-shrink: 0;
            `;

            let value = item[field.key];
            if (field.key.includes('_date')) {
                value = formatDate(value);
            } else {
                value = value || '-';
            }

            const valueEl = document.createElement('div');
            valueEl.textContent = value;
            valueEl.style.cssText = `
                color: #2a2a2a;
                word-break: break-word;
            `;

            row.appendChild(label);
            row.appendChild(valueEl);
            details.appendChild(row);
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Закрыть';
        closeBtn.className = 'res-modal-close-btn';
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        content.appendChild(title);
        content.appendChild(details);
        content.appendChild(closeBtn);
        modal.appendChild(content);
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    renderResTable(currentData);
}

// ==================== ПРОГРЕСС ====================

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
        //renderPopup('Нет населенных пунктов для получения рейтингов', true);
        return;
    }

    const bulkRatings = await loadRatingsBulk(currentRegions, currentPopRange);
    Object.keys(bulkRatings).forEach(id => {
        allRatings[id] = bulkRatings[id];
    });

    const pageSize = getPageSize('settlements');
    renderCombinedTable(settlementsData.items, settlementsData.total, currentDisplayPage, pageSize);
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
        //renderPopup('Нет населенных пунктов для расчёта', true);
        return;
    }

    const existing = await loadRatingsBulk(currentRegions, currentPopRange);
    Object.keys(existing).forEach(id => {
        allRatings[id] = existing[id];
    });

    const toCalc = settlements.filter(s => !allRatings[String(s.id)]);
    if (toCalc.length === 0) {
        //renderPopup('Рейтинги для всех НП уже загружены', false);
        const pageSize = getPageSize('settlements');
        renderCombinedTable(settlementsData.items, settlementsData.total, currentDisplayPage, pageSize);
        return;
    }

    const modal = createProgressModal(toCalc.length);
    let processed = 0;

    for (const settlement of toCalc) {
        if (isCancelled) break;
        try {
            await postRatingSett(settlement.id);
        } catch (postErr) {
            console.warn(`▶ НП ${settlement.id}: POST ошибка`, postErr);
        }
        processed++;
        updateProgress(processed, toCalc.length, 0);
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    const bulkRatings = await loadRatingsBulk(currentRegions, currentPopRange);
    Object.keys(bulkRatings).forEach(id => {
        allRatings[id] = bulkRatings[id];
    });

    const successCount = toCalc.filter(s => allRatings[String(s.id)]).length;
    closeProgressModal();

    /*renderPopup(
        isCancelled
            ? `Расчёт отменён. Обработано ${processed} из ${toCalc.length}, получено ${successCount}.`
            : `Расчёт завершён. Обработано ${processed} из ${toCalc.length}, получено ${successCount}.`,
        false
    );*/

    const pageSize = getPageSize('settlements');
    renderCombinedTable(settlementsData.items, settlementsData.total, currentDisplayPage, pageSize);
}

// ==================== ОБРАБОТЧИКИ КНОПОК ====================

async function handleRatingButton() {
    isCalculateMode = false;
    isChartMode = false;

    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;
    currentDisplayPage = 0;

    hideResPageSize();

    const regions = getSelectedRegions();
    const popRange = getPopulationRange();
    const kinds = getSelectedKinds();

    if (regions.length === 0) {
        showRegionWarning();
        return;
    }

    currentRegions = regions;
    currentPopRange = popRange;
    currentKinds = kinds;

    const pageSize = getPageSize('settlements');
    const page = getPage();
    const result = await loadSettlements(page, regions, popRange, pageSize);

    if (!result || result.items.length === 0) {
        //renderPopup('Нет населенных пунктов для выбранных фильтров', true);
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

    //createViewModeToggle();

    renderCombinedTable(originalDataForFilter, originalTotalForFilter, 0, pageSize, false);

    showSettlementButtons();

    //renderPopup(`Загружено ${settlementsData.total} населенных пунктов с рейтингами`);
}



function switchToChartMode() {
    chartType = 'provided';
    isChartMode = true;

    const chartData = settlementsData.items.map(item => {
        const rating = allRatings[String(item.id)] || {};
        return {
            id: item.id,
            name: item.name,
            region_name: item.region_name,
            district_name: item.district_name,
            population: item.population,
            rating: rating.rating || 0
        };
    });

    chartData.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    showChartContainer();
    createRatingChart(chartData, 'provided');

    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();

    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) filterContainer.remove();

    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    const paginationContainer = document.getElementById('settlements-pagination');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
        paginationContainer.innerHTML = '';
    }
}

async function handleSettlementsButton() {
    isCalculateMode = false;
    isChartMode = false;

    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;
    currentDisplayPage = 0;

    const toggle = document.getElementById('view-mode-toggle');
    if (toggle) toggle.remove();

    showResPageSize();

    const regions = getSelectedRegions();
    const popRange = getPopulationRange();
    const kinds = getSelectedKinds();

    if (regions.length === 0) {
        showRegionWarning();
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

        renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, 0, pageSize, false);

        showSettlementButtons();

        //renderPopup(`Загружено ${settlementsData.total} населенных пунктов`);
    }
}

async function handleResButton() {
    if (!selectedSettlementId) {
        //renderPopup('Выберите населенный пункт в таблице', true);
        return;
    }
    await loadResForModal(selectedSettlementId, selectedSettlementLat, selectedSettlementLon, selectedSettlementArea);
}



// ==================== ОЧИСТКА ====================

function handleClear() {
    const form = document.querySelector('.form__rating');
    if (form) {
        form.reset();
        const regionSelect = document.getElementById('region');
        if (regionSelect) {
            const options = regionSelect.querySelectorAll('option');
            options.forEach(opt => opt.selected = false);
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
    isChartMode = false;

    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();

    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;
    currentFilterField = '';
    currentFilterValue = '';
    currentFilterExact = false;

    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) filterContainer.remove();

    const toggle = document.getElementById('view-mode-toggle');
    if (toggle) toggle.remove();

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

    const paginationContainer = document.getElementById('settlements-pagination');
    if (paginationContainer) paginationContainer.innerHTML = '';

    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    hideChartContainer();
    chartAllData = [];
    chartCurrentData = [];
    chartDisplayData = [];

    settlementsData = { items: [], total: 0, page: 0, pageSize: 100, allItems: [] };
    selectedSettlementId = null;
    selectedSettlementLat = null;
    selectedSettlementLon = null;
    selectedSettlementArea = null;
    selectedSettlementName = null;
    currentSortField = null;
    currentSortOrder = 'asc';
    currentSettlementsFiltered = [];
    isCancelled = false;
    allRatings = {};
    showRatings = false;
    currentDisplayPage = 0;
    chartSearchQuery = '';
    searchResults = [];
    selectedSearchItem = null;
    selectedSearchIndex = -1;

    settlementsColumnsCache = null;
    rankingColumnsCache = null;

    const tooltip = document.getElementById('chart-item-tooltip');
    if (tooltip) tooltip.remove();

    showPlaceholder();

    //renderPopup('Фильтры сброшены к значениям по умолчанию');
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

    document.getElementById('btn-rating-chart').addEventListener('click', handleRatingChartButton);
    document.getElementById('btn-rating-table').addEventListener('click', handleRatingTableButton);
    document.getElementById('btn-settlements').addEventListener('click', handleSettlementsButton);

    const btnNormConsumption = document.getElementById('btn-norm-consumption');
    if (btnNormConsumption) btnNormConsumption.remove();

    const clearBtn = document.getElementById('clear-btn');
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

    const urlParams = new URLSearchParams(window.location.search);
    const regionsParam = urlParams.get('regions');
    if (regionsParam) {
        setTimeout(async () => {
            const selectedCount = document.getElementById('region').selectedOptions.length;
            if (selectedCount > 0) {
                await handleRatingChartButton();
            }
        }, 500);
    }
});