/* telc B2: full on-site week documents + local study journal. No server, no tracking. */
(function () {
 'use strict';
 function esc(s) {return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function links(text) {
   return String(text||'').split(/(https?:\/\/[^\s]+)/g).map(s=>{
     if(!/^https?:\/\//.test(s))return esc(s);
     const href=s.replace(/[.,;]+$/,'');
     return '<a class="inline-resource" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">Открыть ресурс ↗</a>'+(s.length>href.length?esc(s.slice(href.length)):'');
   }).join('');
 }
 function renderWeek(env) {
   const {DATA,ui,state,header,progressBar,taskStats,stageControl,shortDate,ext,params}=env;
   const n=Number(params.get('num')||ui.week);
   const w=DATA.weeks.find(v=>v.id===n),full=(window.TELC_B2_WEEKS||[]).find(v=>v.number===n);
   if(!w||!full)return header('ПЛАН','Неделя не найдена','Вернитесь в раздел «План обучения».');
   const stats=taskStats(n);
   const weekLinks=DATA.weeks.map(x=>'<a class="week-tab '+(n===x.id?'active':'')+'" href="#week?num='+x.id+'"'+(n===x.id?' aria-current="page"':'')+'>Неделя '+x.id+'</a>').join('');
   const intro=(full.intro||[]).filter(v=>v.length>10).map(v=>'<p>'+links(v)+'</p>').join('');
   const dates=full.days.map(d=>'<a href="#day-'+esc(d.date)+'" data-jump="'+esc(d.date)+'">'+esc(d.date.slice(8)+'.'+d.date.slice(5,7))+'</a>').join('');
   const days=full.days.map(day=>{
     const t=DATA.tasks.find(x=>x.id===day.date);
     const blocks=(day.blocks||[]).map(b=>{
       if(b.type==='hint')return '<details class="study-hint"><summary>Подсказка и речевые опоры</summary><p>'+links(b.text.replace(/^ПОДСКАЗКА ДЛЯ РЕШЕНИЯ:\s*|^РЕШЕНИЕ \/ REDEMITTEL:\s*/i,''))+'</p></details>';
       if(b.type==='heading')return '<h4 class="study-subtitle">'+esc(b.text)+'</h4>';
       return '<p class="study-paragraph">'+links(b.text)+'</p>';
     }).join('');
     const controls=t?'<div class="study-checks">'+stageControl(t,'done','Сделано')+stageControl(t,'checked','Проверено')+stageControl(t,'repeated','Повторено')+'</div>':'<span class="badge">ДЕНЬ ЭКЗАМЕНА</span>';
     const note=t?'<label class="study-field-label" for="note-'+esc(day.date)+'">Мои ошибки и заметки</label><textarea id="note-'+esc(day.date)+'" class="study-note" maxlength="3000" data-note="'+esc(day.date)+'" placeholder="Ошибки, полезные выражения, план повтора…">'+esc(state.notes[day.date]||'')+'</textarea>':'';
     return '<article class="study-day panel" id="day-'+esc(day.date)+'"><div class="study-day-head"><div><span class="eyebrow">'+esc(shortDate(day.date))+'</span><h3>'+esc(t?.title||day.heading)+'</h3></div><span class="badge badge-neutral">'+(t?t.duration+' мин':'21.12')+'</span></div><div class="study-day-content">'+blocks+'</div><div class="study-day-footer">'+controls+note+'</div></article>';
   }).join('');
   const cp=full.checkpoint?'<aside class="study-checkpoint panel"><span class="eyebrow">КОНТРОЛЬНАЯ ТОЧКА</span><h3>'+esc(full.checkpoint.heading)+'</h3>'+(full.checkpoint.blocks||[]).map(b=>'<p class="study-paragraph">'+links(b.text)+'</p>').join('')+'</aside>':'';
   return header('ПОДРОБНЫЙ ПЛАН ВНУТРИ САЙТА','Неделя '+n+' · '+w.short,w.label+' · '+w.goal,'<a href="#plan?week='+n+'" class="btn btn-secondary">← Все задания</a>')+
     '<div class="week-picker">'+weekLinks+'</div><section class="panel panel-pad study-overview"><div><span class="badge">НЕДЕЛЯ '+n+'</span><h2>'+esc(w.focus)+'</h2>'+intro+'</div><div class="week-progress"><strong>'+stats.done+' / '+stats.total+' сделано</strong>'+progressBar(stats.percent)+'</div></section>'+
     '<nav class="study-jumps" aria-label="Задания по дням"><span>К дню:</span>'+dates+'</nav><div class="study-stack">'+days+cp+'</div><div class="study-end"><a href="#week?num='+((n%5)+1)+'" class="btn">Следующая неделя →</a>'+ext(w.link,'Оригинал в Google Docs','btn btn-quiet')+'</div>';
 }
 function renderJournal(env) {
   const {DATA,ui,state,stageControl}=env;
   const weeks=['<option value="all"'+(ui.reportWeek==='all'?' selected':'')+'>Все 33 задания</option>'].concat(DATA.weeks.map(w=>'<option value="'+w.id+'"'+(ui.reportWeek===String(w.id)?' selected':'')+'>Неделя '+w.id+'</option>')).join('');
   const rows=DATA.tasks.filter(t=>ui.reportWeek==='all'||t.week===Number(ui.reportWeek)).map(t=>{
     const min=state.minutes?.[t.id]??'',err=state.errors?.[t.id]??'';
     return '<tr><td data-label="Дата">'+esc(t.id.slice(8)+'.'+t.id.slice(5,7))+'</td><td data-label="Задание"><a class="journal-task" href="#week?num='+t.week+'&day='+t.id+'">'+esc(t.title)+'</a></td><td data-label="Этапы"><div class="journal-checks">'+stageControl(t,'done','✓')+stageControl(t,'checked','Проверено')+stageControl(t,'repeated','Повтор')+'</div></td><td data-label="Минуты"><input type="number" min="0" max="999" class="journal-minutes" data-minutes="'+t.id+'" inputmode="numeric" aria-label="Минуты '+t.id+'" value="'+esc(min)+'"></td><td data-label="Ошибки"><input class="journal-errors" maxlength="240" data-error="'+t.id+'" aria-label="Ошибки '+t.id+'" placeholder="Например: Wortstellung" value="'+esc(err)+'"></td></tr>';
   }).join('');
   return '<section class="panel panel-pad journal-panel"><div class="section-head"><h2 class="section-title">Учебный журнал</h2><div class="journal-actions"><select class="journal-filter" data-report-week aria-label="Выбрать неделю">'+weeks+'</select><button type="button" class="btn btn-secondary btn-sm" data-action="csv">Скачать CSV</button></div></div><p class="section-note">Упрощённая таблица: отметки, время, ошибки. Заполняется здесь, сохраняется на устройстве. Google Sheets не синхронизируется автоматически.</p><div class="journal-scroll"><table class="journal-table"><thead><tr><th>Дата</th><th>Задание</th><th>Этапы</th><th>Мин</th><th>Ошибки</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
 }
 function exportCSV(DATA,state,tstate,today) {
   const rows=[['Дата','Неделя','Задание','Выполнено','Проверено','Повторено','Минуты','Ошибки']];
   DATA.tasks.forEach(t=>{const v=tstate(t.id);rows.push([t.id,t.week,t.title,v.done?'Да':'Нет',v.checked?'Да':'Нет',v.repeated?'Да':'Нет',state.minutes?.[t.id]??'',state.errors?.[t.id]??'']);});
   const safe=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
   const csv='\ufeff'+rows.map(row=>row.map(safe).join(';')).join('\r\n'),u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=u;a.download='telc-b2-journal-'+today()+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
 }
 window.TELC_B2_EXTRA={renderWeek,renderJournal,exportCSV};
})();
