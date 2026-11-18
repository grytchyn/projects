const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(hash) {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      id, innerHTML: '', textContent: '', hidden: true, dataset: {}, style: {},
      setAttribute() {}, removeAttribute() {}, addEventListener() {}, classList: {toggle() {}},
      querySelector() {return {textContent:'',hidden:true,focus() {}}}, querySelectorAll() {return []},
      focus() {}, scrollIntoView() {},
    });
    return nodes.get(id);
  }
  const data = new Map();
  const localStorage = {getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v)};
  const document = {
    getElementById: node, querySelectorAll() {return []}, addEventListener() {},
    documentElement: {dataset: {}},
  };
  const location = {hash, protocol:'file:'};
  const context = vm.createContext({
    window: {addEventListener() {}, scrollTo() {}, scrollY:0}, document, location, localStorage,
    navigator: {}, Intl, URLSearchParams, URL, Date, Object, Number, Math, Set,
    structuredClone, setTimeout: () => 0, clearTimeout() {}, history: {replaceState() {}}
  });
  for (const name of ['data.js','weeks.js','extra.js','progress-store.js','app.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../../telc-b2',name),'utf8'),context);
  }
  return {html: node('app-main').innerHTML, nodes, data};
}

test('Главный экран открывает сегодняшнее задание', () => {
  const {html} = load('#home');
  assert.match(html,/Продолжить обучение/);
  assert.match(html,/#week\?num=1&day=2026-11-18/);
  assert.match(html,/Здравствуй, Настя/);
});

test('Все пять недель рендерятся с упражнениями и переходом к журналу', () => {
  for (let week=1;week<=5;week++) {
    const {html} = load('#week?num='+week);
    assert.match(html,/Подсказка и речевые опоры/);
    assert.match(html,/Письмо клиента/);
    assert.match(html,/Журнал этой недели/);
    assert.doesNotMatch(html,/СОДЕРЖАНИЕ:|WEEKLY CHECKPOINT/);
    assert.equal((html.match(/class="study-day panel"/g)||[]).length, week===5?6:7);
  }
});

test('Журнал и тренировка дают нужные поля', () => {
  const journal = load('#progress?week=1').html;
  assert.match(journal,/Записать пробник в историю/);
  assert.match(journal,/CSV всех 33 дней/);
  assert.match(journal,/Ошибки для повторения/);
  assert.match(load('#practice').html,/Вопрос партнёра/);
});
