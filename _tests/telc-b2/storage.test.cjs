const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const items = new Map();
  const storage = {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => { items.set(key, value); },
    removeItem: key => items.delete(key)
  };
  const window = {};
  const ctx = vm.createContext({window, localStorage: storage, navigator: {}, Date, JSON});
  for (const name of ['data.js','weeks.js','progress-store.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../../telc-b2',name),'utf8'), ctx);
  }
  const data = window.TELC_B2_DATA;
  const store = window.TELC_B2_STORE.create(data);
  return {items, storage, data, store, id: data.tasks[0].id, key: data.storageKey, legacy: data.legacyStorageKey, weeks: window.TELC_B2_WEEKS};
}
const historical = {version: 1, tasks: {}, notes: {}, scores: {}, learned: [], theme: 'dark', updatedAt: ''};

test('Миграция исходного v1 побайтно сохраняет обе записи', async () => {
  const {items, store, legacy, key} = setup();
  const raw = JSON.stringify(historical);
  items.set(legacy, raw);
  await store.migrate();
  assert.equal(items.get(key), raw);
  assert.equal(items.get(legacy), raw);
  const state = store.decode(store.readSource());
  assert.equal(state.theme, 'dark');
  assert.equal(Object.keys(state.minutes).length, 0);
});

test('Повреждённый и более новый форматы защищены от фоновой перезаписи', async () => {
  const {items, store, key, legacy} = setup();
  items.set(legacy, JSON.stringify(historical));
  for (const raw of ['', '{', JSON.stringify({...historical, version: 2})]) {
    items.set(key, raw);
    await assert.rejects(store.update([s => {s.theme = 'light';}]));
    assert.equal(items.get(key), raw);
  }
  items.delete(key);
  items.set(legacy,'{');
  await assert.rejects(store.migrate());
  assert.equal(items.has(key),false);
});

test('Полный и оба исторических файла восстанавливаются без потери полей', async () => {
  const {store,id,data} = setup();
  const state = store.empty();
  Object.assign(state, {notes: {[id]:'Письмо\n„Angebot“'}, tasks:{[id]:{checked:true}}, errors:{[id]:'Kasus'},
    reviews:{[id]:'corrected'}, minutes:{[id]:0}, learned:[1], scores:{sprechen:37.5}, theme:'dark',
    attempts:[{date:id,scores:{lesen:42,hoeren:36,schreiben:25.5,sprechen:46}}]});
  for (const name of [data.examName,'telc B2 Beruf Lernstudio','Goethe B2 Learning Studio']) {
    const imported = store.backupData({app:name,data:structuredClone(state)});
    assert.equal(JSON.stringify(imported),JSON.stringify(state));
  }
  assert.equal(store.backupData({app:'Goethe B2 Learning Studio',data:historical}).theme, 'dark');
});

test('Неполные и неверно типизированные JSON отклоняются целиком', () => {
  const {id,store,data} = setup();
  const invalid = [{version:1},{...historical,tasks:[]},{...historical,tasks:{[id]:{done:'false'}}},
    {...historical,minutes:{[id]:-1}},{...historical,scores:{sprechen:null}},
    {...historical,notes:{[id]:123}},{...historical,learned:[999]}, {...historical,version:2}];
  for (const entry of invalid) assert.throws(()=>store.backupData({app:data.examName,data:entry}));
});

test('Замена сохраняет исходные байты и проверяет одновременное редактирование', async () => {
  const {items,key,store,id} = setup();
  items.set(key,'bad source');
  await store.replace(store.empty(),store.readSource());
  assert.equal(store.previous(),'bad source');
  const stale = store.readSource();
  await store.update([v => {v.notes[id]='Позднее изменение';}]);
  await assert.rejects(store.replace(store.empty(),stale));
  assert.equal(store.decode(store.readSource()).notes[id],'Позднее изменение');
});

test('Отказ записи оставляет текущие данные и предыдущую резервную копию', async () => {
  const {items,storage,key,store} = setup();
  const raw = JSON.stringify(historical);
  items.set(key, raw);
  items.set(key+'-before-replace','older copy');
  const write = storage.setItem;
  storage.setItem = (k,v) => {if (k === key) throw new Error('quota'); write(k,v);};
  await assert.rejects(store.update([v=>{v.theme='light';}]));
  await assert.rejects(store.replace(store.empty(),store.readSource()));
  assert.equal(items.get(key),raw);
  assert.equal(store.previous(),'older copy');
});

test('Независимые записи объединяются с актуальным состоянием', async () => {
  const {store,id} = setup();
  await Promise.all([store.update([v=>{v.notes[id]='Первый текст';}]),store.update([v=>{v.minutes[id]=37;}])]);
  const state=store.decode(store.readSource());
  assert.equal(state.minutes[id],37);
  assert.equal(state.notes[id],'Первый текст');
});

test('33 уникальных задания, пять недель и отдельный день экзамена', () => {
  const {data,weeks} = setup();
  const dates=weeks.flatMap(w=>w.days.map(d=>d.date));
  assert.equal(new Set(dates).size,34);
  assert.deepEqual(Array.from(dates),[...data.tasks.map(t=>t.id),data.examDate]);
  for (const w of weeks) {
    assert.ok(w.checkpoint);
    assert.ok(w.days.every(d=>d.blocks.some(b=>b.type==='hint') && d.blocks.some(b=>b.type==='body')));
    assert.ok(w.days[0].blocks.some(b=>b.type==='practice' && b.mail && b.brief));
  }
});
