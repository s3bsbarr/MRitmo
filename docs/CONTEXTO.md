# Ritmo — contexto del proyecto

> Documento vivo. Se actualiza con cada versión. Última versión descrita: **1.6** (13 oct 2026).
> Repositorio: github.com/s3bsbarr/MRitmo · Descargas: pestaña Releases (v1.2, v1.3, v1.4…).

## 1. Qué es Ritmo

Ritmo es una app de productividad para Android que mide el día **en tiempo, no en número de tareas**. Cada tarea lleva su duración y el avance del día es la parte del tiempo planeado que ya se cumplió: una tarea de 2 h pesa ocho veces más que una de 15 min.

- **Inspiración:** Outdo (outdo.one): tareas con duración, progreso ponderado por tiempo y salas con ranking en vivo entre amigos.
- **Dueño y único usuario por ahora:** Sebas (Bogotá). La prueba en un Samsung Galaxy S24, Android 16, One UI 8.5.
- **Distribución actual:** APK firmado con llave propia, publicado en GitHub Releases. Sin Play Store por ahora: la decisión es seguir con APK mientras haya cambios frecuentes y pasar a cuenta de desarrollador cuando salgan versiones semanales estables.
- **Numeración:** versiones simples 1, 1.1, 1.2, 1.3, 1.4… Cada una se instala encima de la anterior.

## 2. Principios de producto (no negociables)

1. **El % del día solo mide tareas con duración.** Los hábitos no suman al %; tienen su propia métrica (racha).
2. **Cero gamificación ruidosa.** Nada de puntos, monedas ni confeti. La única "recompensa" es el personaje que cambia de postura y una vibración al llegar al 100 %.
3. **Tus tareas son privadas.** Al respaldo va todo, pero solo tú puedes leerlo. Con amigos solo se comparte el avance (% y minutos por día, y si estás en foco), nunca los títulos.
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
- **Racha:** ícono de fuego en el color de la tinta (negro en claro, blanco en oscuro). Se usa para hábitos y para la racha de días completos de un amigo.

## 4. Funciones actuales (1.6)

**Pantallas**
- **Hoy:** título, fecha, personaje, % del día, barra, tareas (programadas primero por hora), hábitos con racha, "Próximos días", traer pendientes de días anteriores. Mantener presionado → menú Editar / Eliminar (tareas y hábitos). Tocar el personaje lo hace saltar y sonreír.
- **Foco:** elegir tarea y temporizador con la duración de la tarea. Empezar, pausar, seguir, +5 min, terminé. Corre por reloj de pared (no se desfasa al salir).
- **Amigos:** ranking del día en vivo (tú + amigos) con el personaje de cada uno en su estado, % y minutos, indicador "en foco"; solicitudes (aceptar/rechazar), agregar por @usuario, enviadas (cancelar), compartir tu usuario, mantener presionado para eliminar amigo. Primero se elige un @usuario único. El campo de @usuario pasa mayúsculas a minúsculas y quita tildes mientras escribes, sin duplicar texto ni mover el cursor.
- **Hoja de amigo (1.6):** tocar a alguien en el ranking abre su hoja: personaje en su estado, % grande, minutos de hoy, "En foco", racha de días completos seguidos, días completos de la semana y barras de los últimos 7 días (solo %). Al final, "Eliminar amigo". Tocarte a ti muestra "Así te ven tus amigos". La hoja tiene un espacio reservado (children) para los hábitos compartidos y "Crear hábito juntos" de la 1.7.
- **Resumen:** barras de 7 días (planeado vs cumplido), tiempo cumplido, cumplimiento, días completos, estadísticas de hábitos (racha, mejor racha, constancia 30 días, últimos 7 días), compartir el día. Engranaje → Configuración.
- **Configuración:** cuenta (crear, iniciar sesión, respaldar ahora, cerrar sesión), nombre, personaje, apariencia (sistema/claro/oscuro), notificaciones con hora editable, interruptor **Amigos** (push del servidor, con diagnóstico en el subtítulo), aviso antes de tareas (no/5/10/15 min), temporizador en vivo (diagnóstico + atajo a ajustes de Live Updates), ayuda de widgets. La versión del pie se lee de la configuración de la app.
- **Bienvenida (primer inicio):** cómo se mide el día, nombre, personaje. Enlace "¿Ya tienes cuenta? Inicia sesión".

**Crear tarea / hábito**
- Duración con atajos (15 min … 2 h) o libre en horas y minutos.
- "Cuándo": por defecto **Ahora**; al tocar se elige día con pastillas (Hoy, Mañana, Mié 14…) y hora con el estilo de la app (sin calendarios).
- Casilla **"Repetir todos los días"** → se crea como hábito, con recordatorio opcional.

**Notificaciones locales** (todas con interruptor; horas configurables donde aplica)
- Motivación 6:30 a. m. (mensaje distinto cada día).
- Planear el día 8:00 a. m.; cerrar el día 8:30 p. m. (dice qué tareas y hábitos faltan).
- Día libre 10:00 a. m. si no hay tareas.
- Tarea próxima (N min antes) con botón "Empezar ahora".
- Tarea sin empezar a los 5 min con "Empezar" / "En 15 min".
- Quedan 2 min y fin de bloque **con sonido propio**, botones +5 min / +15 min / Terminé.
- Descanso 15 min después de cerrar la app con el día al 100 %.
- Recordatorio por hábito, con botón "Hecho".

**Notificaciones push del servidor (1.6)** — llegan con la app cerrada, canal "Amigos"
- "X te envió una solicitud" → abre Amigos.
- "X aceptó tu solicitud" → abre Amigos con la hoja de X.
- Freno anti-spam: el mismo aviso de la misma persona, como mucho una vez por hora (el amigo bot no tiene freno).
- Requiere Firebase + proyecto de Expo configurados (ver `docs/SERVIDOR.md`). Sin eso, la app funciona igual y Configuración dice qué falta.

**Fuera de la app**
- **Widget Estado:** 1×1 solo personaje; 2×2 personaje + % + barra; ancho personaje + % + minutos + barra.
- **Widget Foco (4×1 / 4×2):** siguiente tarea con Iniciar; en curso con Pausar/Terminé; en pausa con Seguir; tiempo cumplido con +5 min/Terminé. Funciona con la app cerrada.
- **Temporizador en vivo:** notificación fija con cuenta regresiva y botones +5 min / Pausar / Terminé. En Android 16 pide ser Live Update (chip en la barra de estado y Now Bar de Samsung).

**Cuenta y respaldo**
- Supabase (correo + contraseña, o "Entrar sin contraseña" con enlace al correo). Respaldo automático unos segundos después de cada cambio y al volver a la app.
- **Correos propios (1.6):** Gmail de la app como SMTP, plantillas en español con el estilo de Ritmo. Cada correo trae enlace **y código de 6 dígitos**: si el enlace se abre en el navegador en vez de en Ritmo, se escribe el código en la app.
- **Olvidé mi contraseña (1.6):** correo → enlace o código → pantalla "Nueva contraseña" dentro de la app.
- Al reinstalar e iniciar sesión vuelve todo: tareas, hábitos, rachas, nombre, personaje, tema.
- Fusión segura entre teléfono y nube: gana el cambio más reciente, se conserva lo creado sin conexión, lo borrado no reaparece.

## 5. Arquitectura técnica (resumen)

- **Stack:** Expo SDK 57, React Native 0.86, TypeScript, Reanimated 4, expo-blur, expo-notifications, expo-task-manager, expo-constants, react-native-android-widget, Supabase JS, AsyncStorage.
- **Módulo nativo propio** `modules/ritmo-live` (Kotlin): notificación en vivo con ProgressStyle, botones, diagnóstico de Live Updates.
- **Estado:** `src/data.ts` (modelo y funciones puras), `src/actions.ts` (acciones desde widgets/notificaciones), `src/effects.ts` (planificador de notificaciones locales, canales, temporizador, widgets), `src/sync.ts` (cuenta, respaldo, códigos de correo, nueva contraseña).
- **Amigos:** `src/friends.ts` (datos, tiempo real, historial publicado, racha), `src/screens/Friends.tsx`, `src/components/FriendSheet.tsx`, `src/components/UsernameField.tsx`. El avance se publica solo, 1.5 s después de cada cambio: hoy (con foco) y los últimos 60 días, solo los días que cambiaron, en una sola petición.
- **Push:** `src/push.ts` registra el token de Expo de cada teléfono en la cuenta (`register_push_token`), lo borra al cerrar sesión y guarda la preferencia en `notification_settings`. `app.config.js` añade `google-services.json` y el ID del proyecto de Expo solo en compilación.
- **Hápticos:** `src/haptics.ts` (misma API de expo-haptics, constantes del sistema en Android).
- **Base de datos** (`supabase/migrations/`, todas re-ejecutables, todo con RLS):
  - `user_state` (respaldo, un documento por usuario), `profiles` (@usuario, nombre, personaje), `friendships` (pendiente/aceptada; trigger que impide cambiar las partes o volver a pendiente), `day_progress` (minutos por día y foco, en tiempo real, visible solo para amigos).
  - 1.6: `push_tokens`, `notification_settings` (prefs jsonb: `{"friends": false}` apaga; clave ausente = encendida), `push_events` (cola con historial e intentos), `ritmo_bot`. `habits`/`habit_checks` eliminadas.
  - **Cómo viaja una push:** evento en la base → trigger escribe en `push_events` (con freno anti-spam `push_enqueue`) → otro trigger llama por pg_net a la Edge Function `push` → la función reclama el evento (`push_claim`, atómico, máx. 3 intentos), arma el texto en español, envía a Expo Push y lo cierra (`push_finish`, borra tokens muertos). pg_cron barre cada minuto lo que no salió. **Para la 1.7:** nuevo tipo = un `push_enqueue(...)` en un trigger + una entrada en `MESSAGES` de `supabase/functions/push/index.ts` (+ clave de preferencia `habits`).
- **Servidor como código:** `supabase/scripts/server.mjs` (API de gestión de Supabase con un solo token): `migrate` (aplica migraciones nuevas, registro en `ritmo_admin.migrations`, cada archivo en una transacción), `auth` (plantillas `supabase/templates/emails.mjs`, SMTP desde secretos, OTP de 6 dígitos, redirección `ritmo://auth`), `bot`.
- **Compilación y despliegue (GitHub Actions):**
  - `build-apk.yml`: `expo prebuild` → Gradle → firma con la llave de Ritmo → Release `vX.Y` con `Ritmo-X.Y.apk`. Escribe `google-services.json` desde el secreto y pasa `EXPO_PROJECT_ID`. No corre si solo cambian docs o `supabase/`.
  - `server.yml` ("Servidor (Supabase)"): migraciones + correos + Edge Functions, solo cuando cambia `supabase/`.
  - `bot.yml` ("Amigo bot"): acciones manuales del bot.
- **Amigo bot:** `@amigobot` ("Amigo Bot", mujer). pg_cron mueve su avance cada minuto (7:00–21:00 Bogotá), foco los primeros 25 min de cada hora, acepta solo las solicitudes. Acciones: preparar · solicitud · avanzar · completar · quitar · estado.
- **Secretos y variables de GitHub:** `RITMO_KEYSTORE_B64`, `RITMO_KEYSTORE_PASSWORD`, `SUPABASE_ACCESS_TOKEN`, `SMTP_USER`, `SMTP_PASS`, `GOOGLE_SERVICES_JSON`, variable `EXPO_PROJECT_ID`; opcionales `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_SENDER_NAME`, `EXPO_ACCESS_TOKEN`. Pasos completos en `docs/SERVIDOR.md`.

## 6. Pendientes y hoja de ruta

### Hoja de ruta hacia la 2.0

La **2.0** será la primera versión que Sebas comparta con amigos: todo lo social debe estar completo y sólido para entonces. Cada versión se diseña pensando en la siguiente.

| Versión | Contenido |
|---|---|
| **1.6** (construida) | Perfil de amigo (hoja), infraestructura push, correo propio, cuenta de prueba "amigo bot". |
| **1.7** | Hábitos compartidos con racha (en la hoja de amigo: hábitos compartidos y botón "Crear hábito juntos"; push de invitación y "X ya marcó, faltas tú"). |
| **1.8** | Salas con ranking propio, enlace de invitación que abre "Agregar a @usuario", ranking semanal. |
| **1.9** | Onboarding post-registro; controles de privacidad (ocultar avance, bloquear); eliminar cuenta y datos desde la app; aviso de nueva versión consultando GitHub Releases; casos límite (sin conexión, medianoche, cuenta eliminada). |
| **2.0** | Solo correcciones, instrucciones de instalación del APK y notas de versión para alguien que no es Sebas. |

**Regla de recorte:** si hay que recortar para que la 2.0 salga sólida, lo primero que se mueve a la 2.1 son las **salas**.

Notas de diseño para las siguientes versiones:
- 1.7: la tabla de hábitos compartidos debe vivir en la base (no en `user_state`), porque dos personas la marcan. Reutilizar `push_events` con tipos `habit_invite` y `habit_nudge`, preferencia `habits`, y el espacio `children` de `FriendSheet`.
- 1.8: el enlace de invitación puede ser `ritmo://agregar/<usuario>` (la ruta ya se parsea con parámetro en `App.tsx`); para que funcione fuera de la app hará falta una página web pequeña que redirija (o el dominio, si ya está comprado).
- 1.9: eliminar cuenta = Edge Function con llave secreta que borra el usuario de `auth.users` (todo cae en cascada). Bloquear = tabla `blocks` y que `are_friends`/`push_enqueue` la respeten.

### Por verificar en 1.6
- Configurar una vez Supabase, Gmail, Firebase y Expo (`docs/SERVIDOR.md`) y recompilar el APK.
- Probar con el amigo bot: solicitud recibida, aceptada, hoja con racha, foco en vivo, push con la app cerrada.
- Now Bar de Samsung: funciona desde 1.4 (ProgressStyle + opción de desarrollador "Live notifications for all apps"). En 1.5 el acento pasó de azul a blanco.

### Después de la 2.0
- App web / escritorio usando la misma cuenta.
- Extracción de tareas con IA (dictar o pegar texto y que se conviertan en tareas con duración).
- Dominio propio (plan: noviembre 2026); al tenerlo, solo se cambian los secretos SMTP.
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

## 8. Cómo trabaja Sebas en este proyecto

- Prueba cada versión en su S24 y envía notas en este formato: **Errores**, **Diseño / UI**, **Funciones nuevas**, **Ideas sueltas**, con capturas cuando algo se ve mal.
- Quiere soluciones, no solo problemas: si algo es difícil o imposible, se plantea la alternativa concreta.
- Prefiere respuestas serias, sin emojis ni relleno, y valora que se le contradiga con buenos argumentos.

## 9. Traspaso a un chat nuevo de construcción

Cuando un chat de construcción se llena, se abre uno nuevo dentro del proyecto RITMO con este mensaje:

> Sigamos construyendo Ritmo. El contexto está en CONTEXTO.md y el código en github.com/s3bsbarr/MRitmo (rama main). Clona el repo, lee CONTEXTO.md y AGENTS.md, y continúa desde la versión X.Y con estas notas: …

Datos que el chat nuevo necesita y ya están en el repo: flujo de compilación (`.github/workflows/build-apk.yml`), versión en `app.json` (`expo.version`), migraciones en `supabase/migrations/` (se aplican solas con `server.yml` al hacer push), Edge Functions en `supabase/functions/`, plantillas de correo en `supabase/templates/`, URL y llave publishable de Supabase en `src/sync.ts`, configuración del servidor en `docs/SERVIDOR.md`. La llave de firma y los demás secretos están en GitHub; nunca van al repositorio.

Notas para quien construye:
- La app **no** usa Expo Router (AGENTS.md lo menciona de forma genérica): la navegación es por pestañas en `App.tsx`.
- `npx expo install` no funciona desde el entorno de construcción (sin acceso a la API de Expo): se instala con npm usando la versión de `expo/bundledNativeModules.json`.
- Las migraciones se prueban contra un Postgres local con stubs de `auth`, `net` y `cron` antes de subirlas.
