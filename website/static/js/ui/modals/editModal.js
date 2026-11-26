'use strict';
import { state } from '../../core/state.js';
import {
    SETTLEMENTS_DB_TO_OBJECT_KEY,
    RANKING_DB_TO_OBJECT_KEY,
    SETTLEMENTS_COLUMN_LABELS,
    RANKING_COLUMN_LABELS,
    TABLE_SETTLEMENTS,
    TABLE_RANKING,
    EDIT_DB_NAME
} from '../../core/constants.js';
import { getValueByDbColumn, loadTableStructures } from '../../services/settlementsService.js';
import { buildRatingGroups } from '../../core/ratingGroups.js';
import { applyLocalUpdates, refreshCurrentView } from '../tableView.js';
import { createCompareCheckboxRow } from './settlementInfoModal.js';
import { editRow } from '../../db.js';
import { initLoader } from '../common.js';

/**
 * Открывает модалку редактирования НП.
 * @param {string|number} settlementId - ID населённого пункта
 * @param {'rating'|'settlement'} type - тип модалки (для заголовка)
 * @param {'auto'|'settlements'|'rating'} tableMode - какие таблицы показывать
 */
export async function openEditModal(settlementId, type, tableMode = 'auto') {
    if (!settlementId) return;

    await loadTableStructures();

    const settlement = state.settlementsData.items.find(it => String(it.id) === String(settlementId)) || {};
    const ranking = state.allRatings[String(settlementId)] || {};

    // Предикат "SCORE-поля": rating или rating_*
    const isScoreKey = (k) => k === 'rating' || /^rating_/i.test(k);

    // Определяем, какие таблицы разрешено редактировать
    let allowedTables = [];
    let allowExtraRatingFields = false;

    if (tableMode === 'settlements') {
        allowedTables = ['settlements'];
    } else if (tableMode === 'rating') {
        allowedTables = ['settlements', 'ranking'];
        allowExtraRatingFields = false;
    } else {
        // auto — показываем всё (но ограничиваем набор SCORE-полей)
        allowedTables = ['settlements', 'ranking'];
        allowExtraRatingFields = true;
    }

    // Пытаемся получить порядок колонок из видимой таблицы
    const getColumnOrderFromTable = (tableSelector) => {
        const order = [];
        const table = document.querySelector(tableSelector);
        if (!table) return order;
        table.querySelectorAll('thead th').forEach(th => {
            const key = th.dataset.key;
            if (key) order.push(key);
        });
        return order;
    };

    let tableHeaderOrder = getColumnOrderFromTable('#settlements-table');

    // ⚠️ FALLBACK: если таблица скрыта (display: none) или пуста — используем разрешённый набор
    if (tableHeaderOrder.length === 0) {
        tableHeaderOrder = [
            'id', 'name', 'area', 'district_name', 'lon', 'lat', 'population',
            'rating',
            ...buildRatingGroups()
                .flatMap(g => g.fields.map(f => f.key))
                .filter(k => isScoreKey(k) && k !== 'rating')
        ];
    }

    // Создаём обратные маппинги: objectKey → dbColumn
    const settlementsKeyToDb = {};
    Object.keys(SETTLEMENTS_DB_TO_OBJECT_KEY).forEach(db => {
        settlementsKeyToDb[SETTLEMENTS_DB_TO_OBJECT_KEY[db]] = db;
    });

    const rankingKeyToDb = {};
    Object.keys(RANKING_DB_TO_OBJECT_KEY).forEach(db => {
        rankingKeyToDb[RANKING_DB_TO_OBJECT_KEY[db]] = db;
    });

    // Создаём маппинги: objectKey → label
    const settlementsLabelByKey = {};
    Object.keys(SETTLEMENTS_COLUMN_LABELS).forEach(db => {
        const key = SETTLEMENTS_DB_TO_OBJECT_KEY[db] || db;
        settlementsLabelByKey[key] = SETTLEMENTS_COLUMN_LABELS[db];
    });

    const rankingLabelByKey = {};
    Object.keys(RANKING_COLUMN_LABELS).forEach(db => {
        const key = RANKING_DB_TO_OBJECT_KEY[db] || db;
        rankingLabelByKey[key] = RANKING_COLUMN_LABELS[db];
    });

    // Собираем упорядоченный список полей
    const orderedFields = [];
    const seen = new Set();

    // Вспомогательная функция: добавляет ", %" к метке, если это поле SCORE
    const formatLabel = (k, baseLabel) => {
        let lbl = baseLabel;
        if (isScoreKey(k) && !lbl.endsWith(', %')) {
            lbl += ', %';
        }
        return lbl;
    };

    tableHeaderOrder.forEach(key => {
        if (seen.has(key)) return;
        seen.add(key);

        // 🔒 Спецслучай: rating — всегда RAT_SUM_NP, метка «Обеспеченность, %»
        // Срабатывает РАНЬШЕ ветки rankingKeyToDb, чтобы не подменяться на rating_*
        if (key === 'rating') {
            if (!allowedTables.includes('ranking')) return;
            orderedFields.push({
                table: 'ranking',
                dbColumn: 'RAT_SUM_NP',
                objectKey: 'rating',
                label: 'Обеспеченность, %',
                value: getValueByDbColumn(ranking, 'RAT_SUM_NP', RANKING_DB_TO_OBJECT_KEY)
            });
            return;
        }

        // Проверяем, есть ли ключ в ranking
        if (rankingKeyToDb[key]) {
            if (!allowedTables.includes('ranking')) return;
            const dbColumn = rankingKeyToDb[key];
            if (dbColumn === 'ID') return; // ID не редактируем
            orderedFields.push({
                table: 'ranking',
                dbColumn,
                objectKey: key,
                label: formatLabel(key, rankingLabelByKey[key] || dbColumn),
                value: getValueByDbColumn(ranking, dbColumn, RANKING_DB_TO_OBJECT_KEY)
            });
            return;
        }

        // Проверяем, есть ли ключ в settlements
        if (settlementsKeyToDb[key]) {
            if (!allowedTables.includes('settlements')) return;
            const dbColumn = settlementsKeyToDb[key];
            orderedFields.push({
                table: 'settlements',
                dbColumn,
                objectKey: key,
                label: settlementsLabelByKey[key] || dbColumn,
                value: getValueByDbColumn(settlement, dbColumn, SETTLEMENTS_DB_TO_OBJECT_KEY)
            });
            return;
        }
    });

    // Если разрешены дополнительные поля рейтинга — добавляем все rating_* (кроме rating)
    if (allowExtraRatingFields) {
        buildRatingGroups().forEach(group => {
            group.fields.forEach(f => {
                if (seen.has(f.key)) return;
                if (!isScoreKey(f.key) || f.key === 'rating') return;
                const dbColumn = rankingKeyToDb[f.key];
                if (!dbColumn) return;
                seen.add(f.key);
                orderedFields.push({
                    table: 'ranking',
                    dbColumn,
                    objectKey: f.key,
                    label: formatLabel(f.key, f.label),
                    value: getValueByDbColumn(ranking, dbColumn, RANKING_DB_TO_OBJECT_KEY)
                });
            });
        });
    }

    // 🔒 Для таблицы обеспеченности (rating/auto) жёстко ограничиваем набор полей
    if (tableMode === 'rating' || tableMode === 'auto') {
        const allowedKeys = new Set([
            'id', 'name', 'area', 'district_name', 'lon', 'lat', 'population',
            'rating',
            ...buildRatingGroups()
                .flatMap(g => g.fields.map(f => f.key))
                .filter(k => isScoreKey(k) && k !== 'rating')
        ]);
        for (let i = orderedFields.length - 1; i >= 0; i--) {
            if (!allowedKeys.has(orderedFields[i].objectKey)) {
                orderedFields.splice(i, 1);
            }
        }
    }

    // Удаляем старую модалку, если есть
    const existing = document.getElementById('row-data-modal');
    if (existing) existing.remove();

    // Создаём модалку
    const modal = document.createElement('div');
    modal.id = 'row-data-modal';
    modal.className = 'res-modal-overlay';

    const content = document.createElement('div');
    content.className = 'res-modal-content';
    content.style.maxWidth = '800px';

    // Заголовок
    const nameForTitle = settlement.name || settlement.NAME || settlementId;
    const titleText = (type === 'rating')
        ? `Обеспеченность НП: ${nameForTitle}`
        : `НП: ${nameForTitle}`;
    const title = document.createElement('h3');
    title.textContent = titleText;
    title.className = 'res-modal-title';

    // Таблица с полями
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'res-table-wrapper';
    tableWrapper.style.maxHeight = '65vh';
    tableWrapper.style.overflowY = 'auto';
    tableWrapper.style.position = 'relative';

    const table = document.createElement('table');
    table.className = 'res-modal-table edit-modal-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'separate';
    table.style.borderSpacing = '0';

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // Ссылки на поля для сохранения
    const fieldRefs = [];

    orderedFields.forEach(field => {
        const tr = document.createElement('tr');

        const th = document.createElement('th');
        th.textContent = field.label;
        th.style.cssText = `
            text-align: left;
            padding: 6px 12px;
            border: 1px solid #000;
            background: #f2f2f2;
            width: 45%;
            font-weight: 600;
            color: black;
            font-size: 14px;
        `;

        const td = document.createElement('td');
        td.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #000;
            font-size: 14px;
            color: #2a2a2a;
            background: #fff;
        `;

        if (field.dbColumn === 'ID') {
            // ID не редактируем
            td.textContent = field.value !== '' ? field.value : '-';
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = field.value;
            input.dataset.dbColumn = field.dbColumn;
            input.dataset.tableName = field.table;
            input.className = 'edit-modal-input';
            input.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 14px;
            `;
            td.appendChild(input);
            fieldRefs.push({
                table: field.table,
                dbColumn: field.dbColumn,
                input,
                originalValue: String(field.value)
            });
        }

        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
    });

    // Футер: чекбокс + кнопки
    const footer = document.createElement('div');
    footer.style.cssText = `margin-top: 15px; display: flex; flex-direction: column; gap: 10px;`;

    // Чекбокс "Добавить в сравнение"
    footer.appendChild(createCompareCheckboxRow(settlementId));

    // Кнопки
    const buttonsBar = document.createElement('div');
    buttonsBar.style.cssText = `display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;`;

    const detailBtn = document.createElement('button');
    detailBtn.textContent = 'Детализация обеспеченности НП';
    detailBtn.className = 'res-modal-close-btn';
    detailBtn.style.background = '#0066ff';
    detailBtn.style.color = '#fff';
    detailBtn.style.border = '1.5px solid #0044cc';
    detailBtn.addEventListener('click', () => {
        const id = settlementId !== undefined && settlementId !== null ? settlementId : null;
        if (!id) return;
        window.open(`http://185.192.247.60:9105/ns/${encodeURIComponent(id)}`, '_blank');
    });

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Сохранить изменения';
    editBtn.className = 'res-modal-close-btn';
    editBtn.style.background = '#0066ff';
    editBtn.style.color = '#fff';
    editBtn.addEventListener('click', async () => {
        await handleEditRow(fieldRefs, settlementId, modal);
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.className = 'res-modal-close-btn';
    closeBtn.addEventListener('click', () => modal.remove());

    buttonsBar.appendChild(detailBtn);
    buttonsBar.appendChild(editBtn);
    buttonsBar.appendChild(closeBtn);
    footer.appendChild(buttonsBar);

    content.appendChild(title);
    content.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    content.appendChild(footer);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Закрытие по клику на оверлей
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

/**
 * Сохраняет изменения из модалки.
 * @param {Array} fieldRefs - массив ссылок на поля
 * @param {string|number} settlementId - ID НП
 * @param {HTMLElement} modal - элемент модалки
 */
async function handleEditRow(fieldRefs, settlementId, modal) {
    const changedSettlements = {};
    const changedRanking = {};

    // Собираем изменённые поля
    fieldRefs.forEach(ref => {
        const currentValue = String(ref.input.value).trim();
        const originalValue = String(ref.originalValue).trim();

        if (currentValue !== originalValue) {
            const newValue = currentValue === '' ? null : currentValue;

            if (ref.table === 'settlements') {
                changedSettlements[ref.dbColumn] = newValue;
            } else if (ref.table === 'ranking') {
                changedRanking[ref.dbColumn] = newValue;
            }
        }
    });

    const settlementsChangedCount = Object.keys(changedSettlements).length;
    const rankingChangedCount = Object.keys(changedRanking).length;

    if (settlementsChangedCount === 0 && rankingChangedCount === 0) {
        return; // Ничего не изменилось
    }

    const loader = initLoader();
    loader.show('Сохранение изменений...');

    try {
        // Сохраняем изменения в таблице НП
        if (settlementsChangedCount > 0) {
            const bodySettlements = {
                updates: changedSettlements,
                where: {
                    column: 'ID',
                    operator: '=',
                    value: String(settlementId)
                }
            };
            console.log('PATCH A_NAS_P body:', bodySettlements);
            await editRow(bodySettlements, TABLE_SETTLEMENTS, EDIT_DB_NAME);
            applyLocalUpdates(settlementId, 'settlements', changedSettlements);
        }

        // Сохраняем изменения в таблице рейтинга
        if (rankingChangedCount > 0) {
            const bodyRanking = {
                updates: changedRanking,
                where: {
                    column: 'ID',
                    operator: '=',
                    value: String(settlementId)
                }
            };
            console.log('PATCH A_NAS_P_RANKING body:', bodyRanking);
            await editRow(bodyRanking, TABLE_RANKING, EDIT_DB_NAME);
            applyLocalUpdates(settlementId, 'ranking', changedRanking);
        }

        loader.close();
        modal.remove();
        refreshCurrentView(settlementId);
    } catch (e) {
        loader.close();
        console.error('Ошибка сохранения изменений:', e);
        alert('Ошибка сохранения изменений: ' + e.message);
    }
}