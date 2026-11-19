import { describe, expect, it } from 'vitest';
import { HITOS, hitoReciente, nivelDeVineta, partirEnLineas, zonaDeFondo } from './hitos';
import { formatearDistanciaCorta, RUTA } from './ruta';

describe('hitos del recorrido', () => {
  it('van en orden de viaje, sin ids repetidos y dentro de la ruta', () => {
    for (let i = 1; i < HITOS.length; i++) {
      expect(HITOS[i].puntos, HITOS[i].id).toBeGreaterThan(HITOS[i - 1].puntos);
    }
    expect(new Set(HITOS.map((h) => h.id)).size).toBe(HITOS.length);
    expect(HITOS[HITOS.length - 1].puntos).toBeLessThanOrEqual(RUTA[RUTA.length - 1].puntos);
  });

  it('las sondas apoyadas apuntan a una parada que existe', () => {
    const ids = new Set(RUTA.map((p) => p.id));
    for (const hito of HITOS) if (hito.sobreParada) expect(ids.has(hito.sobreParada), hito.id).toBe(true);
  });

  it('dos textos seguidos del mismo lado no se pisan', () => {
    const porLado = { izquierda: [] as number[], derecha: [] as number[] };
    for (const hito of HITOS) porLado[hito.lado].push(hito.puntos);
    for (const lista of Object.values(porLado)) {
      for (let i = 1; i < lista.length; i++) expect(lista[i] - lista[i - 1]).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('hito reciente', () => {
  it('da el último cruzado mientras siga cerca', () => {
    expect(hitoReciente(0)).toBeNull();
    expect(hitoReciente(7)?.id).toBe('hubble');
    expect(hitoReciente(112)?.id).toBe('cinturon');
    expect(hitoReciente(1000)?.id).toBe('otra-estrella');
    expect(hitoReciente(1100)).toBeNull();
  });
});

describe('partir en líneas', () => {
  const entranDiez = (t: string) => t.length <= 10;

  it('no corta palabras y usa todo el ancho', () => {
    expect(partirEnLineas('uno dos tres cuatro', entranDiez)).toEqual(['uno dos', 'tres', 'cuatro']);
  });

  it('deja sola una palabra larga en vez de perderla', () => {
    expect(partirEnLineas('interestelar sí', entranDiez)).toEqual(['interestelar', 'sí']);
  });
});

describe('zonas del fondo', () => {
  it('hay chatarra cerca de casa, asteroides en el cinturón y nada en el espacio interestelar', () => {
    expect(zonaDeFondo(0).tipos).toEqual(['chatarra']);
    expect(zonaDeFondo(130).tipos).toEqual(['roca']);
    expect(zonaDeFondo(130).cantidad).toBeGreaterThan(zonaDeFondo(60).cantidad);
    expect(zonaDeFondo(700).tipos).toContain('cometa');
    expect(zonaDeFondo(1500).cantidad).toBe(0);
  });

  it('la viñeta sólo crece con la distancia', () => {
    let anterior = 0;
    for (let puntos = 0; puntos <= 2500; puntos += 50) {
      expect(nivelDeVineta(puntos)).toBeGreaterThanOrEqual(anterior);
      anterior = nivelDeVineta(puntos);
    }
    expect(nivelDeVineta(0)).toBe(0);
  });
});

describe('distancia corta', () => {
  it('usa la escala que corresponde', () => {
    expect(formatearDistanciaCorta(0)).toBe('0 km');
    expect(formatearDistanciaCorta(0.3844)).toBe('384 mil km');
    expect(formatearDistanciaCorta(230)).toBe('230 M km');
    expect(formatearDistanciaCorta(4500)).toBe('4,5 mil M km');
    expect(formatearDistanciaCorta(40_000_000)).toBe('4,2 años luz');
  });
});
