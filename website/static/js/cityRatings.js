// cityRatings.js
'use strict';

import { Loader } from './Loader.js';
import {
    getRegions,
    getResKinds,
    getSettlementsPage,
    getResPage,
    getRatingSett,
    postRatingSett
} from './db.js';

let loader = null;

// Данные для населенных пунктов
let settlementsData = {
    items: [],
    total: 0,
    page: 0,
    pageSize: 100,
    allItems: []
};

// Данные для РЭС (для модального окна)
let resData = {
    items: [],
    total: 0,
    page: 0,
    pageSize: 1
};

let chartAllData = [];
let chartCurrentData = [];

// Текущий выбранный НП
let selectedSettlementId = null;
let selectedSettlementLat = null;
let selectedSettlementLon = null;
let selectedSettlementArea = null;
let selectedSettlementName = null;

// Текущие фильтры
let currentRegions = [];
let currentKinds = [];
let currentPopRange = { from: 1, to: 17000000 };

// Флаг отмены массового расчёта
let isCancelled = false;

// Флаг: был ли запущен расчет (POST разрешен)
let isCalculateMode = false;

// Массив всех полученных рейтингов (ключ — id НП)
let allRatings = {};

// Переменные для сортировки в таблице
let currentSortField = null;
let currentSortOrder = 'asc';
let currentSettlementsFiltered = [];

// Переменные для фильтрации
let currentFilterField = '';
let currentFilterValue = '';
let currentFilterExact = false;

// Флаг: показывать ли рейтинги в таблице
let showRatings = false;

// Сохраненные значения фильтра для восстановления
let savedFilterField = '';
let savedFilterValue = '';
let savedFilterExact = false;

// Сохраняем исходные данные для фильтрации
let originalDataForFilter = [];
let originalTotalForFilter = 0;

// Текущая страница для отображения
let currentDisplayPage = 0;

// Переменные для диаграммы
let ratingChart = null;
let isChartMode = false;
let chartType = 'provided'; // 'provided' | 'deficit' | 'norms_provided'

// Режим отображения: 'table' или 'chart'
let displayMode = 'table';

// Поиск по диаграмме
let chartSearchQuery = '';

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

// Список ID видов РЭС из Excel файла для фильтрации (числовые значения)
const allowedResKinds = [
    7, 128, 56, 31, 68, 30, 65, 99, 72, 15, 106, 114, 85, 4, 18, 10,
    82, 86, 83, 94, 115, 104, 22, 8, 75, 1, 46, 91, 45, 11, 37, 129,
    21, 112, 103, 92
];

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

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

// ==================== УПРАВЛЕНИЕ ПОДСКАЗКОЙ ====================

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

    // Скрываем кнопки действий
    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();

    // Скрываем фильтр
    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) filterContainer.remove();

    // Удаляем заголовок
    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    // Уничтожаем диаграмму если есть
    destroyChart();
}

function hidePlaceholder() {
    const placeholder = document.getElementById('placeholder-message');
    if (placeholder) placeholder.style.display = 'none';
}

// ==================== УПРАВЛЕНИЕ ДИАГРАММОЙ ====================




// ==================== СОЗДАНИЕ ДИАГРАММЫ ====================


// ==================== СОЗДАНИЕ ДИАГРАММЫ С МАСШТАБИРОВАНИЕМ ====================

// Переменные для хранения состояния зума
let zoomLevel = 1;
const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

// ==================== СОЗДАНИЕ ДИАГРАММЫ ====================

function createRatingChart(data, type) {
    const canvas = document.getElementById('rating-chart');
    if (!canvas) {
        console.error('Canvas для диаграммы не найден');
        return;
    }

    destroyChart();

    const ctx = canvas.getContext('2d');

    // Сохраняем все исходные данные
    chartAllData = [...data];
    chartCurrentData = [...data];
    chartType = type;

    // Получаем текущее значение сортировки из select (если он уже существует)
    const existingSortSelect = document.getElementById('chart-sort-select');
    let sortField = 'rating';
    if (existingSortSelect) {
        sortField = existingSortSelect.value;
    }

    // Применяем сортировку к исходным данным
    let sortedData = [...chartAllData];
    if (sortField === 'rating') {
        sortedData.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortField === 'name') {
        sortedData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    // Применяем поиск (если есть) к уже отсортированным данным
    let displayData = sortedData;
    if (chartSearchQuery.trim()) {
        const query = chartSearchQuery.trim().toLowerCase();
        displayData = sortedData.filter(item =>
            (item.name || '').toLowerCase().includes(query)
        );
    }

    // Сохраняем длину отображаемых данных (с учетом поиска)
    currentDisplayDataLength = displayData.length;

    const labels = displayData.map(item => item.name || `ID: ${item.id}`);
    const values = displayData.map(item => item.rating || 0);

    // Яркие цвета для столбцов
    const colors = values.map(value => {
        if (value > 50) return '#00cc44'; // Ярко-зеленый
        if (value > 25) return '#0066ff'; // Ярко-синий
        return '#ff6600'; // Ярко-оранжевый
    });

    // Проверяем, есть ли результаты поиска
    const isSearchActive = chartSearchQuery.trim().length > 0;
    const searchColors = displayData.map(item => {
        const name = (item.name || '').toLowerCase();
        const query = chartSearchQuery.trim().toLowerCase();
        if (isSearchActive && name.includes(query)) {
            return '#cc0000'; // Ярко-красный для совпадений
        }
        return null;
    });

    // Финальные цвета
    const finalColors = displayData.map((item, index) => {
        if (searchColors[index]) return searchColors[index];
        return colors[index];
    });

    let labelText = '';
    switch(type) {
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
                backgroundColor: finalColors,
                borderColor: finalColors.map(c => c),
                borderWidth: 1,
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
                            let label = `${context.dataset.label}: ${context.parsed.y !== undefined ? context.parsed.y.toFixed(2) : '0.00'}`;
                            if (item) {
                                label += `\nНаселение: ${item.population || 0}`;
                                label += `\nРегион: ${item.region_name || 'Н/Д'}`;
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
                        wheel: {
                            enabled: false
                        },
                        pinch: {
                            enabled: false
                        },
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
                            const name = (item.name || '').toLowerCase();
                            const query = chartSearchQuery.trim().toLowerCase();
                            if (chartSearchQuery.trim() && name.includes(query)) {
                                return '#990000';
                            }
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

                // Линия 25 - синяя (СПЛОШНАЯ)
                ctx2.save();
                ctx2.beginPath();
                ctx2.setLineDash([]);
                ctx2.strokeStyle = '#0055cc';
                ctx2.lineWidth = 2.5;
                ctx2.moveTo(xScale.left, y25);
                ctx2.lineTo(xScale.right, y25);
                ctx2.stroke();
                ctx2.restore();

                // Подпись для линии 25
                ctx2.save();
                ctx2.fillStyle = '#0055cc';
                ctx2.font = 'bold 12px Arial';
                ctx2.textAlign = 'right';
                ctx2.textBaseline = 'bottom';
                ctx2.fillText('25', xScale.right - 5, y25 - 3);
                ctx2.restore();

                // Линия 50 - зеленая (СПЛОШНАЯ)
                ctx2.save();
                ctx2.beginPath();
                ctx2.setLineDash([]);
                ctx2.strokeStyle = '#00cc44';
                ctx2.lineWidth = 2.5;
                ctx2.moveTo(xScale.left, y50);
                ctx2.lineTo(xScale.right, y50);
                ctx2.stroke();
                ctx2.restore();

                // Подпись для линии 50
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

    // Добавляем заголовок с информацией о количестве
    const chartContainer = document.getElementById('chart-container');
    if (chartContainer) {
        const existingTitle = chartContainer.querySelector('.chart-title');
        if (existingTitle) existingTitle.remove();

        const title = document.createElement('div');
        title.className = 'chart-title';
        let titleText = '';
        switch(type) {
            case 'provided': titleText = 'Обеспеченность населенных пунктов'; break;
            case 'deficit': titleText = 'Рейтинг дефицита населенных пунктов'; break;
            case 'norms_provided': titleText = 'Нормы обеспеченности населенных пунктов'; break;
            default: titleText = 'Рейтинг населенных пунктов';
        }
        const totalCount = sortedData.length;
        const displayCount = displayData.length;
        title.textContent = `${titleText} (всего ${totalCount} НП)`;
        if (chartSearchQuery.trim()) {
            title.textContent += `, найдено ${displayCount} по запросу "${chartSearchQuery}"`;
        }
        title.style.cssText = `
            text-align: center;
            font-size: 20px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 10px 0;
            flex-shrink: 0;
        `;
        chartContainer.prepend(title);
    }

    // Добавляем панель управления
    renderChartControls(sortField);

    // Скрываем пагинацию
    const paginationContainer = document.getElementById('settlements-pagination');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
    }

    // Инициализируем индексы зума для отображаемых данных
    zoomStartIndex = 0;
    zoomEndIndex = currentDisplayDataLength;

    // Устанавливаем границы оси X
    ratingChart.options.scales.x.min = 0;
    ratingChart.options.scales.x.max = currentDisplayDataLength;
    ratingChart.update();

    // Обновляем информацию о масштабе
    updateZoomInfo();
}



// ==================== ФУНКЦИИ МАСШТАБИРОВАНИЯ ====================

let zoomStartIndex = 0;
let zoomEndIndex = 0;
let currentDisplayDataLength = 0;

/**
 * Обновляет информацию о масштабе на панели управления
 */
function updateZoomInfo() {
    const info = document.getElementById('zoom-info');
    if (!info) return;

    // Если нет диаграммы или данных
    if (!ratingChart) {
        info.textContent = ' Нет данных';
        return;
    }

    // Получаем текущие данные (с учетом поиска)
    const dataLength = currentDisplayDataLength || ratingChart.data.labels.length || 0;

    // Если нет данных
    if (dataLength === 0) {
        info.textContent = ' Нет данных';
        return;
    }

    // Получаем реальные значения из диаграммы
    let actualMin = ratingChart.options.scales.x.min;
    let actualMax = ratingChart.options.scales.x.max;

    // Если min/max не заданы или равны undefined, используем наши индексы
    if (actualMin === undefined || actualMax === undefined) {
        actualMin = zoomStartIndex;
        actualMax = zoomEndIndex;
    }

    // Корректируем индексы
    const safeStart = Math.max(0, Math.min(Math.round(actualMin), dataLength - 1));
    const safeEnd = Math.max(1, Math.min(Math.round(actualMax), dataLength));
    const safeVisible = safeEnd - safeStart;

    // Сохраняем корректные значения
    zoomStartIndex = safeStart;
    zoomEndIndex = safeEnd;

    // Рассчитываем процент
    const percent = Math.round((safeVisible / dataLength) * 100);

    // Формируем сообщение
    if (safeVisible >= dataLength) {
        info.textContent = ` Видно: все ${dataLength} записей (100%)`;
    } else {
        info.textContent = ` Видно: ${safeVisible} из ${dataLength} (${percent}%)`;
    }
}

/**
 * Увеличивает масштаб (показывает меньше записей)
 */
function zoomIn() {
    if (!ratingChart) return;

    const dataLength = currentDisplayDataLength || ratingChart.data.labels.length || 0;
    if (dataLength === 0) return;

    // Получаем текущие видимые границы
    let currentMin = ratingChart.options.scales.x.min;
    let currentMax = ratingChart.options.scales.x.max;

    if (currentMin === undefined || currentMax === undefined) {
        currentMin = zoomStartIndex;
        currentMax = zoomEndIndex;
    }

    const currentVisible = Math.round(currentMax - currentMin);
    const newVisible = Math.max(2, Math.floor(currentVisible * 0.7));

    // Сохраняем левый край, меняем правый
    const newStart = Math.round(currentMin);
    const newEnd = Math.min(dataLength, newStart + newVisible);

    zoomStartIndex = newStart;
    zoomEndIndex = newEnd;

    applyZoom();
}

/**
 * Уменьшает масштаб (показывает больше записей)
 */
function zoomOut() {
    if (!ratingChart) return;

    const dataLength = currentDisplayDataLength || ratingChart.data.labels.length || 0;
    if (dataLength === 0) return;

    // Получаем текущие видимые границы
    let currentMin = ratingChart.options.scales.x.min;
    let currentMax = ratingChart.options.scales.x.max;

    if (currentMin === undefined || currentMax === undefined) {
        currentMin = zoomStartIndex;
        currentMax = zoomEndIndex;
    }

    const currentVisible = Math.round(currentMax - currentMin);
    const newVisible = Math.min(dataLength, Math.floor(currentVisible * 1.5));

    // Сохраняем левый край, меняем правый
    const newStart = Math.round(currentMin);
    const newEnd = Math.min(dataLength, newStart + newVisible);

    zoomStartIndex = newStart;
    zoomEndIndex = newEnd;

    applyZoom();
}

/**
 * Сбрасывает масштаб к начальному состоянию
 */
function resetZoom() {
    if (!ratingChart) return;

    const dataLength = currentDisplayDataLength || ratingChart.data.labels.length || 0;
    zoomStartIndex = 0;
    zoomEndIndex = dataLength;
    applyZoom();
}

/**
 * Применяет текущий масштаб к диаграмме
 */
function applyZoom() {
    if (!ratingChart) return;

    const dataLength = currentDisplayDataLength || ratingChart.data.labels.length || 0;
    if (dataLength === 0) return;

    // Убеждаемся что индексы корректны
    let start = Math.max(0, Math.round(zoomStartIndex));
    let end = Math.min(dataLength, Math.round(zoomEndIndex));

    // Минимальная видимая область - 2 элемента
    if (end - start < 2) {
        if (start >= dataLength - 1) {
            start = Math.max(0, dataLength - 2);
            end = dataLength;
        } else {
            end = Math.min(dataLength, start + 2);
        }
    }

    // Если start >= end, корректируем
    if (start >= end) {
        start = Math.max(0, end - 2);
    }
    if (start >= dataLength) {
        start = Math.max(0, dataLength - 2);
        end = dataLength;
    }

    // Сохраняем корректные индексы
    zoomStartIndex = start;
    zoomEndIndex = end;

    // Применяем zoom через min/max
    ratingChart.options.scales.x.min = start;
    ratingChart.options.scales.x.max = end;
    ratingChart.update();

    // Обновляем информацию о зуме
    updateZoomInfo();
}

/**
 * Обновляет информацию о масштабе при загрузке диаграммы
 */
function initZoomInfo() {
    const dataLength = currentDisplayDataLength || (ratingChart ? ratingChart.data.labels.length : 0) || 0;
    zoomStartIndex = 0;
    zoomEndIndex = dataLength;

    if (ratingChart) {
        ratingChart.options.scales.x.min = 0;
        ratingChart.options.scales.x.max = dataLength;
        ratingChart.update();
    }

    updateZoomInfo();
}





function renderChartControls(currentSortField) {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) return;

    // Удаляем старые элементы
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

    // ====== СОРТИРОВКА ======
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
        const searchInput = document.getElementById('chart-search-input');
        if (searchInput) {
            chartSearchQuery = searchInput.value;
        }
        const currentData = chartAllData.length > 0 ? chartAllData : [];
        createRatingChart(currentData, chartType);
    });
    controls.appendChild(sortSelect);

    // Разделитель
    const divider = document.createElement('span');
    divider.textContent = '|';
    divider.style.cssText = `
        color: #ccc !important;
        font-size: 22px !important;
        padding: 0 5px !important;
    `;
    controls.appendChild(divider);

    // ====== ПОИСК ======
    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Поиск:';
    searchLabel.style.cssText = `
        font-weight: 600 !important;
        font-size: 15px !important;
        color: #1a1a1a !important;
        white-space: nowrap !important;
    `;
    controls.appendChild(searchLabel);

    const searchInput = document.createElement('input');
    searchInput.id = 'chart-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Введите название НП...';
    searchInput.value = chartSearchQuery;
    searchInput.style.cssText = `
        flex: 1 !important;
        min-width: 180px !important;
        padding: 5px 12px !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        font-size: 14px !important;
        height: 34px !important;
        box-sizing: border-box !important;
    `;

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            chartSearchQuery = this.value;
            const currentData = chartAllData.length > 0 ? chartAllData : [];
            createRatingChart(currentData, chartType);
        }
    });
    controls.appendChild(searchInput);

    const searchBtn = document.createElement('button');
    searchBtn.textContent = 'Найти';
    searchBtn.title = 'Найти';
    searchBtn.style.cssText = `
        padding: 0 16px !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        background: #fff !important;
        cursor: pointer !important;
        font-size: 14px !important;
        height: 34px !important;
        font-weight: 500 !important;
    `;
    searchBtn.addEventListener('click', function() {
        chartSearchQuery = searchInput.value;
        const currentData = chartAllData.length > 0 ? chartAllData : [];
        createRatingChart(currentData, chartType);
    });
    controls.appendChild(searchBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '✕';
    clearBtn.title = 'Очистить поиск';
    clearBtn.style.cssText = `
        padding: 0 10px !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        background: #fff !important;
        cursor: pointer !important;
        font-size: 16px !important;
        height: 34px !important;
        color: #666 !important;
    `;
    clearBtn.addEventListener('click', function() {
        chartSearchQuery = '';
        searchInput.value = '';
        const currentData = chartAllData.length > 0 ? chartAllData : [];
        createRatingChart(currentData, chartType);
    });
    controls.appendChild(clearBtn);

    // Разделитель
    const divider2 = document.createElement('span');
    divider2.textContent = '|';
    divider2.style.cssText = `
        color: #ccc !important;
        font-size: 22px !important;
        padding: 0 5px !important;
    `;
    controls.appendChild(divider2);

    // ====== МАСШТАБ ======
    const zoomLabel = document.createElement('label');
    zoomLabel.textContent = 'Масштаб:';
    zoomLabel.style.cssText = `
        font-weight: 600 !important;
        font-size: 15px !important;
        color: #1a1a1a !important;
        white-space: nowrap !important;
    `;
    controls.appendChild(zoomLabel);

    // Кнопка увеличения
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

    // Кнопка уменьшения
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

    // Кнопка сброса зума
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

    // Информация о масштабе
    const zoomInfo = document.createElement('span');
    zoomInfo.id = 'zoom-info';
    zoomInfo.textContent = 'Видно: все';
    zoomInfo.style.cssText = `
        display: none;
        font-size: 14px !important;
        color: #555 !important;
        margin-left: auto !important;
        font-weight: 500 !important;
    `;
    controls.appendChild(zoomInfo);

    // Вставляем controls после заголовка
    const title = chartContainer.querySelector('.chart-title');
    if (title) {
        chartContainer.insertBefore(controls, title.nextSibling);
    } else {
        chartContainer.prepend(controls);
    }

    // Сбрасываем zoom при создании
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

// ==================== ПЕРЕОПРЕДЕЛЯЕМ ФУНКЦИЮ УНИЧТОЖЕНИЯ ====================

// ==================== УНИЧТОЖЕНИЕ ДИАГРАММЫ ====================

function destroyChart() {
    if (ratingChart) {
        ratingChart.destroy();
        ratingChart = null;
    }
    isChartMode = false;
    zoomStartIndex = 0;
    zoomEndIndex = 0;
    currentDisplayDataLength = 0;
}

// ==================== ПОКАЗ КОНТЕЙНЕРА ДИАГРАММЫ ====================

// ==================== ПОКАЗ КОНТЕЙНЕРА ДИАГРАММЫ ====================

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

    // СКРЫВАЕМ ТАБЛИЦУ И ПАГИНАЦИЮ
    if (table) table.style.display = 'none';
    if (pagination) {
        pagination.style.display = 'none';
        pagination.innerHTML = '';
    }
    if (divider) divider.style.display = 'none';
    if (placeholder) placeholder.style.display = 'none';

    // Скрываем кнопки действий для таблицы
    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();

    // Скрываем фильтр
    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) filterContainer.remove();

    // Удаляем заголовок таблицы
    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();
}

// ==================== СКРЫТИЕ КОНТЕЙНЕРА ДИАГРАММЫ ====================

function hideChartContainer() {
    const chartContainer = document.getElementById('chart-container');
    if (chartContainer) {
        chartContainer.style.display = 'none';
    }
    destroyChart();
    chartAllData = [];
    chartCurrentData = [];
}

function renderChartSearch() {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) return;

    // Удаляем старый поиск
    const oldSearch = document.getElementById('chart-search-container');
    if (oldSearch) oldSearch.remove();

    const container = document.createElement('div');
    container.id = 'chart-search-container';
    container.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 6px 0 !important;
        flex-shrink: 0 !important;
        margin-bottom: 4px !important;
    `;

    const label = document.createElement('label');
    label.textContent = 'Поиск по названию:';
    label.style.cssText = `
        font-size: 13px !important;
        font-weight: 600 !important;
        color: #1a1a1a !important;
        white-space: nowrap !important;
    `;
    container.appendChild(label);

    const input = document.createElement('input');
    input.id = 'chart-search-input';
    input.type = 'text';
    input.placeholder = 'Введите название НП...';
    input.value = chartSearchQuery;
    input.style.cssText = `
        flex: 1 !important;
        min-width: 150px !important;
        padding: 4px 10px !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        font-size: 13px !important;
        height: 30px !important;
        box-sizing: border-box !important;
    `;
    input.addEventListener('input', function() {
        chartSearchQuery = this.value;
        const currentData = chartAllData.length > 0 ? chartAllData : [];
        createRatingChart(currentData, chartType);
    });
    container.appendChild(input);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '✕';
    clearBtn.title = 'Очистить поиск';
    clearBtn.style.cssText = `
        padding: 0 8px !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        background: #fff !important;
        cursor: pointer !important;
        font-size: 14px !important;
        height: 30px !important;
        color: #666 !important;
    `;
    clearBtn.addEventListener('click', function() {
        chartSearchQuery = '';
        input.value = '';
        const currentData = chartAllData.length > 0 ? chartAllData : [];
        createRatingChart(currentData, chartType);
    });
    container.appendChild(clearBtn);

    chartContainer.appendChild(container);
}

// ==================== КНОПКИ ====================

// Кнопка "Рассчитать рейтинг всех НП в таблице"
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
    if (wiredBtn) wiredBtn.remove();

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

// Кнопка "Рассчитать рейтинг выбранного НП"
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

// ==================== КНОПКИ РЭС И ПРОВОДНЫЕ УС ====================

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

function showSettlementButtons() {
    const container = document.querySelector('.table_buttons');
    if (!container) return;

    if (isChartMode) {
        hideSettlementButtons();
        return;
    }

    const oldRes = document.getElementById('res-action-btn');
    if (oldRes) oldRes.remove();
    const oldWired = document.getElementById('wired-action-btn');
    if (oldWired) oldWired.remove();
    const oldCalcAll = document.getElementById('calculate-all-btn');
    if (oldCalcAll) oldCalcAll.remove();
    const oldCalcSelected = document.getElementById('calculate-selected-btn');
    if (oldCalcSelected) oldCalcSelected.remove();

    if (showRatings) {
        const calcAllBtn = createCalculateAllBtn();
        const calcSelectedBtn = createCalculateSelectedBtn();

        const firstBtn = container.querySelector('.grid-btn');
        if (firstBtn) {
            container.insertBefore(calcAllBtn, firstBtn);
            container.insertBefore(calcSelectedBtn, firstBtn);
        } else {
            container.appendChild(calcAllBtn);
            container.appendChild(calcSelectedBtn);
        }
    } else {
        const resBtn = createResButton();
        const wiredBtn = createWiredButton();

        const firstBtn = container.querySelector('.grid-btn');
        if (firstBtn) {
            container.insertBefore(resBtn, firstBtn);
            container.insertBefore(wiredBtn, firstBtn);
        } else {
            container.appendChild(resBtn);
            container.appendChild(wiredBtn);
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

        // Обработка URL параметров
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
        renderPopup(`Ошибка загрузки регионов: ${error.message}`, true);
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
        renderPopup(`Ошибка загрузки видов связи: ${error.message}`, true);
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

// ==================== РАСЧЕТ РАДИУСА ====================

function calculateRadius(area) {
    if (!area || area <= 0) return 1;
    const radius = Math.round(1.1 * Math.sqrt(area / Math.PI));
    return radius >= 1 ? radius : 1;
}

// ==================== ФУНКЦИИ СТРАНИЦ ====================

function getPageSize(tableType) {
    return settlementsData.pageSize || 100;
}

function getPage() {
    return 0;
}

// ==================== ФИЛЬТРАЦИЯ ДАННЫХ ====================

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
            const rating = ratings[row.id] || {};
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

// ==================== ЗАГРУЗКА НАСЕЛЕННЫХ ПУНКТОВ ====================

async function loadSettlements(page = 0, regions, popRange, pageSize) {
    const loader = initLoader();
    loader.show('Загрузка населенных пунктов...');

    try {
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
        renderPopup(`Ошибка загрузки населенных пунктов: ${error.message}`, true);
        console.error('Ошибка загрузки населенных пунктов:', error);
        return { items: [], total: 0 };
    }
}

// ==================== ЗАГРУЗКА РЕЙТИНГОВ С ВОЗМОЖНОСТЬЮ ОТМЕНЫ ====================

async function loadRatingsForSettlements(items, allowPost = false) {
    const total = items.length;
    if (total === 0) {
        renderPopup('Нет населенных пунктов для загрузки рейтингов', true);
        return;
    }

    const modal = createProgressModal(total);

    const titleEl = modal.querySelector('.progress-modal-title');
    if (titleEl) {
        titleEl.textContent = allowPost ? 'Расчет рейтингов' : 'Загрузка рейтингов';
    }

    isCancelled = false;

    let successCount = 0;
    let postCount = 0;
    let processed = 0;

    for (const settlement of items) {
        if (isCancelled) {
            closeProgressModal();
            renderPopup(
                allowPost
                    ? `Расчёт отменён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`
                    : `Загрузка отменена. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`,
                false
            );
            return;
        }

        try {
            if (!allRatings[settlement.id]) {
                let ratingData = null;
                let status200 = false;

                try {
                    ratingData = await getRatingSett(settlement.id);
                    if (ratingData !== null && ratingData !== undefined) {
                        allRatings[settlement.id] = ratingData;
                        successCount++;
                        status200 = true;
                    }
                } catch (err) {
                    console.warn(`▶ НП ${settlement.id}: ошибка GET`, err);
                }

                if (!status200 && allowPost) {
                    try {
                        await postRatingSett(settlement.id);
                        ratingData = await getRatingSett(settlement.id);
                        if (ratingData !== null && ratingData !== undefined) {
                            allRatings[settlement.id] = ratingData;
                            successCount++;
                            postCount++;
                        }
                    } catch (postErr) {
                        console.warn(`▶ НП ${settlement.id}: ошибка POST`, postErr);
                    }
                }
            }
        } catch (err) {
            console.warn(`▶ НП ${settlement.id}: ошибка обработки`, err);
        }

        processed++;
        updateProgress(processed, total, successCount);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    closeProgressModal();
}

// ==================== ОПТИМИЗИРОВАННАЯ СОРТИРОВКА ====================

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
            const rating = ratings[item.id] || {};
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

// ==================== ПОЛУЧЕНИЕ ДАННЫХ ДЛЯ ТЕКУЩЕЙ СТРАНИЦЫ ====================

function getPageData(allData, page, pageSize) {
    const start = page * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    return allData.slice(start, end);
}

// ==================== РАСЧЕТ РЕЙТИНГА ДЛЯ ВЫБРАННОГО НП ====================

async function handleCalculateSelected() {
    if (!selectedSettlementId) {
        renderPopup('Выберите населенный пункт в таблице', true);
        return;
    }

    const loader = initLoader();
    loader.show(`Расчет рейтинга для НП: ${selectedSettlementName || selectedSettlementId}...`);

    try {
        await postRatingSett(selectedSettlementId);
        const ratingData = await getRatingSett(selectedSettlementId);

        if (ratingData !== null && ratingData !== undefined) {
            allRatings[selectedSettlementId] = ratingData;

            const pageSize = getPageSize('settlements');

            if (savedFilterField && savedFilterValue) {
                renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
            } else {
                renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
            }

            renderPopup(`Рейтинг для НП "${selectedSettlementName || selectedSettlementId}" успешно рассчитан!`, false);
        } else {
            renderPopup(`Не удалось получить рейтинг для НП "${selectedSettlementName || selectedSettlementId}"`, true);
        }
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка расчета рейтинга: ${error.message}`, true);
        console.error('Ошибка расчета рейтинга:', error);
        return;
    }

    loader.close();
}

// ==================== РАСЧЕТ РЕЙТИНГА ВСЕХ НП В ТАБЛИЦЕ ====================

async function handleCalculateAll() {
    const items = currentSettlementsFiltered || settlementsData.items || [];

    if (items.length === 0) {
        renderPopup('Нет населенных пунктов для расчета', true);
        return;
    }

    const hasFilter = savedFilterField && savedFilterValue;
    let settlementsToCalculate = [];

    if (hasFilter) {
        settlementsToCalculate = items.map(item => ({
            id: item.id,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            area: parseFloat(item.area) || 1
        }));
    } else {
        settlementsToCalculate = items.map(item => ({
            id: item.id,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            area: parseFloat(item.area) || 1
        }));
    }

    const total = settlementsToCalculate.length;
    if (total === 0) {
        renderPopup('Нет населенных пунктов для расчёта', true);
        return;
    }

    renderPopup(`Начинаем расчет рейтингов для ${total} населенных пунктов...`, false);

    isCalculateMode = true;
    isCancelled = false;

    const modal = createProgressModal(total);

    let processed = 0;
    let successCount = 0;

    for (const settlement of settlementsToCalculate) {
        if (isCancelled) break;

        try {
            let ratingData = null;
            let status200 = false;

            if (allRatings[settlement.id]) {
                processed++;
                successCount++;
                updateProgress(processed, total, successCount);
                continue;
            }

            try {
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                }
            } catch (err) {
                console.warn(`▶ НП ${settlement.id}: GET ошибка`, err);
            }

            try {
                await postRatingSett(settlement.id);
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                }
            } catch (postErr) {
                console.warn(`▶ НП ${settlement.id}: POST ошибка`, postErr);
            }

            if (status200 && ratingData) {
                allRatings[settlement.id] = ratingData;
                processed++;
                successCount++;
            } else {
                processed++;
            }

            updateProgress(processed, total, successCount);
            await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
            console.error(`▶ НП ${settlement.id}: критическая ошибка`, error);
            processed++;
        }
    }

    closeProgressModal();

    if (isCancelled) {
        renderPopup(`Расчёт отменён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    } else {
        renderPopup(`Расчёт завершён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    }

    const pageSize = getPageSize('settlements');

    if (savedFilterField && savedFilterValue) {
        renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, true);
    } else {
        renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
    }
}

// ==================== ОБРАБОТЧИК ДВОЙНОГО КЛИКА ====================

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

                const rowData = {};
                const cells = row.querySelectorAll('td');
                const headers = this.querySelectorAll('thead th');

                headers.forEach((th, index) => {
                    if (cells[index]) {
                        let key = th.textContent.trim();
                        key = key.replace(/[▲▼]/g, '').trim();
                        rowData[key] = cells[index].textContent.trim();
                    }
                });

                showRowDataModal(rowData, 'settlement');
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

        const rowData = {};
        const cells = row.querySelectorAll('td');
        const headers = table.querySelectorAll('thead th');

        headers.forEach((th, index) => {
            if (cells[index]) {
                let key = th.textContent.trim();
                key = key.replace(/[▲▼]/g, '').trim();
                rowData[key] = cells[index].textContent.trim();
            }
        });

        document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
            tr.classList.remove('selected');
        });
        row.classList.add('selected');

        showRowDataModal(rowData, 'rating');
    });
}

// ==================== МОДАЛЬНОЕ ОКНО ДЛЯ ПОКАЗА ДАННЫХ СТРОКИ ====================

function showRowDataModal(data, type) {
    const existing = document.getElementById('row-data-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'row-data-modal';
    modal.className = 'res-modal-overlay';

    const content = document.createElement('div');
    content.className = 'res-modal-content';
    content.style.maxWidth = '700px';

    let titleText = 'Данные строки';
    if (type === 'settlement') {
        const name = data['Название'] || 'Н/Д';
        titleText = `Данные населенного пункта: ${name}`;
    } else if (type === 'rating') {
        const name = data['Название'] || 'Н/Д';
        titleText = `Данные рейтинга населенного пункта: ${name}`;
    }

    const title = document.createElement('h3');
    title.textContent = titleText;
    title.className = 'res-modal-title';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.className = 'res-modal-close-btn';
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'res-table-wrapper';
    tableWrapper.style.maxHeight = '70vh';

    const table = document.createElement('table');
    table.className = 'res-modal-table';
    table.style.width = '100%';

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    content.appendChild(title);
    content.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    Object.keys(data).forEach(key => {
        if (!key || key.trim() === '') return;

        const cleanKey = key.replace(/[▲▼]/g, '').trim();

        const row = document.createElement('tr');
        const th = document.createElement('th');
        th.textContent = cleanKey;
        th.style.cssText = 'text-align: left; padding: 8px 12px; border: 1px solid #ddd; background: #f2f2f2; width: 40%;';
        const td = document.createElement('td');
        td.textContent = data[key] || '-';
        td.style.cssText = 'padding: 8px 12px; border: 1px solid #ddd;';
        row.appendChild(th);
        row.appendChild(td);
        tbody.appendChild(row);
    });

    if (Object.keys(data).length === 0) {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 2;
        td.textContent = 'Нет данных для отображения';
        td.style.cssText = 'text-align: center; padding: 20px; border: 1px solid #ddd;';
        row.appendChild(td);
        tbody.appendChild(row);
    }
}

// ==================== ОТОБРАЖЕНИЕ ТАБЛИЦЫ (только НП) ====================

function renderSettlementsTableOnly(data, total, page, pageSize, keepFilter = false) {
    const table = document.getElementById('settlements-table');
    if (!table) {
        console.error('Таблица settlements-table не найдена');
        return;
    }

    // Скрываем диаграмму
    hideChartContainer();
    isChartMode = false;

    // ПОКАЗЫВАЕМ ТАБЛИЦУ
    table.style.display = 'block';

    hidePlaceholder();

    const oldSettlementsTitle = document.querySelector('.settlements-title');
    if (oldSettlementsTitle) oldSettlementsTitle.remove();

    const settlementsTitle = document.createElement('h3');
    settlementsTitle.className = 'settlements-title';
    settlementsTitle.textContent = 'Населенные пункты';
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

    // СОЗДАЕМ ФИЛЬТР
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

    // СОЗДАЕМ ЗАГОЛОВКИ
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

    // ЗАПОЛНЯЕМ ДАННЫМИ
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

    // ПОКАЗЫВАЕМ ПАГИНАЦИЮ
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

// ==================== ОТОБРАЖЕНИЕ ОБЪЕДИНЁННОЙ ТАБЛИЦЫ (НП + рейтинги) ====================

function renderCombinedTable(data, total, page, pageSize, keepFilter = false) {
    const table = document.getElementById('settlements-table');
    if (!table) {
        console.error('Таблица settlements-table не найдена');
        return;
    }

    // Скрываем диаграмму
    hideChartContainer();
    isChartMode = false;

    // ПОКАЗЫВАЕМ ТАБЛИЦУ
    table.style.display = 'block';

    hidePlaceholder();

    const oldSettlementsTitle = document.querySelector('.settlements-title');
    if (oldSettlementsTitle) oldSettlementsTitle.remove();

    const settlementsTitle = document.createElement('h3');
    settlementsTitle.className = 'settlements-title';
    settlementsTitle.textContent = 'Обеспеченность населенных пунктов';
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

    // СОЗДАЕМ ФИЛЬТР
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

    // СОЗДАЕМ ЗАГОЛОВКИ
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

    // ЗАПОЛНЯЕМ ДАННЫМИ
    if (tbody) {
        pageData.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id;
            row.dataset.lat = item.lat;
            row.dataset.lon = item.lon;
            row.dataset.area = item.area || 1;
            row.dataset.name = item.name || '';
            row.className = 'clickable-row';

            const rating = allRatings[item.id] || {};

            // Создаем все ячейки
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

    // ПОКАЗЫВАЕМ ПАГИНАЦИЮ
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

// ==================== ЗАГРУЗКА РЭС (для модального окна) ====================

async function loadResForModal(settlementId, lat, lon, area) {
    if (!settlementId || lat === undefined || lon === undefined) {
        renderPopup('Выберите населенный пункт в таблице', true);
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
            renderPopup('Нет РЭС для выбранного населенного пункта');
        }

        loader.close();
    } catch (error) {
        loader.close();
        renderPopup(`Ошибка загрузки РЭС: ${error.message}`, true);
        console.error('Ошибка загрузки РЭС:', error);
    }
}

// ==================== МОДАЛЬНОЕ ОКНО С РЭС ====================

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
        border: 1px solid #ddd;
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
            cell.style.cssText = 'text-align: center; padding: 30px; font-size: 16px; color: #666;';
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
                border: 1px solid #1a1a1a;
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
                    border: 1px solid #1a1a1a;
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
                border-bottom: 1px solid #eee;
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

// ==================== МАССОВЫЙ РАСЧЁТ РЕЙТИНГОВ ====================

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
        renderPopup('Нет населенных пунктов для получения рейтингов', true);
        return;
    }

    await loadRatingsForSettlements(items, false);

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
        renderPopup('Нет населенных пунктов для расчёта', true);
        return;
    }

    const modal = createProgressModal(total);

    let processed = 0;
    let successCount = 0;

    for (const settlement of settlements) {
        if (isCancelled) break;

        try {
            let ratingData = null;
            let status200 = false;

            if (allRatings[settlement.id]) {
                processed++;
                successCount++;
                updateProgress(processed, total, successCount);
                continue;
            }

            try {
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                }
            } catch (err) {
                console.warn(`▶ НП ${settlement.id}: GET ошибка`, err);
            }

            try {
                await postRatingSett(settlement.id);
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                }
            } catch (postErr) {
                console.warn(`▶ НП ${settlement.id}: POST ошибка`, postErr);
            }

            if (status200 && ratingData) {
                allRatings[settlement.id] = ratingData;
                processed++;
                successCount++;
            } else {
                processed++;
            }

            updateProgress(processed, total, successCount);
            await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
            console.error(`▶ НП ${settlement.id}: критическая ошибка`, error);
            processed++;
        }
    }

    closeProgressModal();

    if (isCancelled) {
        renderPopup(`Расчёт отменён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    } else {
        renderPopup(`Расчёт завершён. Обработано ${processed} из ${total}, получено ${successCount} рейтингов.`, false);
    }

    const pageSize = getPageSize('settlements');
    renderCombinedTable(settlementsData.items, settlementsData.total, currentDisplayPage, pageSize);
}

// ==================== ОБРАБОТЧИКИ КНОПОК ====================

// Новая функция для кнопки "Обеспеченность НП" (таблица с радиокнопками)
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
        renderPopup('Выберите хотя бы один регион', true);
        return;
    }

    currentRegions = regions;
    currentPopRange = popRange;
    currentKinds = kinds;

    const pageSize = getPageSize('settlements');
    const page = getPage();
    const result = await loadSettlements(page, regions, popRange, pageSize);

    if (!result || result.items.length === 0) {
        renderPopup('Нет населенных пунктов для выбранных фильтров', true);
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

    // Создаем радиокнопки для переключения режима
    createViewModeToggle();

    // По умолчанию показываем таблицу
    displayMode = 'table';
    renderCombinedTable(originalDataForFilter, originalTotalForFilter, 0, pageSize, false);

    showSettlementButtons();

    renderPopup(`Загружено ${settlementsData.total} населенных пунктов с рейтингами`);
}

// Функция создания переключателя режима отображения
function createViewModeToggle() {
    const oldToggle = document.getElementById('view-mode-toggle');
    if (oldToggle) oldToggle.remove();

    const tableContainer = document.querySelector('.table__rating');
    if (!tableContainer) return;

    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'view-mode-toggle';
    toggleContainer.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 20px !important;
        padding: 10px 15px !important;
        background: #f5f5f5 !important;
        border-radius: 6px !important;
        margin-bottom: 10px !important;
        flex-shrink: 0 !important;
        border: 1px solid #ddd !important;
    `;

    const label = document.createElement('span');
    label.textContent = 'Режим отображения:';
    label.style.cssText = `
        font-weight: 600 !important;
        color: #1a1a1a !important;
        font-size: 14px !important;
    `;
    toggleContainer.appendChild(label);

    // Таблица
    const tableRadio = document.createElement('label');
    tableRadio.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
        cursor: pointer !important;
        font-size: 13px !important;
        color: #1a1a1a !important;
    `;
    const tableInput = document.createElement('input');
    tableInput.type = 'radio';
    tableInput.name = 'view-mode';
    tableInput.value = 'table';
    tableInput.checked = displayMode === 'table';
    tableInput.addEventListener('change', function() {
        if (this.checked) {
            displayMode = 'table';
            showRatings = true;
            const pageSize = getPageSize('settlements');
            renderCombinedTable(originalDataForFilter, originalTotalForFilter, currentDisplayPage, pageSize, false);
        }
    });
    tableRadio.appendChild(tableInput);
    tableRadio.appendChild(document.createTextNode('Таблица'));
    toggleContainer.appendChild(tableRadio);

    // Диаграмма
    const chartRadio = document.createElement('label');
    chartRadio.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
        cursor: pointer !important;
        font-size: 13px !important;
        color: #1a1a1a !important;
    `;
    const chartInput = document.createElement('input');
    chartInput.type = 'radio';
    chartInput.name = 'view-mode';
    chartInput.value = 'chart';
    chartInput.checked = displayMode === 'chart';
    chartInput.addEventListener('change', function() {
        if (this.checked) {
            displayMode = 'chart';
            switchToChartMode();
        }
    });
    chartRadio.appendChild(chartInput);
    chartRadio.appendChild(document.createTextNode('Диаграмма'));
    toggleContainer.appendChild(chartRadio);

    tableContainer.prepend(toggleContainer);
}

// ==================== ПЕРЕКЛЮЧЕНИЕ НА РЕЖИМ ДИАГРАММЫ ====================

function switchToChartMode() {
    chartType = 'provided';
    isChartMode = true;

    // Подготавливаем данные для диаграммы
    const chartData = settlementsData.items.map(item => {
        const rating = allRatings[item.id] || {};
        return {
            id: item.id,
            name: item.name,
            region_name: item.region_name,
            population: item.population,
            rating: rating.rating || 0
        };
    });

    // Сортируем по рейтингу
    chartData.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    // Показываем диаграмму
    showChartContainer();
    createRatingChart(chartData, 'provided');

    // Скрываем кнопки действий
    hideSettlementButtons();
    hideCalculateAllButton();
    hideCalculateSelectedButton();

    // Скрываем фильтр
    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) filterContainer.remove();

    // Удаляем заголовок таблицы
    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    // Скрываем пагинацию
    const paginationContainer = document.getElementById('settlements-pagination');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
        paginationContainer.innerHTML = '';
    }
}

// Обработчик для кнопки "Таблица населенных пунктов"
async function handleSettlementsButton() {
    isCalculateMode = false;
    isChartMode = false;

    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;
    currentDisplayPage = 0;

    // Удаляем переключатель режима
    const toggle = document.getElementById('view-mode-toggle');
    if (toggle) toggle.remove();

    showResPageSize();

    const regions = getSelectedRegions();
    const popRange = getPopulationRange();
    const kinds = getSelectedKinds();

    if (regions.length === 0) {
        renderPopup('Выберите хотя бы один регион', true);
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

        renderPopup(`Загружено ${settlementsData.total} населенных пунктов`);
    }
}

// ==================== ОСТАЛЬНЫЕ ОБРАБОТЧИКИ ====================

async function handleResButton() {
    if (!selectedSettlementId) {
        renderPopup('Выберите населенный пункт в таблице', true);
        return;
    }
    await loadResForModal(selectedSettlementId, selectedSettlementLat, selectedSettlementLon, selectedSettlementArea);
}

async function handleWiredButton() {
    renderPopup('Функция "Проводные УС" в разработке');
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
            const allOpt = regionSelect.querySelector('option[value="all"]');
            if (allOpt) allOpt.selected = true;
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

    // Удаляем переключатель режима
    const toggle = document.getElementById('view-mode-toggle');
    if (toggle) toggle.remove();

    hideResPageSize();

    const resModal = document.getElementById('res-modal');
    if (resModal) resModal.remove();

    // Очищаем таблицу
    const settlementsTable = document.getElementById('settlements-table');
    if (settlementsTable) {
        const thead = settlementsTable.querySelector('thead');
        const tbody = settlementsTable.querySelector('tbody');
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '';
    }

    // Очищаем пагинацию
    const paginationContainer = document.getElementById('settlements-pagination');
    if (paginationContainer) paginationContainer.innerHTML = '';

    // Удаляем заголовок
    const settlementsTitle = document.querySelector('.settlements-title');
    if (settlementsTitle) settlementsTitle.remove();

    // Скрываем диаграмму
    hideChartContainer();
    chartAllData = [];
    chartCurrentData = [];

    // Сбрасываем состояние
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
    displayMode = 'table';
    chartSearchQuery = '';

    // Показываем placeholder
    showPlaceholder();

    renderPopup('Фильтры сброшены к значениям по умолчанию');
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

    // Удаляем старые кнопки, добавляем новые
    // Кнопка "Обеспеченность НП" (таблица + диаграмма с переключателем)
    document.getElementById('btn-rating').addEventListener('click', handleRatingButton);

    // Кнопка "Таблица населенных пунктов"
    document.getElementById('btn-settlements').addEventListener('click', handleSettlementsButton);

    // Удаляем кнопки, которые больше не нужны
    const btnRatingProvided = document.getElementById('btn-rating-provided');
    // if (btnRatingProvided) btnRatingProvided.remove();

    const btnRatingDeficit = document.getElementById('btn-rating-deficit');
    // if (btnRatingDeficit) btnRatingDeficit.remove();

    const btnNormProvided = document.getElementById('btn-norm-provided');
    // if (btnNormProvided) btnNormProvided.remove();

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

    // Проверяем URL параметры и автоматически загружаем диаграмму
    const urlParams = new URLSearchParams(window.location.search);
    const regionsParam = urlParams.get('regions');
    if (regionsParam) {
        setTimeout(async () => {
            const selectedCount = document.getElementById('region').selectedOptions.length;
            if (selectedCount > 0) {
                // Загружаем данные и показываем диаграмму
                await handleRatingButton();
                // Переключаем на диаграмму
                displayMode = 'chart';
                const chartRadio = document.querySelector('input[name="view-mode"][value="chart"]');
                if (chartRadio) {
                    chartRadio.checked = true;
                }
                switchToChartMode();
            }
        }, 500);
    }
});