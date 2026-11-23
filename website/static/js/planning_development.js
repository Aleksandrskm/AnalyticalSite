'use strict';

import { Loader } from './Loader.js';

// ==================== Конфигурация API ====================

const API_BASE_URL = 'http://185.192.247.60:8910';
const TARGET_SETTLEMENT_ID = 13917429;

// ==================== Справочники ====================

const CATEGORY_ORDER = [
    'Мобильная связь', 'ШПД', 'Телевидение', 'Радиовещание',
    'Спутниковая связь', 'Проводная связь', 'Почтовая связь'
];

/**
 * key — суффикс полей в ответе /communication_rating/settlements/{id}:
 *   rating_{key}                  — обеспеченность, %
 *   count_res_{key}               — количество
 *   communication_coverage_{key}  — площадь покрытия, км²
 *   count_abonents_{key}          — абонентская ёмкость
 *   traffic_{key}                 — пропускная способность, Мбит/с (может отсутствовать → «—»)
 *   count_operators_{key}         — количество операторов
 *
 * keyFallback — альтернативный суффикс (например, "post" для "posts").
 * key === null — спутниковая связь: все значения = 0 (по требованию).
 */
const TECHNOLOGY_CARDS = [
    { category: 'Мобильная связь',   title: 'ВС 5G',              key: '5g' },
    { category: 'Мобильная связь',   title: 'ВС 4G (LTE)',        key: 'lte' },
    { category: 'Мобильная связь',   title: 'ВС 2G (GSM)',        key: 'gsm' },
    { category: 'Мобильная связь',   title: 'ВС ТЕТРА',           key: 'tetra' },
    { category: 'ШПД',               title: 'Точки доступа WiFi', key: 'wifi' },
    { category: 'Телевидение',       title: 'Вышки ТВ',           key: 'tv' },
    { category: 'Радиовещание',      title: 'Вышки РВ',           key: 'rv' },
    { category: 'Спутниковая связь', title: 'Терминалы',          key: null },
    { category: 'Спутниковая связь', title: 'Телефоны',           key: null },
    { category: 'Спутниковая связь', title: 'ЗССС',               key: null },
    { category: 'Проводная связь',   title: 'Узлы связи',         key: 'comm_hubs' },
    { category: 'Проводная связь',   title: 'Таксофоны',          key: 'payphones' },
    { category: 'Проводная связь',   title: 'ВОЛС',               key: 'focl' },
    { category: 'Почтовая связь',    title: 'Почтовые отделения', key: 'posts', keyFallback: 'post' }
];

const SCALE_COLORS = ['#008000', '#00ff00', '#0000ff', '#00ffff', '#ff7f00'];

// ==================== Загрузка населённого пункта ====================

async function fetchSettlementById(settlementId) {
    const path = `/territories/settlements/${encodeURIComponent(settlementId)}`;
    const url = `${API_BASE_URL}${path}`;
    console.log(`[pd] GET ${url}`);
    const response = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status} при запросе ${url}`);
    const data = await response.json();
    console.log('[pd] Ответ по населённому пункту:', data);
    return data;
}

// ==================== Загрузка рейтинга связи ====================

/**
 * Соответствует operationId:
 *   get_settlements_communication_rating_communication_rating_settlements__settlement_id__get
 *
 * Точный путь в FastAPI может быть как с подчёркиванием (communication_rating),
 * так и с дефисом (communication-rating). Пробуем оба варианта — какой ответит 200,
 * тот и используется.
 */
async function fetchCommunicationRating(settlementId) {
    const candidates = [
        `/communication_rating/settlements/${encodeURIComponent(settlementId)}`,
        `/communication-rating/settlements/${encodeURIComponent(settlementId)}`,
        `/settlements/${encodeURIComponent(settlementId)}/communication-rating`,
        `/settlements/${encodeURIComponent(settlementId)}/communication_rating`
    ];

    const errors = [];
    for (const path of candidates) {
        const url = `${API_BASE_URL}${path}`;
        try {
            console.log(`[pd] GET ${url}`);
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) {
                errors.push(`${url} → HTTP ${response.status}`);
                continue;
            }
            const data = await response.json();
            console.log('[pd] Успешный ответ по рейтингу связи. Ключи:', Object.keys(data || {}));
            console.table(data);
            return data;
        } catch (e) {
            errors.push(`${url} → ${e.message}`);
        }
    }

    throw new Error(
        'Не удалось получить рейтинг связи.\n' + errors.join('\n') +
        '\n\nВозможные причины:\n' +
        ' • CORS — сервер не разрешает ваш origin (проверьте Console на "blocked by CORS");\n' +
        ' • mixed content — страница по https, а API по http;\n' +
        ' • неверный путь — сверьтесь с ' + API_BASE_URL + '/openapi.json'
    );
}

// ==================== Нормализация населённого пункта ====================

function pickFirst(source, paths) {
    if (!source) return undefined;
    for (const path of paths) {
        const parts = path.split('.');
        let cur = source;
        let ok = true;
        for (const part of parts) {
            if (cur == null || typeof cur !== 'object' || !(part in cur)) { ok = false; break; }
            cur = cur[part];
        }
        if (ok && cur !== undefined && cur !== null && cur !== '') return cur;
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
        raw.population != null || raw.region_name != null ||
        raw.region != null || raw.fias_id != null
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
        console.warn('[pd] Не удалось однозначно выделить объект населённого пункта, используем верхний уровень ответа.', raw);
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
}

function renderSettlementInfo(s) {
    // Население — целое число, оставляем с разделителями разрядов
    setText('pd-info-population',
        s.population != null ? Number(s.population).toLocaleString('ru-RU') : '—');

    // Площадь, широта, долгота — округляем до 4 знаков после запятой
    const fmt4 = v => {
        if (v === undefined || v === null || v === '') return '—';
        const n = Number(v);
        return Number.isFinite(n) ? n.toFixed(4) : v;
    };

    setText('pd-info-area', fmt4(s.area));
    setText('pd-info-lat',  fmt4(s.lat));
    setText('pd-info-lon',  fmt4(s.lon));

    // Код ФИАС — строка, не трогаем
    setText('pd-info-fias', s.fias_id);
}

// ==================== Утилиты ====================

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

function toDisplayValue(value) {
    if (value === undefined || value === null || value === '') return '—';
    return value;
}

function toNumberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Ищет поле в ответе, допуская вложенность (data/result/…).
 */
function findFieldDeep(source, fieldName, maxDepth = 3) {
    if (!source || typeof source !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(source, fieldName)) {
        const v = source[fieldName];
        if (v !== undefined && v !== null) return v;
    }
    if (maxDepth <= 0) return undefined;
    for (const v of Object.values(source)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            const found = findFieldDeep(v, fieldName, maxDepth - 1);
            if (found !== undefined) return found;
        }
    }
    return undefined;
}

// ==================== Построение данных карточек по ответу API ====================

function buildCardData(rawRating, cardDef) {
    // Спутниковая связь — все значения = 0 (по требованию)
    if (!cardDef.key) {
        return {
            category: cardDef.category,
            title: cardDef.title,
            percent: 0,
            qty: 0,
            area: 0,
            capacity: 0,
            traffic: 0,
            operators: 0
        };
    }

    const keys = [cardDef.key, cardDef.keyFallback].filter(Boolean);

    // Ищем metric_{key} или metric_{keyFallback} (например, rating_posts или rating_post)
    const pick = metric => {
        for (const k of keys) {
            const v = findFieldDeep(rawRating, `${metric}_${k}`);
            if (v !== undefined) return v;
        }
        return undefined;
    };

    const percent = clampPercent(toNumberOrNull(pick('rating')) ?? 0);

    const data = {
        category: cardDef.category,
        title: cardDef.title,
        percent,
        qty:       toDisplayValue(pick('count_res')),
        area:      toDisplayValue(pick('communication_coverage')),
        capacity:  toDisplayValue(pick('count_abonents')),
        traffic:   toDisplayValue(pick('traffic')),
        operators: toDisplayValue(pick('count_operators'))
    };

    // Диагностика: если ни одного значения не нашлось — пишем в консоль реальные ключи ответа
    const empty =
        data.qty === '—' && data.area === '—' && data.capacity === '—' &&
        data.traffic === '—' && data.operators === '—';
    if (empty) {
        console.warn(
            `[pd] Для "${cardDef.title}" (ключи: ${keys.join('/')}) не найдено ни одного поля. ` +
            `Реальные ключи ответа: ${Object.keys(rawRating || {}).join(', ') || '—'}`
        );
    }

    return data;
}

function buildAllCardData(rawRating) {
    return TECHNOLOGY_CARDS.map(def => buildCardData(rawRating, def));
}

function groupCardsByCategory(cards) {
    const groups = new Map(CATEGORY_ORDER.map(c => [c, []]));
    for (const item of cards) {
        const list = groups.get(item.category);
        if (list) list.push(item);
    }
    return groups;
}

function averagePercent(cards) {
    if (!cards.length) return 0;
    let sum = 0;
    for (const item of cards) sum += clampPercent(item.percent);
    return Math.round(sum / cards.length);
}

// ==================== Шкалы по видам связи ====================

function createTypeGaugeHeader(category, percent) {
    const p = clampPercent(percent);
    const deficit = 100 - p;

    const header = document.createElement('div');
    header.className = 'pd-column-header';

    const title = document.createElement('b');
    title.textContent = category;
    header.appendChild(title);

    const track = document.createElement('div');
    track.className = 'pd-gauge-track';

    const marker = document.createElement('i');
    marker.className = 'pd-gauge-marker';
    marker.style.left = `${p}%`;
    track.appendChild(marker);
    header.appendChild(track);

    const legend = document.createElement('div');
    legend.className = 'pd-type-legend';
    legend.innerHTML =
        `<span class="pd-positive">Обеспеченность <b>${p}%</b></span>` +
        `<span class="pd-negative">Дефицит <b>${deficit}%</b></span>`;
    header.appendChild(legend);

    return header;
}

// ==================== Карточки технологий ====================

function createChart(percent) {
    const p = clampPercent(percent);

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
    arrowGroup.style.setProperty('--pd-arrow-top', getArrowTop(p));

    const arrow = document.createElement('div');
    arrow.className = 'pd-mini-arrow';
    arrow.textContent = `${p}%`;
    arrow.style.setProperty('--pd-arrow-color', getScaleColor(p));

    arrowGroup.appendChild(arrow);
    chart.appendChild(arrowGroup);
    wrapper.appendChild(chart);
    return wrapper;
}

function createTable(data) {
    const rows = [
        ['Количество',       data.qty],
        ['Пл.покр., км2',     data.area],
        ['Аб. емкость, аб.', data.capacity],
        ['Пр.спос., Мбит/с',  data.traffic],
        ['Кол. операторов',   data.operators]
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
        tdValue.textContent = toDisplayValue(value);

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

// ==================== Общая шкала обеспеченности ====================

function updateOverallGauge(percent) {
    const p = clampPercent(percent);
    const marker = document.querySelector('.pd-overall .pd-gauge-marker');
    if (marker) marker.style.left = `${p}%`;

    const posB = document.querySelector('.pd-overall-legend .pd-positive b');
    const negB = document.querySelector('.pd-overall-legend .pd-negative b');
    if (posB) posB.textContent = `${p}%`;
    if (negB) negB.textContent = `${100 - p}%`;
}

// ==================== Рендер объединённой таблицы ====================

function renderUnifiedGrid(rawRating) {
    const container = document.getElementById('pd-dashboard-grid');
    if (!container) return;

    const allCards = buildAllCardData(rawRating);
    const groups = groupCardsByCategory(allCards);

    const fragment = document.createDocumentFragment();
    const categoryAverages = [];

    for (const category of CATEGORY_ORDER) {
        const cards = groups.get(category);
        if (!cards || !cards.length) continue;

        const column = document.createElement('section');
        column.className = 'pd-category-column';

        const avg = averagePercent(cards);
        categoryAverages.push(avg);
        column.appendChild(createTypeGaugeHeader(category, avg));

        const list = document.createElement('div');
        list.className = 'pd-category-column__cards';
        for (const item of cards) list.appendChild(createCard(item));
        column.appendChild(list);

        fragment.appendChild(column);
    }

    container.replaceChildren(fragment);

    // Общая обеспеченность — среднее по категориям
    const overall = categoryAverages.length
        ? Math.round(categoryAverages.reduce((a, b) => a + b, 0) / categoryAverages.length)
        : 0;
    updateOverallGauge(overall);
}

// ==================== Видимый баннер ошибки ====================

function showErrorBanner(message) {
    const host = document.querySelector('.pd-layout');
    if (!host) {
        alert(message);
        return;
    }
    const existing = host.querySelector('.pd-error-banner');
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.className = 'pd-error-banner';
    box.style.cssText =
        'border:2px solid #cc0000;background:#fff0f0;color:#7a0000;' +
        'padding:12px 16px;font-size:13px;white-space:pre-wrap;' +
        'font-family:monospace;line-height:1.4;';
    box.textContent = 'Не удалось загрузить данные рейтинга связи.\n\n' + message;
    host.prepend(box);
}

// ==================== Кнопки-аккордеоны ====================

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

// ==================== Инициализация ====================

async function initPage() {
    const loader = new Loader('.loader-container');
    loader.show('Загрузка данных...');

    try {
        const [settlementRes, ratingRes] = await Promise.allSettled([
            fetchSettlementById(TARGET_SETTLEMENT_ID),
            fetchCommunicationRating(TARGET_SETTLEMENT_ID)
        ]);

        // --- населённый пункт ---
        if (settlementRes.status === 'fulfilled') {
            const settlement = normalizeSettlement(settlementRes.value);
            renderSettlementHeader(settlement);
            renderSettlementInfo(settlement);
        } else {
            console.error('[pd] Ошибка загрузки населённого пункта:', settlementRes.reason);
            setText('pd-header-name', `Населённый пункт id ${TARGET_SETTLEMENT_ID}`);
            setText('pd-header-region', '—');
            setText('pd-header-district', '—');
            setText('pd-info-population', '—');
            setText('pd-info-area', '—');
            setText('pd-info-lat', '—');
            setText('pd-info-lon', '—');
            setText('pd-info-fias', '—');
        }

        // --- рейтинг связи ---
        if (ratingRes.status === 'fulfilled') {
            renderUnifiedGrid(ratingRes.value);
        } else {
            console.error('[pd] Ошибка загрузки рейтинга связи:', ratingRes.reason);
            renderUnifiedGrid(null);
            showErrorBanner(String(ratingRes.reason && ratingRes.reason.message || ratingRes.reason));
        }
    } finally {
        loader.close();
    }

    initExpandButtons();
}

document.addEventListener('DOMContentLoaded', initPage);