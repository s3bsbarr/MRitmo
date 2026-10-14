# MRitmo — configuración del servidor (una sola vez)

Desde la 1.6 el servidor (base de datos, correos, notificaciones push, amigo bot) se actualiza solo con GitHub Actions. Tú solo configuras credenciales una vez. Todo se pega en **GitHub → repositorio MRitmo → Settings → Secrets and variables → Actions**.

| Nombre | Tipo | Para qué |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Secret | Aplicar migraciones, subir correos, desplegar funciones, manejar el bot |
| `SMTP_USER` | Secret | Buzón que envía los correos: `soporte@mritmo.com` |
| `SMTP_PASS` | Secret | Contraseña de ese buzón (la pega Sebas) |
| `SMTP_HOST`, `SMTP_PORT` | Secret | `smtp.hostinger.com` y `465` |
| `GOOGLE_SERVICES_JSON` | Secret | Contenido completo de `google-services.json` (Firebase) |
| `EXPO_PROJECT_ID` | **Variable** (pestaña Variables) | ID del proyecto de Expo, para los tokens push |
| `SMTP_FROM`, `SMTP_SENDER_NAME` | Secret, opcionales | Remitente distinto del buzón (por defecto el mismo) y nombre (por defecto "MRitmo") |
| `EXPO_ACCESS_TOKEN` | Secret, opcional | Solo si activas "enhanced push security" en Expo |

## 1. Supabase (2 min)

1. Entra a supabase.com/dashboard/account/tokens → **Generate new token** → nombre `GitHub MRitmo 1.8` → copia el token (solo se muestra una vez).
2. En GitHub crea o edita el secreto `SUPABASE_ACCESS_TOKEN` con ese valor (pégalo completo, empieza por `sbp_`). Si el flujo dice "JWT could not be decoded", el secreto quedó mal pegado.
3. Con el flujo funcionando, borra los tokens viejos en esa misma página.

## 2. Correo propio con Hostinger (desde la 1.8)

Los correos de la cuenta (activar, entrar sin contraseña, nueva contraseña) salen de **soporte@mritmo.com** por el SMTP de Hostinger.

1. hPanel → **Emails** → mritmo.com: el buzón `soporte@mritmo.com` ya existe (el plan permite 2).
2. En GitHub: `SMTP_USER` = `soporte@mritmo.com`, `SMTP_HOST` = `smtp.hostinger.com`, `SMTP_PORT` = `465` (ya están), y `SMTP_PASS` = la contraseña del buzón (la pega Sebas; nunca se escribe en un chat).
3. GitHub → Actions → **Servidor (Supabase)** → Run workflow. El resumen debe decir "SMTP propio con soporte@mritmo.com", "Plantillas en español subidas" y "los correos traen código, la app lo pide".

El flujo configura: remitente "MRitmo", plantillas en español, código de 6 dígitos válido 1 hora, `ritmo://auth` como redirección permitida, 60 correos por hora, y la bandera `app_flags.email_code` que hace que la app pida el código en "Revisa tu correo".

**DNS (hPanel → Dominios → mritmo.com → DNS):** ya están SPF (`v=spf1 include:_spf.mail.hostinger.com ~all`), DKIM (CNAME `hostingermail-a`, `-b` y `-c._domainkey`) y DMARC (`_dmarc`, hoy `p=none`). No hay que tocarlos para que los correos lleguen; cuando un correo real confirme que DKIM pasa, DMARC puede subir a `p=quarantine`.

**Para cambiar el buzón** (por ejemplo a hola@mritmo.com): crea el buzón en hPanel, cambia `SMTP_USER` y `SMTP_PASS` y vuelve a ejecutar el flujo. No hay que tocar código.

## 3. Firebase (5 min)

1. console.firebase.google.com → **Crear proyecto** → nombre `MRitmo` → Google Analytics desactivado.
2. En el proyecto: **Agregar app → Android** → nombre del paquete `com.sebas.ritmo` → **Registrar app** → **Descargar google-services.json**. Los pasos siguientes del asistente (SDK) se saltan.
3. Abre `google-services.json`, copia todo el contenido y créalo como secreto `GOOGLE_SERVICES_JSON` en GitHub.
4. Engranaje → **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Se descarga otro JSON (la clave privada). Guárdalo en un lugar seguro; **nunca** va al repositorio. Lo usas en el paso 4.3.

## 4. Expo (5 min)

1. Crea una cuenta gratis en expo.dev.
2. **Create a project** → nombre `MRitmo`, slug `mritmo`. Copia el **ID del proyecto** (un UUID como `1a2b3c4d-…`).
3. En el proyecto: **Credentials → Android** → agrega el identificador `com.sebas.ritmo` → en **FCM V1 service account key** sube la clave privada del paso 3.4. (Los nombres del panel pueden variar un poco; buscas "FCM V1".)
4. En GitHub, pestaña **Variables** (no Secrets): crea `EXPO_PROJECT_ID` con el UUID.

## 5. Ejecutar

1. GitHub → **Actions → Servidor (Supabase) → Run workflow**. El resumen debe decir: migraciones aplicadas, plantillas subidas, SMTP propio y `Función desplegada: push`.
2. **Actions → Build APK → Run workflow** para recompilar la 1.6 con Firebase y el ID de Expo. Instala `MRitmo-1.6.apk` encima.
3. En la app: Resumen → engranaje → Notificaciones → **Amigos** debe decir "Solicitudes y quién te acepta, con la app cerrada". Si dice otra cosa, ese texto es el diagnóstico.

Si una migración falla por extensiones: Supabase → Database → Extensions → activa `pg_net` y `pg_cron`, y vuelve a ejecutar el flujo. Si el endpoint de SQL de Supabase cambia, los archivos de `supabase/migrations/` se pueden pegar en orden en el SQL Editor (todos se pueden ejecutar más de una vez).

## 6. Amigo bot

Cuenta de prueba `@amigobot` ("Amigo Bot", personaje mujer). Su avance se mueve solo cada minuto de 7:00 a 21:00 (Bogotá), entra en foco los primeros 25 minutos de cada hora y acepta sola las solicitudes que le envíes (en menos de un minuto). Desde la 1.7 también acepta las invitaciones a hábitos juntos y marca sus hábitos un minuto después de aceptarlos (entre 7:00 y 21:00).

Se maneja desde **Actions → Amigo bot → Run workflow** (app de GitHub o github.com en el navegador del teléfono):

| Acción | Qué hace |
|---|---|
| `preparar` | La primera vez. Escribe tu @usuario en el campo. Crea la cuenta, 7 días de historial (racha de 5) y te envía una solicitud. |
| `solicitud` | Te envía una solicitud nueva (para volver a probar esa notificación). |
| `avanzar` | +30 min a su día y la pone en foco 25 min. |
| `completar` | Termina su día (100 %). |
| `quitar` | Elimina la amistad. Agrégala desde la app y te acepta sola: prueba "Amigo Bot aceptó tu solicitud". |
| `habito` | Te invita a un hábito juntos (escribe el título en el campo "usuario"; vacío = "Leer 20 minutos"). Prueba la invitación con el botón Aceptar. |
| `marcar` | Marca hoy sus hábitos juntos. Si tú no has marcado: "Amigo Bot ya marcó…, faltas tú" con el botón Hecho. Se puede repetir. |
| `sala` | Crea una sala y te invita (nombre en el campo "usuario"; vacío = "Sala de prueba"). Prueba la invitación con el botón Unirme; la sala aparece en Amigos → Salas. |
| `ocultar` | (1.9) Oculta su avance, o lo vuelve a mostrar. En tu ranking sale al final con "Avance oculto"; su hoja dice "Avance oculto". |
| `bloquear` | (1.9) Te bloquea, o te desbloquea. Bloqueada: desaparece de tu ranking, tus salas y la búsqueda de @amigobot, y se borran sus hábitos juntos. Al desbloquear, usa `solicitud` para volver a ser amigos. |
| `borrar` | (1.9) Elimina su cuenta igual que "Eliminar cuenta" en la app: desaparece de tu ranking, sus salas pasan al miembro más antiguo (tú) o se borran si estaba sola. `preparar` la vuelve a crear. |
| `estado` | Sus últimos días, sus hábitos juntos y las últimas notificaciones enviadas con su resultado (`ok 1/1`, `no devices`, `muted`…). |
