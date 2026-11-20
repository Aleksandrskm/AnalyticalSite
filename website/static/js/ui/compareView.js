'use strict';
import { lsGetCompareItems, removeFromCompare, clearCompare } from '../core/compareStore.js';
import { buildRatingGroups } from '../core/ratingGroups.js';
import { COMPARE_LESS_IS_BETTER } from '../core/constants.js';
import { showConfirmModal } from './modals/confirmModal.js';
import { updateCompareButtonCounter } from './compareCounter.js';
import { resetAndHideSelectedSettlement } from './selectedSettlement.js';
import { hideChartContainer } from './chartView.js';
import { destroyAnalyticsDashboard } from './analyticsView.js';
import { hideSettlementButtons } from '../buttons/resButtons.js';
import { state } from '../core/state.js';

/* Состояние экрана сравнения */
let cleanupFns = [];
let carouselIndex = 0;
let diffOnly = false;
let applyOffset = () => {};

/* Хранилище Chart-инстансов */
const cardCharts = new Map();
function destroyCardCharts() {
    cardCharts.forEach(chart => { try { chart.destroy(); } catch (e) {} });
    cardCharts.clear();
}

/* ---------- утилиты ---------- */
function readMetrics(view) {
    if (!view || !view.isConnected) {
        return { title: 230, card: 160, gap: 5 };
    }
    const cs = getComputedStyle(view);
    const num = (name, fb) => {
        const v = parseFloat(cs.getPropertyValue(name));
        return Number.isFinite(v) ? v : fb;
    };
    return {
        title: num('--compare-col-title', 230),
        card:  num('--compare-card-w', 160),
        gap:   num('--compare-gap', 5)
    };
}

function isDifferent(key, items) {
    const vals = items.map(it => it[key]).filter(v => v !== undefined && v !== null && v !== '');
    if (vals.length <= 1) return false;
    const first = String(vals[0]);
    return vals.some(v => String(v) !== first);
}

/* ---------- ТАБЛИЦА ---------- */
function renderCompareTables(container, allItems, visibleStart, visibleEnd) {
    if (!allItems.length) {
        container.innerHTML = '';
        return;
    }

    const groups = [
        {
            title: 'Населённый пункт',
            fields: [
                { key: 'population', label: 'Население, чел.' },
                { key: 'area',       label: 'Площадь (км²)' }
            ]
        },
        ...buildRatingGroups()
    ];

    // При первом рендере создаем полную структуру со всеми колонками
    if (container.children.length === 0) {
        groups.forEach(group => {
            const fields = group.fields.filter(f => !diffOnly || isDifferent(f.key, allItems));
            if (!fields.length) return;

            const block  = document.createElement('div'); block.className = 'compare-group';
            block.dataset.groupTitle = group.title;

            const header = document.createElement('div'); header.className = 'compare-group__header';
            const gTitle = document.createElement('span'); gTitle.className = 'compare-group__title'; gTitle.textContent = group.title;
            const toggle = document.createElement('span'); toggle.className = 'compare-group__toggle'; toggle.textContent = '▲';
            header.append(gTitle, toggle);

            const body = document.createElement('div'); body.className = 'compare-group__body';
            header.addEventListener('click', () => {
                const collapsed = body.classList.toggle('is-collapsed');
                toggle.textContent = collapsed ? '▼' : '▲';
            });

            const clip = document.createElement('div');
            clip.className = 'compare-table-clip';
            // Важно: clip должен обрезать всё, что выходит за пределы
            clip.style.overflow = 'hidden';
            clip.style.width = '100%';

            const movable = document.createElement('div');
            movable.className = 'compare-table-movable';
            // Таблица будет сдвигаться трансформом внутри этого контейнера
            movable.style.display = 'flex';
            movable.style.willChange = 'transform';

            const table = document.createElement('table');
            table.className = 'compare-table';
            table.style.tableLayout = 'fixed';
            // Ширина таблицы будет равна сумме всех колонок, зададим её позже
            table.style.minWidth = 'max-content';

            const tbody = document.createElement('tbody');

            // Считаем лучшие значения
            const best = {};
            fields.forEach(f => {
                const lessBetter = COMPARE_LESS_IS_BETTER.has(f.key);
                let b = null;
                allItems.forEach(it => {
                    const v = it[f.key];
                    if (v === undefined || v === null || v === '' || isNaN(Number(v))) return;
                    const n = Number(v);
                    if (b === null) { b = n; return; }
                    b = lessBetter ? Math.min(b, n) : Math.max(b, n);
                });
                best[f.key] = b;
            });

            // Создаем строки
            fields.forEach(f => {
                const tr = document.createElement('tr'); tr.className = 'compare-row';
                const th = document.createElement('th');
                th.className = 'compare-table__field-th';
                th.scope = 'row';
                th.textContent = f.label;
                th.style.width = 'var(--compare-col-title)';
                th.style.minWidth = 'var(--compare-col-title)';
                tr.appendChild(th);

                // Создаем ВСЕ td для всех элементов
                allItems.forEach((it) => {
                    const td = document.createElement('td');
                    td.className = 'compare-cell';
                    td.dataset.compareId = String(it.id);
                    td.dataset.colIndex = String(allItems.findIndex(orig => String(orig.id) === String(it.id)));

                    td.style.width = 'var(--compare-card-w)';
                    td.style.minWidth = 'var(--compare-card-w)';
                    td.style.maxWidth = 'var(--compare-card-w)';

                    const raw = it[f.key];
                    const empty = raw === undefined || raw === null || raw === '';
                    const numeric = !empty && !isNaN(Number(raw));

                    if (empty) { td.textContent = '—'; td.classList.add('compare-cell--empty'); }
                    else { td.textContent = String(raw); td.title = String(raw); }

                    if (numeric && best[f.key] !== null && Number(raw) === best[f.key]) {
                        td.classList.add('compare-cell--best');
                    }

                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            movable.appendChild(table);
            clip.appendChild(movable);
            body.appendChild(clip);
            block.append(header, body);
            container.appendChild(block);
        });
    }

    // Теперь управляем видимостью и сдвигом
    const metrics = readMetrics(container.closest('#compare-view'));
    const offset = visibleStart * (metrics.card + metrics.gap);

    container.querySelectorAll('.compare-group').forEach(block => {
        const movable = block.querySelector('.compare-table-movable');
        if (movable) {
            // Сдвигаем таблицу влево на позицию первой видимой колонки
            // Но заголовки строк (th) должны оставаться на месте!
            // Поэтому мы сдвигаем только td, а для th делаем обратный сдвиг.

            // Проще всего: сдвинуть всю таблицу, а th зафиксировать через sticky
            // или сделать обратный transform для th.

            // Применяем сдвиг ко всей таблице
            movable.style.transform = `translate3d(${-offset}px, 0, 0)`;

            // Компенсируем сдвиг для заголовков строк, чтобы они не уезжали
            movable.querySelectorAll('.compare-table__field-th').forEach(th => {
                th.style.transform = `translate3d(${offset}px, 0, 0)`;
                th.style.position = 'relative';
                th.style.zIndex = '2';
                th.style.backgroundColor = '#fff'; // Чтобы под ним не просвечивали ячейки
            });
        }
    });

    // Скрываем td, которые не входят в видимый диапазон
    container.querySelectorAll('.compare-cell').forEach(td => {
        const idx = parseInt(td.dataset.colIndex);
        td.style.visibility = (idx >= visibleStart && idx < visibleEnd) ? 'visible' : 'hidden';
    });
}

/* ---------- КАРТОЧКИ ---------- */
function renderCards(cardsMovable, items) {
    cardsMovable.innerHTML = '';
    cardsMovable.style.setProperty('--compare-cols', String(items.length));

    items.forEach((it, idx) => {
        const card = document.createElement('div');
        card.className = 'compare-card';
        card.dataset.compareId = String(it.id);
        card.dataset.colIndex = String(idx);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'compare-card__remove';
        closeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 6 L18 18 M18 6 L6 18" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`;
        closeBtn.addEventListener('click', async () => {
            const ok = await showConfirmModal({
                title: 'Убрать НП',
                message: `Убрать «${it.name || 'ID: ' + it.id}» из сравнения?`,
                yesText: 'Убрать', noText: 'Отмена'
            });
            if (!ok) return;
            removeFromCompare(it.id);
            updateCompareButtonCounter();
            removeCompareColumn(it.id);
        });

        const img = document.createElement('div');
        img.className = 'compare-card__img-placeholder';
        img.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#b0c4de" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;

        const titleEl = document.createElement('div');
        titleEl.className = 'compare-card__title';
        titleEl.textContent = it.name || `ID: ${it.id}`;
        titleEl.title = titleEl.textContent;

        const regionEl = document.createElement('div');
        regionEl.className = 'compare-card__region';
        regionEl.textContent = it.region_name || 'Регион не указан';
        regionEl.title = it.region_name || '';

        const districtEl = document.createElement('div');
        districtEl.className = 'compare-card__district';
        districtEl.textContent = it.district_name || 'МО не указано';
        districtEl.title = it.district_name || '';

        const ratingVal = it.rating !== null && it.rating !== undefined ? Number(it.rating) : 0;

        const stats = document.createElement('div'); stats.className = 'compare-card__stats';
        const provided = document.createElement('div');
        provided.className = 'compare-card__stat compare-card__stat--provided';
        provided.innerHTML = `<span class="compare-card__stat-val">${ratingVal.toFixed(1)}</span><span class="compare-card__stat-label">% обесп.</span>`;

        const deficit = document.createElement('div');
        deficit.className = 'compare-card__stat compare-card__stat--deficit';
        deficit.innerHTML = `<span class="compare-card__stat-val">${(100 - ratingVal).toFixed(1)}</span><span class="compare-card__stat-label">% дефицит</span>`;

        stats.append(provided, deficit);
        card.append(closeBtn, img, titleEl, regionEl, districtEl, stats);
        cardsMovable.appendChild(card);
    });
}

function renderChartsBlock(container, items) {
    container.innerHTML = '';
    if (!items.length) return;

    const block = document.createElement('div');
    block.className = 'compare-group';

    const body = document.createElement('div');
    body.className = 'compare-group__body';

    const chartsRow = document.createElement('div');
    chartsRow.className = 'compare-charts-row';

    const spacer = document.createElement('div');
    spacer.className = 'compare-charts-spacer';

    const chartsMovable = document.createElement('div');
    chartsMovable.className = 'compare-charts-movable';

    items.forEach((it, idx) => {
        const chartCard = document.createElement('div');
        chartCard.className = 'compare-chart-card';
        chartCard.dataset.compareId = String(it.id);
        chartCard.dataset.colIndex = String(idx);
        chartCard.title = it.name || `ID: ${it.id}`;

        const chartContainer = document.createElement('div');
        chartContainer.className = 'compare-chart-card__canvas';
        chartContainer.style.height = '100px';
        chartCard.appendChild(chartContainer);
        chartsMovable.appendChild(chartCard);
    });

    chartsRow.append(spacer, chartsMovable);
    body.appendChild(chartsRow);
    block.append(body);
    container.appendChild(block);

    return chartsMovable;
}

/* ---------- МИНИ-ГРАФИК ---------- */
function renderCardChart(chartContainer, item) {
    if (!chartContainer) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'compare-chart-canvas';
    chartContainer.appendChild(canvas);

    const ratingVal = item.rating !== null && item.rating !== undefined ? Number(item.rating) : 0;
    const provided = Math.max(0, Math.min(100, ratingVal));
    const deficit = 100 - provided;

    const chart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: [''],
            datasets: [
                { label: 'Обесп.', data: [provided], backgroundColor: '#4AC15D', borderWidth: 0 },
                { label: 'Дефицит', data: [deficit], backgroundColor: '#ED933B', borderWidth: 0 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: '#bdbdbd',
                    titleColor: '#000',
                    bodyColor: '#000',
                    titleFont: { size: 11, weight: 'bold' },
                    bodyFont: { size: 11, weight: 'bold' },
                    padding: 6,
                    callbacks: {
                        title: () => item.name || `ID: ${item.id}`,
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
                    }
                }
            },
            scales: {
                x: { display: false, stacked: true, grid: { display: false } },
                y: {
                    stacked: true,
                    min: 0,
                    max: 100,
                    grid: { display: false },
                    ticks: {
                        display: true,
                        font: { size: 9 },
                        stepSize: 50,
                        callback: v => v + '%'
                    }
                }
            }
        }
    });

    cardCharts.set(String(item.id), chart);
}

/* ---------- СКРЫТИЕ НЕВИДИМЫХ ЭЛЕМЕНТОВ ---------- */
function updateVisibility(cardsMovable, chartsMovable, visibleStart, visibleEnd) {
    if (cardsMovable) {
        cardsMovable.querySelectorAll('.compare-card').forEach(card => {
            const idx = parseInt(card.dataset.colIndex);
            card.style.visibility = (idx >= visibleStart && idx < visibleEnd) ? 'visible' : 'hidden';
        });
    }

    if (chartsMovable) {
        chartsMovable.querySelectorAll('.compare-chart-card').forEach(chartCard => {
            const idx = parseInt(chartCard.dataset.colIndex);
            chartCard.style.visibility = (idx >= visibleStart && idx < visibleEnd) ? 'visible' : 'hidden';
        });
    }
}

/* ---------- ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ ГРАФИКОВ ---------- */
function initVisibleCharts(view, items, visibleStart, visibleEnd) {
    const chartsMovable = view.querySelector('.compare-charts-movable');
    if (!chartsMovable) return;

    items.forEach((it, idx) => {
        if (idx < visibleStart || idx >= visibleEnd) return;
        if (cardCharts.has(String(it.id))) return;

        const chartCard = chartsMovable.querySelector(`[data-compare-id="${String(it.id)}"]`);
        if (chartCard) {
            const chartContainer = chartCard.querySelector('.compare-chart-card__canvas');
            if (chartContainer) renderCardChart(chartContainer, it);
        }
    });
}

/* ---------- ТОЧЕЧНОЕ УДАЛЕНИЕ КОЛОНКИ ---------- */
function removeCompareColumn(id) {
    const view = document.getElementById('compare-view');
    if (!view) return;

    const items = lsGetCompareItems();
    view.style.setProperty('--compare-cols', String(items.length));

    if (!items.length) { carouselIndex = 0; renderCompareView(); return; }

    renderCompareView();
}

/* ---------- ЭКРАН ---------- */
export function clearCompareView() {
    cleanupFns.forEach(fn => { try { fn(); } catch (e) {} });
    cleanupFns = [];
    applyOffset = () => {};
    destroyCardCharts();

    const view = document.getElementById('compare-view');
    if (view) view.remove();
}

export function switchToCompareMode() {
    destroyAnalyticsDashboard();
    hideChartContainer();
    if (state.ratingChart) { state.ratingChart.destroy(); state.ratingChart = null; }
    state.isChartMode = false;
    state.isAnalyticsMode = false;
    document.body.classList.remove('analytics-mode');
    hideSettlementButtons();

    ['format-controls-group', 'compare-view'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    document.querySelector('.filter-container')?.remove();
    document.querySelector('.settlements-title')?.remove();

    const pag = document.getElementById('settlements-pagination');
    if (pag) { pag.style.display = 'none'; pag.innerHTML = ''; }

    const table = document.getElementById('settlements-table');
    if (table) table.style.display = 'none';

    const ph = document.getElementById('placeholder-message');
    if (ph) ph.style.display = 'none';

    resetAndHideSelectedSettlement();
    renderCompareView();
}

export function renderCompareView() {
    clearCompareView();

    const items = lsGetCompareItems();

    const view = document.createElement('div');
    view.id = 'compare-view';
    view.className = 'compare-view';
    view.style.setProperty('--compare-cols', String(items.length));
    view.style.setProperty('--compare-card-w', '160px');

    const header = document.createElement('div'); header.className = 'compare-view__header';
    const title = document.createElement('h3'); title.className = 'compare-view__title'; title.textContent = 'Сравнение НП';
    header.appendChild(title);
    view.appendChild(header);

    const mount = () => {
        const box = document.querySelector('.table__rating');
        if (!box) return;
        const buttons = box.querySelector('.table_buttons');
        if (buttons) box.insertBefore(view, buttons); else box.appendChild(view);
    };

    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'compare-view__empty';
        empty.textContent = 'Пока не добавлено ни одного НП для сравнения.';
        view.appendChild(empty);
        mount();
        return;
    }

    /* --- карусель --- */
    const wrapper  = document.createElement('div'); wrapper.className = 'compare-carousel-wrapper';
    const btnPrev  = document.createElement('button'); btnPrev.className = 'carousel-btn carousel-btn--prev'; btnPrev.innerHTML = '❮';
    const btnNext  = document.createElement('button'); btnNext.className = 'carousel-btn carousel-btn--next'; btnNext.innerHTML = '❯';

    const viewport = document.createElement('div'); viewport.className = 'compare-carousel-viewport';

    const cardsRow = document.createElement('div'); cardsRow.className = 'compare-cards-row';
    const spacer   = document.createElement('div'); spacer.className = 'compare-cards-spacer';
    const cardsMovable = document.createElement('div'); cardsMovable.className = 'compare-cards-movable';
    cardsRow.append(spacer, cardsMovable);

    renderCards(cardsMovable, items);

    /* --- ОТДЕЛЬНЫЙ БЛОК ГРАФИКОВ --- */
    const chartsContainer = document.createElement('div');
    chartsContainer.className = 'compare-charts-container';
    const chartsMovable = renderChartsBlock(chartsContainer, items);

    /* --- ТАБЛИЦА --- */
    const scrollArea = document.createElement('div'); scrollArea.className = 'compare-table-scroll-area';
    const groupsContainer = document.createElement('div'); groupsContainer.className = 'compare-groups-container';
    scrollArea.appendChild(groupsContainer);

    // Первичный рендер (создает все колонки)
    renderCompareTables(groupsContainer, items, 0, items.length);

    viewport.append(cardsRow, chartsContainer, scrollArea);
    wrapper.append(btnPrev, viewport, btnNext);
    view.appendChild(wrapper);

    /* --- тулбар --- */
    const toolbar = document.createElement('div'); toolbar.className = 'compare-view__toolbar';

    const clearAllBtn = document.createElement('button');
    clearAllBtn.type = 'button';
    clearAllBtn.className = 'compare-btn compare-btn--outline';
    clearAllBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Очистить список`;
    clearAllBtn.addEventListener('click', async () => {
        if (!lsGetCompareItems().length) return;
        const ok = await showConfirmModal({
            title: 'Очистить список',
            message: 'Удалить все НП из сравнения? Это действие нельзя отменить.',
            yesText: 'Да, очистить', noText: 'Отмена'
        });
        if (!ok) return;
        clearCompare();
        updateCompareButtonCounter();
        carouselIndex = 0;
        renderCompareView();
    });

    const diffLabel = document.createElement('label'); diffLabel.className = 'compare-view__diff-toggle';
    const diffCb = document.createElement('input'); diffCb.type = 'checkbox'; diffCb.id = 'compare-diff-only'; diffCb.checked = diffOnly;
    const diffText = document.createElement('span'); diffText.textContent = 'Показывать только отличия';
    diffLabel.append(diffCb, diffText);
    diffCb.addEventListener('change', () => {
        diffOnly = diffCb.checked;
        groupsContainer.innerHTML = ''; // Сбрасываем таблицу для пересоздания с учетом фильтра
        renderCompareTables(groupsContainer, lsGetCompareItems(), 0, lsGetCompareItems().length);
        updateCarousel();
    });

    toolbar.append(clearAllBtn, diffLabel);
    view.appendChild(toolbar);

    /* --- ЛОГИКА СДВИГА --- */
    const visibleCount = () => {
        const { title, card, gap } = readMetrics(view);
        const available = viewport.clientWidth - title;
        return Math.max(1, Math.floor((available + gap) / (card + gap)));
    };

    function updateCarousel() {
        if (!viewport.isConnected || !viewport.clientWidth) return;

        const { title, card, gap } = readMetrics(view);
        const list = lsGetCompareItems();
        const listLength = list.length;

        // Расчет количества видимых карточек (с запасом 2px на субпиксели)
        const available = viewport.clientWidth - title;
        let vis = Math.max(1, Math.floor((available + gap + 2) / (card + gap)));

        if (vis > listLength) vis = listLength;

        const maxIndex = Math.max(0, listLength - vis);

        if (carouselIndex > maxIndex) carouselIndex = maxIndex;
        if (carouselIndex < 0) carouselIndex = 0;

        const offset = carouselIndex * (card + gap);
        const shift = `translate3d(${-offset}px,0,0)`;

        // Двигаем карточки и графики
        cardsMovable.style.transform = shift;
        if (chartsMovable) chartsMovable.style.transform = shift;

        const visibleStart = carouselIndex;
        const visibleEnd = carouselIndex + vis;

        updateVisibility(cardsMovable, chartsMovable, visibleStart, visibleEnd);
        initVisibleCharts(view, list, visibleStart, visibleEnd);

        // Передаем видимые границы для таблицы (она сама сделает сдвиг)
        renderCompareTables(groupsContainer, list, visibleStart, visibleEnd);

        const needArrows = listLength > vis;
        btnPrev.style.display = needArrows ? 'flex' : 'none';
        btnNext.style.display = needArrows ? 'flex' : 'none';
        btnPrev.disabled = carouselIndex === 0;
        btnNext.disabled = carouselIndex >= maxIndex;
    }

    applyOffset = updateCarousel;

    btnPrev.addEventListener('click', () => { if (carouselIndex > 0) { carouselIndex--; updateCarousel(); } });
    btnNext.addEventListener('click', () => {
        if (carouselIndex < lsGetCompareItems().length - visibleCount()) { carouselIndex++; updateCarousel(); }
    });

    window.addEventListener('resize', updateCarousel);
    cleanupFns.push(() => window.removeEventListener('resize', updateCarousel));

    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => updateCarousel());
        ro.observe(viewport);
        cleanupFns.push(() => ro.disconnect());
    }

    mount();
    requestAnimationFrame(updateCarousel);
    setTimeout(updateCarousel, 60);
}