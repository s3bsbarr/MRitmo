# Ritmo

App de productividad para Android: planeas el día por tiempo, no por número de tareas.

- **Hoy**: tareas con duración. El progreso se pondera por tiempo (una tarea de 2 h pesa más que una de 15 min). Las pendientes de días anteriores se pueden traer a hoy.
- **Foco**: temporizador con la duración de cada tarea; sigue corriendo aunque salgas de la app.
- **Resumen**: semana en barras, cumplimiento, compartir tu día y tema (sistema, claro u oscuro).

Diseño monocromo: blanco en modo claro, negro en modo oscuro, tipografía Inter con tracking ajustado por tamaño y barra flotante de vidrio (blur real).

## Instalar en Android

Cada `push` a `main` compila el APK con GitHub Actions y lo publica en **Releases**.

1. En el celular, abre la pestaña **Releases** de este repositorio.
2. Descarga `Ritmo-N.apk` de la versión más reciente.
3. Ábrelo y permite "Instalar apps desconocidas" para tu navegador cuando Android lo pida.

## Desarrollo

```bash
npm ci
npx expo start          # vista previa
npx tsc --noEmit        # typecheck
```

Stack: Expo SDK 57, React Native 0.86, TypeScript, Reanimated 4, expo-blur, AsyncStorage (datos locales en el teléfono).
