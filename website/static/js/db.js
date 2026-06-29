// функция изменения строки в API
import {Loader} from "./Loader.js";

let URL = `185.192.247.60:8910`;
const testURL = `127.0.0.1:8000`;
//URL = testURL
let loader;

if (document.querySelector('#dialog-res')) {
  loader = new Loader('.loader-container');
}

function renderPopup(popupElement, message) {
  const div = document.createElement("div");
  const p = document.createElement("p");
  popupElement.innerHTML = '';
  p.innerHTML = message;
  div.append(p);
  div.classList.add('dialog-div');
  popupElement.prepend(div);
  popupElement.classList.add('popup');
  popupElement.showModal();
  setTimeout(() => {
    popupElement.classList.remove('popup');
    popupElement.close();
  }, 3000);
}

function cleanStringCompact(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return str
      .replace(/[\u0000-\u001F\u007F\u00A0\u00AD\u200B-\u200D\u2028\u2029\u2060\uFEFF]/g, '')
      .replace(/[\r\n\t]/g, '')
      .trim();
}

// ==================== НОВАЯ ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ СПИСКА БД ====================

/**
 * Получение списка доступных баз данных
 * @returns {Promise<string[]>} - массив названий БД
 */
async function getDbNames() {
  try {
    const response = await fetch(`http://${URL}/db/names`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    console.log('Database names:', result);
    if (response.ok) {
      return result;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (error) {
    console.error('Error fetching database names:', error);
    throw error;
  }
}

// ==================== НОВЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ГРУППИРОВКАМИ ====================

/**
 * Получение списка всех группировок спутников
 * @param {string} dbName - имя базы данных (по умолчанию 'KA')
 * @returns {Promise<string[]>} - массив названий группировок
 */
async function getSatelliteGroups(dbName = 'KA') {
  try {
    const response = await fetch(`http://${URL}/satellites/groups?db_name=${dbName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    console.log('Satellite groups:', result);
    if (response.ok) {
      return result;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (error) {
    console.error('Error fetching satellite groups:', error);
    throw error;
  }
}

/**
 * Получение списка спутников по группировке с пагинацией
 * @param {string} group - название группировки
 * @param {number} page - номер страницы (по умолчанию 1)
 * @param {number} pageSize - размер страницы (по умолчанию 10)
 * @param {string} dbName - имя базы данных (по умолчанию 'KA')
 * @returns {Promise<Object>} - объект с данными спутников и информацией о пагинации
 */
async function getSatellitesByGroup(group, page = 1, pageSize = 10, dbName = 'KA') {
  try {
    const url = `http://${URL}/satellites?group=${encodeURIComponent(group)}&page=${page}&page_size=${pageSize}&db_name=${dbName}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    console.log('Satellites by group:', result);
    if (response.ok) {
      return result;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (error) {
    console.error('Error fetching satellites:', error);
    throw error;
  }
}

/**
 * Получение лучей спутника по его ID и типу луча
 * @param {number} satelliteId - ID спутника
 * @param {string} beamType - тип луча ('transmitting' или 'receiving')
 * @param {string} dbName - имя базы данных (по умолчанию 'KA')
 * @returns {Promise<Array>} - массив лучей
 */
async function getSatelliteBeams(satelliteId, beamType, dbName = 'KA') {
  try {
    const url = `http://${URL}/satellites/${satelliteId}/beams?beam_type=${beamType}&db_name=${dbName}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    console.log('Satellite beams:', result);
    if (response.ok) {
      return result;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (error) {
    console.error('Error fetching satellite beams:', error);
    throw error;
  }
}

// ==================== СТАРЫЕ ФУНКЦИИ (с добавлением параметра dbName) ====================

async function getDistanceBeam(elevationAngle, satelliteAltitude) {
  try {
    const response = await fetch(`http://${URL}/math/ground_range?angle=${elevationAngle}&altitude=${satelliteAltitude}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    console.log(`Success:`, result);
    if (response.ok) {
      return result;
    }
  } catch (error) {
    console.error(`Error:`, error);
  }
}

async function getActiveSessions(dbName = 'USERS') {
  try {
    const response = await fetch(`http://${URL}/users/sessions?db_name=${dbName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    console.log(`Success:`, result);
    if (response.ok) {
      return result;
    }
  } catch (error) {
    console.error(`Error:`, error);
  }
}

async function getAllUsers(dbName = 'USERS') {
  try {
    const response = await fetch(`http://${URL}/users?db_name=${dbName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    console.log(`Success:`, result);
    if (response.ok) {
      return result;
    }
  } catch (error) {
    console.error(`Error:`, error);
  }
}

async function postUsersActivity(userIds, startDate, endDate, dbName = 'USERS') {
  try {
    const response = await fetch(`http://${URL}/users/activity?start_date=${startDate}&end_date=${endDate}&db_name=${dbName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userIds),
    });
    const result = await response.json();
    console.log(`Success:`, result);
    if (response.ok) {
      return result;
    }
  } catch (error) {
    console.error(`Error:`, error);
  }
}

async function editRow(data, tableName, dbName = 'KA') {
  try {
    const response = await fetch(`http://${URL}/db/update/${tableName}?db_name=${dbName}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log(`Row edit successfully:`, result);
    if (document.querySelector('#dialog-res')) {
      renderPopup(document.querySelector('#dialog-res'), `Данные успешно обновлены`);
    }
    return result;
  } catch (error) {
    if (document.querySelector('#dialog-res')) {
      renderPopup(document.querySelector('#dialog-res'), `Произошла ошибка ${error}`);
    }
    console.error(`Error edit row:`, error);
  }
}

async function deleteRow(data, tableName, dbName = 'KA') {
  try {
    const response = await fetch(`http://${URL}/db/delete/${tableName}?db_name=${dbName}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log(`Row deleted successfully:`, result);
    return result;
  } catch (error) {
    console.error(`Error deleting row:`, error);
  }
}

async function recalculateKA(idKA, dbName = 'KA') {
  try {
    const response = await fetch(`http://${URL}/ka/${idKA}/recalculate?db_name=${dbName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "X-Source": 12
      },
    });
    const result = await response.json();
    if (response.ok) {
      const result = await response;
      if (document.querySelector('#dialog-res')) {
        loader.close();
        renderPopup(document.querySelector('#dialog-res'), `Пересчет данных прошел успешно`);
      }
      loader.close();
      return result;
    } else {
      if (document.querySelector('#dialog-res')) {
        loader.close();
        renderPopup(document.querySelector('#dialog-res'), `Произошла ошибка ${error}`);
      }
      loader.close();
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }
    return result;
  } catch (error) {
    console.error(`Error deleting row:`, error);
  }
}

async function insertRow(data, tableName, dbName = 'KA') {
  try {
    const response = await fetch(`http://${URL}/db/insert_row/${tableName}?db_name=${dbName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log(`Row insert successfully:`, result);
    return result;
  } catch (error) {
    console.error(`Error insert row:`, error);
  }
}

async function postJSON(data, dbName = 'KA') {
  try {
    const response = await fetch(`http://${URL}/db/${data.name}/info?db_name=${dbName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    console.log(`Success:`, result);
    if (response.ok) {
      return result;
    }
  } catch (error) {
    console.error(`Error:`, error);
  }
}

async function getRowsTable(tableName, skipRows, rowsCount, dbName = 'KA') {
  try {
    const response = await fetch(`http://${URL}/db/select/${tableName}?db_name=${dbName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    console.log(`Success:`, result);
    return result;
  } catch (error) {
    console.error(`Error:`, error);
  }
}

async function changeQuery(query, dbName = 'KA') {
  try {
    const response = await fetch(`http://${URL}/db/custom_change_query?db_name=${dbName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      'body': `"${(query)}"`,
    });
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    const result = await response.json();
    console.log((query));
    console.log(`Success:`, result);
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

async function updateOrInsert(tableName, body, dbName = 'KA') {
  try {
    const response = await fetch(`http://${URL}/db/update_or_insert_row/${tableName}?db_name=${dbName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      'body': JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    const result = await response.json();
    console.log(`Success:`, result);
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

async function selectQuery(query, dbName = 'KA') {
  try {
    console.log((query));
    const response = await fetch(`http://${URL}/db/custom_select_query?db_name=${dbName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      'body': `"${query}"`,
    });
    const result = await response.json();
    console.log(`Success:`, result);
    return result;
  } catch (error) {
    console.error(`Error:`, error);
  }
}

async function recalculateKas(dbName = 'KA') {
  try {
    loader.show('Ожидание ответа от сервера....');
    const response = await fetch(`http://${URL}/ka/recalculate?db_name=${dbName}`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-Source": 12
      },
    });
    if (response.ok) {
      const result = await response;
      if (document.querySelector('#dialog-res')) {
        loader.close();
        renderPopup(document.querySelector('#dialog-res'), `Пересчет данных прошел успешно`);
      }
      loader.close();
      return result;
    } else {
      if (document.querySelector('#dialog-res')) {
        loader.close();
        renderPopup(document.querySelector('#dialog-res'), `Произошла ошибка ${error}`);
      }
      loader.close();
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    if (document.querySelector('#dialog-res')) {
      loader.close();
      renderPopup(document.querySelector('#dialog-res'), `Произошла ошибка ${error}`);
    }
    console.error("Error recalculating KAS:", error);
    throw error;
  }
}

// ==================== ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ СПИСКА ТАБЛИЦ ====================

/**
 * Получение структуры всех таблиц (имена таблиц по разделам)
 * @param {string} dbName - имя базы данных (по умолчанию 'KA')
 * @returns {Promise<Object>} - объект с разделами и таблицами
 */
async function getTableNames(dbName = 'KA') {
  try {
    const response = await fetch(`http://${URL}/db/structure?db_name=${dbName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    console.log('Table names:', result);
    if (response.ok) {
      return result;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (error) {
    console.error('Error fetching table names:', error);
    throw error;
  }
}

export {
  editRow, deleteRow, insertRow, postJSON, getRowsTable, changeQuery,
  selectQuery, recalculateKas, recalculateKA, getDistanceBeam,
  updateOrInsert, getActiveSessions, getAllUsers, postUsersActivity,
  getSatelliteGroups, getSatellitesByGroup, getSatelliteBeams,
  getDbNames, getTableNames
};