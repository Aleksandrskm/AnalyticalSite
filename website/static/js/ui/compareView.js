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

/* Проверяет, есть ли у НП хоть одно непустое значение среди полей сравнения */
function hasAnyValue(item, fields) {
    return fields.some(f => {
        const v = item[f.key];
        return v !== undefined && v !== null && v !== '' && !isNaN(Number(v));
    });
}

/* Возвращает список НП, у которых есть хоть какие-то данные для сравнения */
function getComparableItems(items) {
    const baseFields = [
        { key: 'population' },
        { key: 'area' },
        ...buildRatingGroups().flatMap(g => g.fields)
    ];
    return items
        .filter(it => hasAnyValue(it, baseFields))
        .map(it => {
            const copy = { ...it };
            // Если площади нет, ставим 1, но помечаем флагом для сравнения
            if (copy.area === undefined || copy.area === null || copy.area === '' || isNaN(Number(copy.area))) {
                copy.area = 1;
                copy._isAreaDefault = true;
            }
            return copy;
        });
}

/* ---------- ТАБЛИЦА (frozen + movable) ---------- */
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

    container.innerHTML = ''; // Пересоздаем всегда, чтобы избежать "мертвых" колонок

    groups.forEach(group => {
        const fields = group.fields.filter(f => !diffOnly || isDifferent(f.key, allItems));
        if (!fields.length) return;

        const block = document.createElement('div');
        block.className = 'compare-group';

        const header = document.createElement('div');
        header.className = 'compare-group__header';
        header.innerHTML = `<span class="compare-group__title">${group.title}</span><span class="compare-group__toggle">▲</span>`;

        const body = document.createElement('div');
        body.className = 'compare-group__body';

        header.addEventListener('click', () => {
            const collapsed = body.classList.toggle('is-collapsed');
            header.querySelector('.compare-group__toggle').textContent = collapsed ? '▼' : '▲';
        });

        const clip = document.createElement('div');
        clip.className = 'compare-table-clip';

        const frozen = document.createElement('div');
        frozen.className = 'compare-table-frozen';

        const scroll = document.createElement('div');
        scroll.className = 'compare-table-scroll';

        const movable = document.createElement('div');
        movable.className = 'compare-table-movable';

        const table = document.createElement('table');
        table.className = 'compare-table';
        const tbody = document.createElement('tbody');

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

        fields.forEach(f => {
            const fr = document.createElement('div');
            fr.className = 'compare-frozen-row';
            fr.textContent = f.label;
            frozen.appendChild(fr);

            const tr = document.createElement('tr');
            allItems.forEach((it, idx) => {
                const td = document.createElement('td');
                td.className = 'compare-cell';
                td.dataset.compareId = String(it.id);
                td.dataset.colIndex = String(idx);

                const raw = it[f.key];
                const empty = raw === undefined || raw === null || raw === '';
                const numeric = !empty && !isNaN(Number(raw));

                if (empty) {
                    td.textContent = '—';
                    td.classList.add('compare-cell--empty');
                } else {
                    td.textContent = String(raw);
                    td.title = String(raw);
                }
                if (numeric && best[f.key] !== null && Number(raw) === best[f.key]) {
                    td.classList.add('compare-cell--best');
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        movable.appendChild(table);
        scroll.appendChild(movable);
        clip.append(frozen, scroll);
        body.appendChild(clip);
        block.append(header, body);
        container.appendChild(block);
    });
}

/* ---------- КАРТОЧКИ ---------- */
function renderCards(cardsMovable, items) {
    cardsMovable.innerHTML = '';
    cardsMovable.style.setProperty('--compare-cols', String(items.length));

    // Находим максимальный рейтинг для подсветки лучшего результата
    const maxRating = Math.max(...items.map(it => {
        const r = it.rating !== null && it.rating !== undefined ? Number(it.rating) : 0;
        return isNaN(r) ? 0 : r;
    }));

    items.forEach((it, idx) => {
        const card = document.createElement('div');
        card.className = 'compare-card';
        card.dataset.compareId = String(it.id);
        card.dataset.colIndex = String(idx);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'compare-card__remove';
        closeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 6 L18 18 M18 6 L6 18" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`;
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
        img.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#b0c4de" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;

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

        const stats = document.createElement('div');
        stats.className = 'compare-card__stats';

        const provided = document.createElement('div');
        provided.className = 'compare-card__stat compare-card__stat--provided';

        // Если текущий рейтинг совпадает с максимальным — добавляем класс is-best
        if (ratingVal === maxRating && ratingVal > 0) {
            provided.classList.add('is-best');
        }

        provided.innerHTML = `<span class="compare-card__stat-val">${ratingVal.toFixed(1)}</span><span class="compare-card__stat-label">% обесп.</span>`;

        const deficit = document.createElement('div');
        deficit.className = 'compare-card__stat compare-card__stat--deficit';
        deficit.innerHTML = `<span class="compare-card__stat-val">${(100 - ratingVal).toFixed(1)}</span><span class="compare-card__stat-label">% дефицит</span>`;

        stats.append(provided, deficit);
        card.append(closeBtn, img, titleEl, regionEl, districtEl, stats);
        cardsMovable.appendChild(card);
    });
}

/* ---------- БЛОК ГРАФИКОВ ---------- */
function renderChartsBlock(container, items) {
    container.innerHTML = '';
    if (!items.length) return null;

    const block = document.createElement('div');
    block.className = 'compare-group compare-charts-container';

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
            resizeDelay: 0,
            animation: { duration: 0 },
            layout: { padding: 0 },
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

    // Форсируем пересчёт размеров под фактический контейнер
    requestAnimationFrame(() => {
        try { chart.resize(); } catch (e) {}
    });

    cardCharts.set(String(item.id), chart);
}

/* ---------- СКРЫТИЕ НЕВИДИМЫХ ---------- */
function updateVisibility(cardsMovable, chartsMovable, visibleStart, visibleEnd) {
    if (cardsMovable) {
        cardsMovable.querySelectorAll('.compare-card').forEach(card => {
            const idx = parseInt(card.dataset.colIndex, 10);
            card.style.visibility = (idx >= visibleStart && idx < visibleEnd) ? 'visible' : 'hidden';
        });
    }
    if (chartsMovable) {
        chartsMovable.querySelectorAll('.compare-chart-card').forEach(chartCard => {
            const idx = parseInt(chartCard.dataset.colIndex, 10);
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

    const allItems = lsGetCompareItems();
    const items = getComparableItems(allItems);

    view.querySelectorAll(`[data-compare-id="${String(id)}"]`).forEach(el => el.remove());

    const chart = cardCharts.get(String(id));
    if (chart) { try { chart.destroy(); } catch (e) {} cardCharts.delete(String(id)); }

    if (!items.length) {
        carouselIndex = 0;
        renderCompareView();
        return;
    }

    // Переиндексация оставшихся
    const order = new Map(items.map((it, i) => [String(it.id), i]));
    view.querySelectorAll('[data-compare-id]').forEach(el => {
        const key = el.dataset.compareId;
        if (order.has(key)) el.dataset.colIndex = String(order.get(key));
    });

    view.style.setProperty('--compare-cols', String(items.length));
    carouselIndex = Math.min(carouselIndex, Math.max(0, items.length - 1));
    applyOffset();
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

    ['format-controls-group', 'compare-view'].forEach(id => {
        const e = document.getElementById(id); if (e) e.remove();
    });
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

    const allItems = lsGetCompareItems();
    const items = getComparableItems(allItems);

    const view = document.createElement('div');
    view.id = 'compare-view';
    view.className = 'compare-view';
    view.style.setProperty('--compare-cols', String(items.length));

    const header = document.createElement('div');
    header.className = 'compare-view__header';
    const title = document.createElement('h3');
    title.className = 'compare-view__title';
    title.textContent = 'Сравнение НП';
    header.appendChild(title);
    view.appendChild(header);

    const mount = () => {
        const box = document.querySelector('.table__rating');
        if (!box) return;
        const buttons = box.querySelector('.table_buttons');
        if (buttons) box.insertBefore(view, buttons); else box.appendChild(view);
    };

    if (!allItems.length) {
        const empty = document.createElement('div');
        empty.className = 'compare-view__empty';
        empty.textContent = 'Пока не добавлено ни одного НП для сравнения.';
        view.appendChild(empty);
        mount();
        return;
    }
    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'compare-view__empty';
        empty.textContent = 'У выбранных НП нет данных для сравнения.';
        view.appendChild(empty);
        mount();
        return;
    }

    /* --- карусель --- */
    const wrapper = document.createElement('div');
    wrapper.className = 'compare-carousel-wrapper';

    const btnPrev = document.createElement('button');
    btnPrev.className = 'carousel-btn carousel-btn--prev';
    btnPrev.innerHTML = '❮';

    const btnNext = document.createElement('button');
    btnNext.className = 'carousel-btn carousel-btn--next';
    btnNext.innerHTML = '❯';

    const viewport = document.createElement('div');
    viewport.className = 'compare-carousel-viewport';

    const cardsRow = document.createElement('div');
    cardsRow.className = 'compare-cards-row';
    const spacer = document.createElement('div');
    spacer.className = 'compare-cards-spacer';
    const cardsMovable = document.createElement('div');
    cardsMovable.className = 'compare-cards-movable';
    cardsRow.append(spacer, cardsMovable);

    renderCards(cardsMovable, items);

    const chartsContainer = document.createElement('div');
    chartsContainer.className = 'compare-charts-container';
    const chartsMovable = renderChartsBlock(chartsContainer, items);

    const scrollArea = document.createElement('div');
    scrollArea.className = 'compare-table-scroll-area';
    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'compare-groups-container';
    scrollArea.appendChild(groupsContainer);

    renderCompareTables(groupsContainer, items, 0, items.length);

    viewport.append(cardsRow, chartsContainer, scrollArea);
    wrapper.append(btnPrev, viewport, btnNext);
    view.appendChild(wrapper);

    /* --- тулбар --- */
    const toolbar = document.createElement('div');
    toolbar.className = 'compare-view__toolbar';

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

    const diffLabel = document.createElement('label');
    diffLabel.className = 'compare-view__diff-toggle';
    const diffCb = document.createElement('input');
    diffCb.type = 'checkbox';
    diffCb.id = 'compare-diff-only';
    diffCb.checked = diffOnly;
    const diffText = document.createElement('span');
    diffText.textContent = 'Показывать только отличия';
    diffLabel.append(diffCb, diffText);

    diffCb.addEventListener('change', () => {
        diffOnly = diffCb.checked;
        const scrollTop = scrollArea.scrollTop;
        const list = getComparableItems(lsGetCompareItems());
        groupsContainer.innerHTML = '';
        renderCompareTables(groupsContainer, list, 0, list.length);
        updateCarousel();
        scrollArea.scrollTop = scrollTop;
    });

    toolbar.append(clearAllBtn, diffLabel);
    view.appendChild(toolbar);

    /* --- ЛОГИКА СДВИГА --- */
    function updateCarousel() {
        if (!viewport.isConnected || !viewport.clientWidth) return;

        const list = getComparableItems(lsGetCompareItems());
        const listLength = list.length;

        // Получаем реальные размеры из CSS
        const cs = getComputedStyle(view);
        const titleW = parseFloat(cs.getPropertyValue('--compare-col-title')) || 230;
        const cardW = parseFloat(cs.getPropertyValue('--compare-card-w')) || 160;
        const gap = parseFloat(cs.getPropertyValue('--compare-gap')) || 5;

        // Считаем сколько карточек влезает
        const available = viewport.clientWidth - titleW;
        let vis = Math.max(1, Math.floor((available + gap) / (cardW + gap)));
        if (vis > listLength) vis = listLength;

        const maxIndex = Math.max(0, listLength - vis);
        carouselIndex = Math.min(Math.max(carouselIndex, 0), maxIndex);

        // Сдвиг = индекс * (ширина карточки + отступ)
        const offset = carouselIndex * (cardW + gap);
        const shift = `translate3d(${-offset}px, 0, 0)`;

        // Двигаем ВСЕ три контейнера на одинаковое значение
        cardsMovable.style.transform = shift;
        if (chartsMovable) chartsMovable.style.transform = shift;

        // Двигаем таблицу (внутри каждой группы)
        groupsContainer.querySelectorAll('.compare-table-movable').forEach(m => {
            m.style.transform = shift;
        });

        const visibleStart = carouselIndex;
        const visibleEnd = carouselIndex + vis;

        updateVisibility(cardsMovable, chartsMovable, visibleStart, visibleEnd);

        // В таблице скрываем те колонки, которые выходят за пределы видимости
        groupsContainer.querySelectorAll('.compare-cell').forEach(td => {
            const idx = parseInt(td.dataset.colIndex, 10);
            td.style.visibility = (idx >= visibleStart && idx < visibleEnd) ? 'visible' : 'hidden';
        });

        initVisibleCharts(view, list, visibleStart, visibleEnd);

        const needArrows = listLength > vis;
        btnPrev.style.display = needArrows ? 'flex' : 'none';
        btnNext.style.display = needArrows ? 'flex' : 'none';
        btnPrev.disabled = carouselIndex === 0;
        btnNext.disabled = carouselIndex >= maxIndex;
    }

    applyOffset = updateCarousel;

    btnPrev.addEventListener('click', () => {
        if (carouselIndex > 0) { carouselIndex--; updateCarousel(); }
    });
    btnNext.addEventListener('click', () => {
        if (carouselIndex < getComparableItems(lsGetCompareItems()).length - 1) {
            carouselIndex++;
            updateCarousel();
        }
    });

    let resizeTimer;
    const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(updateCarousel, 100);
    };
    window.addEventListener('resize', onResize);
    cleanupFns.push(() => { clearTimeout(resizeTimer); window.removeEventListener('resize', onResize); });

    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => updateCarousel());
        ro.observe(viewport);
        cleanupFns.push(() => ro.disconnect());
    }

    mount();

    requestAnimationFrame(() => {
        cardsMovable.classList.add('is-animated');
        if (chartsMovable) chartsMovable.classList.add('is-animated');
        groupsContainer.querySelectorAll('.compare-table-movable').forEach(m => m.classList.add('is-animated'));
        updateCarousel();
    });
    setTimeout(updateCarousel, 100);
}