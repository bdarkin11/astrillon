import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BANCO_DE_EJEMPLO } from '../datos/banco-ejemplo';
import { bancoDe, calcularTotal, DURACION_DEL_BANCO_MS, ErrorDePedido, MUESTRAS_PARA_PORCENTAJES, porcentajesDe, reportar, responder, respuestasDe, terminar } from './logica';
import type { Registro } from './logica';
import { consignasDelDia } from '../juego/diario';
import PUBLICAS from '../datos/consignas-publicas.json';
import { DURACION_DEL_PASE_MS, paseDe, paseValido } from './pases';

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
/** Mediodía del 5 de noviembre en Buenos Aires: "hoy" para las pruebas de fechas. */
const AHORA = Date.parse('2026-11-05T15:00:00Z');
const HOY = '2026-11-05';
const DIA_MS = 86_400_000;

/** El orden del viaje de una fecha con el banco de ejemplo, como lo arma el juego. */
function ordenDe(fecha: string): string[] {
  return consignasDelDia(fecha, BANCO_DE_EJEMPLO.map((c) => c.id));
}

/** Una respuesta que el banco acepta para esa consigna. */
function buenaPara(id: string): string {
  return BANCO_DE_EJEMPLO.find((c) => c.id === id)!.respuestas[0].nombre;
}

/** Un viaje del día: `aciertos` respuestas buenas y después `errores` consignas sin respuesta. */
function viajeDelDia(fecha: string, aciertos: number, errores: number) {
  const jugadas = ordenDe(fecha)
    .slice(0, aciertos + errores)
    .map((id, i) => ({ consignaId: id, texto: i < aciertos ? buenaPara(id) : null, turbo: false }));
  return { jugador: JUGADOR, fecha, modo: 'regresiva-dos-errores', jugadas };
}

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
    const viaje = viajeDelDia(HOY, 3, 2);
    const r = await terminar({ ...viaje, total: 99999 } as never, registro, AHORA);
    expect(r.total).toBe(await calcularTotal(viaje.jugadas, registro));
    expect(r.total).not.toBe(99999);
    expect(anotado.partidas).toHaveLength(1);
    expect(anotado.partidas[0].total).toBe(r.total);
  });

  it('rechaza datos inválidos', async () => {
    const { registro } = registroDePrueba();
    const base = { jugador: JUGADOR, fecha: null, modo: 'clasico', jugadas: [] };
    await expect(terminar({ ...base, jugador: 'hola' }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(terminar({ ...base, modo: 'inventado' }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(terminar({ ...base, fecha: 'ayer' }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(terminar({ ...base, jugadas: Array(101).fill({}) }, registro)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(terminar(base, registro)).rejects.toBeInstanceOf(ErrorDePedido);
  });
});

describe('qué viajes acepta terminar', () => {
  it('el viaje del día normal pasa, se guarda y da pases para sus consignas', async () => {
    const { registro, anotado } = registroDePrueba();
    const viaje = viajeDelDia(HOY, 3, 2);
    const r = await terminar(viaje, registro, AHORA);
    expect(Object.keys(r.pases)).toEqual(viaje.jugadas.map((j) => j.consignaId));
    expect(anotado.partidas).toHaveLength(1);
    const id = viaje.jugadas[0].consignaId;
    expect((await respuestasDe(id, r.pases[id], registro, AHORA)).length).toBeGreaterThan(0);
  });

  it('rechaza un pedido con las 72 consignas', async () => {
    const { registro } = registroDePrueba();
    const todas = PUBLICAS.map((c) => ({ consignaId: c.id, texto: null }));
    expect(todas).toHaveLength(72);
    await expect(terminar({ jugador: JUGADOR, fecha: HOY, modo: 'regresiva-dos-errores', jugadas: todas }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(terminar({ jugador: JUGADOR, fecha: null, modo: 'regresiva-dos-errores', jugadas: todas }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
    // Ni siquiera todas las del banco en el orden del día, si no se respondió ninguna.
    const delDia = ordenDe(HOY).map((id) => ({ consignaId: id, texto: null }));
    await expect(terminar({ jugador: JUGADOR, fecha: HOY, modo: 'regresiva-dos-errores', jugadas: delDia }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
  });

  it('en el viaje del día exige el orden de esa fecha, el modo principal y nada de Turbo', async () => {
    const { registro } = registroDePrueba();
    const viaje = viajeDelDia(HOY, 3, 0);
    await expect(terminar({ ...viaje, jugadas: [...viaje.jugadas].reverse() }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(terminar({ ...viaje, jugadas: viaje.jugadas.slice(1) }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
    await expect(terminar({ ...viaje, modo: 'clasico' }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
    const conTurbo = { ...viaje, jugadas: viaje.jugadas.map((j, i) => ({ ...j, turbo: i === 0 })) };
    await expect(terminar(conTurbo, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
    // El orden de otra fecha tampoco sirve.
    const deAyer = viajeDelDia('2026-11-04', 3, 0);
    expect(deAyer.jugadas.map((j) => j.consignaId)).not.toEqual(viaje.jugadas.map((j) => j.consignaId));
    await expect(terminar({ ...deAyer, fecha: HOY }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
  });

  it('el viaje se corta en el último error, y no repite consignas', async () => {
    const { registro } = registroDePrueba();
    const jugadas = ordenDe(HOY)
      .slice(0, 3)
      .map((id, i) => ({ consignaId: id, texto: i === 2 ? buenaPara(id) : null }));
    await expect(terminar({ jugador: JUGADOR, fecha: HOY, modo: 'regresiva-dos-errores', jugadas }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
    const repetidas = [{ consignaId: 'fruta', texto: buenaPara('fruta') }, { consignaId: 'fruta', texto: null }];
    await expect(terminar({ jugador: JUGADOR, fecha: null, modo: 'clasico', jugadas: repetidas }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
  });

  it('rechaza fechas futuras, inexistentes o anteriores al primer viaje', async () => {
    const { registro } = registroDePrueba();
    for (const fecha of ['2026-11-07', '2027-01-01', '2026-11-31', '2026-10-31']) {
      await expect(terminar(viajeDelDia(fecha, 2, 0), registro, AHORA)).rejects.toMatchObject({ message: 'Fecha inválida' });
    }
  });

  it('acepta mañana por los husos horarios, y los viajes pasados del archivo', async () => {
    const { registro, anotado } = registroDePrueba();
    await terminar(viajeDelDia('2026-11-06', 2, 0), registro, AHORA);
    await terminar(viajeDelDia('2026-11-01', 2, 1), registro, AHORA);
    expect(anotado.partidas.map((p) => (p as { fecha?: string }).fecha)).toEqual(['2026-11-06', '2026-11-01']);
  });

  it('el viaje libre y el que no tuvo ninguna respuesta buena no entran en la comparación', async () => {
    const { registro, anotado } = registroDePrueba();
    const libre = await terminar({ jugador: JUGADOR, fecha: null, modo: 'clasico', jugadas: [{ consignaId: 'fruta', texto: buenaPara('fruta') }] }, registro, AHORA);
    expect(libre.percentil).toBeNull();
    await terminar(viajeDelDia(HOY, 0, 2), registro, AHORA);
    expect(anotado.partidas).toHaveLength(0);
  });

  it('el viaje libre respeta las reglas del modo', async () => {
    const { registro } = registroDePrueba();
    const ocho = BANCO_DE_EJEMPLO.map((c) => ({ consignaId: c.id, texto: buenaPara(c.id) }));
    await expect(terminar({ jugador: JUGADOR, fecha: null, modo: 'clasico', jugadas: ocho }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
    const dosTurbos = ocho.slice(0, 3).map((j, i) => ({ ...j, turbo: i < 2 }));
    await expect(terminar({ jugador: JUGADOR, fecha: null, modo: 'clasico', jugadas: dosTurbos }, registro, AHORA)).rejects.toBeInstanceOf(ErrorDePedido);
    const r = await terminar({ jugador: JUGADOR, fecha: null, modo: 'regresiva', jugadas: [{ consignaId: 'fruta', texto: null }] }, registro, AHORA);
    expect(r.pases).toHaveProperty('fruta');
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
    await expect(respuestasDe('mamifero', `${(Date.now() + 1000).toString(36)}.${'0'.repeat(32)}`, registro)).rejects.toMatchObject({ estado: 403 });
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
  const una = { ahora: AHORA, secreto: 'una' };

  it('sólo valen para su consigna y con la misma clave', async () => {
    const pase = await paseDe('fruta', una);
    expect(pase).toMatch(/^[0-9a-z]+\.[0-9a-f]{32}$/);
    expect(await paseValido('fruta', pase, una)).toBe(true);
    expect(await paseValido('fruta', pase, { ...una, secreto: 'otra' })).toBe(false);
    expect(await paseValido('astro', pase, una)).toBe(false);
    expect(await paseValido('fruta', 42, una)).toBe(false);
  });

  it('vencen a las 48 horas', async () => {
    const pase = await paseDe('fruta', una);
    expect(await paseValido('fruta', pase, { ...una, ahora: AHORA + DURACION_DEL_PASE_MS - 1 })).toBe(true);
    expect(await paseValido('fruta', pase, { ...una, ahora: AHORA + DURACION_DEL_PASE_MS })).toBe(false);
    expect(await paseValido('fruta', pase, { ...una, ahora: AHORA + 7 * DIA_MS })).toBe(false);
  });

  it('no se puede estirar el vencimiento ni usar el de otro día', async () => {
    const [, firma] = (await paseDe('fruta', una)).split('.');
    const estirado = `${(AHORA + DURACION_DEL_PASE_MS + DIA_MS).toString(36)}.${firma}`;
    expect(await paseValido('fruta', estirado, una)).toBe(false);
    // El de un viaje de hace tres días ya no sirve hoy.
    expect(await paseValido('fruta', await paseDe('fruta', { ...una, ahora: AHORA - 3 * DIA_MS }), una)).toBe(false);
    // Uno que vence más lejos de lo que da el servidor tampoco.
    expect(await paseValido('fruta', await paseDe('fruta', { ...una, ahora: AHORA + DIA_MS }), una)).toBe(false);
  });

  it('un pase vencido no da la lista ni los porcentajes', async () => {
    const { registro } = registroDePrueba();
    const r = await terminar(viajeDelDia(HOY, 1, 0), registro, AHORA);
    const id = Object.keys(r.pases)[0];
    const despues = AHORA + DURACION_DEL_PASE_MS + 1;
    await expect(respuestasDe(id, r.pases[id], registro, despues)).rejects.toMatchObject({ estado: 403 });
    await expect(porcentajesDe(id, registro, { pase: r.pases[id], ahora: despues })).rejects.toMatchObject({ estado: 403 });
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
