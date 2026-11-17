# Referencias de porciones

El usuario pesa comida comprada con balanza. Se registra el peso cocido/listo para comer, sin recipiente; las frutas se pesan sin cáscara ni partes no comestibles. El selector permite gramos enteros entre 1 y 2000. No requiere introducir fracciones de porción.

| Alimento | Registro | Referencia |
| --- | --- | --- |
| Arroz cocido | Gramos, base 100 g | Valores anteriores por 150 g, convertidos proporcionalmente |
| Espagueti preparado | Gramos, base 100 g | Referencia provisional de 140 g para la porción anterior; receta estimada |
| Sope | Gramos, base 100 g | Usuario: 2 sopes ≈ 200 g; 1 ≈ 100 g |
| Frutas | Pieza mediana para frutas enteras; gramos para uvas, frutos rojos y frutas para cortar | 26 opciones: fruta fresca (papaya, sandía, melón, piña, mango, fresa, pera y más) y fruta deshidratada |
| Yogur griego natural | Cucharada sopera | Aproximadamente 15 g, 13 kcal según el catálogo anterior |
| Mantequilla de maní | Cucharada sopera | Aproximadamente 16 g, 95 kcal |

Las antiguas tazas y tazones se sustituyen por referencias en gramos. Las equivalencias provisionales están centralizadas en `WEIGHT_REFERENCES` en index.html y no se presentan como mediciones del usuario. Las calorías y macros dependen de la receta o marca; pesar una porción no determina su composición.

Pendiente: incorporar semanalmente los pesos que el usuario comparta y, cuando estén disponibles, los datos nutricionales de la receta/marca. No se ha programado un recordatorio.

El historial y la cola de envíos conservan su nombre, cantidad y nutrientes originales. Los nuevos registros usan nombre con base de 100 g y Cantidad = gramos / 100 para seguir siendo compatibles con el Apps Script existente. La app presenta la cantidad como gramos. No se necesita actualizar Apps Script para este cambio.

Las piezas medianas tienen pesos comestibles aproximados para calcular nutrientes (plátano 118 g, manzana 182 g, naranja 131 g). El usuario selecciona 1, 2 o más piezas; no necesita pesarlas. Los registros anteriores por gramos conservan sus valores.
