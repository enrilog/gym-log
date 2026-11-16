# AGENTS.md — Performance Log (Gym & Nutrition Tracker)

## 1. Descripción General del Proyecto
Aplicación web progresiva (PWA) de archivo único (`index.html`) diseñada para uso móvil (iPhone/Safari) con estética Azul Marino Metálico (`#0B1324`), conectada en tiempo real a Google Sheets mediante Google Apps Script (`Code.gs`).

- **Usuario:** Hombre de 25 años, peso inicial 65.0 kg, objetivo de superávit calórico limpio hacia **75.0 kg** (+0.25 a +0.35 kg/semana).
- **Metas Nutricionales Diarias:** `2,700 kcal` | `140 g Proteína` | `335 g Carbohidratos` | `80 g Grasas`.
- **URL Activa de Google Apps Script (Web App):** `https://script.google.com/macros/s/AKfycbyW2T66yyOpkl7idL633Ekb3NF1jPOp0GXleTFnNvdOa9dI6d06A7BnzntYI0blFmUp/exec`

## 2. Arquitectura y Persistencia de Datos
- **Frontend (`index.html`):** HTML5, CSS3 y Vanilla JavaScript sin dependencias externas. Usa `localStorage` como caché rápido y cola offline (`gym_sync_queue_v1`) para entornos sin señal en el gimnasio.
- **Backend (`Code.gs`):** Google Apps Script con `doGet` (lectura de historial completo) y `doPost` (escritura con `LockService` y deduplicación por clave única `fecha_division_ejercicio`).
- **Regla crítica de CORS:** Todas las peticiones `POST` desde `index.html` hacia Apps Script deben usar `mode: "no-cors"` y `headers: { "Content-Type": "text/plain;charset=utf-8" }`. No cambiar a `application/json` porque bloquea envíos desde Safari iOS.
- **Hojas en Google Sheets:**
  - `Gym_Registros`: `["Clave_Unica", "Fecha", "Division", "Ejercicio", "Peso", "Unidad", "Peso_Kg", "Series_Reps", "Estado", "Notas"]`
  - `Nutricion_Registros`: `["Fecha", "Alimento", "Cantidad", "Calorias_kcal", "Proteina_g", "Carbs_g", "Grasas_g"]`
  - `Peso_Corporal`: `["Fecha", "Peso_kg", "Cambio_vs_65kg", "Faltante_75kg"]`

## 3. Reglas de Negocio del Gimnasio (No Modificar sin Instrucción)
- **Divisiones:** `Superior` (descanso por defecto `2:00 min`) e `Inferior` (descanso por defecto `1:30 min`), ambos trabajados a `RIR 2`.
- **Series de Aproximación:** Siempre calcular y mostrar sugerencia de calentamiento entre `-4 kg` y `-10 kg` por debajo del peso efectivo.
- **15 Ejercicios Oficiales Activos:**
  - *Superior:* `Levantamiento horizontal hombros unilateral en polea`, `Bíceps predicador en máquina`, `Fly pecho en máquina`, `Jalón de espalda con barra en polea`, `Remo cerrado en máquina`, `Jalón de tríceps unilateral en polea`, `Rear reverse delt unilateral en máquina`, `Shoulder press bilateral en máquina`.
  - *Inferior:* `Apertura de piernas en máquina`, `Cierre de piernas en máquina`, `Femoral sentado en máquina`, `Máquina hack horizontal`, `Gemelos en máquina hack horizontal`, `Patada de glúteo unilateral parado en máquina`, `Máquina de cuádriceps`.
  - *Excluido:* `Levantamiento horizontal hombros sentado` (se ignora en plantillas y estadísticas mediante `canonicalExerciseName()`).
- **Calibración Mecánica (Doble Polea 2:1):**
  - `Jalón de tríceps unilateral en polea` y `Levantamiento horizontal hombros unilateral en polea` se realizan en doble polea (ventaja 2:1). Los umbrales de rango (`GOLD_AT_65KG`) reflejan el peso marcado en placas (`28 kg` y `18 kg` para Nivel Oro en 65 kg).
  - Registros históricos de tríceps `>= 36 kg` corresponden a la etapa bilateral (2 manos) y se normalizan con `Math.floor(kg / 2)`.
- **Sanitización de Datos:** Mantener `cleanReps()` para revertir strings de fecha GMT generados por Google Sheets y `normalizeDate()` para fechas en español.

## 4. Convenciones de Edición para Codex
- Mantener el diseño móvil **mobile-first** (`font-size: 16px` en inputs para evitar auto-zoom en iOS) y la paleta **Azul Marino Metálico** (`--bg: #0B1324`).
- Todo el código web debe permanecer autocontenido en `index.html` para despliegue directo en GitHub Pages sin pasos de compilación (`build steps`).