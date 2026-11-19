import { describe, expect, it } from 'vitest';
import { NIVELES_ORDENADOS } from '../juego/niveles';
import { COREOGRAFIAS } from './coreografia';
import { duracionDe, SONIDOS } from './sonidos';
import type { Evento } from './sonidos';

describe('sonidos', () => {
  it('cada evento tiene notas, con volúmenes bajos y frecuencias válidas', () => {
    for (const [evento, notas] of Object.entries(SONIDOS)) {
      expect(notas.length, evento).toBeGreaterThan(0);
      for (const nota of notas) {
        expect(nota.volumen, evento).toBeGreaterThan(0);
        expect(nota.volumen, evento).toBeLessThanOrEqual(0.2);
        expect(nota.desde, evento).toBeGreaterThan(0);
        expect(nota.duracion, evento).toBeGreaterThan(0);
      }
    }
  });

  it('hay un sonido de viaje y de llegada para cada nivel', () => {
    for (const { id } of NIVELES_ORDENADOS) {
      expect(SONIDOS[`viaje-${id}` as Evento], id).toBeDefined();
      expect(SONIDOS[`llegada-${id}` as Evento], id).toBeDefined();
    }
  });

  it('el sonido del viaje no sigue después de llegar', () => {
    for (const { id } of NIVELES_ORDENADOS) {
      expect(duracionDe(`viaje-${id}` as Evento), id).toBeLessThanOrEqual(COREOGRAFIAS[id].duracion / 1000 + 0.01);
    }
  });

  it('cuanto más rara la respuesta, más larga la frase de llegada', () => {
    expect(duracionDe('llegada-astrillon')).toBeGreaterThan(duracionDe('llegada-nebulosa'));
    expect(duracionDe('llegada-nebulosa')).toBeGreaterThan(duracionDe('llegada-satelite'));
  });

  it('los sonidos que se repiten mucho son muy cortos y suaves', () => {
    expect(duracionDe('tecla')).toBeLessThan(0.05);
    expect(SONIDOS.tecla[0].volumen).toBeLessThan(0.05);
    expect(duracionDe('tic')).toBeLessThan(0.1);
  });
});
