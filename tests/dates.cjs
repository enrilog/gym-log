const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const backend = vm.createContext({
  Utilities: { formatDate: () => '2026-11-16' },
  Session: { getScriptTimeZone: () => 'America/Mexico_City' }
});
vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs.js'), 'utf8'), backend);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const frontend = vm.createContext({
  localStorage: { getItem: () => null, setItem: () => {} }, window: {}
});
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], frontend);
for (const context of [backend, frontend]) {
  for (const [raw, expected] of [
    ['Tue Aug 04 2026 00:00:00 GMT-0600', '2026-08-04'],
    ['Thu Aug 06 2026 00:00:00 GMT-0600', '2026-08-06'],
    ['Wed Sep 30 2026 00:00:00 GM', '2026-09-30'],
    ['2026-11-16T00:00:00Z', '2026-11-16'],
    ['16/11/2026', '2026-11-16'], ['26 de agosto', '2026-08-26'],
    ['2026-02-30', ''], ['', ''], ['desconocida', '']
  ]) assert.equal(context.parseCalendarDate(raw), expected, raw);
}
const row = (key, date, name='Fly pecho en máquina') => [key,date,'Superior',name,20,'kg',20,'10, 8','☑️',''];
const rows = [[],
  row('a', 'Tue Aug 04 2026 00:00:00 GMT-0600'),
  row('b', 'Thu Aug 06 2026 00:00:00 GMT-0600'),
  row('c', 'Tue Aug 04 2026 00:00:00 GMT-0600', 'Remo cerrado en máquina'),
  row('2026-08-08_superior_fly', ''),
  row('sinfecha1', ''), row('sinfecha2', 'ilegible')
];
const sessions = backend.readWorkoutsFromSheet({getDataRange:()=>({getValues:()=>rows})});
assert.equal(sessions.filter(s=>s.date).length, 3);
assert.equal(sessions.find(s=>s.date==='2026-08-04').exercises.length, 2);
assert.equal(sessions.filter(s=>!s.date).length, 2);
assert.equal(sessions.reduce((sum,s)=>sum+s.exercises.length,0), 6);
assert.equal(sessions.find(s=>s.dateIssue?.row===7).dateIssue.rawDate,'ilegible');
assert.equal(frontend.sanitizeWorkoutsList([{date:'',exercises:[]}])[0].date,'');
console.log('OK: fechas en ambos archivos, martes/jueves, validación, agrupación, recuperación por clave y conservación sin fechas ficticias.');
