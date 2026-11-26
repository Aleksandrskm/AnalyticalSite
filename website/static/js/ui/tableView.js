'use strict';
import { state } from '../core/state.js';
import { LS_KEYS, lsGet } from '../core/storage.js';
import {
    SETTLEMENTS_DB_TO_OBJECT_KEY, RANKING_DB_TO_OBJECT_KEY,
    SETTLEMENTS_COLUMN_LABELS, RANKING_COLUMN_LABELS
} from '../core/constants.js';
import { buildRatingGroups } from '../core/ratingGroups.js';
import { getValueByDbColumn } from '../services/settlementsService.js';
import { editRow } from '../db.js';
import { TABLE_SETTLEMENTS, TABLE_RANKING, EDIT_DB_NAME } from '../core/constants.js';
import { hideChartContainer, destroyChart } from './chartView.js';
import { destroyAnalyticsDashboard } from './analyticsView.js';
import { showPlaceholder, hidePlaceholder, showResPageSize, renderPopup } from './common.js';
import { showSettlementButtons, hideSettlementButtons } from '../buttons/resButtons.js';
import {
    showCalculateAllButton,
    hideCalculateAllButton,
    showCalculateSelectedButton,
    hideCalculateSelectedButton
} from '../buttons/calculateButtons.js';
import {
    resetAndHideSelectedSettlement,
    setSelectedSettlement,
    showSelectedSettlementBlock
} from './selectedSettlement.js';
import { openEditModal } from './modals/editModal.js';

/* ================= ФИЛЬТРЫ ================= */
export function filterData(data, field, value, exactMatch = false) {
    if (!value || !field) return data;
    return data.filter(row => {
        const v = row[field];
        if (v === null || v === undefined) return false;
        const s = String(v), q = String(value);
        return exactMatch
            ? s.toLowerCase() === q.toLowerCase()
            : s.toLowerCase().includes(q.toLowerCase());
    });
}

const RATING_FIELDS = new Set([
    'rating',
    'count_res_tv', 'count_res_rv', 'count_res_lte', 'count_res_gsm', 'count_res_5g',
    'count_res_wifi', 'count_res_tetra', 'count_operators',
    'count_abonents_lte', 'population_percent_lte', 'communication_coverage_lte',
    'communication_coverage_percent_lte', 'traffic_lte', 'traffic_percent_lte',
    'count_abonents_gsm', 'population_percent_gsm', 'communication_coverage_gsm',
    'communication_coverage_percent_gsm', 'traffic_gsm', 'traffic_percent_gsm',
    'count_abonents_5g', 'population_percent_5g', 'communication_coverage_5g',
    'communication_coverage_percent_5g', 'traffic_5g', 'traffic_percent_5g',
    'count_abonents_wifi', 'population_percent_wifi', 'communication_coverage_wifi',
    'communication_coverage_percent_wifi', 'traffic_wifi', 'traffic_percent_wifi',
    'count_abonents_tetra', 'population_percent_tetra', 'communication_coverage_tetra',
    'communication_coverage_percent_tetra', 'traffic_tetra', 'traffic_percent_tetra',
    'count_satellites', 'count_abonents_satellites', 'population_percent_satellites',
    'communication_coverage_satellites', 'communication_coverage_percent_satellites',
    'traffic_satellites', 'traffic_percent_satellites', 'count_operators_satellites',
    'operators_percent_satellites', 'rating_satellites',
    'count_res_mobile', 'count_abonents_mobile', 'population_percent_mobile',
    'communication_coverage_mobile', 'communication_coverage_percent_mobile',
    'traffic_mobile', 'traffic_percent_mobile'
]);

export function filterDataWithRatings(data, ratings, field, value, exactMatch = false) {
    if (!value || !field) return data;
    return data.filter(row => {
        const v = RATING_FIELDS.has(field) ? (ratings[String(row.id)] || {})[field] : row[field];
        if (v === null || v === undefined) return false;
        const s = String(v), q = String(value);
        return exactMatch
            ? s.toLowerCase() === q.toLowerCase()
            : s.toLowerCase().includes(q.toLowerCase());
    });
}

/* ================= СОРТИРОВКА ================= */
export function sortDataWithRatings(data, ratings, sortField, sortOrder) {
    if (!sortField || !data.length) return data;
    const isRating = RATING_FIELDS.has(sortField);
    const cached = data.map(item => {
        let value = isRating ? (ratings[String(item.id)] || {})[sortField] : item[sortField];
        if (value === undefined || value === null) value = '';
        else if (typeof value === 'string') value = value.toLowerCase();
        return { item, sortValue: value };
    });
    cached.sort((a, b) => {
        const va = a.sortValue, vb = b.sortValue;
        if (typeof va === 'number' && typeof vb === 'number')
            return sortOrder === 'asc' ? va - vb : vb - va;
        if (typeof va === 'string' && typeof vb === 'string')
            return sortOrder === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortOrder === 'asc'
            ? String(va).localeCompare(String(vb))
            : String(vb).localeCompare(String(va));
    });
    return cached.map(c => c.item);
}

export function getPageData(allData, page, pageSize) {
    const start = page * pageSize;
    return allData.slice(start, Math.min(start + pageSize, allData.length));
}

/* ================= ЛОКАЛЬНОЕ ОБНОВЛЕНИЕ ================= */
export function applyLocalUpdates(settlementId, table, updates) {
    if (!updates || !Object.keys(updates).length) return;
    if (table === 'settlements') {
        const item = state.settlementsData.items.find(it => String(it.id) === String(settlementId));
        if (!item) return;
        Object.keys(updates).forEach(dbCol => {
            const objKey = SETTLEMENTS_DB_TO_OBJECT_KEY[dbCol] || dbCol;
            let v = updates[dbCol];
            if (v === null) { item[objKey] = null; return; }
            if (v !== '' && !isNaN(v)) {
                const textFields = ['NAME', 'OTHER_NAME', 'REGION_NAME', 'DISTRICT', 'FIAS_GUID'];
                if (!textFields.includes(dbCol)) {
                    const n = Number(v);
                    v = Number.isInteger(n) ? n : Math.round(n);
                }
            }
            item[objKey] = v;
        });
    } else if (table === 'ranking') {
        const rating = state.allRatings[String(settlementId)];
        if (!rating) return;
        Object.keys(updates).forEach(dbCol => {
            const objKey = RANKING_DB_TO_OBJECT_KEY[dbCol] || dbCol;
            let v = updates[dbCol];
            if (v === null) { rating[objKey] = null; return; }
            if (v !== '' && !isNaN(v)) {
                const n = Number(v);
                v = Number.isInteger(n) ? n : Math.round(n);
            }
            rating[objKey] = v;
        });
    }
}
/* ================= ЗАГОЛОВОК ТАБЛИЦЫ ================= */
function buildTableTitle(baseTitle, data) {
    const rows = Array.isArray(data) ? data : [];

    // ---- Выбранные регионы ----
    const selectedCodes = new Set(
        (Array.isArray(state.currentRegions) ? state.currentRegions : [])
            .map(r => (typeof r === 'string' ? r : (r && r.code) || ''))
            .filter(Boolean)
            .map(String)
    );
    const isAllRegions = selectedCodes.size === 0;

    // ---- Уникальные названия регионов из данных ----
    const regionNamesSet = new Set();
    rows.forEach(r => {
        if (!r) return;
        const name = (r.region_name || '').trim();
        if (!name) return;
        if (!isAllRegions) {
            const code = r.region_code != null ? String(r.region_code) : '';
            if (!selectedCodes.has(code)) return;
        }
        regionNamesSet.add(name);
    });
    const regionNames = Array.from(regionNamesSet);

    // ---- Радиокнопка «все» ----
    const allRadio = document.getElementById('number-settlements');
    const isAllPop = allRadio ? allRadio.checked : false;

    // ---- Диапазон населения ----
    let minPop = null, maxPop = null;
    if (!isAllPop) {
        const pr = state.currentPopRange;
        if (Array.isArray(pr)) {
            minPop = pr[0] ?? null;
            maxPop = pr[1] ?? null;
        } else if (pr && typeof pr === 'object') {
            minPop = (pr.min ?? pr.from ?? null);
            maxPop = (pr.max ?? pr.to   ?? null);
        }

        // Если state пустой — берём прямо из инпутов
        if (minPop === null) {
            const el = document.getElementById('numbers-settlement');
            if (el && el.value !== '') minPop = el.value;
        }
        if (maxPop === null) {
            const el = document.getElementById('numbers-settlements');
            if (el && el.value !== '') maxPop = el.value;
        }
    }

    const norm = v => (v === undefined || v === null || v === '') ? null : v;
    minPop = norm(minPop);
    maxPop = norm(maxPop);
    const hasPop = (minPop !== null) || (maxPop !== null);

    const popPart = hasPop
        ? `для НП численностью от ${minPop !== null ? minPop : '0'} до ${maxPop !== null ? maxPop : '∞'} чел.`
        : '';

    // ---- Региональная часть ----
    let suffix = '';

    if (isAllRegions) {
        if (regionNames.length === 1) {
            suffix = `: ${regionNames[0]} для всех НП${popPart}`;
        } else if (regionNames.length > 1) {
            suffix = `: все регионы для всех НП${popPart}`;
        } else {
            suffix = `: для всех НП${popPart}`;
        }
    } else {
        // Выбран конкретный регион(ы)
        const allNpPart = isAllPop ? ' для всех НП' : '';
        if (regionNames.length > 0) {
            suffix = `: ${regionNames.join(', ')}${allNpPart}${popPart}`;
        } else {
            suffix = `: все регионы${allNpPart}${popPart}`;
        }
    }

    return `${baseTitle}${suffix}`;
}
/* ================= ОБЩЕЕ: ПОКАЗАТЬ КНОПКИ И РАЗМЕР ===== */
function ensureTableButtons() {
    state.isChartMode = false;
    state.isAnalyticsMode = false;
    showResPageSize();
    showSettlementButtons();
    showCalculateAllButton();
    showCalculateSelectedButton();
}

export function refreshCurrentView(settlementId) {
    if (state.isAnalyticsMode) {
        import('./analyticsView.js').then(m => m.renderAnalyticsDashboard());
        return;
    }
    const pageSize = state.settlementsData.pageSize || 100;
    if (state.isChartMode) {
        import('./chartView.js').then(({ showChartContainer, createRatingChart }) => {
            const chartData = state.settlementsData.items.map(it => {
                const r = state.allRatings[String(it.id)] || {};
                return {
                    id: it.id, name: it.name, region_name: it.region_name,
                    district_name: it.district_name, population: it.population,
                    rating: r.rating || 0
                };
            });
            chartData.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            showChartContainer();
            createRatingChart(chartData, state.chartType);
        });
        return;
    }
    const keepFilter = !!(state.savedFilterField && state.savedFilterValue);
    const fn = state.showRatings ? renderCombinedTable : renderSettlementsTableOnly;
    fn(state.originalDataForFilter, state.originalTotalForFilter, state.currentDisplayPage, pageSize, keepFilter);
    if (settlementId !== undefined && settlementId !== null) {
        document.querySelectorAll('#settlements-table tbody tr').forEach(tr => {
            tr.classList.toggle('selected', String(tr.dataset.id) === String(settlementId));
        });
    }
}

export function rerenderCurrentTable() {
    const pageSize = state.settlementsData.pageSize || 100;
    const keepFilter = !!(state.savedFilterField && state.savedFilterValue);
    const fn = state.showRatings ? renderCombinedTable : renderSettlementsTableOnly;
    fn(state.originalDataForFilter, state.originalTotalForFilter, state.currentDisplayPage, pageSize, keepFilter);
}

export function resetChartUIState() {
    const fg = document.getElementById('format-controls-group'); if (fg) fg.remove();
    const tt = document.getElementById('chart-item-tooltip');    if (tt) tt.remove();
    showSelectedSettlementBlock();
}

/* ================= ПЕРЕХОД К НП В ТАБЛИЦЕ ================= */
export function jumpToSettlementInTable(settlementId) {
    if (!settlementId) return;
    const targetId = String(settlementId).trim();
    const fullData = state.currentSettlementsFiltered || [];
    if (!fullData.length) { renderPopup('Таблица пуста'); return; }
    let globalIndex = -1;
    for (let i = 0; i < fullData.length; i++) {
        if (String(fullData[i].id) === targetId) { globalIndex = i; break; }
    }
    if (globalIndex === -1) { renderPopup('НП не найден в текущей таблице'); return; }
    const pageSize = state.settlementsData.pageSize || 100;
    const targetPage = Math.floor(globalIndex / pageSize);
    if (targetPage !== state.currentDisplayPage) {
        state.currentDisplayPage = targetPage;
        const fn = state.showRatings ? renderCombinedTable : renderSettlementsTableOnly;
        const keepFilter = !!(state.savedFilterField && state.savedFilterValue);
        fn(state.originalDataForFilter, state.originalTotalForFilter, targetPage, pageSize, keepFilter);
        requestAnimationFrame(() => {
            const tbody = document.querySelector('#settlements-table tbody');
            if (!tbody) return;
            for (const tr of tbody.querySelectorAll('tr')) {
                if (String(tr.dataset.id) === targetId) {
                    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    break;
                }
            }
        });
        return;
    }
    const tbody = document.querySelector('#settlements-table tbody');
    if (!tbody) return;
    for (const tr of tbody.querySelectorAll('tr')) {
        if (String(tr.dataset.id) === targetId) {
            tr.click();
            tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }
    renderPopup('НП не найден на текущей странице');
}

/* ================= ВЫБОР НАЧАЛЬНОЙ СТРОКИ ================= */
export function selectInitialRowInTable(tbody, options = {}) {
    if (!tbody) return false;
    const { goToPage = null, currentPage = 0, pageSize = 100, sortedData = null, allowAutoPageJump = true } = options;
    const storedId = lsGet(LS_KEYS.idNp, null);
    const targetId = storedId ? String(storedId).trim() : null;
    if (!targetId) return false;
    for (const tr of tbody.querySelectorAll('tr')) {
        if (String(tr.dataset.id) === targetId) { tr.click(); return true; }
    }
    if (!allowAutoPageJump) return false;
    if (Array.isArray(sortedData) && sortedData.length > 0) {
        let gi = -1;
        for (let i = 0; i < sortedData.length; i++) {
            if (String(sortedData[i].id) === targetId) { gi = i; break; }
        }
        if (gi !== -1) {
            const tp = Math.floor(gi / pageSize);
            if (tp !== currentPage && typeof goToPage === 'function') { goToPage(tp); return true; }
        }
    }
    return false;
}

/* ================= ДВОЙНОЙ КЛИК ================= */
export function setupDoubleClickHandler() {
    const table = document.getElementById('settlements-table');
    if (!table) return;

    table.addEventListener('dblclick', function (e) {
        const row = e.target.closest('tbody tr');
        if (!row) return;
        const id = row.dataset.id;
        if (!id) return;

        // Подсветка выбранной строки
        document.querySelectorAll('#settlements-table tbody tr').forEach(tr => tr.classList.remove('selected'));
        row.classList.add('selected');

        if (state.showRatings) {
            // Режим таблицы обеспеченности → модалка рейтинга
            openEditModal(id, 'rating', 'rating');
        } else {
            // Режим таблицы НП → модалка НП
            const lat = parseFloat(row.dataset.lat);
            const lon = parseFloat(row.dataset.lon);
            const area = parseFloat(row.dataset.area);
            const name = row.dataset.name;

            if (!isNaN(lat) && !isNaN(lon)) {
                state.selectedSettlementId = id;
                state.selectedSettlementLat = lat;
                state.selectedSettlementLon = lon;
                state.selectedSettlementArea = area || 1;
                state.selectedSettlementName = name || '';
            }
            openEditModal(id, 'settlement', 'settlements');
        }
    });
}

/* ================= ПАГИНАЦИЯ ================= */
export function renderSettlementsPagination(total, currentPage, totalPages, pageSize) {
    const container = document.getElementById('settlements-pagination');
    if (!container) return;
    container.innerHTML = '';
    container.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:10px 0';
    const info = document.createElement('div');
    info.className = 'pagination-info';
    info.textContent = `Всего НП: ${total}, Страница ${currentPage + 1} из ${totalPages || 1}`;
    container.appendChild(info);
    const ctrls = document.createElement('div');
    ctrls.className = 'pagination-controls';
    ctrls.style.cssText = 'display:flex;align-items:center;gap:6px';
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀'; prevBtn.className = 'pagination-btn';
    prevBtn.disabled = currentPage === 0;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 0) {
            state.currentDisplayPage = currentPage - 1;
            rerenderCurrentTable();
        }
    });
    ctrls.appendChild(prevBtn);
    const pageInput = document.createElement('input');
    pageInput.type = 'number'; pageInput.className = 'page-input';
    pageInput.min = 1; pageInput.max = totalPages || 1;
    pageInput.value = currentPage + 1;
    pageInput.style.cssText = 'width:40px;text-align:center';
    pageInput.addEventListener('change', function () {
        let v = parseInt(this.value);
        if (isNaN(v) || v < 1) v = 1;
        if (v > totalPages) v = totalPages || 1;
        this.value = v;
        const idx = v - 1;
        if (idx !== currentPage) {
            state.currentDisplayPage = idx;
            rerenderCurrentTable();
        }
    });
    ctrls.appendChild(pageInput);
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶'; nextBtn.className = 'pagination-btn';
    nextBtn.disabled = currentPage >= totalPages - 1 || totalPages === 0;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages - 1) {
            state.currentDisplayPage = currentPage + 1;
            rerenderCurrentTable();
        }
    });
    ctrls.appendChild(nextBtn);
    const ps = document.createElement('select');
    ps.className = 'page-size-select';
    ps.style.cssText = 'min-width:50px;padding:4px 8px';
    [10, 25, 50, 100, 200, 500].forEach(s => {
        const o = document.createElement('option');
        o.value = s; o.textContent = s;
        if (s === pageSize) o.selected = true;
        ps.appendChild(o);
    });
    ps.addEventListener('change', function () {
        state.settlementsData.pageSize = parseInt(this.value);
        state.currentDisplayPage = 0;
        rerenderCurrentTable();
    });
    ctrls.appendChild(ps);
    container.appendChild(ctrls);
}

/* ================= РЕНДЕР: ТОЛЬКО НП ================= */
function buildFilterUI(allData, headers, onApply, onReset) {
    const tc = document.querySelector('.table__rating');
    if (!tc) return null;
    const old = document.querySelector('.filter-container'); if (old) old.remove();
    const fc = document.createElement('div'); fc.className = 'filter-container';
    const fd = document.createElement('div'); fd.className = 'filter-field-group';
    const fl = document.createElement('label'); fl.textContent = 'Поле для фильтрации'; fl.className = 'filter-label';
    const fs = document.createElement('select'); fs.className = 'filter-field-select';
    const none = document.createElement('option'); none.value = ''; none.textContent = '-- Выберите поле --';
    fs.appendChild(none);
    headers.forEach(h => {
        const o = document.createElement('option'); o.value = h.key; o.textContent = h.label; fs.appendChild(o);
    });
    fs.value = state.savedFilterField || 'name';
    fd.append(fl, fs); fc.appendChild(fd);
    const vd = document.createElement('div'); vd.className = 'filter-value-group';
    const vl = document.createElement('label'); vl.textContent = 'Значение'; vl.className = 'filter-label';
    const vi = document.createElement('input'); vi.className = 'filter-value-input'; vi.type = 'text'; vi.placeholder = 'Введите значение...';
    if (state.savedFilterValue) vi.value = state.savedFilterValue;
    vd.append(vl, vi); fc.appendChild(vd);
    const ed = document.createElement('div'); ed.className = 'filter-exact-group';
    const ec = document.createElement('input'); ec.type = 'checkbox'; ec.className = 'filter-exact-checkbox'; ec.checked = state.savedFilterExact;
    const el = document.createElement('label'); el.textContent = 'Точное совпадение';
    ed.append(ec, el); fc.appendChild(ed);
    const bd = document.createElement('div'); bd.className = 'filter-buttons-group';
    const ab = document.createElement('button'); ab.textContent = 'Применить'; ab.className = 'filter-apply-btn';
    const rb = document.createElement('button'); rb.textContent = 'Сбросить'; rb.className = 'filter-reset-btn';
    bd.append(ab, rb); fc.appendChild(bd);
    ab.addEventListener('click', () => {
        const f = fs.value, v = vi.value, ex = ec.checked;
        if (f && v) onApply(f, v, ex);
    });
    rb.addEventListener('click', () => {
        state.savedFilterField = ''; state.savedFilterValue = ''; state.savedFilterExact = false;
        state.currentFilterField = ''; state.currentFilterValue = ''; state.currentFilterExact = false;
        state.currentDisplayPage = 0;
        fs.value = ''; vi.value = ''; ec.checked = false;
        onReset();
    });
    tc.prepend(fc);
    return { fs, vi, ec };
}

export function renderSettlementsTableOnly(data, total, page, pageSize, keepFilter = false, allowAutoPageJump = false) {
    destroyAnalyticsDashboard();
    const table = document.getElementById('settlements-table');
    if (!table) { console.error('Таблица settlements-table не найдена'); return; }
    hideChartContainer();
    state.isChartMode = false;
    table.style.display = 'block';
    hidePlaceholder();
    const oldT = document.querySelector('.settlements-title'); if (oldT) oldT.remove();
    const title = document.createElement('h3');
    title.className = 'settlements-title';
    title.textContent = buildTableTitle('Таблица населенных пунктов региона', data);
    table.parentNode.insertBefore(title, table);
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';
    let filtered = data;
    if (keepFilter && state.savedFilterField && state.savedFilterValue)
        filtered = filterData(data, state.savedFilterField, state.savedFilterValue, state.savedFilterExact);
    let sorted = [...filtered];
    if (state.currentSortField) {
        sorted.sort((a, b) => {
            let va = a[state.currentSortField] ?? '', vb = b[state.currentSortField] ?? '';
            if (typeof va === 'number' && typeof vb === 'number')
                return state.currentSortOrder === 'asc' ? va - vb : vb - va;
            va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
            return state.currentSortOrder === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }
    const pageData = getPageData(sorted, page, pageSize);
    const totalPages = Math.ceil(sorted.length / pageSize);
    if (!pageData.length) {
        if (tbody) {
            const r = document.createElement('tr');
            const c = document.createElement('td');
            c.colSpan = 10; c.textContent = 'Нет населенных пунктов для отображения'; c.className = 'empty-message';
            r.appendChild(c); tbody.appendChild(r);
        }
        const pc = document.getElementById('settlements-pagination');
        if (pc) pc.style.display = 'flex';
        renderSettlementsPagination(sorted.length, page, totalPages, pageSize);
        ensureTableButtons();
        return;
    }
    state.currentSettlementsFiltered = sorted;
    state.originalDataForFilter = data;
    state.originalTotalForFilter = total;
    const headers = [
        { key: 'id', label: 'ID' }, { key: 'name', label: 'Название' }, { key: 'area', label: 'Площадь (км²)' },
        { key: 'region_name', label: 'Регион' }, { key: 'region_code', label: 'Код региона' },
        { key: 'district_name', label: 'Муниципальное образование' }, { key: 'lat', label: 'Широта' },
        { key: 'lon', label: 'Долгота' }, { key: 'population', label: 'Население' }, { key: 'fias_id', label: 'Код ФИАС' }
    ];
    buildFilterUI(data, headers,
        (f, v, ex) => {
            state.savedFilterField = f; state.savedFilterValue = v; state.savedFilterExact = ex;
            state.currentFilterField = f; state.currentFilterValue = v; state.currentFilterExact = ex;
            state.currentDisplayPage = 0;
            renderSettlementsTableOnly(data, total, 0, pageSize, true);
        },
        () => renderSettlementsTableOnly(state.originalDataForFilter, state.originalTotalForFilter, 0, pageSize, false)
    );
    if (thead) {
        const hr = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h.label; th.className = 'sortable-header'; th.dataset.key = h.key;
            const ic = document.createElement('span'); ic.className = 'sort-icon';
            if (state.currentSortField === h.key) {
                ic.textContent = state.currentSortOrder === 'asc' ? '▲' : '▼';
            } else {
                ic.textContent = '↕';
            }
            th.appendChild(ic);
            th.addEventListener('click', () => {
                if (state.currentSortField === h.key) state.currentSortOrder = state.currentSortOrder === 'asc' ? 'desc' : 'asc';
                else { state.currentSortField = h.key; state.currentSortOrder = 'asc'; }
                state.currentDisplayPage = 0;
                renderSettlementsTableOnly(data, total, 0, pageSize, true);
            });
            hr.appendChild(th);
        });
        thead.appendChild(hr);
    }
    if (tbody) {
        pageData.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id; row.dataset.lat = item.lat; row.dataset.lon = item.lon;
            row.dataset.area = item.area || 1; row.dataset.name = item.name || '';
            row.className = 'clickable-row';
            const cells = [
                item.id,
                item.name || '-',
                (item.area !== null && item.area !== undefined) ? item.area : '-',
                item.region_name || '-',
                item.region_code || '-',
                item.district_name || '-',
                item.lat !== undefined ? item.lat.toFixed(6) : '-',
                item.lon !== undefined ? item.lon.toFixed(6) : '-',
                item.population || 0,
                item.fias_id || '-'
            ];
            cells.forEach(v => { const td = document.createElement('td'); td.textContent = v; row.appendChild(td); });
            row.addEventListener('click', function () {
                document.querySelectorAll('#settlements-table tbody tr').forEach(tr => tr.classList.remove('selected'));
                this.classList.add('selected');
                state.selectedSettlementId = this.dataset.id;
                state.selectedSettlementLat = parseFloat(this.dataset.lat);
                state.selectedSettlementLon = parseFloat(this.dataset.lon);
                state.selectedSettlementArea = parseFloat(this.dataset.area);
                state.selectedSettlementName = this.dataset.name;
                setSelectedSettlement(item, 'table');
                showResPageSize();
                showSettlementButtons();
            });
            tbody.appendChild(row);
        });
    }
    const pc = document.getElementById('settlements-pagination');
    if (pc) pc.style.display = 'flex';
    renderSettlementsPagination(sorted.length, page, totalPages, pageSize);
    if (pageData.length > 0) {
        selectInitialRowInTable(tbody, {
            sortedData: sorted, currentPage: page, pageSize, allowAutoPageJump,
            goToPage: (newPage) => {
                state.currentDisplayPage = newPage;
                renderSettlementsTableOnly(data, total, newPage, pageSize, !!(state.savedFilterField && state.savedFilterValue));
            }
        });
    }
    ensureTableButtons();
}

/* ================= РЕНДЕР: ОБЪЕДИНЁННАЯ ================= */
export function renderCombinedTable(data, total, page, pageSize, keepFilter = false, allowAutoPageJump = false) {
    destroyAnalyticsDashboard();
    const table = document.getElementById('settlements-table');
    if (!table) { console.error('Таблица settlements-table не найдена'); return; }
    hideChartContainer();
    state.isChartMode = false;
    table.style.display = 'block';
    hidePlaceholder();
    const oldT = document.querySelector('.settlements-title'); if (oldT) oldT.remove();
    const title = document.createElement('h3');
    title.className = 'settlements-title';
    title.textContent = buildTableTitle('Таблица обеспеченности НП региона', data);
    table.parentNode.insertBefore(title, table);
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';
    let filtered = data;
    if (keepFilter && state.savedFilterField && state.savedFilterValue)
        filtered = filterDataWithRatings(data, state.allRatings, state.savedFilterField, state.savedFilterValue, state.savedFilterExact);
    let sorted = [...filtered];
    if (state.currentSortField) sorted = sortDataWithRatings(sorted, state.allRatings, state.currentSortField, state.currentSortOrder);
    const pageData = getPageData(sorted, page, pageSize);
    const totalPages = Math.ceil(sorted.length / pageSize);
    if (!pageData.length) {
        if (tbody) {
            const r = document.createElement('tr');
            const c = document.createElement('td');
            c.colSpan = 100; c.textContent = 'Нет населенных пунктов для отображения'; c.className = 'empty-message';
            r.appendChild(c); tbody.appendChild(r);
        }
        const pc = document.getElementById('settlements-pagination');
        if (pc) pc.style.display = 'flex';
        renderSettlementsPagination(sorted.length, page, totalPages, pageSize);
        ensureTableButtons();
        return;
    }
    state.currentSettlementsFiltered = sorted;
    state.originalDataForFilter = data;
    state.originalTotalForFilter = total;

    // === ТОЛЬКО РАЗРЕШЁННЫЕ КОЛОНКИ, «Обеспеченность» сразу после «Название» ===
    const isScoreKey = (k) => k === 'rating' || /^rating_/i.test(k);

    // Обратный маппинг: objectKey → label из RANKING_COLUMN_LABELS (русские названия)
    const rankingLabelByKey = {};
    Object.keys(RANKING_COLUMN_LABELS).forEach(db => {
        const key = RANKING_DB_TO_OBJECT_KEY[db] || db;
        rankingLabelByKey[key] = RANKING_COLUMN_LABELS[db];
    });

    const settlementBaseTop = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Название' }
    ];
    const ratingCol = { key: 'rating', label: 'Обеспеченность, %' };
    const settlementBaseBottom = [
        { key: 'area', label: 'Площадь (км²)' },
        { key: 'district_name', label: 'Муниципальное образование' },
        { key: 'lon', label: 'Долгота' },
        { key: 'lat', label: 'Широта' },
        { key: 'population', label: 'Население' }
    ];

    // Только rating_* из ratingGroups; label — из RANKING_COLUMN_LABELS + добавляем ", %"
    const ratingHeaders = [];
    buildRatingGroups().forEach(g => {
        g.fields.forEach(f => {
            if (isScoreKey(f.key) && f.key !== 'rating') {
                let label = rankingLabelByKey[f.key] || f.label;
                if (!label.endsWith(', %')) label += ', %'; // Добавляем процент
                ratingHeaders.push({ key: f.key, label, group: g.title });
            }
        });
    });

    // Порядок: ID, Название, Обеспеченность, Площадь, МО, Долгота, Широта, Население, rating_*
    const headers = [...settlementBaseTop, ratingCol, ...settlementBaseBottom, ...ratingHeaders];

    buildFilterUI(data, headers,
        (f, v, ex) => {
            state.savedFilterField = f; state.savedFilterValue = v; state.savedFilterExact = ex;
            state.currentFilterField = f; state.currentFilterValue = v; state.currentFilterExact = ex;
            state.currentDisplayPage = 0;
            renderCombinedTable(data, total, 0, pageSize, true);
        },
        () => renderCombinedTable(state.originalDataForFilter, state.originalTotalForFilter, 0, pageSize, false)
    );
    if (thead) {
        const hr = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h.label; th.className = 'sortable-header'; th.dataset.key = h.key;
            if (h.group) th.dataset.group = h.group;
            const ic = document.createElement('span'); ic.className = 'sort-icon';
            if (state.currentSortField === h.key) {
                ic.textContent = state.currentSortOrder === 'asc' ? '▲' : '▼';
            } else {
                ic.textContent = '↕';
            }
            th.appendChild(ic);
            th.addEventListener('click', () => {
                if (state.currentSortField === h.key) state.currentSortOrder = state.currentSortOrder === 'asc' ? 'desc' : 'asc';
                else { state.currentSortField = h.key; state.currentSortOrder = 'asc'; }
                state.currentDisplayPage = 0;
                renderCombinedTable(data, total, 0, pageSize, true);
            });
            hr.appendChild(th);
        });
        thead.appendChild(hr);
    }
    if (tbody) {
        pageData.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id; row.dataset.lat = item.lat; row.dataset.lon = item.lon;
            row.dataset.area = item.area || 1; row.dataset.name = item.name || '';
            row.className = 'clickable-row';
            const rating = state.allRatings[String(item.id)] || {};
            headers.forEach(h => {
                const td = document.createElement('td');
                let v = h.key in item ? item[h.key] : (h.key in rating ? rating[h.key] : '-');
                if (v === undefined || v === null) v = '-';
                if ((h.key === 'lat' || h.key === 'lon') && typeof v === 'number') v = v.toFixed(6);
                td.textContent = v;
                row.appendChild(td);
            });
            row.addEventListener('click', function () {
                document.querySelectorAll('#settlements-table tbody tr').forEach(tr => tr.classList.remove('selected'));
                this.classList.add('selected');
                state.selectedSettlementId = this.dataset.id;
                state.selectedSettlementLat = parseFloat(this.dataset.lat);
                state.selectedSettlementLon = parseFloat(this.dataset.lon);
                state.selectedSettlementArea = parseFloat(this.dataset.area);
                state.selectedSettlementName = this.dataset.name;
                setSelectedSettlement(item, state.showRatings ? 'rating' : 'table');
                showResPageSize();
                showSettlementButtons();
            });
            tbody.appendChild(row);
        });
    }
    const pc = document.getElementById('settlements-pagination');
    if (pc) pc.style.display = 'flex';
    renderSettlementsPagination(sorted.length, page, totalPages, pageSize);
    if (pageData.length > 0) {
        selectInitialRowInTable(tbody, {
            fallbackToFirst: true, persistFallback: true,
            sortedData: sorted, currentPage: page, pageSize, allowAutoPageJump,
            goToPage: (newPage) => {
                state.currentDisplayPage = newPage;
                renderCombinedTable(data, total, newPage, pageSize, !!(state.savedFilterField && state.savedFilterValue));
            }
        });
    }
    ensureTableButtons();
}