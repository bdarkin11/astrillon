import { existsSync, readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

/**
 * En desarrollo, el banco sale del disco y no de Supabase: el real de privado/ si está en esta
 * máquina, o el de ejemplo si no. Con ASTRILLON_BANCO=supabase en .env.local se prueba la base.
 */
async function prepararBancoLocal(cargar: (ruta: string) => Promise<Record<string, unknown>>) {
  const global = globalThis as { __ASTRILLON_BANCO_LOCAL__?: unknown };
  if (process.env.ASTRILLON_BANCO === 'supabase') {
    delete global.__ASTRILLON_BANCO_LOCAL__;
    return;
  }
  global.__ASTRILLON_BANCO_LOCAL__ = existsSync('privado/banco.ts')
    ? (await cargar('/privado/banco.ts')).CONSIGNAS
    : JSON.parse(readFileSync('src/datos/banco-ejemplo.json', 'utf8'));
}

/** Atiende /api en desarrollo igual que Vercel en producción, con los mismos archivos. */
function apiLocal(): Plugin {
  return {
    name: 'api-local',
    configureServer(servidor) {
      Object.assign(process.env, loadEnv('development', process.cwd(), 'ASTRILLON_'));
      servidor.middlewares.use(async (pedido, respuesta, siguiente) => {
        const url = new URL(pedido.url ?? '/', 'http://localhost');
        const nombre = /^\/api\/([a-z]+)$/.exec(url.pathname)?.[1];
        if (!nombre) return siguiente();
        try {
          await prepararBancoLocal((ruta) => servidor.ssrLoadModule(ruta));
          const modulo = await servidor.ssrLoadModule(`/api/${nombre}.ts`);
          const manejador = modulo[pedido.method ?? 'GET'] as ((p: Request) => Promise<Response>) | undefined;
          if (!manejador) {
            respuesta.statusCode = 405;
            respuesta.end();
            return;
          }
          const tieneCuerpo = pedido.method !== 'GET' && pedido.method !== 'HEAD';
          const salida = await manejador(
            new Request(url, {
              method: pedido.method,
              ...(tieneCuerpo ? { body: Readable.toWeb(pedido) as BodyInit, duplex: 'half' } : {}),
            } as RequestInit),
          );
          respuesta.statusCode = salida.status;
          salida.headers.forEach((valor, clave) => respuesta.setHeader(clave, valor));
          respuesta.end(await salida.text());
        } catch (error) {
          siguiente(error as Error);
        }
      });
    },
  };
}

/** Los mismos encabezados de seguridad que pone Vercel, para probarlos con `vite preview`. */
function encabezadosDeVercel(): Record<string, string> {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers?: { headers: { key: string; value: string }[] }[] };
  return Object.fromEntries((config.headers ?? []).flatMap((regla) => regla.headers.map(({ key, value }) => [key, value])));
}

export default defineConfig({ plugins: [apiLocal()], preview: { headers: encabezadosDeVercel() } });
