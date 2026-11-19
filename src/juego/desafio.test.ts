import { describe, expect, it } from 'vitest';
import { codificarDesafio, desafioDelLink, desafioDeViaje, leerDesafio, puntosAntesDe, puntosDelFantasma, totalDelDesafio, veredicto } from './desafio';
import type { Desafio } from './desafio';

const HOY = '2026-11-19';
const desafio: Desafio = {
  fecha: '2026-11-18',
  pasos: [
    { puntos: 30, segundos: 4.2 },
    { puntos: 0, segundos: 25 },
    { puntos: 200, segundos: 11.5 },
  ],
};

describe('desafío entre amigos', () => {
  it('ida y vuelta por el link sin perder nada', () => {
    const codigo = codificarDesafio(desafio);
    expect(codigo).toMatch(/^[0-9a-z._-]+$/);
    expect(leerDesafio(codigo, HOY)).toEqual(desafio);
    expect(desafioDelLink(`#desafio=${codigo}`, HOY)).toEqual(desafio);
  });

  it('rechaza códigos rotos, del futuro o con puntos imposibles', () => {
    expect(leerDesafio('basura', HOY)).toBeNull();
    expect(leerDesafio('2.20261118.u-1a', HOY)).toBeNull();
    expect(leerDesafio(codificarDesafio({ ...desafio, fecha: '2026-11-20' }), HOY)).toBeNull();
    expect(leerDesafio(codificarDesafio({ ...desafio, fecha: '2025-01-01' }), HOY)).toBeNull();
    expect(leerDesafio(codificarDesafio({ fecha: '2026-11-18', pasos: [{ puntos: 999, segundos: 3 }] }), HOY)).toBeNull();
    expect(leerDesafio(codificarDesafio({ fecha: '2026-11-18', pasos: [{ puntos: 10, segundos: 90 }] }), HOY)).toBeNull();
    expect(desafioDelLink('', HOY)).toBeNull();
  });

  it('el fantasma avanza recién cuando su dueño respondió', () => {
    expect(totalDelDesafio(desafio)).toBe(230);
    expect(puntosAntesDe(desafio, 2)).toBe(30);
    expect(puntosDelFantasma(desafio, 0, 4)).toBe(0);
    expect(puntosDelFantasma(desafio, 0, 4.2)).toBe(30);
    expect(puntosDelFantasma(desafio, 2, 12)).toBe(230);
    // Si su viaje terminó antes, se queda donde llegó.
    expect(puntosDelFantasma(desafio, 7, 20)).toBe(230);
  });

  it('gana quien llega más lejos', () => {
    expect(veredicto(240, 230)).toBe('ganaste');
    expect(veredicto(100, 230)).toBe('perdiste');
    expect(veredicto(230, 230)).toBe('empate');
  });
});

describe('desafío desde un viaje jugado', () => {
  it('redondea a décimas, topea en 25 segundos y completa los que no se midieron', () => {
    const armado = desafioDeViaje('2026-11-18', [{ puntos: 30, segundos: 4.234 }, { puntos: 0, segundos: 31 }, { puntos: 60 }]);
    expect(armado.pasos).toEqual([{ puntos: 30, segundos: 4.2 }, { puntos: 0, segundos: 25 }, { puntos: 60, segundos: 12 }]);
    expect(leerDesafio(codificarDesafio(armado), HOY)).toEqual(armado);
  });
});
