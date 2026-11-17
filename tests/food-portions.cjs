const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const history={ '2026-11-16': [{name:'Arroz cocido blanco o rojo (150g / 1 taza)',qty:1,cal:205,prot:4.3,carb:44,fat:0.4}] };
const saved=[{name:'Yogur griego natural (150g)',cal:130,prot:15,carb:6,fat:4},{name:'Arroz cocido blanco o rojo (150g / 1 taza)',cal:205,prot:4.3,carb:44,fat:0.4}];
const storage=new Map([['gym_foods_v1',JSON.stringify(saved)],['gym_cloud_nutrilogs',JSON.stringify(history)]]);
const context=vm.createContext({localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},window:{}});
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
const foods=JSON.parse(vm.runInContext('JSON.stringify(foods)',context));
for(const name of ['Plátano','Manzana','Uvas','Naranja','Tuna','Fruta deshidratada','Papaya','Sandía','Melón','Piña','Mango','Fresa','Pera','Mandarina','Guayaba','Durazno','Ciruela','Kiwi','Toronja','Arándano azul','Frambuesa','Zarzamora','Cereza','Granada','Pitaya','Zapote mamey']){
 const matches=foods.filter(f=>f.name===`${name} (100 g)`);assert.equal(matches.length,1);assert.equal(matches[0].quantityMode,'grams');
}
assert(!foods.some(f=>/taza|tazón/i.test(f.name)));
const rice=foods.find(f=>f.name.startsWith('Arroz cocido'));assert.equal(rice.name,'Arroz cocido blanco o rojo (100 g)');assert.equal(rice.cal,136.67);
const yogurt=foods.find(f=>f.name.startsWith('Yogur griego'));assert.equal(yogurt.quantityMode,'spoons');assert.equal(yogurt.cal,13);assert.equal(yogurt.prot,1.5);
const peanut=foods.find(f=>f.name.startsWith('Mantequilla de maní'));assert.equal(peanut.quantityMode,'spoons');assert.equal(peanut.cal,95);
const sope=foods.find(f=>f.name.startsWith('Sope sencillo'));assert.equal(sope.name,'Sope sencillo con frijoles y queso (100 g)');assert.equal(sope.cal,310);
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(nutLogs)',context)),history);
const second=context.loadMergedCatalog();assert.equal(second.length,foods.length);assert.equal(second.find(f=>f.name.startsWith('Yogur griego')).cal,13);
assert.equal(context.foodQuantityText({name:rice.name,qty:1.57}),'157 g');
console.log('OK: frutas únicas, migración de catálogo, gramos/cucharadas, recarga idempotente e historial intacto.');
