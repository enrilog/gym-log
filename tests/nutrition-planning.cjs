const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const store = new Map();
let pendingBeforeFailure = Infinity;
const localStorage = {
  get length() { return store.size; },
  key: index => [...store.keys()][index],
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => {
    if (key.startsWith('gym_sync_v2_') && pendingBeforeFailure-- <= 0) throw new Error('Storage quota');
    store.set(key, value);
  },
  removeItem: key => store.delete(key)
};
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const context = vm.createContext({ localStorage, window: {}, navigator: { onLine: false }, crypto: webcrypto });
const run = script => vm.runInContext(script, context);
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const native = value => JSON.parse(JSON.stringify(value));

const base = { name: 'Arroz (100 g)', qty: 1.5, cal: 205, prot: 4.3, carb: 44, fat: 0.4 };
const ingredient = context.ingredientFromLog({ ...base, id: 'old-id' });
assert.deepEqual(native(context.mealIngredientPortion(ingredient)), base);
assert.deepEqual(native(context.mealIngredientPortion({ ...ingredient, qty: 3 })),
  { name: base.name, qty: 3, cal: 410, prot: 8.6, carb: 88, fat: 0.8 });
assert.deepEqual(native(context.mealIngredientPortion(ingredient)), base, 'one-time adjustment preserves template');

context.rice = { name: 'Arroz (100 g)', quantityMode: 'grams' };
assert.equal(run('usualPortion(rice)'), undefined);
run('saveNutritionPreferences({ usualPortions: { [usualPortionKey(rice)]: 145 } })');
assert.equal(run('usualPortion(rice)'), 145);
assert.equal(run('usualPortion({ ...rice, quantityMode: "units" })'), undefined);
assert.equal(context.applyCalorieGoal(2800), true);
assert.equal(run('NUTRITION_GOALS.carb.target'), 380);
assert.equal(context.applyCalorieGoal(1200), false);
assert.equal(run('NUTRITION_GOALS.cal.target'), 2800);
assert.deepEqual(native(run('nutLogs')), {}, 'goal changes do not rewrite history');
context.applyCalorieGoal(2700);

const today = '2026-11-22';
const dates = Array.from({ length: 22 }, (_, index) =>
  new Date(Date.parse(today) - 86400000 * index).toISOString().slice(0, 10));
const logs = Object.fromEntries(dates.map((date, index) => [date, [{ cal: index % 7 === 0 ? 9000 : 2600 }]]));
const completeDays = Object.fromEntries(dates.filter((_, index) => index % 7 !== 0 || index === 0).map(date => [date, true]));
const rows = dates.map((date, index) => ({ date, weight: index === 0 ? 99 : index <= 7 ? 65.6 : index <= 14 ? 65.3 : 65 }));
let week = context.weeklyNutritionReview(rows, logs, completeDays, today);
assert.equal(week.current.averageCalories, 2600);
assert.equal(week.current.days, 6);
assert.equal(week.current.from, '2026-11-15');
assert.equal(week.current.to, '2026-11-21');
assert.equal(week.delta, 0.3);
assert.equal(week.status, 'within');
assert.equal(week.sustained, false);
assert.equal(context.weeklyNutritionReview(rows, logs, {}, today).status, 'unknown');
assert.equal(context.weeklyNutritionReview(rows.slice(0, 5), logs, completeDays, today).delta, null);
const slow = rows.map((row, index) => ({ ...row, weight: index <= 7 ? 65.2 : index <= 14 ? 65.1 : 65 }));
week = context.weeklyNutritionReview(slow, logs, completeDays, today);
assert.equal(week.status, 'below');
assert.equal(week.sustained, true);
assert.equal(context.weeklyNutritionReview(slow, logs, Object.fromEntries(
  Object.entries(completeDays).filter(([date]) => date >= '2026-11-08')
), today).sustained, false);

context.hour = new Date(2026, 10, 21, 8, 59, 50, 1);
context.nextHour = new Date(2026, 10, 21, 9, 0);
assert.equal(context.mealHourDelay(context.hour), 9999);
assert.equal(context.mealHourDelay(context.nextHour), 3600000);
assert.equal(context.mealHourKey(context.nextHour), context.mealHourKey(context.hour) + 1);
const nodes = new Map();
context.document = { getElementById(id) {
  if (!nodes.has(id)) nodes.set(id, { classList: { toggle() {} }, setAttribute() {} });
  return nodes.get(id);
} };
run('mealLocation = "home"; renderToday = () => renderMealSuggestions({ cal: 0, prot: 0, carb: 0, fat: 0 }, hour);');
run('renderToday()');
const initial = nodes.get('mealOptions').innerHTML;
assert.match(nodes.get('mealOccasion').textContent, /Desayuno · 08:00/);
context.hour = context.nextHour;
run('renderToday()');
assert.notEqual(nodes.get('mealOptions').innerHTML, initial);
assert.match(nodes.get('mealOccasion').textContent, /Desayuno · 09:00/);
const afterHour = nodes.get('mealOptions').innerHTML;
run('refreshMealSuggestions()');
assert.notEqual(nodes.get('mealOptions').innerHTML, afterHour);
const seen = new Set();
for (let i = 0; i < 120; i++) {
  run('refreshMealSuggestions()');
  seen.add(nodes.get('mealOptions').innerHTML);
}
assert(seen.size > 1);
assert.equal(run('mealRefreshCount'), 121);
assert.equal(run(`suggestMeals(foods, [["Pechuga de pollo a la plancha", [60, 100, 150], "meal"]],
  { cal: 600, prot: 40, fat: 30, carb: 60 }, mealWindow(13), 0)[0].amount ===
  suggestMeals(foods, [["Pechuga de pollo a la plancha", [60, 100, 150], "meal"]],
  { cal: 600, prot: 40, fat: 30, carb: 60 }, mealWindow(13), 1)[0].amount`), false);

context.ingredients = [
  { type: 'nutrition', date: today, payload: { ...base, id: 'test-meal-1' } },
  { type: 'nutrition', date: today, payload: { ...base, id: 'test-meal-2' } }
];
run('saveLocal = updateSyncBadge = toast = () => {}');
pendingBeforeFailure = 1;
assert.equal(run('enqueueOperations(ingredients)'), false);
assert.equal(run('pendingOperations().length'), 0);
assert.deepEqual(native(run('nutLogs')), {});
pendingBeforeFailure = Infinity;
assert.equal(run('enqueueOperations(ingredients)'), true);
assert.equal(run('pendingOperations().length'), 2);
assert.equal(run('Object.values(nutLogs)[0].length'), 2);
assert.equal(run('new Set(pendingOperations().map(item => item.id)).size'), 2);
console.log('OK: revision semanal, objetivos, porciones, comidas agrupadas y rotacion por hora y manual sin limite.');
