'use strict';

// Демонстрационные значения, оставленные из исходной локальной версии.
// Порядок карточек повторяет схему на предоставленном скриншоте.
const technologyCards = [
    { category: 'Мобильная связь', title: '5G', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Мобильная связь', title: 'LTE (4G)', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Мобильная связь', title: 'GSM (2G)', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Мобильная связь', title: 'TETRA', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'ШПД WiFi', title: 'Точки доступа WiFi', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'ТВ', title: 'Вышки ТВ', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'РВ', title: 'Вышки РВ', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Спутниковая связь', title: 'Спутниковые терминалы и телефоны', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Спутниковая связь', title: 'Земные станции спутниковой связи', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Проводная связь', title: 'Узлы связи', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Проводная связь', title: 'Таксофоны', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { category: 'Почтовая связь', title: 'Почтовые отделения', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 }
];

document.addEventListener('DOMContentLoaded', renderTechnologyCards);

function renderTechnologyCards() {
    const container = document.getElementById('pd-dashboard-grid');
    if (!container) return;

    const groups = [
        'Мобильная связь', 'ШПД WiFi', 'ТВ', 'РВ',
        'Спутниковая связь', 'Проводная связь', 'Почтовая связь'
    ];

    container.replaceChildren();

    groups.forEach(category => {
        const group = document.createElement('section');
        group.className = 'pd-category-column';

        const heading = document.createElement('h3');
        heading.className = 'pd-category-column__heading';
        heading.textContent = category;
        group.appendChild(heading);

        const cards = document.createElement('div');
        cards.className = 'pd-category-column__cards';

        technologyCards
            .filter(item => item.category === category)
            .forEach(item => cards.appendChild(createCard(item)));

        if (category === 'Спутниковая связь') {
            cards.appendChild(createCard({
                title: 'Доступность КА', percent: 80, qty: 60,
                area: 1, capacity: 60, operators: 1
            }));
        }

        group.appendChild(cards);
        container.appendChild(group);
    });
}

function createCard(data) {
    const card = document.createElement('div');
    card.className = 'pd-card';

    const title = document.createElement('div');
    title.className = 'pd-card__title';
    title.textContent = data.title;
    card.appendChild(title);

    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'pd-chart-wrapper';

    const chart = document.createElement('div');
    chart.className = 'pd-mini-chart';
    chart.innerHTML = `
        <div class="zone-green"></div>
        <div class="zone-yellow"></div>
        <div class="zone-red"></div>
    `;
    chartWrapper.appendChild(chart);

    const arrowGroup = document.createElement('div');
    arrowGroup.className = 'pd-arrow-group';

    const arrowText = document.createElement('div');
    arrowText.className = 'pd-arrow-text';
    arrowText.innerHTML = 'Мощность<br>потребления';

    const arrow = document.createElement('div');
    arrow.className = 'pd-mini-arrow';
    arrow.textContent = '+7 кВт';

    arrowGroup.appendChild(arrowText);
    arrowGroup.appendChild(arrow);
    chartWrapper.appendChild(arrowGroup);
    card.appendChild(chartWrapper);

    const table = document.createElement('table');
    table.className = 'pd-card-table';

    const rows = [
        ['Обеспеч., %', data.percent],
        ['Кол-во', data.qty],
        ['Пл. кв. км', data.area],
        ['Ёмкость, аб.', data.capacity],
        ['Кол-во операт.', data.operators]
    ];

    rows.forEach(([label, value]) => {
        const tr = document.createElement('tr');

        const tdLabel = document.createElement('td');
        tdLabel.className = 'td-label';
        if (label === 'Обеспеч., %') tdLabel.classList.add('pd-positive');
        tdLabel.textContent = label;

        const tdValue = document.createElement('td');
        tdValue.className = 'td-value';
        if (label === 'Обеспеч., %') tdValue.classList.add('pd-positive');
        tdValue.textContent = value;

        tr.append(tdLabel, tdValue);
        table.appendChild(tr);
    });

    card.appendChild(table);
    return card;
}
