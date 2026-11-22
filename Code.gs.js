var WORKOUT_HEADERS = [
    "Clave_Unica", "Fecha", "Division", "Ejercicio", "Peso", "Unidad", "Peso_Kg", "Series_Reps", "Estado", "Notas"
];
var NUTRITION_HEADERS = [
  "Fecha", "Alimento", "Cantidad", "Calorias_kcal", "Proteina_g", "Carbs_g", "Grasas_g", "Registro_ID", "Eliminado"
];
var WEIGHT_HEADERS = ["Fecha", "Peso_kg", "Cambio_vs_65kg", "Faltante_75kg"];

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var params = e && e.parameter || {};
  var v2 = params.sync === "2";
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetW = getOrCreateSheet(ss, "Gym_Registros", WORKOUT_HEADERS);
    var deletedFoodIds = [];
    var data = {
      ok: true,
      workouts: readWorkoutsFromSheet(sheetW),
      nutLogs: readNutritionFromSheet(ss, v2 ? deletedFoodIds : null),
      weights: readWeightsFromSheet(ss)
    };
    if (v2) {
      var receipts = readReceipts(ss.getSheetByName("Gym_Sync"));
      data.syncVersion = 2;
      data.acknowledged = String(params.ids || "").split(",").slice(0, 20).filter(function(id) {
        return receipts.has(id);
      });
      data.deletedFoodIds = deletedFoodIds;
    }
    SpreadsheetApp.flush();
    return jsonOutput(data);
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var raw = e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    if (data.type === "sync" && data.version === 2) {
      if (!Array.isArray(data.operations) || data.operations.length > 20) throw new Error("Lote inválido");
      var journal = getOrCreateSheet(ss, "Gym_Sync", ["Operacion_ID", "Confirmado_En"]);
      var receipts = readReceipts(journal);
      for (var i = 0; i < data.operations.length; i++) {
        var operation = data.operations[i];
        if (!validSyncId(operation.id)) throw new Error("Operación inválida");
        if (receipts.has(operation.id)) continue;
        applySyncOperation(ss, operation);
        // Commit the mutation before publishing its receipt. Retrying is safe by record key.
        SpreadsheetApp.flush();
        journal.appendRow([operation.id, new Date()]);
        SpreadsheetApp.flush();
        receipts.add(operation.id);
      }
      return jsonOutput({ ok: true });
    }

    if (data.type === "workout") {
      var sheetW = getOrCreateSheet(ss, "Gym_Registros", WORKOUT_HEADERS);
      saveWorkoutRows(sheetW, data.payload);
    }

    if (data.type === "nutrition") {
      var sheetN = getOrCreateSheet(ss, "Nutricion_Registros", NUTRITION_HEADERS);
      var item = data.payload;
      sheetN.appendRow([data.date, item.name, item.qty, item.cal, item.prot, item.carb, item.fat]);
    }

    if (data.type === "weight") {
      var sheetP = getOrCreateSheet(ss, "Peso_Corporal", WEIGHT_HEADERS);
      var w = Number(data.payload.weight);
      sheetP.appendRow([data.payload.date, w, +(w - 65).toFixed(1), +(75 - w).toFixed(1)]);
    }

    SpreadsheetApp.flush();
    return jsonOutput({ ok: true });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function validSyncId(id) {
  return typeof id === "string" && /^[a-z0-9-]{12,100}$/.test(id);
}

function readReceipts(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return new Set();
  return new Set(sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(function(row) {
    return String(row[0]);
  }));
}

function applySyncOperation(ss, operation) {
  var item = operation.payload;
  var date = parseCalendarDate(operation.type === "nutrition" ? operation.date : item.date);
  if (!date) throw new Error("Fecha inválida");
  if (operation.type === "workout") {
    saveWorkoutRows(getOrCreateSheet(ss, "Gym_Registros", WORKOUT_HEADERS), item, !operation.legacy);
  } else if (operation.type === "weight") {
    var weight = Number(item.weight);
    if (!Number.isFinite(weight) || weight <= 0) throw new Error("Peso inválido");
    var sheet = getOrCreateSheet(ss, "Peso_Corporal", WEIGHT_HEADERS);
    var rows = sheet.getDataRange().getValues();
    var index = rows.length - 1;
    while (index > 0 && formatDateCell(rows[index][0]) !== date) index--;
    var values = [date, weight, +(weight - 65).toFixed(1), +(75 - weight).toFixed(1)];
    if (index < 1) sheet.appendRow(values);
    else sheet.getRange(index + 1, 1, 1, values.length).setValues([values]);
  } else if (operation.type === "nutrition") {
    saveNutritionOperation(ss, date, item, operation.deleted === true, operation.legacy === true);
  } else {
    throw new Error("Tipo de operación desconocido");
  }
}

function parseCalendarDate(raw) {
  var text = String(raw == null ? "" : raw).trim().toLowerCase();
  var parts = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[t\s_])/);
  var year, month, day;
  if (parts) { year = +parts[1]; month = +parts[2]; day = +parts[3]; }
  else {
    parts = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:$|[\s_])/);
    if (parts) { day = +parts[1]; month = +parts[2]; year = +parts[3]; }
    else {
      var months = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12,jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
      parts = text.match(/(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
      if (parts && months[parts[2]]) { day = +parts[1]; month = months[parts[2]]; year = +(parts[3] || 2026); }
      else {
        parts = text.match(/^(?:[a-z]{3}\s+)?([a-z]{3})\s+(\d{1,2})\s+(\d{4})(?:$|\s)/);
        if (!parts || !months[parts[1]]) return "";
        month = months[parts[1]]; day = +parts[2]; year = +parts[3];
      }
    }
  }
  var date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function formatDateCell(val) {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return parseCalendarDate(val);
}

function readWorkoutsFromSheet(sheet) {
  var rows = sheet.getDataRange().getValues();
  var map = {};
  var order = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[3]) continue;
    var dateStr = formatDateCell(r[1]);
    // Recuperación solo si la clave contiene una fecha válida; nunca inventar el día.
    if (!dateStr) dateStr = parseCalendarDate(String(r[0] || "").split("_")[0]);
    var splitStr = String(r[2]);
    var sKey = dateStr ? dateStr + "_" + splitStr : "sin_fecha_fila_" + (i + 1);

    if (!map[sKey]) {
      map[sKey] = { date: dateStr, split: splitStr, sessionNotes: "", exercises: [] };
      if (!dateStr) map[sKey].dateIssue = { row: i + 1, rawDate: String(r[1] || ""), key: String(r[0] || "") };
      order.push(sKey);
    }
    map[sKey].exercises.push({
      name: String(r[3]),
      weight: Number(r[4]) || 0,
      unit: String(r[5] || "kg"),
      reps: String(r[7]),
      status: String(r[8] || "☑️"),
      notes: String(r[9] || "")
    });
  }

  var list = order.map(function(k) { return map[k]; });
  list.sort(function(a, b) { return (a.date || "9999").localeCompare(b.date || "9999"); });
  return list;
}

// Legacy copies identify equal rows by occurrence so two identical meals stay distinct.
function syncFingerprint(value) {
  var a = 2166136261, b = 2246822519;
  for (var i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b ^ value.charCodeAt(i), 3266489917);
  }
  return (a >>> 0).toString(36) + "-" + (b >>> 0).toString(36);
}

function nutritionSignature(date, item) {
  return JSON.stringify([date, String(item.name), Number(item.qty), Number(item.cal),
    Number(item.prot), Number(item.carb || 0), Number(item.fat || 0)]);
}

function nutritionFromRow(row) {
  return { name: String(row[1]), qty: Number(row[2]), cal: Number(row[3]),
    prot: Number(row[4]), carb: Number(row[5]), fat: Number(row[6]) };
}

function nutritionRowsWithIds(sheet) {
  var rows = sheet.getDataRange().getValues();
  var used = new Set(rows.slice(1).map(function(row) { return row[7]; }));
  var counts = new Map();
  var changed = rows[0][7] !== NUTRITION_HEADERS[7] || rows[0][8] !== NUTRITION_HEADERS[8];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (!row[1] || row[7]) continue;
    var base = "legacy-" + syncFingerprint(nutritionSignature(formatDateCell(row[0]), nutritionFromRow(row)));
    var occurrence = counts.get(base) || 0;
    var id;
    do { id = base + "-" + (++occurrence); } while (used.has(id));
    counts.set(base, occurrence);
    used.add(id);
    row[7] = id;
    changed = true;
  }
  if (changed) {
    sheet.getRange(1, 8, rows.length, 2).setValues([NUTRITION_HEADERS.slice(7)].concat(rows.slice(1).map(function(row) {
      return [row[7] || "", row[8] === true];
    })));
  }
  return rows;
}

function saveNutritionOperation(ss, date, item, deleted, legacy) {
  if (!validSyncId(item.id) || typeof item.name !== "string" || !item.name.trim()) throw new Error("Comida inválida");
  var metrics = [item.qty, item.cal, item.prot, item.carb, item.fat].map(Number);
  if (!deleted && (metrics[0] <= 0 || metrics.some(function(value) { return !Number.isFinite(value) || value < 0; }))) {
    throw new Error("Porción inválida");
  }
  var sheet = getOrCreateSheet(ss, "Nutricion_Registros", NUTRITION_HEADERS);
  var rows = nutritionRowsWithIds(sheet);
  var index = rows.findIndex(function(row, i) { return i > 0 && row[7] === item.id; });
  if (legacy && index > 0) return;
  if (deleted && index > 0) {
    sheet.getRange(index + 1, 9).setValue(true);
    return;
  }
  var name = item.name.charAt(0) === "=" ? "'" + item.name : item.name;
  var values = [date, name].concat(metrics, [item.id, deleted]);
  if (index < 1) sheet.appendRow(values);
  else sheet.getRange(index + 1, 1, 1, values.length).setValues([values]);
}

function readNutritionFromSheet(ss, deletedFoodIds) {
  var sheet = ss.getSheetByName("Nutricion_Registros");
  if (!sheet || sheet.getLastRow() <= 1) return {};
  var rows = deletedFoodIds ? nutritionRowsWithIds(sheet) : sheet.getDataRange().getValues();
  var logs = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1]) continue;
    if (r[8] === true) {
      if (deletedFoodIds && r[7]) deletedFoodIds.push(String(r[7]));
      continue;
    }
    var d = formatDateCell(r[0]);
    if (!logs[d]) logs[d] = [];
    var item = nutritionFromRow(r);
    if (deletedFoodIds) item.id = String(r[7]);
    logs[d].push(item);
  }
  return logs;
}

function readWeightsFromSheet(ss) {
  var sheet = ss.getSheetByName("Peso_Corporal");
  if (!sheet || sheet.getLastRow() <= 1) return [{ date: "2026-11-16", weight: 65.0 }];
  var rows = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    list.push({ date: formatDateCell(rows[i][0]), weight: Number(rows[i][1]) });
  }
  return list;
}

function saveWorkoutRows(sheet, session, updateExisting) {
  var values = sheet.getDataRange().getValues();
  var keys = new Map();
  for (var i = 1; i < values.length; i++) keys.set(String(values[i][0]), i + 1);

  var newRows = [];
  for (var j = 0; j < session.exercises.length; j++) {
    var ex = session.exercises[j];
    var key = (session.date + "_" + session.split + "_" + ex.name).toLowerCase();
    var kg = ex.unit === "lbs" ? +(ex.weight / 2.20462).toFixed(1) : ex.weight;
    var noteFull = [ex.notes, session.sessionNotes].filter(Boolean).join(" | ");
    var row = [key, session.date, session.split, ex.name, ex.weight, ex.unit, kg, "'" + String(ex.reps), ex.status, noteFull];
    var existing = keys.get(key);
    if (existing > 0 && updateExisting) sheet.getRange(existing, 1, 1, row.length).setValues([row]);
    if (existing === undefined) {
      newRows.push(row);
      keys.set(key, 0);
    }
  }
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}
