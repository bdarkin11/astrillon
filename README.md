# Astrillón

Un juego diario en castellano: te dan una consigna ("Nombrá una fruta") y cuanto más rara es tu respuesta, más lejos viaja tu nave por el sistema solar y más allá.

Se juega en https://astrillion.vercel.app.

## Cómo está hecho

- **TypeScript** sin frameworks: el DOM a mano y la escena en **Canvas 2D**, en pixel art. Los sonidos se generan en el navegador.
- **Vite** para desarrollar y armar el sitio, y **Vitest** para las pruebas.
- **Funciones de Vercel** (`api/`) como servidor, y **Supabase** (Postgres) como base.
- Se puede instalar como app (manifest y service worker en `public/`).

## Correrlo

```sh
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

En desarrollo no hace falta ninguna clave: el servidor local usa `src/datos/banco-ejemplo.json`, un banco chico y ficticio. `.env.example` explica las variables opcionales.

## El banco de respuestas no está acá

El juego depende de que nadie vea las respuestas antes de jugar, así que el banco real (consignas, respuestas válidas y niveles de rareza) no está en este repositorio. Vive en una tabla de Supabase que sólo lee el servidor con su clave, y se carga con `scripts/subir-banco.mjs` desde una copia local.

Además:

- El navegador sólo recibe el id y el texto de cada consigna (`src/datos/consignas-publicas.json`). Cada respuesta se valida en el servidor.
- El servidor recalcula el puntaje de cada viaje; el que manda el navegador no se usa.
- La lista completa de una consigna sólo se entrega con un pase firmado, que el servidor da al terminar un viaje con ella.
- La base sólo se usa a través de funciones que piden la clave del servidor (`supabase/migraciones/`).
- Hay un límite de pedidos por conexión (`src/servidor/limites.ts`) que guarda una huella cifrada de la IP, nunca la IP.
- Encabezados de seguridad en `vercel.json`.

## Estructura

```
api/              rutas del servidor (Vercel)
src/juego/        reglas: partida, validación, puntos, viaje del día, desafío
src/viaje/        escena, nave, copiloto, efectos y sonido
src/pantallas/    atlas y privacidad
src/servidor/     lógica del servidor, Supabase, límites y pases
src/datos/        banco de ejemplo y consignas públicas
scripts/          íconos, generación del banco desde Wikidata y subida a Supabase
supabase/         migraciones de la base
```
