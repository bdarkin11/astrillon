import { describe, expect, it } from 'vitest';
import { textoDePorcentaje } from './api';

describe('porcentajes', () => {
  it('redondea y no muestra 0% en las joyas', () => {
    expect(textoDePorcentaje(12.4)).toBe('12%');
    expect(textoDePorcentaje(0.4)).toBe('menos del 1%');
    expect(textoDePorcentaje(1)).toBe('1%');
  });
});
