// availability.js
import { getSatelliteGroups, getAvailability, postRecalculateAvailability } from './db.js';
import { showReportModal, generateReportByFormat } from './report.js';
import { Loader } from './Loader.js';

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

const groupSelect = document.getElementById('groupSelect');
const tableTitle = document.getElementById('tableTitle');
const tableBody = document.querySelector('#availabilityTable tbody');
const tableWrapper = document.getElementById('tableWrapper');
const placeholder = document.getElementById('placeholder-message');
const actionButtons = document.getElementById('actionButtons');
const btnReport = document.getElementById('btnReport');
const btnRecalculate = document.getElementById('btnRecalculate');
const btnEdit = document.getElementById('btnEdit');
const closeBtn = document.getElementById('close-btn');

// Модалка подтверждения перерасчета
const recalcModal = document.getElementById('recalcConfirmModal');
const recalcText = document.getElementById('recalcConfirmText');
const recalcYes = document.getElementById('recalcConfirmYes');
const recalcNo = document.getElementById('recalcConfirmNo');

const loader = new Loader('.loader-container');

let currentGroup = '';
let currentData = [];
let currentDate = getTodayDate();

// ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

function getTodayDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showContent(show) {
    if (placeholder)   placeholder.style.display   = show ? 'none'  : 'block';
    if (tableTitle)    tableTitle.style.display    = show ? 'block' : 'none';
    if (tableWrapper)  tableWrapper.style.display  = show ? 'block' : 'none';
    if (actionButtons) actionButtons.style.display = show ? 'flex'  : 'none';
}

function renderTable(data) {
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Нет данных для отображения</td></tr>';
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');

        const lat = item.lat !== undefined ? item.lat : '';
        const availTime = item.available_time !== undefined ? item.available_time : '';
        const timePercent = item.time_percent !== undefined ? `${item.time_percent} %` : '';
        const avgSat = item.count_satellite_avg !== undefined ? item.count_satellite_avg : '';

        let formattedDate = item.at || '';
        if (formattedDate && formattedDate.includes('-')) {
            const parts = formattedDate.split('-');
            if (parts.length === 3) {
                formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
            }
        }

        tr.innerHTML = `
            <td>${item.group_name || ''}</td>
            <td>${lat}</td>
            <td>${availTime}</td>
            <td>${timePercent}</td>
            <td>${avgSat}</td>
            <td>${formattedDate}</td>
        `;
        tableBody.appendChild(tr);
    });
}

function updateButtonsState(hasData, hasGroup) {
    btnReport.disabled = !hasData;
    btnRecalculate.disabled = !hasGroup;
    btnEdit.disabled = true;
}

// ==================== МОДАЛКА ПОДТВЕРЖДЕНИЯ ====================

/**
 * Показывает модалку подтверждения перерасчета.
 * Возвращает Promise<boolean> — true если пользователь подтвердил.
 */
function confirmRecalculate() {
    return new Promise((resolve) => {
        recalcText.textContent =
            `Запустить перерасчет для группировки «${currentGroup}» на дату ${currentDate}?`;

        recalcModal.style.display = 'flex';

        const handleYes = () => {
            cleanup();
            resolve(true);
        };
        const handleNo = () => {
            cleanup();
            resolve(false);
        };
        const cleanup = () => {
            recalcModal.style.display = 'none';
            recalcYes.removeEventListener('click', handleYes);
            recalcNo.removeEventListener('click', handleNo);
        };

        recalcYes.addEventListener('click', handleYes);
        recalcNo.addEventListener('click', handleNo);
    });
}

// ==================== ОСНОВНАЯ ЛОГИКА ====================

async function loadGroups() {
    try {
        loader.show('Загрузка списка группировок...');
        const groups = await getSatelliteGroups('KA');

        groupSelect.innerHTML = '<option value="">-- Выберите группировку --</option>';

        if (groups && groups.length > 0) {
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group;
                option.textContent = group;
                groupSelect.appendChild(option);
            });
        } else {
            groupSelect.innerHTML = '<option value="">Нет доступных группировок</option>';
        }
    } catch (error) {
        console.error('Ошибка загрузки групп:', error);
        groupSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
    } finally {
        loader.close();
    }
}

groupSelect.addEventListener('change', async (e) => {
    const selectedGroup = e.target.value;

    currentGroup = selectedGroup;
    currentData = [];

    updateButtonsState(false, !!selectedGroup);

    if (!selectedGroup) {
        showContent(false);
        tableTitle.textContent = '';
        return;
    }

    showContent(true);
    tableTitle.textContent = `Данные по доступности группировки КА «${selectedGroup}»`;
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Загрузка данных...</td></tr>';

    try {
        loader.show(`Загрузка данных для «${selectedGroup}»...`);
        currentDate = getTodayDate();
        const data = await getAvailability(selectedGroup, currentDate);

        currentData = Array.isArray(data) ? data : [];
        renderTable(currentData);

        if (currentData.length > 0) {
            updateButtonsState(true, true);
        } else {
            updateButtonsState(false, true);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Нет данных на текущую дату</td></tr>';
        }
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Ошибка загрузки данных</td></tr>';
        updateButtonsState(false, !!selectedGroup);
    } finally {
        loader.close();
    }
});

btnReport.addEventListener('click', () => {
    if (!currentData || currentData.length === 0) {
        console.warn('Нет данных для формирования отчета.');
        return;
    }

    const columnsInfo = [
        { name: 'group_name', description: 'Название группировки' },
        { name: 'lat', description: 'Широта, гр.' },
        { name: 'available_time', description: 'Время доступности, сек.' },
        { name: 'time_percent', description: 'Процент доступности' },
        { name: 'count_satellite_avg', description: 'Среднее кол-во доступных КА' },
        { name: 'at', description: 'Дата' }
    ];

    const rusName = `Доступность КА «${currentGroup}»`;
    const tableNameForFile = `availability_${currentGroup}_${currentDate}`;

    showReportModal(
        tableNameForFile,
        rusName,
        columnsInfo,
        currentData,
        loader,
        (table, rus, cols, rows, format) => {
            generateReportByFormat(table, rus, cols, rows, format, loader);
        }
    );
});

btnRecalculate.addEventListener('click', async () => {
    if (!currentGroup) return;

    // Модалка подтверждения вместо confirm()
    const confirmed = await confirmRecalculate();
    if (!confirmed) return;

    try {
        loader.show(`Перерасчет данных для «${currentGroup}»...`);

        await postRecalculateAvailability(currentGroup, currentDate);

        const updatedData = await getAvailability(currentGroup, currentDate);
        currentData = Array.isArray(updatedData) ? updatedData : [];
        renderTable(currentData);
        updateButtonsState(currentData.length > 0, !!currentGroup);

        // Вместо alert — console.log
        console.log(`Перерасчет для группировки «${currentGroup}» на ${currentDate} успешно выполнен.`);
    } catch (error) {
        console.error('Ошибка при перерасчете:', error);
    } finally {
        loader.close();
    }
});

if (closeBtn) {
    closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.close();
        setTimeout(() => {
            if (!window.closed) window.location.href = '/';
        }, 100);
    });
}

// ==================== СТАРТ ====================

document.addEventListener('DOMContentLoaded', () => {
    showContent(false);
    updateButtonsState(false, false);
    loadGroups();
});