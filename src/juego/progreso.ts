import { sumarDias } from './diario';
import { NIVELES, NIVELES_ORDENADOS } from './niveles';
import type { NivelId } from './niveles';
import type { ResultadoConsigna } from './partida';
import { paradasEntre } from './ruta';
import type { ConsignaPublica } from './tipos';

export const CLAVE_DEL_PROGRESO = 'astrillon:progreso';
const CLAVE = CLAVE_DEL_PROGRESO;
const VERSION = 1;

export interface RespuestaGuardada {
  consignaId: string;
  respuesta: string | null;
  /** Falta en los viajes guardados antes de que las respuestas pasaran al servidor. */
  nivel?: NivelId;
  intentoFallido: string | null;
  puntos: number;
  turbo: boolean;
  /** Falta en los viajes guardados antes de que existieran los desafíos. */
  segundos?: number;
}

export interface ViajeDelDia {
  /** Cuándo se empezó: la racha sólo cuenta los viajes jugados en su propio día. */
  jugadoEn: string;
  respuestas: RespuestaGuardada[];
  terminado: boolean;
  /** El porcentaje de jugadores reales superados, si el servidor ya tenía suficientes partidas. */
  percentil?: number;
  /** Los pases del servidor para volver a ver las listas de respuestas. Faltan en los viajes de antes. */
  pases?: Record<string, string>;
}

export interface Progreso {
  version: number;
  dias: Record<string, ViajeDelDia>;
  /** Paradas descubiertas, por id. */
  paradas: string[];
  /** Joyas encontradas: id de la consigna y nombre de la respuesta. */
  joyas: Record<string, string>;
  viajes: number;
  mejorTotal: number;
  /** El copiloto elegido en el atlas. */
  copiloto?: string;
  /** Desafíos recibidos por link: el código del viaje del amigo, por fecha. */
  desafios?: Record<string, string>;
  /** Identificador al azar de este navegador: no tiene ningún dato personal. */
  jugador?: string;
}

export type Almacen = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;

export function progresoVacio(): Progreso {
  return { version: VERSION, dias: {}, paradas: [], joyas: {}, viajes: 0, mejorTotal: 0 };
}

/** Sin almacén, o con datos rotos o de otra versión, se juega igual pero desde cero. */
export function leerProgreso(almacen: Almacen | null): Progreso {
  try {
    const guardado = JSON.parse(almacen?.getItem(CLAVE) ?? 'null');
    return guardado?.version === VERSION ? { ...progresoVacio(), ...guardado } : progresoVacio();
  } catch {
    return progresoVacio();
  }
}

export function guardarProgreso(almacen: Almacen | null, progreso: Progreso): void {
  try {
    almacen?.setItem(CLAVE, JSON.stringify(progreso));
  } catch {
    // Sin espacio o bloqueado: el progreso sigue valiendo hasta cerrar la página.
  }
}

export function aGuardada(resultado: ResultadoConsigna): RespuestaGuardada {
  return {
    consignaId: resultado.consigna.id,
    respuesta: resultado.respuesta?.nombre ?? null,
    ...(resultado.nivel ? { nivel: resultado.nivel.id } : {}),
    intentoFallido: resultado.intentoFallido,
    puntos: resultado.puntos,
    turbo: resultado.turbo,
    ...(resultado.segundos === undefined ? {} : { segundos: resultado.segundos }),
  };
}

/** Para viajes viejos, que no guardaban el nivel: se deduce de los puntos, sin contar el Turbo. */
function nivelPorPuntos({ puntos, turbo }: RespuestaGuardada): NivelId {
  const base = turbo ? puntos / 2 : puntos;
  return NIVELES_ORDENADOS.find((n) => n.puntos === base)?.id ?? 'basura';
}

/** Vuelve a armar los resultados. Se saltea lo que ya no exista en el banco. */
export function restaurarResultados(guardadas: RespuestaGuardada[], consignas: readonly ConsignaPublica[]): ResultadoConsigna[] {
  const resultados: ResultadoConsigna[] = [];
  for (const guardada of guardadas) {
    const consigna = consignas.find((c) => c.id === guardada.consignaId);
    if (!consigna) continue;
    const nivel = guardada.respuesta === null ? null : guardada.nivel ?? nivelPorPuntos(guardada);
    const respuesta = guardada.respuesta !== null && nivel ? { nombre: guardada.respuesta, nivel, alias: [] } : null;
    resultados.push({
      consigna,
      respuesta,
      nivel: nivel ? NIVELES[nivel] : null,
      puntos: guardada.puntos,
      turbo: guardada.turbo,
      intentoFallido: guardada.intentoFallido,
      ...(guardada.segundos === undefined ? {} : { segundos: guardada.segundos }),
    });
  }
  return resultados;
}

export interface Novedades {
  paradas: number;
  joyas: number;
  /** Superó su mejor viaje anterior. El primer viaje no cuenta como récord. */
  record: boolean;
}

/** Suma un viaje terminado al atlas y a las estadísticas. */
export function registrarViaje(progreso: Progreso, resultados: ResultadoConsigna[], total: number): Novedades {
  const novedades: Novedades = { paradas: 0, joyas: 0, record: progreso.viajes > 0 && total > progreso.mejorTotal };
  for (const parada of paradasEntre(0, total)) {
    if (progreso.paradas.includes(parada.id)) continue;
    progreso.paradas.push(parada.id);
    novedades.paradas += 1;
  }
  for (const { consigna, respuesta } of resultados) {
    if (respuesta?.nivel !== 'astrillon' || progreso.joyas[consigna.id]) continue;
    progreso.joyas[consigna.id] = respuesta.nombre;
    novedades.joyas += 1;
  }
  progreso.viajes += 1;
  progreso.mejorTotal = Math.max(progreso.mejorTotal, total);
  return novedades;
}

function cuentaParaLaRacha(progreso: Progreso, fecha: string): boolean {
  const viaje = progreso.dias[fecha];
  return viaje !== undefined && viaje.terminado && viaje.jugadoEn === fecha;
}

/** Días seguidos jugando el viaje del día. La racha sigue viva hasta que termine el día sin jugar. */
export function calcularRacha(progreso: Progreso, hoy: string): { actual: number; mejor: number } {
  let actual = 0;
  let fecha = cuentaParaLaRacha(progreso, hoy) ? hoy : sumarDias(hoy, -1);
  while (cuentaParaLaRacha(progreso, fecha)) {
    actual += 1;
    fecha = sumarDias(fecha, -1);
  }

  let mejor = 0;
  for (const dia of Object.keys(progreso.dias)) {
    if (!cuentaParaLaRacha(progreso, dia) || cuentaParaLaRacha(progreso, sumarDias(dia, -1))) continue;
    let largo = 0;
    for (let d = dia; cuentaParaLaRacha(progreso, d); d = sumarDias(d, 1)) largo += 1;
    mejor = Math.max(mejor, largo);
  }
  return { actual, mejor };
}
