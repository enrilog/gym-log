const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const history={ '2026-11-16': [{name:'Arroz cocido blanco o rojo (150g / 1 taza)',qty:1,cal:205,prot:4.3,carb:44,fat:0.4}] };
const saved=[{name:'Plátano (100 g)',cat:'Frutas',quantityMode:'grams',cal:89,prot:1.1,carb:22.8,fat:0.3},{name:'Yogur griego natural (150g)',cal:130,prot:15,carb:6,fat:4},{name:'Arroz cocido blanco o rojo (150g / 1 taza)',cal:205,prot:4.3,carb:44,fat:0.4}];
const storage=new Map([['gym_foods_v1',JSON.stringify(saved)],['gym_cloud_nutrilogs',JSON.stringify(history)]]);
const context=vm.createContext({localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},window:{}});
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
const foods=JSON.parse(vm.runInContext('JSON.stringify(foods)',context));
for(const name of ['Plátano','Manzana','Uvas','Naranja','Tuna','Fruta deshidratada','Papaya','Sandía','Melón','Piña','Mango','Fresa','Pera','Mandarina','Guayaba','Durazno','Ciruela','Kiwi','Toronja','Arándano azul','Frambuesa','Zarzamora','Cereza','Granada','Pitaya','Zapote mamey']){
 const matches=foods.filter(f=>f.cat==='Frutas' && f.name.startsWith(name+' ('));assert.equal(matches.length,1);assert(['grams','pieces'].includes(matches[0].quantityMode));
}
const banana=foods.find(f=>f.name==='Plátano (1 pieza mediana)');assert.equal(banana.quantityMode,'pieces');assert.equal(banana.cal,105.02);
assert.equal(context.foodQuantityText({name:banana.name,qty:2}),'2 piezas');
assert(!foods.some(f=>/taza|tazón/i.test(f.name)));
const rice=foods.find(f=>f.name.startsWith('Arroz cocido'));assert.equal(rice.name,'Arroz cocido blanco o rojo (100 g)');assert.equal(rice.cal,136.67);
const yogurt=foods.find(f=>f.name.startsWith('Yogur griego'));assert.equal(yogurt.quantityMode,'spoons');assert.equal(yogurt.cal,13);assert.equal(yogurt.prot,1.5);
const peanut=foods.find(f=>f.name.startsWith('Mantequilla de maní'));assert.equal(peanut.quantityMode,'spoons');assert.equal(peanut.cal,95);
const sope=foods.find(f=>f.name.startsWith('Sope sencillo'));assert.equal(sope.name,'Sope sencillo con frijoles y queso (100 g)');assert.equal(sope.cal,310);
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(nutLogs)',context)),history);
const second=context.loadMergedCatalog();assert.equal(second.length,foods.length);assert.equal(second.find(f=>f.name.startsWith('Yogur griego')).cal,13);
assert.equal(context.foodQuantityText({name:rice.name,qty:1.57}),'157 g');
console.log('OK: frutas únicas, migración de catálogo, gramos/cucharadas, recarga idempotente e historial intacto.');

const goals = JSON.parse(vm.runInContext('JSON.stringify(NUTRITION_GOALS)', context));
assert.deepEqual(Object.values(goals).map(goal => goal.target), [2700, 140, 355, 80]);
assert.equal(goals.prot.target * 4 + goals.carb.target * 4 + goals.fat.target * 9, goals.cal.target);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.nutritionTotals([{ cal: '63', prot: 1.3, carb: 13.9, fat: 0.8 }, { cal: 50, prot: 4 }]))),
  { cal: 113, prot: 5.3, carb: 13.9, fat: 0.8 }
);
assert(foods.filter(food => food.cat === 'Verduras y hortalizas').length >= 25);
assert.equal(foods.find(food => food.name.startsWith('Jitomate rojo crudo')).quantityMode, 'grams');
const salmas = foods.find(food => food.name.startsWith('Galletas Salmas'));
assert.equal(salmas.pieceGrams, 6);
assert.equal(salmas.cal * 3, 63);
assert.equal(context.foodQuantityText({ name: salmas.name, qty: 3 }), '3 piezas');
assert.equal(foods.find(food => food.name.startsWith('Galletas Ritz Original México')).cal, 473.3);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.foodNutritionForPortion(foods.find(food => food.source === 'ritz'), 0.3))),
  { cal: 142, prot: 1.9, carb: 20.2, fat: 6.2 }
);
assert.equal(foods.find(food => food.name.startsWith('Cacahuates japoneses Mafer')).fat, 31.7);
assert.equal(foods.find(food => food.name.startsWith('Salpicón de res')).quantityMode, 'grams');
const milk = foods.find(food => food.name.startsWith('Leche entera natural'));
assert.equal(milk.quantityMode, 'milliliters');
assert.equal(context.foodQuantityText({ name: milk.name, qty: 2.5 }), '250 ml');
assert.equal(second.length, foods.length);
console.log('OK: metas coherentes, totales de registros antiguos, verduras, etiquetas mexicanas y porciones en piezas, gramos y mililitros.');

const nutCategory = 'Nueces, cacahuates y semillas';
const pecan = foods.find(food => food.name === 'Nuez pecana natural (100 g)');
assert.equal(pecan.cat, nutCategory);
assert.equal(pecan.defaultAmount, 25);
assert.deepEqual(pecan.portionPreset, { label: 'Usar 12 mitades (25 g)', amount: 25 });
assert.match(pecan.searchTerms, /pecanas.*pacana/);
assert.deepEqual(JSON.parse(JSON.stringify(context.foodNutritionForPortion(pecan, 0.25))),
  { cal: 173, prot: 2.3, carb: 3.5, fat: 18 });
const nutFoods = foods.filter(food => food.cat === nutCategory);
const nutNames = nutFoods.map(food => context.foodKey(food.name));
assert.equal(new Set(nutNames).size, nutNames.length);
for (const name of ['avellanas naturales', 'nuez de la india natural', 'nuez de macadamia natural', 'nuez de brasil natural',
  'pinones secos sin cascara', 'cacahuates naturales sin sal', 'cacahuates tostados en seco sin sal',
  'cacahuates tostados en seco con sal', 'cacahuates tostados en aceite con sal', 'cacahuates cocidos con sal',
  'cacahuates japoneses mafer clasico', 'semillas de girasol secas sin cascara', 'pepitas de calabaza tostadas sin sal',
  'crema de almendra natural sin sal', 'mezcla de nueces tostadas con cacahuate y sal']) assert(nutNames.includes(name), name);
assert.equal(nutFoods.find(food => food.name.startsWith('Mantequilla de maní')).quantityMode, 'spoons');

const catalogNodes = new Map();
const catalogNode = id => {
  if (!catalogNodes.has(id)) catalogNodes.set(id, { dataset: {}, value: '', replaceChildren() {}, append() {} });
  return catalogNodes.get(id);
};
context.document = { getElementById: catalogNode, createElement: () => ({}) };
catalogNode('fSel').value = String(foods.indexOf(pecan));
context.configureFoodQuantity(true);
assert.match(catalogNode('fQty').innerHTML, /<option value="25" selected>/);
catalogNode('fQty').value = '40';
context.prevFood();
assert.match(catalogNode('fPrev').textContent, /^40 g · 276 kcal/);
assert.equal(catalogNode('foodPortionPreset').hidden, false);
context.useFoodPortionPreset();
assert.equal(Number(catalogNode('fQty').value), 25);
assert.match(catalogNode('fPrev').textContent, /^25 g · 173 kcal/);
catalogNode('fSel').value = String(foods.indexOf(salmas));
context.prevFood();
assert.equal(catalogNode('foodPortionPreset').hidden, true);
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(nutLogs)', context)), history);
console.log('OK: categoría de nueces y semillas, preparaciones distintas, medida de pecanas e historial intacto.');
