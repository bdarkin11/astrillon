import type { Validacion } from './validar';
import type { NivelId } from './niveles';

const TIEMPO_MAXIMO_MS = 6000;

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const respuesta = await fetch(ruta, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`);
  return (await respuesta.json()) as T;
}

/** El servidor valida con el banco completo, que no viaja nunca al navegador. */
export function validarEnServidor(consignaId: string, texto: string): Promise<Validacion> {
  return pedir<Validacion>('/api/responder', { consignaId, texto });
}

export interface RespuestaDeLista {
  nombre: string;
  nivel: NivelId;
  dato?: string;
}

/** El servidor sólo da la lista con el pase que entregó al terminar un viaje con esa consigna. */
export function pedirRespuestas(consignaId: string, pase: string): Promise<RespuestaDeLista[]> {
  return pedir<RespuestaDeLista[]>(`/api/respuestas?consigna=${encodeURIComponent(consignaId)}&pase=${encodeURIComponent(pase)}`);
}

export interface Porcentajes {
  muestras: number;
  respuestas: { nombre: string; porcentaje: number }[];
}

/**
 * Null mientras no haya suficientes viajes para que los porcentajes digan algo. Con el pase llegan
 * todas las respuestas; sin pase, sólo la que se pregunta.
 */
export function pedirPorcentajes(consignaId: string, de: { pase: string } | { respuesta: string }): Promise<Porcentajes | null> {
  const extra = 'pase' in de ? `pase=${encodeURIComponent(de.pase)}` : `respuesta=${encodeURIComponent(de.respuesta)}`;
  return pedir<Porcentajes | null>(`/api/porcentajes?consigna=${encodeURIComponent(consignaId)}&${extra}`);
}

/** "12%", o "menos del 1%" para las joyas. */
export function textoDePorcentaje(porcentaje: number): string {
  if (porcentaje < 1) return 'menos del 1%';
  return `${Math.round(porcentaje)}%`;
}

export function reportarSenalPerdida(consignaId: string, texto: string): Promise<unknown> {
  return pedir('/api/reportar', { consignaId, texto });
}

export interface PartidaRegistrada {
  total: number;
  percentil: number | null;
  muestras: number;
  /** Por id de consigna: habilita ver su lista de respuestas. */
  pases: Record<string, string>;
}

export function registrarPartida(datos: {
  jugador: string;
  fecha: string | null;
  modo: string;
  jugadas: { consignaId: string; texto: string | null; turbo: boolean }[];
}): Promise<PartidaRegistrada> {
  return pedir<PartidaRegistrada>('/api/terminar', datos);
}
