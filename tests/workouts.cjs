const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const local = new Map();
const frontend = vm.createContext({
  localStorage: {
    get length() { return local.size; },
    key: index => [...local.keys()][index],
    getItem: key => local.get(key) ?? null,
    setItem: (key, value) => local.set(key, value),
    removeItem: key => local.delete(key)
  },
  window: {}
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
assert.match(frontend.getAdvice({ ...exercise, reps: '12, 10, 8' }, 2.5).txt, /serie 3/);
const progression = frontend.getAdvice({ ...exercise, reps: '12, 12, 12' }, 1.25);
assert.match(progression.txt, /26\.25 kg/);
frontend.Option = function(label, value) { this.label = label; this.value = value; };
const weights = [{ value: '26' }, { value: '26.5' }];
const weightSelect = { options: weights, add: (option, next) => weights.splice(weights.indexOf(next), 0, option) };
frontend.ensureWeightOption(weightSelect, progression.recommendedWeight);
frontend.ensureWeightOption(weightSelect, progression.recommendedWeight);
assert.deepEqual(weights.map(option => option.value), ['26', '26.25', '26.5']);
assert.match(frontend.getAdvice({ ...exercise, reps: '12, 12, 12', unit: 'lbs' }, 5).txt, /30 lbs/);
assert.match(frontend.getAdvice({ ...exercise, reps: '12, 12, 12' }).txt, /menor salto/);
assert.match(frontend.getAdvice({ ...exercise, reps: '12, 12, 12', notes: '' }, 2.5).txt, /registra el RIR/);
assert.match(frontend.getAdvice({ ...exercise, reps: '12, 12, 12', notes: 'RIR 1' }, 2.5).txt, /Mantén o baja/);
assert.match(frontend.getAdvice({ ...exercise, reps: '12, 12, 0' }, 2.5).txt, /Mantén o baja/);
assert.equal(frontend.getAdvice({ ...exercise, reps: '12, 12, 12', status: '❎' }, 2.5).cls, 'tag err');
assert.equal(frontend.getAdvice({ ...exercise, reps: '12, NA, 12' }, 2.5).cls, 'tag keep');

const latest = { ...exercise, reps: '10, 10, 9', notes: exercise.notes.replace('15 kg x 12', '15 kg x 1') };
assert.equal(frontend.compareExerciseSessions(exercise, latest), 'Misma carga · +2 repeticiones totales');
assert.equal(frontend.compareExerciseSessions(exercise, { ...latest, reps: '10, 10, 9, 8' }), '');
assert.equal(frontend.compareExerciseSessions(exercise, { ...latest, notes: 'Unilateral | RIR 2' }), '');
assert.equal(frontend.compareExerciseSessions(exercise, { ...exercise, weight: 27.5 }), '+2.5 kg con las mismas repeticiones por serie');
const historicalTriceps = frontend.calibratedPlateLoad({ name: 'Tríceps polea', weight: 44, unit: 'kg', reps: '12, 12' });
assert.equal(historicalTriceps.weight, 22);
assert.match(frontend.getAdvice(historicalTriceps).txt, /unilateral/);
frontend.rows = [
  { date: '2026-11-18', exercises: [exercise] },
  { date: '2026-11-23', exercises: [latest] },
  { date: '', exercises: [{ ...latest, weight: 99 }] }
];
vm.runInContext('workouts = sanitizeWorkoutsList(rows)', frontend);
assert.equal(frontend.findLastEx(exercise.name, '2026-11-21').reps, exercise.reps);
assert.equal(frontend.findLastEx(exercise.name, '2026-11-24').weight, latest.weight);

local.set('gym_draft_v1_2026-11-21_Superior', JSON.stringify({ exercises: [{ reps: ['', ''] }] }));
local.set('gym_draft_v1_2026-11-20_Superior', JSON.stringify({ exercises: [{ reps: ['10', ''] }], updatedAt: 55 }));
local.set('gym_draft_v1_2026-11-21_Inferior', JSON.stringify({ exercises: [{ reps: ['0', '10', ''] }] }));
local.set('gym_draft_v1_2026-11-22_Inferior', JSON.stringify({ exercises: [{ reps: ['15'] }], updatedAt: 99 }));
assert.equal(frontend.resumeCandidate('2026-11-21').split, 'Inferior');
assert.equal(frontend.resumeCandidate('2026-11-21').series, 2);
local.delete('gym_draft_v1_2026-11-21_Inferior');
assert.equal(frontend.resumeCandidate('2026-11-21').date, '2026-11-20');
local.delete('gym_draft_v1_2026-11-20_Superior');
assert.equal(frontend.resumeCandidate('2026-11-21'), undefined);
assert.equal(frontend.restSeconds('2:30 min'), 150);
assert.equal(frontend.restSeconds('1:30 min'), 90);
assert.equal(frontend.restSeconds('1:99 min'), 0);
assert.equal(frontend.secondsRemaining(90500, 89200), 2);
assert.equal(frontend.secondsRemaining(90500, 92000), 0);

const timerNodes = new Map();
frontend.document = {
  getElementById(id) {
    if (!timerNodes.has(id)) timerNodes.set(id, {});
    return timerNodes.get(id);
  }
};
frontend.setInterval = () => 1;
frontend.clearInterval = () => {};
const checkbox = frontend.document.getElementById('restTimerEnabled');
const restCard = { dataset: { name: exercise.name }, querySelector: () => ({ value: '1:30 min' }) };
frontend.startRestTimer(restCard, 2);
assert.equal(local.has('gym_rest_timer_v1'), false);
checkbox.checked = true;
frontend.startRestTimer(restCard, 2);
const clock = JSON.parse(local.get('gym_rest_timer_v1'));
assert.equal(clock.series, 2);
assert.equal(frontend.secondsRemaining(clock.deadline), 90);
assert.equal(frontend.document.getElementById('restTimer').hidden, false);
frontend.stopRestTimer();
assert.equal(local.has('gym_rest_timer_v1'), false);
assert.equal(frontend.document.getElementById('restTimer').hidden, true);

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
console.log('OK: serie 0, consejo con todas las series y RIR, incrementos, historial comparable, borradores y temporizador.');
