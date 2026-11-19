import { generador, mezclar } from './azar';

/** El viaje N.º 1. Al publicar el juego (paso 8) se corre a la fecha de lanzamiento. */
export const PRIMER_VIAJE = '2026-11-01';

/** Todos cambian de viaje a la misma hora, sin importar dónde estén. */
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
const SEMILLA_DEL_ORDEN = 4242;
/** Cuántas consignas avanza el orden de un día al siguiente; un viaje normal usa menos que esto. */
const CONSIGNAS_POR_DIA = 11;
const MS_POR_DIA = 86_400_000;

/** La fecha en la zona del juego, como "2026-11-04". */
export function fechaDeHoy(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(ahora);
}

function aUtc(fecha: string): number {
  return Date.parse(`${fecha}T00:00:00Z`);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(aUtc(fecha) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

export function numeroDeViaje(fecha: string): number {
  return Math.round((aUtc(fecha) - aUtc(PRIMER_VIAJE)) / MS_POR_DIA) + 1;
}

export function fechaLegible(fecha: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(aUtc(fecha));
}

/** Los viajes ya pasados, del más nuevo al más viejo. */
export function fechasDelArchivo(hoy: string): string[] {
  const fechas: string[] = [];
  for (let fecha = sumarDias(hoy, -1); fecha >= PRIMER_VIAJE; fecha = sumarDias(fecha, -1)) fechas.push(fecha);
  return fechas;
}

function sinDivisorComun(a: number, b: number): boolean {
  let [x, y] = [a, b];
  while (y !== 0) [x, y] = [y, x % y];
  return x === 1;
}

/**
 * El mismo orden para todos ese día. Cada día arranca más adelante en una mezcla fija,
 * así las primeras consignas no se repiten hasta dar la vuelta a todo el banco.
 */
export function consignasDelDia<T>(fecha: string, consignas: readonly T[]): T[] {
  const total = consignas.length;
  let salto = CONSIGNAS_POR_DIA;
  while (!sinDivisorComun(salto, total)) salto += 1;
  const inicio = ((numeroDeViaje(fecha) - 1) * salto) % total;
  const orden = mezclar(consignas, generador(SEMILLA_DEL_ORDEN));
  return [...orden.slice(inicio), ...orden.slice(0, inicio)];
}
