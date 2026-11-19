// Sube el banco real (privado/banco.ts) a la tabla banco de Supabase, reemplazando el anterior.
// Uso:
//   node scripts/subir-banco.mjs           revisa el banco y lo sube
//   node scripts/subir-banco.mjs --probar  sólo revisa, no sube nada
// Lee ASTRILLON_API_SECRETO de .env.local. El servidor del juego tarda hasta 5 minutos en ver el cambio.
import { existsSync, readFileSync } from 'node:fs';
import { createServer, loadEnv } from 'vite';

const URL_DE_SUPABASE = 'https://swelhidyaazqefkzxuvt.supabase.co';
const CLAVE_PUBLICA = 'sb_publishable_c81XtYsDGl1AL4Tb75ZQyQ_0udFbfAG';
const soloProbar = process.argv.includes('--probar');

if (!existsSync('privado/banco.ts')) {
  console.error('No está privado/banco.ts: el banco real sólo existe en la máquina de quien lo edita.');
  process.exit(1);
}

const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { CONSIGNAS } = await vite.ssrLoadModule('/privado/banco.ts');
const { problemasDelBanco } = await vite.ssrLoadModule('/src/datos/revisar-banco.ts');
await vite.close();

const problemas = problemasDelBanco(CONSIGNAS);
const publicas = JSON.parse(readFileSync('src/datos/consignas-publicas.json', 'utf8'));
if (JSON.stringify(publicas) !== JSON.stringify(CONSIGNAS.map(({ id, texto }) => ({ id, texto })))) {
  problemas.push('src/datos/consignas-publicas.json quedó desactualizado: correr node scripts/banco/generar-publicas.mjs');
}
if (problemas.length) {
  console.error(`El banco tiene ${problemas.length} problemas, no se sube:\n- ${problemas.slice(0, 20).join('\n- ')}`);
  process.exit(1);
}

const respuestas = CONSIGNAS.reduce((suma, c) => suma + c.respuestas.length, 0);
console.log(`Banco revisado: ${CONSIGNAS.length} consignas, ${respuestas} respuestas.`);
if (soloProbar) process.exit(0);

const secreto = loadEnv('development', process.cwd(), 'ASTRILLON_').ASTRILLON_API_SECRETO;
if (!secreto) {
  console.error('Falta ASTRILLON_API_SECRETO en .env.local.');
  process.exit(1);
}

const respuesta = await fetch(`${URL_DE_SUPABASE}/rest/v1/rpc/api_cargar_banco`, {
  method: 'POST',
  headers: { apikey: CLAVE_PUBLICA, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_secreto: secreto, p_consignas: CONSIGNAS }),
  signal: AbortSignal.timeout(30_000),
});
if (!respuesta.ok) {
  // El cuerpo del error de Supabase no incluye la clave: se puede mostrar.
  console.error(`Supabase respondió ${respuesta.status}: ${await respuesta.text()}`);
  process.exit(1);
}
console.log(`Listo: ${await respuesta.json()} consignas en la base.`);
