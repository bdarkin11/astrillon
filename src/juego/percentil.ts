import { generador } from './azar';
import type { Modo } from './modos';
import { NIVELES } from './niveles';
import type { NivelId } from './niveles';

/**
 * Comparación provisoria contra viajes simulados, hasta que el servidor del paso 6 tenga
 * partidas reales. Estas probabilidades son supuestos, no datos medidos: por eso la pantalla
 * la presenta como estimación y no se incluye en el texto para compartir.
 */
const VIAJES_SIMULADOS = 5000;
const SEMILLA = 20261104;
const MAXIMO_CONSIGNAS = 100;
const SEGUNDOS_DE_REFERENCIA = 25;
const SEGUNDOS_MINIMOS = 7;

// Desde que se puede reintentar, sólo falla quien se queda sin tiempo: pasa poco al principio y más con 7 segundos.
const FALLO_SIN_REINTENTO_INICIAL = 0.04;
const FALLO_SIN_REINTENTO_SUBA = 0.16;
const FALLO_CON_REINTENTOS = 0.03;

const PROBABILIDAD_NIVEL: [NivelId, number][] = [
  ['basura', 0.4],
  ['vivo', 0.25],
  ['satelite', 0.2],
  ['cometa', 0.1],
  ['nebulosa', 0.04],
  ['astrillon', 0.01],
];

function puntosAlAzar(azar: () => number): number {
  let tirada = azar();
  for (const [id, probabilidad] of PROBABILIDAD_NIVEL) {
    tirada -= probabilidad;
    if (tirada < 0) return NIVELES[id].puntos;
  }
  return NIVELES.basura.puntos;
}

function probabilidadDeFallo(modo: Modo, segundos: number): number {
  if (modo.erroresParaTerminar === null) return FALLO_CON_REINTENTOS;
  const presion = (SEGUNDOS_DE_REFERENCIA - segundos) / (SEGUNDOS_DE_REFERENCIA - SEGUNDOS_MINIMOS);
  return FALLO_SIN_REINTENTO_INICIAL + presion * FALLO_SIN_REINTENTO_SUBA;
}

function simularViaje(modo: Modo, azar: () => number): number {
  const maximo = modo.limiteConsignas ?? MAXIMO_CONSIGNAS;
  let total = 0;
  let aciertos = 0;
  let errores = 0;
  for (let consigna = 0; consigna < maximo; consigna++) {
    if (azar() < probabilidadDeFallo(modo, modo.segundosPara(aciertos))) {
      errores += 1;
      if (modo.erroresParaTerminar !== null && errores >= modo.erroresParaTerminar) break;
    } else {
      aciertos += 1;
      total += puntosAlAzar(azar);
    }
  }
  return total;
}

const viajesPorModo = new Map<string, number[]>();

function viajesDe(modo: Modo): number[] {
  let viajes = viajesPorModo.get(modo.id);
  if (!viajes) {
    const azar = generador(SEMILLA);
    viajes = Array.from({ length: VIAJES_SIMULADOS }, () => simularViaje(modo, azar));
    viajesPorModo.set(modo.id, viajes);
  }
  return viajes;
}

/** Qué porcentaje de los viajes simulados de ese modo quedó por debajo del puntaje, de 0 a 100. */
export function percentilEstimado(total: number, modo: Modo): number {
  const viajes = viajesDe(modo);
  const superados = viajes.filter((puntos) => puntos < total).length;
  return Math.round((superados / viajes.length) * 100);
}
