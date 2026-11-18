/* telc B2 Beruf Learning Studio
   Standalone, dependency-free, local-first personal study dashboard.
   No credentials, analytics, external scripts or backend. */
(() => {
  'use strict';
  const DATA = window.TELC_B2_DATA;
  if (!DATA) throw new Error('Study plan data missing');
  const MAIN = document.getElementById('app-main');
  const store = window.TELC_B2_STORE.create(DATA);
  const pending = [];
  let saving = null;
  let locked = false;
  let state = store.empty();
  const skills = [['lesen','Lesen'],['hoeren','Hören'],['schreiben','Schreiben'],['sprechen','Sprechen']];
  const ui = { week: chooseCurrentWeek(), reportWeek: String(chooseCurrentWeek()), phrase: 0, reveal: false, question: -1, openNotes: new Set() };
  const timer = { preset: 120, remaining: 120, running: false, deadline: 0, interval: null };

  function notice(message) {
    const box = document.getElementById('storage-notice');
    box.hidden = !message;
    box.querySelector('span').textContent = message;
    box.querySelector('[data-action="raw"]').hidden = !locked;
    box.querySelector('[data-action="retry"]').hidden = locked;
  }
  function readStorage() {
    try {
      const source = store.readSource();
      state = store.decode(source);
      locked = false;
      notice('');
      return source;
    } catch {
      locked = true;
      notice('Не удалось прочитать прогресс. Запись приостановлена. Можно скачать исходные данные или восстановить JSON в разделе «Мой прогресс».');
      return null;
    }
  }
  function flush() {
    if (saving) return saving;
    if (!pending.length) return Promise.resolve(true);
    const batch = pending.slice();
    saving = store.update(batch).then(fresh => {
      pending.splice(0, batch.length);
      state = fresh;
      pending.forEach(change => change(state));
      notice('');
      return true;
    }).catch(() => {
      notice('Изменения пока только в этой вкладке. Повторите сохранение или скачайте JSON перед закрытием.');
      return false;
    }).then(ok => {
      saving = null;
      return ok && pending.length ? flush() : ok;
    });
    return saving;
  }
  function edit(change) {
    if (locked) return;
    change(state);
    pending.push(change);
    return flush();
  }
  function field(map, id, value) {
    edit(next => {
      if (value === null) delete next[map][id];
      else next[map][id] = value;
    });
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
    const next=t?`<article class="task-compact"><div class="task-compact-heading"><span class="badge">${t.id===todayBerlin()?'СЕГОДНЯ':t.id>todayBerlin()?'СЛЕДУЮЩЕЕ ЗАДАНИЕ':'НЕЗАВЕРШЕНО'}</span><span class="badge badge-neutral">${shortDate(t.id)}</span></div><h3>${e(t.title)}</h3><p>${e(t.detail)}</p><div class="task-actions"><a href="#week?num=${t.week}&day=${t.id}" class="btn btn-sm">${icon('calendar')} Продолжить обучение</a><a href="#plan?week=${t.week}&task=${t.id}" class="btn btn-quiet btn-sm">В плане</a></div></article>`
      :`<article class="task-compact"><span class="badge">ВСЕ ЗАДАНИЯ ОТМЕЧЕНЫ</span><h3>33 из 33 ✓</h3><p>Теперь можно повторять слабые темы и проверять результат пробниками.</p></article>`;
    const quick = [
      ['edit','Schreiben','Письма и форум',DATA.links.writing],
      ['mic','Sprechen','Монолог и диалоги',DATA.links.speaking],
      ['book','LexDeutsch','Премиум-тренажёр',DATA.links.lex],
      ['chart','Журнал','Баллы и анализ ошибок','#progress']
    ].map(([ic,name,desc,url])=>`<a class="quick-card" href="${url}" ${url.startsWith("#")?"":'target="_blank" rel="noopener noreferrer"'}><div class="quick-head">${icon(ic,'icon-lg')}${icon('arrow','icon-xs')}</div><strong>${name}</strong><span>${desc}</span></a>`).join('');
    const perWeek=DATA.weeks.map(w=>{const m=taskStats(w.id);return `<div class="week-mini-row"><strong>${String(w.id).padStart(2,'0')}</strong>${progressBar(m.percent)}<span>${m.done}/${m.total}</span></div>`}).join('');
    return `${header('ЛИЧНЫЙ КАБИНЕТ','Здравствуй, Настя!','Меньше поиска, больше практики. Все задания и материалы — в одном месте.')}
      <section class="hero" aria-labelledby="hero-title"><div><div class="hero-label">ТВОЙ ЭКЗАМЕН · telc B2 Beruf</div><h2 id="hero-title">${title}</h2><p>${subtitle}</p><div class="hero-actions"><a href="${t ? `#week?num=${t.week}&day=${t.id}` : '#progress'}" class="btn">${icon('calendar')} ${t ? 'Открыть задание' : 'Открыть журнал'}</a><a href="#practice" class="btn btn-hero-quiet">${icon('clock')} Начать тренировку</a></div></div><div class="countdown" aria-label="${Math.max(left,0)} календарных дней до экзамена" style="background:conic-gradient(#b6e7ca ${Math.min(100,Math.max(0,Math.round((34-Math.max(0,left))/34*100)))}%,rgba(255,255,255,.15) 0)"><div class="countdown-inner"><span class="countdown-num">${Math.max(left,0)}</span><span class="countdown-caption">дней</span></div></div></section>
      <div class="home-grid"><div class="stack"><section class="panel panel-pad">${sectionHead('Твоя следующая тренировка','<a class="text-link" href="#plan">Все 33 дня →</a>')}${next}</section>
      <section class="panel panel-pad">${sectionHead('Маршрут из пяти недель','<a class="text-link" href="#plan">Открыть план →</a>')}<div class="progress-line"><div class="small-ring" style="background:conic-gradient(var(--accent) ${stats.percent}%,var(--panel-soft) 0)"><span>${stats.percent}%</span></div><div><strong style="font-size:15px">${stats.done} из ${stats.total} заданий</strong><p style="font-size:12px;color:var(--muted);margin:5px 0">Отмечено как «сделано». Проверка и повтор считаются отдельно.</p></div></div><div class="week-mini">${perWeek}</div></section></div>
      <div class="stack"><section class="panel panel-pad">${sectionHead('Открыть и учиться')}<div class="quick-grid">${quick}</div></section>
      <section class="panel panel-pad">${sectionHead('Одна привычка сегодня')}<p class="section-note" style="font-size:13px;line-height:1.65;margin:0 0 16px">Напиши собственный ответ, проверь все пункты задания и повтори исправленный вариант через 1–2 дня. Для Sprechen — запись голоса и вопрос партнёру.</p><a href="#practice" class="text-link">Таймер и Redemittel ${icon('chevron','icon-xs')}</a></section></div></div>`;
  }
  function renderTask(t) {
    const s=tstate(t.id),w=weekForTask(t);
    const isCheckpoint=t.kind.toLowerCase().includes('checkpoint');
    const note=typeof state.notes[t.id]==='string'?state.notes[t.id]:'';
    return `<article class="task-card ${s.done?'task-card-completed':''}" id="day-${t.id}" tabindex="-1">
      <div class="task-top"><span class="task-date">${e(shortDate(t.id).toUpperCase())}</span><span class="task-kind">${e(t.kind)}</span></div>
      <h3>${e(t.title)}</h3><p class="desc">${e(t.detail)}</p>
      <div class="task-foot"><div class="task-sources">${icon('book','icon-xs')} <span>${isCheckpoint?'Контрольный день':`PDF: стр. ${e(t.pages)}`}</span><span>·</span>${icon('clock','icon-xs')}<span>${t.duration} мин</span></div><a class="text-link" href="#week?num=${w.id}&day=${t.id}">Полное задание ${icon('arrow','icon-xs')}</a></div>
      <div class="mini-checks">${stageControl(t,'done','Сделано')}${stageControl(t,'checked','Проверено')}${stageControl(t,'repeated','Повторено')}<button class="notes-toggle" type="button" data-notes-toggle="${t.id}" aria-expanded="${ui.openNotes.has(t.id)}">${icon('edit','icon-xs')} Заметка</button></div>
      <div class="task-note ${ui.openNotes.has(t.id)?'open':''}" id="note-${t.id}"><textarea data-note="${t.id}" aria-label="Заметки по задаче ${e(t.title)}" maxlength="3000" placeholder="Ошибки, полезные слова, что повторить завтра…">${e(note)}</textarea><small>Сохраняется в этом браузере автоматически.</small></div></article>`;
  }
  function renderPlan() {
    const w=DATA.weeks[ui.week-1],tasks=DATA.tasks.filter(t=>t.week===ui.week),m=taskStats(ui.week);
    const menu=DATA.weeks.map(x=>`<button class="week-tab ${ui.week===x.id?'active':''}" data-week="${x.id}" aria-pressed="${ui.week===x.id}">${String(x.id).padStart(2,'0')} · ${e(x.short)}</button>`).join('');
    return `${header('33 ДНЯ · 5 ЭТАПОВ','План обучения','Выбирай неделю, выполняй задания с таймером и отмечай этапы. Все пункты взяты из вашей таблицы Google Sheets.','<a class="btn btn-secondary" href="#progress">Журнал на сайте</a>')}
      <div class="week-picker" role="group" aria-label="Выбрать неделю">${menu}</div>
      <section class="panel panel-pad"><div class="week-summary"><div><span class="badge">НЕДЕЛЯ ${w.id}</span><h2 style="font-size:22px;letter-spacing:-.03em;margin:10px 0 3px">${e(w.focus)}</h2><p>${e(w.label)} · ${e(w.goal)}</p></div><div class="week-progress"><div style="display:flex;justify-content:space-between;font-size:12px;margin:0 0 9px"><strong>Выполнено</strong><span>${m.done} / ${m.total}</span></div>${progressBar(m.percent)}</div></div><div class="task-list">${tasks.map(renderTask).join('')}</div><aside class="checkpoint"><strong>${icon('check','icon-xs')} Чекпоинт недели</strong><p>${e(w.checkpoint)}</p><a class="btn btn-secondary btn-sm" href="#week?num=${w.id}">Полный план на сайте →</a></aside></section>`;
  }
  function renderWeek(){return window.TELC_B2_EXTRA.renderWeek({DATA,ui,state,header,progressBar,taskStats,stageControl,shortDate,ext,params:routeInfo().params});}
  function renderJournal(){return window.TELC_B2_EXTRA.renderJournal({DATA,ui,state,stageControl});}
  function exportCSV(){window.TELC_B2_EXTRA.exportCSV(DATA,state,tstate,todayBerlin);toast('CSV сохранён');}
  const questions = [
    'Können Sie ein Beispiel aus Ihrem Arbeitsalltag nennen?',
    'Was würden Sie beim nächsten Mal anders machen?',
    'Wie würden Sie das einer neuen Kollegin erklären?',
    'Welche andere Lösung wäre in Ihrem Betrieb möglich?',
    'Welche Rolle spielt die Zusammenarbeit in Ihrem Beispiel?'
  ];
  function showSpeakingQuestion() {
    const choices = questions.map((_, i) => i).filter(i => i !== ui.question);
    ui.question = choices[Math.floor(Math.random() * choices.length)];
    document.getElementById('speaking-question').textContent = questions[ui.question];
  }
  function renderPractice() {
    const phrase=DATA.phrases[ui.phrase%DATA.phrases.length];const learned=state.learned.includes(ui.phrase);
    return `${header('SCHREIBEN + SPRECHEN','Практика B2','Работаем именно с двумя приоритетными навыками. Пиши собственные тексты и тренируй устную реакцию.',ext(DATA.links.lex,'LexDeutsch Premium'))}
      <div class="module-grid"><section class="panel module-card"><div class="module-mark">${icon('edit','icon-lg')}</div><span class="badge">ПРИОРИТЕТ №1</span><h3 style="margin-top:11px">Schreiben</h3><p>Письма, форум и телефонная заметка.</p><ul class="module-list"><li>Beschwerde: понять поручение начальника</li><li>Forumsbeitrag: мнение, аргументы, решение</li><li>Контроль времени и проверка ошибок</li></ul><div class="task-actions">${ext(DATA.links.writing,'Схемы и задания','btn btn-sm')}${ext(DATA.links.lexComplaint,'Жалобы','btn btn-secondary btn-sm')}</div></section>
      <section class="panel module-card"><div class="module-mark">${icon('mic','icon-lg')}</div><span class="badge">ПРИОРИТЕТ №2</span><h3 style="margin-top:11px">Sprechen</h3><p>Восемь тем презентации и реальные диалоги.</p><ul class="module-list"><li>Teil 1: 2 минуты без чтения текста</li><li>Teil 2: поддержать Smalltalk</li><li>Teil 3: предложить решение и договориться</li></ul><div class="task-actions">${ext(DATA.links.speaking,'8 тем и диалоги','btn btn-sm')}${ext(DATA.links.lexSpeak,'Тренажёр','btn btn-secondary btn-sm')}</div><div class="speaking-prompt"><button type="button" class="btn btn-secondary" data-action="question">Вопрос партнёра</button><p lang="de" id="speaking-question" aria-live="polite">${e(questions[ui.question] || '')}</p></div></section></div>
      <div class="practice-bottom"><section class="panel panel-pad">${sectionHead('Учебный таймер','<span class="badge badge-neutral">Без отвлечений</span>')}<p class="section-note">Выбери длительность под тип задания.</p><div class="pill-picker" role="group" aria-label="Длительность таймера">${[[120,'2 мин · Vortrag'],[1200,'20 мин · E-Mail'],[1800,'30 мин · Forum']].map(([s,label])=>`<button class="pill-button ${timer.preset===s?'selected':''}" data-preset="${s}" aria-pressed="${timer.preset===s}">${label}</button>`).join('')}</div><div class="timer-clock" id="timer-clock" role="timer" aria-live="off">${timeString(timer.remaining)}</div><div class="timer-actions"><button id="timer-play" type="button" class="btn" data-action="timer-toggle">${icon(timer.running?'pause':'play')} ${timer.running?'Пауза':'Начать'}</button><button type="button" class="btn btn-quiet" data-action="timer-reset">${icon('reset')} Сброс</button></div></section>
      <section class="panel panel-pad">${sectionHead('Redemittel — тренажёр',`<span class="badge badge-neutral">${state.learned.length}/${DATA.phrases.length} выучено</span>`)}<div class="flip-card"><small>${e(phrase.type)} · ${ui.phrase+1} / ${DATA.phrases.length}</small><strong>${e(phrase.de)}</strong>${ui.reveal?`<p class="flip-translation">${e(phrase.ru)}</p>`:''}</div><div class="card-bottom"><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" data-action="flash-reveal">${ui.reveal?'Скрыть':'Перевод'}</button><button class="btn btn-secondary btn-sm" data-action="flash-next">Дальше ${icon('chevron','icon-xs')}</button></div><button class="btn btn-sm ${learned?'btn-quiet':'btn-secondary'}" data-action="flash-learn">${icon('check','icon-xs')} ${learned?'Выучено':'Выучить'}</button></div></section></div>`;
  }
  const resources = [
    ['book','00 · С чего начать','Навигатор и правила подготовки.',DATA.links.homeDoc],
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
    const parts=skills;
    const inp=parts.map(([id,name])=>`<label><span class="score-label">${name}<small>22.08 · ${DATA.baseline[id].toLocaleString('ru-RU')}/60</small></span><input class="score-input" type="text" data-score="${id}" inputmode="decimal" placeholder="__/60" value="${Number.isFinite(Number(state.scores[id]))&&state.scores[id]!==''&&state.scores[id]!=null?e(state.scores[id]):''}"></label>`).join('');
    return `${header('ДАННЫЕ В ЭТОМ БРАУЗЕРЕ','Мой прогресс','Чек-листы и оценки сохраняются автоматически. Перед очисткой браузера сделай резервную копию.',ext(DATA.links.tracking,'Google Sheets'))}
    <div class="stats-grid"><div class="stat"><span class="big">${st.done}<span style="font-size:15px;color:var(--muted)"> / 33</span></span><span class="label">Заданий выполнено</span></div><div class="stat"><span class="big">${reviewed}</span><span class="label">Проверены</span></div><div class="stat"><span class="big">${repeated}</span><span class="label">Повторены</span></div></div>
    <div class="progress-layout"><div class="stack"><section class="panel panel-pad">${sectionHead('Прогресс по неделям')}<div>${w}</div><a class="text-link" href="#plan">Перейти к заданиям ${icon('chevron','icon-xs')}</a></section>
    <section class="panel panel-pad">${sectionHead('Баллы пробного экзамена','<span class="badge badge-neutral">Тренировка</span>')}<p class="section-note">Вноси четыре балла за один вариант. Оценки письма и речи бери из проверки преподавателя.</p><div class="score-grid">${inp}</div><p class="score-meta">Личные ориентиры из плана: Schreiben 42–45, Sprechen 45 из 60.</p><div id="score-result" aria-live="polite">${scoreResultHTML()}</div><button class="btn btn-secondary" data-action="archive" ${completeScores()?'':'disabled'}>Записать пробник в историю</button>${attemptHistory()}</section></div>
    <div class="stack"><section class="panel panel-pad">${sectionHead('Резервная копия',`<span class="badge badge-neutral">${icon('shield','icon-xs')} На устройстве</span>`)}<p class="section-note" style="line-height:1.7;margin:0 0 15px">Данные не уходят на сервер. Экспортируй JSON после каждой недели, чтобы сохранить отметки и заметки.</p><div class="backup-actions"><button class="btn btn-secondary btn-sm" data-action="export">${icon('download')} Скачать JSON</button><button class="btn btn-quiet btn-sm" data-action="import">${icon('upload')} Восстановить</button></div><p class="backup-note">На другом устройстве прогресс появится только после ручного импорта файла. Google Sheets автоматически не обновляется.</p><button class="text-link recovery-link" data-action="previous">Скачать копию до последней замены</button><div class="danger-zone"><button class="btn btn-danger btn-sm" data-action="erase">Сбросить данные на этом устройстве</button></div></section>
    <section class="panel panel-pad">${sectionHead('Как оценивать честно')}<p class="section-note" style="line-height:1.7;margin:0 0 13px">Сверь название экзамена с приглашением Berlitz. Для DTB B2 минимальный суммарный результат — 144/240, но дополнительно нужны три части не ниже 36/60 и четвёртая не ниже 24/60. Не заполняй Schreiben/Sprechen произвольной оценкой — лучше по проверке преподавателя.</p>${ext(DATA.links.model,'Официальный пробник BAMF и telc','text-link')}</section></div></div>${renderJournal()}<section class="panel panel-pad journal-panel" aria-labelledby="review-title"><h2 class="section-title" id="review-title">Ошибки для повторения</h2><div id="review-list"></div></section>`;
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

  function routeInfo(){const raw=(location.hash||'#home').replace(/^#/,'');const [name,query='']=raw.split('?');const route=['home','plan','week','practice','library','progress'].includes(name)?name:'home';const params=new URLSearchParams(query);return{route,params};}
  function render(resetScroll=true){
    const {route,params}=routeInfo();
    if(route==='plan'){const n=Number(params.get('week'));if(Number.isInteger(n)&&n>=1&&n<=5)ui.week=n;}
    if(route==='week'){const n=Number(params.get('num'));if(Number.isInteger(n)&&n>=1&&n<=5)ui.week=n;}
    if(route==='progress' && (params.get('week')==='all' || DATA.weeks.some(w=>String(w.id)===params.get('week'))))ui.reportWeek=params.get('week');
    MAIN.innerHTML=({home:renderHome,plan:renderPlan,week:renderWeek,practice:renderPractice,library:renderLibrary,progress:renderProgress}[route])();
    for(const link of document.querySelectorAll('[data-nav]')){const yes=link.dataset.nav===(route==='week'?'plan':route);link.classList.toggle('active',yes);if(yes)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    document.getElementById('current-section').textContent={home:'Главная',plan:'План обучения',week:'Неделя '+ui.week,practice:'Практика B2',library:'Библиотека',progress:'Мой прогресс'}[route];
    document.title={home:'Главная',plan:'План',week:'Неделя '+ui.week,practice:'Практика',library:'Библиотека',progress:'Прогресс'}[route]+' · telc B2 Beruf';
    if (locked) MAIN.querySelectorAll('[data-task],[data-note],[data-score],[data-minutes],[data-error],[data-review],[data-action="flash-learn"],[data-action="archive"],[data-action="erase"]').forEach(el => el.disabled = true);
    if (resetScroll) {
      const day = route === 'week' ? params.get('day') : route === 'plan' ? params.get('task') : null;
      const target = route === 'progress' && params.has('entry') ? document.getElementById('entry-' + params.get('entry')) : day && document.getElementById('day-' + day);
      if (target) {
        target.focus({preventScroll: true});
        target.scrollIntoView({behavior: 'instant', block: 'start'});
      } else {
        window.scrollTo({top: 0, behavior: 'instant'});
      }
    }
    if(route==='practice')timerUpdate();
    if(route==='progress')updateJournal();
  }
  let toastTimeout;
  function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.hidden=true,3400);}
  function rerenderKeepPosition() {
    const top = window.scrollY;
    const open = [...MAIN.querySelectorAll('details')].map(el => el.open);
    const active = document.activeElement;
    const attrs = [...(active?.attributes || [])].filter(a => a.name.startsWith('data-'));
    const selector = attrs.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('');
    render(false);
    MAIN.querySelectorAll('details').forEach((el, i) => { el.open = !!open[i]; });
    if (selector) MAIN.querySelector(selector)?.focus({preventScroll: true});
    window.scrollTo({top, behavior: 'instant'});
  }
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
      case 'flash-learn': {
        const id = ui.phrase, learn = !state.learned.includes(id);
        edit(next => { next.learned = next.learned.filter(n => n !== id); if (learn) next.learned.push(id); });
        rerenderKeepPosition(); break;
      }
      case 'question': showSpeakingQuestion(); break;
      case 'archive': archiveAttempt(); break;
      case 'retry': if (pending.length) flush(); else location.reload(); break;
      case 'raw': downloadSource(); break;
      case 'previous': downloadPrevious(); break;
      case 'csv':exportCSV();break;
      case 'export':exportBackup();break;
      case 'import':document.getElementById('restore-input').click();break;
      case 'erase': replaceData(store.empty(), 'Сбросить записи на этом устройстве? Предыдущую версию можно будет скачать в разделе резервных копий.', 'Локальный прогресс сброшен'); break;
    }
  });
  document.addEventListener('change',event=>{
    if(event.target.matches('select[data-report-week]')){ui.reportWeek=event.target.value;history.replaceState(null,'','#progress?week='+ui.reportWeek);rerenderKeepPosition();return;}
    const el = event.target;
    if (el.matches('[data-task][data-step]')) {
      const {task: id, step} = el.dataset, checked = el.checked;
      if (!DATA.tasks.some(t => t.id === id) || !['done','checked','repeated'].includes(step)) return;
      edit(next => { next.tasks[id] = {...next.tasks[id], [step]: checked}; });
      rerenderKeepPosition();
    } else if (el.matches('[data-review]')) {
      field('reviews', el.dataset.review, el.value || null);
      updateJournal();
    } else if (el.matches('[data-minutes],[data-score]')) {
      const isTime = el.hasAttribute('data-minutes');
      const map = isTime ? 'minutes' : 'scores';
      const id = isTime ? el.dataset.minutes : el.dataset.score;
      const raw = el.value.trim().replace(',', '.');
      const number = Number(raw);
      if (el.validity.badInput || (raw && (!/^(?:\d+|\d*\.\d+)$/.test(raw) || !Number.isFinite(number) || number < 0 ||
          number > (isTime ? 999 : 60) || (isTime && !Number.isInteger(number))))) {
        el.value = state[map][id] ?? '';
        toast(isTime ? 'Введите целое число от 0 до 999. Прежнее время сохранено.' : 'Введите балл от 0 до 60. Прежний балл сохранён.');
        return;
      }
      field(map, id, raw === '' ? null : number);
      if (isTime) updateJournal(); else updateScoreResult();
    }
  });
  document.addEventListener('input',event=>{
    const el = event.target;
    if (el.matches('[data-error]')) {
      const id = el.dataset.error, value = el.value;
      edit(next => {
        if (next.errors[id] !== value) delete next.reviews[id];
        next.errors[id] = value;
      });
      updateJournal();
    } else if (el.matches('textarea[data-note]')) {
      field('notes', el.dataset.note, el.value);
    }
  });
  function completeScores() {
    return skills.every(([key]) => Number.isFinite(state.scores[key]));
  }
  async function archiveAttempt() {
    if (!completeScores() || !(await flush())) return;
    const scores = {...state.scores}, date = todayBerlin();
    try {
      state = await store.update([next => {
        if (!skills.every(([key]) => scores[key] === next.scores[key])) throw new Error('changed');
        next.attempts.push({date, scores});
        next.scores = {};
      }]);
      rerenderKeepPosition();
      toast('Пробник записан. Поля готовы для следующего варианта.');
    } catch { toast('Пробник не записан. Проверьте доступ к памяти и баллы в другой вкладке.'); }
  }
  function attemptHistory() {
    if (!state.attempts.length) return '<p class="section-note">В истории пока нет проверенных пробников.</p>';
    const rows = [...state.attempts].reverse().map(entry => {
      const values = skills.map(([key, label]) => label+' '+entry.scores[key].toLocaleString('ru-RU')+'/60');
      return '<li><strong>'+e(ruDate(entry.date))+'</strong> · '+values.join(' · ')+'</li>';
    });
    return '<h3>История пробников</h3><ol class="attempts">'+rows.join('')+'</ol>';
  }
  function updateScoreResult() {
    const box = document.getElementById('score-result');
    if (!box) return;
    box.innerHTML = scoreResultHTML();
    const archive = MAIN.querySelector('[data-action="archive"]');
    if (archive) archive.disabled = locked || !completeScores();
  }
  function updateJournal() {
    const total = document.getElementById('journal-total');
    if (!total) return;
    const tasks = DATA.tasks.filter(t => ui.reportWeek === 'all' || String(t.week) === ui.reportWeek);
    const timed = tasks.filter(t => Object.hasOwn(state.minutes, t.id));
    total.textContent = 'Записано минут: '+timed.reduce((sum,t) => sum + state.minutes[t.id], 0)+'. Дней с записью времени: '+timed.length+' из '+tasks.length+'.';
    for (const el of MAIN.querySelectorAll('[data-review]')) {
      const id = el.dataset.review;
      el.disabled = locked || !state.errors[id]?.trim();
      el.value = state.reviews[id] || '';
    }
    const queue = DATA.tasks.filter(t => state.errors[t.id]?.trim() && state.reviews[t.id] !== 'retested');
    document.getElementById('review-list').innerHTML = queue.length ?
      '<p class="section-note">Ошибки за все недели. Сделай новую попытку без подсказки и отметь результат в журнале этого дня.</p><ul>'+queue.map(t =>
        '<li><a class="text-link" href="#progress?week='+t.week+'&amp;entry='+t.id+'">'+e(shortDate(t.id))+'</a> · '+e(state.errors[t.id])+' · '+(state.reviews[t.id]==='corrected'?'проверить ещё раз':'исправить')+'</li>').join('')+'</ul>' :
      '<p class="section-note">Здесь появятся записанные в журнале ошибки, которым нужна новая попытка.</p>';
  }
  function download(content, name) {
    const url = URL.createObjectURL(new Blob([content], {type: 'application/json'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = `telc-b2-${name}-${todayBerlin()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function backup(value, name) {
    download(JSON.stringify({app: DATA.examName, exportedAt: new Date().toISOString(), data: value}, null, 2), name);
  }
  function downloadSource() {
    try {
      const raw = store.readSource().raw;
      if (raw !== null) download(raw, 'original'); else toast('Исходная запись отсутствует.');
    } catch { toast('Браузер не разрешил чтение данных.'); }
  }
  function downloadPrevious() {
    try {
      const raw = store.previous();
      if (raw === null) return toast('Копия появится после восстановления или сброса.');
      let value;
      try { value = store.decode({raw}); } catch { return download(raw, 'original'); }
      backup(value, 'previous');
    } catch { toast('Не удалось прочитать предыдущую копию.'); }
  }
  function exportBackup() {
    if (locked) return downloadSource();
    backup(state, 'progress');
    toast('JSON подготовлен к скачиванию');
  }
  async function replaceData(value, message, result) {
    if (!(await flush())) return;
    try {
      const expected = store.readSource();
      if (!confirm(message)) return;
      state = await store.replace(value, expected);
      locked = false;
      notice('');
      setTheme();
      rerenderKeepPosition();
      toast(result);
    } catch (err) {
      notice('Замена не выполнена. Если доступ к хранилищу восстановлен, повторите действие.');
      toast(err.message.includes('другой вкладке') ? err.message : 'Текущие записи сохранены.');
    }
  }
  document.getElementById('restore-input').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    let value;
    try { value = store.backupData(JSON.parse(await file.text())); }
    catch { return toast('Не удалось прочитать копию. Проверьте файл и версию. Текущие записи сохранены.'); }
    await replaceData(value, 'Заменить записи и тему данными из файла? Предыдущую версию можно будет скачать.', 'Прогресс восстановлен');
  });
  document.getElementById('theme-switch').addEventListener('click', () => {
    const theme = state.theme === 'dark' ? 'light' : 'dark';
    if (locked) state.theme = theme; else edit(next => { next.theme = theme; });
    setTheme();
  });
  window.addEventListener('storage', event => {
    if (![DATA.storageKey, DATA.legacyStorageKey, null].includes(event.key) || pending.length) return;
    readStorage();
    setTheme();
    // Leave an active editor and its caret in place. The next edit always reads the latest disk state.
    if (!locked && MAIN.contains(document.activeElement) && document.activeElement.matches('textarea, input:not([type="checkbox"])')) {
      updateScoreResult();
      updateJournal();
    } else rerenderKeepPosition();
  });
  window.addEventListener('beforeunload', event => {
    if (pending.length) { event.preventDefault(); event.returnValue = ''; }
  });
  const initialSource = readStorage();
  if (initialSource?.key === DATA.legacyStorageKey && initialSource.raw !== null) {
    store.migrate().catch(() => notice('Старая копия доступна. Браузер пока не разрешил сохранить её под новым именем.'));
  }
  document.getElementById('today-date').textContent=new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'long',timeZone:'Europe/Berlin'}).format(new Date());
  window.addEventListener('hashchange',()=>render());
  setTheme();render();
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}));
})();
