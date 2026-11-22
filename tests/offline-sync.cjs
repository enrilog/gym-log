const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.join(__dirname, '..');
const day = '2026-11-21';
const food = { name: 'Arroz (100 g)', qty: 1, cal: 130, prot: 2.7, carb: 28, fat: 0.3 };
const exercise = { name: 'Remo cerrado en máquina', weight: 20, unit: 'kg', reps: '10, 8', status: '☑️' };

class Sheet {
  constructor(rows = []) { this.rows = rows.map(row => [...row]); }
  getLastRow() { return this.rows.length; }
  getDataRange() { return { getValues: () => this.rows.map(row => [...row]) }; }
  appendRow(row) {
    if (this.rejectNextAppend) {
      this.rejectNextAppend = false;
      throw new Error('Simulated failure recording receipt');
    }
    this.rows.push([...row]);
  }
  setFrozenRows() {}
  getRange(start, first, height = 1, width = 1) {
    const getValues = () => Array.from({ length: height }, (_, i) => Array.from({ length: width },
      (_, j) => this.rows[start - 1 + i]?.[first - 1 + j] ?? ''));
    const setValues = values => values.forEach((row, i) => {
      const current = this.rows[start - 1 + i] ||= [];
      row.forEach((value, j) => { current[first - 1 + j] = value; });
    });
    return { getValues, setValues, setValue: value => setValues([[value]]), setFontWeight() {} };
  }
}

const sheets = new Map([
  ['Nutricion_Registros', new Sheet([['Fecha', 'Alimento'], ...[food, food].map(item =>
    [day, item.name, item.qty, item.cal, item.prot, item.carb, item.fat])])]
]);
const spreadsheet = {
  getSheetByName: name => sheets.get(name),
  insertSheet: name => { const sheet = new Sheet(); sheets.set(name, sheet); return sheet; }
};
const backend = vm.createContext({
  SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush() {} },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { createTextOutput: output => ({ setMimeType: () => output }), MimeType: { JSON: 'json' } }
});
vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs.js'), 'utf8'), backend);
const get = (ids = []) => JSON.parse(backend.doGet({ parameter: { sync: '2', ids: ids.join(',') } }));
const post = operations => JSON.parse(backend.doPost({ postData: {
  contents: JSON.stringify({ type: 'sync', version: 2, operations })
} }));

async function testSync() {
  const snapshot = get();
  const [first, second] = snapshot.nutLogs[day];
  assert.notEqual(first.id, second.id);
  const memory = new Map([
    ['gym_cloud_nutrilogs', JSON.stringify({ [day]: [food, food] })],
    ['gym_sync_queue_v1', JSON.stringify([{ type: 'nutrition', date: day, payload: food }])]
  ]);
  const storage = {
    get length() { return memory.size; },
    key: index => [...memory.keys()][index],
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: key => memory.delete(key)
  };
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const frontend = vm.createContext({
    localStorage: storage, window: {}, navigator: { onLine: false }, crypto: webcrypto,
    URL, AbortController, setTimeout, clearTimeout
  });
  const run = script => vm.runInContext(script, frontend);
  run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  frontend.element = {};
  run(`var document = { getElementById: () => element };
    renderToday = renderExList = renderNut = renderWeight = renderDailyNutritionChart = renderProgressAndRanks = () => {};`);
  run('migrateLocalSync()');
  assert.equal(run('pendingOperations().length'), 1);
  assert.equal(run('pendingOperations()[0].payload.id'), second.id);
  assert.equal(run('Object.values(nutLogs).flat().length'), 2);
  run('migrateLocalSync()');
  assert.equal(run('pendingOperations().length'), 1);

  let allowWrite = false;
  let loseReply = false;
  let backendVersion = 2;
  frontend.fetch = async (url, options) => {
    if (options.method === 'POST') {
      assert.equal(options.mode, 'no-cors');
      assert.equal(options.headers['Content-Type'], 'text/plain;charset=utf-8');
      if (allowWrite) assert.equal(post(JSON.parse(options.body).operations).ok, true);
      if (loseReply) throw new Error('POST response lost after commit');
      return { type: 'opaque' };
    }
    const data = get(new URL(url).searchParams.get('ids').split(','));
    return { ok: true, json: async () => ({ ...data, syncVersion: backendVersion }) };
  };
  run('navigator.onLine = true');
  await run('syncWithSheets()');
  assert.equal(run('pendingOperations().length'), 1, 'opaque POST is never a receipt');
  backendVersion = 1;
  await run('syncWithSheets()');
  assert.equal(run('syncState'), 'outdated');
  assert.equal(run('pendingOperations().length'), 1);
  backendVersion = 2;
  allowWrite = loseReply = true;
  await run('syncWithSheets()');
  assert.equal(run('pendingOperations().length'), 0);
  assert.equal(get().nutLogs[day].length, 2, 'legacy retry keeps two distinct equal meals');

  frontend.day = day;
  run(`navigator.onLine = false;
    enqueue({ type: "nutrition", date: day, payload: { ...nutLogs[day][0], qty: 2, cal: 260 } });
    enqueue({ type: "nutrition", date: day, payload: nutLogs[day][1], deleted: true });
    enqueue({ type: "weight", payload: { date: day, weight: 67 } });
    enqueue({ type: "weight", payload: { date: day, weight: 67.5 } });`);
  assert.equal(run('nutLogs[day].length'), 1);
  assert.equal(run('pendingOperations().length'), 4);
  run('navigator.onLine = true');
  const inFlight = run('syncWithSheets()');
  assert.equal(run('syncWithSheets()'), inFlight);
  run('enqueue({ type: "weight", payload: { date: day, weight: 68 } })');
  await inFlight;
  assert.equal(run('pendingOperations().length'), 0);
  assert.deepEqual(get().nutLogs[day].map(item => [item.id, item.qty]), [[first.id, 2]]);
  assert.deepEqual(get().deletedFoodIds, [second.id]);
  assert.deepEqual(get().weights, [{ date: day, weight: 68 }]);
  frontend.oldCache = snapshot.nutLogs;
  frontend.server = get();
  assert.equal(run('mergeNutritionLogs(oldCache, server.nutLogs, server.deletedFoodIds)[day].length'), 1);

  const added = { id: 'food-test-123456', ...food };
  const operation = { type: 'nutrition', id: 'operation-test-123456', date: day, payload: added };
  sheets.get('Gym_Sync').rejectNextAppend = true;
  assert.equal(post([operation]).ok, false);
  assert.deepEqual(get([operation.id]).acknowledged, []);
  assert.equal(post([operation]).ok, true);
  assert.equal(post([operation]).ok, true);
  assert.deepEqual(get([operation.id]).acknowledged, [operation.id]);
  assert.equal(get().nutLogs[day].filter(item => item.id === added.id).length, 1);

  const workout = { date: day, split: 'Superior', exercises: [exercise] };
  assert.equal(post([{ type: 'workout', payload: workout, id: 'operation-workout-1' }]).ok, true);
  const updated = { ...workout, exercises: [{ ...exercise, weight: 22 }] };
  assert.equal(post([{ type: 'workout', payload: updated, id: 'operation-workout-2' }]).ok, true);
  assert.equal(get().workouts[0].exercises[0].weight, 22);
  assert.equal(get().workouts[0].exercises.length, 1);
}

async function testWorker() {
  const events = {};
  const entries = new Map();
  const scope = 'https://example.test/gym-log/';
  const shell = '<meta name="gym-log-app" content="1" /><h1>Gym Log</h1>';
  let answer = shell;
  const cache = { put: async (key, value) => entries.set(key, value), match: async key => entries.get(key)?.clone() };
  const context = vm.createContext({
    URL, Response, AbortController, setTimeout, clearTimeout,
    self: { registration: { scope }, addEventListener: (name, listener) => { events[name] = listener; }, skipWaiting() {} },
    caches: { open: async () => cache },
    fetch: async () => {
      if (answer === null) throw new Error('offline');
      return new Response(answer, { headers: { 'content-type': 'text/html' } });
    }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context);
  let result;
  events.install({ waitUntil: promise => { result = promise; } });
  await result;
  const navigate = async url => {
    result = undefined;
    events.fetch({ request: { url, method: 'GET', mode: 'navigate' }, respondWith: promise => { result = promise; } });
    return result && (await result).text();
  };
  answer = null;
  assert.equal(await navigate(scope), shell);
  answer = '<h1>Captive portal</h1>';
  assert.equal(await navigate(scope + 'index.html?from=home'), shell);
  assert.equal(await navigate('https://example.test/another-app/'), undefined);
}

(async () => {
  await testSync();
  await testWorker();
  console.log('OK: apertura offline, portal cautivo, migración, recibos, reintentos, edición, borrado y cola concurrente.');
})().catch(error => { console.error(error); process.exitCode = 1; });
