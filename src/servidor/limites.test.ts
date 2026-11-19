import { describe, expect, it } from 'vitest';
import { huella, ipDelPedido, limitado } from './limites';

const ok = async () => new Response('ok');
const pedido = (ip: string) => new Request('http://x/api/responder', { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });

describe('límite de pedidos', () => {
  it('toma la primera IP y guarda sólo una huella, nunca la IP', async () => {
    expect(ipDelPedido(pedido('200.1.2.3'))).toBe('200.1.2.3');
    const h = await huella('200.1.2.3');
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain('200');
    expect(await huella('200.1.2.3')).toBe(h);
  });

  it('apagado, no consulta nada', async () => {
    let consultas = 0;
    const manejador = limitado('responder', ok, async () => (consultas++, false), () => false);
    expect((await manejador(pedido('1.1.1.1'))).status).toBe(200);
    expect(consultas).toBe(0);
  });

  it('encendido, corta con 429 al pasarse y deja pasar si la base falla', async () => {
    const corta = limitado('responder', ok, async () => false, () => true);
    expect((await corta(pedido('1.1.1.1'))).status).toBe(429);
    const falla = limitado('responder', ok, async () => { throw new Error('caída'); }, () => true);
    expect((await falla(pedido('1.1.1.1'))).status).toBe(200);
  });
});
