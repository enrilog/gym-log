# Actualizar Apps Script desde GitHub

El flujo `.github/workflows/apps-script.yml` automatiza la actualización de la Web App existente. Se ejecuta bajo demanda, nunca por un push. El flujo queda disponible en GitHub cuando estos archivos están publicados en la rama principal. Requiere configurar el secreto antes de su primera ejecución.

## Configuración inicial (una vez)

1. Activa **Google Apps Script API** en https://script.google.com/home/usersettings con la cuenta propietaria del script.
2. En una computadora tuya con Node.js 22 o posterior, abre una terminal en una carpeta privada, fuera del repositorio, y ejecuta:

   ```sh
   npx --yes @google/clasp@3.4.1 -A ./gym-auth.json login
   ```

   Completa el inicio de sesión en el navegador de esa computadora. Este paso autoriza a clasp para acceder a Google; no crea ni despliega scripts. El archivo `gym-auth.json` contiene credenciales: no lo subas al repositorio ni lo envíes al chat.

3. En https://github.com/enrilog/gym-log/settings/secrets/actions crea un **Repository secret** con nombre `CLASP_AUTH_JSON`. Pega como valor el contenido completo de `gym-auth.json`. GitHub lo guardará como secreto para el flujo.
4. Sube los archivos de esta configuración al repositorio cuando quieras habilitar el flujo. Si GitHub Pages publica desde una rama, ten presente que subir también `index.html` a esa rama puede publicar la web por separado.

## Desplegar

En GitHub abre **Actions → Actualizar Apps Script → Run workflow**. Elige la rama con el código que quieres desplegar.

El flujo ejecuta las pruebas, instala clasp 3.4.1, descarga el proyecto remoto en una carpeta temporal y conserva su manifiesto, permisos, zona horaria y otros archivos. Sustituye únicamente el archivo remoto `Code`, hace push al proyecto y actualiza la implementación existente:

- Script: `1E7zY-3aed7xQiANQVtERhFh9JP_oHtePaARNJTuRgZKWl7hkjIklwyIw`
- Implementación: `AKfycbyW2T66yyOpkl7idL633Ekb3NF1jPOp0GXleTFnNvdOa9dI6d06A7BnzntYI0blFmUp`

Después consulta `/exec` y verifica el formato de fechas y el número de sesiones. No modifica las filas de Sheets ni publica `index.html`. Si no encuentra exactamente un archivo remoto `Code`, se detiene antes de enviar cambios.

Si falla después del push o del despliegue, revisa el paso fallido: un fallo de verificación no revierte automáticamente el código remoto. Para volver a una versión anterior, abre **Implementar → Gestionar implementaciones** en Apps Script y selecciona la versión previa.

Si Google revoca o caduca la autorización, repite el inicio de sesión y reemplaza el secreto. Algunas configuraciones OAuth en modo de prueba tienen autorizaciones de corta duración; la conexión no debe considerarse permanente.

## Validación local

```sh
node tests/dates.cjs
node tests/apps-script-deploy.cjs
```

Las pruebas no requieren credenciales ni escriben en Google. El despliegue real solo se puede comprobar después de configurar el secreto y ejecutar el flujo.
