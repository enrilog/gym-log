const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const memory = new Map();
const localStorage = {
  get length() { return memory.size; },
  key: index => [...memory.keys()][index],
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value)
};
const frontend = vm.createContext({ localStorage, window: {} });
const run = script => vm.runInContext(script, frontend);
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);

const start = '2026-11-16';
const today = '2026-11-20';
const exercise = { name: 'Remo cerrado en máquina', weight: 25, unit: 'kg', reps: '10, 9, 8', notes: 'En máquina | RIR 2' };
const session = (date, split, move = exercise) => ({ date, split, exercises: [move] });
const plan = ['Superior', 'Inferior', 'Descanso', '', 'Superior', '', 'Descanso'];
const sessions = [
  session('2026-11-12', 'Superior'),
  session('2026-11-16', 'Superior', { ...exercise, reps: '11, 10, 8' }),
  session('2026-11-16', 'Superior'),
  session('2026-11-19', 'Superior'),
  session('2026-11-19', 'Superior'),
  session('2026-11-22', 'Inferior'),
  { date: '', split: 'Inferior', exercises: [exercise] }
];
assert.equal(frontend.trainingWeekStart('2026-11-22'), start);
assert.equal(frontend.trainingWeekStart('2027-01-01'), '2026-12-28');
assert.equal(frontend.trainingDateOffset('2026-12-28', 6), '2027-01-03');

const week = frontend.trainingWeekModel(sessions, plan, start, today);
assert.equal(week.recorded, 2, 'one session per split and day, including makeup sessions');
assert.equal(week.completed, 2);
assert.equal(week.planned, 3);
assert.equal(week.remaining.Inferior, 1);
assert.equal(week.nextSplit, 'Inferior');
assert.equal(frontend.trainingCalendarState(week.days[0], today).badge, 'Registrado');
assert.equal(frontend.trainingCalendarState(week.days[1], today).badge, 'Sin registro');
assert.equal(frontend.trainingCalendarState(week.days[2], today).badge, 'Descanso programado');
assert.equal(frontend.trainingCalendarState(week.days[5], today).badge, 'Sin plan');
assert.equal(frontend.trainingCalendarState({ ...week.days[5], plan: 'Inferior' }, today).badge, 'Programado');
assert.equal(frontend.trainingWeekModel(sessions, plan, start, '2026-11-18').nextSplit, '', 'protects planned rest');
assert.equal(frontend.trainingWeekModel(sessions, undefined, start, today).planned, 0);
assert.equal(frontend.trainingWeekModel(sessions, plan, start, '2026-11-23').nextSplit, '', 'old weeks do not launch workouts');
const completed = frontend.trainingWeekModel([...sessions, session(today, 'Inferior')], plan, start, today);
assert.equal(completed.completed, 3);
assert.equal(completed.nextSplit, '');

const improvement = frontend.latestTrainingImprovement([sessions[1], sessions[0]], start, today);
assert.equal(improvement.change, 'Misma carga · +2 repeticiones totales');
assert.equal(improvement.name, exercise.name);
assert.equal(frontend.latestTrainingImprovement([sessions[0], session(today, 'Superior', { ...exercise, reps: '13, 13, 13', notes: 'RIR 4' })], start, today), null);

const first = frontend.dailyQuote(today);
assert.equal(first, frontend.dailyQuote(today));
const authors = new Set(Array.from({ length: 8 }, (_, day) => frontend.dailyQuote(frontend.trainingDateOffset(today, day))[1]));
assert.equal(authors.size, 8);
for (const date of [today, '1969-12-31', '2027-01-01']) {
  assert.match(frontend.dailyQuote(date)[3], /^https:\/\//);
}

memory.set('gym_training_plans_v1', JSON.stringify({ [start]: plan }));
frontend.sessions = sessions;
frontend.document = { getElementById: () => target };
const target = {};
const selected = [];
frontend.recordSplit = split => selected.push(split);
run(`workouts = sanitizeWorkoutsList(sessions);
  localToday = () => "2026-11-20";
  changeSplit = recordSplit;
  goTab = () => {};
  continueWorkout();`);
assert.equal(target.value, today);
assert.deepEqual(selected, ['Inferior']);
memory.set('gym_draft_v1_2026-11-19_Superior', JSON.stringify({ exercises: [{ reps: ['10'] }] }));
run('continueWorkout()');
assert.equal(target.value, '2026-11-19');
assert.deepEqual(selected, ['Inferior', 'Superior'], 'an existing draft retains priority');
console.log('OK: calendario, descanso, sesiones pendientes, avances comparables, acceso desde Hoy y frases diarias.');
