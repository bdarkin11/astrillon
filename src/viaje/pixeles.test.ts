import { describe, expect, it } from 'vitest';
import { bordeDe, escalar2x, espejar } from './pixeles';
import { MITAD_DE_LA_NAVE, NAVE, SOMBRA_DE_LA_NAVE } from './nave';

describe('escalar al doble', () => {
  it('duplica el tamaño y deja igual un bloque lleno', () => {
    expect(escalar2x(['AA', 'AA'])).toEqual(['AAAA', 'AAAA', 'AAAA', 'AAAA']);
  });

  it('suaviza una diagonal en vez de dejar escalones gruesos', () => {
    const doble = escalar2x(['A.', 'AA']);
    expect(doble).toEqual(['AA..', 'AAA.', 'AAAA', 'AAAA']);
  });

  it('un píxel suelto no se deforma', () => {
    expect(escalar2x(['...', '.A.', '...'])[2]).toBe('..AA..');
  });
});

describe('espejar', () => {
  it('copia la mitad izquierda del otro lado, con la letra en sombra', () => {
    expect(espejar(['.LR'], { L: 'l' })).toEqual(['.LRl.']);
  });
});

describe('bordes', () => {
  it('distingue el borde con luz del borde en sombra', () => {
    const mapa = ['AAA', 'AAA', 'AAA'];
    expect(bordeDe(mapa, 0, 0)).toBe('luz');
    expect(bordeDe(mapa, 2, 2)).toBe('sombra');
    expect(bordeDe(mapa, 1, 1)).toBeNull();
  });
});

describe('nave', () => {
  it('todas las filas tienen el mismo ancho y la nave es simétrica en su forma', () => {
    const ancho = NAVE[0].length;
    expect(ancho).toBe(MITAD_DE_LA_NAVE[0].length * 2 - 1);
    for (const fila of NAVE) {
      expect(fila.length).toBe(ancho);
      const forma = [...fila].map((letra) => (letra === '.' ? '.' : '#')).join('');
      expect(forma).toBe([...forma].reverse().join(''));
    }
  });

  it('tiene más del doble de detalle que la nave anterior, de 13 por 14', () => {
    expect(NAVE.length * NAVE[0].length).toBeGreaterThan(13 * 14 * 3.5);
  });

  it('sólo usa letras con color definido', () => {
    const letras = new Set(NAVE.join('').replaceAll('.', ''));
    for (const letra of letras) expect(Object.keys(SOMBRA_DE_LA_NAVE).concat(Object.values(SOMBRA_DE_LA_NAVE), ['O', 'G', 'Y', 'r', 's', 'c', 'l']).includes(letra), letra).toBe(true);
  });
});
