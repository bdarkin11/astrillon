// Arma privado/banco-generado.json desde cache/ y curaduria.mjs, y muestra un resumen para revisar.
// Uso: node scripts/banco/generar.mjs [id de categoría para ver completa]
import { readFileSync, writeFileSync } from 'node:fs';
import { clave } from '../../src/juego/validar.ts';
import { CATEGORIAS } from './categorias.mjs';
import { CURADURIA } from '../../privado/curaduria.mjs';

/** Reparto por visitas, de la más vista a la menos, parecido al que tiene una buena consigna. */
const CORTES = [
  ['basura', 0.1],
  ['satelite', 0.4],
  ['cometa', 0.85],
  ['nebulosa', 1],
];
const TOPE_POR_CATEGORIA = 200;

const DIRECTORIO = new URL('./cache/', import.meta.url);
const visitas = JSON.parse(readFileSync(new URL('_visitas.json', DIRECTORIO), 'utf8'));
const verCompleta = process.argv[2];

const limpiarNombre = (nombre) => nombre.replace(/\s*\([^)]*\)\s*$/, '').trim();
const aliasValido = (alias) => alias.length >= 3 && !/^\d+$/.test(alias) && !/[=<>]/.test(alias);

function armarAlias(fila, categoria) {
  const alias = new Set(fila.alias.filter(aliasValido).map(limpiarNombre));
  const titulo = limpiarNombre(fila.titulo);
  if (titulo !== fila.nombre) alias.add(titulo);
  for (const patron of categoria.sacar ?? []) {
    const corto = fila.nombre.replace(patron, '').trim();
    if (corto && corto !== fila.nombre) alias.add(corto);
  }
  return [...alias];
}

/** Acepta el apellido solo cuando nadie más en la lista lo comparte. */
function agregarApellidos(filas) {
  const veces = new Map();
  const apellidoDe = (nombre) => {
    const partes = nombre.split(' ');
    return partes.length > 1 ? partes[partes.length - 1] : null;
  };
  for (const fila of filas) {
    const apellido = apellidoDe(fila.nombre);
    if (apellido) veces.set(clave(apellido), (veces.get(clave(apellido)) ?? 0) + 1);
  }
  for (const fila of filas) {
    const apellido = apellidoDe(fila.nombre);
    if (apellido && apellido.length >= 4 && veces.get(clave(apellido)) === 1) fila.alias.push(apellido);
  }
}

const NO_SON_NOMBRES = new Set(['senora', 'senor', 'dr', 'profesor', 'reverendo', 'fat', 'radioactive', 'santa', 'mary', 'bumblebee', 'lord', 'hans']);

/** Acepta el primer nombre solo ("Hermione", "Bart") cuando nadie más en la lista lo comparte. */
function agregarNombresDePila(filas) {
  const pilaDe = (nombre) => {
    const partes = nombre.split(' ');
    return partes.length > 1 ? partes[0] : null;
  };
  const veces = new Map();
  for (const fila of filas) {
    const pila = pilaDe(fila.nombre);
    if (pila) veces.set(clave(pila), (veces.get(clave(pila)) ?? 0) + 1);
  }
  for (const fila of filas) {
    const pila = pilaDe(fila.nombre);
    if (pila && pila.length >= 3 && veces.get(clave(pila)) === 1 && !NO_SON_NOMBRES.has(clave(pila))) fila.alias.push(pila);
  }
}

/** Si un alias choca con otra respuesta, se lo queda la más conocida. El nombre propio siempre gana. */
function resolverChoques(filas, prefijos) {
  const duenio = new Map();
  for (const fila of filas) duenio.set(clave(fila.nombre, prefijos), fila);
  for (const fila of filas) {
    fila.alias = fila.alias.filter((alias) => {
      const k = clave(alias, prefijos);
      if (!k || k === clave(fila.nombre, prefijos)) return false;
      if (duenio.has(k) && duenio.get(k) !== fila) return false;
      duenio.set(k, fila);
      return true;
    });
  }
}

const banco = [];
for (const categoria of CATEGORIAS) {
  const curada = CURADURIA[categoria.id] ?? {};
  let crudas;
  try {
    crudas = JSON.parse(readFileSync(new URL(`${categoria.id}.json`, DIRECTORIO), 'utf8'));
  } catch {
    console.log(`\n## ${categoria.id}: sin datos`);
    continue;
  }

  const excluidos = new Set((curada.excluir ?? []).map((n) => clave(n)));
  const vistos = new Set();
  const filas = crudas
    .sort((a, b) => b.links - a.links)
    .slice(0, TOPE_POR_CATEGORIA)
    .map((fila) => {
      const original = limpiarNombre(fila.nombre);
      const nuevo = curada.renombrar?.[original];
      const alias = armarAlias(fila, categoria);
      return {
        nombre: nuevo ?? original,
        alias: nuevo ? [...alias, original] : alias,
        visitas: visitas[fila.titulo] ?? 0,
      };
    })
    .filter((fila) => {
      const k = clave(fila.nombre);
      if (curada.excluirPatron?.test(fila.nombre)) return false;
      if (excluidos.has(k) || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .sort((a, b) => b.visitas - a.visitas);

  // Las respuestas que faltan en Wikidata se agregan a mano, con su nivel.
  for (const [nombre, valor] of Object.entries(curada.agregar ?? {})) {
    const [nivel, ...variantes] = Array.isArray(valor) ? valor : [valor];
    const existente = filas.find((f) => clave(f.nombre) === clave(nombre));
    if (existente) {
      existente.nivelFijo = nivel;
      existente.alias.push(...variantes);
    } else {
      filas.push({ nombre, alias: variantes, visitas: 0, nivelFijo: nivel });
    }
  }
  if (categoria.apellido) agregarApellidos(filas);
  if (categoria.nombrePila) agregarNombresDePila(filas);
  for (const [nombre, nivel] of Object.entries(curada.nivel ?? {})) {
    const fila = filas.find((f) => f.nombre === nombre);
    if (!fila) console.log(`  OJO ${categoria.id}: nivel para "${nombre}", que no está`);
    else fila.nivelFijo = nivel;
  }
  for (const [nombre, extras] of Object.entries(curada.alias ?? {})) {
    const fila = filas.find((f) => f.nombre === nombre);
    if (!fila) console.log(`  OJO ${categoria.id}: alias para "${nombre}", que no está`);
    else fila.alias.push(...extras);
  }
  if (curada.joya && !filas.some((f) => clave(f.nombre) === clave(curada.joya.nombre))) {
    console.log(`  OJO ${categoria.id}: la joya "${curada.joya.nombre}" no está`);
  }
  resolverChoques(filas, categoria.prefijos);

  const joya = clave(curada.joya?.nombre ?? '');
  const vivos = new Set((curada.vivos ?? []).map((n) => clave(n)));
  const normales = filas.filter((f) => clave(f.nombre) !== joya && !vivos.has(clave(f.nombre)) && !f.nivelFijo);

  const respuestas = filas.map((fila) => {
    const k = clave(fila.nombre);
    let nivel = fila.nivelFijo;
    if (k === joya) nivel = 'astrillon';
    else if (vivos.has(k)) nivel = 'vivo';
    else if (!nivel) {
      const fraccion = (normales.indexOf(fila) + 0.5) / normales.length;
      nivel = CORTES.find(([, corte]) => fraccion <= corte)[0];
    }
    return {
      nombre: fila.nombre,
      nivel,
      alias: fila.alias,
      ...(k === joya && curada.joya.dato ? { dato: curada.joya.dato } : {}),
    };
  });

  banco.push({
    id: categoria.id,
    texto: categoria.texto,
    ...(categoria.prefijos ? { prefijos: categoria.prefijos } : {}),
    respuestas,
  });

  const nombresDe = (nivel) => respuestas.filter((r) => r.nivel === nivel).map((r) => r.nombre);
  const muestra = (lista, n = 12) => (lista.length <= n ? lista : [...lista.slice(0, n / 2), '…', ...lista.slice(-n / 2)]).join(', ');
  console.log(`\n## ${categoria.id} (${respuestas.length})${curada.joya ? ` joya: ${curada.joya.nombre}` : ' SIN JOYA'}`);
  const completa = verCompleta === categoria.id;
  for (const nivel of ['basura', 'satelite', 'cometa', 'nebulosa']) {
    const lista = nombresDe(nivel);
    console.log(`  ${nivel} ${lista.length}: ${completa ? lista.join(', ') : muestra(lista)}`);
  }
}

const incompletas = banco.filter((c) => !c.respuestas.some((r) => r.nivel === 'astrillon')).map((c) => c.id);
console.log(`\n${banco.length} consignas, ${banco.reduce((s, c) => s + c.respuestas.length, 0)} respuestas.`);
if (incompletas.length) console.log(`Sin joya: ${incompletas.join(', ')}`);

writeFileSync(new URL('../../privado/banco-generado.json', import.meta.url), JSON.stringify(banco));
