import { MODOS } from '../juego/modos.js';
import { NIVELES } from '../juego/niveles.js';
import { calcularPuntos } from '../juego/partida.js';
import type { Consigna } from '../juego/tipos.js';
import { validar } from '../juego/validar.js';
import { paseDe, paseValido } from './pases.js';

const LARGO_MAXIMO = 80;
const JUGADAS_MAXIMAS = 100;
const FORMATO_DE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_DE_JUGADOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que el servidor necesita de la base. Se inyecta para poder probar la lógica sin base de datos. */
export interface Registro {
  /** El banco completo: consignas con sus respuestas y niveles. Sólo lo lee el servidor. */
  banco(): Promise<Consigna[]>;
  respuesta(consignaId: string, respuesta: string, tipo: 'aceptada' | 'rechazada'): Promise<void>;
  reporte(consignaId: string, texto: string): Promise<void>;
  partida(datos: { jugador: string; fecha: string | null; modo: string; total: number; consignas: number }): Promise<{ percentil: number | null; muestras: number }>;
  /** Cuántas veces se aceptó cada respuesta de una consigna, con el nombre en minúsculas. */
  conteos(consignaId: string): Promise<{ respuesta: string; cuenta: number }[]>;
}

export class ErrorDePedido extends Error {
  readonly estado: number;
  constructor(mensaje: string, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

/** Cuánto dura en memoria la copia del banco antes de volver a pedirlo. */
export const DURACION_DEL_BANCO_MS = 5 * 60_000;

type Banco = Map<string, Consigna>;
const copias = new WeakMap<Registro, { banco: Promise<Banco>; vence: number; anterior?: Banco }>();

async function pedirBanco(registro: Registro): Promise<Banco> {
  const consignas = await registro.banco();
  if (!consignas.length) throw new Error('El banco llegó vacío');
  return new Map(consignas.map((c) => [c.id, c]));
}

/**
 * El banco se pide a la base una vez y queda unos minutos en memoria, así cada respuesta no es
 * una consulta. Si la base no contesta al renovarlo, se sigue con la copia anterior.
 */
export async function bancoDe(registro: Registro, ahora = Date.now()): Promise<Banco> {
  const copia = copias.get(registro);
  if (copia && copia.vence > ahora) return copia.banco;
  const anterior = copia ? await copia.banco.catch(() => copia.anterior) : undefined;
  const banco = pedirBanco(registro).catch((error: unknown) => {
    if (!anterior) {
      copias.delete(registro);
      throw error;
    }
    console.error('No se pudo renovar el banco, sigo con la copia anterior:', error);
    return anterior;
  });
  copias.set(registro, { banco, vence: ahora + DURACION_DEL_BANCO_MS, anterior });
  return banco;
}

function consignaDe(banco: Banco, id: unknown): Consigna {
  const consigna = typeof id === 'string' ? banco.get(id) : undefined;
  if (!consigna) throw new ErrorDePedido('Consigna desconocida', 404);
  return consigna;
}

function textoValido(texto: unknown): string {
  if (typeof texto !== 'string') throw new ErrorDePedido('Falta el texto');
  const limpio = texto.trim();
  if (!limpio || limpio.length > LARGO_MAXIMO) throw new ErrorDePedido('Texto inválido');
  return limpio;
}

/** Guardar es secundario: si falla la base, el jugador igual tiene que poder jugar. */
async function sinFrenar(accion: Promise<void>): Promise<void> {
  try {
    await accion;
  } catch (error) {
    console.error('No se pudo registrar:', error);
  }
}

export async function responder(cuerpo: { consignaId?: unknown; texto?: unknown }, registro: Registro) {
  const consigna = consignaDe(await bancoDe(registro), cuerpo.consignaId);
  const texto = textoValido(cuerpo.texto);
  const validacion = validar(texto, consigna);
  if (validacion.tipo === 'aceptada') {
    const { nombre, nivel, dato } = validacion.respuesta;
    await sinFrenar(registro.respuesta(consigna.id, nombre, 'aceptada'));
    return { tipo: 'aceptada' as const, respuesta: { nombre, nivel, alias: [], ...(dato ? { dato } : {}) } };
  }
  if (validacion.tipo === 'correccion') {
    return { tipo: 'correccion' as const, sugerencia: { nombre: validacion.sugerencia.nombre } };
  }
  await sinFrenar(registro.respuesta(consigna.id, texto, 'rechazada'));
  return { tipo: 'rechazada' as const };
}

const SIN_PASE = 'Las respuestas se ven al terminar un viaje con esta consigna';

/** Las respuestas de una consigna, para la bitácora del final del viaje. Pide el pase que dio terminar. */
export async function respuestasDe(consignaId: unknown, pase: unknown, registro: Registro) {
  const consigna = consignaDe(await bancoDe(registro), consignaId);
  if (!(await paseValido(consigna.id, pase))) throw new ErrorDePedido(SIN_PASE, 403);
  return consigna.respuestas.map(({ nombre, nivel, dato }) => ({ nombre, nivel, ...(dato ? { dato } : {}) }));
}

/** Hasta tener esta cantidad de respuestas aceptadas, los porcentajes no se muestran: con pocas serían ruido. */
export const MUESTRAS_PARA_PORCENTAJES = 100;

export interface Porcentajes {
  muestras: number;
  respuestas: { nombre: string; porcentaje: number }[];
}

/**
 * Qué porcentaje de los viajeros dio cada respuesta. Devuelve null mientras falten datos o si la base no responde.
 * Con el pase da la lista entera; sin pase, sólo el porcentaje de la respuesta que se pregunta, que el jugador
 * ya conoce porque la acaba de dar: así no se puede sacar la lista de una consigna antes de jugarla.
 */
export async function porcentajesDe(consignaId: unknown, registro: Registro, opciones: { pase?: unknown; respuesta?: unknown } = {}): Promise<Porcentajes | null> {
  const consigna = consignaDe(await bancoDe(registro), consignaId);
  const conPase = await paseValido(consigna.id, opciones.pase);
  if (!conPase && typeof opciones.respuesta !== 'string') throw new ErrorDePedido(SIN_PASE, 403);
  let conteos: { respuesta: string; cuenta: number }[];
  try {
    conteos = await registro.conteos(consigna.id);
  } catch (error) {
    console.error('No se pudieron leer los porcentajes:', error);
    return null;
  }
  // La base guarda el nombre en minúsculas: se vuelve al nombre del banco, y lo que ya no está se descarta.
  const porNombre = new Map(consigna.respuestas.map((r) => [r.nombre.trim().toLowerCase(), r.nombre]));
  const validos = conteos.filter((c) => porNombre.has(c.respuesta) && c.cuenta > 0);
  const muestras = validos.reduce((suma, c) => suma + Number(c.cuenta), 0);
  if (muestras < MUESTRAS_PARA_PORCENTAJES) return null;
  const respuestas = validos
    .map((c) => ({ nombre: porNombre.get(c.respuesta)!, porcentaje: Math.round((Number(c.cuenta) / muestras) * 1000) / 10 }))
    .sort((a, b) => b.porcentaje - a.porcentaje);
  if (conPase) return { muestras, respuestas };
  return { muestras, respuestas: respuestas.filter((r) => r.nombre === opciones.respuesta) };
}

export async function reportar(cuerpo: { consignaId?: unknown; texto?: unknown }, registro: Registro) {
  const consigna = consignaDe(await bancoDe(registro), cuerpo.consignaId);
  await registro.reporte(consigna.id, textoValido(cuerpo.texto));
  return { ok: true };
}

interface Jugada {
  consignaId?: unknown;
  texto?: unknown;
  turbo?: unknown;
}

/** Vuelve a calcular el puntaje con el banco: el total que mande el navegador no se usa nunca. */
export async function calcularTotal(jugadas: Jugada[], registro: Registro): Promise<number> {
  const banco = await bancoDe(registro);
  let total = 0;
  for (const jugada of jugadas) {
    const consigna = consignaDe(banco, jugada.consignaId);
    if (typeof jugada.texto !== 'string' || !jugada.texto.trim()) continue;
    const validacion = validar(jugada.texto, consigna);
    if (validacion.tipo === 'aceptada') total += calcularPuntos(NIVELES[validacion.respuesta.nivel], jugada.turbo === true);
  }
  return total;
}

export async function terminar(cuerpo: { jugador?: unknown; fecha?: unknown; modo?: unknown; jugadas?: unknown }, registro: Registro) {
  if (typeof cuerpo.jugador !== 'string' || !FORMATO_DE_JUGADOR.test(cuerpo.jugador)) throw new ErrorDePedido('Jugador inválido');
  if (typeof cuerpo.modo !== 'string' || !MODOS.some((m) => m.id === cuerpo.modo)) throw new ErrorDePedido('Modo inválido');
  const fecha = cuerpo.fecha === null || cuerpo.fecha === undefined ? null : cuerpo.fecha;
  if (fecha !== null && (typeof fecha !== 'string' || !FORMATO_DE_FECHA.test(fecha))) throw new ErrorDePedido('Fecha inválida');
  if (!Array.isArray(cuerpo.jugadas) || cuerpo.jugadas.length > JUGADAS_MAXIMAS) throw new ErrorDePedido('Jugadas inválidas');
  const jugadas = cuerpo.jugadas as Jugada[];
  const total = await calcularTotal(jugadas, registro);
  const resultado = await registro.partida({ jugador: cuerpo.jugador, fecha, modo: cuerpo.modo, total, consignas: jugadas.length });
  // Con el viaje terminado, se habilita ver las listas de sus consignas.
  const ids = [...new Set(jugadas.map((j) => j.consignaId as string))];
  const pases = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await paseDe(id)] as const)));
  return { total, ...resultado, pases };
}
