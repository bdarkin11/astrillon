import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BANCO_DE_EJEMPLO } from '../datos/banco-ejemplo';
import { bancoDe, calcularTotal, DURACION_DEL_BANCO_MS, ErrorDePedido, MUESTRAS_PARA_PORCENTAJES, porcentajesDe, reportar, responder, respuestasDe, terminar } from './logica';
import type { Registro } from './logica';
import { paseDe, paseValido } from './pases';

beforeAll(() => {
  vi.stubEnv('ASTRILLON_API_SECRETO', 'clave-de-prueba');
});

function registroDePrueba(falla = false) {
  const anotado = {
    respuestas: [] as string[],
    reportes: [] as string[],
    partidas: [] as { total: number }[],
    conteos: [] as { respuesta: string; cuenta: number }[],
  };
  const registro: Registro = {
    async banco() {
      return BANCO_DE_EJEMPLO;
    },
    async respuesta(_c, respuesta, tipo) {
      if (falla) throw new Error('base caída');
      anotado.respuestas.push(`${tipo}:${respuesta}`);
    },
    async reporte(_c, texto) {
      anotado.reportes.push(texto);
    },
    async partida(datos) {
      anotado.partidas.push(datos);
      return { percentil: null, muestras: 1 };
    },
    async conteos() {
      if (falla) throw new Error('base caída');
      return anotado.conteos;
    },
  };
  return { registro, anotado };
}

const JUGADOR = '123e4567-e89b-12d3-a456-426614174000';

describe('responder en el servidor', () => {
  it('acepta y anota la respuesta', async () => {
    const { registro, anotado } = registroDePrueba();
    const r = await responder({ consignaId: 'mamifero', texto: 'marmota' }, registro);
    expect(r).toEqual({ tipo: 'aceptada', respuesta: { nombre: 'Marmota', nivel: 'cometa', alias: [] } });
    expect(anotado.respuestas).toEqual(['aceptada:Marmota']);
  });

  it('anota lo rechazado, para encontrar huecos en las listas', async () => {
    const { registro, anotado } = registroDePrueba();
    expect(await responder({ consignaId: 'mamifero', texto: 'zzzqqq' }, registro)).toEqual({ tipo: 'rechazada' });
    expect(anotado.respuestas).toEqual(['rechazada:zzzqqq']);
  });

  it('una sugerencia no adelanta el nivel de la respuesta', async () => {
    const { registro } = registroDePrueba();
    const r = await responder({ consignaId: 'mamifero', texto: 'marmotta' }, registro);
    expect(r).toEqual({ tipo: 'correccion', sugerencia: { nombre: 'Marmota' } });
  });

  it('si falla la base, el jugador igual recibe su respuesta', async () => {
    const { registro } = registroDePrueba(true);
    const r = await responder({ consignaId: 'mamifero', texto: 'marmota' }, registro);
    expect(r.tipo).toBe('aceptada');
  });

  it('rechaza pedidos inválidos', async () => {
    const { registro } = registroDePrueba();
    await expect(responder({ consignaId: 'no-existe', texto: 'x' }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(responder({ consignaId: 'mamifero', texto: 'x'.repeat(81) }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(responder({ consignaId: 'mamifero', texto: '   ' }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(responder({ consignaId: 'mamifero', texto: 5 }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
  });
});

describe('terminar la partida', () => {
  it('recalcula el puntaje: lo que diga el navegador no cuenta', async () => {
    const { registro } = registroDePrueba();
    expect(await calcularTotal([{ consignaId: 'mamifero', texto: 'Marmota' }, { consignaId: 'mamifero', texto: 'inventado' }, { consignaId: 'mamifero', texto: null }], registro)).toBe(60);
  });

  it('el Turbo duplica una respuesta buena y anula una común', async () => {
    const { registro } = registroDePrueba();
    expect(await calcularTotal([{ consignaId: 'mamifero', texto: 'Marmota', turbo: true }], registro)).toBe(120);
    expect(await calcularTotal([{ consignaId: 'mamifero', texto: 'Perro', turbo: true }], registro)).toBe(0);
  });

  it('guarda la partida con el total calculado por el servidor', async () => {
    const { registro, anotado } = registroDePrueba();
    const r = await terminar({ jugador: JUGADOR, fecha: '2026-11-05', modo: 'regresiva-dos-errores', total: 99999, jugadas: [{ consignaId: 'mamifero', texto: 'Perro' }] } as never, registro);
    expect(r.total).toBe(10);
    expect(anotado.partidas[0].total).toBe(10);
  });

  it('rechaza datos inválidos', async () => {
    const { registro } = registroDePrueba();
    const base = { jugador: JUGADOR, fecha: null, modo: 'clasico', jugadas: [] };
    await expect(terminar({ ...base, jugador: 'hola' }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(terminar({ ...base, modo: 'inventado' }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(terminar({ ...base, fecha: 'ayer' }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(terminar({ ...base, jugadas: Array(101).fill({}) }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
  });
});

describe('señal perdida y respuestas', () => {
  it('anota el reporte', async () => {
    const { registro, anotado } = registroDePrueba();
    await reportar({ consignaId: 'mamifero', texto: 'capibaras' }, registro);
    expect(anotado.reportes).toEqual(['capibaras']);
  });

  it('sin el pase de un viaje terminado no da la lista', async () => {
    const { registro } = registroDePrueba();
    await expect(respuestasDe('mamifero', null, registro)).rejects.toMatchObject({ estado: 403 });
    await expect(respuestasDe('mamifero', '0'.repeat(32), registro)).rejects.toMatchObject({ estado: 403 });
    // El pase de otra consigna no sirve.
    await expect(respuestasDe('mamifero', await paseDe('fruta'), registro)).rejects.toMatchObject({ estado: 403 });
  });

  it('terminar el viaje da un pase por consigna, y con él llega la lista sin alias', async () => {
    const { registro } = registroDePrueba();
    const r = await terminar({ jugador: JUGADOR, fecha: null, modo: 'clasico', jugadas: [{ consignaId: 'mamifero', texto: 'Perro' }, { consignaId: 'fruta', texto: null }] }, registro);
    expect(Object.keys(r.pases).sort()).toEqual(['fruta', 'mamifero']);
    const lista = await respuestasDe('mamifero', r.pases.mamifero, registro);
    expect(lista.some((r) => r.nombre === 'Marmota')).toBe(true);
    expect(lista[0]).not.toHaveProperty('alias');
  });
});

describe('el banco en la base', () => {
  function registroQueCuenta(fallas: boolean[] = []) {
    const { registro } = registroDePrueba();
    let pedidos = 0;
    registro.banco = async () => {
      if (fallas[pedidos++]) throw new Error('base caída');
      return BANCO_DE_EJEMPLO;
    };
    return { registro, pedidos: () => pedidos };
  }

  it('lo pide una vez y lo guarda unos minutos en memoria', async () => {
    const { registro, pedidos } = registroQueCuenta();
    await Promise.all([bancoDe(registro, 0), bancoDe(registro, 0), bancoDe(registro, 1000)]);
    expect(pedidos()).toBe(1);
    await bancoDe(registro, DURACION_DEL_BANCO_MS + 1);
    expect(pedidos()).toBe(2);
  });

  it('si la base no contesta al renovarlo, sigue con la copia anterior', async () => {
    const { registro } = registroQueCuenta([false, true]);
    await bancoDe(registro, 0);
    const banco = await bancoDe(registro, DURACION_DEL_BANCO_MS + 1);
    expect(banco.has('mamifero')).toBe(true);
  });

  it('sin copia anterior, el error llega y el próximo pedido vuelve a intentar', async () => {
    const { registro, pedidos } = registroQueCuenta([true]);
    await expect(bancoDe(registro, 0)).rejects.toThrow('base caída');
    expect((await bancoDe(registro, 0)).has('mamifero')).toBe(true);
    expect(pedidos()).toBe(2);
  });
});

describe('pases', () => {
  it('sólo valen para su consigna y con la misma clave', async () => {
    const pase = await paseDe('fruta', 'una');
    expect(pase).toMatch(/^[0-9a-f]{32}$/);
    expect(await paseValido('fruta', pase, 'una')).toBe(true);
    expect(await paseValido('fruta', pase, 'otra')).toBe(false);
    expect(await paseValido('astro', pase, 'una')).toBe(false);
    expect(await paseValido('fruta', 42, 'una')).toBe(false);
  });
});

describe('qué dijo el resto', () => {
  const conPase = async () => ({ pase: await paseDe('mamifero') });

  it('no muestra nada hasta tener suficientes respuestas', async () => {
    const { registro, anotado } = registroDePrueba();
    anotado.conteos = [{ respuesta: 'marmota', cuenta: MUESTRAS_PARA_PORCENTAJES - 1 }];
    expect(await porcentajesDe('mamifero', registro, await conPase())).toBeNull();
  });

  it('sin pase da sólo la respuesta que se pregunta, y sin pregunta no da nada', async () => {
    const { registro, anotado } = registroDePrueba();
    anotado.conteos = [
      { respuesta: 'marmota', cuenta: 30 },
      { respuesta: 'zorro', cuenta: 90 },
    ];
    const porcentajes = await porcentajesDe('mamifero', registro, { respuesta: 'Marmota' });
    expect(porcentajes?.respuestas).toEqual([{ nombre: 'Marmota', porcentaje: 25 }]);
    await expect(porcentajesDe('mamifero', registro)).rejects.toMatchObject({ estado: 403 });
  });

  it('calcula porcentajes con los nombres del banco y descarta lo que ya no está', async () => {
    const { registro, anotado } = registroDePrueba();
    anotado.conteos = [
      { respuesta: 'marmota', cuenta: 30 },
      { respuesta: 'zorro', cuenta: 90 },
      { respuesta: 'algo que se borró', cuenta: 500 },
    ];
    const porcentajes = await porcentajesDe('mamifero', registro, await conPase());
    expect(porcentajes?.muestras).toBe(120);
    expect(porcentajes?.respuestas[0]).toEqual({ nombre: 'Zorro', porcentaje: 75 });
    expect(porcentajes?.respuestas[1]).toEqual({ nombre: 'Marmota', porcentaje: 25 });
  });

  it('si la base no responde, el juego sigue sin porcentajes', async () => {
    const { registro } = registroDePrueba(true);
    expect(await porcentajesDe('mamifero', registro, await conPase())).toBeNull();
  });
});
