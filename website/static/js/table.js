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

    // Кнопка добавления всегда активна
    btnInsert.disabled = false;

    // Отчет всегда активен
    btnReport.disabled = false;

    btmMap.disabled = true;

    // Если нет данных - отключаем кнопки редактирования, копирования, удаления
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

    const modalParent = document.querySelector('.container_content');
    const modalDelete = new Modal(modalParent, 'delete', 0, result.columns_info, tableRow, deleteRow, result, rusName, tableName);
    const modalInser = new Modal(modalParent, 'insert', result.columns_info.length, result.columns_info, tableRow, insertRow, result, rusName, tableName);
    const modalCopy = new Modal(modalParent, 'copy', result.columns_info.length, result.columns_info, tableRow, insertRow, result, rusName, tableName);
    const modalEdit = new Modal(modalParent, 'edit', result.columns_info.length, result.columns_info, tableRow, editRow, result, rusName, tableName);

    btnReport.addEventListener('click', () => {
      generateReport(tableName, rusName, result.columns_info);
    });

    btnDelete.addEventListener('click', () => {
      modalDelete.createModal(createTable)
    });
    btnCopy.addEventListener('click', () => {
      modalCopy.createModal(createTable)
    });
    btnEdit.addEventListener('click', () => {
      modalEdit.createModal(createTable)
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
    const containerContent = document.querySelector('.container_content');
    const hasData = filteredData.length > 0;
    renderTableData(containerContent, filteredData, currentColumnsInfo, result, rusName, tableName, hasData);
  }

  // Функция для сброса фильтра
  function handleFilterReset(result, rusName, tableName) {
    if (!currentTableData.length) return;

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

  /* функция  которая проверяет  пустая таблица или нет и если она пустая строит её структуру  */
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
      document.querySelector('#modal__sql').style = `display: block;`
      document.querySelector('#modal__sql .modal__closes').addEventListener('click', () => {
        document.querySelector('#modal__sql').style = `display: none;`
      })
      const modalRow = document.createElement('div');
      document.querySelector('#modal__sql .modal_data').innerHTML = ``;
      modalRow.classList.add('modal__rows');
      result['columns_info'].forEach(column => {
        const modalRowData = document.createElement('div');
        modalRowData.innerHTML += `<div>Наименование поля: ${column.name}</div> `;
        modalRowData.innerHTML += `<div>Русское наименование поля:${column.description}</div> `;
        modalRowData.innerHTML += `<div>Тип поля: ${column['data_type']}</div> `;
        modalRowData.innerHTML += `<div>Может ли быть null: ${column['is_not_null']}</div> `;
        modalRowData.innerHTML += `<div>Первичный ключ:${column['is_primary_key']}</div> `;
        modalRowData.innerHTML += `<div>Уникальность поля: ${column['is_unique']}</div> `;
        modalRowData.classList.add('modal__row');
        modalRow.append(modalRowData);
      })

      const modalRowData = document.createElement('div');
      modalRowData.innerHTML += `<div>Наименование таблицы в БД:    ${tableName}</div> `;
      modalRowData.innerHTML += `<div>Наименование таблицы (рус):    ${rusName}</div> `;
      modalRowData.classList.add('modal__names');
      modalRow.prepend(modalRowData)
      document.querySelector('#modal__sql .modal_data').append(modalRow);
    })

    const tr = document.createElement('table');
    tr.classList.add('mainTable');
    result.columns_info.forEach(column => {
      const th = document.createElement('th');
      th.innerHTML = `${column.description}`;
      tableHead.append(th);
    })
    tr.append(tableHead);
    tableScroll.append(tr);
    tableWrapper.append(tableScroll);
    containerContent.append(tableWrapper);

    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = result.columns_info.length;
    emptyCell.textContent = 'Таблица пуста. Нажмите "Добавить" чтобы создать запись.';
    emptyCell.classList.add('empty-table-message');
    emptyRow.appendChild(emptyCell);
    const tbody = document.querySelector('.mainTable tbody');
    if (tbody) tbody.appendChild(emptyRow);

    createButtonsTable(tableScroll, result, null, rusName, tableName, false);
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
      document.querySelector('#modal__sql').style = `display: block;`
      document.querySelector('#modal__sql .modal__closes').addEventListener('click', () => {
        document.querySelector('#modal__sql').style = `display: none;`
      })
      const modalRow = document.createElement('div');
      document.querySelector('#modal__sql .modal_data').innerHTML = ``;
      modalRow.classList.add('modal__rows');
      columnsInfo.forEach(column => {
        const modalRowData = document.createElement('div');
        modalRowData.innerHTML += `<div>Наименование поля: ${column.name}</div> `;
        modalRowData.innerHTML += `<div>Русское наименование поля:${column.description}</div> `;
        modalRowData.innerHTML += `<div>Тип поля: ${column['data_type']}</div> `;
        modalRowData.innerHTML += `<div>Может ли быть null: ${column['is_not_null']}</div> `;
        modalRowData.innerHTML += `<div>Первичный ключ:${column['is_primary_key']}</div> `;
        modalRowData.innerHTML += `<div>Уникальность поля: ${column['is_unique']}</div> `;
        modalRowData.classList.add('modal__row');
        modalRow.append(modalRowData);
      })
      const modalRowData = document.createElement('div');
      modalRowData.innerHTML += `<div>Наименование таблицы в БД: ${tableName}</div> `;
      modalRowData.innerHTML += `<div>Наименование таблицы (рус): ${rusName}</div> `;
      modalRowData.classList.add('modal__names');
      modalRow.prepend(modalRowData)
      document.querySelector('#modal__sql .modal_data').append(modalRow);
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
      const currentRows = document.querySelectorAll('.mainTable tbody tr');
      let filteredData = [];

      if (currentRows.length > 0 && currentRows[0].querySelectorAll('td').length > 0) {
        const firstCellText = currentRows[0].querySelector('td')?.textContent || '';
        if (firstCellText !== 'Нет данных, соответствующих фильтру' && firstCellText !== 'Таблица пуста. Нажмите "Добавить" чтобы создать запись.') {
          currentRows.forEach(row => {
            const rowData = {};
            const cells = row.querySelectorAll('td');
            columnsInfo.forEach((col, idx) => {
              rowData[col.name] = cells[idx]?.textContent || '';
            });
            filteredData.push(rowData);
          });
        }
      }

      if (filteredData.length === 0) {
        const dataTable = await getRowsTable(tableName);
        filteredData = dataTable.rows;
      }

      showReportModalWrapper(tableName, rusName, columnsInfo, filteredData);
    } catch (error) {
      console.error('Ошибка при сборе данных:', error);
      loader.close();
    }
  }

  getNameTables(url);
}