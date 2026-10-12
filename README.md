# Diario gym

Cuestionario para después de cada sesión de gimnasio (la rutina se hace en Nivel Bestia) e informe con cinco respuestas:

1. En qué ejercicios progresa la carga y en cuáles se estanca.
2. Evolución del dolor de rodilla (media por sesión de pierna, durante y a las 24 h).
3. Energía, sueño y recuperación entre sesiones.
4. Tolerancia a la cinta.
5. Sensaciones con cada día de la rutina.

React + TypeScript + Vite. Datos en Firestore (`users/{uid}/diario` y el campo `diarioConfig` de `users/{uid}`), o en el navegador si no hay sesión iniciada. Se publica en GitHub Pages con `.github/workflows/deploy.yml`.

- `npm test`: tests de la lógica del informe (`src/lib/report.ts`).
- Al abrir `https://carmenps04.github.io/gym-cx/` va al cuestionario si hoy no hay sesión registrada, o al informe si ya la hay.
