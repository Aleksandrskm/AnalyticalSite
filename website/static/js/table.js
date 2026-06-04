import {editRow, deleteRow, insertRow, postJSON, getRowsTable} from './db.js';
import { Modal } from "./Modal.js";
import {Loader} from "./Loader.js";
import { showReportModal, generateReportByFormat as generateReportByFormatUtil } from './report.js';

const BASE_URL = 'http://185.192.247.60:8888';

// Функция для фильтрации данных с поддержкой точного совпадения
function filterData(data, field, value, exactMatch = false) {
  if (!value || !field) return data;

  return data.filter(row => {
    const cellValue = row[field];
    if (cellValue === null || cellValue === undefined) return false;

    if (exactMatch) {
      // Точное совпадение (без учета регистра)
      const strValue = String(cellValue).toLowerCase();
      const searchValue = String(value).toLowerCase();
      return strValue === searchValue;
    } else {
      // Частичное совпадение (содержит)
      const strValue = String(cellValue).toLowerCase();
      const searchValue = String(value).toLowerCase();
      return strValue.includes(searchValue);
    }
  });
}

export function table(url){
  const loader = new Loader('.loader-container');

  let currentTableData = [];
  let currentColumnsInfo = [];
  let currentTableName = '';
  let currentRusName = '';
  let currentFilteredData = null; // Храним отфильтрованные данные для отчета

  // Обертка для функции generateReportByFormat с передачей loader
  const generateReportByFormat = (tableName, rusName, columnsInfo, allRows, format) => {
    return generateReportByFormatUtil(tableName, rusName, columnsInfo, allRows, format, loader);
  };

  // Обертка для функции showReportModal
  const showReportModalWrapper = (tableName, rusName, columnsInfo, allRows) => {
    showReportModal(tableName, rusName, columnsInfo, allRows, loader, generateReportByFormat);
  };

  // Функция для создания компонента фильтрации
  function createFilterComponent(container, columnsInfo, onFilterApply, onFilterReset) {
    container.innerHTML = `
      <div class="filter-container">
        <div class="filter-field">
          <label>Поле для фильтрации</label>
          <select class="filter-field-select">
            <option value="">-- Выберите поле --</option>
            ${columnsInfo.map(col => `
              <option value="${col.name}">${col.description || col.name}</option>
            `).join('')}
          </select>
        </div>
        
        <div class="filter-value">
          <label>Значение</label>
          <input type="text" class="filter-value-input" placeholder="Введите значение...">
        </div>

        <div class="filter-exact-match">
          <label>
            <input type="checkbox" class="filter-exact-checkbox">
            Точное совпадение
          </label>
        </div>
        
        <div class="filter-buttons">
          <button class="filter-apply-btn">Применить</button>
          <button class="filter-reset-btn">Сбросить</button>
        </div>
      </div>
    `;

    const fieldSelect = container.querySelector('.filter-field-select');
    const valueInput = container.querySelector('.filter-value-input');
    const exactCheckbox = container.querySelector('.filter-exact-checkbox');
    const applyBtn = container.querySelector('.filter-apply-btn');
    const resetBtn = container.querySelector('.filter-reset-btn');

    applyBtn.addEventListener('click', () => {
      const field = fieldSelect.value;
      const value = valueInput.value;
      const exactMatch = exactCheckbox.checked;
      if (field && value) {
        onFilterApply(field, value, exactMatch);
      }
    });

    resetBtn.addEventListener('click', () => {
      fieldSelect.value = '';
      valueInput.value = '';
      exactCheckbox.checked = false;
      onFilterReset();
    });
  }

  // Функция для создания кнопок таблицы
  function createButtonsTable(tableScroll, result, tableRow, rusName, tableName, hasData) {
    const btns = document.querySelector('.table-buttons');
    if (btns) {
      btns.remove();
    }

    const buttons = document.createElement('div');
    buttons.classList = 'table-buttons';
    buttons.innerHTML = `<button class="insert">Добавить</button>`
    buttons.innerHTML += `<button class="edit">Редактировать</button>`;
    buttons.innerHTML += `<button class="copy">Добавить с копированием</button>`;
    buttons.innerHTML += `<button class="delete">Удалить</button>`;
    buttons.innerHTML += `<button class="report">Отчет</button>`;
    buttons.innerHTML += `<button class="maps">Показать карту</button>`;
    tableScroll.parentElement.append(buttons);

    const btnInsert = document.querySelector('.insert');
    const btnEdit = document.querySelector('.edit');
    const btnCopy = document.querySelector('.copy');
    const btnDelete = document.querySelector('.delete');
    const btnReport = document.querySelector('.report');
    const btmMap = document.querySelector('.maps');

    btnInsert.disabled = false;
    btnReport.disabled = false;
    btmMap.disabled = true;

    if (!hasData || !result.total_rows_count) {
      btnEdit.disabled = true;
      btnCopy.disabled = true;
      btnDelete.disabled = true;
      btmMap.disabled = true;
    } else {
      btnEdit.disabled = false;
      btnCopy.disabled = false;
      btnDelete.disabled = false;
    }

    // ИСПРАВЛЕНО: используем правильный родительский элемент
    const modalParent = document.querySelector('.column2_vi'); // Берем из HTML

    if (!modalParent) {
      console.error('Modal parent (.column2_vi) not found');
      return;
    }

    // Удаляем старые модалки перед созданием новых
    const oldModals = modalParent.querySelectorAll('.modal:not(#myModal):not(#modal__sql)');
    oldModals.forEach(modal => modal.remove());

    const modalDelete = new Modal(modalParent, 'delete', 0, result.columns_info, tableRow, deleteRow, result, rusName, tableName);
    const modalInser = new Modal(modalParent, 'insert', result.columns_info.length, result.columns_info, tableRow, insertRow, result, rusName, tableName);
    const modalCopy = new Modal(modalParent, 'copy', result.columns_info.length, result.columns_info, tableRow, insertRow, result, rusName, tableName);
    const modalEdit = new Modal(modalParent, 'edit', result.columns_info.length, result.columns_info, tableRow, editRow, result, rusName, tableName);

    btnReport.addEventListener('click', () => {
      generateReport(tableName, rusName, result.columns_info);
    });

    btnDelete.addEventListener('click', () => {
      modalDelete.createModal(createTable);
    });

    btnCopy.addEventListener('click', () => {
      modalCopy.createModal(createTable);
    });

    btnEdit.addEventListener('click', () => {
      modalEdit.createModal(createTable);
    });

    btnInsert.addEventListener('click', () => {
      modalInser.createModal(createTable);
    });
  }

  // Функция для отображения таблицы с данными
  function renderTableData(containerContent, data, columnsInfo, result, rusName, tableName, hasData) {
    let tableWrapper = containerContent.querySelector('.table-wrapper');
    if (!tableWrapper) {
      tableWrapper = document.createElement('div');
      tableWrapper.classList.add('table-wrapper');
      containerContent.appendChild(tableWrapper);
    }

    const tableScroll = document.createElement('div');
    tableScroll.classList.add('table-scroll');

    const table = document.createElement('table');
    table.classList.add('mainTable');

    // Создаем заголовок
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columnsInfo.forEach(column => {
      const th = document.createElement('th');
      th.scope = "col";
      th.innerHTML = column.description || column.name;
      headerRow.append(th);
    });
    thead.append(headerRow);
    table.append(thead);

    // Создаем тело таблицы
    const tbody = document.createElement('tbody');

    if (data.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = columnsInfo.length;
      emptyCell.textContent = 'Нет данных, соответствующих фильтру';
      emptyCell.classList.add('empty-table-message');
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      data.forEach((row, rowIndex) => {
        const tableRow = document.createElement('tr');
        let rowsIndex = 0;
        for (let field in row) {
          const cell = document.createElement('td');
          if (typeof row[field] === 'number' && !Number.isInteger(row[field])) {
            cell.innerText = row[field].toFixed(6);
          } else {
            cell.innerText = row[field];
          }

          if (rowsIndex === 0) {
            cell.setAttribute('data-key', 'ID');
            ++rowsIndex;
          }
          tableRow.appendChild(cell);
        }

        tableRow.addEventListener('click', (e) => {
          const trs = document.querySelectorAll('.mainTable tbody tr');
          trs.forEach(tr => tr.style.backgroundColor = '');
          tableRow.style.backgroundColor = '#B5B8B1';
          createButtonsTable(tableScroll, result, tableRow, rusName, tableName, hasData);
        });

        tbody.appendChild(tableRow);
      });
    }

    table.appendChild(tbody);
    tableScroll.appendChild(table);

    tableWrapper.innerHTML = '';
    tableWrapper.appendChild(tableScroll);

    // Выделяем последнюю строку если есть данные
    const trs = document.querySelectorAll('.mainTable tbody tr');
    if (trs.length > 0 && data.length > 0) {
      trs[trs.length - 1].style.backgroundColor = '#B5B8B1';
      createButtonsTable(tableScroll, result, trs[trs.length - 1], rusName, tableName, hasData);
    } else {
      createButtonsTable(tableScroll, result, null, rusName, tableName, false);
    }

    // Обновляем информацию о количестве записей
    let filterInfo = document.querySelector('.filter-info');
    if (!filterInfo) {
      filterInfo = document.createElement('div');
      filterInfo.className = 'filter-info';
      const filterContainer = document.querySelector('#filter-container');
      if (filterContainer) {
        filterContainer.appendChild(filterInfo);
      }
    }
    filterInfo.textContent = `Найдено записей: ${data.length} из ${currentTableData.length}`;
  }

  // функция в которую передается название выбранной таблицы и на его основе создается таблица
  function createTable(engName, rusName) {
    // Очищаем контейнер перед загрузкой новой таблицы
    const containerContent = document.querySelector('.container_content');
    if (containerContent) {
      containerContent.innerHTML = '';
    }

    // Сбрасываем текущие данные
    currentTableData = [];
    currentColumnsInfo = [];
    currentTableName = '';
    currentRusName = '';
    currentFilteredData = null;

    // Удаляем старую модалку отчета если есть
    const reportModal = document.getElementById('reportFormatModal');
    if (reportModal) {
      reportModal.remove();
    }

    // Показываем загрузчик
    loader.show('Загрузка таблицы...');

    let data = { name: engName };

    postJSON(data).then(result => {
      console.log(result)
      loader.close();
      if (result === undefined) {
        containerContent.innerHTML += `<h3>В данный момент таблица отсутствует</h3>`
      } else {
        generateTable(result, rusName, engName);
      }
    }).catch(error => {
      console.error('Ошибка загрузки таблицы:', error);
      loader.close();
      if (containerContent) {
        containerContent.innerHTML += `<h3>Ошибка загрузки таблицы: ${error.message}</h3>`;
      }
    });
  }

// функция которая получает названия таблиц из API и генерирует их на странице
  function getNameTables(url){
    fetch(url)
        .then(response => response.json())
        .then(jsonRsponse => {
          for (const key in jsonRsponse) {
            const elemSection = document.createElement('div');
            const dateTablesName = jsonRsponse[key];
            const nameSection = document.createElement('span');
            nameSection.classList.add('menu-section');
            nameSection.innerText = key;
            elemSection.append(nameSection);
            for (const field in dateTablesName) {
              const nameTable = document.createElement('div');
              nameTable.classList.add('container__nav__el');
              nameTable.append(dateTablesName[field]);
              nameTable.setAttribute("id", field);
              elemSection.append(nameTable);
            }
            document.querySelector('.container__nav').append(elemSection);
            elemSection.addEventListener('click', (e) => {
              const trsNavMenu = document.querySelectorAll('.container__nav__el');
              trsNavMenu.forEach((trMenu) => {
                if (trMenu == e.target) {
                  trMenu.style = 'background-color: #B5B8B1';
                  console.log(e.target.id, e.target.innerHTML);
                  createTable(e.target.id, e.target.innerHTML);
                } else {
                  if (e.target.id) {
                    trMenu.style = '';
                  }
                }
              })
            });
          }
        })
        .catch(error => {
          console.error('Ошибка загрузки таблиц:', error);
        });
  }

  // Функция для обработки фильтрации
  function handleFilterApply(field, value, exactMatch, result, rusName, tableName) {
    if (!currentTableData.length) return;

    const filteredData = filterData(currentTableData, field, value, exactMatch);
    currentFilteredData = filteredData; // Сохраняем отфильтрованные данные
    const containerContent = document.querySelector('.container_content');
    const hasData = filteredData.length > 0;
    renderTableData(containerContent, filteredData, currentColumnsInfo, result, rusName, tableName, hasData);
  }

  // Функция для сброса фильтра
  function handleFilterReset(result, rusName, tableName) {
    if (!currentTableData.length) return;

    currentFilteredData = null; // Сбрасываем отфильтрованные данные
    const containerContent = document.querySelector('.container_content');
    const filterContainer = document.querySelector('#filter-container');
    const filterInfo = document.querySelector('.filter-info');
    if (filterInfo) {
      filterInfo.remove();
    }

    // Сбрасываем значения в полях фильтра
    if (filterContainer) {
      const fieldSelect = filterContainer.querySelector('.filter-field-select');
      const valueInput = filterContainer.querySelector('.filter-value-input');
      const exactCheckbox = filterContainer.querySelector('.filter-exact-checkbox');
      if (fieldSelect) fieldSelect.value = '';
      if (valueInput) valueInput.value = '';
      if (exactCheckbox) exactCheckbox.checked = false;
    }

    const hasData = currentTableData.length > 0;
    renderTableData(containerContent, currentTableData, currentColumnsInfo, result, rusName, tableName, hasData);
  }

  // Функция для создания SQL модального окна с табличным видом (с русским наименованием)
  function createSqlModal(result, tableName, rusName) {
    const modalSql = document.querySelector('#modal__sql');
    if (!modalSql) return;

    // Удаляем старую кнопку закрытия modal__closes
    const oldCloseBtn = modalSql.querySelector('.modal__closes');
    if (oldCloseBtn) {
      oldCloseBtn.remove();
    }

    modalSql.style.display = 'block';

    const modalData = modalSql.querySelector('.modal_data');
    modalData.innerHTML = '';

    // Создаем контейнер для скролла
    const tableScrollContainer = document.createElement('div');
    tableScrollContainer.classList.add('sql-modal-table-scroll');
    tableScrollContainer.style.maxHeight = '400px';
    tableScrollContainer.style.overflow = 'auto';

    // Создаем таблицу для отображения структуры с черными границами
    const table = document.createElement('table');
    table.classList.add('sql-structure-table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '13px';
    table.style.border = '1px solid black';

    // Заголовок таблицы С колонкой "Русское наименование"
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = '#f5f5f5';
    headerRow.style.borderBottom = '1px solid black';

    const headers = ['№', 'Поле (БД)', 'Русское наименование', 'Тип данных', 'Null', 'Первичный ключ', 'Уникальность'];
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      th.style.padding = '10px 8px';
      th.style.textAlign = 'left';
      th.style.fontWeight = 'bold';
      th.style.border = '1px solid black';
      th.style.backgroundColor = '#f0f0f0';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Тело таблицы с номерами строк и русским наименованием
    const tbody = document.createElement('tbody');
    result.columns_info.forEach((column, index) => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid black';

      // Номер строки
      const numCell = document.createElement('td');
      numCell.textContent = (index + 1).toString();
      numCell.style.padding = '8px';
      numCell.style.border = '1px solid black';
      numCell.style.textAlign = 'left';
      numCell.style.fontWeight = 'bold';

      const nameCell = document.createElement('td');
      nameCell.textContent = column.name;
      nameCell.style.padding = '8px';
      nameCell.style.border = '1px solid black';

      const descCell = document.createElement('td');
      descCell.textContent = column.description || '-';
      descCell.style.padding = '8px';
      descCell.style.border = '1px solid black';

      const typeCell = document.createElement('td');
      typeCell.textContent = column.data_type || '-';
      typeCell.style.padding = '8px';
      typeCell.style.border = '1px solid black';

      const nullCell = document.createElement('td');
      nullCell.textContent = column.is_not_null === 'YES' || column.is_not_null === true ? 'Да' : 'Нет';
      nullCell.style.padding = '8px';
      nullCell.style.border = '1px solid black';
      nullCell.style.textAlign = 'left';

      const pkCell = document.createElement('td');
      pkCell.textContent = column.is_primary_key === 'PRI' || column.is_primary_key === true ? 'Да' : 'Нет';
      pkCell.style.padding = '8px';
      pkCell.style.border = '1px solid black';
      pkCell.style.textAlign = 'left';

      const uniqueCell = document.createElement('td');
      uniqueCell.textContent = column.is_unique === 'UNI' || column.is_unique === true ? 'Да' : 'Нет';
      uniqueCell.style.padding = '8px';
      uniqueCell.style.border = '1px solid black';
      uniqueCell.style.textAlign = 'left';

      row.appendChild(numCell);
      row.appendChild(nameCell);
      row.appendChild(descCell);
      row.appendChild(typeCell);
      row.appendChild(nullCell);
      row.appendChild(pkCell);
      row.appendChild(uniqueCell);
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableScrollContainer.appendChild(table);

    // Добавляем информацию о таблице
    const tableInfo = document.createElement('div');
    tableInfo.classList.add('sql-table-info');
    tableInfo.style.marginBottom = '15px';
    tableInfo.style.padding = '10px';
    tableInfo.style.backgroundColor = '#f9f9f9';
    tableInfo.style.borderRadius = '5px';
    tableInfo.style.border = '1px solid #ddd';
    tableInfo.innerHTML = `
      <div><strong>Наименование таблицы в БД:</strong> ${tableName}</div>
      <div><strong>Русское название:</strong> ${rusName}</div>
      <div><strong>Количество полей:</strong> ${result.columns_info.length}</div>
    `;

    modalData.appendChild(tableInfo);
    modalData.appendChild(tableScrollContainer);

    // Создаем единый контейнер для кнопок снизу
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.padding = '15px';
    buttonContainer.style.borderTop = '1px solid #ddd';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';

    // Кнопка сохранения структуры в DOCX
    const printBtn = document.createElement('button');
    printBtn.textContent = 'Печать';
    printBtn.style.padding = '8px 20px';
    printBtn.style.backgroundColor = '#4CAF50';
    printBtn.style.color = 'white';
    printBtn.style.border = 'none';
    printBtn.style.borderRadius = '4px';
    printBtn.style.cursor = 'pointer';
    printBtn.style.fontSize = '14px';

    printBtn.addEventListener('click', async () => {
      await generateStructureReport(tableName, rusName, result.columns_info);
    });

    // Кнопка закрытия
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Закрыть';
    closeButton.style.padding = '8px 20px';
    closeButton.style.backgroundColor = '#6c757d';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '14px';

    closeButton.addEventListener('click', () => {
      modalSql.style.display = 'none';
    });

    buttonContainer.appendChild(printBtn);
    buttonContainer.appendChild(closeButton);
    modalData.appendChild(buttonContainer);
  }

  // Функция для генерации DOCX отчета со структурой таблицы (БЕЗ русского наименования)
  async function generateStructureReport(tableName, rusName, columnsInfo) {
    try {
      loader.show('Формирование DOCX отчета...');

      const elements = [];

      // Заголовок
      elements.push({
        type: 'title',
        text: `Структура таблицы "${rusName}"`,
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
      //   type: 'paragraph',
      //   text: `Русское название: ${rusName}`,
      //   formatting: { font_size: 11, space_after: 4 }
      // });

      elements.push({
        type: 'paragraph',
        text: `Количество полей: ${columnsInfo.length}`,
        formatting: { font_size: 11, space_after: 16 }
      });

      // Заголовок для таблицы структуры
      elements.push({
        type: 'title',
        text: 'Детальная структура таблицы',
        formatting: {
          font_size: 14,
          bold: true,
          space_before: 12,
          space_after: 8
        }
      });

      // Таблица структуры БЕЗ колонки "Русское наименование"
      const structureHeaders = ['№', 'Поле (БД)', 'Тип данных', 'Null', 'Первичный ключ', 'Уникальность'];
      const structureRows = columnsInfo.map((col, index) => [
        (index + 1).toString(),
        col.name,
        col.data_type || '-',
        (col.is_not_null === 'YES' || col.is_not_null === true) ? 'Да' : 'Нет',
        (col.is_primary_key === 'PRI' || col.is_primary_key === true) ? 'Да' : 'Нет',
        (col.is_unique === 'UNI' || col.is_unique === true) ? 'Да' : 'Нет'
      ]);

      elements.push({
        type: 'table',
        headers: structureHeaders,
        rows: structureRows
      });

      // Подвал
      elements.push({
        type: 'paragraph',
        text: `Отчет сгенерирован автоматически. Всего полей: ${columnsInfo.length}`,
        formatting: {
          font_size: 10,
          alignment: 'center',
          italic: true,
          space_before: 16
        }
      });

      // Импортируем функцию downloadDocx из report.js
      const { downloadDocx } = await import('./report.js');
      const filename = `${tableName}_structure_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.docx`;
      await downloadDocx(elements, filename);

      loader.close();
      console.log(`Отчет со структурой таблицы "${rusName}" успешно сохранен!`);
    } catch (error) {
      console.error('Ошибка при формировании отчета:', error);
      loader.close();
    }
  }

  /* функция  которая проверяет  пустая таблица или нет и если она пустая строит её структуру  */
  /* функция которая проверяет пустая таблица или нет и если она пустая строит её структуру */
  function checkVoidTable(result, tableName, totalRowsCount, rusName) {
    console.log(totalRowsCount);
    console.log(result);
    const containerContent = document.querySelector('div .container_content');

    currentColumnsInfo = result.columns_info;
    currentTableName = tableName;
    currentRusName = rusName;
    currentTableData = [];

    containerContent.innerHTML = '';
    const name = document.createElement('div');
    const tableWrapper = document.createElement('div');
    const tableScroll = document.createElement('div');
    const tableHead = document.createElement('thead');
    tableWrapper.classList.add('table-wrapper');
    tableScroll.classList.add('table-scroll');
    name.classList = 'table-name';
    name.innerHTML = `${rusName}<img class="sql-img" src="static/img/sql-svg.svg" alt="SQL">`;
    containerContent.append(name);

    const filterContainer = document.createElement('div');
    filterContainer.id = 'filter-container';
    containerContent.appendChild(filterContainer);

    createFilterComponent(
        filterContainer,
        result.columns_info,
        (field, value, exactMatch) => handleFilterApply(field, value, exactMatch, result, rusName, tableName),
        () => handleFilterReset(result, rusName, tableName)
    );

    document.querySelector('.sql-img').addEventListener('click', (e) => {
      createSqlModal(result, tableName, rusName);
    });

    const table = document.createElement('table');
    table.classList.add('mainTable');

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    result.columns_info.forEach(column => {
      const th = document.createElement('th');
      th.innerHTML = `${column.description}`;
      headerRow.append(th);
    });
    thead.append(headerRow);
    table.append(thead);

    const tbody = document.createElement('tbody');
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = result.columns_info.length;
    emptyCell.textContent = 'Таблица пуста. Нажмите "Добавить" чтобы создать запись.';
    emptyCell.classList.add('empty-table-message');
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
    table.appendChild(tbody);

    tableScroll.appendChild(table);
    tableWrapper.appendChild(tableScroll);
    containerContent.append(tableWrapper);

    // ВАЖНО: Сначала добавляем кнопки в DOM, потом создаем модалки
    const btns = document.querySelector('.table-buttons');
    if (btns) {
      btns.remove();
    }

    const buttons = document.createElement('div');
    buttons.classList = 'table-buttons';
    buttons.innerHTML = `<button class="insert">Добавить</button>`
    buttons.innerHTML += `<button class="edit" disabled>Редактировать</button>`;
    buttons.innerHTML += `<button class="copy" disabled>Добавить с копированием</button>`;
    buttons.innerHTML += `<button class="delete" disabled>Удалить</button>`;
    buttons.innerHTML += `<button class="report">Отчет</button>`;
    buttons.innerHTML += `<button class="maps" disabled>Показать карту</button>`;

    // Добавляем кнопки в правильное место
    tableScroll.parentElement.append(buttons);

    const btnInsert = document.querySelector('.insert');
    const btnEdit = document.querySelector('.edit');
    const btnCopy = document.querySelector('.copy');
    const btnDelete = document.querySelector('.delete');
    const btnReport = document.querySelector('.report');
    const btmMap = document.querySelector('.maps');

    // Создаем модальные окна
    const modalParent = document.querySelector('.container_content');
    const modalInser = new Modal(modalParent, 'insert', result.columns_info.length, result.columns_info, null, insertRow, result, rusName, tableName);

    // Обработчик для кнопки Добавить
    btnInsert.addEventListener('click', () => {
      console.log('Insert button clicked in void table');
      modalInser.createModal(() => {
        createTable(tableName, rusName);
      });
    });

    // Обработчик для кнопки Отчет
    btnReport.addEventListener('click', () => {
      generateReport(tableName, rusName, result.columns_info);
    });
  }

  /* функция  в которую  передается вся информация о таблице */
  function createTableContent(result, columnsInfo, tableName, rusName) {
    loader.show('Загрузка....');

    const containerContent = document.querySelector('.container_content');

    currentColumnsInfo = columnsInfo;
    currentTableName = tableName;
    currentRusName = rusName;

    containerContent.innerHTML = '';

    const name = document.createElement('div');
    name.classList = 'table-name';
    name.innerHTML = `${rusName} <img class="sql-img" src="static/img/sql-svg.svg" alt="SQL">`;
    containerContent.append(name);

    const filterContainer = document.createElement('div');
    filterContainer.id = 'filter-container';
    containerContent.appendChild(filterContainer);

    getRowsTable(tableName).then(dataTable => {
      currentTableData = dataTable.rows;

      createFilterComponent(
          filterContainer,
          columnsInfo,
          (field, value, exactMatch) => handleFilterApply(field, value, exactMatch, result, rusName, tableName),
          () => handleFilterReset(result, rusName, tableName)
      );

      const hasData = currentTableData.length > 0;
      renderTableData(containerContent, currentTableData, columnsInfo, result, rusName, tableName, hasData);

      loader.close();
    }).catch(error => {
      console.error('Ошибка загрузки данных:', error);
      loader.close();
    });

    document.querySelector('.sql-img').addEventListener('click', (e) => {
      createSqlModal(result, tableName, rusName);
    });
  }

  /* функция  которая   создает таблицу на сайте  */
  function generateTable(result, rusName, tableNane) {
    if (result.total_rows_count === 0) {
      checkVoidTable(result, tableNane, result.total_rows_count, rusName);
    } else {
      createTableContent(result, result.columns_info, tableNane, rusName);
    }
  }

  // Функция для сбора данных таблицы и формирования отчета
  async function generateReport(tableName, rusName, columnsInfo) {
    try {
      // Если есть отфильтрованные данные - используем их, иначе берем все данные
      let reportData = currentFilteredData || currentTableData;

      if (reportData.length === 0) {
        // Если данных нет, пробуем загрузить из таблицы
        const dataTable = await getRowsTable(tableName);
        reportData = dataTable.rows;
      }

      showReportModalWrapper(tableName, rusName, columnsInfo, reportData);
    } catch (error) {
      console.error('Ошибка при сборе данных:', error);
      loader.close();
    }
  }

  getNameTables(url);
}