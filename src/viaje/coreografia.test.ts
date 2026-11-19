import { describe, expect, it } from 'vitest';
import { NIVELES_ORDENADOS } from '../juego/niveles';
import { COREOGRAFIAS, DESTELLOS_POR_SEGUNDO_MAXIMOS, recortarParaCartel } from './coreografia';

describe('coreografías', () => {
  it('cuanto más rara la respuesta, más dura el viaje y más estalla al llegar', () => {
    const deMenorAMayor = [...NIVELES_ORDENADOS].reverse().map((n) => COREOGRAFIAS[n.id]);
    for (let i = 1; i < deMenorAMayor.length; i++) {
      expect(deMenorAMayor[i].duracion).toBeGreaterThanOrEqual(deMenorAMayor[i - 1].duracion);
    }
    expect(COREOGRAFIAS.astrillon.estallido).toBeGreaterThan(COREOGRAFIAS.basura.estallido * 5);
  });

  it('ningún nivel supera el límite de destellos para personas fotosensibles', () => {
    for (const coreografia of Object.values(COREOGRAFIAS)) {
      const destellos = coreografia.destellos;
      if (destellos && destellos.veces > 1) {
        expect(1000 / destellos.cadaMs).toBeLessThanOrEqual(DESTELLOS_POR_SEGUNDO_MAXIMOS);
      }
    }
  });

  it('sólo la joya deja la nave dorada', () => {
    const doradas = Object.entries(COREOGRAFIAS).filter(([, c]) => c.dorar).map(([id]) => id);
    expect(doradas).toEqual(['astrillon']);
  });
});

describe('cartel de la respuesta', () => {
  const entranDiez = (texto: string) => texto.length <= 10;

  it('deja igual lo que entra', () => {
    expect(recortarParaCartel('Marmota', entranDiez)).toBe('Marmota');
  });

  it('recorta lo largo con puntos suspensivos, sin espacio antes', () => {
    const recortado = recortarParaCartel('Una respuesta muy larga', entranDiez);
    expect(recortado).toBe('Una res...');
    expect(recortado.length).toBeLessThanOrEqual(10);
    expect(recortarParaCartel('Las acacias', entranDiez)).toBe('Las aca...');
  });
});
