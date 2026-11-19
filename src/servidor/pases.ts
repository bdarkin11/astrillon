/**
 * Un pase es la prueba de que alguien terminó un viaje con esa consigna. Sin pase, el servidor no
 * entrega la lista de respuestas: así no alcanza con pedir /api/respuestas para ver las del día.
 * Es una firma (HMAC) del id de la consigna con la clave del servidor, y no se puede inventar sin ella.
 */
const LARGO_DEL_PASE = 32;

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

export async function paseDe(consignaId: string, secreto = secretoDelServidor()): Promise<string> {
  const firma = await crypto.subtle.sign('HMAC', await claveDeFirma(secreto), new TextEncoder().encode(consignaId));
  return Array.from(new Uint8Array(firma).slice(0, LARGO_DEL_PASE / 2), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function paseValido(consignaId: string, pase: unknown, secreto = secretoDelServidor()): Promise<boolean> {
  if (typeof pase !== 'string' || pase.length !== LARGO_DEL_PASE) return false;
  const esperado = await paseDe(consignaId, secreto);
  // Se comparan todos los caracteres siempre, para no dar pistas por el tiempo de respuesta.
  let diferencia = 0;
  for (let i = 0; i < LARGO_DEL_PASE; i++) diferencia |= esperado.charCodeAt(i) ^ pase.charCodeAt(i);
  return diferencia === 0;
}
