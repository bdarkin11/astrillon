import { describe, expect, it } from 'vitest';
import {
  aLaParada,
  avanceDelTramo,
  formatearDistancia,
  nombreEnFrase,
  paradaActual,
  paradasEntre,
  proximaParada,
  recorridoMillonesKm,
  RUTA,
} from './ruta';

describe('ruta', () => {
  it('empieza en la Tierra, con los puntos siempre en aumento y sin ids repetidos', () => {
    expect(RUTA[0].id).toBe('tierra');
    expect(RUTA[0].puntos).toBe(0);
    for (let i = 1; i < RUTA.length; i++) {
      expect(RUTA[i].puntos, RUTA[i].id).toBeGreaterThan(RUTA[i - 1].puntos);
    }
    expect(new Set(RUTA.map((p) => p.id)).size).toBe(RUTA.length);
  });

  it('respeta el orden acordado del viaje', () => {
    const ids = RUTA.map((p) => p.id);
    const orden = ['tierra', 'luna', 'venus', 'mercurio', 'marte', 'ceres', 'jupiter', 'saturno', 'urano', 'neptuno', 'pluton'];
    const posiciones = orden.map((id) => ids.indexOf(id));
    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
    expect(posiciones).not.toContain(-1);
  });

  it('ubica el puntaje en la parada alcanzada', () => {
    expect(paradaActual(0).id).toBe('tierra');
    expect(paradaActual(9).id).toBe('tierra');
    expect(paradaActual(10).id).toBe('luna');
    expect(paradaActual(205).id).toBe('europa');
    expect(paradaActual(99999).id).toBe('andromeda');
  });

  it('da la próxima parada y null al final', () => {
    expect(proximaParada(0)?.id).toBe('luna');
    expect(proximaParada(99999)).toBeNull();
  });

  it('calcula el avance del tramo', () => {
    expect(avanceDelTramo(0)).toBe(0);
    expect(avanceDelTramo(5)).toBe(0.5);
    expect(avanceDelTramo(99999)).toBe(1);
  });

  it('lista las paradas alcanzadas sin repetir la de partida', () => {
    expect(paradasEntre(0, 30).map((p) => p.id)).toEqual(['luna', 'venus']);
    expect(paradasEntre(10, 20)).toEqual([]);
  });

  it('lo recorrido nunca retrocede, ni en el sobrevuelo ni después de la última parada', () => {
    let anterior = -1;
    for (let puntos = 0; puntos <= 2500; puntos += 5) {
      const actual = recorridoMillonesKm(puntos);
      expect(actual, `a ${puntos} puntos`).toBeGreaterThanOrEqual(anterior);
      anterior = actual;
    }
  });

  it('arma las frases con el artículo y la contracción correctos', () => {
    const buscar = (id: string) => RUTA.find((p) => p.id === id)!;
    expect(aLaParada(buscar('luna'))).toBe('a la Luna');
    expect(aLaParada(buscar('kuiper'))).toBe('al Cinturón de Kuiper');
    expect(aLaParada(buscar('marte'))).toBe('a Marte');
    expect(nombreEnFrase(buscar('centro'))).toBe('el Centro de la Vía Láctea');
  });

  it('formatea la distancia según su escala', () => {
    expect(formatearDistancia(0)).toBe('0 km');
    expect(formatearDistancia(0.3844)).toBe('384.000 km');
    expect(formatearDistancia(230)).toBe('230 millones de km');
    expect(formatearDistancia(4500)).toBe('4,5 mil millones de km');
    expect(formatearDistancia(40_000_000)).toBe('4,2 años luz');
  });
});
