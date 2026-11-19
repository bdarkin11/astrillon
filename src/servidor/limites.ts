import { permitirEnSupabase } from './supabase.js';

/**
 * Límite de pedidos por persona, para que nadie pueda tirar miles de respuestas por segundo
 * ni llenar la base. Se cuenta por una huella de la IP: un hash, nunca la IP en sí.
 * Está apagado hasta que en Vercel se ponga ASTRILLON_LIMITES=si (la migración ya está aplicada).
 */
export const LIMITES: Record<string, { maximo: number; segundos: number }> = {
  // Con reintentos libres, alguien rápido manda una por segundo: 120 por minuto le sobra.
  responder: { maximo: 120, segundos: 60 },
  respuestas: { maximo: 120, segundos: 60 },
  porcentajes: { maximo: 120, segundos: 60 },
  reportar: { maximo: 15, segundos: 60 },
  terminar: { maximo: 30, segundos: 600 },
};

type Manejador = (pedido: Request) => Promise<Response>;
type Permitir = (clave: string, maximo: number, segundos: number) => Promise<boolean>;

function entorno(nombre: string): string | undefined {
  return (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[nombre];
}

/** Vercel pone la IP real primero en x-forwarded-for. */
export function ipDelPedido(pedido: Request): string {
  return pedido.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || pedido.headers.get('x-real-ip') || 'desconocida';
}

export async function huella(ip: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`astrillon:${ip}`));
  return Array.from(new Uint8Array(bytes).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function limitado(ruta: string, manejador: Manejador, permitir: Permitir = permitirEnSupabase, activo = () => entorno('ASTRILLON_LIMITES') === 'si'): Manejador {
  const limite = LIMITES[ruta];
  return async (pedido) => {
    if (!limite || !activo()) return manejador(pedido);
    let permitido = true;
    try {
      permitido = await permitir(`${ruta}:${await huella(ipDelPedido(pedido))}`, limite.maximo, limite.segundos);
    } catch (error) {
      // Si la base no responde, se deja pasar: es preferible a que nadie pueda jugar.
      console.error('No se pudo revisar el límite:', error);
    }
    if (permitido) return manejador(pedido);
    return new Response(JSON.stringify({ error: 'Demasiados pedidos. Esperá un momento.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': String(limite.segundos) },
    });
  };
}
