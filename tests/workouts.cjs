const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const frontend = vm.createContext({
  localStorage: { getItem: () => null, setItem: () => {} }, window: {}
});
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], frontend);
const exercise = {
  name: 'Fly pecho en máquina', weight: 25, unit: 'kg', reps: '10, 9, 8',
  notes: 'Bilateral | RIR 2 | [Serie 0: 15 kg x 12]'
};
assert.equal(frontend.exerciseVolume(exercise), 855);
assert.equal(frontend.exerciseVolume({ ...exercise, notes: '' }), 675);
assert.equal(frontend.readWarmup({ notes: '' }), null);
assert.equal(frontend.readWarmup({ notes: '[Serie 0: 15 kg x 0]' }), null);
assert.equal(frontend.exerciseVolume({ ...exercise, notes: '[Serie 0: 22 lbs x 10]' }), 775);
assert.equal(frontend.readWarmup(exercise).reps, 12);
assert.equal(frontend.getAdvice(exercise).cls, 'tag keep');

const backend = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs.js'), 'utf8'), backend);
let written;
const sheet = {
  getDataRange: () => ({ getValues: () => [[]] }),
  getLastRow: () => 1,
  getRange: () => ({ setValues: values => { written = values; } })
};
backend.saveWorkoutRows(sheet, {
  date: '2026-11-19', split: 'Superior', sessionNotes: 'RIR 2', exercises: [exercise]
});
assert.match(written[0][9], /\[Serie 0: 15 kg x 12\]/);
assert.equal(written[0][7], "'10, 9, 8");
written[0][7] = '10, 9, 8'; // Sheets removes the text-prefix apostrophe when reading.
const sessions = backend.readWorkoutsFromSheet({ getDataRange: () => ({ getValues: () => [[], ...written] }) });
assert.equal(frontend.exerciseVolume(sessions[0].exercises[0]), 855);
assert.equal(sessions[0].exercises[0].reps, exercise.reps);
console.log('OK: serie 0, volumen kg/lbs, historial anterior, consejo de carga y viaje completo por el backend actual de Sheets.');
