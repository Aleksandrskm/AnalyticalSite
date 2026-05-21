import {editRow,deleteRow,insertRow,postJSON,getRowsTable} from './db.js';
import { sendReportCSV, sendReportDocx } from './reportService.js';
import { Modal } from "./Modal.js";
import {Loader} from "./Loader.js";
export function table(url){
  const loader = new Loader('.loader-container');
      // функция  в которую  передается название выбранной таблицы и на его основе создается таблица
      function createTable(engName,rusName,) {
        let data = { name: engName };


        postJSON(data).then(result => {
          console.log(result)
          if (result===undefined) {
            document.querySelector('.container_content').innerHTML+=`<h3>В данный момент таблица отсутствует</h3>`

          }
          else{  
            generateTable(result,rusName,engName);

          }
        });
        document.querySelector('.container_content').innerHTML = '';
      }
      // функция которая получает названия таблиц из API и генерирует их на странице
      function getNameTables(url){
        let response = fetch(url)
        .then(response => response.json())
        .then(jsonRsponse => {
          for (const key in jsonRsponse) {
            const elemSection = document.createElement('div');
            const dateTablesName=jsonRsponse[key];
            const nameSection=document.createElement('span');
            nameSection.classList.add('menu-section');
            nameSection.innerText=key;
            elemSection.append(nameSection);
            for(const field in dateTablesName)
            {
              // console.log(dateTablesName[field])
              const nameTable=document.createElement('div');
              nameTable.classList.add('container__nav__el');
              nameTable.append(dateTablesName[field]) ;
              nameTable.setAttribute("id", field);
              elemSection.append(nameTable);
            }
            document.querySelector('.container__nav').append(elemSection);
            // console.log(elemSection)
                elemSection.addEventListener('click', (e) => {
                  const trsNavMenu=document.querySelectorAll('.container__nav__el');
                  trsNavMenu.forEach((trMenu)=>{
                    if (trMenu==e.target) {
                      trMenu.style='background-color: #B5B8B1';
                      console.log(e.target.id,e.target.innerHTML);
                      createTable(e.target.id,e.target.innerHTML);
                    }
                    else{
                      if (e.target.id) {
                        trMenu.style='';
                      }
                    }
                  }) 
                });
          }
        });
      }
      /* функция  которая проверяет  пустая таблица или нет и если она пустая строит её структуру  */
      function checkVoidTable(result,tableName, totalRowsCount,rusName) {
        if (totalRowsCount === 0) {
          console.log(totalRowsCount);
          console.log(result);
          const containerContent=document.querySelector('div .container_content');
          containerContent.innerHTML='';
          const name = document.createElement('div');
          const tableWrapper = document.createElement('div');
          const tableScroll = document.createElement('div');
          const tableHead = document.createElement('thead');
          const tableBody = document.createElement('tbody');
          tableWrapper.classList.add('table-wrapper');
          tableScroll.classList.add('table-scroll');
          name.classList = 'table-name';
          name.innerHTML = `${rusName}<img class="sql-img" src="static/img/sql-svg.svg" alt="SQL">`;
          containerContent.append(name);
          document.querySelector('.sql-img').addEventListener('click', (e) => {
            document.querySelector('#modal__sql').style=`display: block;`
            document.querySelector('#modal__sql .modal__closes').addEventListener('click', () => {
              document.querySelector('#modal__sql').style=`display: none;`
            })
            const modalRow=document.createElement('div');
            document.querySelector('#modal__sql .modal_data').innerHTML=``;
            modalRow.classList.add('modal__rows');
            result['columns_info'].forEach(column=>{
              const modalRowData=document.createElement('div');
              modalRowData.innerHTML+=`<div>Наименование поля: ${column.name}</div> `;
              modalRowData.innerHTML+=`<div>Русское наименование поля:${column.description}</div> `;
              modalRowData.innerHTML+=`<div>Тип поля: ${column['data_type']}</div> `;
              modalRowData.innerHTML+=`<div>Может ли быть null: ${column['is_not_null']}</div> `;
              modalRowData.innerHTML+=`<div>Первичный ключ:${column['is_primary_key']}</div> `;
              modalRowData.innerHTML+=`<div>Уникальность поля: ${column['is_unique']}</div> `;
              modalRowData.classList.add('modal__row');
              modalRow.append(modalRowData);
            })

            const  modalRowData=document.createElement('div');


            modalRowData.innerHTML+=`<div>Наименование таблицы в БД:    ${tableName}</div> `;
            modalRowData.innerHTML+=`<div>Наименование таблицы (рус):    ${rusName}</div> `;
            modalRowData.classList.add('modal__names');
            modalRow.prepend(modalRowData)
            console.log(modalRow,'modalRowData')
            document.querySelector('#modal__sql .modal_data').append(modalRow);
          })
          const tr = document.createElement('table');
          tr.classList.add('mainTable');
          result.columns_info.forEach(column=>{
            const th =document.createElement('th');
            th.innerHTML=`${column.description}`;
            tableHead.append(th);
          })
          tr.append(tableHead);
          tableScroll.append(tr);
          tableWrapper.append(tableScroll);
          containerContent.append(tableWrapper);
          createButtonsTable(tableScroll,result,tableHead,rusName,tableName);
        }
      }
      /* функция  в которую  передается вся информация о таблице 
      строки  в таблице  название выбранной таблицы  на  основе этих параметров строится структура таблицы*/
      function createTableContent(result,columnsInfo,tableName,rusName) {
        loader.show('Загрузка....');
        console.log(loader)
        console.log(result)
        console.log(columnsInfo)
        console.log(tableName)
        const containerContent=document.querySelector('.container_content');
        containerContent.innerHTML='';
        const tableBody = document.createElement('tbody');
        columnsInfo.forEach((element, rowIndex) => {
          if (rowIndex === 0) {
            const name = document.createElement('div');
            const tableWrapper = document.createElement('div');
            const tableScroll = document.createElement('div');
            const tableHead = document.createElement('thead');
            tableWrapper.classList.add('table-wrapper');
            tableScroll.classList.add('table-scroll');
            name.classList = 'table-name';
            name.innerHTML = `${rusName} <img class="sql-img" src="static/img/sql-svg.svg" alt="SQL"> `;
            document.querySelector('.container_content').append(name);
            document.querySelector('.sql-img').addEventListener('click', (e) => {
              document.querySelector('#modal__sql').style=`display: block;`
              document.querySelector('#modal__sql .modal__closes').addEventListener('click', () => {
                document.querySelector('#modal__sql').style=`display: none;`
              })
              const modalRow=document.createElement('div');
              document.querySelector('#modal__sql .modal_data').innerHTML=``;
              modalRow.classList.add('modal__rows');
              columnsInfo.forEach(column=>{
                const modalRowData=document.createElement('div');
                modalRowData.innerHTML+=`<div>Наименование поля: ${column.name}</div> `;
                modalRowData.innerHTML+=`<div>Русское наименование поля:${column.description}</div> `;
                modalRowData.innerHTML+=`<div>Тип поля: ${column['data_type']}</div> `;
                modalRowData.innerHTML+=`<div>Может ли быть null: ${column['is_not_null']}</div> `;
                modalRowData.innerHTML+=`<div>Первичный ключ:${column['is_primary_key']}</div> `;
                modalRowData.innerHTML+=`<div>Уникальность поля: ${column['is_unique']}</div> `;
                modalRowData.classList.add('modal__row');
                modalRow.append(modalRowData);
              })
              const  modalRowData=document.createElement('div');


              modalRowData.innerHTML+=`<div>Наименование таблицы в БД: ${tableName}</div> `;
              modalRowData.innerHTML+=`<div>Наименование таблицы (рус): ${rusName}</div> `;
              modalRowData.classList.add('modal__names');
              modalRow.prepend(modalRowData)
              console.log(modalRow,'modalRowData')

              document.querySelector('#modal__sql .modal_data').append(modalRow);
            })
            const table=document.createElement('table');
            table.classList.add('mainTable');
            document.querySelector('.container_content').append(table);
            const tableRow = document.createElement('tr');
            columnsInfo.forEach(column=>{
              const th =document.createElement('th');
              th.scope="col";
              th.innerHTML=`${column.description}`;
              tableRow.append(th);
            });
            tableHead.append(tableRow);
            table.append(tableHead);
            tableScroll.append(table)
            tableWrapper.append(tableScroll);
            containerContent.append(tableWrapper);
          }
          const tableRow = document.createElement('tr');
          // console.log(element);
          let rowsIndex=0;
          // for(let field in element) {
          //   // console.log(element[field])
          //   const cell = document.createElement('td');
          //   cell.innerText = element[field];
          //   if (rowsIndex === 0) {
          //     cell.setAttribute('data-key', 'ID');
          //     ++rowsIndex;
          //   }
          //   tableRow.appendChild(cell);
          // };
          const table=document.querySelector('table');
          const tableScroll = document.querySelector('.table-scroll');
          tableRow.addEventListener('click',(e)=>{
            let r = document.createRange();
            r.selectNode(e.target.parentElement);
            document.getSelection().addRange(r);
            console.log(e.target.parentElement);
            const trs=document.querySelectorAll('table tr');
            trs.forEach((tr)=>{
              if (tr===e.target.parentElement) {
                tr.style='background-color: #B5B8B1';
              }
              else{
                tr.style='';
              }
            })
             createButtonsTable(tableScroll,result,e.target.parentElement,rusName,tableName);
          });
          tableBody.append(tableRow);
          table.append(tableBody);

          // if (result.columns_count<=22)
          //   {
          //     console.log('21')
          //     createButtonsTable(tableScroll,result,tableRow,rusName);
          //   }
          // console.log(result.columns_count);
        });
        getRowsTable(tableName).then(dataTable => {
          dataTable.rows.forEach((row)=>{
            const tableRow = document.createElement('tr');
            let rowsIndex=0;
            for(let field in row) {
                      // console.log(element[field])
                const cell = document.createElement('td');
                console.log('row[field]:',row[field])
              if( typeof row[field] ==='number' && !Number.isInteger( row[field])){
                console.log('cell[field]:',);
                cell.innerText = row[field].toFixed(6);
              }
              else {
                cell.innerText = row[field];
              }

                if (rowsIndex === 0) {
                  cell.setAttribute('data-key', 'ID');
                  ++rowsIndex;
                }
                tableRow.appendChild(cell);
            }
            const tableBody=document.querySelector('tbody');
            tableRow.addEventListener('click',(e)=>{
                      let r = document.createRange();
                      r.selectNode(e.target.parentElement);
                      document.getSelection().addRange(r);
                      console.log(e.target.parentElement);
                      const trs=document.querySelectorAll('table tr');
                      trs.forEach((tr)=>{
                        if (tr==e.target.parentElement) {
                          tr.style='background-color: #B5B8B1';
                        }
                        else{
                          tr.style='';
                        }
                      })
                      createButtonsTable(tableScroll,result,e.target.parentElement,rusName,tableName);
                    });
            tableBody.append(tableRow);

                  const tableScroll = document.querySelector('.table-scroll');
                  createButtonsTable(tableScroll,result,tableRow,rusName,tableName);
            loader.close();

          })
          const trs=document.querySelectorAll('table tr');
          trs.forEach((tr,index)=>{
            if (index===trs.length-1) {
              tr.style='background-color: #B5B8B1';
            }
          });
        })
      //   if (result.columns_count<21){
      //     const trs=document.querySelectorAll('table tr');
      //   trs.forEach((tr,index)=>{
      //   if (index==trs.length-1) {
      //   tr.style='background-color: #B5B8B1';
      //   }
      // });
      //   }
      //   if (result.total_rows_count>20) {
      //     getRowsTable(tableName,20,result.total_rows_count).then(response=>{
      //     response.forEach(row=>{
      //       // console.log(row)
      //       const tableRow = document.createElement('tr');
      //       let rowsIndex=0;
      //       for(let field in row) {
      //         // console.log(element[field])
      //         const cell = document.createElement('td');
      //
      //         cell.innerText = row[field];
      //         if (rowsIndex === 0) {
      //           cell.setAttribute('data-key', 'ID');
      //           ++rowsIndex;
      //         }
      //         tableRow.appendChild(cell);
      //       };
      //       const tableBody=document.querySelector('tbody');
      //       tableRow.addEventListener('click',(e)=>{
      //         let r = document.createRange();
      //         r.selectNode(e.target.parentElement);
      //         document.getSelection().addRange(r);
      //         console.log(e.target.parentElement);
      //         const trs=document.querySelectorAll('table tr');
      //         trs.forEach((tr)=>{
      //           if (tr==e.target.parentElement) {
      //             tr.style='background-color: #B5B8B1';
      //           }
      //           else{
      //             tr.style='';
      //           }
      //         })
      //         createButtonsTable(tableScroll,result,e.target.parentElement,rusName);
      //       });
      //
      //       tableBody.append(tableRow);
      //       const tableScroll = document.querySelector('.table-scroll');
      //       createButtonsTable(tableScroll,result,tableRow,rusName);
      //     })
      //     const trs=document.querySelectorAll('table tr');
      //       trs.forEach((tr,index)=>{
      //         if (index==trs.length-1) {
      //         tr.style='background-color: #B5B8B1';
      //         }
      //       });
      //     });
      //   }}
      }
      /* функция  которая   создает таблицу на сайте  */
      function generateTable(result,rusName,tableNane) {
        if (result.total_rows_count===0) {
          checkVoidTable(result,tableNane, result.total_rows_count,rusName);
        }
        else {
          createTableContent(result,result.columns_info,tableNane,rusName);
        }
      }
      /* функция  которая  создает  кнопки для работы с  таблицей на сайте  */
      function createButtonsTable(table,result,tableRow,rusName,tableName) {
        const btns=document.querySelector('.table-buttons');
        if (btns) {
          btns.remove();
        }
        // console.log(tableRow);
        const buttons = document.createElement('div');
        buttons.classList = 'table-buttons';
        buttons.innerHTML = `
          <div class="button-group">
            <button class="insert">Добавить</button>
            <button class="edit">Редактировать</button>
            <button class="report-csv">Отчёт CSV</button>
            <button class="report-docx">Отчёт docx</button>
          </div>
          <div class="button-group">
            <button class="copy">Добавить с копированием</button>
            <button class="delete">Удалить</button>
            <button class="maps">Показать карту</button>
          </div>
        `;
        table.parentElement.append(buttons);
        // console.log(result.rows[0].length);
        const btnInsert=document.querySelector('.insert');
        const btnEdit=document.querySelector('.edit');
        const btnReportCSV=document.querySelector('.report-csv');
        const btnReportDocx=document.querySelector('.report-docx');
        const btnCopy=document.querySelector('.copy');
        const btnDelete=document.querySelector('.delete');
        const btmMap=document.querySelector('.maps');
        btmMap.setAttribute('disabled', '');
          if (!result.total_rows_count) {
            btnEdit.setAttribute('disabled', '');
            btnCopy.setAttribute('disabled', '');
            btnDelete.setAttribute('disabled', '');
            btmMap.setAttribute('disabled', '');
          }
        const modalParent=document.querySelector('.container_content');
        const modalDelete= new Modal(modalParent,'delete',0,result.columns_info,tableRow,deleteRow,result,rusName,tableName);
        const modalInser= new Modal(modalParent,'insert',result.columns_info.length,result.columns_info,tableRow,insertRow,result,rusName,tableName);
        const modalCopy= new Modal(modalParent,'copy',result.columns_info.length,result.columns_info,tableRow,insertRow,result,rusName,tableName);
        const modalEdit= new Modal(modalParent,'edit',result.columns_info.length,result.columns_info,tableRow,editRow,result,rusName,tableName);
        btnDelete.addEventListener('click',()=>{
          modalDelete.createModal(createTable)});
        btnCopy.addEventListener('click',()=>{
          modalCopy.createModal(createTable)});
        btnEdit.addEventListener('click',()=>{
          modalEdit.createModal(createTable)});
        btnInsert.addEventListener('click',()=>{
          modalInser.createModal(createTable);
        });
        btnReportCSV.addEventListener('click', async () => {
          try {
            loader.show('Формирование отчёта CSV...');
            await sendReportCSV(tableName, rusName, result.columns_info);
          } catch (error) {
            console.error(error);
            alert('Ошибка при формировании CSV отчёта');
          } finally {
            loader.close();
          }
        });
        btnReportDocx.addEventListener('click', async () => {
          try {
            loader.show('Формирование отчёта DOCX...');
            await sendReportDocx(tableName, rusName, result.columns_info);
          } catch (error) {
            console.error(error);
            alert('Ошибка при формировании DOCX отчёта');
          } finally {
            loader.close();
          }
        });
      }
      getNameTables(url);
}
