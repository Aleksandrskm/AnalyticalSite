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
let settlementsCache = [];
let currentSettlement = null;

/* ==================== ОПИСАНИЕ НАПРАВЛЕНИЙ ==================== */
/* 5 групп (цветов), в каждой — 5 заголовков */
const PD_CATEGORIES = [
    {
        id: 'current',
        title: 'Текущее состояние',
        color: '#1a73e8',
        items: [
            {
                key: 'population',
                title: 'Численность населения',
                desc: 'Оценка текущей численности населения и динамики за последние 5 лет. Используется как база для расчёта нормативной потребности в услугах связи.'
            },
            {
                key: 'area',
                title: 'Площадь территории',
                desc: 'Общая площадь НП в км². Влияет на протяжённость транспортных сетей и стоимость прокладки ВОЛС.'
            },
            {
                key: 'density',
                title: 'Плотность населения',
                desc: 'Показатель плотности используется для выбора типа базовых станций и оценки экономической эффективности покрытия.'
            },
            {
                key: 'households',
                title: 'Домохозяйства',
                desc: 'Оценка числа домохозяйств, подключённых к сетям связи и потенциально подключаемых к ШПД.'
            },
            {
                key: 'urbanization',
                title: 'Урбанизация',
                desc: 'Соотношение городского и сельского населения, влияет на приоритеты развёртывания инфраструктуры.'
            }
        ]
    },
    {
        id: 'mobile',
        title: 'Мобильная связь',
        color: '#2e7d32',
        items: [
            {
                key: 'gsm',
                title: '2G (GSM)',
                desc: 'Покрытие сети второго поколения. В ряде НП остаётся базовым для голосовой связи и SMS.'
            },
            {
                key: 'umts',
                title: '3G (UMTS)',
                desc: 'Покрытие сети третьего поколения. Планируется поэтапное замещение LTE.'
            },
            {
                key: 'lte',
                title: '4G (LTE)',
                desc: 'Приоритетное направление — расширение покрытия LTE и увеличение ёмкости сети.'
            },
            {
                key: 'nr5g',
                title: '5G NR',
                desc: 'Перспективное развёртывание 5G на территориях с высокой плотностью и в агломерациях.'
            },
            {
                key: 'satellite',
                title: 'Спутниковая связь',
                desc: 'Резервный канал для отдалённых и труднодоступных НП.'
            }
        ]
    },
    {
        id: 'fixed',
        title: 'Фиксированная связь',
        color: '#ef6c00',
        items: [
            {
                key: 'bb',
                title: 'ШПД (проводной)',
                desc: 'Оценка уровня проникновения проводного широкополосного доступа.'
            },
            {
                key: 'focl',
                title: 'ВОЛС',
                desc: 'Наличие и протяжённость волоконно-оптических линий связи, планы по строительству.'
            },
            {
                key: 'pstn',
                title: 'ТфОП',
                desc: 'Состояние сети телефонной связи общего пользования и её модернизация.'
            },
            {
                key: 'payphones',
                title: 'Таксофоны',
                desc: 'Наличие универсальных таксофонов как элемента универсального обслуживания.'
            },
            {
                key: 'post',
                title: 'Почтовая связь',
                desc: 'Количество отделений почтовой связи и уровень их цифровизации.'
            }
        ]
    },
    {
        id: 'perspective',
        title: 'Перспективы развития',
        color: '#6a1b9a',
        items: [
            {
                key: 'bs_construction',
                title: 'Строительство БС',
                desc: 'Плановое строительство новых базовых станций и модернизация существующих.'
            },
            {
                key: 'focl_laying',
                title: 'Прокладка ВОЛС',
                desc: 'Планируемые маршруты прокладки оптических линий и подключение к магистральным сетям.'
            },
            {
                key: 'modernization',
                title: 'Модернизация сетей',
                desc: 'Замена устаревшего оборудования, переход на новые стандарты связи.'
            },
            {
                key: 'budget',
                title: 'Бюджет программы',
                desc: 'Оценка объёмов финансирования по государственным и частным программам.'
            },
            {
                key: 'timeline',
                title: 'Сроки реализации',
                desc: 'Этапы и контрольные сроки реализации мероприятий по развитию инфраструктуры.'
            }
        ]
    },
    {
        id: 'risks',
        title: 'Проблемы и риски',
        color: '#c62828',
        items: [
            {
                key: 'coverage_deficit',
                title: 'Дефицит покрытия',
                desc: 'Территории и группы населения, не охваченные базовыми услугами связи.'
            },
            {
                key: 'no_operators',
                title: 'Отсутствие операторов',
                desc: 'НП, где не представлен ни один оператор связи, и требуются меры господдержки.'
            },
            {
                key: 'infra_wear',
                title: 'Износ инфраструктуры',
                desc: 'Высокая степень износа существующего оборудования и линейных сооружений.'
            },
            {
                key: 'staff',
                title: 'Кадровый дефицит',
                desc: 'Отсутствие квалифицированных специалистов для обслуживания сетей.'
            },
            {
                key: 'finance',
                title: 'Финансовые риски',
                desc: 'Риски, связанные с недофинансированием и низкой окупаемостью проектов.'
            }
        ]
    }
];

/* ==================== ИНИЦИАЛИЗАЦИЯ ==================== */
document.addEventListener('DOMContentLoaded', () => {
    initLoader();
    renderGrid();

    document.getElementById('pd-region').addEventListener('change', onRegionChange);
    document.getElementById('pd-settlement').addEventListener('change', onSettlementChange);

    loadRegionsIntoSelect();
});

/* ==================== ЗАГРУЗКА РЕГИОНОВ ==================== */
async function loadRegionsIntoSelect() {
    const ld = initLoader();
    ld.show('Загрузка регионов...');

    try {
        const regions = await getRegions();
        const select = document.getElementById('pd-region');
        select.innerHTML = '<option value="">— Выберите регион —</option>';

        (regions || []).forEach(r => {
            const opt = document.createElement('option');
            opt.value = String(r.number).trim();
            opt.textContent = r.name;
            select.appendChild(opt);
        });

        ld.close();
    } catch (e) {
        ld.close();
        console.error('Ошибка загрузки регионов:', e);
    }
}

/* ==================== СМЕНА РЕГИОНА ==================== */
async function onRegionChange() {
    const region = document.getElementById('pd-region').value;
    const settSelect = document.getElementById('pd-settlement');

    settSelect.innerHTML = '<option value="">— Выберите населённый пункт —</option>';
    settlementsCache = [];
    currentSettlement = null;

    renderSettlementInfo();
    clearDetails();

    if (!region) return;

    const ld = initLoader();
    ld.show('Загрузка населённых пунктов...');

    try {
        const body = {
            regions: [String(region).trim()],
            population_filters: []
        };

        const result = await getSettlementsPage(0, 1, body);
        settlementsCache = (result && result.settlements) || [];

        settlementsCache.sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''))
        );

        settlementsCache.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name || `ID: ${s.id}`;
            settSelect.appendChild(opt);
        });

        ld.close();
    } catch (e) {
        ld.close();
        console.error('Ошибка загрузки НП:', e);
    }
}

/* ==================== СМЕНА НП ==================== */
function onSettlementChange() {
    const id = document.getElementById('pd-settlement').value;

    if (!id) {
        currentSettlement = null;
        renderSettlementInfo();
        clearDetails();
        return;
    }

    currentSettlement = settlementsCache.find(s => String(s.id) === String(id)) || null;
    renderSettlementInfo();

    // Если какой-то заголовок уже подсвечен — обновим блок деталей
    const active = document.querySelector('.pd-grid__item.active');
    if (active) {
        const cat = PD_CATEGORIES.find(c => c.id === active.dataset.cat);
        const item = cat && cat.items.find(i => i.key === active.dataset.key);
        if (cat && item) showDetails(cat, item);
    }
}

/* ==================== СТОЛБЕЦ 1: ИНФОРМАЦИЯ О НП ==================== */
function renderSettlementInfo() {
    const container = document.getElementById('pd-settlement-info');
    container.innerHTML = '';

    if (!currentSettlement) {
        const empty = document.createElement('div');
        empty.className = 'pd-empty';
        empty.textContent = 'Выберите населённый пункт';
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

/* ==================== СТОЛБЕЦ 2: СЕТКА ==================== */
function renderGrid() {
    const grid = document.getElementById('pd-grid');
    grid.innerHTML = '';

    PD_CATEGORIES.forEach(cat => {
        const col = document.createElement('div');
        col.className = 'pd-grid__col';

        const header = document.createElement('div');
        header.className = 'pd-grid__col-header';
        header.style.background = cat.color;
        header.textContent = cat.title;
        col.appendChild(header);

        cat.items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'pd-grid__item';
            el.dataset.cat = cat.id;
            el.dataset.key = item.key;
            el.style.borderLeftColor = cat.color;
            el.textContent = item.title;

            el.addEventListener('mouseenter', () => {
                document.querySelectorAll('.pd-grid__item').forEach(x =>
                    x.classList.remove('active')
                );
                el.classList.add('active');
                showDetails(cat, item);
            });

            el.addEventListener('click', () => {
                document.querySelectorAll('.pd-grid__item').forEach(x =>
                    x.classList.remove('active')
                );
                el.classList.add('active');
                showDetails(cat, item);
            });

            col.appendChild(el);
        });

        grid.appendChild(col);
    });
}

/* ==================== СТОЛБЕЦ 3: ДЕТАЛИ ==================== */
function showDetails(category, item) {
    const details = document.getElementById('pd-details');
    details.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'pd-details__header';
    header.style.background = category.color;
    header.textContent = item.title;
    details.appendChild(header);

    const catLabel = document.createElement('div');
    catLabel.className = 'pd-details__category';
    catLabel.textContent = category.title;
    details.appendChild(catLabel);

    const desc = document.createElement('div');
    desc.className = 'pd-details__desc';
    desc.textContent = item.desc;
    details.appendChild(desc);

    /* --- Динамический блок по выбранному НП (пример наполнения) --- */
    if (currentSettlement) {
        const section = document.createElement('div');
        section.className = 'pd-details__section';

        const sTitle = document.createElement('div');
        sTitle.className = 'pd-details__section-title';
        sTitle.textContent = `Оценка для НП: ${currentSettlement.name || currentSettlement.id}`;
        section.appendChild(sTitle);

        const rows = buildDynamicRows(category.id, item.key, currentSettlement);
        rows.forEach(([label, value]) => {
            const row = document.createElement('div');
            row.className = 'pd-details__row';

            const l = document.createElement('div');
            l.className = 'pd-details__row-label';
            l.textContent = label;

            const v = document.createElement('div');
            v.className = 'pd-details__row-value';
            v.textContent = value;

            row.appendChild(l);
            row.appendChild(v);
            section.appendChild(row);
        });

        details.appendChild(section);
    }
}

function clearDetails() {
    const details = document.getElementById('pd-details');
    details.innerHTML = '';

    const empty = document.createElement('div');
    empty.className = 'pd-empty';
    empty.textContent = 'Наведите курсор на заголовок';
    details.appendChild(empty);
}

/* ==================== ПРИМЕР ДИНАМИЧЕСКИХ ДАННЫХ ==================== */
function buildDynamicRows(categoryId, itemKey, settlement) {
    const pop = Number(settlement.population) || 0;
    const area = Number(settlement.area) || 0;

    // Псевдо-расчёты для примера
    const households = Math.max(1, Math.round(pop / 2.6));
    const density = area > 0 ? (pop / area).toFixed(1) : '—';

    const map = {
        current: {
            population: [
                ['Текущая численность', pop.toLocaleString('ru-RU')],
                ['Прогноз через 5 лет', Math.round(pop * 0.97).toLocaleString('ru-RU')]
            ],
            area: [
                ['Площадь, км²', area ? area.toFixed(2) : '—'],
                ['Радиус покрытия, км', area ? Math.max(1, Math.round(Math.sqrt(area / Math.PI))).toString() : '—']
            ],
            density: [
                ['Плотность, чел./км²', density],
                ['Категория', density !== '—' && Number(density) > 1000 ? 'Высокая' : (Number(density) > 200 ? 'Средняя' : 'Низкая')]
            ],
            households: [
                ['Оценка домохозяйств', households.toLocaleString('ru-RU')],
                ['Потенциал ШПД', `${Math.round(households * 0.75).toLocaleString('ru-RU')} подключений`]
            ],
            urbanization: [
                ['Тип НП', pop > 20000 ? 'Городской' : 'Сельский'],
                ['Индекс урбанизации', pop > 20000 ? '0,85' : '0,25']
            ]
        },
        mobile: {
            gsm: [['Покрытие', '95%'], ['Статус', 'Действует']],
            umts: [['Покрытие', '72%'], ['Статус', 'Модернизация']],
            lte: [['Покрытие', '64%'], ['Статус', 'Приоритет расширения']],
            nr5g: [['Покрытие', '0%'], ['Статус', 'Планируется']],
            satellite: [['Доступность', 'Требуется терминал'], ['Статус', 'Резервный канал']]
        },
        fixed: {
            bb: [['Проникновение ШПД', '48%'], ['План', '+15 п.п. к 2027']],
            focl: [['Наличие ВОЛС', 'Есть магистраль'], ['Требуется', 'Распределительная сеть']],
            pstn: [['Ёмкость ТфОП', households.toLocaleString('ru-RU')], ['Износ', '42%']],
            payphones: [['Количество', '2'], ['Состояние', 'Рабочее']],
            post: [['Отделений', '1'], ['Цифровизация', 'Частичная']]
        },
        perspective: {
            bs_construction: [['Планируется БС', '3'], ['Приоритет', 'Высокий']],
            focl_laying: [['Длина ВОЛС, км', (area ? Math.round(area * 0.8) : 0).toString()], ['Этап', 'Проектирование']],
            modernization: [['Объём модернизации', '2 объекта'], ['Год', '2026']],
            budget: [['Оценка бюджета, млн ₽', (5 + pop / 5000).toFixed(1)], ['Источник', 'Смешанный']],
            timeline: [['Начало', '2025 Q3'], ['Окончание', '2027 Q4']]
        },
        risks: {
            coverage_deficit: [['Уязвимые зоны', '2'], ['Население без покрытия', Math.round(pop * 0.08).toLocaleString('ru-RU')]],
            no_operators: [['Кол-во операторов', pop > 10000 ? '3' : '1'], ['Риск', pop > 10000 ? 'Низкий' : 'Высокий']],
            infra_wear: [['Средний износ', '42%'], ['Критический', 'Нет']],
            staff: [['Специалистов', '2'], ['Дефицит', '1 чел.']],
            finance: [['Риск недофинансирования', 'Средний'], ['Резерв', 'Не сформирован']]
        }
    };

    const rows = (map[categoryId] && map[categoryId][itemKey]) || [
        ['Статус', 'Требует уточнения'],
        ['Данные', 'Нет в источнике']
    ];

    return rows;
}