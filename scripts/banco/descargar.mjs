// Descarga las listas crudas y sus visitas a cache/. Se puede cortar y retomar: lo ya bajado no se repide.
// Uso: node scripts/banco/descargar.mjs [--refrescar id...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CATEGORIAS } from './categorias.mjs';
import { consultar, visitasDe } from './wikidata.mjs';

/** Sólo se piden visitas de los más conocidos de cada lista, para no abusar de la API. */
const TOPE_POR_CATEGORIA = 200;
const PAUSA_ENTRE_PEDIDOS_MS = 400;

const DIRECTORIO = new URL('./cache/', import.meta.url);
mkdirSync(DIRECTORIO, { recursive: true });
const ARCHIVO_VISITAS = new URL('_visitas.json', DIRECTORIO);

const argumentos = process.argv.slice(2);
const refrescar = new Set(argumentos[0] === '--refrescar' ? argumentos.slice(1) : []);
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

const visitas = existsSync(ARCHIVO_VISITAS) ? JSON.parse(readFileSync(ARCHIVO_VISITAS, 'utf8')) : {};
const guardarVisitas = () => writeFileSync(ARCHIVO_VISITAS, JSON.stringify(visitas));

async function listaDe(categoria) {
  const archivo = new URL(`${categoria.id}.json`, DIRECTORIO);
  if (existsSync(archivo) && !refrescar.has(categoria.id)) {
    return JSON.parse(readFileSync(archivo, 'utf8'));
  }
  const filas = await consultar(categoria.consulta, categoria.minimo ?? 0);
  writeFileSync(archivo, JSON.stringify(filas, null, 1));
  await esperar(1200);
  return filas;
}

let pendientes = 0;
const listas = [];
for (const categoria of CATEGORIAS) {
  try {
    const filas = await listaDe(categoria);
    const principales = [...filas].sort((a, b) => b.links - a.links).slice(0, TOPE_POR_CATEGORIA);
    listas.push({ categoria, principales });
    pendientes += principales.filter((f) => visitas[f.titulo] === undefined).length;
    console.log(`${categoria.id}: ${filas.length}`);
  } catch (error) {
    console.log(`${categoria.id}: ERROR ${error.message}`);
  }
}

const titulos = new Set(listas.flatMap((l) => l.principales.map((f) => f.titulo)));
const faltan = [...titulos].filter((t) => visitas[t] === undefined);
console.log(`Visitas: faltan ${faltan.length} de ${titulos.size}`);

let hechos = 0;
for (const titulo of faltan) {
  visitas[titulo] = await visitasDe(titulo);
  hechos += 1;
  if (hechos % 50 === 0) {
    guardarVisitas();
    console.log(`${hechos} de ${faltan.length}`);
  }
  await esperar(PAUSA_ENTRE_PEDIDOS_MS);
}
guardarVisitas();
console.log('Listo');
