# MRitmo

App de productividad para Android: planeas el día por tiempo, no por número de tareas.

- **Hoy**: tareas con duración. El progreso se pondera por tiempo (una tarea de 2 h pesa más que una de 15 min). Las pendientes de días anteriores se pueden traer a hoy.
- **Foco**: temporizador con la duración de cada tarea; sigue corriendo aunque salgas de la app.
- **Resumen**: semana en barras, cumplimiento y compartir tu día. El engranaje abre Configuración (nombre, personaje, tema, recordatorios).
- **Personaje pixel art**: duerme al 0 %, despierta al empezar, se pone de pie al pasar la mitad y celebra al 100 %.
- **Widgets**: *Estado* (personaje y avance, de 1×1 a 4×2) y *Foco* (iniciar, pausar o terminar la tarea sin abrir la app, 4×1 o 4×2).
- **Temporizador en vivo**: notificación con cuenta regresiva que Android 16 / One UI 8 promueve a Live Update (Now Bar).
- **Notificaciones**: aviso al terminar un bloque y recordatorios de mañana y noche.

Diseño monocromo: blanco en modo claro, negro en modo oscuro, tipografía Inter con tracking ajustado por tamaño y barra flotante de vidrio (blur real).

## Instalar en Android

Cada `push` a `main` compila el APK con GitHub Actions y lo publica en **Releases**.

1. En el celular, abre la pestaña **Releases** de este repositorio.
2. Descarga `MRitmo-N.apk` de la versión más reciente.
3. Ábrelo y permite "Instalar apps desconocidas" para tu navegador cuando Android lo pida.

## Firma propia

Si existen los secretos `RITMO_KEYSTORE_B64` y `RITMO_KEYSTORE_PASSWORD` en *Settings → Secrets and variables → Actions*, el APK se firma con la llave de MRitmo; si no, con la de pruebas.

## Cuentas, amigos y servidor

Supabase guarda el respaldo de cada cuenta, los perfiles, las amistades y el avance diario compartido (solo % y minutos), todo con Row Level Security. Las migraciones (`supabase/migrations/`), la Edge Function de notificaciones push (`supabase/functions/push`) y las plantillas de correo (`supabase/templates/`) se despliegan solas con el flujo **Servidor (Supabase)**. Configuración inicial: [`docs/SERVIDOR.md`](docs/SERVIDOR.md).

## Desarrollo

```bash
npm ci
npx expo start          # vista previa
npx tsc --noEmit        # typecheck
```

Stack: Expo SDK 57, React Native 0.86, TypeScript, Reanimated 4, expo-blur, AsyncStorage (datos locales en el teléfono).
