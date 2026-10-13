# Ritmo — configuración del servidor (una sola vez)

Desde la 1.6 el servidor (base de datos, correos, notificaciones push, amigo bot) se actualiza solo con GitHub Actions. Tú solo configuras credenciales una vez. Todo se pega en **GitHub → repositorio MRitmo → Settings → Secrets and variables → Actions**.

| Nombre | Tipo | Para qué |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Secret | Aplicar migraciones, subir correos, desplegar funciones, manejar el bot |
| `SMTP_USER` | Secret | Gmail de la app (remitente de los correos) |
| `SMTP_PASS` | Secret | Contraseña de aplicación de ese Gmail (16 letras) |
| `GOOGLE_SERVICES_JSON` | Secret | Contenido completo de `google-services.json` (Firebase) |
| `EXPO_PROJECT_ID` | **Variable** (pestaña Variables) | ID del proyecto de Expo, para los tokens push |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_SENDER_NAME` | Secret, opcionales | Solo al pasar a un dominio propio |
| `EXPO_ACCESS_TOKEN` | Secret, opcional | Solo si activas "enhanced push security" en Expo |

## 1. Supabase (2 min)

1. Entra a supabase.com/dashboard/account/tokens → **Generate new token** → nombre `GitHub Ritmo` → copia el token (solo se muestra una vez).
2. En GitHub crea el secreto `SUPABASE_ACCESS_TOKEN` con ese valor.

## 2. Correo con Gmail (5 min)

1. Crea una cuenta de Gmail solo para la app (por ejemplo `ritmo.app.co@gmail.com`).
2. En esa cuenta: myaccount.google.com/security → **Verificación en dos pasos** → actívala (Google lo exige para el paso 3).
3. myaccount.google.com/apppasswords → nombre `Supabase Ritmo` → **Crear** → copia las 16 letras.
4. En GitHub crea `SMTP_USER` (el Gmail completo) y `SMTP_PASS` (las 16 letras; los espacios no importan).

El flujo "Servidor (Supabase)" configura lo demás: `smtp.gmail.com:465`, remitente "Ritmo", plantillas en español, código de 6 dígitos válido 1 hora, `ritmo://auth` como redirección permitida y 60 correos por hora (Gmail permite ~500 al día).

**Al comprar el dominio:** cambia `SMTP_USER` y `SMTP_PASS`, agrega `SMTP_HOST` y `SMTP_PORT` del proveedor (y `SMTP_FROM` si el remitente es distinto del usuario) y vuelve a ejecutar el flujo. No hay que tocar código.

## 3. Firebase (5 min)

1. console.firebase.google.com → **Crear proyecto** → nombre `Ritmo` → Google Analytics desactivado.
2. En el proyecto: **Agregar app → Android** → nombre del paquete `com.sebas.ritmo` → **Registrar app** → **Descargar google-services.json**. Los pasos siguientes del asistente (SDK) se saltan.
3. Abre `google-services.json`, copia todo el contenido y créalo como secreto `GOOGLE_SERVICES_JSON` en GitHub.
4. Engranaje → **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Se descarga otro JSON (la clave privada). Guárdalo en un lugar seguro; **nunca** va al repositorio. Lo usas en el paso 4.3.

## 4. Expo (5 min)

1. Crea una cuenta gratis en expo.dev.
2. **Create a project** → nombre `Ritmo`, slug `ritmo`. Copia el **ID del proyecto** (un UUID como `1a2b3c4d-…`).
3. En el proyecto: **Credentials → Android** → agrega el identificador `com.sebas.ritmo` → en **FCM V1 service account key** sube la clave privada del paso 3.4. (Los nombres del panel pueden variar un poco; buscas "FCM V1".)
4. En GitHub, pestaña **Variables** (no Secrets): crea `EXPO_PROJECT_ID` con el UUID.

## 5. Ejecutar

1. GitHub → **Actions → Servidor (Supabase) → Run workflow**. El resumen debe decir: migraciones aplicadas, plantillas subidas, SMTP propio y `Función desplegada: push`.
2. **Actions → Build APK → Run workflow** para recompilar la 1.6 con Firebase y el ID de Expo. Instala `Ritmo-1.6.apk` encima.
3. En la app: Resumen → engranaje → Notificaciones → **Amigos** debe decir "Solicitudes y quién te acepta, con la app cerrada". Si dice otra cosa, ese texto es el diagnóstico.

Si una migración falla por extensiones: Supabase → Database → Extensions → activa `pg_net` y `pg_cron`, y vuelve a ejecutar el flujo. Si el endpoint de SQL de Supabase cambia, los archivos de `supabase/migrations/` se pueden pegar en orden en el SQL Editor (todos se pueden ejecutar más de una vez).

## 6. Amigo bot

Cuenta de prueba `@amigobot` ("Amigo Bot", personaje mujer). Su avance se mueve solo cada minuto de 7:00 a 21:00 (Bogotá), entra en foco los primeros 25 minutos de cada hora y acepta sola las solicitudes que le envíes (en menos de un minuto).

Se maneja desde **Actions → Amigo bot → Run workflow** (app de GitHub o github.com en el navegador del teléfono):

| Acción | Qué hace |
|---|---|
| `preparar` | La primera vez. Escribe tu @usuario en el campo. Crea la cuenta, 7 días de historial (racha de 5) y te envía una solicitud. |
| `solicitud` | Te envía una solicitud nueva (para volver a probar esa notificación). |
| `avanzar` | +30 min a su día y la pone en foco 25 min. |
| `completar` | Termina su día (100 %). |
| `quitar` | Elimina la amistad. Agrégala desde la app y te acepta sola: prueba "Amigo Bot aceptó tu solicitud". |
| `estado` | Sus últimos días y las últimas notificaciones enviadas con su resultado (`ok 1/1`, `no devices`, `muted`…). |
