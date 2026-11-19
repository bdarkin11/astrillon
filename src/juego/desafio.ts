import { PRIMER_VIAJE } from './diario';
import { NIVELES_ORDENADOS } from './niveles';

/**
 * Un desafío es el viaje del día de un amigo, guardado en el link que comparte.
 * Va después del # para que no llegue nunca al servidor, y no lleva nombres ni respuestas:
 * sólo cuántos puntos sacó en cada consigna y cuánto tardó, para que su nave fantasma
 * avance a la par tuya sin arruinarte las consignas.
 */
export interface PasoDelFantasma {
  puntos: number;
  /** Segundos que tardó en cerrar la consigna, con un decimal. */
  segundos: number;
}

export interface Desafio {
  fecha: string;
  pasos: PasoDelFantasma[];
}

const VERSION = '1';
const MAXIMO_DE_PASOS = 100;
const MAXIMO_DE_SEGUNDOS = 25;
export const CLAVE_DEL_LINK = 'desafio';

/** Los puntos que puede valer una consigna: 0, cualquier nivel, o el doble con Turbo. */
const PUNTOS_POSIBLES = new Set([0, ...NIVELES_ORDENADOS.flatMap((n) => [n.puntos, n.puntos * 2])]);

export function codificarDesafio({ fecha, pasos }: Desafio): string {
  const dia = fecha.replaceAll('-', '');
  const tramos = pasos.map(({ puntos, segundos }) => `${puntos.toString(36)}-${Math.round(segundos * 10).toString(36)}`);
  return [VERSION, dia, tramos.join('_')].join('.');
}

/** Devuelve null si el código está roto, viene de otra versión o tiene valores imposibles. */
export function leerDesafio(codigo: string, hoy: string): Desafio | null {
  const partes = codigo.split('.');
  if (partes.length !== 3 || partes[0] !== VERSION || !/^\d{8}$/.test(partes[1])) return null;
  const fecha = `${partes[1].slice(0, 4)}-${partes[1].slice(4, 6)}-${partes[1].slice(6)}`;
  if (Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) || fecha < PRIMER_VIAJE || fecha > hoy) return null;
  if (!partes[2]) return null;
  const tramos = partes[2].split('_');
  if (tramos.length > MAXIMO_DE_PASOS) return null;
  const pasos: PasoDelFantasma[] = [];
  for (const tramo of tramos) {
    const encontrado = /^([0-9a-z]+)-([0-9a-z]+)$/.exec(tramo);
    if (!encontrado) return null;
    const puntos = parseInt(encontrado[1], 36);
    const segundos = parseInt(encontrado[2], 36) / 10;
    if (!PUNTOS_POSIBLES.has(puntos) || segundos > MAXIMO_DE_SEGUNDOS) return null;
    pasos.push({ puntos, segundos });
  }
  return { fecha, pasos };
}

/** Busca el desafío en la parte del link que va después del #, como "#desafio=1.20261119.a-3k". */
export function desafioDelLink(hash: string, hoy: string): Desafio | null {
  const parametros = new URLSearchParams(hash.replace(/^#/, ''));
  const codigo = parametros.get(CLAVE_DEL_LINK);
  return codigo ? leerDesafio(codigo, hoy) : null;
}

/** Segundos que se usan para respuestas de viajes guardados antes de medir el tiempo. */
const SEGUNDOS_SI_NO_SE_MIDIO = 12;

/** Arma el desafío a partir de un viaje del día ya jugado. */
export function desafioDeViaje(fecha: string, resultados: { puntos: number; segundos?: number }[]): Desafio {
  return {
    fecha,
    pasos: resultados.map(({ puntos, segundos }) => ({
      puntos,
      segundos: Math.min(MAXIMO_DE_SEGUNDOS, Math.round((segundos ?? SEGUNDOS_SI_NO_SE_MIDIO) * 10) / 10),
    })),
  };
}

export function totalDelDesafio(desafio: Desafio): number {
  return desafio.pasos.reduce((suma, paso) => suma + paso.puntos, 0);
}

/** Dónde está el fantasma antes de la consigna `indice` (empieza en 0). */
export function puntosAntesDe(desafio: Desafio, indice: number): number {
  return desafio.pasos.slice(0, indice).reduce((suma, paso) => suma + paso.puntos, 0);
}

/** Dónde está el fantasma cuando pasaron `segundos` de la consigna `indice`: avanza cuando él respondió. */
export function puntosDelFantasma(desafio: Desafio, indice: number, segundos: number): number {
  const paso = desafio.pasos[indice];
  const antes = puntosAntesDe(desafio, indice);
  return paso && segundos >= paso.segundos ? antes + paso.puntos : antes;
}

export type Veredicto = 'ganaste' | 'perdiste' | 'empate';

/** Gana quien llega más lejos. */
export function veredicto(tuyo: number, delAmigo: number): Veredicto {
  if (tuyo === delAmigo) return 'empate';
  return tuyo > delAmigo ? 'ganaste' : 'perdiste';
}
