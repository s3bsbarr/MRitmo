# Ritmo — contexto del proyecto

> Documento vivo. Se actualiza con cada versión. Última versión descrita: **1.4** (13 oct 2026).
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
3. **Tus tareas son privadas.** Al respaldo va todo, pero solo tú puedes leerlo. Con amigos (futuro) solo se compartirá el avance (%), nunca los títulos.
4. **Funciona sin abrir la app:** widgets, notificaciones con botones y temporizador en vivo actúan aunque la app esté cerrada.
5. **Una sola fuente de verdad:** la app, los widgets y las notificaciones leen y escriben el mismo estado.

## 3. Diseño

- **Estilo:** iPhone / iOS 26: espacios amplios, tipografía con tracking ajustado por tamaño, liquid glass en la barra de navegación (desenfoque real).
- **Color:** monocromo. **Blanco** predominante en modo claro; **negro puro** en modo oscuro. El único "acento" es la tinta (negro en claro, blanco en oscuro). Rojo solo para acciones destructivas.
- **Tipografía:** Inter (lo más cercano a SF Pro). Títulos de página 39 pt, negrita, tracking negativo.
- **Iconos:** Ionicons, trazo consistente.
- **Movimiento:** resortes sin rebote para hojas; 0.97 de escala al presionar; nada de animaciones decorativas; respeta "reducir movimiento".
- **Skills de diseño usadas al construir:** Emil Kowalski (animación, apple-design, animate-expo) e Impeccable (craft floor, modo Operate).
- **Personaje pixel art estilo Habitica** (hombre o mujer). Ropa blanca con detalles negros en claro; ropa negra con contorno gris claro en oscuro. Estados según el % del día:
  - **0 %** — dormido sentado, con "z".
  - **1–49 %** — despierto, sentado.
  - **50–99 %** — de pie, concentrado.
  - **100 %** — brazos arriba haciendo fuerza, sonrisa.
- **Racha de hábitos:** ícono de fuego en el color de la tinta (negro en claro, blanco en oscuro).

## 4. Funciones actuales (1.4)

**Pantallas**
- **Hoy:** título, fecha, personaje, % del día, barra, tareas (programadas primero por hora), hábitos con racha, "Próximos días", traer pendientes de días anteriores. Mantener presionado → confirmación de eliminar con diseño propio.
- **Foco:** elegir tarea y temporizador con la duración de la tarea. Empezar, pausar, seguir, +5 min, terminé. Corre por reloj de pared (no se desfasa al salir).
- **Resumen:** barras de 7 días (planeado vs cumplido), tiempo cumplido, cumplimiento, días completos, estadísticas de hábitos (racha, mejor racha, constancia 30 días, últimos 7 días), compartir el día. Engranaje → Configuración.
- **Configuración:** cuenta (crear, iniciar sesión, respaldar ahora, cerrar sesión), nombre, personaje, apariencia (sistema/claro/oscuro), notificaciones con hora editable, aviso antes de tareas (no/5/10/15 min), temporizador en vivo (diagnóstico + atajo a ajustes de Live Updates), ayuda de widgets.
- **Bienvenida (primer inicio):** cómo se mide el día, nombre, personaje. Enlace "¿Ya tienes cuenta? Inicia sesión".

**Crear tarea / hábito**
- Duración con atajos (15 min … 2 h) o libre en horas y minutos.
- "Cuándo": por defecto **Ahora**; al tocar se elige día con pastillas (Hoy, Mañana, Mié 14…) y hora con el estilo de la app (sin calendarios).
- Casilla **"Repetir todos los días"** → se crea como hábito, con recordatorio opcional.

**Notificaciones** (todas con interruptor; horas configurables donde aplica)
- Motivación 6:30 a. m. (mensaje distinto cada día).
- Planear el día 8:00 a. m.; cerrar el día 8:30 p. m. (dice qué tareas y hábitos faltan).
- Día libre 10:00 a. m. si no hay tareas.
- Tarea próxima (N min antes) con botón "Empezar ahora".
- Tarea sin empezar a los 5 min con "Empezar" / "En 15 min".
- Quedan 2 min y fin de bloque **con sonido propio**, botones +5 min / +15 min / Terminé.
- Descanso 15 min después de cerrar la app con el día al 100 %.
- Recordatorio por hábito, con botón "Hecho".

**Fuera de la app**
- **Widget Estado:** 1×1 solo personaje; 2×2 personaje + % + barra; ancho personaje + % + minutos + barra.
- **Widget Foco (4×1 / 4×2):** siguiente tarea con Iniciar; en curso con Pausar/Terminé; en pausa con Seguir; tiempo cumplido con +5 min/Terminé. Funciona con la app cerrada.
- **Temporizador en vivo:** notificación fija con cuenta regresiva y botones +5 min / Pausar / Terminé. En Android 16 pide ser Live Update (chip en la barra de estado y Now Bar de Samsung).

**Cuenta y respaldo**
- Supabase (correo + contraseña). Respaldo automático unos segundos después de cada cambio y al volver a la app.
- Al reinstalar e iniciar sesión vuelve todo: tareas, hábitos, rachas, nombre, personaje, tema.
- Fusión segura entre teléfono y nube: gana el cambio más reciente, se conserva lo creado sin conexión, lo borrado no reaparece.

## 5. Arquitectura técnica (resumen)

- **Stack:** Expo SDK 57, React Native 0.86, TypeScript, Reanimated 4, expo-blur, expo-notifications, expo-task-manager, react-native-android-widget, Supabase JS, AsyncStorage.
- **Módulo nativo propio** `modules/ritmo-live` (Kotlin): notificación en vivo con ProgressStyle, botones, diagnóstico de Live Updates.
- **Estado:** `src/data.ts` (modelo y funciones puras), `src/actions.ts` (acciones desde widgets/notificaciones), `src/effects.ts` (planificador de notificaciones, temporizador, widgets), `src/sync.ts` (cuenta y respaldo).
- **Base de datos:** `supabase/migrations/` — tabla `user_state` (un documento por usuario, RLS). Tablas preparadas para la fase de amigos: `profiles`, `friendships`, `day_progress` (con Realtime) y `habits`/`habit_checks`.
- **Compilación:** GitHub Actions → `expo prebuild` → Gradle → firma con la llave de Ritmo → Release `vX.Y` con `Ritmo-X.Y.apk`.

## 6. Pendientes y hoja de ruta

**En curso / por verificar**
- Now Bar de Samsung (One UI 8.5): requiere la opción de desarrollador "Live notifications for all apps". En 1.4 la notificación cumple todos los requisitos de Android 16 (ProgressStyle); falta confirmar en el teléfono con el diagnóstico de Configuración.

**Siguiente fase**
- Amigos: buscar por usuario, solicitudes, ranking en vivo del % del día (solo se comparte el avance). Base de datos ya preparada.
- Onboarding breve después del registro (cómo funciona la app y qué datos guarda).
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

## 8. Cómo trabaja Sebas en este proyecto

- Prueba cada versión en su S24 y envía notas en este formato: **Errores**, **Diseño / UI**, **Funciones nuevas**, **Ideas sueltas**, con capturas cuando algo se ve mal.
- Quiere soluciones, no solo problemas: si algo es difícil o imposible, se plantea la alternativa concreta.
- Prefiere respuestas serias, sin emojis ni relleno, y valora que se le contradiga con buenos argumentos.
