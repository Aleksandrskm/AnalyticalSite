'use strict';

// Демонстрационные значения, оставленные из исходной локальной версии.
// Порядок карточек повторяет схему на предоставленном скриншоте.
const technologyCards = [
    { title: '5G', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'LTE (4G)', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'Вышки ТВ', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'Вышки РВ', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'Точки доступа WiFi', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'Спутниковые терминалы и телефоны', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'Земные станции спутниковой связи', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'Узлы связи', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'Таксофоны', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'Почтовые отделения', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'GSM (2G)', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 },
    { title: 'TETRA', percent: 80, qty: 50, area: 1, capacity: 50, operators: 1 }
];

document.addEventListener('DOMContentLoaded', renderTechnologyCards);

function renderTechnologyCards() {
    const container = document.getElementById('pd-dashboard-grid');
    if (!container) return;

    container.replaceChildren();
    technologyCards.forEach(item => container.appendChild(createCard(item)));

    // Доступность КА оформлена так же, как остальные карточки.
    // Пока фактических данных нет, используются те же демонстрационные
    // значения, что и в остальных карточках, чтобы сохранить единый вид.
    container.appendChild(createCard({
        title: 'Доступность КА',
        percent: 80,
        qty: 50,
        area: 1,
        capacity: 50,
        operators: 1
    }));
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
        tdLabel.textContent = label;

        const tdValue = document.createElement('td');
        tdValue.className = 'td-value';
        tdValue.textContent = value;

        tr.append(tdLabel, tdValue);
        table.appendChild(tr);
    });

    card.appendChild(table);
    return card;
}
