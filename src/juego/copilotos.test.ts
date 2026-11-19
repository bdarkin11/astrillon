import { describe, expect, it } from 'vitest';
import { COPILOTOS, copilotoElegido, estaDesbloqueado, REACCIONES, ubicacionDeCopiloto } from './copilotos';
import type { Pose } from './copilotos';
import { NIVELES_ORDENADOS } from './niveles';

const POSES: Pose[] = ['inicio', 'costado', 'consigna', 'viaje', 'resultado'];

describe('copilotos', () => {
  it('el primero está disponible desde el principio y los demás piden cada vez más racha', () => {
    expect(COPILOTOS[0].racha).toBe(0);
    for (let i = 1; i < COPILOTOS.length; i++) expect(COPILOTOS[i].racha).toBeGreaterThan(COPILOTOS[i - 1].racha);
    expect(new Set(COPILOTOS.map((c) => c.id)).size).toBe(COPILOTOS.length);
  });

  it('se desbloquean con la mejor racha, justo al llegar', () => {
    const rover = COPILOTOS.find((c) => c.id === 'rover')!;
    expect(estaDesbloqueado(rover, 4)).toBe(false);
    expect(estaDesbloqueado(rover, 5)).toBe(true);
  });

  it('vuelve al primero si el elegido no existe o no está desbloqueado', () => {
    expect(copilotoElegido(undefined, 0).id).toBe('robot');
    expect(copilotoElegido('inventado', 99).id).toBe('robot');
    expect(copilotoElegido('cuantico', 10).id).toBe('robot');
    expect(copilotoElegido('lunar', 14).id).toBe('lunar');
  });

  it('reacciona a todos los niveles y al error', () => {
    for (const nivel of NIVELES_ORDENADOS) expect(REACCIONES[nivel.id], nivel.id).toBeDefined();
    expect(REACCIONES.error.cara).toBe('triste');
  });
});

describe('ubicación del copiloto', () => {
  it('nunca queda fuera de la pantalla', () => {
    for (const [ancho, alto] of [[375, 700], [800, 640], [1920, 1080]]) {
      for (const pose of POSES) {
        const lugar = ubicacionDeCopiloto(pose, ancho, alto);
        if (!lugar) continue;
        expect(lugar.x, `${pose} ${ancho}`).toBeGreaterThan(0);
        expect(lugar.x, `${pose} ${ancho}`).toBeLessThan(ancho);
        expect(lugar.y, `${pose} ${ancho}`).toBeGreaterThan(0);
        expect(lugar.y, `${pose} ${ancho}`).toBeLessThan(alto);
      }
    }
  });

  it('en pantallas anchas no tapa los paneles mientras se responde', () => {
    for (const ancho of [800, 1024, 1920]) {
      for (const pose of ['consigna', 'resultado', 'inicio', 'costado'] as Pose[]) {
        const lugar = ubicacionDeCopiloto(pose, ancho, 700)!;
        const bordeDelPanel = (ancho - 560) / 2;
        const afuera = lugar.x + 32 <= bordeDelPanel || lugar.x - 32 >= ancho - bordeDelPanel;
        expect(afuera, `${pose} ${ancho}`).toBe(true);
      }
    }
  });

  it('en celular se esconde en las pantallas largas para no tapar botones', () => {
    expect(ubicacionDeCopiloto('costado', 375, 700)).toBeNull();
    expect(ubicacionDeCopiloto('consigna', 375, 700)).not.toBeNull();
  });
});
