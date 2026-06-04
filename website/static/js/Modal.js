//класс для создания модальных окон 
export class Modal{
    constructor(modalParent,typeModal,colInputs,columns,tableRow,funcRow,table,rusName,tableName){
        this.modalParent=modalParent;
        this.typeModal=typeModal;
        this.colInputs=colInputs;
        this.columns=columns;
        this.tableRow=tableRow;
        this.funcRow=funcRow;
        this.table=table;
        this.rusName=rusName;
        this.tableName=tableName
    }

    createModal(callback){
        console.log('Creating modal:', this.typeModal);

        // создание модального окна по полученным параметрам
        const modal=document.createElement('div');
        const modalDialog=document.createElement('div');
        const modalContent=document.createElement('div');

        modal.classList.add('modal');
        modal.style.display = 'flex'; // Важно!
        modalDialog.classList.add('modal__dialog');
        modalContent.classList.add('modal__content');

        // Устанавливаем содержимое в зависимости от типа
        if (this.typeModal==='insert') {
            modalContent.innerHTML=` <div class="modal__title">Добавление новой строки в таблицу</div>`;
        }
        else if (this.typeModal==='edit') {
            modalContent.innerHTML=` <div class="modal__title">Редактирование таблицы</div>`;
        }
        else if (this.typeModal==='copy') {
            modalContent.innerHTML=` <div class="modal__title">Копирование строки в таблицу</div>`;
        }
        else if (this.typeModal==='delete') {
            modalContent.innerHTML=` <div class="modal__title"> Удаление строки из таблицы</div>`;
        }

        const Columns=document.createElement('div');
        Columns.classList.add('modalColumns');

        for (let i = 1; i < this.colInputs; i++) {
            const modalInput=document.createElement('input');
            const value=String(this.tableRow ? this.tableRow.children[i].innerHTML : '');
            const dataColumn=document.createElement('div');
            const nameColumn=document.createElement('div');
            nameColumn.classList.add('name-column');
            nameColumn.innerText=this.columns[i].description;
            dataColumn.classList.add('data-column');
            dataColumn.append(nameColumn);
            modalInput.type='text';
            modalInput.classList.add('modal__input');

            if (this.typeModal=='copy') {
                if (i==1 && this.tableRow) {
                    modalContent.innerHTML+=` <div class="copy__row">Копируется строка ${this.tableRow.children[0].innerHTML}</div>`;
                }
                modalInput.setAttribute('value',value);
            }
            if (this.typeModal=='edit') {
                modalInput.placeholder=value;
                modalInput.setAttribute('value',value);
            }
            else{
                modalInput.placeholder=this.columns[i].description;
            }

            dataColumn.append(modalInput);
            Columns.append(dataColumn);
            if (i+1==this.colInputs) {
                modalContent.append(Columns);
            }
        }

        // Добавляем кнопки
        if (this.typeModal=='insert') {
            modalContent.innerHTML+=` 
            <div class='btnsModal'>
            <button class="btn modal__confirm btn_dark btn_min">Добавить</button>
            <button class="btn modal__close btn_dark btn_min">Отмена</button></div>`;
        }
        else if (this.typeModal=='edit') {
            modalContent.innerHTML+=` 
            <div class='btnsModal'>
            <button class="btn modal__confirm btn_dark btn_min">Сохранить</button>
            <button class="btn modal__close btn_dark btn_min">Отмена</button></div>`;
        }
        else if (this.typeModal=='copy') {
            modalContent.innerHTML+=` 
            <div class='btnsModal'>
            <button class="btn modal__confirm btn_dark btn_min">Копировать</button>
            <button class="btn modal__close btn_dark btn_min">Отмена</button></div>`;
        }
        else if (this.typeModal=='delete') {
            if (this.tableRow) {
                modalContent.innerHTML+=` <div class="copy__row">Удаляется строка ${this.tableRow.children[0].innerHTML}</div>`;
            }
            modalContent.innerHTML+=` 
            <div class='btnsModal'>
            <button class="btn modal__confirm btn_dark btn_min">Удалить</button>
            <button class="btn modal__close btn_dark btn_min">Отмена</button></div>`;
        }

        // Используем переданный родительский элемент
        const modalParent = this.modalParent;

        if (!modalParent) {
            console.error('Родительский элемент для модального окна не найден');
            return;
        }

        modalDialog.append(modalContent);
        modal.append(modalDialog);
        modalParent.append(modal);

        // Добавление прослушивателя событий кнопки подтверждения
        const btnConfirm = modal.querySelector('.modal__confirm');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => {
                // проверка на тип модального окна и реализация функций
                if (this.typeModal==='insert') {
                    const inputs=modal.querySelectorAll('.modal__input');
                    const arrData=[];
                    const columns=[];

                    inputs.forEach((input,index)=>{
                        if(input.value){
                            arrData.push(input.value);
                            columns.push(String(this.table.columns_info[index+1].name));
                        }
                    });

                    const bodyReq={};
                    const data={}
                    for (let i=0;i<columns.length;i++){
                        data[columns[i]] = arrData[i];
                    }
                    bodyReq['row']=data

                    this.funcRow(bodyReq,this.tableName).then(() => {
                        modal.remove();
                        if(callback) callback(this.tableName,this.rusName);
                    });
                }
                else if (this.typeModal==='copy') {
                    const inputs=modal.querySelectorAll('.modal__input');
                    const arrData=[];
                    const columns=[];

                    inputs.forEach((input,index)=>{
                        if(input.value){
                            arrData.push(String(input.value));
                            columns.push(String(this.table.columns_info[index+1].name));
                        }
                    });

                    const bodyReq={};
                    const data={}
                    for (let i=0;i<columns.length;i++){
                        data[columns[i]] = arrData[i];
                    }
                    bodyReq['row']=data

                    this.funcRow(bodyReq,this.tableName).then(() => {
                        modal.remove();
                        if(callback) callback(this.tableName,this.rusName);
                    });
                }
                else if (this.typeModal==='edit') {
                    const inputs=modal.querySelectorAll('.modal__input');
                    const updates = {};

                    inputs.forEach((input,index)=>{
                        if (input.value && this.tableRow) {
                            const fieldName=this.table.columns_info[index+1].name;
                            updates[fieldName] = String(input.value);
                        }
                    });

                    if (Object.keys(updates).length > 0 && this.tableRow) {
                        const primaryKeys = {};
                        this.tableRow.querySelectorAll('td[data-key]').forEach((td) => {
                            const key = td.getAttribute('data-key');
                            const value = td.innerText;
                            primaryKeys[key] = value;
                        });

                        const data = {
                            updates: updates,
                            where: {
                                column: Object.keys(primaryKeys)[0],
                                operator: "=",
                                value: primaryKeys[Object.keys(primaryKeys)[0]]
                            }
                        };

                        this.funcRow(data, this.tableName).then(() => {
                            modal.remove();
                            if(callback) callback(this.tableName, this.rusName);
                        });
                    } else {
                        modal.remove();
                        if(callback) callback(this.tableName, this.rusName);
                    }
                }
                else if (this.typeModal==='delete') {
                    if (this.tableRow) {
                        const primaryKeys = {};
                        this.tableRow.querySelectorAll('td[data-key]').forEach((td) => {
                            const key = td.getAttribute('data-key');
                            const value = td.innerText;
                            primaryKeys[key] = value;
                        });

                        const data = {
                            where: {
                                column: Object.keys(primaryKeys)[0],
                                operator: "=",
                                value: primaryKeys[Object.keys(primaryKeys)[0]]
                            }
                        };

                        this.funcRow(data, this.tableName).then(() => {
                            modal.remove();
                            if(callback) callback(this.tableName, this.rusName);
                        });
                    } else {
                        modal.remove();
                    }
                }
            });
        }

        // Добавление прослушивателя событий кнопки отмены
        const btnClose = modal.querySelector('.modal__close');
        if (btnClose) {
            btnClose.addEventListener('click',() => {
                modal.remove();
            });
        }

        // Добавляем возможность закрытия по клику на фон
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}