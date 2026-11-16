const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {stageBackend} = require('../scripts/deploy-apps-script.cjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-deploy-test-'));
try {
  assert.throws(()=>stageBackend(temp,'new'),/manifiesto/);
  const manifest = JSON.stringify({timeZone:'America/Mexico_City',webapp:{access:'ANYONE_ANONYMOUS',executeAs:'USER_DEPLOYING'}});
  fs.writeFileSync(path.join(temp,'appsscript.json'),manifest);
  assert.throws(()=>stageBackend(temp,'new'),/único/);
  fs.writeFileSync(path.join(temp,'Code.js'),'old');
  fs.writeFileSync(path.join(temp,'Otro.js'),'keep');
  stageBackend(temp,'new');
  assert.equal(fs.readFileSync(path.join(temp,'Code.js'),'utf8'),'new');
  assert.equal(fs.readFileSync(path.join(temp,'Otro.js'),'utf8'),'keep');
  assert.equal(fs.readFileSync(path.join(temp,'appsscript.json'),'utf8'),manifest);
  fs.writeFileSync(path.join(temp,'Code.gs'),'duplicate');
  assert.throws(()=>stageBackend(temp,'newer'),/único/);
  console.log('OK: manifiesto y archivos remotos conservados; no se envían archivos de la app ni reemplazos ambiguos.');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
