'use strict';

import { Loader } from './Loader.js';

// ==================== Конфигурация API ====================

const API_BASE_URL = 'http://185.192.247.60:8910';
const TARGET_SETTLEMENT_ID = 13917429;

// ==================== Данные (оставлены как fallback для карточек) ====================

const CATEGORY_ORDER = [
    'Мобильная связь', 'ШПД', 'Телевидение', 'Радиовещание',
    'Спутниковая связь', 'Проводная связь', 'Почтовая связь'
];

const TECHNOLOGY_CARDS = [
    { category: 'Мобильная связь', title: 'ВС 5G', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Мобильная связь', title: 'ВС 4G (LTE)', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Мобильная связь', title: 'ВС 2G (GSM)', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Мобильная связь', title: 'ВС ТЕТРА', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'ШПД', title: 'Точки доступа WiFi', percent: 51, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Телевидение', title: 'Вышки ТВ', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Радиовещание', title: 'Вышки РВ', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Спутниковая связь', title: 'Терминалы', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Спутниковая связь', title: 'Телефоны', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Спутниковая связь', title: 'ЗССС', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Проводная связь', title: 'Узлы связи', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Проводная связь', title: 'Таксофоны', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Проводная связь', title: 'ВОЛС', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 },
    { category: 'Почтовая связь', title: 'Почтовые отделения', percent: 80, qty: 2, area: 16, capacity: 4500, operators: 2 }
];

const SCALE_COLORS = ['#008000', '#00ff00', '#0000ff', '#00ffff', '#ff7f00'];

// ==================== Загрузка населённого пункта по ID ====================

/**
 * Прямой запрос к API: GET /territories/settlements/{settlement_id}
 * Документация: http://185.192.247.60:8910/docs (тег «Территории»,
 * операция get_settlement_territories).
 */
async function fetchSettlementById(settlementId) {
    const url = `${API_BASE_URL}/territories/settlements/${encodeURIComponent(settlementId)}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} при запросе ${url}`);
    }
    return response.json();
}

function pickFirst(source, paths) {
    if (!source) return undefined;
    for (const path of paths) {
        const parts = path.split('.');
        let cur = source;
        let ok = true;
        for (const part of parts) {
            if (cur == null || typeof cur !== 'object' || !(part in cur)) {
                ok = false;
                break;
            }
            cur = cur[part];
        }
        if (ok && cur !== undefined && cur !== null && cur !== '') {
            return cur;
        }
    }
    return undefined;
}

function findSettlementNode(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) {
        for (const item of raw) {
            const found = findSettlementNode(item);
            if (found) return found;
        }
        return null;
    }
    if (typeof raw !== 'object') return null;

    const idValue = raw.id ?? raw.settlement_id;
    const idMatches = idValue != null && String(idValue) === String(TARGET_SETTLEMENT_ID);
    const hasName = raw.name || raw.settlement_name || raw.title;
    const looksLikeSettlement = hasName && (
        raw.population != null ||
        raw.region_name != null ||
        raw.region != null ||
        raw.fias_id != null
    );

    if (idMatches && hasName) return raw;
    if (looksLikeSettlement) return raw;

    for (const key of ['settlement', 'data', 'result', 'item', 'object', 'info', 'settlements']) {
        if (raw[key]) {
            const found = findSettlementNode(raw[key]);
            if (found) return found;
        }
    }
    for (const value of Object.values(raw)) {
        if (value && typeof value === 'object') {
            const found = findSettlementNode(value);
            if (found) return found;
        }
    }
    return null;
}

function normalizeSettlement(raw) {
    let node = findSettlementNode(raw);
    if (!node) {
        node = Array.isArray(raw) && raw.length ? raw[0] : (raw || {});
        console.warn('[planning_development] Не удалось однозначно выделить объект населённого пункта, используем верхний уровень ответа.', raw);
    }
    return {
        id: pickFirst(node, ['id', 'settlement_id']) ?? TARGET_SETTLEMENT_ID,
        name: pickFirst(node, ['name', 'settlement_name', 'title']),
        region_name: pickFirst(node, ['region_name', 'region.name', 'region']),
        district_name: pickFirst(node, ['district_name', 'district.name', 'district', 'municipality_name']),
        population: pickFirst(node, ['population', 'population_count', 'people', 'residents']),
        area: pickFirst(node, ['area', 'area_km2', 'square', 'area_sq_km']),
        lat: pickFirst(node, ['lat', 'latitude']),
        lon: pickFirst(node, ['lon', 'lng', 'longitude']),
        fias_id: pickFirst(node, ['fias_id', 'fias', 'fias_code', 'fias_guid'])
    };
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (value === undefined || value === null || value === '') ? '—' : value;
}

function renderSettlementHeader(s) {
    setText('pd-header-name', s.name || `ID: ${s.id}`);
    setText('pd-header-region', s.region_name);
    setText('pd-header-district', s.district_name);
    setText('pd-header-id', s.id);
}

function renderSettlementInfo(s) {
    setText('pd-info-population', s.population != null ? Number(s.population).toLocaleString('ru-RU') : '—');
    setText('pd-info-area', s.area != null ? s.area : '—');
    setText('pd-info-lat', s.lat != null ? Number(s.lat).toFixed(6) : '—');
    setText('pd-info-lon', s.lon != null ? Number(s.lon).toFixed(6) : '—');
    setText('pd-info-fias', s.fias_id);
}

async function loadSettlementById() {
    const loader = new Loader('.loader-container');
    loader.show('Загрузка населённого пункта...');
    try {
        const raw = await fetchSettlementById(TARGET_SETTLEMENT_ID);
        console.log(`[planning_development] Ответ ${API_BASE_URL}/territories/settlements/${TARGET_SETTLEMENT_ID}:`, raw);
        const settlement = normalizeSettlement(raw);
        renderSettlementHeader(settlement);
        renderSettlementInfo(settlement);
    } catch (e) {
        console.error('Ошибка загрузки населённого пункта:', e);
        setText('pd-header-name', `Населённый пункт id ${TARGET_SETTLEMENT_ID}`);
        setText('pd-header-region', '—');
        setText('pd-header-district', '—');
        setText('pd-header-id', TARGET_SETTLEMENT_ID);
        setText('pd-info-population', '—');
        setText('pd-info-area', '—');
        setText('pd-info-lat', '—');
        setText('pd-info-lon', '—');
        setText('pd-info-fias', '—');
    } finally {
        loader.close();
    }
}

// ==================== Утилиты (без изменений) ====================

function clampPercent(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function getScaleColor(percent) {
    const p = clampPercent(percent);
    if (p <= 20) return '#ff7f00';
    if (p <= 40) return '#00ffff';
    if (p <= 60) return '#0000ff';
    if (p <= 80) return '#00ff00';
    return '#008000';
}

function getArrowTop(percent) {
    return `${100 - clampPercent(percent)}%`;
}

function groupCardsByCategory() {
    const groups = new Map(CATEGORY_ORDER.map(c => [c, []]));
    for (const item of TECHNOLOGY_CARDS) {
        const list = groups.get(item.category);
        if (list) list.push(item);
    }
    return groups;
}

function averagePercent(cards) {
    if (!cards.length) return null;
    let sum = 0;
    for (const item of cards) sum += Number(item.percent) || 0;
    return Math.round(sum / cards.length);
}

// ==================== Шкалы по видам связи ====================

function createTypeGaugeHeader(category, percent) {
    const deficit = 100 - percent;

    const header = document.createElement('div');
    header.className = 'pd-column-header';

    const title = document.createElement('b');
    title.textContent = category;
    header.appendChild(title);

    const track = document.createElement('div');
    track.className = 'pd-gauge-track';

    const marker = document.createElement('i');
    marker.className = 'pd-gauge-marker';
    marker.style.left = `${percent}%`;
    track.appendChild(marker);
    header.appendChild(track);

    const legend = document.createElement('div');
    legend.className = 'pd-type-legend';
    legend.innerHTML =
        `<span class="pd-positive">Обеспеченность <b>${percent}%</b></span>` +
        `<span class="pd-negative">Дефицит <b>${deficit}%</b></span>`;
    header.appendChild(legend);

    return header;
}

// ==================== Карточки технологий ====================

function createChart(percent) {
    const wrapper = document.createElement('div');
    wrapper.className = 'pd-chart-wrapper';

    const chart = document.createElement('div');
    chart.className = 'pd-mini-chart';

    const zones = document.createDocumentFragment();
    for (const color of SCALE_COLORS) {
        const zone = document.createElement('div');
        zone.className = 'pd-mini-chart__zone';
        zone.style.background = color;
        zones.appendChild(zone);
    }
    chart.appendChild(zones);

    const arrowGroup = document.createElement('div');
    arrowGroup.className = 'pd-arrow-group';
    arrowGroup.style.setProperty('--pd-arrow-top', getArrowTop(percent));

    const arrow = document.createElement('div');
    arrow.className = 'pd-mini-arrow';
    arrow.textContent = `${percent}%`;
    arrow.style.setProperty('--pd-arrow-color', getScaleColor(percent));

    arrowGroup.appendChild(arrow);
    chart.appendChild(arrowGroup);
    wrapper.appendChild(chart);
    return wrapper;
}

function createTable(data) {
    const rows = [
        ['Количество', data.qty],
        ['Пл.покр.,км2', data.area],
        ['Аб. емкость, аб.', data.capacity],
        ['Пр.спос.,Мбит/с', data.qty],
        ['Кол.операторов', data.operators]
    ];

    const table = document.createElement('table');
    table.className = 'pd-card-table';

    const fragment = document.createDocumentFragment();
    for (const [label, value] of rows) {
        const tr = document.createElement('tr');

        const tdLabel = document.createElement('td');
        tdLabel.className = 'td-label';
        tdLabel.textContent = label;

        const tdValue = document.createElement('td');
        tdValue.className = 'td-value';
        tdValue.textContent = value ?? '—';

        tr.append(tdLabel, tdValue);
        fragment.appendChild(tr);
    }
    table.appendChild(fragment);
    return table;
}

function createCard(data) {
    const card = document.createElement('div');
    card.className = 'pd-card';

    const title = document.createElement('div');
    title.className = 'pd-card__title';
    title.textContent = data.title;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className = 'pd-card-body';
    body.appendChild(createChart(data.percent));
    body.appendChild(createTable(data));

    card.appendChild(body);
    return card;
}

// ==================== Инициализация ====================

function renderUnifiedGrid() {
    const container = document.getElementById('pd-dashboard-grid');
    if (!container) return;

    const groups = groupCardsByCategory();
    const fragment = document.createDocumentFragment();

    for (const category of CATEGORY_ORDER) {
        const cards = groups.get(category);
        if (!cards || !cards.length) continue;

        const column = document.createElement('section');
        column.className = 'pd-category-column';

        const avg = averagePercent(cards);
        column.appendChild(createTypeGaugeHeader(category, avg));

        const list = document.createElement('div');
        list.className = 'pd-category-column__cards';
        for (const item of cards) list.appendChild(createCard(item));
        column.appendChild(list);

        fragment.appendChild(column);
    }

    container.replaceChildren(fragment);
}

function initExpandButtons() {
    document.addEventListener('click', event => {
        const button = event.target.closest('.pd-expand-button');
        if (!button) return;

        const panel = document.getElementById(button.getAttribute('aria-controls'));
        if (!panel) return;

        const expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
        button.classList.toggle('is-open', !expanded);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettlementById();
    renderUnifiedGrid();
    initExpandButtons();
});