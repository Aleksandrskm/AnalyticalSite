'use strict';

const dashboardData = [
    {
        category: "ШПД wifi",
        items: [{ title: "Точки доступа", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 }]
    },
    {
        category: "Мобильная связь",
        items: [
            { title: "5G", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
            { title: "LTE (4G)", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
            { title: "GSM (2G)", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
            { title: "TETRA", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 }
        ]
    },
    {
        category: "ТВ",
        items: [{ title: "Вышки ТВ", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 }]
    },
    {
        category: "РВ",
        items: [{ title: "Вышки РВ", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 }]
    },
    {
        category: "Спутниковая связь",
        items: [{ title: "Спутниковые терминалы и телефоны", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 }]
    },
    {
        category: "Проводная связь",
        items: [
            { title: "Узлы связи", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
            { title: "Таксофоны", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 }
        ]
    },
    {
        category: "Почтовая связь",
        items: [{ title: "Почтовые отделения", percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 }]
    }
];

document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
});

function renderDashboard() {
    const container = document.getElementById('pd-dashboard-grid');
    if (!container) return;

    container.innerHTML = '';

    dashboardData.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'pd-category-group';

        // Заголовок группы
        const titleEl = document.createElement('div');
        titleEl.className = 'pd-category-title';
        titleEl.textContent = group.category;
        groupEl.appendChild(titleEl);

        // Контейнер для карточек (горизонтальный ряд)
        const cardsRow = document.createElement('div');
        cardsRow.className = 'pd-cards-row';

        group.items.forEach(item => {
            const card = createCard(item);
            cardsRow.appendChild(card);
        });

        groupEl.appendChild(cardsRow);
        container.appendChild(groupEl);
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
        ['Емкость, аб.', data.capacity],
        ['Кол-во операт.', data.operators]
    ];

    rows.forEach(([label, value]) => {
        const tr = document.createElement('tr');

        const tdLabel = document.createElement('td');
        tdLabel.className = 'td-label';
        tdLabel.textContent = label;

        const tdValue = document.createElement('td');
        tdValue.className = 'td-value';
        tdValue.textContent = value;

        tr.appendChild(tdLabel);
        tr.appendChild(tdValue);
        table.appendChild(tr);
    });

    card.appendChild(table);
    return card;
}