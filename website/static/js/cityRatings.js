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

let chartCurrentPage = 0;
let chartPageSize = 50;
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
let chartType = 'provided'; // 'provided' | 'deficit' | 'norms_provided' | 'norms_consumption'

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

    // Удаляем пагинацию диаграммы
    const oldChartPagination = document.getElementById('chart-pagination');
    if (oldChartPagination) oldChartPagination.remove();

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

    // Удаляем заголовок диаграммы
    const chartTitle = document.querySelector('.chart-title');
    if (chartTitle) chartTitle.remove();

    // Уничтожаем диаграмму если есть
    destroyChart();
}

function hidePlaceholder() {
    const placeholder = document.getElementById('placeholder-message');
    if (placeholder) placeholder.style.display = 'none';

    // Показываем таблицу по умолчанию (если данные есть)
    const table = document.getElementById('settlements-table');
    if (table && settlementsData.items && settlementsData.items.length > 0) {
        table.style.display = 'block';
    }
}

// ==================== УПРАВЛЕНИЕ ДИАГРАММОЙ ====================

function destroyChart() {
    if (ratingChart) {
        ratingChart.destroy();
        ratingChart = null;
    }
    isChartMode = false;
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
    }

    // СКРЫВАЕМ ТАБЛИЦУ
    if (table) table.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    if (divider) divider.style.display = 'none';
    if (placeholder) placeholder.style.display = 'none';

    // Удаляем старую пагинацию диаграммы
    const oldChartPagination = document.getElementById('chart-pagination');
    if (oldChartPagination) oldChartPagination.remove();

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

function hideChartContainer() {
    const chartContainer = document.getElementById('chart-container');
    if (chartContainer) {
        chartContainer.style.display = 'none';
        // Удаляем пагинацию диаграммы
        const chartPagination = document.getElementById('chart-pagination');
        if (chartPagination) chartPagination.remove();
    }
    destroyChart();
    chartAllData = [];
    chartCurrentData = [];
    chartCurrentPage = 0;

    // Удаляем заголовок диаграммы
    const chartTitle = document.querySelector('.chart-title');
    if (chartTitle) chartTitle.remove();
}

// ==================== СОЗДАНИЕ ДИАГРАММЫ ====================

function createRatingChart(data, type, page = 0, pageSize = 50) {
    const canvas = document.getElementById('rating-chart');
    if (!canvas) {
        console.error('Canvas для диаграммы не найден');
        return;
    }

    destroyChart();

    // Удаляем старую пагинацию диаграммы
    const oldChartPagination = document.getElementById('chart-pagination');
    if (oldChartPagination) oldChartPagination.remove();

    const ctx = canvas.getContext('2d');

    // Сортируем данные по рейтингу (по убыванию)
    const sortedData = [...data].sort((a, b) => {
        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0;
        return ratingB - ratingA;
    });

    // Сохраняем все данные для пагинации
    chartAllData = sortedData;
    chartCurrentPage = page;
    chartPageSize = pageSize;

    // Берем данные для текущей страницы
    const start = page * pageSize;
    const end = Math.min(start + pageSize, sortedData.length);
    const pageData = sortedData.slice(start, end);
    chartCurrentData = pageData;

    const labels = pageData.map(item => item.name || `ID: ${item.id}`);
    const values = pageData.map(item => item.rating || 0);

    // Оранжевый цвет
    const color = '#e67e22';
    const backgroundColor = 'rgba(230, 126, 34, 0.7)';
    const backgroundColorLight = 'rgba(230, 126, 34, 0.3)';

    let labelText = '';
    switch(type) {
        case 'provided': labelText = 'Рейтинг обеспеченности'; break;
        case 'deficit': labelText = 'Рейтинг дефицита'; break;
        case 'norms_provided': labelText = 'Нормы обеспеченности'; break;
        case 'norms_consumption': labelText = 'Нормы потребления'; break;
        default: labelText = 'Рейтинг';
    }

    // Создаем градиент для столбцов
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, backgroundColorLight);

    // Находим максимальное значение для масштабирования
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values.filter(v => v > 0), 0);

    ratingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: labelText,
                data: values,
                backgroundColor: gradient,
                borderColor: color,
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.8,
                categoryPercentage: 0.9,
                // Добавляем минимальную высоту для столбцов
                minBarLength: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // Увеличиваем область взаимодействия
            interaction: {
                mode: 'index',
                intersect: false,
                axis: 'x'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        color: '#1a1a1a',
                        padding: 15
                    }
                },
                tooltip: {
                    // Увеличиваем чувствительность тултипа
                    intersect: false,
                    mode: 'index',
                    // Делаем тултип более заметным
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
                            const item = pageData[context.dataIndex];
                            let label = `${context.dataset.label}: ${context.parsed.y !== undefined ? context.parsed.y.toFixed(2) : '0.00'}`;
                            if (item) {
                                label += `\nНаселение: ${item.population || 0}`;
                                label += `\nРегион: ${item.region_name || 'Н/Д'}`;
                                label += `\nID: ${item.id}`;
                            }
                            return label;
                        },
                        title: function(context) {
                            const item = pageData[context[0].dataIndex];
                            return item ? item.name || `ID: ${item.id}` : '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        font: {
                            size: 10
                        },
                        color: '#1a1a1a'
                    }
                },
                y: {
                    beginAtZero: true,
                    // Добавляем небольшой отступ сверху для лучшего отображения
                    suggestedMin: 0,
                    suggestedMax: maxValue * 1.1,
                    grid: {
                        color: 'rgba(0,0,0,0.08)'
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#1a1a1a',
                        // Форматируем значения
                        callback: function(value) {
                            if (value === 0) return '0';
                            if (value < 1) return value.toFixed(2);
                            if (value < 10) return value.toFixed(1);
                            return value.toFixed(0);
                        }
                    },
                    title: {
                        display: true,
                        text: 'Значение рейтинга',
                        color: '#1a1a1a',
                        font: {
                            size: 13,
                            weight: 'bold'
                        }
                    }
                }
            },
            // Анимация
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
            // Увеличиваем область для взаимодействия
            hover: {
                mode: 'index',
                intersect: false,
                animationDuration: 200
            },
            // Делаем столбцы более чувствительными
            elements: {
                bar: {
                    backgroundColor: gradient,
                    borderColor: color,
                    borderWidth: 1,
                    borderRadius: 4,
                    // Увеличиваем область наведения
                    hoverBackgroundColor: color,
                    hoverBorderColor: '#1a1a1a',
                    hoverBorderWidth: 2
                }
            }
        },
        // Добавляем плагин для отображения значений на столбцах
        plugins: [{
            id: 'valueLabels',
            afterDraw: function(chart) {
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;

                chart.data.datasets.forEach(function(dataset, i) {
                    const meta = chart.getDatasetMeta(i);

                    meta.data.forEach(function(bar, index) {
                        const dataValue = dataset.data[index];
                        // Показываем значения только если они больше 0
                        if (dataValue > 0) {
                            const x = bar.x;
                            const y = bar.y - 5;

                            ctx.save();
                            ctx.fillStyle = '#1a1a1a';
                            ctx.font = '10px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';

                            // Форматируем значение
                            let displayValue = dataValue;
                            if (typeof displayValue === 'number') {
                                if (displayValue < 1) {
                                    displayValue = displayValue.toFixed(2);
                                } else if (displayValue < 10) {
                                    displayValue = displayValue.toFixed(1);
                                } else {
                                    displayValue = displayValue.toFixed(0);
                                }
                            }

                            ctx.fillText(displayValue, x, y);
                            ctx.restore();
                        }
                    });
                });
            }
        }]
    });

    // Добавляем заголовок с информацией о количестве
    const chartContainer = document.getElementById('chart-container');
    if (chartContainer) {
        const existingTitle = chartContainer.querySelector('.chart-title');
        if (existingTitle) existingTitle.remove();

        const title = document.createElement('div');
        title.className = 'chart-title';
        let titleText = '';
        switch(type) {
            case 'provided': titleText = 'Рейтинг обеспеченности населенных пунктов'; break;
            case 'deficit': titleText = 'Рейтинг дефицита населенных пунктов'; break;
            case 'norms_provided': titleText = 'Нормы обеспеченности населенных пунктов'; break;
            case 'norms_consumption': titleText = 'Нормы потребления населенных пунктов'; break;
            default: titleText = 'Рейтинг населенных пунктов';
        }
        // title.textContent = `${titleText} (показано ${pageData.length} из ${sortedData.length})`;
        title.style.cssText = `
            text-align: center;
            font-size: 16px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 8px 0;
            flex-shrink: 0;
        `;
        chartContainer.prepend(title);
    }

    isChartMode = true;

    // Добавляем пагинацию для диаграммы
    renderChartPagination(sortedData.length, page, Math.ceil(sortedData.length / pageSize), pageSize, type);
}



function renderChartPagination(total, currentPage, totalPages, pageSize, chartType) {
    // Удаляем старую пагинацию
    const oldPagination = document.getElementById('chart-pagination');
    if (oldPagination) oldPagination.remove();

    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) return;

    const container = document.createElement('div');
    container.id = 'chart-pagination';
    container.style.cssText = `
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
        padding: 8px 0 !important;
        flex-shrink: 0 !important;
        border-top: 1px solid #ddd !important;
        margin-top: 8px !important;
        background: #f9f9f9 !important;
        border-radius: 4px !important;
        padding-left: 10px !important;
        padding-right: 10px !important;
    `;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'pagination-info';
    infoDiv.style.cssText = `
        font-size: 13px !important;
        color: black !important;
        font-weight: 550 !important;
    `;
    infoDiv.textContent = `Всего НП: ${total}, Страница ${currentPage + 1} из ${totalPages || 1}`;
    container.appendChild(infoDiv);

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'pagination-controls';
    controlsDiv.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
    `;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.className = 'pagination-btn';
    prevBtn.style.cssText = `
        min-width: 28px !important;
        height: 28px !important;
        padding: 0 8px !important;
        border: 1px solid #333 !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        background: ${currentPage === 0 ? '#eee' : '#fff'} !important;
        color: ${currentPage === 0 ? '#999' : '#333'} !important;
        cursor: ${currentPage === 0 ? 'default' : 'pointer'} !important;
        font-weight: 600 !important;
        opacity: ${currentPage === 0 ? '0.5' : '1'} !important;
    `;
    prevBtn.disabled = currentPage === 0;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 0) {
            createRatingChart(chartAllData, chartType, currentPage - 1, pageSize);
        }
    });
    controlsDiv.appendChild(prevBtn);

    const pageInput = document.createElement('input');
    pageInput.type = 'number';
    pageInput.className = 'page-input';
    pageInput.style.cssText = `
        width: 36px !important;
        height: 28px !important;
        padding: 0 4px !important;
        border: 1px solid #333 !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        background: #fff !important;
        color: #333 !important;
        text-align: center !important;
        box-sizing: border-box !important;
    `;
    pageInput.min = 1;
    pageInput.max = totalPages || 1;
    pageInput.value = currentPage + 1;
    pageInput.addEventListener('change', function() {
        let val = parseInt(this.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > totalPages) val = totalPages || 1;
        this.value = val;
        const pageIndex = val - 1;
        if (pageIndex !== currentPage) {
            createRatingChart(chartAllData, chartType, pageIndex, pageSize);
        }
    });
    controlsDiv.appendChild(pageInput);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.className = 'pagination-btn';
    nextBtn.style.cssText = `
        min-width: 28px !important;
        height: 28px !important;
        padding: 0 8px !important;
        border: 1px solid #333 !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        background: ${currentPage >= totalPages - 1 || totalPages === 0 ? '#eee' : '#fff'} !important;
        color: ${currentPage >= totalPages - 1 || totalPages === 0 ? '#999' : '#333'} !important;
        cursor: ${currentPage >= totalPages - 1 || totalPages === 0 ? 'default' : 'pointer'} !important;
        font-weight: 600 !important;
        opacity: ${currentPage >= totalPages - 1 || totalPages === 0 ? '0.5' : '1'} !important;
    `;
    nextBtn.disabled = currentPage >= totalPages - 1 || totalPages === 0;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages - 1) {
            createRatingChart(chartAllData, chartType, currentPage + 1, pageSize);
        }
    });
    controlsDiv.appendChild(nextBtn);

    const pageSizeSelect = document.createElement('select');
    pageSizeSelect.className = 'page-size-select';
    pageSizeSelect.style.cssText = `
        height: 28px !important;
        padding: 0 6px !important;
        border: 1px solid #333 !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        background: #fff !important;
        color: #333 !important;
        min-width: 44px !important;
        cursor: pointer !important;
    `;

    const sizes = [10, 20, 50, 100];
    sizes.forEach(size => {
        const opt = document.createElement('option');
        opt.value = size;
        opt.textContent = size;
        if (size === pageSize) opt.selected = true;
        pageSizeSelect.appendChild(opt);
    });

    pageSizeSelect.addEventListener('change', function() {
        const newSize = parseInt(this.value);
        chartPageSize = newSize;
        createRatingChart(chartAllData, chartType, 0, newSize);
    });
    controlsDiv.appendChild(pageSizeSelect);

    container.appendChild(controlsDiv);
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

    // Проверяем, существует ли уже кнопка
    let btn = document.getElementById('calculate-selected-btn');
    if (!btn) {
        btn = createCalculateSelectedBtn();
        // Вставляем после кнопки "Рассчитать рейтинг всех НП"
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

    // Если режим диаграммы - скрываем все
    if (isChartMode) {
        hideSettlementButtons();
        return;
    }

    // Удаляем старые кнопки
    const oldRes = document.getElementById('res-action-btn');
    if (oldRes) oldRes.remove();
    const oldWired = document.getElementById('wired-action-btn');
    if (oldWired) oldWired.remove();
    const oldCalcAll = document.getElementById('calculate-all-btn');
    if (oldCalcAll) oldCalcAll.remove();
    const oldCalcSelected = document.getElementById('calculate-selected-btn');
    if (oldCalcSelected) oldCalcSelected.remove();

    if (showRatings) {
        // Показываем кнопки для режима рейтингов
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
        // Показываем кнопки для режима таблицы НП
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
            // ОБЯЗАТЕЛЬНО убираем пробелы с помощью trim()
            option.value = String(region.number).trim();
            option.textContent = region.name;
            select.appendChild(option);
        });

        // Обработка URL параметров
        const urlParams = new URLSearchParams(window.location.search);
        const regionsParam = urlParams.get('regions');

        if (regionsParam) {
            // Разбиваем строку и убираем пробелы
            const regionIds = regionsParam.split(',').map(id => id.trim());
            console.log('▶ Запрошенные регионы из URL:', regionIds);

            // Снимаем все выделения
            const allOptions = select.querySelectorAll('option');
            allOptions.forEach(opt => opt.selected = false);

            // Ищем и выделяем нужные опции
            let foundCount = 0;
            allOptions.forEach(opt => {
                // Пропускаем "Все регионы"
                if (opt.value === 'all') return;

                // Приводим значение опции к строке и убираем пробелы
                const optValue = String(opt.value).trim();
                console.log(`▶ Проверяем опцию: "${optValue}" vs ${regionIds}`);

                // Проверяем, есть ли значение опции в списке
                if (regionIds.includes(optValue)) {
                    opt.selected = true;
                    foundCount++;
                    console.log(`▶ Найден регион: ${optValue} - ${opt.textContent}`);
                }
            });

            console.log(`▶ Найдено регионов: ${foundCount} из ${regionIds.length}`);

            // Если ничего не найдено, выбираем "Все регионы"
            if (foundCount === 0) {
                const allOpt = select.querySelector('option[value="all"]');
                if (allOpt) allOpt.selected = true;
                console.log('▶ Регионы не найдены, выбраны все');
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
        let val = selectedOptions[i].value;
        // Убираем пробелы
        val = String(val).trim();

        if (val === 'all') {
            // Если выбрано "Все регионы", возвращаем все ID
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
        'rating', // НОВОЕ ПОЛЕ
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
                        console.log(`▶ НП ${settlement.id}: рейтинг получен через GET`);
                    } else {
                        console.log(`▶ НП ${settlement.id}: GET вернул null`);
                    }
                } catch (err) {
                    console.warn(`▶ НП ${settlement.id}: ошибка GET`, err);
                }

                if (!status200 && allowPost) {
                    try {
                        console.log(`▶ НП ${settlement.id}: отправляем POST...`);
                        await postRatingSett(settlement.id);
                        ratingData = await getRatingSett(settlement.id);
                        if (ratingData !== null && ratingData !== undefined) {
                            allRatings[settlement.id] = ratingData;
                            successCount++;
                            postCount++;
                            console.log(`▶ НП ${settlement.id}: рейтинг создан через POST и получен через GET`);
                        }
                    } catch (postErr) {
                        console.warn(`▶ НП ${settlement.id}: ошибка POST`, postErr);
                    }
                }
            } else {
                console.log(`▶ НП ${settlement.id}: рейтинг уже есть в кеше`);
            }
        } catch (err) {
            console.warn(`▶ НП ${settlement.id}: ошибка обработки`, err);
        }

        processed++;
        updateProgress(processed, total, successCount);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    closeProgressModal();
    console.log(`▶ Загружено ${successCount} рейтингов (из них создано через POST: ${postCount})`);
}

// ==================== ОПТИМИЗИРОВАННАЯ СОРТИРОВКА ====================

function sortDataWithRatings(data, ratings, sortField, sortOrder) {
    if (!sortField || data.length === 0) return data;

    const ratingFields = [
        'rating', // НОВОЕ ПОЛЕ
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

        console.log(`▶ Обработка НП ID ${settlement.id}...`);

        try {
            let ratingData = null;
            let status200 = false;

            if (allRatings[settlement.id]) {
                console.log(`▶ НП ${settlement.id}: рейтинг уже есть в кеше`);
                processed++;
                successCount++;
                updateProgress(processed, total, successCount);
                continue;
            }

            try {
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                    console.log(`▶ НП ${settlement.id}: данные получены через GET`);
                } else {
                    console.log(`▶ НП ${settlement.id}: GET вернул null, пробуем POST`);
                }
            } catch (err) {
                console.warn(`▶ НП ${settlement.id}: GET ошибка`, err);
            }

            console.log(`▶ НП ${settlement.id}: отправляем POST...`);
            try {
                await postRatingSett(settlement.id);
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                    console.log(`▶ НП ${settlement.id}: данные получены после POST`);
                }
            } catch (postErr) {
                console.warn(`▶ НП ${settlement.id}: POST ошибка`, postErr);
            }

            if (status200 && ratingData) {
                allRatings[settlement.id] = ratingData;
                processed++;
                successCount++;
                console.log(`▶ НП ${settlement.id}: успешно обработан. Всего успешно: ${successCount}`);
            } else {
                console.warn(`▶ НП ${settlement.id}: не удалось получить данные, пропускаем`);
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

                console.log('▶ Выбран НП (двойной клик):', selectedSettlementId, selectedSettlementName);

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

        console.log('▶ Выбрана строка рейтинга (двойной клик):', rowData);

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

    // Удаляем старую пагинацию диаграммы
    const oldChartPagination = document.getElementById('chart-pagination');
    if (oldChartPagination) oldChartPagination.remove();

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
        // ПОКАЗЫВАЕМ ПАГИНАЦИЮ даже если данных нет
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

    // Удаляем старый фильтр
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

                console.log('▶ Выбран НП:', selectedSettlementId, selectedSettlementName);
                showResPageSize();

                // ПОКАЗЫВАЕМ КНОПКИ
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

    // ПОКАЗЫВАЕМ КНОПКИ
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

    // Удаляем старую пагинацию диаграммы
    const oldChartPagination = document.getElementById('chart-pagination');
    if (oldChartPagination) oldChartPagination.remove();

    hidePlaceholder();

    const oldSettlementsTitle = document.querySelector('.settlements-title');
    if (oldSettlementsTitle) oldSettlementsTitle.remove();

    const settlementsTitle = document.createElement('h3');
    settlementsTitle.className = 'settlements-title';
    settlementsTitle.textContent = 'Рейтинг населенных пунктов';
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
        // ПОКАЗЫВАЕМ ПАГИНАЦИЮ даже если данных нет
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

    // Удаляем старый фильтр
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
        // Поля населенных пунктов
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
        // НОВОЕ ПОЛЕ
        'rating': 'Суммарная оценка',
        // Поля рейтинга
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

                console.log('▶ Выбран НП:', selectedSettlementId, selectedSettlementName);
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

    // Очищаем и ПОКАЗЫВАЕМ пагинацию
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    container.style.flexWrap = 'wrap';
    container.style.gap = '10px';
    container.style.padding = '10px 0';

    // Информация о количестве
    const infoDiv = document.createElement('div');
    infoDiv.className = 'pagination-info';
    infoDiv.textContent = `Всего НП: ${total}, Страница ${currentPage + 1} из ${totalPages || 1}`;
    container.appendChild(infoDiv);

    // Блок управления пагинацией
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'pagination-controls';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.alignItems = 'center';
    controlsDiv.style.gap = '6px';

    // Кнопка "Назад"
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

    // Инпут для ввода номера страницы
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

    // Кнопка "Вперед"
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

    // Выбор количества записей на странице
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

    content.appendChild(title);
    content.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    function renderResTable(items) {
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!items || items.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 9;
            cell.textContent = 'Нет РЭС для отображения';
            cell.className = 'empty-message';
            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }

        const headerRow = document.createElement('tr');
        const headers = [
            'ID', 'Тип ID', 'Вид ID', 'Название', 'Оператор',
            'Местоположение', 'Регион ID', 'Широта', 'Долгота'
        ];
        headers.forEach(label => {
            const th = document.createElement('th');
            th.textContent = label;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        items.forEach(item => {
            const row = document.createElement('tr');

            const idCell = document.createElement('td');
            idCell.textContent = item.id || '-';
            row.appendChild(idCell);

            const typeIdCell = document.createElement('td');
            typeIdCell.textContent = item.type_id || '-';
            row.appendChild(typeIdCell);

            const kindIdCell = document.createElement('td');
            kindIdCell.textContent = item.kind_id || '-';
            row.appendChild(kindIdCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = item.name || '-';
            row.appendChild(nameCell);

            const operatorCell = document.createElement('td');
            operatorCell.textContent = item.operator || '-';
            row.appendChild(operatorCell);

            const locationCell = document.createElement('td');
            locationCell.textContent = item.location || '-';
            row.appendChild(locationCell);

            const regionIdCell = document.createElement('td');
            regionIdCell.textContent = item.region_id || '-';
            row.appendChild(regionIdCell);

            const latStrCell = document.createElement('td');
            latStrCell.textContent = item.lat_str || '-';
            row.appendChild(latStrCell);

            const lonStrCell = document.createElement('td');
            lonStrCell.textContent = item.lon_str || '-';
            row.appendChild(lonStrCell);

            tbody.appendChild(row);
        });
    }

    renderResTable(data);
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

        console.log(`▶ Обработка НП ID ${settlement.id}...`);

        try {
            let ratingData = null;
            let status200 = false;

            if (allRatings[settlement.id]) {
                console.log(`▶ НП ${settlement.id}: рейтинг уже есть в кеше`);
                processed++;
                successCount++;
                updateProgress(processed, total, successCount);
                continue;
            }

            try {
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                    console.log(`▶ НП ${settlement.id}: данные получены через GET`);
                } else {
                    console.log(`▶ НП ${settlement.id}: GET вернул null, пробуем POST`);
                }
            } catch (err) {
                console.warn(`▶ НП ${settlement.id}: GET ошибка`, err);
            }

            console.log(`▶ НП ${settlement.id}: отправляем POST...`);
            try {
                await postRatingSett(settlement.id);
                ratingData = await getRatingSett(settlement.id);
                if (ratingData !== null && ratingData !== undefined) {
                    status200 = true;
                    console.log(`▶ НП ${settlement.id}: данные получены после POST`);
                }
            } catch (postErr) {
                console.warn(`▶ НП ${settlement.id}: POST ошибка`, postErr);
            }

            if (status200 && ratingData) {
                allRatings[settlement.id] = ratingData;
                processed++;
                successCount++;
                console.log(`▶ НП ${settlement.id}: успешно обработан. Всего успешно: ${successCount}`);
            } else {
                console.warn(`▶ НП ${settlement.id}: не удалось получить данные, пропускаем`);
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

// ==================== ОБРАБОТЧИКИ НОВЫХ КНОПОК ====================
async function handleRatingProvided() {
    isChartMode = true;
    chartType = 'provided';
    showRatings = false;

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
    const result = await loadSettlements(0, regions, popRange, pageSize);

    if (!result || result.items.length === 0) {
        renderPopup('Нет населенных пунктов для выбранных фильтров', true);
        return;
    }

    settlementsData.items = result.items || [];
    settlementsData.total = result.total || 0;

    // Только получаем рейтинги, НЕ рассчитываем (allowPost = false)
    await loadRatingsForSettlements(settlementsData.items, false);

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

    // Показываем диаграмму с пагинацией
    showChartContainer();
    createRatingChart(chartData, 'provided', 0, chartPageSize);

    renderPopup(`Загружено ${settlementsData.total} населенных пунктов, построена диаграмма рейтинга обеспеченности`, false);
}

// Аналогично для остальных трех функций...

async function handleRatingDeficit() {
    isChartMode = true;
    chartType = 'deficit';
    showRatings = false;

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
    const result = await loadSettlements(0, regions, popRange, pageSize);

    if (!result || result.items.length === 0) {
        renderPopup('Нет населенных пунктов для выбранных фильтров', true);
        return;
    }

    settlementsData.items = result.items || [];
    settlementsData.total = result.total || 0;

    await loadRatingsForSettlements(settlementsData.items, true);

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

    showChartContainer();
    createRatingChart(chartData, 'deficit');

    renderPopup(`Загружено ${settlementsData.total} населенных пунктов, построена диаграмма рейтинга дефицита`, false);
}

async function handleNormProvided() {
    isChartMode = true;
    chartType = 'norms_provided';
    showRatings = false;

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
    const result = await loadSettlements(0, regions, popRange, pageSize);

    if (!result || result.items.length === 0) {
        renderPopup('Нет населенных пунктов для выбранных фильтров', true);
        return;
    }

    settlementsData.items = result.items || [];
    settlementsData.total = result.total || 0;

    await loadRatingsForSettlements(settlementsData.items, true);

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

    showChartContainer();
    createRatingChart(chartData, 'norms_provided');

    renderPopup(`Загружено ${settlementsData.total} населенных пунктов, построена диаграмма норм обеспеченности`, false);
}

async function handleNormConsumption() {
    isChartMode = true;
    chartType = 'norms_consumption';
    showRatings = false;

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
    const result = await loadSettlements(0, regions, popRange, pageSize);

    if (!result || result.items.length === 0) {
        renderPopup('Нет населенных пунктов для выбранных фильтров', true);
        return;
    }

    settlementsData.items = result.items || [];
    settlementsData.total = result.total || 0;

    await loadRatingsForSettlements(settlementsData.items, true);

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

    showChartContainer();
    createRatingChart(chartData, 'norms_consumption');

    renderPopup(`Загружено ${settlementsData.total} населенных пунктов, построена диаграмма норм потребления`, false);
}

// ==================== ОБРАБОТЧИКИ КНОПОК ====================

async function handleSettlementsButton() {
    isCalculateMode = false;
    isChartMode = false;

    savedFilterField = '';
    savedFilterValue = '';
    savedFilterExact = false;
    currentDisplayPage = 0;

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

        // ВАЖНО: вызываем renderSettlementsTableOnly для отображения
        renderSettlementsTableOnly(originalDataForFilter, originalTotalForFilter, 0, pageSize, false);

        showSettlementButtons();

        renderPopup(`Загружено ${settlementsData.total} населенных пунктов`);
    }
}

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

    // ВАЖНО: вызываем renderCombinedTable для отображения
    renderCombinedTable(originalDataForFilter, originalTotalForFilter, 0, pageSize, false);

    showSettlementButtons();

    renderPopup(`Загружено ${settlementsData.total} населенных пунктов с рейтингами`);
}

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
            // Снимаем все выделения
            const options = regionSelect.querySelectorAll('option');
            options.forEach(opt => opt.selected = false);
            // Выбираем "Все регионы" если есть
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
    chartCurrentPage = 0;
    chartPageSize = 50;

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

    // НОВЫЕ КНОПКИ
    document.getElementById('btn-rating-provided').addEventListener('click', handleRatingProvided);
    document.getElementById('btn-rating-deficit').addEventListener('click', handleRatingDeficit);
    document.getElementById('btn-norm-provided').addEventListener('click', handleNormProvided);
    document.getElementById('btn-norm-consumption').addEventListener('click', handleNormConsumption);

    // СТАРЫЕ КНОПКИ
    document.getElementById('btn-settlements').addEventListener('click', handleSettlementsButton);
    document.getElementById('btn-rating').addEventListener('click', handleRatingButton);

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

    // Проверяем URL параметры и автоматически загружаем рейтинг обеспеченности
    const urlParams = new URLSearchParams(window.location.search);
    const regionsParam = urlParams.get('regions');
    if (regionsParam) {
        // Ждем загрузки регионов и затем выполняем
        setTimeout(() => {
            const selectedCount = document.getElementById('region').selectedOptions.length;
            if (selectedCount > 0) {
                handleRatingProvided();
            }
        }, 500);
    }
});