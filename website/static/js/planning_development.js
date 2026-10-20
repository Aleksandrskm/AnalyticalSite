'use strict';

import { Loader } from './Loader.js';
import { getRegions, getSettlementsPage } from './db.js';

/* ==================== ЗАГРУЗЧИК ==================== */
let loader = null;
function initLoader() {
    if (!loader) loader = new Loader('.loader-container');
    return loader;
}

/* ==================== СОСТОЯНИЕ ==================== */
let currentSettlement = null;

// Хранилище значений по каждому НП: id -> { actual, planned }
const provisionStore = new Map();

/* ==================== ЦВЕТА ЗОН ==================== */
const ZONE_COLORS = {
    critical:  '#FB8C00', // 0–20   оранжевый
    low:       '#B3E5FC', // 21–40  бледный светло-голубой
    medium:    '#42A5F5', // 41–60  светло-синий
    good:      '#81C784', // 61–80  светло-зелёный
    excellent: '#2E7D32'  // 81–100 насыщенно-зелёный
};

function getZoneInfo(value) {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    if (v >= 81) return { key: 'excellent', label: 'Прекрасная',        color: ZONE_COLORS.excellent };
    if (v >= 61) return { key: 'good',      label: 'Хорошая',           color: ZONE_COLORS.good };
    if (v >= 41) return { key: 'medium',    label: 'Средняя',           color: ZONE_COLORS.medium };
    if (v >= 21) return { key: 'low',       label: 'Низкая',            color: ZONE_COLORS.low };
    return              { key: 'critical',  label: 'Критически низкая', color: ZONE_COLORS.critical };
}

function getOrCreateProvision(settlementId) {
    const id = String(settlementId);
    if (!provisionStore.has(id)) {
        const actual = Math.floor(Math.random() * 101);
        const planned = Math.min(100, actual + 15 + Math.floor(Math.random() * 15));
        provisionStore.set(id, { actual, planned });
    }
    return provisionStore.get(id);
}

/* ==================== ИНИЦИАЛИЗАЦИЯ ==================== */
document.addEventListener('DOMContentLoaded', () => {
    initLoader();
    setupActualInputs();
    setupPlannedInputs();
    loadRandomSettlement();
});

/* ==================== СЛУЧАЙНЫЙ НП ==================== */
async function loadRandomSettlement() {
    const ld = initLoader();
    ld.show('Загрузка населённого пункта...');

    try {
        const regions = await getRegions();
        if (!regions || !regions.length) throw new Error('Список регионов пуст');

        // Перемешиваем регионы — начинаем с произвольного
        const shuffled = [...regions].sort(() => Math.random() - 0.5);

        let found = null;

        for (const region of shuffled.slice(0, 12)) {
            try {
                const body = {
                    regions: [String(region.number).trim()],
                    population_filters: []
                };
                const res = await getSettlementsPage(0, 1, body);
                const list = (res && res.settlements) || [];
                if (list.length) {
                    found = list[Math.floor(Math.random() * list.length)];
                    break;
                }
            } catch (_) {
                // пробуем следующий регион
            }
        }

        if (!found) throw new Error('Не удалось найти населённый пункт');

        currentSettlement = found;

        renderSettlementInfo();
        renderProvisionUI();

        ld.close();
    } catch (e) {
        ld.close();
        console.error('Ошибка загрузки случайного НП:', e);

        const info = document.getElementById('pd-settlement-info');
        info.innerHTML = '<div class="pd-empty">Не удалось загрузить населённый пункт</div>';

        const plannedEmpty = document.getElementById('pd-planned-empty');
        plannedEmpty.textContent = 'Нет данных';
    }
}

/* ==================== СТОЛБЕЦ 1: ИНФОРМАЦИЯ О НП ==================== */
function renderSettlementInfo() {
    const container = document.getElementById('pd-settlement-info');
    container.innerHTML = '';

    if (!currentSettlement) {
        const empty = document.createElement('div');
        empty.className = 'pd-empty';
        empty.textContent = 'Нет данных';
        container.appendChild(empty);
        return;
    }

    const s = currentSettlement;

    const title = document.createElement('div');
    title.className = 'pd-settlement-info__name';
    title.textContent = s.name || `ID: ${s.id}`;
    container.appendChild(title);

    const rows = [
        ['ID', s.id],
        ['Регион', s.region_name],
        ['Код региона', s.region_code],
        ['Муниципальное образование', s.district_name],
        ['Население', s.population != null ? Number(s.population).toLocaleString('ru-RU') : null],
        ['Площадь (км²)', s.area],
        ['Широта', s.lat != null ? Number(s.lat).toFixed(6) : null],
        ['Долгота', s.lon != null ? Number(s.lon).toFixed(6) : null],
        ['Код ФИАС', s.fias_id]
    ];

    rows.forEach(([label, value]) => {
        if (value === undefined || value === null || value === '') return;

        const row = document.createElement('div');
        row.className = 'pd-info-row';

        const l = document.createElement('div');
        l.className = 'pd-info-row__label';
        l.textContent = label;

        const v = document.createElement('div');
        v.className = 'pd-info-row__value';
        v.textContent = value;

        row.appendChild(l);
        row.appendChild(v);
        container.appendChild(row);
    });
}

/* ==================== БЛОКИ ФАКТ/ПЛАН ==================== */
function renderProvisionUI() {
    if (!currentSettlement) {
        clearProvisionUI();
        return;
    }

    const id = String(currentSettlement.id);
    const prov = getOrCreateProvision(id);

    const actualSection = document.getElementById('pd-actual-section');
    const actualRange = document.getElementById('pd-actual-range');
    const actualInput = document.getElementById('pd-actual-input');
    actualRange.value = prov.actual;
    actualInput.value = prov.actual;
    actualSection.style.display = 'block';

    const plannedSection = document.getElementById('pd-planned-section');
    const plannedEmpty = document.getElementById('pd-planned-empty');
    const plannedRange = document.getElementById('pd-planned-range');
    const plannedInput = document.getElementById('pd-planned-input');
    plannedRange.value = prov.planned;
    plannedInput.value = prov.planned;
    plannedSection.style.display = 'block';
    plannedEmpty.style.display = 'none';

    updateArrow('actual', prov.actual);
    updateArrow('planned', prov.planned);
}

function clearProvisionUI() {
    document.getElementById('pd-actual-section').style.display = 'none';
    document.getElementById('pd-planned-section').style.display = 'none';
    document.getElementById('pd-planned-empty').style.display = 'block';

    const arrowActual  = document.getElementById('pd-arrow-actual');
    const arrowPlanned = document.getElementById('pd-arrow-planned');
    if (arrowActual)  arrowActual.style.display = 'none';
    if (arrowPlanned) arrowPlanned.style.display = 'none';
}

function updateArrow(type, value) {
    const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    const arrow = document.getElementById(`pd-arrow-${type}`);
    if (!arrow) return;

    const info = getZoneInfo(v);

    arrow.style.display = 'flex';
    arrow.style.setProperty('--arrow-color', info.color);
    arrow.style.top = `${100 - v}%`;

    const label = type === 'actual' ? 'Факт' : 'План';
    arrow.querySelector('.pd-arrow__label').textContent = label;
    arrow.querySelector('.pd-arrow__value').textContent = `${v}%`;
}

/* ==================== ОБРАБОТЧИКИ ИНПУТОВ ==================== */
function setupActualInputs() {
    const range = document.getElementById('pd-actual-range');
    const num   = document.getElementById('pd-actual-input');

    const apply = (val) => {
        if (!currentSettlement) return;
        const v = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
        const prov = getOrCreateProvision(currentSettlement.id);
        prov.actual = v;
        range.value = v;
        num.value = v;
        updateArrow('actual', v);
    };

    range.addEventListener('input', () => apply(range.value));
    num.addEventListener('input', () => {
        const raw = num.value;
        if (raw === '' || raw === '-') return;
        const v = Number(raw);
        if (Number.isFinite(v)) apply(v);
    });
    num.addEventListener('change', () => apply(num.value));
}

function setupPlannedInputs() {
    const range = document.getElementById('pd-planned-range');
    const num   = document.getElementById('pd-planned-input');

    const apply = (val) => {
        if (!currentSettlement) return;
        const v = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
        const prov = getOrCreateProvision(currentSettlement.id);
        prov.planned = v;
        range.value = v;
        num.value = v;
        updateArrow('planned', v);
    };

    range.addEventListener('input', () => apply(range.value));
    num.addEventListener('input', () => {
        const raw = num.value;
        if (raw === '' || raw === '-') return;
        const v = Number(raw);
        if (Number.isFinite(v)) apply(v);
    });
    num.addEventListener('change', () => apply(num.value));
}