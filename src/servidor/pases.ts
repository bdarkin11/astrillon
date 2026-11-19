/**
 * Un pase es la prueba de que alguien terminó un viaje con esa consigna. Sin pase, el servidor no
 * entrega la lista de respuestas: así no alcanza con pedir /api/respuestas para ver las del día.
 * Es una firma (HMAC) del id de la consigna y de su vencimiento con la clave del servidor: no se
 * puede inventar sin ella, y deja de servir pasado el vencimiento, así no queda dando vueltas.
 */
const LARGO_DE_LA_FIRMA = 32;
/** Cuánto dura un pase desde que termina el viaje. */
export const DURACION_DEL_PASE_MS = 48 * 3_600_000;
/** "vencimiento en base 36" + "." + firma. */
const FORMATO_DEL_PASE = /^([0-9a-z]{1,12})\.([0-9a-f]{32})$/;

function secretoDelServidor(): string {
  const valor = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.ASTRILLON_API_SECRETO;
  if (!valor) throw new Error('Falta configurar ASTRILLON_API_SECRETO');
  return valor;
}

const claves = new Map<string, Promise<CryptoKey>>();

function claveDeFirma(secreto: string): Promise<CryptoKey> {
  let clave = claves.get(secreto);
  if (!clave) {
    clave = crypto.subtle.importKey('raw', new TextEncoder().encode(`astrillon:pases:${secreto}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    claves.set(secreto, clave);
  }
  return clave;
}

async function firma(consignaId: string, vence: number, secreto: string): Promise<string> {
  const bytes = await crypto.subtle.sign('HMAC', await claveDeFirma(secreto), new TextEncoder().encode(`${consignaId}|${vence}`));
  return Array.from(new Uint8Array(bytes).slice(0, LARGO_DE_LA_FIRMA / 2), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** El pase de una consigna, que vence a las 48 horas de `ahora`. */
export async function paseDe(consignaId: string, { ahora = Date.now(), secreto = secretoDelServidor() }: { ahora?: number; secreto?: string } = {}): Promise<string> {
  const vence = ahora + DURACION_DEL_PASE_MS;
  return `${vence.toString(36)}.${await firma(consignaId, vence, secreto)}`;
}

export async function paseValido(consignaId: string, pase: unknown, { ahora = Date.now(), secreto = secretoDelServidor() }: { ahora?: number; secreto?: string } = {}): Promise<boolean> {
  const partes = typeof pase === 'string' ? FORMATO_DEL_PASE.exec(pase) : null;
  if (!partes) return false;
  const vence = parseInt(partes[1], 36);
  // Vencido, o con un vencimiento más lejano del que da el servidor.
  if (!(vence > ahora && vence <= ahora + DURACION_DEL_PASE_MS)) return false;
  const esperada = await firma(consignaId, vence, secreto);
  // Se comparan todos los caracteres siempre, para no dar pistas por el tiempo de respuesta.
  let diferencia = 0;
  for (let i = 0; i < LARGO_DE_LA_FIRMA; i++) diferencia |= esperada.charCodeAt(i) ^ partes[2].charCodeAt(i);
  return diferencia === 0;
}
