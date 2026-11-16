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

function formatDateCell(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(val).split("T")[0];
}

function readWorkoutsFromSheet(sheet) {
  var rows = sheet.getDataRange().getValues();
  var map = {};
  var order = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1] || !r[3]) continue;
    var dateStr = formatDateCell(r[1]);
    var splitStr = String(r[2]);
    var sKey = dateStr + "_" + splitStr;

    if (!map[sKey]) {
      map[sKey] = { date: dateStr, split: splitStr, sessionNotes: "", exercises: [] };
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
  list.sort(function(a, b) { return a.date.localeCompare(b.date); });
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