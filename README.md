# Gym

App web para planificar rutinas, buscar ejercicios y registrar entrenamientos. React + TypeScript + Vite, con Firebase opcional para sincronizar entre dispositivos.

## Funciones

- **Crear rutina** en tres pasos: plan (nombre, días por semana, material), ejercicios por día (hasta 7, con «Decide por mí» que propone 3 ejercicios de un músculo) y revisión. No deja guardar si algún día está vacío. Se puede ver, editar y eliminar desde «Mis rutinas».
- **Entrenamiento**: rutinas ilimitadas, cada una con uno o varios días. Cada día puede tener días de la semana fijos (opcional), ejercicios, y series y repeticiones por ejercicio. Al entrenar se elige el día (se sugiere el de hoy o el siguiente en la rotación).
- **Buscador**: por nombre, músculo y material. Se ejecuta al pulsar «Buscar». Combina los filtros con «y» (nombre, músculo, material), y con «o» dentro de cada grupo (por ejemplo, pecho o tríceps).
- **Ejercicio**: imágenes de la posición, músculos, instrucciones y vídeo.
- **Cardio**: bicicleta, cinta, elíptica y otros, con minutos y, si aplica, kilómetros.
- **Sesión**: registro de peso y repeticiones por serie, temporizador de descanso, resumen y récords.
- **Progreso**, **Perfil** y **Ajustes** (tema, unidades kg/lb, descanso, material propio, copia de seguridad).

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # tests de búsqueda y estadísticas
npm run build    # comprobación de tipos + build en dist/
```

Sin configurar Firebase, los datos se guardan en el navegador (`localStorage`).

## Publicar con Firebase

La parte de Firebase no se ha podido probar en ejecución; está escrita contra la API v11 y conviene verificarla con tu proyecto.

1. Crea un proyecto en la consola de Firebase.
2. **Authentication**: activa los proveedores Google y Correo/contraseña. En *Settings → Authorized domains* añade el dominio de Hosting y `localhost`.
3. **Firestore**: crea la base de datos y publica las reglas (`firestore.rules`): `firebase deploy --only firestore:rules`.
4. **App web**: en *Project settings → Your apps* registra una app web y copia su configuración.
5. Copia `.env.example` a `.env.local` y rellena las variables `VITE_FIREBASE_*`.
6. Despliega:

   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add        # elige tu proyecto
   npm run build
   firebase deploy --only hosting
   ```

### Despliegue automático desde GitHub

El workflow `.github/workflows/deploy.yml` construye y despliega en cada push a `main`. Necesita estos *secrets* en el repositorio:

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT`: JSON de una cuenta de servicio con permisos de Hosting (se genera con `firebase init hosting:github`).

El proyecto de destino del despliegue se toma de `VITE_FIREBASE_PROJECT_ID`.

## Limitaciones conocidas

- **Vídeos**: el catálogo no incluye vídeos. Cada ejercicio ofrece un enlace de búsqueda en YouTube y un campo para pegar el enlace elegido, que queda incrustado y guardado.
- **Traducción**: los nombres en español se generaron con un glosario y reglas, no a mano; hay nombres torpes o incorrectos. Se corrigen en `scripts/overrides_es.json` y se regenera con `python3 scripts/build_exercises.py`. Las instrucciones están en inglés, con un botón para traducirlas con Google Translate.
- **Imágenes**: se cargan desde jsDelivr (repositorio `free-exercise-db`). Si ese servicio falla, se ven huecos vacíos.
- No hay mapa corporal ni modo sin conexión (PWA con service worker).

## Créditos

Catálogo de ejercicios e imágenes: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), dominio público.
