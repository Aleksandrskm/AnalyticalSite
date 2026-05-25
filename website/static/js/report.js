// reports.js
import { Loader } from "./Loader.js";

const BASE_URL = 'http://185.192.247.60:8888';

// Флаг для предотвращения повторных вызовов
let isGeneratingReport = false;

// Функция для скачивания CSV отчета
export async function downloadCsv(header, rows, filename = 'report.csv') {
    const response = await fetch(`${BASE_URL}/report/csv`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ header, rows })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

// Функция для скачивания DOCX отчета
export async function downloadDocx(elements, filename = 'report.docx') {
    const response = await fetch(`${BASE_URL}/report/docx`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename, elements })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

// Функция для показа модального окна выбора формата отчета
export function showReportModal(tableName, rusName, columnsInfo, allRows, loader, generateReportByFormat) {
    let reportModal = document.getElementById('reportFormatModal');
    if (!reportModal) {
        reportModal = document.createElement('div');
        reportModal.id = 'reportFormatModal';
        reportModal.className = 'modal';
        reportModal.style.display = 'none';
        reportModal.innerHTML = `
      <div class="modal__dialog">
        <div class="modal__content report-modal-content">
          <h4 class="modal__title">Выберите формат отчета</h4>
          <div class="report-modal-buttons">
            <button class="report-format-btn" data-format="csv">CSV (Excel)</button>
            <button class="report-format-btn" data-format="docx">DOCX (Word)</button>
          </div>
          <div class="confirmation-modal__buttons" style="text-align: center; padding-top: 10px;">
            <button class="modal__closes report-modal-close">Отмена</button>
          </div>
        </div>
      </div>
    `;
        document.body.appendChild(reportModal);
    }

    reportModal.style.display = 'flex';

    const formatBtns = reportModal.querySelectorAll('.report-format-btn');
    const closeBtn = reportModal.querySelector('.modal__closes');

    const handleFormatSelect = (format) => {
        reportModal.style.display = 'none';
        generateReportByFormat(tableName, rusName, columnsInfo, allRows, format);
    };

    formatBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const format = newBtn.dataset.format;
            handleFormatSelect(format);
        });
    });

    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    newCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        reportModal.style.display = 'none';
    });
}

// Функция для генерации отчета в выбранном формате (только данные таблицы)
export async function generateReportByFormat(tableName, rusName, columnsInfo, allRows, format, loader) {
    if (isGeneratingReport) {
        console.log('Отчет уже формируется, подождите...');
        return;
    }

    isGeneratingReport = true;

    try {
        loader.show(`Формирование ${format.toUpperCase()} отчета...`);

        const filename = `${tableName}_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}`;

        if (format === 'csv') {
            const header = {};
            columnsInfo.forEach(col => {
                header[col.name] = col.description || col.name;
            });

            const rows = allRows.map(row => {
                const csvRow = {};
                columnsInfo.forEach(col => {
                    let value = row[col.name];
                    if (value === null || value === undefined) {
                        value = '';
                    } else if (typeof value === 'number' && !Number.isInteger(value)) {
                        value = value.toFixed(6);
                    }
                    csvRow[col.name] = value;
                });
                return csvRow;
            });

            await downloadCsv(header, rows, `${filename}.csv`);
            console.log(`Отчет "${rusName}" в формате CSV успешно сохранен!`);
        } else if (format === 'docx') {
            const elements = [];

            // Заголовок
            elements.push({
                type: 'title',
                text: `Отчет по таблице "${rusName}"`,
                formatting: {
                    font_name: 'Arial',
                    font_size: 18,
                    alignment: 'center',
                    bold: true,
                    space_after: 12
                }
            });

            // Дата
            elements.push({
                type: 'paragraph',
                text: `Дата формирования: ${new Date().toLocaleString('ru-RU')}`,
                formatting: {
                    font_size: 11,
                    alignment: 'right',
                    italic: true,
                    space_after: 12
                }
            });

            // Информация о таблице
            elements.push({
                type: 'paragraph',
                text: `Имя таблицы в БД: ${tableName}`,
                formatting: { font_size: 11, space_after: 4 }
            });

            // elements.push({
            //     type: 'paragraph',
            //     text: `Русское название: ${rusName}`,
            //     formatting: { font_size: 11, space_after: 4 }
            // });

            elements.push({
                type: 'paragraph',
                text: `Количество записей: ${allRows.length}`,
                formatting: { font_size: 11, space_after: 16 }
            });

            // Заголовок для данных таблицы
            elements.push({
                type: 'title',
                text: 'Данные таблицы',
                formatting: {
                    font_size: 14,
                    bold: true,
                    space_before: 12,
                    space_after: 8
                }
            });

            // Только таблица с данными (без структуры)
            const dataHeaders = columnsInfo.map(col => col.description || col.name);
            const dataRows = allRows.map(row => {
                return columnsInfo.map(col => {
                    let value = row[col.name];
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'number' && !Number.isInteger(value)) {
                        return value.toFixed(6);
                    }
                    return String(value);
                });
            });

            elements.push({
                type: 'table',
                headers: dataHeaders,
                rows: dataRows
            });

            // Подвал
            elements.push({
                type: 'paragraph',
                text: `Отчет сгенерирован автоматически. Всего записей: ${allRows.length}`,
                formatting: {
                    font_size: 10,
                    alignment: 'center',
                    italic: true,
                    space_before: 16
                }
            });

            await downloadDocx(elements, `${filename}.docx`);
            console.log(`Отчет "${rusName}" в формате DOCX успешно сохранен!`);
        }

        loader.close();

    } catch (error) {
        console.error(`Ошибка при формировании ${format} отчета:`, error);
        loader.close();
    } finally {
        setTimeout(() => {
            isGeneratingReport = false;
        }, 500);
    }
}