/* Goethe B2 Learning Studio
   Standalone, dependency-free, local-first personal study dashboard.
   No credentials, analytics, external scripts or backend. */
(() => {
  'use strict';
  const DATA = window.GOETHE_DATA;
  if (!DATA) throw new Error('Study plan data missing');
  const MAIN = document.getElementById('app-main');
  const STORAGE = DATA.storageKey;
  const DEFAULT = { version: 1, tasks: {}, notes: {}, scores: {}, learned: [], theme: 'light', updatedAt: '' };
  let state = load();
  const ui = { week: chooseCurrentWeek(), phrase: 0, reveal: false, openNotes: new Set() };
  const timer = { preset: 120, remaining: 120, running: false, deadline: 0, interval: null };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (!raw) return structuredClone(DEFAULT);
      const v = JSON.parse(raw);
      if (!v || v.version !== 1 || typeof v !== 'object') return structuredClone(DEFAULT);
      return { ...structuredClone(DEFAULT), ...v, tasks: v.tasks && typeof v.tasks === 'object' ? v.tasks : {},
        notes: v.notes && typeof v.notes === 'object' ? v.notes : {},
        scores: v.scores && typeof v.scores === 'object' ? v.scores : {},
        learned: Array.isArray(v.learned) ? v.learned : [] };
    } catch { return structuredClone(DEFAULT); }
  }
  function persist() {
    try { state.updatedAt = new Date().toISOString();localStorage.setItem(STORAGE, JSON.stringify(state));return true; }
    catch { toast('Не удалось сохранить: проверьте настройки хранения браузера');return false; }
  }
  const e = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const icon = (name, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const ext = (href, label, classes = 'btn btn-secondary', opts = '') => `<a href="${e(href)}" target="_blank" rel="noopener noreferrer" class="${classes}" ${opts}>${label}${icon('arrow','icon-xs')}</a>`;
  const btn = (label, action, cls='btn btn-secondary') => `<button type="button" class="${cls}" data-action="${action}">${label}</button>`;
  const ruDate = iso => new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
  const shortDate = iso => new Intl.DateTimeFormat('ru-RU', {weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
  function todayBerlin() {
    const pieces = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const v=Object.fromEntries(pieces.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    return `${v.year}-${v.month}-${v.day}`;
  }
  function daysBetween(a,b) {
    const start = Date.UTC(+a.slice(0,4), +a.slice(5,7)-1, +a.slice(8,10));
    const end = Date.UTC(+b.slice(0,4), +b.slice(5,7)-1, +b.slice(8,10));
    return Math.round((end-start)/86400000);
  }
  function daysLeft() { return daysBetween(todayBerlin(), DATA.examDate); }
  function chooseCurrentWeek() {
    const now=todayBerlin();
    return DATA.weeks.find(w=>w.start<=now && w.end>=now)?.id || (now<DATA.weeks[0].start?1:now>DATA.weeks[4].end?5:DATA.weeks.find(w=>w.start>=now)?.id||1);
  }
  function tstate(id) { return state.tasks[id] && typeof state.tasks[id] === 'object' ? state.tasks[id] : {}; }
  function taskDone(id) { return !!tstate(id).done; }
  function taskStats(week) {
    const arr=week?DATA.tasks.filter(t=>t.week===week):DATA.tasks;
    const done=arr.filter(t=>taskDone(t.id)).length;
    return { total:arr.length, done, percent:arr.length?Math.round(done/arr.length*100):0 };
  }
  function weekForTask(t) { return DATA.weeks[t.week-1]; }
  function progressBar(p) { return `<div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="Прогресс"><div class="bar-fill" style="width:${p}%"></div></div>`; }
  function sectionHead(title, right='') { return `<div class="section-head"><h2 class="section-title">${title}</h2>${right}</div>`; }
  function header(kicker, title, desc, action='') { return `<div class="page-head"><div><p class="eyebrow">${kicker}</p><h1 class="page-title">${title}</h1><p class="page-description">${desc}</p></div>${action?`<div class="head-actions">${action}</div>`:''}</div>`; }
  function stageControl(t, step, label) {
    return `<label><input type="checkbox" data-task="${t.id}" data-step="${step}" ${tstate(t.id)[step]?'checked':''} aria-label="${e(label)}: ${e(t.title)}"><span>${label}</span></label>`;
  }
  function nextTask() {
    const now=todayBerlin();
    return DATA.tasks.find(t=>t.id>=now&&!taskDone(t.id)) || DATA.tasks.find(t=>!taskDone(t.id)) || null;
  }

  function renderHome() {
    const stats=taskStats();const left=daysLeft();const t=nextTask();
    const title=left>0?`До экзамена ${left} ${plural(left,'день','дня','дней')}`:left===0?'Сегодня экзамен B2':'Экзамен по плану уже прошёл';
    const subtitle=left>0?'21 декабря 2026 · Berlitz. Фокус на Schreiben и Sprechen.':'Вся подготовка и записи остаются доступны.';
    const next=t?`<article class="task-compact"><div class="task-compact-heading"><span class="badge">${t.id===todayBerlin()?'СЕГОДНЯ':t.id>todayBerlin()?'СЛЕДУЮЩЕЕ ЗАДАНИЕ':'НЕЗАВЕРШЕНО'}</span><span class="badge badge-neutral">${shortDate(t.id)}</span></div><h3>${e(t.title)}</h3><p>${e(t.detail)}</p><div class="task-actions"><a href="#plan?week=${t.week}&task=${t.id}" class="btn btn-sm">${icon('calendar')} К заданию</a>${ext(weekForTask(t).link,'План недели','btn btn-quiet btn-sm')}</div></article>`
      :`<article class="task-compact"><span class="badge">ВСЕ ЗАДАНИЯ ОТМЕЧЕНЫ</span><h3>33 из 33 ✓</h3><p>Теперь можно повторять слабые темы и проверять результат пробниками.</p></article>`;
    const quick = [
      ['edit','Schreiben','Письма и форум',DATA.links.writing],
      ['mic','Sprechen','Монолог и диалоги',DATA.links.speaking],
      ['book','LexDeutsch','Премиум-тренажёр',DATA.links.lex],
      ['chart','Google Sheets','Баллы и журнал ошибок',DATA.links.tracking]
    ].map(([ic,name,desc,url])=>`<a class="quick-card" href="${url}" target="_blank" rel="noopener noreferrer"><div class="quick-head">${icon(ic,'icon-lg')}${icon('arrow','icon-xs')}</div><strong>${name}</strong><span>${desc}</span></a>`).join('');
    const perWeek=DATA.weeks.map(w=>{const m=taskStats(w.id);return `<div class="week-mini-row"><strong>${String(w.id).padStart(2,'0')}</strong>${progressBar(m.percent)}<span>${m.done}/${m.total}</span></div>`}).join('');
    return `${header('ЛИЧНЫЙ КАБИНЕТ','Guten Tag, Настя.','Меньше поиска, больше практики. Все задания и материалы — в одном месте.')}
      <section class="hero" aria-labelledby="hero-title"><div><div class="hero-label">ТВОЙ ЭКЗАМЕН · DTB B2</div><h2 id="hero-title">${title}</h2><p>${subtitle}</p><div class="hero-actions"><a href="#plan" class="btn">${icon('calendar')} План на сегодня</a><a href="#practice" class="btn btn-hero-quiet">${icon('clock')} Начать тренировку</a></div></div><div class="countdown" aria-label="${Math.max(left,0)} календарных дней до экзамена" style="background:conic-gradient(#b6e7ca ${Math.min(100,Math.max(0,Math.round((34-Math.max(0,left))/34*100)))}%,rgba(255,255,255,.15) 0)"><div class="countdown-inner"><span class="countdown-num">${Math.max(left,0)}</span><span class="countdown-caption">дней</span></div></div></section>
      <div class="home-grid"><div class="stack"><section class="panel panel-pad">${sectionHead('Твоя следующая тренировка','<a class="text-link" href="#plan">Все 33 дня →</a>')}${next}</section>
      <section class="panel panel-pad">${sectionHead('Маршрут из пяти недель','<a class="text-link" href="#plan">Открыть план →</a>')}<div class="progress-line"><div class="small-ring" style="background:conic-gradient(var(--accent) ${stats.percent}%,var(--panel-soft) 0)"><span>${stats.percent}%</span></div><div><strong style="font-size:15px">${stats.done} из ${stats.total} заданий</strong><p style="font-size:12px;color:var(--muted);margin:5px 0">Отмечено как «сделано». Проверка и повтор считаются отдельно.</p></div></div><div class="week-mini">${perWeek}</div></section></div>
      <div class="stack"><section class="panel panel-pad">${sectionHead('Открыть и учиться')}<div class="quick-grid">${quick}</div></section>
      <section class="panel panel-pad">${sectionHead('Одна привычка сегодня')}<p class="section-note" style="font-size:13px;line-height:1.65;margin:0 0 16px">Напиши собственный ответ, проверь все пункты задания и повтори исправленный вариант через 1–2 дня. Для Sprechen — запись голоса и вопрос партнёру.</p><a href="#practice" class="text-link">Таймер и Redemittel ${icon('chevron','icon-xs')}</a></section></div></div>`;
  }
  function renderTask(t) {
    const s=tstate(t.id),w=weekForTask(t);
    const isCheckpoint=t.kind.toLowerCase().includes('checkpoint');
    const note=typeof state.notes[t.id]==='string'?state.notes[t.id]:'';
    return `<article class="task-card ${s.done?'task-card-completed':''}" id="day-${t.id}">
      <div class="task-top"><span class="task-date">${e(shortDate(t.id).toUpperCase())}</span><span class="task-kind">${e(t.kind)}</span></div>
      <h3>${e(t.title)}</h3><p class="desc">${e(t.detail)}</p>
      <div class="task-foot"><div class="task-sources">${icon('book','icon-xs')} <span>${isCheckpoint?'Контрольный день':`PDF: стр. ${e(t.pages)}`}</span><span>·</span>${icon('clock','icon-xs')}<span>${t.duration} мин</span></div><a class="text-link" target="_blank" rel="noopener noreferrer" href="${e(w.link)}">Инструкция ${icon('arrow','icon-xs')}</a></div>
      <div class="mini-checks">${stageControl(t,'done','Сделано')}${stageControl(t,'checked','Проверено')}${stageControl(t,'repeated','Повторено')}<button class="notes-toggle" type="button" data-notes-toggle="${t.id}" aria-expanded="${ui.openNotes.has(t.id)}">${icon('edit','icon-xs')} Заметка</button></div>
      <div class="task-note ${ui.openNotes.has(t.id)?'open':''}" id="note-${t.id}"><textarea data-note="${t.id}" aria-label="Заметки по задаче ${e(t.title)}" maxlength="3000" placeholder="Ошибки, полезные слова, что повторить завтра…">${e(note)}</textarea><small>Сохраняется в этом браузере автоматически.</small></div></article>`;
  }
  function renderPlan() {
    const w=DATA.weeks[ui.week-1],tasks=DATA.tasks.filter(t=>t.week===ui.week),m=taskStats(ui.week);
    const menu=DATA.weeks.map(x=>`<button class="week-tab ${ui.week===x.id?'active':''}" data-week="${x.id}" aria-pressed="${ui.week===x.id}">${String(x.id).padStart(2,'0')} · ${e(x.short)}</button>`).join('');
    return `${header('33 ДНЯ · 5 ЭТАПОВ','План обучения','Выбирай неделю, выполняй задания с таймером и отмечай этапы. Все пункты взяты из вашей таблицы Google Sheets.',ext(DATA.links.tracking,'Google Sheets'))}
      <div class="week-picker" role="group" aria-label="Выбрать неделю">${menu}</div>
      <section class="panel panel-pad"><div class="week-summary"><div><span class="badge">НЕДЕЛЯ ${w.id}</span><h2 style="font-size:22px;letter-spacing:-.03em;margin:10px 0 3px">${e(w.focus)}</h2><p>${e(w.label)} · ${e(w.goal)}</p></div><div class="week-progress"><div style="display:flex;justify-content:space-between;font-size:12px;margin:0 0 9px"><strong>Выполнено</strong><span>${m.done} / ${m.total}</span></div>${progressBar(m.percent)}</div></div><div class="task-list">${tasks.map(renderTask).join('')}</div><aside class="checkpoint"><strong>${icon('check','icon-xs')} Чекпоинт недели</strong><p>${e(w.checkpoint)}</p>${ext(w.link,'Открыть полный план недели','btn btn-secondary btn-sm')}</aside></section>`;
  }
  function renderPractice() {
    const phrase=DATA.phrases[ui.phrase%DATA.phrases.length];const learned=state.learned.includes(ui.phrase);
    return `${header('SCHREIBEN + SPRECHEN','Практика B2','Работаем именно с двумя приоритетными навыками. Пиши собственные тексты и тренируй устную реакцию.',ext(DATA.links.lex,'LexDeutsch Premium'))}
      <div class="module-grid"><section class="panel module-card"><div class="module-mark">${icon('edit','icon-lg')}</div><span class="badge">ПРИОРИТЕТ №1</span><h3 style="margin-top:11px">Schreiben</h3><p>Письма, форум и телефонная заметка.</p><ul class="module-list"><li>Beschwerde: понять поручение начальника</li><li>Forumsbeitrag: мнение, аргументы, решение</li><li>Контроль времени и проверка ошибок</li></ul><div class="task-actions">${ext(DATA.links.writing,'Схемы и задания','btn btn-sm')}${ext(DATA.links.lexComplaint,'Жалобы','btn btn-secondary btn-sm')}</div></section>
      <section class="panel module-card"><div class="module-mark">${icon('mic','icon-lg')}</div><span class="badge">ПРИОРИТЕТ №2</span><h3 style="margin-top:11px">Sprechen</h3><p>Восемь тем презентации и реальные диалоги.</p><ul class="module-list"><li>Teil 1: 2 минуты без чтения текста</li><li>Teil 2: поддержать Smalltalk</li><li>Teil 3: предложить решение и договориться</li></ul><div class="task-actions">${ext(DATA.links.speaking,'8 тем и диалоги','btn btn-sm')}${ext(DATA.links.lexSpeak,'Тренажёр','btn btn-secondary btn-sm')}</div></section></div>
      <div class="practice-bottom"><section class="panel panel-pad">${sectionHead('Учебный таймер','<span class="badge badge-neutral">Без отвлечений</span>')}<p class="section-note">Выбери длительность под тип задания.</p><div class="pill-picker" role="group" aria-label="Длительность таймера">${[[120,'2 мин · Vortrag'],[1200,'20 мин · E-Mail'],[1800,'30 мин · Forum']].map(([s,label])=>`<button class="pill-button ${timer.preset===s?'selected':''}" data-preset="${s}" aria-pressed="${timer.preset===s}">${label}</button>`).join('')}</div><div class="timer-clock" id="timer-clock" role="timer" aria-live="off">${timeString(timer.remaining)}</div><div class="timer-actions"><button id="timer-play" type="button" class="btn" data-action="timer-toggle">${icon(timer.running?'pause':'play')} ${timer.running?'Пауза':'Начать'}</button><button type="button" class="btn btn-quiet" data-action="timer-reset">${icon('reset')} Сброс</button></div></section>
      <section class="panel panel-pad">${sectionHead('Redemittel — тренажёр',`<span class="badge badge-neutral">${state.learned.length}/${DATA.phrases.length} выучено</span>`)}<div class="flip-card"><small>${e(phrase.type)} · ${ui.phrase+1} / ${DATA.phrases.length}</small><strong>${e(phrase.de)}</strong>${ui.reveal?`<p class="flip-translation">${e(phrase.ru)}</p>`:''}</div><div class="card-bottom"><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" data-action="flash-reveal">${ui.reveal?'Скрыть':'Перевод'}</button><button class="btn btn-secondary btn-sm" data-action="flash-next">Дальше ${icon('chevron','icon-xs')}</button></div><button class="btn btn-sm ${learned?'btn-quiet':'btn-secondary'}" data-action="flash-learn">${icon('check','icon-xs')} ${learned?'Выучено':'Выучить'}</button></div></section></div>`;
  }
  const resources = [
    ['book','00 · Start Here','Навигатор и правила подготовки.',DATA.links.homeDoc],
    ['edit','06 · Schreiben','Beschwerde, Forumsbeitrag, Sprachbausteine.',DATA.links.writing],
    ['mic','07 · Sprechen','Презентации, Smalltalk, Problemlösung.',DATA.links.speaking],
    ['grid','08 · Экзамен','Формат DTB B2, критерии, ловушки.',DATA.links.exam],
    ['book','09 · Банк заданий','Темы и указатели страниц PDF.',DATA.links.bank],
    ['chart','10 · Google Sheets','Отчёт, оценки, ошибки, контрольные точки.',DATA.links.tracking],
    ['book','Исходный PDF','210-страничный тематический сборник.',DATA.links.sourcePdf],
    ['book','Советы и заметки','Экспорт рекомендаций из Telegram.',DATA.links.tips],
    ['grid','VHS Lernportal','Бесплатный интерактивный курс Beruf B2.',DATA.links.vhs],
    ['grid','LexDeutsch Premium','Экзаменационные тренировки.',DATA.links.lex],
    ['grid','Официальный telc','Описание DTB B2 и пробные задания.',DATA.links.telc]
  ];
  function renderLibrary() {
    return `${header('МАТЕРИАЛЫ И ДОКУМЕНТЫ','Библиотека B2','Вместо папок и поиска: все материалы открываются в один клик. Права доступа определяются настройками Google Drive.')}
      <div class="library-grid">${resources.map(([ic,title,desc,url])=>`<article class="panel library-card"><div class="chip">${icon(ic)}</div><h3>${e(title)}</h3><p>${e(desc)}</p>${ext(url,'Открыть документ','text-link')}</article>`).join('')}</div>`;
  }
  function renderProgress(){
    const st=taskStats();const reviewed=DATA.tasks.filter(t=>!!tstate(t.id).checked).length;const repeated=DATA.tasks.filter(t=>!!tstate(t.id).repeated).length;
    const w=DATA.weeks.map(x=>{const m=taskStats(x.id);return `<div style="margin:0 0 16px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:7px"><strong>Неделя ${x.id} · ${e(x.short)}</strong><span style="color:var(--muted)">${m.done}/${m.total}</span></div>${progressBar(m.percent)}</div>`}).join('');
    const parts=[['lesen','Lesen'],['hoeren','Hören'],['schreiben','Schreiben'],['sprechen','Sprechen']];
    const inp=parts.map(([id,name])=>`<label><span class="score-label">${name}<small>Было: ${DATA.baseline[id]}/60</small></span><input class="score-input" type="number" data-score="${id}" min="0" max="60" step="0.5" inputmode="decimal" placeholder="__/60" value="${Number.isFinite(Number(state.scores[id]))&&state.scores[id]!==''&&state.scores[id]!=null?e(state.scores[id]):''}"></label>`).join('');
    return `${header('ДАННЫЕ В ЭТОМ БРАУЗЕРЕ','Мой прогресс','Чек-листы и оценки сохраняются автоматически. Перед очисткой браузера сделай резервную копию.',ext(DATA.links.tracking,'Google Sheets'))}
    <div class="stats-grid"><div class="stat"><span class="big">${st.done}<span style="font-size:15px;color:var(--muted)"> / 33</span></span><span class="label">Заданий выполнено</span></div><div class="stat"><span class="big">${reviewed}</span><span class="label">Проверены</span></div><div class="stat"><span class="big">${repeated}</span><span class="label">Повторены</span></div></div>
    <div class="progress-layout"><div class="stack"><section class="panel panel-pad">${sectionHead('Прогресс по неделям')}<div>${w}</div><a class="text-link" href="#plan">Перейти к заданиям ${icon('chevron','icon-xs')}</a></section>
    <section class="panel panel-pad">${sectionHead('Баллы пробного экзамена','<span class="badge badge-neutral">Тренировка</span>')}<div class="score-grid">${inp}</div><p class="score-meta">Цель: L ≥42 · H ≥42 · Sch ≥42–45 · Spr ≥45. Предварительная оценка, не официальный результат.</p><div id="score-result">${scoreResultHTML()}</div></section></div>
    <div class="stack"><section class="panel panel-pad">${sectionHead('Резервная копия',`<span class="badge badge-neutral">${icon('shield','icon-xs')} Local-first</span>`)}<p class="section-note" style="line-height:1.7;margin:0 0 15px">Данные не уходят на сервер. Экспортируй JSON после каждой недели, чтобы сохранить отметки и заметки.</p><div class="backup-actions"><button class="btn btn-secondary btn-sm" data-action="export">${icon('download')} Скачать JSON</button><button class="btn btn-quiet btn-sm" data-action="import">${icon('upload')} Восстановить</button></div><p class="backup-note">На другом устройстве прогресс появится только после ручного импорта файла. Google Sheets автоматически не обновляется.</p><div class="danger-zone"><button class="btn btn-danger btn-sm" data-action="erase">Сбросить данные на этом устройстве</button></div></section>
    <section class="panel panel-pad">${sectionHead('Как оценивать честно')}<p class="section-note" style="line-height:1.7;margin:0 0 13px">Минимальный суммарный результат DTB B2 — 144/240, но дополнительно нужны три части не ниже 36/60 и четвёртая не ниже 24/60. Не заполняй Schreiben/Sprechen произвольной оценкой — лучше по проверке преподавателя.</p>${ext(DATA.links.exam,'Открыть регламент','text-link')}</section></div></div>`;
  }
  function scoreResultHTML() {
    const v=['lesen','hoeren','schreiben','sprechen'].map(k=>state.scores[k]);
    if(v.some(s=>s===''||s===undefined||s===null||!Number.isFinite(Number(s))))return '<div class="score-result"><strong>Внеси все четыре результата</strong>Сначала выполни пробник и получи проверку письма и говорения.</div>';
    const nums=v.map(Number);const total=nums.reduce((a,b)=>a+b,0);
    const pass=total>=144&&nums.filter(n=>n>=36).length>=3&&nums.every(n=>n>=24);
    return `<div class="score-result"><strong>${total.toLocaleString('ru-RU')} / 240 · ${pass?'Тренировочный порог достигнут':'Тренировочный порог пока не достигнут'}</strong>${pass?'Все числовые условия выполнены, но это не официальный результат.':'Нужно одновременно выполнить условие общей суммы и минимума по каждому модулю.'}</div>`;
  }
  function plural(num,one,few,many){const n=Math.abs(num)%100,p=n%10;return n>10&&n<20?many:p===1?one:p>=2&&p<=4?few:many;}
  function timeString(s){const n=Math.max(0,Math.floor(s));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
  function timerUpdate(){if(timer.running){timer.remaining=Math.max(0,Math.ceil((timer.deadline-Date.now())/1000));if(timer.remaining===0){timerPause();toast('Время вышло — проверь задание и сделай паузу');}}const el=document.getElementById('timer-clock');if(el)el.textContent=timeString(timer.remaining);const b=document.getElementById('timer-play');if(b)b.innerHTML=`${icon(timer.running?'pause':'play')} ${timer.running?'Пауза':'Начать'}`;}
  function timerPause(){timer.running=false;if(timer.interval){clearInterval(timer.interval);timer.interval=null;}}
  function timerToggle(){if(timer.running){timerUpdate();timerPause();}else{if(timer.remaining===0)timer.remaining=timer.preset;timer.deadline=Date.now()+timer.remaining*1000;timer.running=true;timer.interval=setInterval(timerUpdate,250);}timerUpdate();}
  function timerReset(){timerPause();timer.remaining=timer.preset;timerUpdate();}

  function routeInfo(){const raw=(location.hash||'#home').replace(/^#/,'');const [name,query='']=raw.split('?');const route=['home','plan','practice','library','progress'].includes(name)?name:'home';const params=new URLSearchParams(query);return{route,params};}
  function render(resetScroll=true){
    const {route,params}=routeInfo();
    if(route==='plan'){const n=Number(params.get('week'));if(n>=1&&n<=5)ui.week=n;}
    MAIN.innerHTML=({home:renderHome,plan:renderPlan,practice:renderPractice,library:renderLibrary,progress:renderProgress}[route])();
    for(const link of document.querySelectorAll('[data-nav]')){const yes=link.dataset.nav===route;link.classList.toggle('active',yes);if(yes)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    document.getElementById('current-section').textContent={home:'Главная',plan:'План обучения',practice:'Практика B2',library:'Библиотека',progress:'Мой прогресс'}[route];
    document.title={home:'Главная',plan:'План',practice:'Практика',library:'Библиотека',progress:'Прогресс'}[route]+' · Goethe B2';
    if(resetScroll){window.scrollTo({top:0,behavior:'instant'});if(params.get('task')&&route==='plan'){setTimeout(()=>document.getElementById('day-'+params.get('task'))?.scrollIntoView({behavior:'smooth',block:'center'}),70);}}
    if(route==='practice')timerUpdate();
  }
  let toastTimeout;
  function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.hidden=true,3400);}
  function rerenderKeepPosition(){const y=window.scrollY;render(false);window.scrollTo(0,y);}
  function setTheme(){document.documentElement.dataset.theme=state.theme==='dark'?'dark':'light';const b=document.getElementById('theme-switch');if(b)b.innerHTML=icon(state.theme==='dark'?'sun':'moon');}

  document.addEventListener('click',event=>{
    const week=event.target.closest('[data-week]');
    if(week){const num=Number(week.dataset.week);location.hash=`#plan?week=${num}`;if(ui.week===num&&routeInfo().route==='plan')render(false);return;}
    const note=event.target.closest('[data-notes-toggle]');
    if(note){const id=note.dataset.notesToggle;if(ui.openNotes.has(id))ui.openNotes.delete(id);else ui.openNotes.add(id);const el=document.getElementById('note-'+id);if(el)el.classList.toggle('open',ui.openNotes.has(id));note.setAttribute('aria-expanded',String(ui.openNotes.has(id)));return;}
    const select=event.target.closest('[data-preset]');
    if(select){timerPause();timer.preset=Number(select.dataset.preset);timer.remaining=timer.preset;rerenderKeepPosition();return;}
    const button=event.target.closest('[data-action]');if(!button)return;
    switch(button.dataset.action){
      case 'timer-toggle':timerToggle();break;
      case 'timer-reset':timerReset();break;
      case 'flash-reveal':ui.reveal=!ui.reveal;rerenderKeepPosition();break;
      case 'flash-next':ui.phrase=(ui.phrase+1)%DATA.phrases.length;ui.reveal=false;rerenderKeepPosition();break;
      case 'flash-learn':{const arr=new Set(state.learned);arr.has(ui.phrase)?arr.delete(ui.phrase):arr.add(ui.phrase);state.learned=[...arr];persist();rerenderKeepPosition();break;}
      case 'export':exportBackup();break;
      case 'import':document.getElementById('restore-input').click();break;
      case 'erase':if(confirm('Сбросить весь локальный прогресс, заметки и оценки? Перед этим рекомендуется скачать резервную копию.')){state=structuredClone(DEFAULT);persist();toast('Локальный прогресс сброшен');rerenderKeepPosition();}break;
    }
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.matches('input[data-task][data-step]')){
      const id=el.dataset.task,step=el.dataset.step;
      if(!DATA.tasks.some(t=>t.id===id)||!['done','checked','repeated'].includes(step))return;
      state.tasks[id]={...tstate(id),[step]:el.checked};persist();rerenderKeepPosition();
    }else if(el.matches('input[data-score]')){
      const key=el.dataset.score,allow=['lesen','hoeren','schreiben','sprechen'];if(!allow.includes(key))return;
      const raw=el.value.trim().replace(',','.');
      if(raw===''){delete state.scores[key];persist();return updateScoreResult();}
      const value=Number(raw);if(!Number.isFinite(value)||value<0||value>60){el.value='';delete state.scores[key];persist();toast('Баллы должны быть от 0 до 60');return updateScoreResult();}
      state.scores[key]=Math.round(value*2)/2;el.value=String(state.scores[key]);persist();updateScoreResult();
    }
  });
  document.addEventListener('input',event=>{
    if(event.target.matches('textarea[data-note]')){const id=event.target.dataset.note;if(DATA.tasks.some(t=>t.id===id)){state.notes[id]=event.target.value.slice(0,3000);persist();}}
  });
  function updateScoreResult(){const box=document.getElementById('score-result');if(box)box.innerHTML=scoreResultHTML();}
  function exportBackup(){const payload={app:'Goethe B2 Learning Studio',exportedAt:new Date().toISOString(),data:state};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`goethe-b2-progress-${todayBerlin()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Резервная копия сохранена');}
  document.getElementById('restore-input').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>1024*1024){toast('JSON слишком большой (максимум 1 МБ)');return;}
    try{
      const doc=JSON.parse(await file.text());if(doc?.app!=='Goethe B2 Learning Studio'||doc.data?.version!==1)throw Error('Неподходящий файл');
      const v=doc.data;
      const allowed=new Set(DATA.tasks.map(t=>t.id));
      const tasks=Object.fromEntries(Object.entries(v.tasks||{}).filter(([id,x])=>allowed.has(id)&&x&&typeof x==='object').map(([id,x])=>[id,{done:!!x.done,checked:!!x.checked,repeated:!!x.repeated}]));
      const notes=Object.fromEntries(Object.entries(v.notes||{}).filter(([id,x])=>allowed.has(id)&&typeof x==='string').map(([id,x])=>[id,x.slice(0,3000)]));
      const scores=Object.fromEntries(Object.entries(v.scores||{}).filter(([k,x])=>['lesen','hoeren','schreiben','sprechen'].includes(k)&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=60).map(([k,x])=>[k,Number(x)]));
      const learned=Array.isArray(v.learned)?v.learned.filter(n=>Number.isInteger(n)&&n>=0&&n<DATA.phrases.length):[];
      if(!confirm('Заменить текущие локальные данные содержимым резервной копии?'))return;
      state={...structuredClone(DEFAULT),tasks,notes,scores,learned,theme:state.theme};persist();setTheme();rerenderKeepPosition();toast('Прогресс восстановлен');
    }catch(err){toast('Не удалось прочитать резервную копию JSON');console.warn('Backup import error',err.message);}
  });
  document.getElementById('theme-switch').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';persist();setTheme();});
  document.getElementById('today-date').textContent=new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'long',timeZone:'Europe/Berlin'}).format(new Date());
  window.addEventListener('hashchange',()=>render());
  setTheme();render();
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}));
})();
