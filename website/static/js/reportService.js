import { getRowsTable } from './db.js';

function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.append(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
}

function getFilenameFromContentDisposition(disposition) {
    if (!disposition) {
        return null;
    }
    const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/);
    return filenameMatch ? decodeURIComponent(filenameMatch[1] || filenameMatch[2]) : null;
}

function formatValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
}

function buildCsvPayload(rows, columnsInfo) {
    const header = {};
    columnsInfo.forEach((column, index) => {
        header[`col${index + 1}`] = column.description || column.name || `col${index + 1}`;
    });
    const normalizedRows = rows.map((row) => {
        const normalized = {};
        columnsInfo.forEach((column, index) => {
            normalized[`col${index + 1}`] = formatValue(row[column.name]);
        });
        return normalized;
    });
    return { header, rows: normalizedRows };
}

function buildDocxPayload(tableName, rusName, rows, columnsInfo) {
    const headers = columnsInfo.map((column) => column.description || column.name || '');
    const tableRows = rows.map((row) => columnsInfo.map((column) => formatValue(row[column.name])));
    return {
        filename: `${tableName || rusName || 'report'}.docx`,
        elements: [
            {
                type: 'title',
                text: rusName || tableName || 'Отчёт',
                formatting: {
                    font_name: 'Arial',
                    font_size: 16,
                    alignment: 'center',
                    bold: true,
                },
            },
            {
                type: 'table',
                headers,
                rows: tableRows,
            },
        ],
    };
}

async function postReport(path, body, defaultFilename) {
    const response = await fetch(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }
    const blob = await response.blob();
    const filename = getFilenameFromContentDisposition(response.headers.get('content-disposition')) || defaultFilename;
    downloadBlob(blob, filename);
    return null;
}

export async function sendReportCSV(tableName, rusName, columnsInfo) {
    const tableData = await getRowsTable(tableName);
    const rows = Array.isArray(tableData?.rows) ? tableData.rows : [];
    const body = buildCsvPayload(rows, columnsInfo || []);
    await postReport('/report/csv', body, `${tableName || 'report'}.csv`);
}

export async function sendReportDocx(tableName, rusName, columnsInfo) {
    const tableData = await getRowsTable(tableName);
    const rows = Array.isArray(tableData?.rows) ? tableData.rows : [];
    const body = buildDocxPayload(tableName, rusName, rows, columnsInfo || []);
    await postReport('/report/docx', body, body.filename);
}

export async function sendReportODT(body) {
    await postReport('/report', body, body.filename || 'report.odt');
}
