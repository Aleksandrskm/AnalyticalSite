'use strict';

// ==================== Данные ====================

const CATEGORY_ORDER = [
    'Мобильная связь', 'ШПД WiFi', 'ТВ', 'РВ',
    'Спутниковая связь', 'Проводная связь', 'Почтовая связь'
];

const TECHNOLOGY_CARDS = [
    { category: 'Мобильная связь', title: '5G', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Мобильная связь', title: 'LTE (4G)', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Мобильная связь', title: 'GSM (2G)', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Мобильная связь', title: 'TETRA', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'ШПД WiFi', title: 'Точки доступа WiFi', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'ТВ', title: 'Вышки ТВ', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'РВ', title: 'Вышки РВ', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Спутниковая связь', title: 'Спутниковые терминалы и телефоны', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Спутниковая связь', title: 'Земные станции спутниковой связи', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Спутниковая связь', title: 'Доступность КА', percent: 80, qty: 60, area: 1, capacity: 60, operators: 1 },
    { category: 'Проводная связь', title: 'Узлы связи', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
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
    const index = Math.min(SCALE_COLORS.length - 1,
                         Math.floor((100 - clampPercent(percent)) / 20));
    return SCALE_COLORS[index];
}

function getArrowTop(percent) {
    return `${100 - clampPercent(percent)}%`;
}

function groupCardsByCategory() {
    const groups = Object.fromEntries(CATEGORY_ORDER.map(c => [c, []]));
    for (const item of TECHNOLOGY_CARDS) {
        if (groups[item.category]) groups[item.category].push(item);
    }
    return groups;
}

function averagePercent(cards) {
    if (!cards.length) return null;
    const sum = cards.reduce((acc, item) => acc + Number(item.percent || 0), 0);
    return Math.round(sum / cards.length);
}

// ==================== Общий показатель обеспеченности ====================

function renderOverallGauge() {
    const avg = averagePercent(TECHNOLOGY_CARDS);
    if (avg === null) return;
    const deficit = 100 - avg;

    const valueEl = document.querySelector('.pd-gauge--large .pd-gauge-value');
    if (valueEl) valueEl.textContent = `${avg}%`;

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
    el.innerHTML =
        '<b></b>' +
        '<div class="pd-gauge-track"><i class="pd-gauge-marker"></i></div>' +
        '<strong></strong>' +
        '<div class="pd-type-legend">' +
            '<span class="pd-positive">Обеспеченность&nbsp; <b></b></span>' +
            '<span class="pd-negative">Дефицит&nbsp; <b></b></span>' +
        '</div>';

    el.querySelector('b').textContent = category;
    el.querySelector('.pd-gauge-marker').style.left = `${percent}%`;
    el.querySelector('strong').textContent = `${percent}%`;

    const legends = el.querySelectorAll('.pd-type-legend b');
    legends[0].textContent = `${percent}%`;
    legends[1].textContent = `${deficit}%`;

    return el;
}

function renderTypeGauges() {
    const container = document.getElementById('pd-type-gauges');
    if (!container) return;

    const groups = groupCardsByCategory();
    const fragment = document.createDocumentFragment();

    for (const category of CATEGORY_ORDER) {
        const avg = averagePercent(groups[category]);
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
    for (const color of SCALE_COLORS) {
        const zone = document.createElement('div');
        zone.className = 'pd-mini-chart__zone';
        zone.style.background = color;
        chart.appendChild(zone);
    }

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
        ['Обеспеч., %', data.percent, true],
        ['Кол-во', data.qty, false],
        ['Пл. кв. км', data.area, false],
        ['Ёмкость, аб.', data.capacity, false],
        ['Кол-во операт.', data.operators, false]
    ];

    const table = document.createElement('table');
    table.className = 'pd-card-table';

    for (const [label, value, positive] of rows) {
        const tr = document.createElement('tr');

        const tdLabel = document.createElement('td');
        tdLabel.className = 'td-label' + (positive ? ' pd-positive' : '');
        tdLabel.textContent = label;

        const tdValue = document.createElement('td');
        tdValue.className = 'td-value' + (positive ? ' pd-positive' : '');
        tdValue.textContent = value;

        tr.append(tdLabel, tdValue);
        table.appendChild(tr);
    }
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
        const cards = groups[category];
        if (!cards.length) continue;

        const column = document.createElement('section');
        column.className = 'pd-category-column';

        const heading = document.createElement('h3');
        heading.className = 'pd-category-column__heading';
        heading.textContent = category;
        column.appendChild(heading);

        const list = document.createElement('div');
        list.className = 'pd-category-column__cards';
        for (const item of cards) list.appendChild(createCard(item));
        column.appendChild(list);

        fragment.appendChild(column);
    }

    container.replaceChildren(fragment);
}

// ==================== Инициализация ====================

document.addEventListener('DOMContentLoaded', () => {
    renderTypeGauges();
    renderOverallGauge();
    renderTechnologyCards();

    document.querySelectorAll('.pd-expand-button').forEach(button => {
        button.addEventListener('click', () => {
            const panel = document.getElementById(button.getAttribute('aria-controls'));
            if (!panel) return;

            const expanded = button.getAttribute('aria-expanded') === 'true';
            button.setAttribute('aria-expanded', String(!expanded));
            panel.hidden = expanded;
            button.classList.toggle('is-open', !expanded);
        });
    });
});