# MRitmo — contexto del proyecto

> Documento vivo. Se actualiza con cada versión. Última versión descrita: **1.8** (14 oct 2026), con la web legal y el consentimiento de cuenta del mismo día.
> Repositorio: github.com/s3bsbarr/MRitmo · Descargas: pestaña Releases (v1.2, v1.3, v1.4…).

## 1. Qué es MRitmo

**Nombre:** MRitmo ("My Ritmo"). Se adoptó en la 1.6 porque ritmo.com está ocupado y mritmo.com está libre (dominio planeado para noviembre 2026). Todo lo visible dice MRitmo: nombre de la app, widgets, correos, textos para compartir, APK (`MRitmo-X.Y.apk`). Por dentro se conservan a propósito los identificadores que no ve nadie y cuyo cambio rompería algo: paquete Android `com.sebas.ritmo` (cambiarlo obliga a desinstalar, y Firebase ya está registrado con él), esquema de enlaces `ritmo://` (redirecciones de Supabase y enlaces ya enviados), claves de almacenamiento `ritmo.*` (se perderían los datos del teléfono), nombres de tablas y del módulo nativo. El slug de Expo es `mritmo`.

MRitmo es una app de productividad para Android que mide el día **en tiempo, no en número de tareas**. Cada tarea lleva su duración y el avance del día es la parte del tiempo planeado que ya se cumplió: una tarea de 2 h pesa ocho veces más que una de 15 min.

- **Inspiración:** Outdo (outdo.one): tareas con duración, progreso ponderado por tiempo y salas con ranking en vivo entre amigos.
- **Dueño y único usuario por ahora:** Sebas (Bogotá). La prueba en un Samsung Galaxy S24, Android 16, One UI 8.5.
- **Web y dominio (1.8):** mritmo.com (Hostinger): página de MRitmo con descarga e instalación, puente de invitación `mritmo.com/u/<usuario>`, páginas legales (`/privacidad/`, `/terminos/`, `/cookies/`, `/reembolsos/`) y correo `soporte@mritmo.com`.
- **Distribución actual:** APK firmado con llave propia, publicado en GitHub Releases (y en mritmo.com/descargar, que siempre apunta al último). Sin Play Store por ahora: la decisión es seguir con APK mientras haya cambios frecuentes y pasar a cuenta de desarrollador cuando salgan versiones semanales estables.
- **Numeración:** versiones simples 1, 1.1, 1.2, 1.3, 1.4… Cada una se instala encima de la anterior.

## 2. Principios de producto (no negociables)

1. **El % del día solo mide tareas con duración.** Los hábitos no suman al %; tienen su propia métrica (racha).
2. **Cero gamificación ruidosa.** Nada de puntos, monedas ni confeti. La única "recompensa" es el personaje que cambia de postura y una vibración al llegar al 100 %.
3. **Tus tareas son privadas.** Al respaldo va todo, pero solo tú puedes leerlo. Con amigos solo se comparte el avance (% y minutos por día, y si estás en foco), nunca los títulos. La única excepción son los hábitos compartidos (1.7): su nombre lo eligen y lo ven los dos.
4. **Funciona sin abrir la app:** widgets, notificaciones con botones, temporizador en vivo y notificaciones push del servidor actúan aunque la app esté cerrada.
5. **Una sola fuente de verdad:** la app, los widgets y las notificaciones leen y escriben el mismo estado.

## 3. Diseño

- **Estilo:** iPhone / iOS 26: espacios amplios, tipografía con tracking ajustado por tamaño, liquid glass en la barra de navegación (desenfoque real).
- **Color:** monocromo. **Blanco** predominante en modo claro; **negro puro** en modo oscuro. El único "acento" es la tinta (negro en claro, blanco en oscuro). Rojo solo para acciones destructivas.
- **Tipografía:** Inter (lo más cercano a SF Pro). Títulos de página 39 pt, negrita, tracking negativo.
- **Iconos:** Ionicons, trazo consistente.
- **Vibración:** hápticos del sistema de Android (los de One UI) al cambiar de pestaña, abrir +, crear, completar (confirmación), eliminar (advertencia), entrar a ajustes, abrir la hoja de un amigo.
- **Sonidos:** fin de bloque con campanita de dos notas; resto de notificaciones (incluidas las de amigos) con un tono suave de una nota.
- **Barra de navegación:** vidrio más opaco y desvanecido inferior (scroll edge effect) para que el contenido no se vea cortado debajo.
- **Movimiento:** resortes sin rebote para hojas; 0.97 de escala al presionar; nada de animaciones decorativas; respeta "reducir movimiento".
- **Correos:** mismo estilo de la app: página blanca, tinta negra, un botón píldora y el código de 6 dígitos en una tarjeta gris. Español.
- **Skills de diseño usadas al construir:** Emil Kowalski (animación, apple-design, animate-expo) e Impeccable (craft floor, modo Operate).
- **Personaje pixel art estilo Habitica** (hombre o mujer). Ropa blanca con detalles negros en claro; ropa negra con contorno gris claro en oscuro. Estados según el % del día:
  - **0 %** — dormido sentado, con "z".
  - **1–49 %** — despierto, sentado.
  - **50–99 %** — de pie, concentrado.
  - **100 %** — brazos arriba haciendo fuerza, sonrisa.
- **Racha:** ícono de fuego en el color de la tinta (negro en claro, blanco en oscuro). Se usa para hábitos, para la racha de días completos de un amigo y para la racha compartida (con un ícono de personas al lado; el fuego se enciende solo cuando marcaron los dos).
- **Web mritmo.com:** mismo lenguaje que la app, pero el modo claro es **crema suave** (`#f7f3ea` fondo, `#ece6da` superficies, tinta `#18160f`): prueba del crema antes de llevarlo (o no) a la app. Modo oscuro negro puro. Selector Sistema / Claro / Oscuro arriba a la derecha (se recuerda en `localStorage` `mritmo.theme`, sin parpadeo). Todos los textos cumplen contraste WCAG AA en ambos modos.
- **Temporizador a pantalla completa (1.7):** siempre negro sobre blanco, también en modo oscuro, números lo más grandes que permita el ancho (Inter Bold, tracking negativo), botones píldora.

## 4. Funciones actuales (1.8)

**Pantallas**
- **Hoy:** título, fecha, personaje, % del día, barra, tareas (programadas primero por hora), hábitos con racha (los propios y, debajo, los compartidos con "Con Ana · ya marcó, faltas tú"), "Próximos días", traer pendientes de días anteriores. Mantener presionado → menú Editar / Eliminar (tareas y hábitos) o "Dejar hábito" (compartidos, se quita para los dos). Tocar el personaje lo hace saltar y sonreír.
- **Foco:** elegir tarea y temporizador con la duración de la tarea. Empezar, pausar, seguir, +5 min, terminé. Corre por reloj de pared (no se desfasa al salir). Botón de expandir → **pantalla completa** (1.7): negro sobre blanco, números enormes, +5 min / Pausar o Seguir / Terminé, pantalla siempre encendida mientras está abierta. Se abre también al tocar el temporizador en vivo (chip, Now Bar) con `ritmo://foco/completo`.
- **Amigos:** ranking en vivo (tú + amigos) con selector **Hoy | Semana** (1.8; la semana va de lunes a hoy y suma minutos), el personaje de cada uno en su estado, % y minutos, indicador "en foco"; salas; solicitudes (aceptar/rechazar), agregar por @usuario, enviadas (cancelar), **compartir tu usuario envía el enlace `https://mritmo.com/u/<usuario>`** (1.8), mantener presionado para eliminar amigo. Primero se elige un @usuario único. El campo de @usuario pasa mayúsculas a minúsculas y quita tildes mientras escribes, sin duplicar texto ni mover el cursor.
- **Hoja de amigo (1.6):** tocar a alguien en el ranking abre su hoja: personaje en su estado, % grande, minutos de hoy, "En foco", racha de días completos seguidos, días completos de la semana y barras de los últimos 7 días (solo %). Al final, "Eliminar amigo" (también quita los hábitos que tienen juntos). Tocarte a ti muestra "Así te ven tus amigos".
- **Hábitos juntos (1.7)**, en la hoja de amigo: invitaciones recibidas (Aceptar / Rechazar), hábitos activos con racha compartida y quién marcó hoy (se pueden marcar desde ahí), invitaciones enviadas (Cancelar) y botón **"Crear hábito juntos"**: nombre (máx. 60) con ideas rápidas (Leer 20 min, Entrenar, Meditar 10 min, Dormir antes de las 11) → "Invitar a X". Las invitaciones recibidas también salen en la pestaña Amigos, debajo de las solicitudes. Máximo 10 hábitos por pareja de amigos.
- **Salas (1.8):** sección "Salas" en Amigos. Crear sala (nombre de hasta 40 caracteres e invitar amigos), y cada sala tiene su propio ranking **Hoy | Semana**. Cualquier miembro invita a **sus** amigos; los miembros se ven el % y los minutos entre sí aunque no sean amigos. Invitación con Aceptar / Rechazar (también por push con botón **"Unirme"**). El dueño cambia el nombre, saca miembros (mantener presionado) o elimina la sala; cualquiera puede salir, y si sale el dueño la sala pasa al miembro más antiguo. Límites: 10 salas por persona, 20 personas por sala.
- **Enlace de invitación (1.8):** `https://mritmo.com/u/<usuario>`. Con la app instalada abre MRitmo directo en **"Agregar a @usuario"** (Android App Link verificado con `assetlinks.json`); sin la app, abre la página puente con "Abrir en MRitmo" y "Descargar MRitmo". También funciona `ritmo://agregar/<usuario>`.
- **Resumen:** barras de 7 días (planeado vs cumplido), tiempo cumplido, cumplimiento, días completos, estadísticas de hábitos (racha, mejor racha, constancia 30 días, últimos 7 días), compartir el día. Engranaje → Configuración.
- **Configuración:** cuenta (crear, iniciar sesión, respaldar ahora, cerrar sesión), nombre, personaje, apariencia (sistema/claro/oscuro), notificaciones con hora editable, interruptores **Amigos** y **Hábitos juntos** (push del servidor, con diagnóstico en el subtítulo), aviso antes de tareas (no/5/10/15 min), temporizador en vivo (diagnóstico con la plantilla usada: números grandes o barra, + atajo a ajustes de Live Updates), ayuda de widgets. La versión del pie se lee de la configuración de la app.
- **Crear cuenta (consentimiento, 14 oct 2026):** casilla obligatoria "Acepto los Términos y autorizo el tratamiento de mis datos según la Política de privacidad" con enlaces a mritmo.com; sin marcarla no se habilita "Crear cuenta". La prueba de la autorización (versión `LEGAL_VERSION` de `src/sync.ts` y fecha) queda en los metadatos del usuario de Supabase (`raw_user_meta_data.consent`). La cuenta sigue siendo opcional: sin cuenta no sale ningún dato del teléfono.
- **Bienvenida (primer inicio):** cómo se mide el día, nombre, personaje. Enlace "¿Ya tienes cuenta? Inicia sesión".

**Crear tarea / hábito**
- Duración con atajos (15 min … 2 h) o libre en horas y minutos.
- "Cuándo": por defecto **Ahora**; al tocar se elige día con pastillas (Hoy, Mañana, Mié 14…) y hora con el estilo de la app (sin calendarios).
- Casilla **"Repetir todos los días"** → se crea como hábito, con recordatorio opcional.

**Notificaciones locales** (todas con interruptor; horas configurables donde aplica)
- Motivación 6:30 a. m. (mensaje distinto cada día).
- Planear el día 8:00 a. m.; cerrar el día 8:30 p. m. (dice qué tareas y hábitos faltan, incluidos los compartidos).
- Día libre 10:00 a. m. si no hay tareas.
- Tarea próxima (N min antes) con botón "Empezar ahora".
- Tarea sin empezar a los 5 min con "Empezar" / "En 15 min".
- Quedan 2 min y fin de bloque **con sonido propio**, botones +5 min / +15 min / Terminé.
- Descanso 15 min después de cerrar la app con el día al 100 %.
- Recordatorio por hábito, con botón "Hecho".

**Notificaciones push del servidor** — llegan con la app cerrada, canal "Amigos"
- "X te envió una solicitud" → abre Amigos. (1.6)
- "X aceptó tu solicitud" → abre Amigos con la hoja de X. (1.6)
- "X te invitó a un hábito" con botón **Aceptar** (acepta sin abrir la app) → abre la hoja de X. (1.7)
- "X aceptó «título»" → abre Hoy. (1.7)
- "X te invitó a «sala»" con botón **Unirme** → abre la sala. Usa el interruptor Amigos. (1.8)
- "X ya marcó «título»" / "Faltas tú para que la racha avance hoy", con botón **Hecho** (marca sin abrir la app). Solo si el otro aún no marcó; como mucho una vez por hábito y día. (1.7)
- Interruptores separados: Amigos (`friends`) y Hábitos juntos (`habits`).
- Freno anti-spam: el mismo aviso de la misma persona, como mucho una vez por hora; desde la 1.7 el freno puede ir por clave (`payload.dedupe`), así dos hábitos distintos no se frenan entre sí (el amigo bot no tiene freno).
- Requiere Firebase + proyecto de Expo configurados (ver `docs/SERVIDOR.md`). Sin eso, la app funciona igual y Configuración dice qué falta.

**Fuera de la app**
- **Widget Estado:** 1×1 solo personaje; 2×2 personaje + % + barra; ancho personaje + % + minutos + barra.
- **Widget Foco (4×1 / 4×2):** siguiente tarea con Iniciar; en curso con Pausar/Terminé; en pausa con Seguir; tiempo cumplido con +5 min/Terminé. Funciona con la app cerrada.
- **Temporizador en vivo:** notificación fija con cuenta regresiva y botones +5 min / Pausar / Terminé. Es Live Update (chip en la barra de estado y Now Bar de Samsung). **Android 17 / One UI 9 (1.7):** usa `MetricStyle` con una sola métrica de cuenta regresiva ("Quedan"), así el tiempo ocupa la vista expandida en grande y lo cuenta el sistema; en pausa muestra "En pausa" con el tiempo fijo. **Android 16 / One UI 8.5:** sigue con `ProgressStyle` (barra) como en la 1.6. Tocarlo abre el temporizador a pantalla completa en la app.

**Cuenta y respaldo**
- Supabase (correo + contraseña, o "Entrar sin contraseña" con enlace al correo). Respaldo automático unos segundos después de cada cambio y al volver a la app.
- **Correos propios (1.8):** salen de **soporte@mritmo.com** por el SMTP de Hostinger (`smtp.hostinger.com:465`), con remitente "MRitmo" y plantillas en español con el estilo de la app. Cada correo trae enlace **y código de 6 dígitos**: si el enlace se abre en el navegador en vez de en MRitmo, se escribe el código en la app. DNS del dominio: SPF (`include:_spf.mail.hostinger.com`), DKIM (3 CNAME `hostingermail-a/b/c._domainkey`) y DMARC.
- **"Revisa tu correo" según el correo (1.7; desde la 1.8 con código):** la app lee la bandera pública `app_flags.email_code` (la pone el flujo del servidor según haya SMTP propio; se guarda en el teléfono). Sin correo propio, el paso no pide código: explica que el correo llega de Supabase Auth en inglés, que se toque el enlace desde el teléfono, y trae el botón **"Abrir el correo"** (abre la bandeja de la app de correo), Reenviar y Usar otro correo. Con correo propio vuelve el campo de código. Al abrir un enlace de activación o de entrada, la hoja se cierra sola.
- **Olvidé mi contraseña (1.6):** correo → enlace o código → pantalla "Nueva contraseña" dentro de la app.
- Al reinstalar e iniciar sesión vuelve todo: tareas, hábitos, rachas, nombre, personaje, tema.
- Fusión segura entre teléfono y nube: gana el cambio más reciente, se conserva lo creado sin conexión, lo borrado no reaparece.

## 5. Arquitectura técnica (resumen)

- **Stack:** Expo SDK 57, React Native 0.86, TypeScript, Reanimated 4, expo-blur, expo-notifications, expo-task-manager, expo-constants, react-native-android-widget, Supabase JS, AsyncStorage.
- **Módulo nativo propio** `modules/ritmo-live` (Kotlin): notificación en vivo (MetricStyle en Android 17 por reflexión, porque el proyecto compila con SDK 36; ProgressStyle en 16), botones, diagnóstico de Live Updates con la plantilla usada, `openEmailApp()` y `keepScreenOn()`.
- **Estado:** `src/data.ts` (modelo y funciones puras), `src/actions.ts` (acciones desde widgets/notificaciones), `src/effects.ts` (planificador de notificaciones locales, canales, temporizador, widgets), `src/sync.ts` (cuenta, respaldo, códigos de correo, nueva contraseña).
- **Amigos:** `src/friends.ts` (datos, tiempo real, historial publicado, racha), `src/screens/Friends.tsx`, `src/components/FriendSheet.tsx`, `src/components/UsernameField.tsx`.
- **Salas y ranking semanal (1.8):** `src/rooms.ts` (crear, invitar, unirse, salir, sacar, eliminar, ranking), `src/components/RoomSheet.tsx`, `src/components/BoardList.tsx` (lista de ranking con selector Hoy | Semana, compartida por Amigos y salas), `weekStartOf`/`weekOfMine` en `src/friends.ts`. Enlace: `inviteLink()` en `Friends.tsx`; `App.tsx` convierte `https://mritmo.com/u/<usuario>` en `ritmo://agregar/<usuario>`; `app.json` declara el App Link (`autoVerify`, host mritmo.com, `/u/`).
- **Web (1.8):** `site/` (index, `privacidad/`, `terminos/`, `cookies/`, `reembolsos/` (cada una `index.html`), `u/index.html` puente, `fonts/inter.woff2` + `OFL.txt` (Inter alojada en el propio dominio, sin Google Fonts), `site.js` (selector de tema, personaje, versión desde `/version.json`), `.htaccess` con `/descargar` y la reescritura de `/u/<usuario>`, `.well-known/assetlinks.json` con la huella SHA-256 de la llave de firma). El flujo "Web (mritmo.com)" publica `site/` en la rama `web`; Hostinger (hPanel → mritmo.com → despliegue desde GitHub, app de GitHub de Hostinger) despliega esa rama en `public_html`. Cada release publica también `MRitmo.apk` con nombre fijo para `/descargar`. **Sin terceros en la web:** ni cookies, ni analíticas, ni fuentes o scripts externos; la versión, tamaño y fecha del APK salen de `/version.json`, que escribe el flujo Web desde la última release (Build APK relanza el flujo Web al publicar), así los visitantes no llaman a la API de GitHub. `.htaccess` añade cabeceras de seguridad (CSP solo `self`, HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options). El encabezado, el selector de tema y el pie están copiados en cada página (no hay plantillas): al cambiar uno, cambiar todos.
- **Hábitos compartidos (1.7):** `src/shared.ts` (servidor, copia en el teléfono `ritmo.shared.v1`, cola de marcas sin conexión, racha compartida, tiempo real), hook `useShared` en `src/store.ts`, `src/components/SharedHabits.tsx` (sección de la hoja de amigo). Los botones de push (`ACCEPT_SHARED`, `CHECK_SHARED`) pasan por `applyAction` y funcionan con la app cerrada. `Snapshot.shared` hace que "Cierra tu día" cuente los compartidos pendientes.
- **Temporizador a pantalla completa (1.7):** `src/components/FocusFull.tsx`, abierto desde `Focus` (`full`/`onFull` en `App.tsx`). El avance se publica solo, 1.5 s después de cada cambio: hoy (con foco) y los últimos 60 días, solo los días que cambiaron, en una sola petición.
- **Push:** `src/push.ts` registra el token de Expo de cada teléfono en la cuenta (`register_push_token`), lo borra al cerrar sesión y guarda la preferencia en `notification_settings`. `app.config.js` añade `google-services.json` y el ID del proyecto de Expo solo en compilación.
- **Hápticos:** `src/haptics.ts` (misma API de expo-haptics, constantes del sistema en Android).
- **Base de datos** (`supabase/migrations/`, todas re-ejecutables, todo con RLS):
  - `user_state` (respaldo, un documento por usuario), `profiles` (@usuario, nombre, personaje), `friendships` (pendiente/aceptada; trigger que impide cambiar las partes o volver a pendiente), `day_progress` (minutos por día y foco, en tiempo real, visible solo para amigos).
  - 1.6: `push_tokens`, `notification_settings` (prefs jsonb: `{"friends": false}` apaga; clave ausente = encendida; 1.7 añade `habits`), `push_events` (cola con historial e intentos), `ritmo_bot`. `habits`/`habit_checks` eliminadas.
  - 1.8 (`20261016000000_ritmo_1_8_rooms.sql`): `rooms` (nombre, dueño) y `room_members` (`invited`/`joined`, quién invitó), `create_room()`, `is_room_member()`, `share_a_room()`, política para que los miembros lean el avance (`day_progress`) entre sí, guardias (10 salas, 20 personas, solo el dueño pasa la sala y solo a un miembro), al salir el dueño la sala pasa al más antiguo, push `room_invite`, el bot acepta salas (`ritmo_bot_room`).
  - 1.7 (`20261015000000_ritmo_1_7_shared_habits.sql`): `shared_habits` (título, quien invita, `partner`, `pending`/`active`; guardia: partes fijas, solo el invitado acepta, no vuelve a pendiente, máx. 10 por pareja; solo se invita a amigos), `shared_habit_checks` (una marca por persona y día, solo lo propio, solo hábitos activos, solo ±1 día de hoy), `is_shared_member()`, trigger que borra los hábitos compartidos al eliminar la amistad, triggers de push (`habit_invite`, `habit_accepted`, `habit_nudge`), ambas tablas en tiempo real, `app_flags` (legible sin sesión; `email_code`), el bot acepta y marca (`ritmo_bot_habits` cada minuto, `ritmo_bot_invite`, `ritmo_bot_check`).
  - **Cómo viaja una push:** evento en la base → trigger escribe en `push_events` (con freno anti-spam `push_enqueue`) → otro trigger llama por pg_net a la Edge Function `push` → la función reclama el evento (`push_claim`, atómico, máx. 3 intentos), arma el texto en español, envía a Expo Push y lo cierra (`push_finish`, borra tokens muertos). pg_cron barre cada minuto lo que no salió. **Nuevo tipo de push** = un `push_enqueue(...)` en un trigger + una entrada en `MESSAGES` de `supabase/functions/push/index.ts` (con `pref` y, si lleva botones, `categoryId` registrado en `CAT` de `src/effects.ts`).
- **Servidor como código:** `supabase/scripts/server.mjs` (API de gestión de Supabase con un solo token): `migrate` (aplica migraciones nuevas, registro en `ritmo_admin.migrations`, cada archivo en una transacción), `auth` (plantillas `supabase/templates/emails.mjs`, SMTP desde secretos, OTP de 6 dígitos, redirección `ritmo://auth`, y desde la 1.7 la bandera `app_flags.email_code`), `bot`.
- **Compilación y despliegue (GitHub Actions):**
  - `build-apk.yml`: `expo prebuild` → Gradle → firma con la llave de MRitmo → Release `vX.Y` con `MRitmo-X.Y.apk`. Escribe `google-services.json` desde el secreto y pasa `EXPO_PROJECT_ID`. No corre si solo cambian docs o `supabase/`.
  - `server.yml` ("Servidor (Supabase)"): migraciones + correos + Edge Functions, solo cuando cambia `supabase/`.
  - `bot.yml` ("Amigo bot"): acciones manuales del bot.
- **Amigo bot:** `@amigobot` ("Amigo Bot", mujer). pg_cron mueve su avance cada minuto (7:00–21:00 Bogotá), foco los primeros 25 min de cada hora, acepta solo las solicitudes y (1.7) las invitaciones de hábitos, y marca sus hábitos compartidos un minuto después de aceptarlos (dentro de 7:00–21:00). Acciones: preparar · solicitud · avanzar · completar · quitar · **habito** (te invita; el título va en el campo "usuario") · **marcar** (marca hoy → "ya marcó, faltas tú") · **sala** (1.8: crea una sala y te invita; el nombre va en "usuario") · estado (incluye sus hábitos juntos). Su correo `amigo.bot@mritmo.com` no es un buzón real y no recibe correos (la cuenta se creó ya confirmada), así que no hace falta cambiarlo.
- **Secretos y variables de GitHub:** `RITMO_KEYSTORE_B64`, `RITMO_KEYSTORE_PASSWORD`, `SUPABASE_ACCESS_TOKEN`, `SMTP_USER` (soporte@mritmo.com), `SMTP_PASS`, `SMTP_HOST` (smtp.hostinger.com), `SMTP_PORT` (465), `GOOGLE_SERVICES_JSON`, variable `EXPO_PROJECT_ID`; opcionales `SMTP_FROM`, `SMTP_SENDER_NAME`, `EXPO_ACCESS_TOKEN`. Claude no escribe contraseñas ni tokens: `SUPABASE_ACCESS_TOKEN` y `SMTP_PASS` los pega Sebas. Pasos completos en `docs/SERVIDOR.md`.

## 6. Pendientes y hoja de ruta

### Hoja de ruta hacia la 2.0

La **2.0** será la primera versión que Sebas comparta con amigos: todo lo social debe estar completo y sólido para entonces. Cada versión se diseña pensando en la siguiente.

| Versión | Contenido |
|---|---|
| **1.6** (construida) | Perfil de amigo (hoja), infraestructura push, correo propio, cuenta de prueba "amigo bot". |
| **1.7** (construida) | Hábitos compartidos con racha (hoja de amigo, Hoy, push de invitación, aceptación y "ya marcó, faltas tú" con botones). Temporizador en vivo con números grandes (MetricStyle, Android 17) y pantalla completa al tocarlo. "Revisa tu correo" sin código mientras no haya correo propio. |
| **1.8** (construida) | Salas con ranking propio, enlace de invitación `mritmo.com/u/usuario` que abre "Agregar a @usuario", ranking semanal, web en mritmo.com, correo propio desde soporte@mritmo.com. Las salas no se recortaron. |
| **1.9** | Onboarding post-registro; controles de privacidad (ocultar avance, bloquear); eliminar cuenta y datos desde la app; aviso de nueva versión consultando GitHub Releases; casos límite (sin conexión, medianoche, cuenta eliminada). |
| **2.0** | Solo correcciones, instrucciones de instalación del APK y notas de versión para alguien que no es Sebas. |

**Regla de recorte:** si hay que recortar para que la 2.0 salga sólida, lo primero que se mueve a la 2.1 son las **salas**.

Decisión del temporizador en vivo (13 oct 2026), tras investigar la documentación vigente:
- Un Live Update lo dibuja el sistema. Google exige: sin vista personalizada (RemoteViews), sin `setColorized(true)`, estilo estándar, BigText, Call, Progress o **Metric**, canal no MIN, título y `ongoing`. Con vista propia o fondo de color se pierde la promoción (chip, Now Bar, lugar fijo en la pantalla bloqueada).
- En Android 16 / One UI 8.5 la vista expandida de ProgressStyle muestra el cronómetro pequeño en el encabezado: no hay forma de agrandarlo ni de forzar blanco con números negros sin perder la promoción.
- Android 17 trae `MetricStyle` (hasta 3 métricas grandes, 3 botones, cuenta regresiva que dibuja el sistema con `TimeDifference.forTimer`, apto para Live Update, también en pantalla bloqueada y AOD). One UI 9 (Android 17) empezó a llegar al S24 en octubre de 2026.
- Opciones mostradas a Sebas: A (MetricStyle en 17), B (vista propia exacta, pierde la promoción), C (pantalla completa en la app al tocar). **Eligió A + C.** El color de la vista expandida lo pone el sistema (negro sobre blanco en modo claro); la pantalla completa es siempre negro sobre blanco.
- Pendiente de confirmar en el S24 con One UI 9: que Samsung muestre la métrica grande en la Now Bar (Configuración → Temporizador en vivo → Plantilla debe decir "Números grandes"). Si dice "Barra (falló la de números)", la reflexión no encontró la API y hay que revisar las firmas.

Notas de diseño para las siguientes versiones:
- Posibles mejoras de hábitos compartidos: recordatorio con hora (hoy solo los propios lo tienen; para los compartidos avisa el push del otro), estadísticas en Resumen, renombrar.
- 1.9: eliminar cuenta = Edge Function con llave secreta que borra el usuario de `auth.users` (todo cae en cascada). **Ojo:** `rooms.owner` es `on delete cascade`, así que hoy borrar al dueño borra la sala de todos; antes de borrar, pasar sus salas al miembro más antiguo (como al salir). La política de privacidad (sección 7, ancla `#eliminar`) dice que hoy se pide por correo; cuando exista el botón, actualizarla. Bloquear = tabla `blocks` y que `are_friends`/`push_enqueue` la respeten.

### Dominio, web y correo (1.8, 14 oct 2026)
- **Dominio:** mritmo.com comprado en Hostinger (octubre, por promoción, en vez de noviembre). Sitio PHP/HTML en el plan Premium de Hostinger (uno de los espacios libres). DNS en Hostinger (nameservers `dns-parking.com`), con CDN de Hostinger y SSL.
- **Web publicada:** portada con el estilo de la app (personaje en 4 estados, "Descargar para Android" con versión y tamaño leídos de GitHub Releases, cómo instalar), puente `/u/<usuario>` y `assetlinks.json`. Google ya verifica el vínculo mritmo.com ↔ `com.sebas.ritmo` (API Digital Asset Links). Para cambiar la web basta con editar `site/` en main: el flujo actualiza la rama `web` y Hostinger la despliega.
- **Correo:** buzón `soporte@mritmo.com` (plan Starter Business Email, 2 buzones; queda 1 libre). Decisión de Sebas: los correos de la app salen de soporte@ (no se creó hola@). Al haber SMTP, el flujo del servidor sube las plantillas y pone `app_flags.email_code = true`, y la app vuelve a pedir el código.
- **Correo verificado (14 oct 2026):** un "Entrar sin contraseña" real llegó a Gmail en **Principal** (no spam), en español, con código de 6 dígitos y remitente "MRitmo" <soporte@mritmo.com>; Gmail marcó **SPF pass, DKIM pass (d=mritmo.com, selector hostingermail-a) y DMARC pass**.
- Problema encontrado y resuelto en la prueba: `SMTP_USER` seguía con hola@mritmo.com (de una sesión anterior) y Hostinger rechazaba el inicio de sesión (535). Se corrigió a soporte@ y `server.mjs` ya no le quita los espacios a la contraseña salvo con Gmail.
- **DMARC (pendiente de Sebas, opcional):** hoy `v=DMARC1; p=none`. Como SPF y DKIM pasan alineados, conviene cambiarlo a `v=DMARC1; p=quarantine` en hPanel → Dominios → mritmo.com → DNS → registro TXT `_dmarc` → Editar (Claude no puede editar DNS).
- El servidor de la app sigue en Supabase; Hostinger solo sirve páginas y correo.

### Web legal y cumplimiento (14 oct 2026)
- **Marco aplicado (Colombia):** Ley 1581 de 2012 y Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) para datos personales; Ley 1480 de 2011 (Estatuto del Consumidor) para reembolsos y garantías. El proyecto de ley que reforma la 1581 (PLE 282 de 2026 Cámara) sigue en trámite: revisar si se aprueba (traería oficial de datos y reporte de incidentes más estricto).
- **Páginas:** Política de privacidad (responsable, datos y finalidades, autorización, derechos, encargados y transmisión internacional, plazos de 10 y 15 días hábiles, menores, seguridad, vigencia), Términos (edad, instalación del APK, cuenta, qué ven otros, uso aceptable, propiedad intelectual "todos los derechos reservados", responsabilidad sin renunciar a la Ley 1480, ley colombiana y jueces de Bogotá), Cookies (no hay cookies; solo `mritmo.theme` en localStorage si el visitante elige tema; por eso **no hay banner de consentimiento**) y Reembolsos (app gratuita; si algún día hay pagos: retracto 5 días hábiles, art. 47, y reversión del pago, art. 51).
- **Decisiones de Sebas:** código con **todos los derechos reservados** (el LICENSE decía "Copyright 650 Industries (Expo)", herencia de la plantilla; se reemplazó); **edad 18+, o menores con permiso del padre, madre o acudiente**.
- **Registro Nacional de Bases de Datos (SIC):** no aplica: solo obliga a sociedades y entidades sin ánimo de lucro con activos de más de 100.000 UVT; las personas naturales están excluidas.
- **Pendiente de Sebas:** el Decreto 1377 pide en la política nombre, domicilio, dirección, correo y teléfono del responsable. Hoy dice "persona natural con domicilio en Bogotá" + soporte@mritmo.com. Falta su **nombre completo**, una **dirección de correspondencia** y un **teléfono** (puede ser un número solo para MRitmo). Al tenerlos, añadirlos en la sección 1 de `site/privacidad/` y en la sección 1 de `site/terminos/`.
- **Si cambian los términos o la privacidad en lo sustancial:** subir `LEGAL_VERSION` en `src/sync.ts`, cambiar la fecha/versión de las páginas y avisar en la app.

### Token de Supabase (14 oct 2026)
- El secreto `SUPABASE_ACCESS_TOKEN` de GitHub quedó dañado ("JWT could not be decoded") y por eso falló el despliegue del servidor del commit de la 1.8 (salas sin aplicar en la base real).
- **Rotado (14 oct 2026):** Sebas generó un token nuevo, lo pegó en GitHub y borró el que quedó escrito en un chat; Claude borró "GitHub MRitmo" (nunca usado). Solo existe el token nuevo y el flujo "Servidor (Supabase)" funciona: migración de salas aplicada, plantillas subidas, `email_code` activo, función `push` desplegada.

### Por verificar (1.6 a 1.8)
- Supabase, Firebase y Expo ya están configurados (13 oct 2026): secretos `SUPABASE_ACCESS_TOKEN`, `GOOGLE_SERVICES_JSON` y variable `EXPO_PROJECT_ID` en GitHub; clave FCM V1 en el proyecto de Expo `@sebasbarrs-team/mritmo` (paquete `com.sebas.ritmo`); migraciones 1.6 aplicadas y función `push` desplegada. APK `MRitmo-1.6.apk` compilado con push.
- Amigo bot preparado con @sebas (13 oct 2026, flujo "Amigo bot" → preparar): le envió una solicitud.
- Probar con el amigo bot: solicitud recibida, aceptada, hoja con racha, foco en vivo, push con la app cerrada.
- Probar 1.7: crear hábito con Amigo Bot desde su hoja (lo acepta en menos de un minuto → "Amigo Bot aceptó…"; un minuto después marca → "Amigo Bot ya marcó…, faltas tú" con botón Hecho), acción `habito` (invitación con botón Aceptar), racha compartida en Hoy, botones con la app cerrada, "Revisa tu correo" sin código, pantalla completa al tocar la Now Bar, y la plantilla grande cuando llegue One UI 9.
- Probar 1.8: enlace `mritmo.com/u/sebas` desde otro teléfono o desde WhatsApp (con la app: abre "Agregar a @usuario"; sin la app: página puente), compartir usuario desde Amigos, ranking Hoy | Semana, crear sala con Amigo Bot (la acepta sola) y acción `sala` (push con botón Unirme), crear cuenta o "Olvidé mi contraseña" escribiendo el código del correo en la app.
- Now Bar de Samsung: funciona desde 1.4 (ProgressStyle + opción de desarrollador "Live notifications for all apps"). En 1.5 el acento pasó de azul a blanco.

### Después de la 2.0
- App web / escritorio usando la misma cuenta.
- Extracción de tareas con IA (dictar o pegar texto y que se conviertan en tareas con duración).
- Cuenta de desarrollador de Android (verificación obligatoria global en 2027) cuando las versiones sean semanales; opción gratuita de distribución limitada hasta 20 dispositivos.

**Ideas sueltas registradas**
- Más estados o atuendos del personaje (sin convertirlo en juego de recompensas).
- Plantillas de día (rutinas que se cargan con un toque).

## 7. Historial de versiones

| Versión | Fecha | Cambios principales |
|---|---|---|
| 1 | 12 oct 2026 | Tareas por tiempo, Foco, Resumen, liquid glass, modo claro/oscuro, personaje pixel art (3 estados). |
| 1.1 | 12 oct 2026 | Duración libre, Configuración, bienvenida, estado dormido, widgets Estado y Foco, temporizador en vivo, notificaciones básicas. |
| 1.2 | 12 oct 2026 | Programar tareas, hábitos con racha, set completo de notificaciones con botones y sonido, widget 4×1 rediseñado, confirmación de eliminar, horas configurables. Primera versión firmada con llave propia. |
| 1.3 | 13 oct 2026 | Cuentas con respaldo y restauración (Supabase), widgets ajustados al tamaño real, títulos más grandes. |
| 1.4 | 13 oct 2026 | Temporizador en vivo rehecho para cumplir los requisitos de Live Updates de Android 16 (ProgressStyle) y diagnóstico en Configuración. |
| 1.5 | 13 oct 2026 | Amigos con ranking en vivo, editar tareas y hábitos, vibración en toda la app, Now Bar en blanco, desvanecido bajo la barra, sonido suave en notificaciones, personaje que salta al tocarlo, entrar sin contraseña. |
| 1.6 | 13 oct 2026 | Hoja de amigo (racha y 7 días), push del servidor (solicitud y aceptación) con interruptor, correo propio con plantillas en español y código de 6 dígitos, "Olvidé mi contraseña" con nueva contraseña en la app, amigo bot, servidor desplegado por GitHub Actions, arreglo del @usuario que duplicaba texto, cierre de un hueco que permitía fabricar amistades, tablas `habits`/`habit_checks` eliminadas. |
| 1.7 | 13 oct 2026 | Hábitos compartidos con racha (invitar desde la hoja de amigo, en el Hoy de los dos, push de invitación / aceptación / "ya marcó, faltas tú" con botones Aceptar y Hecho, interruptor propio), temporizador en vivo con números grandes en Android 17 (MetricStyle) y pantalla completa negro sobre blanco al tocarlo, "Revisa tu correo" sin código mientras no haya correo propio (con "Abrir el correo"), la hoja de cuenta se cierra sola al abrir el enlace, el amigo bot acepta y marca hábitos. |
| 1.8 | 14 oct 2026 | Salas con ranking propio (Hoy y Semana, invitar amigos, push con "Unirme"), ranking semanal en Amigos, enlace `mritmo.com/u/usuario` con Android App Links y "Agregar a @usuario", compartir usuario con el enlace, web mritmo.com en Hostinger (descarga, instalación, puente, assetlinks) desplegada desde la rama `web`, correo propio desde soporte@mritmo.com con código de 6 dígitos, token de Supabase rotado. |
| 1.8 (web) | 14 oct 2026 | Web: modo claro crema con selector Sistema/Claro/Oscuro, páginas de privacidad, términos, cookies y reembolsos, Inter alojada en mritmo.com y versión del APK sin llamar a GitHub, accesibilidad (contraste AA, foco visible, saltar al contenido), cabeceras de seguridad. App: casilla de consentimiento al crear cuenta con prueba de la autorización (recompila la 1.8). LICENSE: todos los derechos reservados. |

## 8. Cómo trabaja Sebas en este proyecto

- Prueba cada versión en su S24 y envía notas en este formato: **Errores**, **Diseño / UI**, **Funciones nuevas**, **Ideas sueltas**, con capturas cuando algo se ve mal.
- Quiere soluciones, no solo problemas: si algo es difícil o imposible, se plantea la alternativa concreta.
- Prefiere respuestas serias, sin emojis ni relleno, y valora que se le contradiga con buenos argumentos.

## 9. Traspaso a un chat nuevo de construcción

Cuando un chat de construcción se llena, se abre uno nuevo dentro del proyecto RITMO con este mensaje:

> Sigamos construyendo MRitmo. El contexto está en CONTEXTO.md y el código en github.com/s3bsbarr/MRitmo (rama main). Clona el repo, lee CONTEXTO.md y AGENTS.md, y continúa desde la versión X.Y con estas notas: …

Datos que el chat nuevo necesita y ya están en el repo: flujo de compilación (`.github/workflows/build-apk.yml`), versión en `app.json` (`expo.version`), migraciones en `supabase/migrations/` (se aplican solas con `server.yml` al hacer push), Edge Functions en `supabase/functions/`, plantillas de correo en `supabase/templates/`, URL y llave publishable de Supabase en `src/sync.ts`, configuración del servidor en `docs/SERVIDOR.md`. La llave de firma y los demás secretos están en GitHub; nunca van al repositorio.

Notas para quien construye:
- La app **no** usa Expo Router (AGENTS.md lo menciona de forma genérica): la navegación es por pestañas en `App.tsx`.
- `npx expo install` no funciona desde el entorno de construcción (sin acceso a la API de Expo): se instala con npm usando la versión de `expo/bundledNativeModules.json`.
- Las migraciones se prueban contra un Postgres local con stubs de `auth`, `net` y `cron` antes de subirlas.
