const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SCRIPT_ID = '1E7zY-3aed7xQiANQVtERhFh9JP_oHtePaARNJTuRgZKWl7hkjIklwyIw';
const DEPLOYMENT_ID = 'AKfycbyW2T66yyOpkl7idL633Ekb3NF1jPOp0GXleTFnNvdOa9dI6d06A7BnzntYI0blFmUp';

function stageBackend(directory, source) {
  const manifest = path.join(directory, 'appsscript.json');
  if (!fs.existsSync(manifest)) throw new Error('No se pudo recuperar el manifiesto remoto. No se enviarán cambios.');
  JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const candidates = ['Code.js', 'Code.gs', 'Code.gs.js'].filter(name => fs.existsSync(path.join(directory, name)));
  if (candidates.length !== 1) throw new Error('No se encontró un único archivo Code remoto. Revisar el proyecto antes de actualizar.');
  fs.writeFileSync(path.join(directory, candidates[0]), source);
}

async function main() {
  if (!process.env.CLASP_AUTH_JSON) throw new Error('Configura el secreto CLASP_AUTH_JSON en GitHub antes de ejecutar este flujo.');
  const auth = JSON.parse(process.env.CLASP_AUTH_JSON);
  if (!auth.tokens || typeof auth.tokens !== 'object') throw new Error('El secreto debe contener el archivo de autorización generado por clasp login.');
  const root = path.resolve(__dirname, '..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-apps-script-'));
  fs.chmodSync(temporary, 0o700);
  try {
    const authPath = path.join(temporary, 'auth.json');
    fs.writeFileSync(authPath, JSON.stringify(auth), { mode: 0o600 });
    const src = path.join(temporary, 'src');
    fs.mkdirSync(src);
    const projectPath = path.join(temporary, '.clasp.json');
    fs.writeFileSync(projectPath, JSON.stringify({scriptId: SCRIPT_ID, rootDir: src}));
    const clasp = path.join(root, 'tools/clasp/node_modules/.bin/clasp');
    const run = (...args) => execFileSync(clasp, ['-A', authPath, '-P', projectPath, ...args], {
      cwd: temporary, stdio: 'inherit', env: {...process.env, CLASP_AUTH_JSON: ''}
    });
    // Pull conserva el manifiesto, los permisos, la zona horaria y otros archivos remotos.
    run('pull');
    stageBackend(src, fs.readFileSync(path.join(root, 'Code.gs.js'), 'utf8'));
    run('push', '--force');
    // -i mantiene el ID y la URL existentes; no crea otra Web App.
    run('deploy', '-i', DEPLOYMENT_ID, '-d', `Gym Log ${process.env.GITHUB_SHA?.slice(0, 12) || 'manual'}`);
    const response = await fetch(`https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec`, {signal: AbortSignal.timeout(45000)});
    if (!response.ok) throw new Error(`La verificación devolvió HTTP ${response.status}.`);
    const data = await response.json();
    if (!data.ok || !Array.isArray(data.workouts)) throw new Error('La Web App no devolvió el historial esperado.');
    if (data.workouts.some(session => session.date && !/^\d{4}-\d{2}-\d{2}$/.test(session.date))) {
      throw new Error('La implementación aún devuelve fechas con formato incorrecto.');
    }
    console.log(`Verificación de lectura correcta: ${data.workouts.filter(s=>s.date).length} sesiones con fecha válida.`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { stageBackend };
