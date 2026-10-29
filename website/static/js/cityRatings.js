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
function showRegionWarning() {
    let popupElement = document.getElementById('dialog-res');

    if (!popupElement) {
        popupElement = document.createElement('dialog');
        popupElement.id = 'dialog-res';
        document.body.appendChild(popupElement);
    }

    if (popupElement._regionWarningTimer) {
        clearTimeout(popupElement._regionWarningTimer);
        popupElement._regionWarningTimer = null;
    }

    if (popupElement.open) {
        try { popupElement.close(); } catch (e) {}
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
        try { popupElement.close(); } catch (e) {}
        popupElement._regionWarningTimer = null;
    }, 3000);
}

const TABLE_SETTLEMENTS = 'A_NAS_P';
const TABLE_RANKING = 'A_NAS_P_RANKING ';
const EDIT_DB_NAME = 'IO';
let currentChartFormat = 'full'; // 'full' | 'short'

let settlementsColumnsCache = null;
let rankingColumnsCache = null;

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

let ratingPlacesMap = new Map();
let ratingPlacesTotal = 0;

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

const RANKING_DB_TO_OBJECT_KEY = {
    'ID': 'id',

    // ТВ
    'TV_KOL_RES': 'count_res_tv',
    'TV_PROC_RES': 'percent_res_tv',
    'TV_KOL_CHANNELS': 'count_channels_tv',
    'TV_POKRITIE': 'communication_coverage_tv',
    'TV_PROC_POKRITIE': 'communication_coverage_percent_tv',
    'TV_KOL_OPERATOR': 'count_operators_tv',
    'TV_PROC_OPERATOR': 'operators_percent_tv',
    'TV_SCORE': 'rating_tv',

    // РВ
    'RV_KOL_RES': 'count_res_rv',
    'RV_PROC_RES': 'percent_res_rv',
    'RV_WIDTH': 'frequency_width_rv',
    'RV_KOL_CHANNELS': 'count_channels_rv',
    'RV_POKRITIE': 'communication_coverage_rv',
    'RV_PROC_POKRITIE': 'communication_coverage_percent_rv',
    'RV_KOL_OPERATOR': 'count_operators_rv',
    'RV_PROC_OPERATOR': 'operators_percent_rv',
    'RV_SCORE': 'rating_rv',

    // LTE
    'LTE_KOL_RES': 'count_res_lte',
    'LTE_KOL_AB': 'count_abonents_lte',
    'LTE_PROC_NAS': 'population_percent_lte',
    'LTE_POKRITIE': 'communication_coverage_lte',
    'LTE_PROC_POKRITIE': 'communication_coverage_percent_lte',
    'LTE_TRAFIK': 'traffic_lte',
    'LTE_PROC_TRAFIK': 'traffic_percent_lte',
    'LTE_KOL_OPERATOR': 'count_operators_lte',
    'LTE_SCORE': 'rating_lte',

    // GSM
    'GSM_KOL_RES': 'count_res_gsm',
    'GSM_KOL_AB': 'count_abonents_gsm',
    'GSM_PROC_NAS': 'population_percent_gsm',
    'GSM_POKRITIE': 'communication_coverage_gsm',
    'GSM_PROC_POKRITIE': 'communication_coverage_percent_gsm',
    'GSM_TRAFIK': 'traffic_gsm',
    'GSM_PROC_TRAFIK': 'traffic_percent_gsm',
    'GSM_KOL_OPERATOR': 'count_operators_gsm',
    'GSM_SCORE': 'rating_gsm',

    // 5G
    'G5_KOL_RES': 'count_res_5g',
    'G5_KOL_AB': 'count_abonents_5g',
    'G5_PROC_NAS': 'population_percent_5g',
    'G5_POKRITIE': 'communication_coverage_5g',
    'G5_PROC_POKRITIE': 'communication_coverage_percent_5g',
    'G5_TRAFIK': 'traffic_5g',
    'G5_PROC_TRAFIK': 'traffic_percent_5g',
    'G5_KOL_OPERATOR': 'count_operators_5g',
    'G5_SCORE': 'rating_5g',

    // Wi-Fi
    'WIFI_KOL_RES': 'count_res_wifi',
    'WIFI_KOL_AB': 'count_abonents_wifi',
    'WIFI_PROC_NAS': 'population_percent_wifi',
    'WIFI_POKRITIE': 'communication_coverage_wifi',
    'WIFI_PROC_POKRITIE': 'communication_coverage_percent_wifi',
    'WIFI_TRAFIK': 'traffic_wifi',
    'WIFI_PROC_TRAFIK': 'traffic_percent_wifi',
    'WIFI_KOL_OPERATOR': 'count_operators_wifi',
    'WIFI_PROC_OPERATOR': 'operators_percent_wifi',
    'WIFI_SCORE': 'rating_wifi',

    // Tetra
    'TETRA_KOL_RES': 'count_res_tetra',
    'TETRA_KOL_AB': 'count_abonents_tetra',
    'TETRA_PROC_NAS': 'population_percent_tetra',
    'TETRA_POKRITIE': 'communication_coverage_tetra',
    'TETRA_PROC_POKRITIE': 'communication_coverage_percent_tetra',
    'TETRA_TRAFIK': 'traffic_tetra',
    'TETRA_PROC_TRAFIK': 'traffic_percent_tetra',
    'TETRA_KOL_OPERATOR': 'count_operators_tetra',
    'TETRA_SCORE': 'rating_tetra',

    // УС
    'US_KOL_US': 'count_comm_hubs',
    'US_KOL_AB': 'count_abonents_comm_hubs',
    'US_PROC_NAS': 'population_percent_comm_hubs',
    'US_POKRITIE': 'communication_coverage_comm_hubs',
    'US_PROC_POKRITIE': 'communication_coverage_percent_comm_hubs',
    'US_TRAFIK': 'traffic_comm_hubs',
    'US_PROC_TRAFIK': 'traffic_percent_comm_hubs',
    'US_KOL_OPERATOR': 'count_operators_comm_hubs',
    'US_PROC_OPERATOR': 'operators_percent_comm_hubs',
    'US_SCORE': 'rating_comm_hubs',

    // Почта
    'POST_KOL_POST': 'count_posts',
    'POST_KOL_AB': 'count_abonents_posts',
    'POST_PROC_NAS': 'population_percent_posts',
    'POST_POKRITIE': 'communication_coverage_posts',
    'POST_PROC_POKRITIE': 'communication_coverage_percent_posts',
    'POST_TRAFIK': 'traffic_posts',
    'POST_PROC_TRAFIK': 'traffic_percent_posts',
    'POST_KOL_OPERATOR': 'count_operators_posts',
    'POST_PROC_OPERATOR': 'operators_percent_posts',
    'POST_SCORE': 'rating_posts',

    // ВОЛС
    'VOLS_KOL_VOLS': 'count_focl',
    'VOLS_KOL_AB': 'count_abonents_focl',
    'VOLS_PROC_NAS': 'population_percent_focl',
    'VOLS_POKRITIE': 'communication_coverage_focl',
    'VOLS_PROC_POKRITIE': 'communication_coverage_percent_focl',
    'VOLS_TRAFIK': 'traffic_focl',
    'VOLS_PROC_TRAFIK': 'traffic_percent_focl',
    'VOLS_KOL_OPERATOR': 'count_operators_focl',
    'VOLS_PROC_OPERATOR': 'operators_percent_focl',
    'VOLS_SCORE': 'rating_focl',

    // Таксофоны
    'TAKS_KOL_TAKS': 'count_payphones',
    'TAKS_KOL_AB': 'count_abonents_payphones',
    'TAKS_PROC_NAS': 'population_percent_payphones',
    'TAKS_POKRITIE': 'communication_coverage_payphones',
    'TAKS_PROC_POKRITIE': 'communication_coverage_percent_payphones',
    'TAKS_TRAFIK': 'traffic_payphones',
    'TAKS_PROC_TRAFIK': 'traffic_percent_payphones',
    'TAKS_KOL_OPERATOR': 'count_operators_payphones',
    'TAKS_PROC_OPERATOR': 'operators_percent_payphones',
    'TAKS_SCORE': 'rating_payphones',

    // КА (спутниковая связь)
    'KA_KOL_KA': 'count_satellites',
    'KA_KOL_AB': 'count_abonents_satellites',
    'KA_PROC_NAS': 'population_percent_satellites',
    'KA_POKRITIE': 'communication_coverage_satellites',
    'KA_PROC_POKRITIE': 'communication_coverage_percent_satellites',
    'KA_TRAFIK': 'traffic_satellites',
    'KA_PROC_TRAFIK': 'traffic_percent_satellites',
    'KA_KOL_OPERATOR': 'count_operators_satellites',
    'KA_PROC_OPERATOR': 'operators_percent_satellites',
    'KA_SCORE': 'rating_satellites',

    // Мобильная связь
    'MOB_KOL_RES': 'count_res_mobile',
    'MOB_KOL_AB': 'count_abonents_mobile',
    'MOB_PROC_NAS': 'population_percent_mobile',
    'MOB_POKRITIE': 'communication_coverage_mobile',
    'MOB_PROC_POKRITIE': 'communication_coverage_percent_mobile',
    'MOB_TRAFIK': 'traffic_mobile',
    'MOB_PROC_TRAFIK': 'traffic_percent_mobile',
    'MOB_KOL_OPERATOR': 'count_operators_mobile',
    'MOB_PROC_OPERATOR': 'operators_percent_mobile',
    'MOB_SCORE': 'rating_mobile',

    // Суммарные
    // 'RAT_NP_KOL_AB': 'count_abonents_summary',
    // 'RAT_NP_PROC_NAS': 'population_percent_summary',
    // 'RAT_NP_POKRITIE': 'communication_coverage_summary',
    // 'RAT_NP_PROC_POKRITIE': 'communication_coverage_percent_summary',
    // 'RAT_NP_TRAFIK': 'traffic_summary',
    // 'RAT_NP_PROC_TRAFIK': 'traffic_percent_summary',
    // 'RAT_NP_PROC_OPERATOR': 'operators_percent_summary',

    'RAT_SUM_NP': 'rating'
};

const RANKING_COLUMN_LABELS = {
    'ID': 'ID',

    // ТВ
    'TV_KOL_RES': 'Количество БС ТВ',
    'TV_PROC_RES': 'Процент БС ТВ',
    'TV_KOL_CHANNELS': 'Количество каналов ТВ',
    'TV_POKRITIE': 'Покрытие связи ТВ',
    'TV_PROC_POKRITIE': 'Процент покрытия связи ТВ',
    'TV_KOL_OPERATOR': 'Количество операторов ТВ',
    'TV_PROC_OPERATOR': 'Процент операторов ТВ',
    'TV_SCORE': 'Оценка ТВ',

    // РВ
    'RV_KOL_RES': 'Количество БС РВ',
    'RV_PROC_RES': 'Процент БС РВ',
    'RV_WIDTH': 'Общая ширина полосы РВ, МГц',
    'RV_KOL_CHANNELS': 'Количество каналов РВ',
    'RV_POKRITIE': 'Покрытие связи РВ',
    'RV_PROC_POKRITIE': 'Процент покрытия связи РВ',
    'RV_KOL_OPERATOR': 'Количество операторов РВ',
    'RV_PROC_OPERATOR': 'Процент операторов РВ',
    'RV_SCORE': 'Оценка РВ',

    // LTE
    'LTE_KOL_RES': 'Количество БС LTE',
    'LTE_KOL_AB': 'Количество абонентов LTE',
    'LTE_PROC_NAS': 'Процент охвата населения LTE',
    'LTE_POKRITIE': 'Покрытие связи LTE',
    'LTE_PROC_POKRITIE': 'Процент покрытия связи LTE',
    'LTE_TRAFIK': 'Объем трафика LTE',
    'LTE_PROC_TRAFIK': 'Процент трафика LTE',
    'LTE_KOL_OPERATOR': 'Количество операторов LTE',
    'LTE_SCORE': 'Оценка LTE',

    // GSM
    'GSM_KOL_RES': 'Количество БС GSM',
    'GSM_KOL_AB': 'Количество абонентов GSM',
    'GSM_PROC_NAS': 'Процент охвата населения GSM',
    'GSM_POKRITIE': 'Покрытие связи GSM',
    'GSM_PROC_POKRITIE': 'Процент покрытия связи GSM',
    'GSM_TRAFIK': 'Объем трафика GSM',
    'GSM_PROC_TRAFIK': 'Процент трафика GSM',
    'GSM_KOL_OPERATOR': 'Количество операторов GSM',
    'GSM_SCORE': 'Оценка GSM',

    // 5G
    'G5_KOL_RES': 'Количество БС 5G',
    'G5_KOL_AB': 'Количество абонентов 5G',
    'G5_PROC_NAS': 'Процент охвата населения 5G',
    'G5_POKRITIE': 'Покрытие связи 5G',
    'G5_PROC_POKRITIE': 'Процент покрытия связи 5G',
    'G5_TRAFIK': 'Объем трафика 5G',
    'G5_PROC_TRAFIK': 'Процент трафика 5G',
    'G5_KOL_OPERATOR': 'Количество операторов 5G',
    'G5_SCORE': 'Оценка 5G',

    // Wi-Fi
    'WIFI_KOL_RES': 'Количество БС Wi-Fi',
    'WIFI_KOL_AB': 'Количество абонентов Wi-Fi',
    'WIFI_PROC_NAS': 'Процент охвата населения Wi-Fi',
    'WIFI_POKRITIE': 'Покрытие связи Wi-Fi',
    'WIFI_PROC_POKRITIE': 'Процент покрытия связи Wi-Fi',
    'WIFI_TRAFIK': 'Объем трафика Wi-Fi',
    'WIFI_PROC_TRAFIK': 'Процент трафика Wi-Fi',
    'WIFI_KOL_OPERATOR': 'Количество операторов Wi-Fi',
    'WIFI_PROC_OPERATOR': 'Процент операторов Wi-Fi',
    'WIFI_SCORE': 'Оценка Wi-Fi',

    // Tetra
    'TETRA_KOL_RES': 'Количество БС Tetra',
    'TETRA_KOL_AB': 'Количество абонентов Tetra',
    'TETRA_PROC_NAS': 'Процент охвата населения Tetra',
    'TETRA_POKRITIE': 'Покрытие связи Tetra',
    'TETRA_PROC_POKRITIE': 'Процент покрытия связи Tetra',
    'TETRA_TRAFIK': 'Объем трафика Tetra',
    'TETRA_PROC_TRAFIK': 'Процент трафика Tetra',
    'TETRA_KOL_OPERATOR': 'Количество операторов Tetra',
    'TETRA_SCORE': 'Оценка Tetra',

    // УС
    'US_KOL_US': 'Количество узлов связи',
    'US_KOL_AB': 'Количество абонентов узлов связи',
    'US_PROC_NAS': 'Процент охвата населения узлов связи',
    'US_POKRITIE': 'Покрытие узлов связи',
    'US_PROC_POKRITIE': 'Процент покрытия узлов связи',
    'US_TRAFIK': 'Объем трафика узлов связи',
    'US_PROC_TRAFIK': 'Процент трафика узлов связи',
    'US_KOL_OPERATOR': 'Количество операторов узлов связи',
    'US_PROC_OPERATOR': 'Процент операторов узлов связи',
    'US_SCORE': 'Оценка узлов связи',

    // Почта
    'POST_KOL_POST': 'Количество почтовых отделений',
    'POST_KOL_AB': 'Количество абонентов почтовых отделений',
    'POST_PROC_NAS': 'Процент охвата населения почтовых отделений',
    'POST_POKRITIE': 'Покрытие почтовых отделений',
    'POST_PROC_POKRITIE': 'Процент покрытия почтовых отделений',
    'POST_TRAFIK': 'Объем трафика почтовых отделений',
    'POST_PROC_TRAFIK': 'Процент трафика почтовых отделений',
    'POST_KOL_OPERATOR': 'Количество операторов почтовых отделений',
    'POST_PROC_OPERATOR': 'Процент операторов почтовых отделений',
    'POST_SCORE': 'Оценка почтовых отделений',

    // ВОЛС
    'VOLS_KOL_VOLS': 'Количество ВОЛС',
    'VOLS_KOL_AB': 'Количество абонентов ВОЛС',
    'VOLS_PROC_NAS': 'Процент охвата населения ВОЛС',
    'VOLS_POKRITIE': 'Покрытие ВОЛС',
    'VOLS_PROC_POKRITIE': 'Процент покрытия ВОЛС',
    'VOLS_TRAFIK': 'Объем трафика ВОЛС',
    'VOLS_PROC_TRAFIK': 'Процент трафика ВОЛС',
    'VOLS_KOL_OPERATOR': 'Количество операторов ВОЛС',
    'VOLS_PROC_OPERATOR': 'Процент операторов ВОЛС',
    'VOLS_SCORE': 'Оценка ВОЛС',

    // Таксофоны
    'TAKS_KOL_TAKS': 'Количество таксофонов',
    'TAKS_KOL_AB': 'Количество абонентов таксофонов',
    'TAKS_PROC_NAS': 'Процент охвата населения таксофонами',
    'TAKS_POKRITIE': 'Покрытие таксофонов',
    'TAKS_PROC_POKRITIE': 'Процент покрытия таксофонов',
    'TAKS_TRAFIK': 'Объем трафика таксофонов',
    'TAKS_PROC_TRAFIK': 'Процент трафика таксофонов',
    'TAKS_KOL_OPERATOR': 'Количество операторов таксофонов',
    'TAKS_PROC_OPERATOR': 'Процент операторов таксофонов',
    'TAKS_SCORE': 'Оценка таксофонов',

    // КА (спутниковая связь)
    'KA_KOL_KA': 'Количество КА',
    'KA_KOL_AB': 'Количество абонентов КА',
    'KA_PROC_NAS': 'Процент охвата населения КА',
    'KA_POKRITIE': 'Покрытие КА',
    'KA_PROC_POKRITIE': 'Процент покрытия КА',
    'KA_TRAFIK': 'Объем трафика КА',
    'KA_PROC_TRAFIK': 'Процент трафика КА',
    'KA_KOL_OPERATOR': 'Количество операторов КА',
    'KA_PROC_OPERATOR': 'Процент операторов КА',
    'KA_SCORE': 'Оценка КА',

    // Мобильная связь
    'MOB_KOL_RES': 'Количество БС моб. связи',
    'MOB_KOL_AB': 'Количество абонентов моб. связи',
    'MOB_PROC_NAS': 'Процент охвата населения моб. связи',
    'MOB_POKRITIE': 'Покрытие моб. связи',
    'MOB_PROC_POKRITIE': 'Процент покрытия моб. связи',
    'MOB_TRAFIK': 'Объем трафика моб. связи',
    'MOB_PROC_TRAFIK': 'Процент трафика моб. связи',
    'MOB_KOL_OPERATOR': 'Количество операторов моб. связи',
    'MOB_PROC_OPERATOR': 'Процент операторов моб. связи',
    'MOB_SCORE': 'Оценка моб. связи',

    // Суммарные
    // 'RAT_NP_KOL_AB': 'Общее количество абонентов',
    // 'RAT_NP_PROC_NAS': 'Общий процент охвата населения',
    // 'RAT_NP_POKRITIE': 'Общее покрытие',
    // 'RAT_NP_PROC_POKRITIE': 'Общий процент покрытия',
    // 'RAT_NP_TRAFIK': 'Общий объем трафика',
    // 'RAT_NP_PROC_TRAFIK': 'Общий процент трафика',
    // 'RAT_NP_PROC_OPERATOR': 'Общий процент операторов',

    'RAT_SUM_NP': 'Обеспеченность'
};
// ==================== LOCALSTORAGE: СОХРАНЕНИЕ ПАРАМЕТРОВ ====================
const LS_KEYS = {
    regions: 'rating:regions',
    idNp:    'rating:id_np'
};

const DEFAULT_REGION = '29';
const DEFAULT_ID_NP  = '11665729';

function lsGet(key, fallback = null) {
    try {
        const v = localStorage.getItem(key);
        return v !== null ? v : fallback;
    } catch (e) {
        return fallback;
    }
}

function lsSet(key, value) {
    try {
        localStorage.setItem(key, String(value));
    } catch (e) { /* ignore */ }
}

function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
}

// Сохранить текущий выбор регионов в localStorage
function persistSelectedRegions() {
    const regions = getSelectedRegions();
    if (regions && regions.length > 0) {
        lsSet(LS_KEYS.regions, regions.join(','));
    } else {
        lsSet(LS_KEYS.regions, DEFAULT_REGION);
    }
}

// Сохранить выбранный НП в localStorage
function persistSelectedIdNp(id) {
    if (id !== undefined && id !== null && String(id).trim() !== '') {
        lsSet(LS_KEYS.idNp, String(id).trim());
    } else {
        lsSet(LS_KEYS.idNp, DEFAULT_ID_NP);
    }
}

// Применить регионы из localStorage к <select id="region">
function applyRegionsFromStorage() {
    const regionSelect = document.getElementById('region');
    if (!regionSelect) return false;

    // Если в select ещё нет реальных регионов (только 'all') — выходим
    const realOptions = Array.from(regionSelect.querySelectorAll('option'))
        .filter(opt => opt.value !== 'all' && String(opt.value).trim() !== '');
    if (realOptions.length === 0) return false;

    const stored = lsGet(LS_KEYS.regions, DEFAULT_REGION);
    if (!stored) return false;

    const ids = String(stored).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) ids.push(DEFAULT_REGION);

    const options = regionSelect.querySelectorAll('option');
    options.forEach(opt => { opt.selected = false; });

    let found = 0;
    options.forEach(opt => {
        if (opt.value === 'all') return;
        if (ids.includes(String(opt.value).trim())) {
            opt.selected = true;
            found++;
        }
    });

    // Fallback на дефолтный регион 29
    if (found === 0) {
        options.forEach(opt => {
            if (String(opt.value).trim() === DEFAULT_REGION) {
                opt.selected = true;
                found++;
            }
        });
    }

    // НЕ выбираем 'all' при неудаче — пусть будет пусто
    return found > 0;
}
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

// Для блока «Выбранный НП»
let selectedSettlementMode = null;       // 'chart' | 'table' | 'rating' | null
let selectedSettlementForInfo = null;    // объект { id, name, ... } для модалки

let selectedSettlementId = null;
let selectedSettlementLat = null;
let selectedSettlementLon = null;
let selectedSettlementArea = null;
let selectedSettlementName = null;

let currentRegions = [];
let currentKinds = [];
let currentPopRange = null;

let isCancelled = false;
let isCalculateMode = false;

let allRatings = {};

let currentSortField = null;
let currentSortOrder = 'asc';
let currentSettlementsFiltered = [];

let currentFilterField = '';
let currentFilterValue = '';
let currentFilterExact = false;

let selectedSettlementHighlighted = false;

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
let analyticsChart = null;
let isAnalyticsMode = false;

let analyticsBarServices = null;
let analyticsBarMobile = null;

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
    p.style.color = isError ? 'red' : 'green';
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
// ==================== БЛОК "ВЫБРАННЫЙ НП" ====================

function showSelectedSettlementBlock() {
    const el = document.getElementById('selected-settlement-block');
    if (el) el.style.display = 'flex';

    const hlBtn = document.getElementById('ss-btn-highlight');
    if (!hlBtn) return;

    const mode = isAnalyticsMode
        ? 'analytics'
        : (isChartMode ? 'chart' : 'table');

    if (mode === 'analytics') {
        hlBtn.disabled = true;
        hlBtn.title = 'Недоступно в режиме диаграммы';
        return;
    }

    if (!selectedSettlementId) {
        hlBtn.disabled = true;
        hlBtn.title = 'Выберите НП';
        return;
    }

    if (mode === 'chart') {
        hlBtn.disabled = false;
        hlBtn.title = 'Отобразить на графике';
        return;
    }

    // mode === 'table'
    hlBtn.disabled = false;
    hlBtn.title = 'Перейти к НП в таблице';
}

function hideSelectedSettlementBlock() {
    const el = document.getElementById('selected-settlement-block');
    if (el) el.style.display = 'none';
}

function setSelectedSettlement(item, mode) {
    if (!item || item.id === undefined || item.id === null) {
        clearSelectedSettlement();
        return;
    }

    persistSelectedIdNp(item.id);

    const newIdStr = String(item.id);

    document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
        if (String(tr.dataset.id) !== newIdStr) {
            tr.classList.remove('selected');
        }
    });

    if (ratingChart) {
        const displayData = getChartDisplayData();
        if (displayData && displayData.length > 0) {
            const ds0 = ratingChart.data.datasets[0];
            const ds1 = ratingChart.data.datasets[1];
            ds0.backgroundColor = displayData.map(() => '#1a73e8');
            ds0.borderColor     = displayData.map(() => '#1a73e8');
            ds0.borderWidth     = displayData.map(() => 0);
            if (ds1) {
                ds1.backgroundColor = displayData.map(() => '#ff6a00');
                ds1.borderColor     = displayData.map(() => '#ff6a00');
                ds1.borderWidth     = displayData.map(() => 0);
            }
            ratingChart.update('none');
        }
    }

    const oldTooltip = document.getElementById('chart-item-tooltip');
    if (oldTooltip) oldTooltip.remove();

    selectedSearchItem = null;
    selectedSearchIndex = -1;

    selectedSettlementForInfo = item;
    selectedSettlementId = newIdStr;
    selectedSettlementName = item.name || item.NAME || `ID: ${item.id}`;
    selectedSettlementMode = mode;

    selectedSettlementHighlighted = true;

    const nameEl = document.getElementById('selected-settlement-name');
    if (nameEl) {
        nameEl.textContent = selectedSettlementName;
        nameEl.title = selectedSettlementName;
    }

    // Делегируем установку disabled/title по текущему режиму
    showSelectedSettlementBlock();
}
function resetAndHideSelectedSettlement() {
    // Сбрасываем данные
    selectedSettlementForInfo = null;
    selectedSettlementId = null;
    selectedSettlementName = null;
    selectedSettlementMode = null;
    selectedSettlementHighlighted = false;

    const nameEl = document.getElementById('selected-settlement-name');
    if (nameEl) {
        nameEl.textContent = '—';
        nameEl.title = '';
    }

    // Снимаем выделение в таблицах
    document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
        tr.classList.remove('selected');
    });

    // Снимаем выделение на графике
    if (ratingChart) {
        const displayData = getChartDisplayData();
        if (displayData && displayData.length > 0) {
            const ds0 = ratingChart.data.datasets[0];
            const ds1 = ratingChart.data.datasets[1];
            ds0.backgroundColor = displayData.map(() => '#1a73e8');
            ds0.borderColor     = displayData.map(() => '#1a73e8');
            ds0.borderWidth     = displayData.map(() => 0);
            if (ds1) {
                ds1.backgroundColor = displayData.map(() => '#ff6a00');
                ds1.borderColor     = displayData.map(() => '#ff6a00');
                ds1.borderWidth     = displayData.map(() => 0);
            }
            ratingChart.update('none');
        }
    }

    selectedSearchItem = null;
    selectedSearchIndex = -1;

    const tooltip = document.getElementById('chart-item-tooltip');
    if (tooltip) tooltip.remove();

    // Скрываем блок
    hideSelectedSettlementBlock();
}
function clearSelectedSettlement() {
    selectedSettlementForInfo = null;
    selectedSettlementId = null;
    selectedSettlementName = null;
    selectedSettlementMode = null;
    selectedSettlementHighlighted = false;

    const nameEl = document.getElementById('selected-settlement-name');
    if (nameEl) {
        nameEl.textContent = '—';
        nameEl.title = '';
    }

    document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
        tr.classList.remove('selected');
    });

    if (ratingChart) {
        const displayData = getChartDisplayData();
        if (displayData && displayData.length > 0) {
            const ds0 = ratingChart.data.datasets[0];
            const ds1 = ratingChart.data.datasets[1];

            ds0.backgroundColor = displayData.map(() => '#1a73e8');
            ds0.borderColor     = displayData.map(() => '#1a73e8');
            ds0.borderWidth     = displayData.map(() => 0);

            if (ds1) {
                ds1.backgroundColor = displayData.map(() => '#ff6a00');
                ds1.borderColor     = displayData.map(() => '#ff6a00');
                ds1.borderWidth     = displayData.map(() => 0);
            }
            ratingChart.update('none');
        }
    }

    selectedSearchItem = null;
    selectedSearchIndex = -1;

    const tooltip = document.getElementById('chart-item-tooltip');
    if (tooltip) tooltip.remove();

    const hlBtn = document.getElementById('ss-btn-highlight');
    if (hlBtn) hlBtn.disabled = true;
}

function onTableRowSelected(row) {
    if (!row) return;

    const id = row.dataset.id;
    if (!id) return;

    let item = settlementsData.items.find(it => String(it.id) === String(id));

    if (!item) {
        item = {
            id: id,
            name: row.dataset.name || `ID: ${id}`,
            lat: row.dataset.lat,
            lon: row.dataset.lon,
            area: row.dataset.area
        };
    }

    let mode = 'table';
    if (isChartMode) mode = 'chart';
    else if (showRatings) mode = 'rating';

    setSelectedSettlement(item, mode);
}


function handleSelectedHighlight() {
    if (!selectedSettlementId) return;

    // ===== РЕЖИМ ГРАФИКА — подсветка на графике =====
    if (isChartMode && ratingChart) {
        const displayData = getChartDisplayData();
        if (!displayData || displayData.length === 0) return;

        let foundIndex = -1;
        let foundItem = null;
        for (let i = 0; i < displayData.length; i++) {
            const d = displayData[i];
            if (String(d.id) === String(selectedSettlementId)) {
                foundIndex = i;
                foundItem = d;
                break;
            }
        }

        if (foundIndex === -1) {
            renderPopup('НП не найден среди отображаемых на графике');
            return;
        }

        const totalLen = currentDisplayDataLength || displayData.length;
        const currentMin = ratingChart.options.scales.x.min || 0;
        const currentMax = ratingChart.options.scales.x.max || totalLen;
        const visibleCount = currentMax - currentMin;

        if (foundIndex < currentMin || foundIndex >= currentMin + visibleCount) {
            const newMin = Math.max(0, foundIndex - Math.floor(visibleCount / 2));
            const newMax = Math.min(totalLen, newMin + visibleCount);
            ratingChart.options.scales.x.min = newMin;
            ratingChart.options.scales.x.max = newMax;
        }

        selectedSearchItem = foundItem;
        selectedSearchIndex = foundIndex;
        selectedSettlementHighlighted = true;

        const ds0 = ratingChart.data.datasets[0];
        const ds1 = ratingChart.data.datasets[1];

        const isSel = (d) => String(d.id) === String(selectedSettlementId);

        ds0.backgroundColor = displayData.map(d => isSel(d) ? '#ff0000' : '#1a73e8');
        ds0.borderColor     = displayData.map(d => isSel(d) ? '#ff0000' : '#1a73e8');
        ds0.borderWidth     = displayData.map(d => isSel(d) ? 3 : 0);

        if (ds1) {
            ds1.backgroundColor = displayData.map(d => isSel(d) ? '#cc0000' : '#ff6a00');
            ds1.borderColor     = displayData.map(d => isSel(d) ? '#cc0000' : '#ff6a00');
            ds1.borderWidth     = displayData.map(d => isSel(d) ? 3 : 0);
        }

        ratingChart.update();

        requestAnimationFrame(() => {
            const dd = getChartDisplayData();
            let idx = -1;
            for (let i = 0; i < dd.length; i++) {
                if (String(dd[i].id) === String(selectedSettlementId)) { idx = i; break; }
            }
            if (idx !== -1) {
                selectedSearchIndex = idx;
                showItemTooltip(dd[idx], idx);
            }
        });
        return;
    }

    // ===== РЕЖИМ ТАБЛИЦЫ — переход к строке НП =====
    jumpToSettlementInTable(String(selectedSettlementId));
}

function handleSelectedInfo() {
    if (!selectedSettlementId) return;

    const mode = selectedSettlementMode || (isChartMode ? 'chart' : 'table');

    if (mode === 'chart') {
        const item = settlementsData.items.find(
            it => String(it.id) === String(selectedSettlementId)
        ) || selectedSettlementForInfo;

        if (item) {
            openSettlementInfoModal(item);
        } else {
            renderPopup('Нет данных о выбранном НП');
        }
        return;
    }

    const type = showRatings ? 'rating' : 'settlement';
    const tableMode = showRatings ? 'rating' : 'settlements';
    openEditModal(selectedSettlementId, type, tableMode);
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

// ==================== МАССОВАЯ ЗАГРУЗКА обеспеченности ====================

async function loadRatingsBulk(regions, popRange) {
    const loader = initLoader();
    loader.show('Загрузка обеспеченности...');

    const result = {};
    try {
        await loadTableStructures();

        const body = {
            regions: Array.isArray(regions) ? regions : [],
            population_filters: popRange
                ? [{ from: popRange.from, to: popRange.to }]
                : []
        };

        const response = await getRatingsPage(0, 1, body);
        if (!response) {
            loader.close();
            return result;
        }

        const ratings = Array.isArray(response)
            ? response
            : (response.ratings || []);

        ratings.forEach(rating => {
            if (rating && rating.id !== undefined && rating.id !== null) {
                result[String(rating.id)] = rating;
            }
        });

        console.log(`Массово загружено обеспеченности: ${Object.keys(result).length}`);
        loader.close();
        return result;
    } catch (error) {
        loader.close();
        console.error('Ошибка массовой загрузки обеспеченности:', error);
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

    resetAndHideSelectedSettlement();

    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) filterContainer.remove();

    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    destroyChart();
    destroyAnalyticsDashboard();
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

    const chartInner = chartContainer ? chartContainer.querySelector('.chart-inner') : null;
    if (chartInner) {
        chartInner.scrollTop = 0;
        chartInner.scrollLeft = 0;
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
        // Шапка (заголовок + карточки + контролы) — не скроллится
        let header = chartContainer.querySelector('.chart-header');
        if (!header) {
            header = document.createElement('div');
            header.className = 'chart-header';
            chartContainer.appendChild(header);
        }

        // Скролл-область для canvas
        let chartInner = chartContainer.querySelector('.chart-inner');
        if (!chartInner) {
            chartInner = document.createElement('div');
            chartInner.className = 'chart-inner';
            chartContainer.appendChild(chartInner);

            const content = document.createElement('div');
            content.className = 'chart-content';
            chartInner.appendChild(content);

            const canvas = document.getElementById('rating-chart');
            if (canvas && canvas.parentNode !== content) {
                content.appendChild(canvas);
            }
        }

        chartContainer.style.display = 'flex';
        chartContainer.style.flexDirection = 'column';
        chartInner.style.display = 'flex';
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
        emptyItem.className = 'search-result-empty';
        container.appendChild(emptyItem);
        container.style.display = 'block';
        return;
    }

    results.forEach((item, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.dataset.index = index;

        const name = item.name || `ID: ${item.id}`;
        const queryLower = query.toLowerCase();
        const nameLower = name.toLowerCase();
        const indexMatch = nameLower.indexOf(queryLower);

        let nameDisplay = name;
        if (indexMatch !== -1) {
            const before = name.substring(0, indexMatch);
            const match = name.substring(indexMatch, indexMatch + query.length);
            const after = name.substring(indexMatch + query.length);
            // Экранируем HTML в before/after, match подсвечиваем <strong>
            const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            nameDisplay = `${esc(before)}<strong>${esc(match)}</strong>${esc(after)}`;
        } else {
            const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            nameDisplay = esc(name);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'search-result-item__name';
        nameSpan.innerHTML = nameDisplay;

        const infoSpan = document.createElement('span');
        const rating = item.rating;
        const ratingText = (rating !== undefined && rating !== null && !isNaN(rating)) ?
            rating.toFixed(1) : 'не получен';
        const regionText = item.region_name || '—';
        infoSpan.textContent = `Обеспеченность: ${ratingText} | ${regionText}`;
        infoSpan.className = 'search-result-item__info';

        resultItem.appendChild(nameSpan);
        resultItem.appendChild(infoSpan);

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
    counter.className = 'search-result-counter';
    container.appendChild(counter);

    container.style.display = 'block';
}

function selectSearchResult(item, index) {
    if (!ratingChart) return;

    // 1. Сначала фиксируем выбранный НП (сброс старого, запись ID, показ блока)
    setSelectedSettlement(item, 'chart');

    // 2. Находим индекс в displayData
    const displayData = getChartDisplayData();
    if (!displayData || displayData.length === 0) return;

    let chartIndex = -1;
    for (let i = 0; i < displayData.length; i++) {
        const d = displayData[i];
        if (item.id !== undefined && item.id !== null && d.id !== undefined && d.id !== null) {
            if (String(d.id) === String(item.id)) {
                chartIndex = i;
                break;
            }
        } else if (d.name && item.name && d.name === item.name) {
            chartIndex = i;
            break;
        }
    }
    if (chartIndex === -1) chartIndex = index;

    const isSelectedAt = (i) => {
        const d = displayData[i];
        if (item.id !== undefined && item.id !== null && d.id !== undefined && d.id !== null) {
            return String(d.id) === String(item.id);
        }
        return (d.name && item.name && d.name === item.name);
    };

    // 3. Красим выделенный столбец
    const ds0 = ratingChart.data.datasets[0];
    ds0.backgroundColor = displayData.map((d, i) => isSelectedAt(i) ? '#ff0000' : '#1a73e8');
    ds0.borderColor     = displayData.map((d, i) => isSelectedAt(i) ? '#ff0000' : '#1a73e8');
    ds0.borderWidth     = displayData.map((d, i) => isSelectedAt(i) ? 3 : 0);

    if (ratingChart.data.datasets[1]) {
        const ds1 = ratingChart.data.datasets[1];
        ds1.backgroundColor = displayData.map((d, i) => isSelectedAt(i) ? '#cc0000' : '#ff6a00');
        ds1.borderColor     = displayData.map((d, i) => isSelectedAt(i) ? '#cc0000' : '#ff6a00');
        ds1.borderWidth     = displayData.map((d, i) => isSelectedAt(i) ? 3 : 0);
    }

    ratingChart.update();

    // 4. Восстанавливаем указатели (setSelectedSettlement их обнулил)
    selectedSearchItem = item;
    selectedSearchIndex = chartIndex;

    // ВКЛЮЧАЕМ флаг
    selectedSettlementHighlighted = true;

    // 5. Скрываем список результатов
    const container = document.getElementById('chart-search-results');
    if (container) container.style.display = 'none';

    // 6. Показываем тултип ПОСЛЕ перерисовки
    requestAnimationFrame(() => {
        const dd = getChartDisplayData();
        let idx = -1;
        for (let i = 0; i < dd.length; i++) {
            if (item.id !== undefined && item.id !== null && String(dd[i].id) === String(item.id)) {
                idx = i;
                break;
            }
        }
        if (idx === -1) idx = chartIndex;

        if (idx !== -1 && dd[idx]) {
            selectedSearchIndex = idx;
            showItemTooltip(dd[idx], idx);
        }
    });

    // 7. Заполняем поисковое поле
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
    tooltip.className = 'chart-tooltip';

    const rating = Number(item.rating) || 0;
    const hasRating = item.rating !== undefined && item.rating !== null && !isNaN(item.rating);

    const ratingText   = hasRating ? `${Math.round(rating)}%` : 'не получен';
    const deficitText  = hasRating ? `${Math.round(100 - rating)}%` : 'не получен';

    const population = item.population || 0;
    const region = item.region_name || 'Н/Д';
    const district = item.district_name || 'Н/Д';
    const name = item.name || `ID: ${item.id}`;

    let placeText = '—';
    let totalPlaces = ratingPlacesTotal;
    if (ratingPlacesMap && ratingPlacesMap.size > 0) {
        const found = ratingPlacesMap.get(String(item.id));
        if (found !== undefined) placeText = found;
    } else if (chartAllData.length > 0) {
        const ordered = [...chartAllData].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        totalPlaces = ordered.length;
        const idx = ordered.findIndex(d =>
            (d.id !== undefined && item.id !== undefined && d.id === item.id) ||
            (d.name && item.name && d.name === item.name)
        );
        if (idx !== -1) placeText = idx + 1;
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'chart-tooltip__title';
    titleEl.textContent = name;
    tooltip.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'chart-tooltip__body';

    const addRow = (swatchClass, text) => {
        const row = document.createElement('div');
        if (swatchClass) {
            const sw = document.createElement('span');
            sw.className = 'chart-tooltip__swatch ' + swatchClass;
            row.appendChild(sw);
        }
        row.appendChild(document.createTextNode(text));
        bodyEl.appendChild(row);
    };

    addRow('chart-tooltip__swatch--provided', `Обеспеченность: ${ratingText}`);
    addRow('chart-tooltip__swatch--deficit',  `Дефицит: ${deficitText}`);
    addRow(null, `Место в обеспеченности: ${placeText} из ${totalPlaces}`);
    addRow(null, `Население: ${population.toLocaleString()} чел.`);
    addRow(null, region);
    addRow(null, district);
    addRow(null, `ID: ${item.id}`);

    tooltip.appendChild(bodyEl);
    document.body.appendChild(tooltip);

    // Стартовая позиция вне экрана, чтобы не мигало
    tooltip.style.left = '-9999px';
    tooltip.style.top  = '-9999px';
    tooltip.style.maxWidth = Math.min(400, window.innerWidth - 40) + 'px';

    // Позиционируем с повторными попытками, пока chartArea не готов
    let attempts = 0;
    const tryPosition = () => {
        if (!ratingChart || !ratingChart.chartArea) {
            if (attempts < 20) {
                attempts++;
                requestAnimationFrame(tryPosition);
            }
            return;
        }
        positionTooltipOverBar(tooltip, chartIndex);
    };
    requestAnimationFrame(tryPosition);
}

// ==================== ПОЗИЦИОНИРОВАНИЕ ПЛАШКИ ====================

function positionTooltipOverBar(tooltip, chartIndex) {
    if (!ratingChart) {
        positionTooltipInChartArea(tooltip, null);
        return;
    }

    try {
        const displayData = getChartDisplayData();
        if (!displayData || displayData.length === 0) {
            positionTooltipInChartArea(tooltip, null);
            return;
        }

        // Ищем индекс СТРОГО ПО ID — он стабильнее, чем переданный chartIndex
        let idx = -1;
        if (selectedSettlementId !== undefined && selectedSettlementId !== null) {
            for (let i = 0; i < displayData.length; i++) {
                if (String(displayData[i].id) === String(selectedSettlementId)) {
                    idx = i;
                    break;
                }
            }
        }
        if (idx === -1 && typeof chartIndex === 'number' && chartIndex >= 0 && chartIndex < displayData.length) {
            idx = chartIndex;
        }
        if (idx === -1) {
            positionTooltipInChartArea(tooltip, null);
            return;
        }

        const meta = ratingChart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data[idx]) {
            positionTooltipInChartArea(tooltip, null);
            return;
        }

        const bar = meta.data[idx];
        const canvas = ratingChart.canvas;
        const rect = canvas.getBoundingClientRect();
        const chartArea = ratingChart.chartArea;

        const scaleX = rect.width / ratingChart.width;
        const scaleY = rect.height / ratingChart.height;

        const barX = bar.x;
        const barY = bar.y;

        const pixelX = rect.left + barX * scaleX;
        const pixelY = rect.top + barY * scaleY;

        const chartLeft = rect.left + chartArea.left * scaleX;
        const chartRight = rect.left + chartArea.right * scaleX;
        const chartTop = rect.top + chartArea.top * scaleY;
        const chartBottom = rect.top + chartArea.bottom * scaleY;

        const tooltipWidth = Math.min(parseInt(tooltip.style.maxWidth) || 400, window.innerWidth - 40);
        const tooltipHeight = 220;

        let left = pixelX - tooltipWidth / 2;
        let top = pixelY - 15;

        if (left < chartLeft + 10) left = chartLeft + 10;
        if (left + tooltipWidth > chartRight - 10) left = chartRight - tooltipWidth - 10;

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
    if (!tooltip) return;

    // Позиционируем если есть выбранный НП (по ID — внутри positionTooltipOverBar)
    if (selectedSettlementId !== undefined && selectedSettlementId !== null) {
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

    ratingChart.data.datasets[0].backgroundColor = '#1a73e8';
    ratingChart.data.datasets[0].borderColor     = '#1a73e8';
    ratingChart.data.datasets[0].borderWidth     = 0;

    if (ratingChart.data.datasets[1]) {
        ratingChart.data.datasets[1].backgroundColor = '#ff6a00';
        ratingChart.data.datasets[1].borderColor     = '#ff6a00';
        ratingChart.data.datasets[1].borderWidth     = 0;
    }

    ratingChart.update();

    const tooltip = document.getElementById('chart-item-tooltip');
    if (tooltip) tooltip.remove();
}
// Восстановить выделение по selectedSettlementId (устойчиво к пересозданию графика)
function restoreSelectionById(attempt = 0) {
    if (!ratingChart || !selectedSettlementId) return;

    const displayData = getChartDisplayData();
    if (!displayData || displayData.length === 0) return;

    const chartArea = ratingChart.chartArea;
    const meta = ratingChart.getDatasetMeta(0);
    const metaReady = meta && meta.data && meta.data.length === displayData.length;

    if ((!chartArea || !metaReady) && attempt < 20) {
        requestAnimationFrame(() => restoreSelectionById(attempt + 1));
        return;
    }

    let foundIndex = -1;
    for (let i = 0; i < displayData.length; i++) {
        if (String(displayData[i].id) === String(selectedSettlementId)) {
            foundIndex = i;
            break;
        }
    }

    if (foundIndex !== -1) {
        selectedSearchItem = displayData[foundIndex];
        selectedSearchIndex = foundIndex;
        selectedSettlementHighlighted = true;
    } else {
        selectedSearchItem = null;
        selectedSearchIndex = -1;
        selectedSettlementHighlighted = false;
    }

    const isSelectedAt = (i) => {
        if (!selectedSettlementHighlighted) return false;
        const d = displayData[i];
        return d && String(d.id) === String(selectedSettlementId);
    };

    const ds0 = ratingChart.data.datasets[0];
    const ds1 = ratingChart.data.datasets[1];

    ds0.backgroundColor = displayData.map((d, i) => isSelectedAt(i) ? '#ff0000' : '#1a73e8');
    ds0.borderColor     = displayData.map((d, i) => isSelectedAt(i) ? '#ff0000' : '#1a73e8');
    ds0.borderWidth     = displayData.map((d, i) => isSelectedAt(i) ? 3 : 0);

    if (ds1) {
        ds1.backgroundColor = displayData.map((d, i) => isSelectedAt(i) ? '#cc0000' : '#ff6a00');
        ds1.borderColor     = displayData.map((d, i) => isSelectedAt(i) ? '#cc0000' : '#ff6a00');
        ds1.borderWidth     = displayData.map((d, i) => isSelectedAt(i) ? 3 : 0);
    }

    ratingChart.update('none');

    if (foundIndex !== -1) {
        requestAnimationFrame(() => {
            const dd = getChartDisplayData();
            let idx = -1;
            for (let i = 0; i < dd.length; i++) {
                if (String(dd[i].id) === String(selectedSettlementId)) {
                    idx = i;
                    break;
                }
            }
            if (idx !== -1 && dd[idx]) {
                selectedSearchIndex = idx;
                showItemTooltip(dd[idx], idx);
            }
        });
    }
}

function jumpToSettlementInTable(settlementId) {
    if (!settlementId) return;

    const targetId = String(settlementId).trim();

    const fullData = currentSettlementsFiltered || [];
    if (fullData.length === 0) {
        renderPopup('Таблица пуста');
        return;
    }

    let globalIndex = -1;
    for (let i = 0; i < fullData.length; i++) {
        if (String(fullData[i].id) === targetId) {
            globalIndex = i;
            break;
        }
    }

    if (globalIndex === -1) {
        renderPopup('НП не найден в текущей таблице');
        return;
    }

    const pageSize = settlementsData.pageSize || 100;
    const targetPage = Math.floor(globalIndex / pageSize);

    // Если НП на другой странице — перерисовываем на нужную
    if (targetPage !== currentDisplayPage) {
        currentDisplayPage = targetPage;

        if (showRatings) {
            if (savedFilterField && savedFilterValue) {
                renderCombinedTable(originalDataForFilter, originalTotalForFilter, targetPage, pageSize, true);
            } else {
                renderCombinedTable(originalDataForFilter, originalTotalForFilter, targetPage, pageSize, false);
            }
        } else {
            if (savedFilterField && savedFilterValue) {
                renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, targetPage, pageSize, true);
            } else {
                renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, targetPage, pageSize, false);
            }
        }

        requestAnimationFrame(() => {
            const tbody = document.querySelector('#settlements-table tbody');
            if (!tbody) return;
            const rows = tbody.querySelectorAll('tr');
            for (const tr of rows) {
                if (String(tr.dataset.id) === targetId) {
                    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    break;
                }
            }
        });
        return;
    }

    // НП на текущей странице — кликаем и прокручиваем
    const tbody = document.querySelector('#settlements-table tbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    for (const tr of rows) {
        if (String(tr.dataset.id) === targetId) {
            tr.click();
            tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    renderPopup('НП не найден на текущей странице');
}
// Восстанавливает selectedSettlement* из localStorage (id_np → поиск в settlementsData.items)
// Восстанавливает selectedSettlement* из localStorage (id_np → поиск в settlementsData.items)
function restoreSelectedFromStorage() {
    const storedId = lsGet(LS_KEYS.idNp, null);
    if (!storedId) return false;

    const targetId = String(storedId).trim();

    const item = (settlementsData.items || []).find(
        it => String(it.id) === targetId
    );

    if (item) {
        selectedSettlementId = String(item.id);
        selectedSettlementName = item.name || `ID: ${item.id}`;
        selectedSettlementLat = item.lat;
        selectedSettlementLon = item.lon;
        selectedSettlementArea = item.area;
        selectedSettlementForInfo = item;
        return true;
    }

    // Если НП нет в текущей выборке — всё равно сохраняем ID
    selectedSettlementId = targetId;
    selectedSettlementName = `ID: ${targetId}`;
    return false;
}
// Выбрать строку в таблице по id_np из localStorage.
// Если НП на другой странице — автоматически переключить страницу и выбрать.
function selectInitialRowInTable(tbody, options = {}) {
    if (!tbody) return false;

    const {
        fallbackToFirst = true,
        persistFallback = true,
        goToPage = null,
        currentPage = 0,
        pageSize = 100,
        sortedData = null
    } = options;

    const storedId = lsGet(LS_KEYS.idNp, null);
    const targetId = storedId ? String(storedId).trim() : null;

    // === 1. Ищем НП на текущей странице ===
    if (targetId) {
        const rows = tbody.querySelectorAll('tr');
        for (const tr of rows) {
            if (String(tr.dataset.id) === targetId) {
                tr.click();
                return true;
            }
        }
    }

    // === 2. НП нет на текущей — ищем в полном массиве и переключаем страницу ===
    if (targetId && Array.isArray(sortedData) && sortedData.length > 0) {
        let globalIndex = -1;
        for (let i = 0; i < sortedData.length; i++) {
            if (String(sortedData[i].id) === targetId) {
                globalIndex = i;
                break;
            }
        }

        if (globalIndex !== -1) {
            const targetPage = Math.floor(globalIndex / pageSize);
            if (targetPage !== currentPage && typeof goToPage === 'function') {
                goToPage(targetPage);
                return true;
            }
        }
    }

    // === 3. Fallback — первая строка ===
    if (!fallbackToFirst) return false;

    const firstRow = tbody.querySelector('tr');
    if (firstRow) {
        if (!persistFallback && storedId) {
            firstRow.click();
            lsSet(LS_KEYS.idNp, storedId);
        } else {
            firstRow.click();
        }
        return false;
    }

    return false;
}
function restoreSelectionAfterUpdate() {
    if (!selectedSearchItem || !ratingChart) return;

    const displayData = getChartDisplayData();
    if (!displayData || displayData.length === 0) return;

    let foundIndex = -1;
    for (let i = 0; i < displayData.length; i++) {
        const d = displayData[i];
        if (selectedSearchItem.id !== undefined && selectedSearchItem.id !== null &&
            d.id !== undefined && d.id !== null) {
            if (String(d.id) === String(selectedSearchItem.id)) {
                foundIndex = i;
                break;
            }
        } else if (d.name && selectedSearchItem.name && d.name === selectedSearchItem.name) {
            foundIndex = i;
            break;
        }
    }

    if (foundIndex === -1) return;

    const isSelectedAt = (i) => {
        const d = displayData[i];
        if (selectedSearchItem.id !== undefined && selectedSearchItem.id !== null &&
            d.id !== undefined && d.id !== null) {
            return String(d.id) === String(selectedSearchItem.id);
        }
        return (d.name && selectedSearchItem.name && d.name === selectedSearchItem.name);
    };

    const ds0 = ratingChart.data.datasets[0];
    ds0.backgroundColor = displayData.map((d, i) => isSelectedAt(i) ? '#ff0000' : '#1a73e8');
    ds0.borderColor     = displayData.map((d, i) => isSelectedAt(i) ? '#ff0000' : '#1a73e8');
    ds0.borderWidth     = displayData.map((d, i) => isSelectedAt(i) ? 3 : 0);

    if (ratingChart.data.datasets[1]) {
        const ds1 = ratingChart.data.datasets[1];
        ds1.backgroundColor = displayData.map((d, i) => isSelectedAt(i) ? '#cc0000' : '#ff6a00');
        ds1.borderColor     = displayData.map((d, i) => isSelectedAt(i) ? '#cc0000' : '#ff6a00');
        ds1.borderWidth     = displayData.map((d, i) => isSelectedAt(i) ? 3 : 0);
    }

    ratingChart.update();

    requestAnimationFrame(() => {
        const dd = getChartDisplayData();
        let idx = -1;
        for (let i = 0; i < dd.length; i++) {
            if (selectedSearchItem.id !== undefined && selectedSearchItem.id !== null &&
                String(dd[i].id) === String(selectedSearchItem.id)) {
                idx = i;
                break;
            }
        }
        if (idx === -1) idx = foundIndex;

        if (idx !== -1 && dd[idx]) {
            selectedSearchIndex = idx;
            showItemTooltip(dd[idx], idx);
        }
    });
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

    // Обновить позицию тултипа после пересчёта зума
    requestAnimationFrame(() => updateTooltipPosition());
}

// ==================== ПАНЕЛЬ УПРАВЛЕНИЯ ДИАГРАММОЙ ====================
function renderFormatControls() {
    const container = document.querySelector('.table_buttons');
    if (!container) return;

    // Безусловно удаляем старую группу (даже если isChartMode false)
    const oldGroup = document.getElementById('format-controls-group');
    if (oldGroup) oldGroup.remove();

    // Показываем только в режиме графика
    if (!isChartMode) return;

    const group = document.createElement('div');
    group.id = 'format-controls-group';
    group.style.display = 'flex';
    group.style.alignItems = 'center';
    group.style.gap = '12px';
    group.style.marginRight = 'auto';
    group.style.paddingLeft = '4px';

    const formatLabel = document.createElement('label');
    formatLabel.textContent = 'Формат графика';
    formatLabel.style.fontWeight = '600';
    formatLabel.style.fontSize = '14px';
    group.appendChild(formatLabel);

    const makeRadio = (value, text) => {
        const lbl = document.createElement('label');
        lbl.style.display = 'flex';
        lbl.style.alignItems = 'center';
        lbl.style.gap = '4px';
        lbl.style.fontSize = '14px';
        lbl.style.cursor = 'pointer';
        lbl.style.fontWeight = '600';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'chart-format-bottom';
        radio.value = value;
        radio.checked = (currentChartFormat === value);

        radio.addEventListener('change', function() {
            if (!this.checked) return;
            currentChartFormat = value;

            const savedMin = ratingChart ? ratingChart.options.scales.x.min : undefined;
            const savedMax = ratingChart ? ratingChart.options.scales.x.max : undefined;

            createRatingChart(chartAllData.length > 0 ? chartAllData : [], chartType);

            if (ratingChart && savedMin !== undefined && savedMax !== undefined) {
                ratingChart.options.scales.x.min = savedMin;
                ratingChart.options.scales.x.max = savedMax;
                ratingChart.update('none');
            }

            if (selectedSearchItem) {
                setTimeout(() => restoreSelectionAfterUpdate(), 100);
            }
        });

        lbl.appendChild(radio);
        lbl.appendChild(document.createTextNode(text));
        return lbl;
    };

    group.appendChild(makeRadio('full', 'Полный'));
    group.appendChild(makeRadio('short', 'Краткий'));

    container.insertBefore(group, container.firstChild);
}
function renderChartControls(currentSortField) {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) return;

    const oldControls = document.getElementById('chart-controls');
    if (oldControls) oldControls.remove();

    const controls = document.createElement('div');
    controls.id = 'chart-controls';
    controls.className = 'chart-controls';

    // ---------- Сортировка ----------
    const sortLabel = document.createElement('label');
    sortLabel.textContent = 'Сортировка:';
    sortLabel.className = 'chart-controls__label';
    controls.appendChild(sortLabel);

    const sortSelect = document.createElement('select');
    sortSelect.id = 'chart-sort-select';
    sortSelect.className = 'chart-controls__select';

    const options = [
        { value: 'rating', label: 'По обеспеченности (убывание)' },
        { value: 'name', label: 'По названию (А-Я)' }
    ];
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === currentSortField) option.selected = true;
        sortSelect.appendChild(option);
    });

    sortSelect.addEventListener('change', function() {
        chartSearchQuery = '';
        searchResults = [];
        selectedSearchItem = null;
        selectedSearchIndex = -1;
        zoomStartIndex = 0;
        zoomEndIndex = 0;

        const searchInput = document.getElementById('chart-search-input');
        if (searchInput) searchInput.value = '';

        const resultsContainer = document.getElementById('chart-search-results');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
        }

        const tooltip = document.getElementById('chart-item-tooltip');
        if (tooltip) tooltip.remove();

        const currentData = chartAllData.length > 0 ? chartAllData : [];
        createRatingChart(currentData, chartType);
    });
    controls.appendChild(sortSelect);

    const divider = document.createElement('span');
    divider.textContent = '|';
    divider.className = 'chart-controls__divider';
    controls.appendChild(divider);

    // ---------- Поиск ----------
    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Поиск:';
    searchLabel.className = 'chart-controls__label';
    controls.appendChild(searchLabel);

    const searchContainer = document.createElement('div');
    searchContainer.id = 'chart-search-container';
    searchContainer.className = 'chart-search';

    const searchInput = document.createElement('input');
    searchInput.id = 'chart-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Введите название НП...';
    searchInput.value = chartSearchQuery;
    searchInput.className = 'chart-search__input';

    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'chart-search-results';
    resultsContainer.className = 'chart-search__results';
    searchContainer.appendChild(resultsContainer);

    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        chartSearchQuery = query;

        const resultsContainer = document.getElementById('chart-search-results');
        if (!resultsContainer) return;

        if (query.length === 0) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
            searchResults = [];
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
    clearBtn.className = 'chart-search__clear';
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
    divider2.className = 'chart-controls__divider';
    controls.appendChild(divider2);

    // ---------- Масштаб ----------
    const zoomLabel = document.createElement('label');
    zoomLabel.textContent = 'Масштаб:';
    zoomLabel.className = 'chart-controls__label';
    controls.appendChild(zoomLabel);

    const zoomInBtn = document.createElement('button');
    zoomInBtn.textContent = '+';
    zoomInBtn.title = 'Увеличить масштаб';
    zoomInBtn.className = 'chart-zoom__btn chart-zoom__btn--in';
    zoomInBtn.addEventListener('click', zoomIn);
    controls.appendChild(zoomInBtn);

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '−';
    zoomOutBtn.title = 'Уменьшить масштаб';
    zoomOutBtn.className = 'chart-zoom__btn chart-zoom__btn--out';
    zoomOutBtn.addEventListener('click', zoomOut);
    controls.appendChild(zoomOutBtn);

    const resetZoomBtn = document.createElement('button');
    resetZoomBtn.textContent = 'Сброс';
    resetZoomBtn.title = 'Сбросить масштаб';
    resetZoomBtn.className = 'chart-zoom__btn chart-zoom__btn--reset';
    resetZoomBtn.addEventListener('click', resetZoom);
    controls.appendChild(resetZoomBtn);

    const zoomInfo = document.createElement('span');
    zoomInfo.id = 'zoom-info';
    zoomInfo.textContent = 'Видно: все';
    zoomInfo.className = 'chart-zoom__info';
    controls.appendChild(zoomInfo);

    const header = chartContainer.querySelector('.chart-header') || chartContainer;
    header.appendChild(controls);

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

function renderChartStatsCards(container, stats, rowClass = 'chart-stats-row', insertAfterSelector = null) {
    const old = container.querySelector('.' + rowClass);
    if (old) old.remove();

    const row = document.createElement('div');
    row.className = rowClass;

    const makeCard = (label, value, color) => {
        const card = document.createElement('div');
        card.className = 'chart-stat-card';
        card.style.setProperty('--kpi-color', color);

        const valEl = document.createElement('div');
        valEl.className = 'chart-stat-card__value';

        const percentLabels = [
            'Медианная обеспеченность',
            'Медианный дефицит',
            'Средняя обеспеченность',
            'Средний дефицит'
        ];
        valEl.textContent = percentLabels.includes(label) ? `${value}%` : value;

        const lblEl = document.createElement('div');
        lblEl.className = 'chart-stat-card__label';
        lblEl.textContent = label;

        const valueText = valEl.textContent;
        const fullText = `${label}: ${valueText}`;
        card.title = fullText;
        valEl.title = valueText;
        lblEl.title = label;

        card.appendChild(valEl);
        card.appendChild(lblEl);
        return card;
    };

    stats.forEach(s => row.appendChild(makeCard(s.label, s.value, s.color)));

    if (insertAfterSelector) {
        const anchor = container.querySelector(insertAfterSelector);
        if (anchor && anchor.nextSibling) {
            container.insertBefore(row, anchor.nextSibling);
            return;
        }
    }
    container.appendChild(row);
}
// ==================== ПЕРЕСБОРКА С СОХРАНЕНИЕМ ЗУМА ====================
// ==================== ДИНАМИЧЕСКИЙ РАЗМЕР ГРАФИКА ====================

function resizeRatingChart() {
    if (!ratingChart) return;

    const chartContainer = document.getElementById('chart-container');
    const chartHeader = chartContainer ? chartContainer.querySelector('.chart-header') : null;
    const chartInner = chartContainer ? chartContainer.querySelector('.chart-inner') : null;
    const chartContent = chartContainer ? chartContainer.querySelector('.chart-content') : null;
    const canvas = document.getElementById('rating-chart');

    if (!chartContainer || !chartInner || !chartContent || !canvas) return;

    const MIN_W = 1500;
    const MIN_H = 430;

    // Доступная высота: высота окна минус всё, что занимает шапка контейнера
    const containerRect = chartContainer.getBoundingClientRect();
    const headerHeight = chartHeader ? chartHeader.getBoundingClientRect().height : 0;
    const availableHeight = Math.max(
        containerRect.height - headerHeight - 16, // 16 — небольшой отступ/зазор
        MIN_H
    );

    // Доступная ширина
    const availableWidth = Math.max(containerRect.width, MIN_W);

    // Применяем к обёртке (там скролл при нехватке)
    chartInner.style.width = '100%';
    chartInner.style.height = (containerRect.height - headerHeight) + 'px';

    // Применяем к контенту и canvas
    chartContent.style.width = availableWidth + 'px';
    chartContent.style.height = availableHeight + 'px';

    canvas.style.width = availableWidth + 'px';
    canvas.style.height = availableHeight + 'px';

    // Просим Chart.js пересчитать
    ratingChart.resize();
    ratingChart.update('none');

    // Перепозиционируем тултип, если он открыт
    requestAnimationFrame(() => updateTooltipPosition());
}
function rebuildChartPreservingZoom() {
    if (!ratingChart) return;

    const savedMin = ratingChart.options.scales.x.min;
    const savedMax = ratingChart.options.scales.x.max;
    const savedSelected = selectedSearchItem;

    const query = chartSearchQuery.trim().toLowerCase();

    const existingSortSelect = document.getElementById('chart-sort-select');
    let sortField = 'rating';
    if (existingSortSelect) sortField = existingSortSelect.value;

    let sortedData = [...chartAllData];
    if (sortField === 'rating') {
        sortedData.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortField === 'name') {
        sortedData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    let displayData = sortedData;
    if (query) {
        displayData = sortedData.filter(item =>
            (item.name || '').toLowerCase().includes(query) ||
            (item.region_name || '').toLowerCase().includes(query) ||
            (item.district_name || '').toLowerCase().includes(query)
        );
    }

    currentDisplayDataLength = displayData.length;
    chartDisplayData = displayData;

    const labels = displayData.map(item => item.name || `ID: ${item.id}`);
    const providedValues = displayData.map(item => Math.max(0, Math.min(100, item.rating || 0)));
    const deficitValues = displayData.map(item => 100 - Math.max(0, Math.min(100, item.rating || 0)));

    ratingChart.data.labels = labels;
    ratingChart.data.datasets[0].data = providedValues;
    ratingChart.data.datasets[0].backgroundColor = '#1a73e8';
    ratingChart.data.datasets[0].borderColor = '#1a73e8';
    ratingChart.data.datasets[1].data = deficitValues;
    ratingChart.data.datasets[1].backgroundColor = '#ff6a00';
    ratingChart.data.datasets[1].borderColor = '#ff6a00';

    if (savedMin !== undefined && savedMax !== undefined) {
        ratingChart.options.scales.x.min = savedMin;
        ratingChart.options.scales.x.max = savedMax;
    } else {
        ratingChart.options.scales.x.min = 0;
        ratingChart.options.scales.x.max = currentDisplayDataLength;
    }

    ratingChart.update();

    const countEl = document.querySelector('.chart-count');
    if (countEl) countEl.textContent = `Всего НП: ${sortedData.length}`;

    if (savedSelected) {
        selectedSearchItem = savedSelected;
        setTimeout(() => restoreSelectionAfterUpdate(), 100);
    }
}

// ==================== СОЗДАНИЕ ДИАГРАММЫ ====================
// ==================== СОЗДАНИЕ ДИАГРАММЫ ====================
function createRatingChart(data, type) {
    const canvas = document.getElementById('rating-chart');
    if (!canvas) {
        console.error('Canvas для диаграммы не найден');
        return;
    }

    destroyChart();

    canvas.style.border = 'none';
    canvas.style.outline = 'none';
    canvas.style.boxShadow = 'none';
    canvas.style.background = 'transparent';

    const parentInner = canvas.closest('.chart-inner');
    if (parentInner) {
        parentInner.style.border = 'none';
        parentInner.style.outline = 'none';
        parentInner.style.boxShadow = 'none';
    }

    const parentContent = canvas.closest('.chart-content');
    if (parentContent) {
        parentContent.style.border = 'none';
        parentContent.style.outline = 'none';
        parentContent.style.boxShadow = 'none';
    }

    const chartContainer = document.getElementById('chart-container');
    if (chartContainer) {
        chartContainer.style.border = 'none';
        chartContainer.style.outline = 'none';
        chartContainer.style.boxShadow = 'none';
    }

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

    const globalRatingOrder = [...chartAllData]
        .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    ratingPlacesMap = new Map();
    globalRatingOrder.forEach((it, idx) => {
        ratingPlacesMap.set(String(it.id), idx + 1);
    });
    ratingPlacesTotal = globalRatingOrder.length;

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
    const providedValues = displayData.map(item => Math.max(0, Math.min(100, item.rating || 0)));
    const deficitValues = displayData.map(item => 100 - Math.max(0, Math.min(100, item.rating || 0)));

    const providedColors = displayData.map(() => '#1a73e8');
    const deficitColors  = displayData.map(() => '#ff6a00');

    // ==================== РАСЧЁТ СТАТИСТИКИ ====================
    const ratingsAll = sortedData.map(it => Number(it.rating) || 0);
    const n = ratingsAll.length;

    const sumRating = ratingsAll.reduce((a, b) => a + b, 0);
    const avgRating = n > 0 ? sumRating / n : 0;
    const avgDeficit = n > 0 ? 100 - avgRating : 0;

    const sortedRatings = [...ratingsAll].sort((a, b) => a - b);
    let medianRating = 0;
    if (n > 0) {
        const mid = Math.floor(n / 2);
        if (n % 2 === 1) {
            medianRating = sortedRatings[mid];
        } else {
            medianRating = (sortedRatings[mid - 1] + sortedRatings[mid]) / 2;
        }
    }
    const medianDeficit = n > 0 ? 100 - medianRating : 0;

    // ==================== ЧИСЛЕННОСТЬ НАСЕЛЕНИЯ ====================
    const radioAll = document.getElementById('number-settlements');
    const fromInput = document.getElementById('numbers-settlement');
    const toInput = document.getElementById('numbers-settlements');

    const isAllPop = !!(radioAll && radioAll.checked);
    const popFrom = isAllPop ? 1 : (parseInt(fromInput?.value) || 1);
    const popTo = isAllPop ? 17000000 : (parseInt(toInput?.value) || 17000000);

    const populationLabel = isAllPop
        ? 'Все НП'
        : `${popFrom.toLocaleString('ru-RU')}–${popTo.toLocaleString('ru-RU')}`;

    // ==================== ДИАГРАММА ====================
    ratingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Обеспеченность,%',
                    data: providedValues,
                    backgroundColor: providedColors,
                    borderColor: providedColors,
                    borderWidth: 0,
                    borderRadius: 0,
                    barPercentage: 0.97,
                    categoryPercentage: 0.97,
                    stack: 'total',
                    minBarLength: 0,
                    hoverBackgroundColor: '#ff1a1a',
                    hoverBorderColor: '#ff1a1a',
                    hoverBorderWidth: 0
                },
                {
                    label: 'Дефицит,%',
                    data: deficitValues,
                    backgroundColor: deficitColors,
                    borderColor: deficitColors,
                    borderWidth: 0,
                    borderRadius: 0,
                    barPercentage: 0.97,
                    categoryPercentage: 0.97,
                    stack: 'total',
                    minBarLength: 0,
                    hoverBackgroundColor: '#cc0000',
                    hoverBorderColor: '#cc0000',
                    hoverBorderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 8,
                    bottom: currentChartFormat === 'full' ? 169 : 90,
                    right: 100
                }
            },
            interaction: {
                mode: 'index',
                intersect: true,
                axis: 'x'
            },
            onClick: function(evt, elements) {
                if (!elements || elements.length === 0) return;
                const idx = elements[0].index;
                const item = displayData[idx];
                if (!item) return;

                setSelectedSettlement(item, 'chart');
                handleSelectedHighlight();
                openSettlementInfoModal(item);
            },
            onHover: function(event, elements) {
                const nativeEvent = event && event.native ? event.native : event;
                const canvas = nativeEvent && nativeEvent.target ? nativeEvent.target : ratingChart.canvas;
                if (!canvas) return;

                const ds0 = ratingChart.data.datasets[0];
                const ds1 = ratingChart.data.datasets[1];

                const isSelectedAt = (i) => {
                    if (!selectedSettlementHighlighted) return false;
                    if (selectedSettlementId === undefined || selectedSettlementId === null) return false;
                    const d = displayData[i];
                    if (!d || d.id === undefined) return false;
                    return String(d.id) === String(selectedSettlementId);
                };

                if (elements && elements.length > 0) {
                    const hoverIdx = elements[0].index;
                    canvas.style.cursor = 'pointer';

                    ds0.backgroundColor = displayData.map((d, i) => {
                        if (i === hoverIdx) return '#ff1a1a';
                        if (isSelectedAt(i)) return '#ff0000';
                        return '#1a73e8';
                    });
                    ds0.borderColor = ds0.backgroundColor;
                    ds0.hoverBackgroundColor = '#ff1a1a';

                    ds1.backgroundColor = displayData.map((d, i) => {
                        if (i === hoverIdx) return '#cc0000';
                        if (isSelectedAt(i)) return '#cc0000';
                        return '#ff6a00';
                    });
                    ds1.borderColor = ds1.backgroundColor;
                    ds1.hoverBackgroundColor = '#cc0000';
                } else {
                    canvas.style.cursor = 'default';

                    ds0.backgroundColor = displayData.map((d, i) =>
                        isSelectedAt(i) ? '#ff0000' : '#1a73e8'
                    );
                    ds0.borderColor = ds0.backgroundColor;

                    ds1.backgroundColor = displayData.map((d, i) =>
                        isSelectedAt(i) ? '#cc0000' : '#ff6a00'
                    );
                    ds1.borderColor = ds1.backgroundColor;
                }

                ratingChart.update('none');
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 16, weight: 'bold' },
                        color: '#1a1a1a',
                        boxWidth: 22,
                        boxHeight: 14,
                        padding: 12,
                        generateLabels: function(chart) {
                            return [
                                {
                                    text: 'Обеспеченность,%',
                                    fillStyle: '#1a73e8',
                                    strokeStyle: '#1a73e8',
                                    lineWidth: 1,
                                    hidden: false,
                                    index: 0
                                },
                                {
                                    text: 'Дефицит,%',
                                    fillStyle: '#ff6a00',
                                    strokeStyle: '#ff6a00',
                                    lineWidth: 1,
                                    hidden: false,
                                    index: 1
                                }
                            ];
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    intersect: false,
                    mode: 'index',
                    backgroundColor: '#bdbdbd',
                    titleColor: '#000000',
                    bodyColor: '#000000',
                    borderColor: '#000000',
                    borderWidth: 2,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 16, weight: 'bold' },
                    bodyFont: { size: 14, weight: 'bold' },
                    bodySpacing: 6,
                    callbacks: {
                        title: function(context) {
                            const item = displayData[context[0].dataIndex];
                            return item ? (item.name || `ID: ${item.id}`) : '';
                        },
                        label: function(context) {
                            const item = displayData[context.dataIndex];
                            if (!item) return '';
                            const rating = Number(item.rating) || 0;
                            if (context.datasetIndex === 0) {
                                return `Обеспеченность: ${Math.round(rating)}%`;
                            }
                            return `Дефицит: ${Math.round(100 - rating)}%`;
                        },
                        labelColor: function(context) {
                            if (context.datasetIndex === 0) {
                                return { borderColor: '#1a73e8', backgroundColor: '#1a73e8', borderWidth: 1, borderRadius: 2 };
                            }
                            return { borderColor: '#ff6a00', backgroundColor: '#ff6a00', borderWidth: 1, borderRadius: 2 };
                        },
                        labelTextColor: function(context) {
                            return '#000000';
                        },
                        afterBody: function(context) {
                            const item = displayData[context[0].dataIndex];
                            if (!item) return [];
                            const place = ratingPlacesMap.get(String(item.id)) || '—';
                            const total = ratingPlacesTotal || 0;
                            return [
                                `Место в обеспеченности: ${place} из ${total}`,
                                `Население: ${item.population || 0} чел.`,
                                `${item.region_name || 'Н/Д'}`,
                                `${item.district_name || 'Н/Д'}`,
                                `ID: ${item.id}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    title: { display: false },
                    ticks: { display: false },
                    border: { color: '#000000', width: 2 }
                },
                // ===== В createRatingChart, блок scales.y =====
                y: {
                    stacked: true,
                    beginAtZero: true,
                    min: 0,
                    max: 100,
                    grid: { display: false, drawBorder: true },
                    ticks: {
                        stepSize: 20,                 // ← 0,20,40,60,80,100
                        font: { size: 14 },
                        color: '#000000',
                        callback: function(value) { return value + '%'; }
                    },
                    title: {
                        display: true,
                        text: 'Обеспеченность',
                        color: '#000000',
                        font: { size: 16, weight: 'bold' }
                    },
                    border: { color: '#000000', width: 2 }
                },
            },
            animation: { duration: 0 },
            hover: { mode: 'index', intersect: false, animationDuration: 200 },
            elements: { bar: { borderRadius: 0 } }
        },
        plugins: [
            // ---- горизонтальные линии уровней ----
            {
                id: 'referenceLines',
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return;
                    const yScale = chart.scales.y;
                    if (!yScale) return;

                    ctx.save();

                    const meta = chart.getDatasetMeta(0);
                    if (!meta || !meta.data || meta.data.length === 0) return;

                    const len = displayData.length;
                    const getXForIndex = (idx) => {
                        if (idx < 0) return chartArea.left;
                        if (idx >= len) {
                            const lastBar = meta.data[len - 1];
                            return lastBar ? lastBar.x + (lastBar.width || 0) / 2 : chartArea.right;
                        }
                        const bar = meta.data[idx];
                        return bar.x + (bar.width || 0) / 2;
                    };

                    const ratings = displayData.map(d => Number(d.rating) || 0);
                    const steps = [
                        { threshold: 80, yLevel: 80 },
                        { threshold: 60, yLevel: 60 },
                        { threshold: 40, yLevel: 40 },
                        { threshold: 20, yLevel: 20 },
                        { threshold: 0,  yLevel: 0  }
                    ];

                    ctx.strokeStyle = 'rgb(70, 70, 70)';
                    ctx.lineWidth = 1;

                    steps.forEach(({ threshold, yLevel }) => {
                        let count = 0;
                        for (let i = 0; i < len; i++) {
                            if (ratings[i] > threshold) count++;
                            else break;
                        }
                        if (count === 0) return;

                        const x = getXForIndex(count - 1);
                        const yPixel = yScale.getPixelForValue(yLevel);
                        const yBottom = yScale.getPixelForValue(0);

                        if (yLevel > 0) {
                            ctx.beginPath();
                            ctx.moveTo(chartArea.left, yPixel);
                            ctx.lineTo(chartArea.right, yPixel);   // до правого края
                            ctx.stroke();
                        }

                        ctx.beginPath();
                        ctx.moveTo(x, yPixel);
                        ctx.lineTo(x, yBottom);
                        ctx.stroke();
                    });

                    ctx.restore();
                }
            },

            // ---- подписи снизу: краткий / полный ----
            {
                id: 'lineLabels',
                afterDatasetsDraw(chart) {
                    if (currentChartFormat === 'short') {
                        drawShortLabels(chart, displayData);
                    } else {
                        drawFullLabels(chart, displayData);
                    }
                }
            },

            // ---- стрелки и итоговые подписи для полного режима ----
            {
                id: 'bottomArrow',
                afterDatasetsDraw(chart) {
                    if (currentChartFormat !== 'full') return;
                    drawFullBottomArrows(chart, displayData);
                }
            },

            // ---- подсветка выбранного НП ----
            {
                id: 'highlightMarker',
                afterDatasetsDraw(chart) {
                    if (!selectedSettlementId || !selectedSettlementHighlighted) return;

                    const { ctx, chartArea } = chart;
                    if (!chartArea) return;

                    const displayData = getChartDisplayData();
                    if (!displayData || displayData.length === 0) return;

                    const meta = chart.getDatasetMeta(0);
                    if (!meta || !meta.data || meta.data.length === 0) return;

                    let foundIndex = -1;
                    for (let i = 0; i < displayData.length; i++) {
                        if (String(displayData[i].id) === String(selectedSettlementId)) {
                            foundIndex = i;
                            break;
                        }
                    }
                    if (foundIndex === -1) return;

                    const bar = meta.data[foundIndex];
                    if (!bar) return;

                    const barWidth = bar.width || 1;
                    const markerWidth = Math.max(barWidth, 6);
                    const x = bar.x - markerWidth / 2;

                    ctx.save();
                    ctx.fillStyle = 'rgba(255, 26, 26, 0.45)';
                    ctx.fillRect(x, chartArea.top, markerWidth, chartArea.bottom - chartArea.top);

                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(bar.x, chartArea.top);
                    ctx.lineTo(bar.x, chartArea.bottom);
                    ctx.stroke();

                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.arc(bar.x, chartArea.top + 6, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }
        ]
    });

    canvas.style.border = 'none';
    canvas.style.outline = 'none';
    canvas.style.boxShadow = 'none';

    isChartMode = true;

    const chartContainer2 = document.getElementById('chart-container');
    const chartHeader = chartContainer2 ? chartContainer2.querySelector('.chart-header') : null;

    if (chartHeader) {
        chartHeader.innerHTML = '';

        const title = document.createElement('div');
        title.className = 'chart-title';
        title.textContent = 'График обеспеченности НП региона';
        chartHeader.appendChild(title);
    }

    renderChartControls(sortField);

    if (chartHeader) {
        const stats = [
            { label: 'Количество НП',            value: n.toLocaleString('ru-RU'),  color: '#0066ff' },
            { label: 'Численность населения',    value: populationLabel,           color: '#4c00a8' },
            { label: 'Средняя обеспеченность',   value: avgRating.toFixed(2),      color: '#228028' },
            { label: 'Средний дефицит',          value: avgDeficit.toFixed(2),     color: '#cc0000' },
            { label: 'Медианная обеспеченность', value: medianRating.toFixed(2),   color: '#228028' },
            { label: 'Медианный дефицит',        value: medianDeficit.toFixed(2),  color: '#cc0000' }
        ];

        renderChartStatsCards(chartHeader, stats, 'chart-stats-row');
    }

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

    setTimeout(() => resizeRatingChart(), 0);

    // Восстанавливаем выделение по selectedSettlementId
    if (selectedSettlementId) {
        selectedSettlementHighlighted = true;
        setTimeout(() => restoreSelectionById(), 0);
    }
}



// ---------- КРАТКИЙ режим: накопительные подписи ----------
function drawShortLabels(chart, displayData) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || meta.data.length === 0) return;

    const len = displayData.length;
    const getXForIndex = (idx) => {
        if (idx < 0) return chartArea.left;
        if (idx >= len) {
            const lastBar = meta.data[len - 1];
            return lastBar ? lastBar.x + (lastBar.width || 0) / 2 : chartArea.right;
        }
        const bar = meta.data[idx];
        return bar.x + (bar.width || 0) / 2;
    };

    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const fontSize = 12;
    const lineHeight = 14;
    const yBase = chartArea.bottom + 6;
    const gap = 10;

    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

    const items = [];
    const ratings = displayData.map(d => Number(d.rating) || 0);
    const steps = [
        { threshold: 80, yLevel: 80 },
        { threshold: 60, yLevel: 60 },
        { threshold: 40, yLevel: 40 },
        { threshold: 20, yLevel: 20 },
        { threshold: 0,  yLevel: 0  }
    ];

    steps.forEach(({ threshold, yLevel }) => {
        let count = 0;
        for (let i = 0; i < len; i++) {
            if (ratings[i] > threshold) count++;
            else break;
        }
        if (count === 0) return;

        const x = getXForIndex(count - 1);
        if (x < chartArea.left - 1 || x > chartArea.right + 1) return;

        const percentRounded = Math.round((count / len) * 100);
        const lines = [
            `${count} (${percentRounded}%) НП`,
            `Ур.обесп.>${yLevel}%`
        ];

        let maxWidth = 0;
        lines.forEach(line => {
            const w = ctx.measureText(line).width;
            if (w > maxWidth) maxWidth = w;
        });

        if (!items.some(it => Math.abs(it.x - x) < 1)) {
            items.push({ x, lines, width: maxWidth });
        }
    });

    items.sort((a, b) => a.x - b.x);
    for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1];
        const cur = items[i];
        const prevRight = prev.x + prev.width;
        if (cur.x < prevRight + gap) cur.x = prevRight + gap;
    }

    ctx.textAlign = 'left';
    items.forEach(item => {
        item.lines.forEach((line, i) => {
            ctx.fillText(line, item.x, yBase + i * lineHeight);
        });
    });

    ctx.font = `bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`Всего ${len} НП`, chartArea.right + 6, yBase - 16);

    ctx.restore();
}

// ---------- ПОЛНЫЙ режим: подписи по диапазонам + вертикальные линии лесенкой ----------
function drawFullLabels(chart, displayData) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || meta.data.length === 0) return;

    const len = displayData.length;
    const ratings = displayData.map(d => Number(d.rating) || 0);
    const thresholds = [100, 80, 60, 40, 20, 0];

    const counts = thresholds.map(th => {
        let c = 0;
        for (let i = 0; i < len; i++) {
            if (ratings[i] > th) c++;
            else break;
        }
        return c;
    });

    const getX = (idx) => {
        if (idx < 0) return chartArea.left;
        if (idx >= len) {
            const lastBar = meta.data[len - 1];
            return lastBar ? lastBar.x + (lastBar.width || 0) / 2 : chartArea.right;
        }
        return meta.data[idx].x + (meta.data[idx].width || 0) / 2;
    };

    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    ctx.font = `bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = 'center';

    const baseY = chartArea.bottom + 6;
    const stepY = 13; // Уменьшено с 14

    for (let i = 1; i < counts.length; i++) {
        const delta = Math.abs(counts[i - 1] - counts[i]);
        if (delta === 0) continue;

        const startIdx = counts[i];
        const endIdx = counts[i - 1] - 1;

        const xStart = getX(startIdx);
        const xEnd = getX(endIdx);
        const midX = (xStart + xEnd) / 2;

        ctx.fillText(`${delta} НП`, midX, baseY + (i - 1) * stepY);
    }

    ctx.font = `bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`Всего ${len} НП`, chartArea.right + 6, chartArea.bottom - 6);

    ctx.restore();
}

// ---------- ПОЛНЫЙ режим: стрелки от начала координат ----------
function drawFullBottomArrows(chart, displayData) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || meta.data.length === 0) return;

    const len = displayData.length;
    const ratings = displayData.map(d => Number(d.rating) || 0);

    const thresholds = [80, 60, 40, 20, 0];
    const cumulative = thresholds.map(th => {
        let count = 0;
        for (let i = 0; i < len; i++) {
            if (ratings[i] > th) count++;
            else break;
        }
        return { threshold: th, count };
    });

    const getX = (idx) => {
        if (idx < 0) return chartArea.left;
        if (idx >= len) {
            const lastBar = meta.data[len - 1];
            return lastBar ? lastBar.x + (lastBar.width || 0) / 2 : chartArea.right;
        }
        return meta.data[idx].x + (meta.data[idx].width || 0) / 2;
    };

    ctx.save();
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'black';
    ctx.lineWidth = 1.5;
    ctx.font = `bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Берем точку 0-го элемента для начала всех стрелок
    const startX = getX(0);

    const startY = chartArea.bottom + 75;
    const stepY = 24; // Шаг, чтобы влезали 2 строки текста

    cumulative.forEach((pt, i) => {
        if (pt.count === 0) return;

        const endX = getX(pt.count - 1);
        const y = startY + i * stepY;

        const percent = ((pt.count / len) * 100).toFixed(1).replace('.', ',');
        const label = `${pt.count} (${percent}%) НП`;

        // === ВЕРТИКАЛЬНАЯ ЛИНИЯ ОТ 0 (НАЧАЛО СТРЕЛКИ) ===
        ctx.beginPath();
        ctx.moveTo(startX, chartArea.bottom); // От графика
        ctx.lineTo(startX, y);            // До низа стрелки
        ctx.stroke();

        // === ВЕРТИКАЛЬНАЯ ЛИНИЯ К КОНЦУ СТРЕЛКИ ===
        ctx.beginPath();
        ctx.moveTo(endX, chartArea.bottom);
        ctx.lineTo(endX, y);
        ctx.stroke();

        // === ГОРИЗОНТАЛЬНАЯ ЛИНИЯ СТРЕЛКИ ===
        // Начинается СТРОГО от startX (без отступов)
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX - 10, y);
        ctx.stroke();

        // Наконечник
        ctx.beginPath();
        ctx.moveTo(endX, y);
        ctx.lineTo(endX - 8, y - 4);
        ctx.lineTo(endX - 8, y + 4);
        ctx.closePath();
        ctx.fill();

        // === ТЕКСТ С ПЕРЕНОСОМ НА 2 СТРОКИ ===
        const maxTextWidth = (endX - startX) - 20;
        const textWidth = ctx.measureText(label).width;
        const midX = (startX + endX) / 2;

        if (textWidth > maxTextWidth && label.includes(' (')) {
            // Если не влезает — разбиваем на "192" и "(5.6%) НП"
            const parts = label.split(' ');
            const line1 = parts[0];
            const line2 = parts.slice(1).join(' ');

            ctx.fillText(line1, midX, y - 24);
            ctx.fillText(line2, midX, y - 11);
        } else {
            // Если влезает — пишем в одну строку
            ctx.fillText(label, midX, y - 14);
        }
    });

    ctx.restore();
}
// ==================== МОДАЛКА: ИНФОРМАЦИЯ О НП ====================

async function openSettlementInfoModal(item) {
    if (!item || item.id === undefined) return;

    await loadTableStructures();

    const settlement = settlementsData.items.find(
        it => String(it.id) === String(item.id)
    ) || item;

    const rating = allRatings[String(item.id)] || {};

    const ratedItems = settlementsData.items
        .map(it => ({
            id: it.id,
            rating: (allRatings[String(it.id)] && allRatings[String(it.id)].rating) || 0
        }))
        .sort((a, b) => b.rating - a.rating);

    let placeInRating = '—';
    const foundIdx = ratedItems.findIndex(r => String(r.id) === String(item.id));
    if (foundIdx !== -1) placeInRating = foundIdx + 1;
    const totalInRating = ratedItems.length;

    const existing = document.getElementById('settlement-info-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'settlement-info-modal';
    modal.className = 'res-modal-overlay';

    const content = document.createElement('div');
    content.className = 'res-modal-content';
    content.style.maxWidth = '800px';

    const title = document.createElement('h3');
    title.textContent = `НП: ${settlement.name || settlement.NAME || item.id}`;
    title.className = 'res-modal-title';

    const ratingBadge = document.createElement('div');
    const ratingValue = rating.rating !== undefined && rating.rating !== null
        ? Number(rating.rating).toFixed(2)
        : 'не рассчитан';
    ratingBadge.textContent = `Обеспеченность: ${ratingValue}`;
    ratingBadge.style.cssText = `
        display: inline-block;
        padding: 6px 14px;
        margin-bottom: 12px;
        border-radius: 6px;
        font-size: 15px;
        font-weight: 700;
        color: #fff;
        background: #4a90e2;
    `;

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'res-table-wrapper';
    tableWrapper.style.maxHeight = '60vh';
    tableWrapper.style.overflowY = 'auto';
    tableWrapper.style.position = 'relative';

    const table = document.createElement('table');
    table.className = 'res-modal-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'separate';
    table.style.borderSpacing = '0';

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    const addSection = (sectionTitle) => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.colSpan = 2;
        th.textContent = sectionTitle;
        th.style.cssText = `
            text-align: left;
            padding: 8px 12px;
            background: #4a90e2;
            color: #fff;
            font-weight: 700;
            border: 1px solid #000;
            font-size: 14px;
            position: sticky;
            top: 0;
            z-index: 2;
        `;
        tr.appendChild(th);
        tbody.appendChild(tr);
    };

    const addRow = (label, value) => {
        if (value === undefined || value === null || value === '') value = '-';
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.textContent = label;
        th.style.cssText = `
            text-align: left;
            padding: 6px 12px;
            border: 1px solid #000;
            background: #f2f2f2;
            width: 45%;
            font-weight: 600;
            color: #1a1a1a;
            font-size: 14px;
            position: static;
        `;
        const td = document.createElement('td');
        td.textContent = value;
        td.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #000;
            font-size: 14px;
            color: #2a2a2a;
            background: #fff;
            font-weight: 600;
            position: static;
        `;
        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
    };

    addSection('Населённый пункт');
    addRow('ID', settlement.id);
    addRow('Название', settlement.name);
    addRow('Регион', settlement.region_name);
    addRow('Код региона', settlement.region_code);
    addRow('Муниципальное образование', settlement.district_name);
    addRow('Население', settlement.population);
    addRow('Площадь (км²)', settlement.area);
    addRow('Широта', settlement.lat);
    addRow('Долгота', settlement.lon);
    addRow('Код ФИАС', settlement.fias_id);

    addSection('Обеспеченность');
    addRow('Обеспеченность', rating.rating);
    addRow('Место в обеспеченности', `${placeInRating} из ${totalInRating}`);

    const groups = buildRatingGroups();
    groups.forEach(group => {
        addSection(group.title);
        group.fields.forEach(f => {
            addRow(f.label, rating[f.key]);
        });
    });

    const buttonsBar = document.createElement('div');
    buttonsBar.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 15px;
        flex-wrap: wrap;
    `;

    const detailBtn = document.createElement('button');
    detailBtn.textContent = 'Детализация обеспеченности НП';
    detailBtn.className = 'res-modal-close-btn';
    detailBtn.style.background = '#0066ff';
    detailBtn.style.color = '#fff';
    detailBtn.style.border = '1.5px solid #0044cc';
    detailBtn.addEventListener('click', () => {
        const id = item.id !== undefined && item.id !== null ? item.id : null;
        if (!id) return;
        const url = `http://185.192.247.60:9105/ns/${encodeURIComponent(id)}`;
        window.open(url, '_blank');
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.className = 'res-modal-close-btn';
    closeBtn.addEventListener('click', () => modal.remove());

    buttonsBar.appendChild(detailBtn);
    buttonsBar.appendChild(closeBtn);

    content.appendChild(title);
    content.appendChild(ratingBadge);
    content.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    content.appendChild(buttonsBar);
    modal.appendChild(content);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function buildRatingGroups() {
    return [
        {
            title: 'Мобильная связь',
            fields: [
                { key: 'count_res_mobile', label: 'Количество БС моб. связи' },
                { key: 'count_abonents_mobile', label: 'Количество абонентов моб. связи' },
                { key: 'population_percent_mobile', label: 'Процент охвата населения моб. связи' },
                { key: 'communication_coverage_mobile', label: 'Покрытие моб. связи' },
                { key: 'communication_coverage_percent_mobile', label: 'Процент покрытия моб. связи' },
                { key: 'traffic_mobile', label: 'Объем трафика моб. связи' },
                { key: 'traffic_percent_mobile', label: 'Процент трафика моб. связи' },
                { key: 'count_operators_mobile', label: 'Количество операторов моб. связи' },
                { key: 'operators_percent_mobile', label: 'Процент операторов моб. связи' },
                { key: 'rating_mobile', label: 'Оценка моб. связи' }
            ]
        },
        {
            title: 'LTE',
            fields: [
                { key: 'count_res_lte', label: 'Количество БС LTE' },
                { key: 'count_abonents_lte', label: 'Количество абонентов LTE' },
                { key: 'population_percent_lte', label: 'Процент охвата населения LTE' },
                { key: 'communication_coverage_lte', label: 'Покрытие связи LTE' },
                { key: 'communication_coverage_percent_lte', label: 'Процент покрытия связи LTE' },
                { key: 'traffic_lte', label: 'Объем трафика LTE' },
                { key: 'traffic_percent_lte', label: 'Процент трафика LTE' },
                { key: 'count_operators_lte', label: 'Количество операторов LTE' },
                { key: 'rating_lte', label: 'Оценка LTE' }
            ]
        },
        {
            title: 'GSM',
            fields: [
                { key: 'count_res_gsm', label: 'Количество БС GSM' },
                { key: 'count_abonents_gsm', label: 'Количество абонентов GSM' },
                { key: 'population_percent_gsm', label: 'Процент охвата населения GSM' },
                { key: 'communication_coverage_gsm', label: 'Покрытие связи GSM' },
                { key: 'communication_coverage_percent_gsm', label: 'Процент покрытия связи GSM' },
                { key: 'traffic_gsm', label: 'Объем трафика GSM' },
                { key: 'traffic_percent_gsm', label: 'Процент трафика GSM' },
                { key: 'count_operators_gsm', label: 'Количество операторов GSM' },
                { key: 'rating_gsm', label: 'Оценка GSM' }
            ]
        },
        {
            title: '5G',
            fields: [
                { key: 'count_res_5g', label: 'Количество БС 5G' },
                { key: 'count_abonents_5g', label: 'Количество абонентов 5G' },
                { key: 'population_percent_5g', label: 'Процент охвата населения 5G' },
                { key: 'communication_coverage_5g', label: 'Покрытие связи 5G' },
                { key: 'communication_coverage_percent_5g', label: 'Процент покрытия связи 5G' },
                { key: 'traffic_5g', label: 'Объем трафика 5G' },
                { key: 'traffic_percent_5g', label: 'Процент трафика 5G' },
                { key: 'count_operators_5g', label: 'Количество операторов 5G' },
                { key: 'rating_5g', label: 'Оценка 5G' }
            ]
        },
        {
            title: 'Wi-Fi',
            fields: [
                { key: 'count_res_wifi', label: 'Количество БС Wi-Fi' },
                { key: 'count_abonents_wifi', label: 'Количество абонентов Wi-Fi' },
                { key: 'population_percent_wifi', label: 'Процент охвата населения Wi-Fi' },
                { key: 'communication_coverage_wifi', label: 'Покрытие связи Wi-Fi' },
                { key: 'communication_coverage_percent_wifi', label: 'Процент покрытия связи Wi-Fi' },
                { key: 'traffic_wifi', label: 'Объем трафика Wi-Fi' },
                { key: 'traffic_percent_wifi', label: 'Процент трафика Wi-Fi' },
                { key: 'count_operators_wifi', label: 'Количество операторов Wi-Fi' },
                { key: 'operators_percent_wifi', label: 'Процент операторов Wi-Fi' },
                { key: 'rating_wifi', label: 'Оценка Wi-Fi' }
            ]
        },
        {
            title: 'Tetra',
            fields: [
                { key: 'count_res_tetra', label: 'Количество БС Tetra' },
                { key: 'count_abonents_tetra', label: 'Количество абонентов Tetra' },
                { key: 'population_percent_tetra', label: 'Процент охвата населения Tetra' },
                { key: 'communication_coverage_tetra', label: 'Покрытие связи Tetra' },
                { key: 'communication_coverage_percent_tetra', label: 'Процент покрытия связи Tetra' },
                { key: 'traffic_tetra', label: 'Объем трафика Tetra' },
                { key: 'traffic_percent_tetra', label: 'Процент трафика Tetra' },
                { key: 'count_operators_tetra', label: 'Количество операторов Tetra' },
                { key: 'rating_tetra', label: 'Оценка Tetra' }
            ]
        },
        {
            title: 'Спутниковая связь (КА)',
            fields: [
                { key: 'count_satellites', label: 'Количество КА' },
                { key: 'count_abonents_satellites', label: 'Количество абонентов КА' },
                { key: 'population_percent_satellites', label: 'Процент охвата населения КА' },
                { key: 'communication_coverage_satellites', label: 'Покрытие КА' },
                { key: 'communication_coverage_percent_satellites', label: 'Процент покрытия КА' },
                { key: 'traffic_satellites', label: 'Объем трафика КА' },
                { key: 'traffic_percent_satellites', label: 'Процент трафика КА' },
                { key: 'count_operators_satellites', label: 'Количество операторов КА' },
                { key: 'operators_percent_satellites', label: 'Процент операторов КА' },
                { key: 'rating_satellites', label: 'Оценка КА' }
            ]
        },
        {
            title: 'Телевидение (ТВ)',
            fields: [
                { key: 'count_res_tv', label: 'Количество БС ТВ' },
                { key: 'percent_res_tv', label: 'Процент БС ТВ' },
                { key: 'count_channels_tv', label: 'Количество каналов ТВ' },
                { key: 'communication_coverage_tv', label: 'Покрытие связи ТВ' },
                { key: 'communication_coverage_percent_tv', label: 'Процент покрытия связи ТВ' },
                { key: 'count_operators_tv', label: 'Количество операторов ТВ' },
                { key: 'operators_percent_tv', label: 'Процент операторов ТВ' },
                { key: 'rating_tv', label: 'Оценка ТВ' }
            ]
        },
        {
            title: 'Радиовещание (РВ)',
            fields: [
                { key: 'count_res_rv', label: 'Количество БС РВ' },
                { key: 'percent_res_rv', label: 'Процент БС РВ' },
                { key: 'frequency_width_rv', label: 'Общая ширина полосы РВ, МГц' },
                { key: 'count_channels_rv', label: 'Количество каналов РВ' },
                { key: 'communication_coverage_rv', label: 'Покрытие связи РВ' },
                { key: 'communication_coverage_percent_rv', label: 'Процент покрытия связи РВ' },
                { key: 'count_operators_rv', label: 'Количество операторов РВ' },
                { key: 'operators_percent_rv', label: 'Процент операторов РВ' },
                { key: 'rating_rv', label: 'Оценка РВ' }
            ]
        },
        {
            title: 'Универсальные услуги (УС)',
            fields: [
                { key: 'count_comm_hubs', label: 'Количество узлов связи' },
                { key: 'count_abonents_comm_hubs', label: 'Количество абонентов узлов связи' },
                { key: 'population_percent_comm_hubs', label: 'Процент охвата населения узлов связи' },
                { key: 'communication_coverage_comm_hubs', label: 'Покрытие узлов связи' },
                { key: 'communication_coverage_percent_comm_hubs', label: 'Процент покрытия узлов связи' },
                { key: 'traffic_comm_hubs', label: 'Объем трафика узлов связи' },
                { key: 'traffic_percent_comm_hubs', label: 'Процент трафика узлов связи' },
                { key: 'count_operators_comm_hubs', label: 'Количество операторов узлов связи' },
                { key: 'operators_percent_comm_hubs', label: 'Процент операторов узлов связи' },
                { key: 'rating_comm_hubs', label: 'Оценка узлов связи' }
            ]
        },
        {
            title: 'Почтовая связь',
            fields: [
                { key: 'count_posts', label: 'Количество почтовых отделений' },
                { key: 'count_abonents_posts', label: 'Количество абонентов почтовых отделений' },
                { key: 'population_percent_posts', label: 'Процент охвата населения почтовых отделений' },
                { key: 'communication_coverage_posts', label: 'Покрытие почтовых отделений' },
                { key: 'communication_coverage_percent_posts', label: 'Процент покрытия почтовых отделений' },
                { key: 'traffic_posts', label: 'Объем трафика почтовых отделений' },
                { key: 'traffic_percent_posts', label: 'Процент трафика почтовых отделений' },
                { key: 'count_operators_posts', label: 'Количество операторов почтовых отделений' },
                { key: 'operators_percent_posts', label: 'Процент операторов почтовых отделений' },
                { key: 'rating_posts', label: 'Оценка почтовых отделений' }
            ]
        },
        {
            title: 'ВОЛС',
            fields: [
                { key: 'count_focl', label: 'Количество ВОЛС' },
                { key: 'count_abonents_focl', label: 'Количество абонентов ВОЛС' },
                { key: 'population_percent_focl', label: 'Процент охвата населения ВОЛС' },
                { key: 'communication_coverage_focl', label: 'Покрытие ВОЛС' },
                { key: 'communication_coverage_percent_focl', label: 'Процент покрытия ВОЛС' },
                { key: 'traffic_focl', label: 'Объем трафика ВОЛС' },
                { key: 'traffic_percent_focl', label: 'Процент трафика ВОЛС' },
                { key: 'count_operators_focl', label: 'Количество операторов ВОЛС' },
                { key: 'operators_percent_focl', label: 'Процент операторов ВОЛС' },
                { key: 'rating_focl', label: 'Оценка ВОЛС' }
            ]
        },
        {
            title: 'Таксофоны',
            fields: [
                { key: 'count_payphones', label: 'Количество таксофонов' },
                { key: 'count_abonents_payphones', label: 'Количество абонентов таксофонов' },
                { key: 'population_percent_payphones', label: 'Процент охвата населения таксофонами' },
                { key: 'communication_coverage_payphones', label: 'Покрытие таксофонов' },
                { key: 'communication_coverage_percent_payphones', label: 'Процент покрытия таксофонов' },
                { key: 'traffic_payphones', label: 'Объем трафика таксофонов' },
                { key: 'traffic_percent_payphones', label: 'Процент трафика таксофонов' },
                { key: 'count_operators_payphones', label: 'Количество операторов таксофонов' },
                { key: 'operators_percent_payphones', label: 'Процент операторов таксофонов' },
                { key: 'rating_payphones', label: 'Оценка таксофонов' }
            ]
        }
    ];
}

// ==================== КНОПКИ ====================

function createCalculateAllBtn() {
    let existing = document.getElementById('calculate-all-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'calculate-all-btn';
    btn.className = 'grid-btn calculate-all-btn';
    btn.textContent = 'Рассчитать обеспеченность всех НП в таблице';
    btn.style.marginRight = '10px';
    btn.style.width = 'auto';
    btn.addEventListener('click', handleCalculateAll);
    return btn;
}

function showCalculateAllButton() {
    const container = document.querySelector('.table_buttons');
    if (!container) return;

    if (!showRatings || isChartMode || isAnalyticsMode) {
        hideCalculateAllButton();
        return;
    }

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
    btn.textContent = 'Рассчитать обеспеченность выбранного НП';
    btn.style.marginRight = '10px';
    btn.style.width = 'auto';
    btn.addEventListener('click', handleCalculateSelected);
    return btn;
}

function showCalculateSelectedButton() {
    const container = document.querySelector('.table_buttons');
    if (!container) return;

    if (!showRatings || !selectedSettlementId || isChartMode || isAnalyticsMode) {
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
    btn.textContent = 'БС';
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

    // Удаляем контролы формата, так как мы не в графике
    const formatGroup = document.getElementById('format-controls-group');
    if (formatGroup) formatGroup.remove();

    if (isChartMode || isAnalyticsMode) {
        hideSettlementButtons();
        return;
    }

    ['res-action-btn', 'wired-action-btn', 'calculate-all-btn', 'calculate-selected-btn']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

    const resBtn = createResButton();

    const firstBtn = container.querySelector('.grid-btn');
    if (firstBtn) {
        container.insertBefore(resBtn, firstBtn);
    } else {
        container.appendChild(resBtn);
    }

    if (!showRatings) {
        const wiredBtn = createWiredButton();
        const resBtnNow = document.getElementById('res-action-btn');
        if (resBtnNow) {
            container.insertBefore(wiredBtn, resBtnNow.nextSibling);
        } else {
            container.appendChild(wiredBtn);
        }
    }

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
        if (!select) return [];

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
        const idNpParam = urlParams.get('id_np');

        // Приоритет: URL → localStorage → дефолт (29)
        let regionIds = null;
        if (regionsParam) {
            regionIds = regionsParam.split(',').map(id => id.trim()).filter(Boolean);
            lsSet(LS_KEYS.regions, regionsParam);
        } else {
            const stored = lsGet(LS_KEYS.regions, DEFAULT_REGION);
            regionIds = stored
                ? String(stored).split(',').map(id => id.trim()).filter(Boolean)
                : [DEFAULT_REGION];
        }

        if (idNpParam) {
            lsSet(LS_KEYS.idNp, idNpParam);
        }

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

        // Fallback: дефолтный регион 29
        if (foundCount === 0) {
            allOptions.forEach(opt => {
                if (String(opt.value).trim() === DEFAULT_REGION) {
                    opt.selected = true;
                    foundCount++;
                }
            });
        }

        // Если и 29 нет в списке — только тогда 'all'
        if (foundCount === 0) {
            const allOpt = select.querySelector('option[value="all"]');
            if (allOpt) allOpt.selected = true;
        }

        // Синхронизируем localStorage с тем, что реально выбрано
        persistSelectedRegions();

        loader.close();
        return regions;
    } catch (error) {
        loader.close();
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
        const val = String(selectedOptions[i].value).trim();
        if (val === 'all') {
            const allOptions = regionSelect.querySelectorAll('option');
            const allIds = [];
            allOptions.forEach(opt => {
                const optVal = String(opt.value).trim();
                if (optVal !== 'all' && optVal) {
                    allIds.push(optVal);
                }
            });
            // Если реальных регионов нет — вернётся [] (не 'all'!)
            return allIds;
        }
        if (val) values.push(val);
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

    // «Все НП» — без фильтра по численности
    if (radioAll && radioAll.checked) {
        return null;
    }

    if (radioRange && radioRange.checked) {
        const from = parseInt(fromInput?.value) || 1;
        const to = parseInt(toInput?.value) || 17000000;
        return { from, to };
    }

    // По умолчанию — без фильтра
    return null;
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
        'count_satellites', 'count_abonents_satellites',
        'population_percent_satellites', 'communication_coverage_satellites',
        'communication_coverage_percent_satellites', 'traffic_satellites',
        'traffic_percent_satellites', 'count_operators_satellites',
        'operators_percent_satellites', 'rating_satellites',
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
            population_filters: popRange
                ? [{ from: popRange.from, to: popRange.to }]
                : []
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
        console.error('Ошибка загрузки населенных пунктов:', error);
        return { items: [], total: 0 };
    }
}

// ==================== ЗАГРУЗКА обеспеченности ====================

async function loadRatingsForSettlements(items, allowPost = false) {
    const total = items.length;
    if (total === 0) return;

    const bulkRatings = await loadRatingsBulk(currentRegions, currentPopRange);

    Object.keys(bulkRatings).forEach(id => {
        allRatings[id] = bulkRatings[id];
    });

    if (allowPost) {
        const missing = items.filter(it => !allRatings[String(it.id)]);
        if (missing.length === 0) return;

        const modal = createProgressModal(missing.length);
        const titleEl = modal.querySelector('.progress-modal-title');
        if (titleEl) titleEl.textContent = 'Расчет обеспеченности';

        isCancelled = false;
        let processed = 0;
        let successCount = 0;

        for (const settlement of missing) {
            if (isCancelled) {
                closeProgressModal();
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
        'count_satellites', 'count_abonents_satellites',
        'population_percent_satellites', 'communication_coverage_satellites',
        'communication_coverage_percent_satellites', 'traffic_satellites',
        'traffic_percent_satellites', 'count_operators_satellites',
        'operators_percent_satellites', 'rating_satellites',
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

// ==================== РАСЧЕТ обеспеченностьА ====================

async function handleCalculateSelected() {
    if (!selectedSettlementId) return;

    const loader = initLoader();
    loader.show(`Расчет обеспеченностьа для НП: ${selectedSettlementName || selectedSettlementId}...`);

    try {
        await postRatingSett(selectedSettlementId);

        const bulkRatings = await loadRatingsBulk(currentRegions, currentPopRange);
        Object.keys(bulkRatings).forEach(id => {
            allRatings[id] = bulkRatings[id];
        });

        loader.close();

        const pageSize = getPageSize('settlements');

        if (savedFilterField && savedFilterValue) {
            renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
        } else {
            renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
        }
    } catch (error) {
        loader.close();
        console.error('Ошибка расчета обеспеченностьа:', error);
    }
}

async function handleCalculateAll() {
    const items = currentSettlementsFiltered || settlementsData.items || [];

    if (items.length === 0) return;

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
        const pageSize = getPageSize('settlements');
        if (savedFilterField && savedFilterValue) {
            renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
        } else {
            renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
        }
        return;
    }

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
                if (th.textContent.includes('БС') || th.textContent.includes('Количество БС') || th.textContent.includes('обеспеченность')) {
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

                openEditModal(id, 'settlement', 'settlements');
            }
        });
    }

    document.addEventListener('dblclick', function(e) {
        const table = document.getElementById('settlements-table');
        if (!table) return;

        const headerCells = table.querySelectorAll('thead th');
        let hasRatingColumns = false;
        headerCells.forEach(th => {
            if (th.textContent.includes('БС') || th.textContent.includes('Количество БС') || th.textContent.includes('обеспеченность')) {
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

        openEditModal(row.dataset.id, 'rating', 'rating');
    });
}

// ==================== ЛОКАЛЬНОЕ ОБНОВЛЕНИЕ ДАННЫХ ====================

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
                    const num = Number(newValue);
                    newValue = Number.isInteger(num) ? num : Math.round(num);
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
                const num = Number(newValue);
                newValue = Number.isInteger(num) ? num : Math.round(num);
            }

            rating[objKey] = newValue;
        });
    }
}

function refreshCurrentView(settlementId) {
    if (isAnalyticsMode) {
        renderAnalyticsDashboard();
        return;
    }

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

async function handleRatingChartButton() {
    const ok = await loadRatingsData();
    if (!ok) return;

    // Восстанавливаем selectedSettlement* из LS (нужно до построения графика)
    if (!selectedSettlementId) {
        restoreSelectedFromStorage();
    }

    switchToChartMode();

    const chartRadio = document.querySelector('input[name="view-mode"][value="chart"]');
    if (chartRadio) chartRadio.checked = true;

    showSelectedSettlementBlock();

    // Восстановить выделение + тултип после пересоздания графика
    if (selectedSettlementId) {
        setTimeout(() => restoreSelectionById(), 200);
    }
}

async function handleRatingTableButton() {
    const ok = await loadRatingsData();
    if (!ok) return;

    const pageSize = getPageSize('settlements');
    renderCombinedTable(originalDataForFilter, originalTotalForFilter, 0, pageSize, false);

    showSettlementButtons();

    const tableRadio = document.querySelector('input[name="view-mode"][value="table"]');
    if (tableRadio) tableRadio.checked = true;

    showSelectedSettlementBlock();

    // Сбрасываем UI графика (формат + тултип)
    resetChartUIState();

    // Восстанавливаем selectedSettlement* из LS, если после диаграммы был сброшен
    if (!selectedSettlementId) {
        restoreSelectedFromStorage();
    }

    // Синхронизируем выделение строки с сохранённым НП
    if (selectedSettlementId) {
        const item = settlementsData.items.find(
            it => String(it.id) === String(selectedSettlementId)
        );
        if (item) {
            setSelectedSettlement(item, 'table');
        } else {
            const nameEl = document.getElementById('selected-settlement-name');
            if (nameEl) {
                nameEl.textContent = selectedSettlementName || `ID: ${selectedSettlementId}`;
            }
        }
    }
}

// ==================== Диаграмма обеспеченности НП ====================

async function handleAnalyticsDashboardButton() {
    const ok = await loadRatingsData();
    if (!ok) return;

    // Восстанавливаем selectedSettlement* из LS перед переключением
    restoreSelectedFromStorage();

    switchToAnalyticsMode();

    const radio = document.querySelector('input[name="view-mode"][value="analytics"]');
    if (radio) radio.checked = true;
}

function destroyAnalyticsDashboard() {
    document.body.classList.remove('analytics-mode');

    const dashboard = document.getElementById('analytics-dashboard');
    if (dashboard) dashboard.remove();

    if (analyticsChart) {
        analyticsChart.destroy();
        analyticsChart = null;
    }
    if (analyticsBarServices) {
        analyticsBarServices.destroy();
        analyticsBarServices = null;
    }
    if (analyticsBarMobile) {
        analyticsBarMobile.destroy();
        analyticsBarMobile = null;
    }
    isAnalyticsMode = false;
}
function switchToAnalyticsMode() {
    hideChartContainer();
    if (ratingChart) {
        ratingChart.destroy();
        ratingChart = null;
    }
    isChartMode = false;

    document.body.classList.add('analytics-mode');

    const table = document.getElementById('settlements-table');
    if (table) table.style.display = 'none';

    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();

    const formatGroup = document.getElementById('format-controls-group');
    if (formatGroup) formatGroup.remove();

    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) filterContainer.remove();

    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    const paginationContainer = document.getElementById('settlements-pagination');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
        paginationContainer.innerHTML = '';
    }

    // Гарантируем, что id_np в LS актуален
    if (selectedSettlementId) {
        persistSelectedIdNp(selectedSettlementId);
    }

    resetAndHideSelectedSettlement();

    isAnalyticsMode = true;
    renderAnalyticsDashboard();
}



// ==================== МОДАЛКА РЕДАКТИРОВАНИЯ ====================
function renderAnalyticsDashboard() {
    const placeholder = document.getElementById('placeholder-message');
    if (placeholder) placeholder.style.display = 'none';

    destroyAnalyticsDashboard();
    isAnalyticsMode = true;
    document.body.classList.add('analytics-mode');

    const dashboard = document.createElement('div');
    dashboard.id = 'analytics-dashboard';

    // ==================== ЗАГОЛОВОК ====================
    const headerBlock = document.createElement('div');
    headerBlock.className = 'analytics-header';

    const title = document.createElement('div');
    title.className = 'analytics-title';
    title.textContent = 'Диаграмма обеспеченности НП региона';

    const regionsSubtitle = document.createElement('div');
    regionsSubtitle.className = 'analytics-subtitle';
    const regionNames = currentRegions.map(r => {
        const opt = document.querySelector(`#region option[value="${r}"]`);
        return opt ? opt.textContent : r;
    });
    regionsSubtitle.textContent = regionNames.length > 0
        ? `Регион(ы): ${regionNames.join(', ')}`
        : 'Регион(ы): не выбраны';

    headerBlock.appendChild(title);
    headerBlock.appendChild(regionsSubtitle);
    dashboard.appendChild(headerBlock);

    // ==================== ПОДГОТОВКА ДАННЫХ ====================
    const radioAll = document.getElementById('number-settlements');
    const fromInput = document.getElementById('numbers-settlement');
    const toInput = document.getElementById('numbers-settlements');

    const isAllPop = !!(radioAll && radioAll.checked);
    const popFrom = isAllPop ? 1 : (parseInt(fromInput?.value) || 1);
    const popTo = isAllPop ? 17000000 : (parseInt(toInput?.value) || 17000000);

    const items = settlementsData.items || [];
    const totalCount = items.length;

    let totalPopulation = 0;
    let sumRating = 0;
    let ratingCount = 0;

    items.forEach(item => {
        const pop = Number(item.population) || 0;
        if (pop >= popFrom && pop <= popTo) {
            totalPopulation += pop;
        }

        const r = allRatings[String(item.id)];
        if (r && r.rating !== undefined && r.rating !== null && !isNaN(r.rating)) {
            sumRating += Number(r.rating);
            ratingCount++;
        }
    });

    const avgRating = ratingCount > 0 ? sumRating / ratingCount : 0;
    const avgDeficit = ratingCount > 0 ? 100 - avgRating : 0;

    // ==================== КАРТОЧКИ KPI ====================
    const cardsRow = document.createElement('div');
    cardsRow.className = 'kpi-cards-row';

    const makeCard = (label, value, color) => {
        const card = document.createElement('div');
        card.className = 'kpi-card';
        card.style.setProperty('--kpi-color', color);

        const valEl = document.createElement('div');
        valEl.className = 'kpi-card__value';
        if (label === 'Средняя обеспеченность' || label === 'Средний дефицит') {
            valEl.textContent = `${value} %`;
        } else {
            valEl.textContent = value;
        }

        const lblEl = document.createElement('div');
        lblEl.className = 'kpi-card__label';
        lblEl.textContent = label;

        card.appendChild(valEl);
        card.appendChild(lblEl);
        return card;
    };

    cardsRow.appendChild(makeCard('Количество НП', totalCount.toLocaleString('ru-RU'), '#0066ff'));
    cardsRow.appendChild(makeCard('Численность населения', isAllPop
        ? 'Все НП'
        : `${popFrom.toLocaleString('ru-RU')}–${popTo.toLocaleString('ru-RU')}`, '#4c00a8'));
    cardsRow.appendChild(makeCard('Средняя обеспеченность', avgRating.toFixed(2), '#43A047'));
    cardsRow.appendChild(makeCard('Средний дефицит', avgDeficit.toFixed(2), '#cc0000'));

    dashboard.appendChild(cardsRow);

    // ==================== ОТДЕЛЬНЫЙ БЛОК ДЛЯ ДИАГРАММ ====================
    const chartsScroll = document.createElement('div');
    chartsScroll.className = 'analytics-charts-scroll';

    const chartsRow = document.createElement('div');
    chartsRow.className = 'analytics-charts-row analytics-charts-row--scroll';

    chartsScroll.appendChild(chartsRow);

    const makeChartBlock = (titleText, canvasId) => {
        const block = document.createElement('div');
        block.className = 'analytics-chart-block analytics-chart-block--min';

        const t = document.createElement('div');
        t.className = 'analytics-chart-block__title';
        t.textContent = titleText;
        block.appendChild(t);

        const wrap = document.createElement('div');
        wrap.className = 'analytics-chart-block__canvas-wrap';

        const canvas = document.createElement('canvas');
        canvas.id = canvasId;
        wrap.appendChild(canvas);
        block.appendChild(wrap);

        return { block, canvas, wrap };
    };

    const pieBlock = makeChartBlock(
        'Количество НП по категориям обеспеченности',
        'analytics-pie-chart'
    );
    const bar1Block = makeChartBlock(
        'Средняя обеспеченность НП по видам связи',
        'analytics-bar-services'
    );
    const bar2Block = makeChartBlock(
        'Средняя обеспеченность НП услугами мобильной связи',
        'analytics-bar-mobile'
    );

    chartsRow.appendChild(pieBlock.block);
    chartsRow.appendChild(bar1Block.block);
    chartsRow.appendChild(bar2Block.block);

    dashboard.appendChild(chartsScroll);

    // ==================== ВСТАВКА В DOM ====================
    const tableContainer = document.querySelector('.table__rating');
    const buttonsBlock = tableContainer ? tableContainer.querySelector('.table_buttons') : null;
    if (tableContainer) {
        if (buttonsBlock) {
            tableContainer.insertBefore(dashboard, buttonsBlock);
        } else {
            tableContainer.appendChild(dashboard);
        }
    }

    const canvasPie = pieBlock.canvas;
    const canvas1 = bar1Block.canvas;
    const canvas2 = bar2Block.canvas;

    // ==================== ДАННЫЕ ДЛЯ КРУГОВОЙ ====================
    // ==================== ДАННЫЕ ДЛЯ КРУГОВОЙ ====================
    const categories = [
        { label: '0-20',   min: 0,   max: 20,  count: 0, color: '#f57c00' },
        { label: '21-40',  min: 21,  max: 40,  count: 0, color: '#5FF1FF' },
        { label: '41-60',  min: 41,  max: 60,  count: 0, color: '#005BFB' },
        { label: '61-80',  min: 61,  max: 80,  count: 0, color: '#69F034' },
        { label: '81-100', min: 81,  max: 100, count: 0, color: '#0F8A0B' },
    ];

    items.forEach(item => {
        const r = allRatings[String(item.id)];
        if (!r || r.rating === undefined || r.rating === null || isNaN(r.rating)) return;
        const val = Number(r.rating);
        const cat = categories.find(c => val >= c.min && val <= c.max);
        if (cat) cat.count++;
    });

    const denom = totalCount > 0 ? totalCount : 1;
    const categoriesDisplay = [...categories].reverse();

    const ctxPie = canvasPie.getContext('2d');
    analyticsChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: categories.map(c => c.label),
            datasets: [{
                data: categories.map(c => c.count),
                backgroundColor: categories.map(c => c.color),
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 10,
                hoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '50%',
            layout: { padding: { top: 4, bottom: 4, left: 4, right: 4 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#bdbdbd',
                    titleColor: '#000000',
                    bodyColor: '#000000',
                    borderColor: '#ffffff',
                    borderWidth: 0,
                    bodyFont: { size: 13, weight: 'bold' },
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed;
                            const percent = denom > 0 ? ((val / denom) * 100).toFixed(2) : '0.00';
                            return ` ${context.label}: ${val} НП (${percent.replace('.', ',')}%)`;
                        }
                    }
                }
            }
        }
    });

    // ==================== HTML-ТАБЛИЦА ВМЕСТО ЛЕГЕНДЫ ====================
    (function renderPieTable() {
        const oldTable = pieBlock.block.querySelector('.pie-stats-table');
        if (oldTable) oldTable.remove();

        const table = document.createElement('table');
        table.className = 'pie-stats-table';

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        const headers = [
            { text: 'Цвет',      width: '12%' },
            { text: 'Об., %',    width: '26%' },
            { text: 'Кол-во НП', width: '26%' },
            { text: '% НП',      width: '36%' }
        ];
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h.text;
            th.style.width = h.width;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        categoriesDisplay.forEach(cat => {
            const tr = document.createElement('tr');

            const tdColor = document.createElement('td');
            const dot = document.createElement('span');
            dot.className = 'pie-stats-table__dot';
            dot.style.background = cat.color;
            tdColor.appendChild(dot);
            tr.appendChild(tdColor);

            const tdRange = document.createElement('td');
            tdRange.textContent = cat.label;
            tr.appendChild(tdRange);

            const tdCount = document.createElement('td');
            tdCount.textContent = cat.count;
            tr.appendChild(tdCount);

            const percent = (cat.count / denom) * 100;
            const tdPercent = document.createElement('td');
            tdPercent.textContent = percent.toFixed(2).replace('.', ',') + ' %';
            tr.appendChild(tdPercent);

            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        pieBlock.block.appendChild(table);
    })();

    // ==================== ДИАГРАММА 2: услуги связи ====================
    const serviceGroups = [
        { key: 'rating_mobile', label: 'Моб. связь' },
        { key: 'rating_wifi',   label: 'ШПД(Wi-Fi)' },
        { key: 'rating_tv',     label: 'ТВ' },
        { key: 'rating_rv',     label: 'РВ' },
        { key: 'rating_satellites', label: 'Спутниковая связь' },
        { keys: ['rating_focl', 'rating_payphones'], label: 'Проводная связь' },
        { key: 'rating_posts',  label: 'Почтовая связь' }
    ];

    const serviceStats = serviceGroups.map(g => {
        let sum = 0, cnt = 0;

        items.forEach(item => {
            const r = allRatings[String(item.id)];
            if (!r) return;

            if (g.keys && g.keys.length > 0) {
                let localSum = 0, localCnt = 0;
                g.keys.forEach(k => {
                    const raw = r[k];
                    if (raw === undefined || raw === null) return;
                    const v = Number(raw);
                    if (!isNaN(v)) {
                        localSum += v;
                        localCnt++;
                    }
                });
                if (localCnt > 0) {
                    sum += localSum / localCnt;
                    cnt++;
                }
            } else {
                const raw = r[g.key];
                if (raw === undefined || raw === null) return;
                const v = Number(raw);
                if (!isNaN(v)) {
                    sum += v;
                    cnt++;
                }
            }
        });

        const avg = cnt > 0 ? sum / cnt : 0;
        return {
            label: g.label,
            provided: +avg.toFixed(2),
            deficit: +(100 - avg).toFixed(2)
        };
    });

    const FIXED_X_AXIS_HEIGHT = 110;

    const commonBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, bottom: 0 } },
        scales: {
            x: {
                stacked: true,
                border: { display: false },
                ticks: {
                    color: '#000',
                    font: { size: 12, weight: 'bold' },
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: false,
                    padding: 8
                },
                grid: { display: false },
                afterFit(scale) {
                    scale.height = FIXED_X_AXIS_HEIGHT;
                }
            },
            y: {
                stacked: true,
                beginAtZero: true,
                min: 0,
                max: 100,
                border: { display: false },
                ticks: {
                    stepSize: 20,
                    color: '#000',
                    font: { size: 12, weight: 'bold' },
                    callback: function(value) { return value + '%'; }
                },
                grid: { color: 'rgba(0,0,0,0.08)' },
                title: {
                    display: true,
                    text: 'Обеспеченность,%',
                    color: '#000',
                    font: { size: 13, weight: 'bold' }
                }
            }
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: { size: 14, weight: 'bold' },
                    color: '#000',
                    boxWidth: 16,
                    boxHeight: 16,
                    padding: 10
                }
            },
            tooltip: {
                backgroundColor: '#bdbdbd',
                titleColor: '#000',
                bodyColor: '#000',
                borderColor: '#ffffff',
                borderWidth: 0,
                callbacks: {
                    label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} %`
                }
            }
        }
    };

    const ctx1 = canvas1.getContext('2d');
    analyticsBarServices = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: serviceStats.map(s => s.label),
            datasets: [
                {
                    label: 'Обеспеченность,%',
                    data: serviceStats.map(s => s.provided),
                    backgroundColor: '#1a73e8',
                    borderColor: '#1a73e8',
                    borderWidth: 0,
                    stack: 'total'
                },
                {
                    label: 'Дефицит,%',
                    data: serviceStats.map(s => s.deficit),
                    backgroundColor: '#ff6a00',
                    borderColor: '#ff6a00',
                    borderWidth: 0,
                    stack: 'total'
                }
            ]
        },
        options: commonBarOptions
    });

    // ==================== ДИАГРАММА 3: моб. связь ====================
    const mobileGroups = [
        { key: 'rating_5g',    label: '5G' },
        { key: 'rating_lte',   label: 'LTE' },
        { key: 'rating_gsm',   label: 'GSM' },
        { key: 'rating_tetra', label: 'Tetra' }
    ];

    const mobileStats = mobileGroups.map(g => {
        let sum = 0, cnt = 0;
        items.forEach(item => {
            const r = allRatings[String(item.id)];
            if (!r) return;
            const raw = r[g.key];
            if (raw === undefined || raw === null) return;
            const v = Number(raw);
            if (!isNaN(v)) {
                sum += v;
                cnt++;
            }
        });
        const avg = cnt > 0 ? sum / cnt : 0;
        return {
            label: g.label,
            provided: +avg.toFixed(2),
            deficit: +(100 - avg).toFixed(2)
        };
    });

    const ctx2 = canvas2.getContext('2d');
    analyticsBarMobile = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: mobileStats.map(s => s.label),
            datasets: [
                {
                    label: 'Обеспеченность,%',
                    data: mobileStats.map(s => s.provided),
                    backgroundColor: '#1a73e8',
                    borderColor: '#1a73e8',
                    borderWidth: 0,
                    stack: 'total'
                },
                {
                    label: 'Дефицит,%',
                    data: mobileStats.map(s => s.deficit),
                    backgroundColor: '#ff6a00',
                    borderColor: '#ff6a00',
                    borderWidth: 0,
                    stack: 'total'
                }
            ]
        },
        options: commonBarOptions
    });
}
async function openEditModal(settlementId, type, tableMode = 'auto') {
    if (!settlementId) return;

    await loadTableStructures();

    const settlement = settlementsData.items.find(it => String(it.id) === String(settlementId)) || {};
    const ranking = allRatings[String(settlementId)] || {};

    // Определяем, какие поля показывать
    // 'settlements' — только базовые поля НП
    // 'rating' — базовые поля НП + поля рейтинга из шапки таблицы (БЕЗ buildRatingGroups)
    // 'auto' — старое поведение (всё)
    let allowedTables = [];
    let allowExtraRatingFields = false;

    if (tableMode === 'settlements') {
        allowedTables = ['settlements'];
    } else if (tableMode === 'rating') {
        allowedTables = ['settlements', 'ranking']; // Разрешаем и НП, и рейтинг
        allowExtraRatingFields = false;             // Но НЕ докидываем всё из buildRatingGroups
    } else {
        allowedTables = ['settlements', 'ranking'];
        allowExtraRatingFields = true;
    }

    const getColumnOrderFromTable = (tableSelector) => {
        const order = [];
        const table = document.querySelector(tableSelector);
        if (!table) return order;
        table.querySelectorAll('thead th').forEach(th => {
            const key = th.dataset.key;
            if (key) order.push(key);
        });
        return order;
    };

    const tableHeaderOrder = getColumnOrderFromTable('#settlements-table');

    const settlementsDbToKey = SETTLEMENTS_DB_TO_OBJECT_KEY;
    const rankingDbToKey = RANKING_DB_TO_OBJECT_KEY;

    const settlementsKeyToDb = {};
    Object.keys(settlementsDbToKey).forEach(db => { settlementsKeyToDb[settlementsDbToKey[db]] = db; });
    const rankingKeyToDb = {};
    Object.keys(rankingDbToKey).forEach(db => { rankingKeyToDb[rankingDbToKey[db]] = db; });

    const settlementsLabelByKey = {};
    Object.keys(SETTLEMENTS_COLUMN_LABELS).forEach(db => {
        const key = settlementsDbToKey[db] || db;
        settlementsLabelByKey[key] = SETTLEMENTS_COLUMN_LABELS[db];
    });
    const rankingLabelByKey = {};
    Object.keys(RANKING_COLUMN_LABELS).forEach(db => {
        const key = rankingDbToKey[db] || db;
        rankingLabelByKey[key] = RANKING_COLUMN_LABELS[db];
    });

    const orderedFields = [];
    const seen = new Set();

    // 1. Берем поля из шапки таблицы
    tableHeaderOrder.forEach(key => {
        if (seen.has(key)) return;
        seen.add(key);

        if (rankingKeyToDb[key]) {
            if (!allowedTables.includes('ranking')) return;
            const dbColumn = rankingKeyToDb[key];
            if (dbColumn === 'ID') return; // ID не дублируем
            orderedFields.push({
                table: 'ranking', dbColumn, objectKey: key,
                label: rankingLabelByKey[key] || dbColumn,
                value: getValueByDbColumn(ranking, dbColumn, rankingDbToKey)
            });
            return;
        }

        if (settlementsKeyToDb[key]) {
            if (!allowedTables.includes('settlements')) return;
            const dbColumn = settlementsKeyToDb[key];
            orderedFields.push({
                table: 'settlements', dbColumn, objectKey: key,
                label: settlementsLabelByKey[key] || dbColumn,
                value: getValueByDbColumn(settlement, dbColumn, settlementsDbToKey)
            });
            return;
        }

        if (key === 'rating') {
            if (!allowedTables.includes('ranking')) return;
            orderedFields.push({
                table: 'ranking', dbColumn: 'RAT_SUM_NP', objectKey: 'rating',
                label: 'Обеспеченность',
                value: getValueByDbColumn(ranking, 'RAT_SUM_NP', rankingDbToKey)
            });
        }
    });

    // 2. Добор полей из buildRatingGroups (только для 'auto')
    if (allowExtraRatingFields) {
        const allGroups = buildRatingGroups();
        allGroups.forEach(group => {
            group.fields.forEach(f => {
                if (seen.has(f.key)) return;
                const dbColumn = rankingKeyToDb[f.key];
                if (!dbColumn) return;
                seen.add(f.key);
                orderedFields.push({
                    table: 'ranking', dbColumn, objectKey: f.key,
                    label: f.label,
                    value: getValueByDbColumn(ranking, dbColumn, rankingDbToKey)
                });
            });
        });
    }

    const existing = document.getElementById('row-data-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'row-data-modal';
    modal.className = 'res-modal-overlay';

    const content = document.createElement('div');
    content.className = 'res-modal-content';
    content.style.maxWidth = '800px';

    const nameForTitle = settlement['name'] || settlement['NAME'] || settlementId;
    const titleText = (type === 'rating')
        ? `Обеспеченность НП: ${nameForTitle}`
        : `НП: ${nameForTitle}`;

    const title = document.createElement('h3');
    title.textContent = titleText;
    title.className = 'res-modal-title';

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'res-table-wrapper';
    tableWrapper.style.maxHeight = '65vh';
    tableWrapper.style.overflowY = 'auto';
    tableWrapper.style.position = 'relative';

    const table = document.createElement('table');
    table.className = 'res-modal-table edit-modal-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'separate';
    table.style.borderSpacing = '0';

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    const fieldRefs = [];

    orderedFields.forEach(field => {
        const tr = document.createElement('tr');

        const th = document.createElement('th');
        th.textContent = field.label;

        const td = document.createElement('td');

        if (field.dbColumn === 'ID') {
            td.textContent = field.value !== '' ? field.value : '-';
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = field.value;
            input.dataset.dbColumn = field.dbColumn;
            input.dataset.tableName = field.table;
            input.className = 'edit-modal-input';
            td.appendChild(input);
            fieldRefs.push({
                table: field.table,
                dbColumn: field.dbColumn,
                input,
                originalValue: String(field.value)
            });
        }

        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
    });

    const buttonsBar = document.createElement('div');
    buttonsBar.className = 'edit-modal-buttons';

    const detailBtn = document.createElement('button');
    detailBtn.textContent = 'Детализация обеспеченности НП';
    detailBtn.className = 'res-modal-close-btn';
    detailBtn.style.background = '#0066ff';
    detailBtn.style.color = '#fff';
    detailBtn.style.border = '1.5px solid #000';
    detailBtn.addEventListener('click', () => {
        const id = settlementId !== undefined && settlementId !== null ? settlementId : null;
        if (!id) return;
        window.open(`http://185.192.247.60:9105/ns/${encodeURIComponent(id)}`, '_blank');
    });

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Сохранить изменения';
    editBtn.className = 'res-modal-close-btn';
    editBtn.style.background = '#0066ff';
    editBtn.style.color = '#fff';
    editBtn.addEventListener('click', async () => { await handleEditRow(fieldRefs, settlementId, modal); });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.className = 'res-modal-close-btn';
    closeBtn.addEventListener('click', () => modal.remove());

    buttonsBar.appendChild(detailBtn);
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
        return;
    }

    const loader = initLoader();
    loader.show('Сохранение изменений...');

    try {
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
    } catch (e) {
        loader.close();
        console.error('Ошибка сохранения изменений:', e);
    }
}

// ==================== ОТОБРАЖЕНИЕ ТАБЛИЦЫ (только НП) ====================

function renderSettlementsTableOnly(data, total, page, pageSize, keepFilter = false) {
    destroyAnalyticsDashboard();

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

                onTableRowSelected(this);

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

    // ВЫБОР НАЧАЛЬНОЙ СТРОКИ: сохранённый id_np (с автопереходом на нужную страницу),
    // иначе — первая
    if (pageData && pageData.length > 0) {
        selectInitialRowInTable(tbody, {
            fallbackToFirst: true,
            persistFallback: true,
            sortedData: sortedData,
            currentPage: page,
            pageSize: pageSize,
            goToPage: (newPage) => {
                currentDisplayPage = newPage;
                if (savedFilterField && savedFilterValue) {
                    renderSettlementsTableOnly(allData, allTotal, newPage, pageSize, true);
                } else {
                    renderSettlementsTableOnly(allData, allTotal, newPage, pageSize, false);
                }
            }
        });
    }

    showSettlementButtons();

}

// ==================== ОТОБРАЖЕНИЕ ОБЪЕДИНЁННОЙ ТАБЛИЦЫ ====================

function renderCombinedTable(data, total, page, pageSize, keepFilter = false) {
    destroyAnalyticsDashboard();

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
    settlementsTitle.textContent = 'Таблица обеспеченности НП региона';
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
            cell.colSpan = 100;
            cell.textContent = 'Нет населенных пунктов для отображения';
            cell.className = 'empty-message';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        const paginationContainer = document.getElementById('settlements-pagination');
        if (paginationContainer) paginationContainer.style.display = 'flex';
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

    const ratingGroups = buildRatingGroups();

    const settlementBaseHeaders = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Название' },
        { key: 'region_name', label: 'Регион' },
        { key: 'region_code', label: 'Код региона' },
        { key: 'district_name', label: 'Муниципальное образование' }
    ];

    const ratingColumn = { key: 'rating', label: 'обеспеченность' };

    const settlementRestHeaders = [
        { key: 'area', label: 'Площадь (км²)' },
        { key: 'lat', label: 'Широта' },
        { key: 'lon', label: 'Долгота' },
        { key: 'population', label: 'Население' },
        { key: 'fias_id', label: 'Код ФИАС' }
    ];

    const summaryHeaders = [
        { key: 'count_abonents_summary', label: 'Общее количество абонентов' },
        { key: 'population_percent_summary', label: 'Общий процент охвата населения' },
        { key: 'communication_coverage_summary', label: 'Общее покрытие' },
        { key: 'communication_coverage_percent_summary', label: 'Общий процент покрытия' },
        { key: 'traffic_summary', label: 'Общий объем трафика' },
        { key: 'traffic_percent_summary', label: 'Общий процент трафика' },
        { key: 'operators_percent_summary', label: 'Общий процент операторов' }
    ];

    const ratingHeaders = [];
    ratingGroups.forEach(group => {
        group.fields.forEach(f => {
            ratingHeaders.push({ key: f.key, label: f.label, group: group.title });
        });
    });

    const headers = [
        ...settlementBaseHeaders,
        ratingColumn,
        ...settlementRestHeaders,
        ...summaryHeaders,
        ...ratingHeaders
    ];

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

    headers.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.key;
        opt.textContent = h.label;
        fieldSelect.appendChild(opt);
    });
    fieldSelect.value = keepFilter && savedFilterField ? savedFilterField : 'name';

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
    if (keepFilter && savedFilterValue) valueInput.value = savedFilterValue;
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
    if (keepFilter && savedFilterExact) exactCheckbox.checked = true;

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

        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h.label;
            th.className = 'sortable-header';
            th.dataset.key = h.key;
            if (h.group) th.dataset.group = h.group;

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

            headers.forEach(h => {
                const td = document.createElement('td');
                let value;

                if (h.key in item) {
                    value = item[h.key];
                } else if (h.key in rating) {
                    value = rating[h.key];
                } else {
                    value = '-';
                }

                if (value === undefined || value === null) value = '-';
                if ((h.key === 'lat' || h.key === 'lon') && typeof value === 'number') {
                    value = value.toFixed(6);
                }
                td.textContent = value;
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

                onTableRowSelected(this);

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

    // ВЫБОР НАЧАЛЬНОЙ СТРОКИ: сохранённый id_np (с автопереходом на нужную страницу),
    // иначе — первая
    if (pageData && pageData.length > 0) {
        selectInitialRowInTable(tbody, {
            fallbackToFirst: true,
            persistFallback: true,
            sortedData: sortedData,
            currentPage: page,
            pageSize: pageSize,
            goToPage: (newPage) => {
                currentDisplayPage = newPage;
                if (savedFilterField && savedFilterValue) {
                    renderCombinedTable(allData, allTotal, newPage, pageSize, true);
                } else {
                    renderCombinedTable(allData, allTotal, newPage, pageSize, false);
                }
            }
        });
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

// ==================== ЗАГРУЗКА БС ====================

async function loadResForModal(settlementId, lat, lon, area) {
    if (!settlementId || lat === undefined || lon === undefined) {
        return;
    }

    const loader = initLoader();
    loader.show('Загрузка БС...');

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
        }

        loader.close();
    } catch (error) {
        loader.close();
        console.error('Ошибка загрузки БС:', error);
    }
}

// ==================== МОДАЛКА БС ====================

function openResModal(data, settlementId) {
    const existing = document.getElementById('res-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'res-modal';
    modal.className = 'res-modal-overlay';

    const content = document.createElement('div');
    content.className = 'res-modal-content';

    const title = document.createElement('h3');
    title.textContent = `БС для НП: ${selectedSettlementName || settlementId}`;
    title.className = 'res-modal-title';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.className = 'res-modal-close-btn';
    closeBtn.addEventListener('click', () => { modal.remove(); });

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'res-table-wrapper';

    const table = document.createElement('table');
    table.className = 'res-modal-table';

    const thead = document.createElement('thead');
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    const countInfo = document.createElement('div');
    countInfo.className = 'res-modal-count';
    countInfo.textContent = `Всего БС: ${data.length}`;

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
            cell.textContent = 'Нет БС для отображения';
            cell.className = 'empty-message res-empty-cell';
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
            th.className = 'res-modal-th';

            const sortIcon = document.createElement('span');
            sortIcon.className = 'sort-icon';
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
                return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } catch (e) { return dateStr || '-'; }
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
                td.className = 'res-modal-td';
                if (cell.value && cell.value !== '-') td.title = cell.value;
                row.appendChild(td);
            });

            const permissionEnd = item.permission_end_date;
            const certificateEnd = item.certificate_end_date;
            const now = new Date();
            let isExpired = false;

            if (permissionEnd) {
                try {
                    const endDate = new Date(permissionEnd);
                    if (!isNaN(endDate.getTime()) && endDate < now) {
                        isExpired = true;
                        row.classList.add('res-modal-tr--expired-permission');
                    }
                } catch (e) {}
            }

            if (certificateEnd && !isExpired) {
                try {
                    const endDate = new Date(certificateEnd);
                    if (!isNaN(endDate.getTime()) && endDate < now) {
                        row.classList.add('res-modal-tr--expired-certificate');
                    }
                } catch (e) {}
            }

            row.addEventListener('dblclick', () => { showResDetailsModal(item); });
            tbody.appendChild(row);
        });
    }

    function sortAndRender() {
        if (!currentSortField) { renderResTable(currentData); return; }

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
        const existingD = document.getElementById('res-details-modal');
        if (existingD) existingD.remove();

        const m = document.createElement('div');
        m.id = 'res-details-modal';
        m.className = 'res-modal-overlay';

        const c = document.createElement('div');
        c.className = 'res-modal-content';
        c.style.maxWidth = '600px';

        const t = document.createElement('h3');
        t.textContent = `БС #${item.id || 'Н/Д'}`;
        t.className = 'res-modal-title';

        const details = document.createElement('div');
        details.className = 'res-details';

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

        const fmtDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return dateStr;
                return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } catch (e) { return dateStr || '-'; }
        };

        fields.forEach(field => {
            const row = document.createElement('div');
            row.className = 'res-details__row';

            const label = document.createElement('div');
            label.className = 'res-details__label';
            label.textContent = field.label + ':';

            let value = item[field.key];
            if (field.key.includes('_date')) value = fmtDate(value);
            else value = value || '-';

            const valueEl = document.createElement('div');
            valueEl.className = 'res-details__value';
            valueEl.textContent = value;

            row.appendChild(label);
            row.appendChild(valueEl);
            details.appendChild(row);
        });

        const closeB = document.createElement('button');
        closeB.textContent = 'Закрыть';
        closeB.className = 'res-modal-close-btn';
        closeB.addEventListener('click', () => { m.remove(); });

        c.appendChild(t);
        c.appendChild(details);
        c.appendChild(closeB);
        m.appendChild(c);
        document.body.appendChild(m);

        m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
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
    title.textContent = 'Расчет обеспеченности НП';
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
    statusInfo.textContent = 'Получено обеспеченности: 0';

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
        status.textContent = `Получено обеспеченности: ${successCount}`;
    }
}

function closeProgressModal() {
    const modal = document.getElementById('rating-progress-modal');
    if (modal) modal.remove();
}

// ==================== РАБОТА С обеспеченностьАМИ ДЛЯ ПЕРЕДАННЫХ ДАННЫХ ====================

async function getRatingsOnlyForData(items) {
    const total = items.length;
    if (total === 0) return;

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
    if (total === 0) return;

    const existing = await loadRatingsBulk(currentRegions, currentPopRange);
    Object.keys(existing).forEach(id => {
        allRatings[id] = existing[id];
    });

    const toCalc = settlements.filter(s => !allRatings[String(s.id)]);
    if (toCalc.length === 0) {
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

    closeProgressModal();

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

    renderCombinedTable(originalDataForFilter, originalTotalForFilter, 0, pageSize, false);

    showSettlementButtons();
}

function switchToChartMode() {
    destroyAnalyticsDashboard();
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

    const hlBtn = document.getElementById('ss-btn-highlight');
    if (hlBtn && selectedSettlementId) {
        hlBtn.disabled = false;
        hlBtn.title = 'Отобразить на графике';
    }

    renderFormatControls();

    if (selectedSettlementId) {
        selectedSettlementHighlighted = true;
        setTimeout(() => restoreSelectionById(), 150);
    }
}

async function handleSettlementsButton() {
    destroyAnalyticsDashboard();

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

        resetChartUIState();

        showSelectedSettlementBlock();

        if (!selectedSettlementId) {
            restoreSelectedFromStorage();
        }

        if (selectedSettlementId) {
            const item = settlementsData.items.find(
                it => String(it.id) === String(selectedSettlementId)
            );
            if (item) {
                setSelectedSettlement(item, 'table');
            }
        }
    }
}

async function handleResButton() {
    if (!selectedSettlementId) {
        return;
    }
    await loadResForModal(selectedSettlementId, selectedSettlementLat, selectedSettlementLon, selectedSettlementArea);
}

// ==================== ОЧИСТКА ====================
// Восстанавливает selectedSettlement* из localStorage (id_np → поиск в settlementsData.items)

function resetChartUIState() {
    const formatGroup = document.getElementById('format-controls-group');
    if (formatGroup) formatGroup.remove();

    const tooltip = document.getElementById('chart-item-tooltip');
    if (tooltip) tooltip.remove();

    // Кнопку подсветки не трогаем — showSelectedSettlementBlock() выставит по режиму
    showSelectedSettlementBlock();
}
function handleClear() {
    document.body.classList.remove('analytics-mode');
    const form = document.querySelector('.form__rating');
    if (form) {
        form.reset();
        const regionSelect = document.getElementById('region');
        if (regionSelect) {
            const options = regionSelect.querySelectorAll('option');
            options.forEach(opt => opt.selected = false);
        }
        const typeConnectSelect = document.getElementById('type-connect');
        if (typeConnectSelect) typeConnectSelect.value = 'all';
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

    const formatGroup = document.getElementById('format-controls-group');
    if (formatGroup) formatGroup.remove();

    resetAndHideSelectedSettlement();

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
    destroyAnalyticsDashboard();

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

    // Блок «Выбранный НП» скрыт; кнопка подсветки выключена
    hideSelectedSettlementBlock();
    const hlBtn = document.getElementById('ss-btn-highlight');
    if (hlBtn) {
        hlBtn.disabled = true;
        hlBtn.title = 'Выберите НП';
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function handleSelectedClear() {
    // Убираем тултип
    const tooltip = document.getElementById('chart-item-tooltip');
    if (tooltip) tooltip.remove();

    // Убираем выделение в таблицах (если вдруг таблица тоже открыта)
    document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
        tr.classList.remove('selected');
    });

    // Убираем красную подсветку на графике (возвращаем базовые цвета)
    if (ratingChart) {
        const displayData = getChartDisplayData();
        if (displayData && displayData.length > 0) {
            const ds0 = ratingChart.data.datasets[0];
            const ds1 = ratingChart.data.datasets[1];

            ds0.backgroundColor = displayData.map(() => '#1a73e8');
            ds0.borderColor     = displayData.map(() => '#1a73e8');
            ds0.borderWidth     = displayData.map(() => 0);

            if (ds1) {
                ds1.backgroundColor = displayData.map(() => '#ff6a00');
                ds1.borderColor     = displayData.map(() => '#ff6a00');
                ds1.borderWidth     = displayData.map(() => 0);
            }
            ratingChart.update('none');
        }
    }

    // Сбрасываем указатели на выбранный элемент в поиске,
    // чтобы onHover не подсвечивал столбец заново
    selectedSearchItem = null;
    selectedSearchIndex = -1;

    // ГЛАВНОЕ: говорим onHover и плагинам, что подсветка выключена
    selectedSettlementHighlighted = false;
}
// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', async function() {
    initLoader();
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

    const btnAnalytics = document.getElementById('btn-analytics-dashboard');
    if (btnAnalytics) {
        btnAnalytics.addEventListener('click', handleAnalyticsDashboardButton);
    }

    const btnNormConsumption = document.getElementById('btn-norm-consumption');
    if (btnNormConsumption) btnNormConsumption.remove();

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', handleClear);

    const closeBtn = document.getElementById('close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.close();
            setTimeout(() => {
                if (!window.closed) window.location.href = '/';
            }, 100);
        });
    }

    setupDoubleClickHandler();

    // ===== Обработчики блока «Выбранный НП» =====
    const ssHighlight = document.getElementById('ss-btn-highlight');
    if (ssHighlight) ssHighlight.addEventListener('click', handleSelectedHighlight);

    const ssInfo = document.getElementById('ss-btn-info');
    if (ssInfo) ssInfo.addEventListener('click', handleSelectedInfo);

    const ssClear = document.getElementById('ss-btn-clear');
    if (ssClear) ssClear.addEventListener('click', handleSelectedClear);

    hideSelectedSettlementBlock();

    // ===== Обработчик change для сохранения регионов =====
    const regionSelectEl = document.getElementById('region');
    if (regionSelectEl) {
        regionSelectEl.addEventListener('change', persistSelectedRegions);
    }

    // ===== Читаем URL-параметры и LS СРАЗУ (до загрузки регионов) =====
    const urlParams = new URLSearchParams(window.location.search);
    const regionsParam = urlParams.get('regions');
    const typeParam = urlParams.get('type');
    const idNpParam = urlParams.get('id_np');

    // Если в URL пришли — перезаписываем ОБА в LS
    if (regionsParam) lsSet(LS_KEYS.regions, regionsParam);
    if (idNpParam)    lsSet(LS_KEYS.idNp, idNpParam);

    const effectiveIdNp = idNpParam || lsGet(LS_KEYS.idNp, DEFAULT_ID_NP);

    // ===== ДОЖИДАЕМСЯ загрузки регионов =====
    let regionsLoaded = [];
    try {
        regionsLoaded = await loadRegions();
    } catch (e) {
        console.error('loadRegions error:', e);
    }

    // После await <select> уже заполнен, и в нём применены LS/URL.
    // Проверим, что реально выбран регион (не пусто).
    const regionSelect = document.getElementById('region');
    if (!regionSelect) return;

    const hasRealOptions = Array.from(regionSelect.querySelectorAll('option'))
        .some(opt => opt.value !== 'all' && String(opt.value).trim() !== '');
    if (!hasRealOptions) {
        console.warn('Регионы не загрузились — автозапуск отменён');
        return;
    }

    if (regionSelect.selectedOptions.length === 0) {
        applyRegionsFromStorage();
    }

    const selectedRegionsNow = getSelectedRegions();
    if (selectedRegionsNow.length === 0) {
        console.warn('После загрузки регионов выбор пуст — автозапуск отменён');
        return;
    }

    // ===== Автозапуск по type =====
    if (typeParam === '2') {
        await handleRatingChartButton();

        if (effectiveIdNp) {
            setTimeout(() => {
                const targetId = String(effectiveIdNp).trim();
                const item = settlementsData.items.find(
                    it => String(it.id) === targetId
                );
                if (item) {
                    setSelectedSettlement(item, 'chart');
                    handleSelectedHighlight();
                } else {
                    console.warn(`НП с ID ${targetId} не найден в загруженных данных.`);
                }
            }, 800);
        }
    } else if (typeParam === '1') {
        await handleAnalyticsDashboardButton();
    }
});