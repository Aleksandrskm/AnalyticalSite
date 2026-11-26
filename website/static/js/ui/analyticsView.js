'use strict';
import { state } from '../core/state.js';
import { hideChartContainer } from './chartView.js';
import { showSettlementButtons, hideSettlementButtons } from '../buttons/resButtons.js';
import { hideCalculateAllButton, hideCalculateSelectedButton } from '../buttons/calculateButtons.js';
import { resetAndHideSelectedSettlement } from './selectedSettlement.js';
import { persistSelectedIdNp } from './selectedSettlement.js';

export function destroyAnalyticsDashboard() {
    document.body.classList.remove('analytics-mode');
    const d = document.getElementById('analytics-dashboard'); if (d) d.remove();
    if (state.analyticsChart) { state.analyticsChart.destroy(); state.analyticsChart = null; }
    if (state.analyticsBarServices) { state.analyticsBarServices.destroy(); state.analyticsBarServices = null; }
    if (state.analyticsBarMobile) { state.analyticsBarMobile.destroy(); state.analyticsBarMobile = null; }
    state.isAnalyticsMode = false;
}

export function switchToAnalyticsMode() {
    hideChartContainer();
    if (state.ratingChart) { state.ratingChart.destroy(); state.ratingChart = null; }
    state.isChartMode = false;
    document.body.classList.add('analytics-mode');

    const t = document.getElementById('settlements-table'); if (t) t.style.display = 'none';
    hideSettlementButtons(); hideCalculateAllButton(); hideCalculateSelectedButton();
    const fg = document.getElementById('format-controls-group'); if (fg) fg.remove();
    document.querySelector('.filter-container')?.remove();
    document.querySelector('.settlements-title')?.remove();
    const pag = document.getElementById('settlements-pagination');
    if (pag) { pag.style.display = 'none'; pag.innerHTML = ''; }
    if (state.selectedSettlementId) persistSelectedIdNp(state.selectedSettlementId);
    resetAndHideSelectedSettlement();
    state.isAnalyticsMode = true;
    renderAnalyticsDashboard();
}

export function renderAnalyticsDashboard() {
    const ph = document.getElementById('placeholder-message'); if (ph) ph.style.display = 'none';
    destroyAnalyticsDashboard();
    state.isAnalyticsMode = true;
    document.body.classList.add('analytics-mode');

    const d = document.createElement('div'); d.id = 'analytics-dashboard';

    const hb = document.createElement('div'); hb.className = 'analytics-header';
    const t = document.createElement('div'); t.className = 'analytics-title';
    const sub = document.createElement('div'); sub.className = 'analytics-subtitle';

// ---- Регионы ----
    const names = (state.currentRegions || []).map(r => {
        const o = document.querySelector(`#region option[value="${r}"]`);
        return o ? o.textContent : r;
    });
    const regionPart = names.length ? names.join(', ') : 'все регионы';
    sub.textContent = names.length ? `Регион(ы): ${names.join(', ')}` : 'Регион(ы): не выбраны';

// ---- Диапазон населения ----
    const radioAll = document.getElementById('number-settlements');
    const fromI = document.getElementById('numbers-settlement');
    const toI = document.getElementById('numbers-settlements');
    const isAll = !!(radioAll && radioAll.checked);
    const popFrom = isAll ? 0 : (parseInt(fromI?.value) || 0);
    const popTo = isAll ? Infinity : (parseInt(toI?.value) || Infinity);
    const hasPop = !isAll && (popFrom !== null || popTo !== null);
    const popPart = hasPop
        ? ` для НП численностью от ${popFrom.toLocaleString('ru-RU')} до ${popTo.toLocaleString('ru-RU')} чел.`
        : '';

// ---- Динамический заголовок ----
    t.textContent = `Диаграмма обеспеченности НП региона: ${regionPart}${popPart || ' для всех НП'}`;

    hb.append(t); d.appendChild(hb);

// ---- Подсчёт KPI ----
    const items = state.settlementsData.items || [];
    const total = items.length;
    let totalPop = 0, sumR = 0, cntR = 0;

    items.forEach(it => {
        const p = Number(it.population) || 0;
        // При "все НП" фильтр не применяем — берём всё, как в chartView.js
        if (isAll || (p >= popFrom && p <= popTo)) totalPop += p;

        const r = state.allRatings[String(it.id)];
        if (r && r.rating != null && !isNaN(r.rating)) { sumR += Number(r.rating); cntR++; }
    });

    const avgR = cntR ? sumR / cntR : 0;
    const avgD = cntR ? 100 - avgR : 0;

    const cards = document.createElement('div'); cards.className = 'kpi-cards-row';
    const mk = (label, value, color) => {
        const c = document.createElement('div'); c.className = 'kpi-card'; c.style.setProperty('--kpi-color', color);
        const v = document.createElement('div'); v.className = 'kpi-card__value';
        v.textContent = (label === 'Средняя обеспеченность' || label === 'Средний дефицит') ? `${value} %` : value;
        const l = document.createElement('div'); l.className = 'kpi-card__label'; l.textContent = label;
        c.append(v, l); return c;
    };

    cards.append(
        mk('Количество НП', total.toLocaleString('ru-RU'), '#0066ff'),
        mk('Общая численность населения', totalPop.toLocaleString('ru-RU'), '#4c00a8'), // Теперь реальная сумма
        mk('Средняя обеспеченность', avgR.toFixed(2), '#43A047'),
        mk('Средний дефицит', avgD.toFixed(2), '#cc0000')
    );
    d.appendChild(cards);

    const scroll = document.createElement('div'); scroll.className = 'analytics-charts-scroll';
    const row = document.createElement('div'); row.className = 'analytics-charts-row analytics-charts-row--scroll';
    scroll.appendChild(row);

    const mkBlock = (titleText, canvasId) => {
        const b = document.createElement('div'); b.className = 'analytics-chart-block analytics-chart-block--min';
        const tt = document.createElement('div'); tt.className = 'analytics-chart-block__title'; tt.textContent = titleText;
        const w = document.createElement('div'); w.className = 'analytics-chart-block__canvas-wrap';
        const c = document.createElement('canvas'); c.id = canvasId;
        w.appendChild(c); b.append(tt, w);
        return { block: b, canvas: c, wrap: w };
    };
    const pie = mkBlock('Количество НП по категориям обеспеченности', 'analytics-pie-chart');
    const b1 = mkBlock('Средняя обеспеченность НП по видам связи', 'analytics-bar-services');
    const b2 = mkBlock('Средняя обеспеченность НП услугами мобильной связи', 'analytics-bar-mobile');
    row.append(pie.block, b1.block, b2.block);
    d.appendChild(scroll);

    const tc = document.querySelector('.table__rating');
    const bb = tc?.querySelector('.table_buttons');
    if (tc) { if (bb) tc.insertBefore(d, bb); else tc.appendChild(d); }

    const cats = [
        { label: '0-20',   min: 0,   max: 20,  count: 0, color: '#ED933B' },
        { label: '21-40',  min: 21,  max: 40,  count: 0, color: '#4CBDF7' },
        { label: '41-60',  min: 41,  max: 60,  count: 0, color: '#618CEA' },
        { label: '61-80',  min: 61,  max: 80,  count: 0, color: '#A7E431' },
        { label: '81-100', min: 81,  max: 100, count: 0, color: '#3BC35D' }
    ];
    items.forEach(it => {
        const r = state.allRatings[String(it.id)];
        if (!r || r.rating == null || isNaN(r.rating)) return;
        const v = Number(r.rating);
        const c = cats.find(x => v >= x.min && v <= x.max);
        if (c) c.count++;
    });
    const denom = total || 1;
    const catsD = [...cats].reverse();

    state.analyticsChart = new Chart(pie.canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: cats.map(c => c.label),
            datasets: [{ data: cats.map(c => c.count), backgroundColor: cats.map(c => c.color), borderColor: '#fff', borderWidth: 2, hoverOffset: 10, hoverBorderWidth: 2 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '50%',
            layout: { padding: { top: 4, bottom: 4, left: 4, right: 4 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#bdbdbd', titleColor: '#000', bodyColor: '#000', borderColor: '#fff', borderWidth: 0,
                    bodyFont: { size: 13, weight: 'bold' },
                    callbacks: { label: ctx => { const v = ctx.parsed; const p = ((v / denom) * 100).toFixed(2); return ` ${ctx.label}: ${v} НП (${p.replace('.', ',')}%)`; } }
                }
            }
        }
    });

    // Таблица под круговой
    (() => {
        const old = pie.block.querySelector('.pie-stats-table'); if (old) old.remove();
        const tbl = document.createElement('table'); tbl.className = 'pie-stats-table';
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        [{ t: 'Цвет', w: '12%' }, { t: 'Об., %', w: '26%' }, { t: 'Кол-во НП', w: '26%' }, { t: '% НП', w: '36%' }].forEach(h => {
            const th = document.createElement('th'); th.textContent = h.t; th.style.width = h.w; hr.appendChild(th);
        });
        thead.appendChild(hr); tbl.appendChild(thead);
        const tbody = document.createElement('tbody');
        catsD.forEach(c => {
            const tr = document.createElement('tr');
            const tdC = document.createElement('td'); const dot = document.createElement('span'); dot.className = 'pie-stats-table__dot'; dot.style.background = c.color; tdC.appendChild(dot); tr.appendChild(tdC);
            const tdR = document.createElement('td'); tdR.textContent = c.label; tr.appendChild(tdR);
            const tdN = document.createElement('td'); tdN.textContent = c.count; tr.appendChild(tdN);
            const tdP = document.createElement('td'); tdP.textContent = (c.count / denom * 100).toFixed(2).replace('.', ',') + ' %'; tr.appendChild(tdP);
            tbody.appendChild(tr);
        });
        tbl.appendChild(tbody); pie.block.appendChild(tbl);
    })();

    const FXH = 110;
    const commonBar = {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 8, bottom: 0 } },
        scales: {
            x: {
                stacked: true, border: { display: false },
                ticks: { color: '#000', font: { size: 12, weight: 'bold' }, maxRotation: 45, minRotation: 45, autoSkip: false, padding: 8 },
                grid: { display: false },
                afterFit(scale) { scale.height = FXH; }
            },
            y: {
                stacked: true, beginAtZero: true, min: 0, max: 100, border: { display: false },
                ticks: { stepSize: 20, color: '#000', font: { size: 12, weight: 'bold' }, callback: v => v + '%' },
                grid: { color: 'rgba(0,0,0,0.08)' },
                title: { display: true, text: 'Обеспеченность,%', color: '#000', font: { size: 13, weight: 'bold' } }
            }
        },
        plugins: {
            legend: { position: 'top', labels: { font: { size: 14, weight: 'bold' }, color: '#000', boxWidth: 16, boxHeight: 16, padding: 10 } },
            tooltip: {
                backgroundColor: '#bdbdbd', titleColor: '#000', bodyColor: '#000', borderColor: '#fff', borderWidth: 0,
                callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} %` }
            }
        }
    };

    const sGroups = [
        { key: 'rating_mobile', label: 'Моб. связь' },
        { key: 'rating_wifi',   label: 'ШПД(Wi-Fi)' },
        { key: 'rating_tv',     label: 'ТВ' },
        { key: 'rating_rv',     label: 'РВ' },
        { key: 'rating_satellites', label: 'Спутниковая связь' },
        { keys: ['rating_focl','rating_payphones'], label: 'Проводная связь' },
        { key: 'rating_posts',  label: 'Почтовая связь' }
    ];
    const sStats = sGroups.map(g => {
        let sum = 0, cnt = 0;
        items.forEach(it => {
            const r = state.allRatings[String(it.id)]; if (!r) return;
            if (g.keys?.length) {
                let ls = 0, lc = 0;
                g.keys.forEach(k => { const v = Number(r[k]); if (!isNaN(v)) { ls += v; lc++; } });
                if (lc) { sum += ls / lc; cnt++; }
            } else {
                const v = Number(r[g.key]); if (!isNaN(v)) { sum += v; cnt++; }
            }
        });
        const avg = cnt ? sum / cnt : 0;
        return { label: g.label, provided: +avg.toFixed(2), deficit: +(100 - avg).toFixed(2) };
    });

    state.analyticsBarServices = new Chart(b1.canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sStats.map(s => s.label),
            datasets: [
                { label: 'Обеспеченность,%', data: sStats.map(s => s.provided), backgroundColor: '#4AC15D', borderColor: '#4AC15D', borderWidth: 0, stack: 'total' },
                { label: 'Дефицит,%',        data: sStats.map(s => s.deficit),  backgroundColor: '#ED933B', borderColor: '#ED933B', borderWidth: 0, stack: 'total' }
            ]
        },
        options: commonBar
    });

    const mGroups = [
        { key: 'rating_5g',    label: '5G' },
        { key: 'rating_lte',   label: 'LTE' },
        { key: 'rating_gsm',   label: 'GSM' },
        { key: 'rating_tetra', label: 'Tetra' }
    ];
    const mStats = mGroups.map(g => {
        let sum = 0, cnt = 0;
        items.forEach(it => {
            const r = state.allRatings[String(it.id)]; if (!r) return;
            const v = Number(r[g.key]); if (!isNaN(v)) { sum += v; cnt++; }
        });
        const avg = cnt ? sum / cnt : 0;
        return { label: g.label, provided: +avg.toFixed(2), deficit: +(100 - avg).toFixed(2) };
    });

    state.analyticsBarMobile = new Chart(b2.canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: mStats.map(s => s.label),
            datasets: [
                { label: 'Обеспеченность,%', data: mStats.map(s => s.provided), backgroundColor: '#4AC15D', borderColor: '#4AC15D', borderWidth: 0, stack: 'total' },
                { label: 'Дефицит,%',        data: mStats.map(s => s.deficit),  backgroundColor: '#ED933B', borderColor: '#ED933B', borderWidth: 0, stack: 'total' }
            ]
        },
        options: commonBar
    });
}