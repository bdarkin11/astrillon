import { describe, expect, it } from 'vitest';
import { anguloDelBarrido, enPeligro, pasosEncendidos } from './radar';

describe('radar', () => {
  it('avisa peligro sólo en los últimos 3 segundos', () => {
    expect(enPeligro(3001)).toBe(false);
    expect(enPeligro(3000)).toBe(true);
    expect(enPeligro(1)).toBe(true);
    expect(enPeligro(0)).toBe(false);
  });

  it('el barrido da la vuelta completa y va al doble si queda poco tiempo', () => {
    expect(anguloDelBarrido(0, false)).toBe(0);
    expect(anguloDelBarrido(1200, false)).toBeCloseTo(Math.PI);
    expect(anguloDelBarrido(2400, false)).toBe(0);
    expect(anguloDelBarrido(600, true)).toBeCloseTo(Math.PI);
  });

  it('el aro se apaga con el tiempo, sin salirse de sus límites', () => {
    expect(pasosEncendidos(1, 48)).toBe(48);
    expect(pasosEncendidos(0.5, 48)).toBe(24);
    expect(pasosEncendidos(0.001, 48)).toBe(1);
    expect(pasosEncendidos(0, 48)).toBe(0);
    expect(pasosEncendidos(-1, 48)).toBe(0);
    expect(pasosEncendidos(2, 48)).toBe(48);
  });
});
