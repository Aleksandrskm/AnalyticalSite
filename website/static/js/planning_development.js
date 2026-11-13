'use strict';

// ==================== Данные ====================

const CATEGORY_ORDER = [
    'Мобильная связь', 'ШПД', 'Телевидение', 'Радиовещание',
    'Спутниковая связь', 'Проводная связь', 'Почтовая связь'
];

const TECHNOLOGY_CARDS = [
    { category: 'Мобильная связь', title: '5G', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Мобильная связь', title: 'LTE (4G)', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Мобильная связь', title: 'GSM (2G)', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Мобильная связь', title: 'TETRA', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'ШПД', title: 'Точки доступа WiFi', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Телевидение', title: 'Вышки ТВ', percent: 80, qty: 50, area: 1, capacity: null, operators: 1 },
    { category: 'Радиовещание', title: 'Вышки РВ', percent: 80, qty: 50, area: 1, capacity: null, operators: 1 },
    { category: 'Спутниковая связь', title: 'Сп. терм. и тлф', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Спутниковая связь', title: 'ЗССС', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Проводная связь', title: 'ВОЛС', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Проводная связь', title: 'Таксофоны', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Почтовая связь', title: 'Почтовые отделения', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 }
];

// Цвета сверху вниз: зелёный → светло-зелёный → синий → голубой → оранжевый.
const SCALE_COLORS = ['#0f8a0b', '#69f034', '#005bfb', '#5ff1ff', '#f57c00'];

// ==================== Утилиты ====================

function clampPercent(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function getScaleColor(percent) {
    const index = Math.min(
        SCALE_COLORS.length - 1,
        Math.floor((100 - clampPercent(percent)) / 20)
    );
    return SCALE_COLORS[index];
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

// ==================== Общий показатель обеспеченности ====================

function renderOverallGauge() {
    const avg = averagePercent(TECHNOLOGY_CARDS);
    if (avg === null) return;

    const deficit = 100 - avg;

    const markerEl = document.querySelector('.pd-gauge--large .pd-gauge-marker');
    if (markerEl) markerEl.style.left = `${avg}%`;

    const legend = document.querySelectorAll('.pd-overall-legend b');
    if (legend[0]) legend[0].textContent = `${avg}%`;
    if (legend[1]) legend[1].textContent = `${deficit}%`;
}

// ==================== Шкалы по видам связи ====================

function createTypeGauge(category, percent) {
    const deficit = 100 - percent;

    const el = document.createElement('div');
    el.className = 'pd-type-gauge';

    const title = document.createElement('b');
    title.textContent = category;
    el.appendChild(title);

    const track = document.createElement('div');
    track.className = 'pd-gauge-track';

    const marker = document.createElement('i');
    marker.className = 'pd-gauge-marker';
    marker.style.left = `${percent}%`;
    track.appendChild(marker);
    el.appendChild(track);

    const legend = document.createElement('div');
    legend.className = 'pd-type-legend';
    legend.innerHTML =
        `<span class="pd-positive">Обеспеченность&nbsp; <b>${percent}%</b></span>` +
        `<span class="pd-negative">Дефицит&nbsp; <b>${deficit}%</b></span>`;
    el.appendChild(legend);

    return el;
}

function renderTypeGauges() {
    const container = document.getElementById('pd-type-gauges');
    if (!container) return;

    const groups = groupCardsByCategory();
    const fragment = document.createDocumentFragment();

    for (const category of CATEGORY_ORDER) {
        const avg = averagePercent(groups.get(category) || []);
        if (avg !== null) fragment.appendChild(createTypeGauge(category, avg));
    }

    container.replaceChildren(fragment);
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
        ['Количество', data.percent, true],
        ['Пл. доступн., кв.км', data.qty, false],
        ['Аб. емкость, аб.', data.area, false],
        ['Проп. сп., Мбит/с', data.capacity, false],
        ['Кол. операт.', data.operators, false]
    ];

    const table = document.createElement('table');
    table.className = 'pd-card-table';

    const fragment = document.createDocumentFragment();

    for (const [label, value, positive] of rows) {
        const tr = document.createElement('tr');

        const tdLabel = document.createElement('td');
        tdLabel.className = 'td-label' + (positive ? ' pd-positive' : '');
        tdLabel.textContent = label;

        const tdValue = document.createElement('td');
        tdValue.className = 'td-value' + (positive ? ' pd-positive' : '');
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

    card.appendChild(createChart(data.percent));
    card.appendChild(createTable(data));
    return card;
}

function renderTechnologyCards() {
    const container = document.getElementById('pd-dashboard-grid');
    if (!container) return;

    const groups = groupCardsByCategory();
    const fragment = document.createDocumentFragment();

    for (const category of CATEGORY_ORDER) {
        const cards = groups.get(category);
        if (!cards || !cards.length) continue;

        const column = document.createElement('section');
        column.className = 'pd-category-column';

        const list = document.createElement('div');
        list.className = 'pd-category-column__cards';

        for (const item of cards) list.appendChild(createCard(item));
        column.appendChild(list);

        fragment.appendChild(column);
    }

    container.replaceChildren(fragment);
}

// ==================== Раскрывающиеся таблицы ====================

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

// ==================== Синхронизация горизонтального скролла ====================
// Защита от «эха»: пока пользователь тянет один контейнер, события scroll
// от парного игнорируются; субпиксельные расхождения < 1px не применяются.

function initScrollSync() {
    const typeGauges = document.getElementById('pd-type-gauges');
    const categoryGrid = document.getElementById('pd-dashboard-grid');
    if (!typeGauges || !categoryGrid) return;

    let activeSource = null;
    let releaseTimer = 0;

    const sync = (source, target) => {
        source.addEventListener('scroll', () => {
            // Событие порождено нашим же присвоением scrollLeft — пропускаем
            if (activeSource && activeSource !== source) return;

            activeSource = source;

            const value = source.scrollLeft;
            // Присваиваем только при реальном расхождении ≥ 1px
            if (Math.abs(target.scrollLeft - value) >= 1) {
                target.scrollLeft = value;
            }

            // Отпускаем блокировку, когда прокрутка затихла
            clearTimeout(releaseTimer);
            releaseTimer = setTimeout(() => { activeSource = null; }, 80);
        }, { passive: true });
    };

    sync(typeGauges, categoryGrid);
    sync(categoryGrid, typeGauges);
}

// ==================== Таймер ====================

function initTimer() {
    const timer = document.getElementById('timer-start');
    if (!timer) return;

    const pad = v => String(v).padStart(2, '0');

    const tick = () => {
        const n = new Date();
        timer.textContent =
            `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())} ` +
            `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
    };

    tick();
    setInterval(tick, 1000);
}

// ==================== Инициализация ====================

document.addEventListener('DOMContentLoaded', () => {
    renderTypeGauges();
    renderOverallGauge();
    renderTechnologyCards();
    initExpandButtons();
    initScrollSync();
    initTimer();
});