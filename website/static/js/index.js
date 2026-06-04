import { table } from "./table.js";
'use strict';


document.addEventListener('DOMContentLoaded', function() {
  const url = 'http://185.192.247.60:7130/Database/db_structure';
  const h2=document.querySelector('h2');
  function getDateTime() {
    let now     = new Date(); 
    let year    = now.getFullYear();
    let month   = now.getMonth()+1; 
    let day     = now.getDate();
    let hour    = now.getHours();
    let minute  = now.getMinutes();
    let second  = now.getSeconds(); 
    if(month.toString().length == 1) {
         month = '0'+month;
    }
    if(day.toString().length == 1) {
         day = '0'+day;
    }   
    if(hour.toString().length == 1) {
         hour = '0'+hour;
    }
    if(minute.toString().length == 1) {
         minute = '0'+minute;
    }
    if(second.toString().length == 1) {
         second = '0'+second;
    }  
     
    let dateTime = year+'-'+month+'-'+day+' '+hour+':'+minute+':'+second;   
     return dateTime;
  }
  setInterval(function(){
    let currentTime = getDateTime();
    document.getElementById("timer-start").innerHTML = currentTime;
  }, 0);
  if (document.getElementById("timer-settings"))
  {
      setInterval(function(){
          let currentTime = getDateTime();
          document.getElementById("timer-settings").innerHTML = currentTime;
      }, 0);
  }

  console.log(1);
  document.getElementById('settingsBtn').addEventListener('click',(e)=>{
    document.getElementById('myModal').style.display='flex';
})
if (document.querySelector('.close')){
    document.querySelector('.close').addEventListener('click',(e)=>{
        document.getElementById('myModal').style.display='none';
    })
}
   if (document.querySelector('.modal-resize-btn')){document.querySelector('.modal-resize-btn').addEventListener('click',(e)=>{
       document.getElementById('myModal').style.display='none';
   })}
    if ( window.location.pathname ==='/viewing_tables') {
        table(url);
    }

});




