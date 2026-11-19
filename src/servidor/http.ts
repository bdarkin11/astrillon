import { ErrorDePedido } from './logica.js';

const TAMANIO_MAXIMO_DEL_PEDIDO = 32_000;

function json(datos: unknown, estado = 200): Response {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function atender(accion: () => unknown | Promise<unknown>): Promise<Response> {
  try {
    return json(await accion());
  } catch (error) {
    if (error instanceof ErrorDePedido) return json({ error: error.message }, error.estado);
    console.error(error);
    return json({ error: 'Error del servidor' }, 500);
  }
}

/** Atiende un POST con cuerpo JSON. */
export function conCuerpo<T extends object>(accion: (cuerpo: T) => unknown | Promise<unknown>) {
  return (pedido: Request): Promise<Response> =>
    atender(async () => {
      const texto = await pedido.text();
      if (texto.length > TAMANIO_MAXIMO_DEL_PEDIDO) throw new ErrorDePedido('Pedido demasiado grande', 413);
      let cuerpo: unknown;
      try {
        cuerpo = JSON.parse(texto);
      } catch {
        throw new ErrorDePedido('JSON inválido');
      }
      if (typeof cuerpo !== 'object' || cuerpo === null) throw new ErrorDePedido('JSON inválido');
      return accion(cuerpo as T);
    });
}

/** Atiende un GET con parámetros en la dirección. */
export function conParametros(accion: (parametros: URLSearchParams) => unknown) {
  return (pedido: Request): Promise<Response> => atender(() => accion(new URL(pedido.url).searchParams));
}
