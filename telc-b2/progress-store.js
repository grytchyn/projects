/* Storage format v1 is shared with the original application. */
(function () {
  'use strict';

  function create(data) {
    const key = data.storageKey;
    const previousKey = key + '-before-replace';
    const skills = ['lesen', 'hoeren', 'schreiben', 'sprechen'];
    const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const has = (obj, prop) => Object.hasOwn(obj, prop);
    const score = n => Number.isFinite(n) && n >= 0 && n <= 60;
    const scoreMap = value => record(value) && Object.entries(value).every(([k, n]) => skills.includes(k) && score(n));
    const dated = (map, valid) => record(map) && Object.entries(map).every(([id, value]) => /^\d{4}-\d{2}-\d{2}$/.test(id) && valid(value));
    const steps = ['done', 'checked', 'repeated'];
    const flags = value => record(value) && Object.entries(value).every(([s, v]) => (steps.includes(s) ? typeof v === 'boolean' : true));
    const text = length => value => typeof value === 'string' && value.length <= length;
    const attempt = value => record(value) && /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
      scoreMap(value.scores) && skills.every(skill => has(value.scores, skill));

    function empty() {
      return {version: 1, tasks: {}, notes: {}, minutes: {}, errors: {}, scores: {}, learned: [],
        reviews: {}, attempts: [], theme: 'light', updatedAt: ''};
    }

    function validate(value) {
      // Both historical exporters wrote these four sections, even for an empty journal.
      if (!record(value) || value.version !== 1 || !dated(value.tasks, flags) ||
          !dated(value.notes, text(3000)) || !scoreMap(value.scores) ||
          !Array.isArray(value.learned) || !value.learned.every(i => Number.isInteger(i) && i >= 0 && i < data.phrases.length) ||
          (has(value, 'theme') && !['light', 'dark'].includes(value.theme)) ||
          (has(value, 'updatedAt') && typeof value.updatedAt !== 'string') ||
          (has(value, 'minutes') && !dated(value.minutes, n => Number.isInteger(n) && n >= 0 && n <= 999)) ||
          (has(value, 'errors') && !dated(value.errors, text(240))) ||
          (has(value, 'reviews') && !dated(value.reviews, v => ['corrected', 'retested'].includes(v))) ||
          (has(value, 'attempts') && !(Array.isArray(value.attempts) && value.attempts.every(attempt)))) {
        throw new Error('Неподдерживаемая версия или повреждённые записи.');
      }
      return {...empty(), ...value, learned: [...new Set(value.learned)]};
    }

    function backupData(doc) {
      if (!record(doc) || ![data.examName, 'telc B2 Beruf Lernstudio', 'Goethe B2 Learning Studio'].includes(doc.app)) {
        throw new Error('Файл не является резервной копией этого приложения.');
      }
      return validate(doc.data);
    }

    function readSource() {
      const current = localStorage.getItem(key);
      if (current !== null) return {key, raw: current};
      return {key: data.legacyStorageKey, raw: localStorage.getItem(data.legacyStorageKey)};
    }

    function decode(source) {
      return source.raw === null ? empty() : validate(JSON.parse(source.raw));
    }

    function exclusive(work) {
      // All read/modify/write work in the callback is synchronous.
      if (navigator.locks) return navigator.locks.request(key, work);
      return Promise.resolve().then(work);
    }

    function migrate() {
      return exclusive(() => {
        const source = readSource();
        if (source.key !== key && source.raw !== null) {
          decode(source);
          localStorage.setItem(key, source.raw);
        }
      });
    }

    function write(value) {
      const next = {...value, updatedAt: new Date().toISOString()};
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    }

    function update(changes) {
      return exclusive(() => {
        const fresh = decode(readSource());
        for (const change of changes) change(fresh);
        return write(fresh);
      });
    }

    function replace(value, expected) {
      return exclusive(() => {
        const current = readSource();
        if (current.key !== expected.key || current.raw !== expected.raw) {
          throw new Error('Данные изменились в другой вкладке. Повторите действие.');
        }
        // Keep the last source intact, even if it is unreadable. Abort if the copy cannot be stored.
        const next = validate(value);
        const previous = localStorage.getItem(previousKey);
        if (current.raw !== null) localStorage.setItem(previousKey, current.raw);
        try {
          return write(next);
        } catch (err) {
          if (previous === null) localStorage.removeItem(previousKey);
          else localStorage.setItem(previousKey, previous);
          throw err;
        }
      });
    }

    return {empty, readSource, decode, backupData, migrate, update, replace, previous: () => localStorage.getItem(previousKey)};
  }
  window.TELC_B2_STORE = {create};
})();
