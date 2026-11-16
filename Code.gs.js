function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetW = getOrCreateSheet(ss, "Gym_Registros", [
    "Clave_Unica", "Fecha", "Division", "Ejercicio", "Peso", "Unidad", "Peso_Kg", "Series_Reps", "Estado", "Notas"
  ]);

  var workouts = readWorkoutsFromSheet(sheetW);
  var nutLogs = readNutritionFromSheet(ss);
  var weights = readWeightsFromSheet(ss);

  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    workouts: workouts,
    nutLogs: nutLogs,
    weights: weights
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var raw = e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    if (data.type === "workout") {
      var sheetW = getOrCreateSheet(ss, "Gym_Registros", [
        "Clave_Unica", "Fecha", "Division", "Ejercicio", "Peso", "Unidad", "Peso_Kg", "Series_Reps", "Estado", "Notas"
      ]);
      saveWorkoutRows(sheetW, data.payload);
    }

    if (data.type === "nutrition") {
      var sheetN = getOrCreateSheet(ss, "Nutricion_Registros", [
        "Fecha", "Alimento", "Cantidad", "Calorias_kcal", "Proteina_g", "Carbs_g", "Grasas_g"
      ]);
      var item = data.payload;
      sheetN.appendRow([data.date, item.name, item.qty, item.cal, item.prot, item.carb, item.fat]);
    }

    if (data.type === "weight") {
      var sheetP = getOrCreateSheet(ss, "Peso_Corporal", [
        "Fecha", "Peso_kg", "Cambio_vs_65kg", "Faltante_75kg"
      ]);
      var w = Number(data.payload.weight);
      sheetP.appendRow([data.payload.date, w, +(w - 65).toFixed(1), +(75 - w).toFixed(1)]);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
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

function readNutritionFromSheet(ss) {
  var sheet = ss.getSheetByName("Nutricion_Registros");
  if (!sheet || sheet.getLastRow() <= 1) return {};
  var rows = sheet.getDataRange().getValues();
  var logs = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var d = formatDateCell(r[0]);
    if (!logs[d]) logs[d] = [];
    logs[d].push({
      name: String(r[1]),
      qty: Number(r[2]),
      cal: Number(r[3]),
      prot: Number(r[4]),
      carb: Number(r[5]),
      fat: Number(r[6])
    });
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

function saveWorkoutRows(sheet, session) {
  var values = sheet.getDataRange().getValues();
  var keys = {};
  for (var i = 0; i < values.length; i++) keys[String(values[i][0])] = true;

  var newRows = [];
  for (var j = 0; j < session.exercises.length; j++) {
    var ex = session.exercises[j];
    var key = (session.date + "_" + session.split + "_" + ex.name).toLowerCase();
    if (!keys[key]) {
      var kg = ex.unit === "lbs" ? +(ex.weight / 2.20462).toFixed(1) : ex.weight;
      var noteFull = [ex.notes, session.sessionNotes].filter(Boolean).join(" | ");
      newRows.push([key, session.date, session.split, ex.name, ex.weight, ex.unit, kg, "'" + String(ex.reps), ex.status, noteFull]);
      keys[key] = true;
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