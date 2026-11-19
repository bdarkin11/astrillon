import { describe, expect, it } from 'vitest';
import { bitacora, emojiDe, respuestaMasRara, textoParaCompartir } from './final';
import { MODOS } from './modos';
import { NIVELES } from './niveles';
import type { NivelId } from './niveles';
import type { ResultadoConsigna } from './partida';
import { percentilEstimado } from './percentil';

const consigna = { id: 'prueba', texto: 'Nombrá algo', respuestas: [] };

function acierto(nivel: NivelId, nombre: string, turbo = false, puntos = NIVELES[nivel].puntos): ResultadoConsigna {
  return {
    consigna,
    respuesta: { nombre, nivel, alias: [] },
    nivel: NIVELES[nivel],
    puntos,
    turbo,
    intentoFallido: null,
  };
}

function error(intentoFallido: string | null = null): ResultadoConsigna {
  return { consigna, respuesta: null, nivel: null, puntos: 0, turbo: false, intentoFallido };
}

describe('pantalla final', () => {
  it('usa un emoji por nivel, marca el Turbo y cruza lo que no sumó', () => {
    expect(emojiDe(acierto('basura', 'A'))).toBe('⬜');
    expect(emojiDe(acierto('astrillon', 'B'))).toBe('🌟');
    expect(emojiDe(acierto('cometa', 'C', true, 120))).toBe('🟩⚡');
    expect(emojiDe(acierto('basura', 'D', true, 0))).toBe('❌');
    expect(emojiDe(error())).toBe('❌');
  });

  it('arma el texto para compartir con el destino y sin nombrar respuestas', () => {
    const resultados = [acierto('basura', 'Italia'), acierto('satelite', 'Perú'), error('xyz')];
    const texto = textoParaCompartir(resultados, 40);
    expect(texto).toBe('🚀 Astrillón\nLlegué hasta Venus\n40 puntos en 3 consignas\n⬜🟦❌');
    expect(texto).not.toContain('Italia');
    expect(texto).not.toContain('xyz');
  });

  it('dice que no salió de la Tierra si no sumó nada, y agrega la dirección si la hay', () => {
    const texto = textoParaCompartir([error()], 0, { url: 'https://ejemplo.test' });
    expect(texto).toBe('🚀 Astrillón\nNo salí de la Tierra\n0 puntos en 1 consigna\n❌\nhttps://ejemplo.test');
  });

  it('con desafío, invita a correr contra la nave antes del link', () => {
    const texto = textoParaCompartir([error()], 0, { url: 'https://ejemplo.test/#desafio=x', desafio: true });
    expect(texto.split('\n').slice(-2)).toEqual(['¿Llegás más lejos? Corré contra mi nave:', 'https://ejemplo.test/#desafio=x']);
  });

  it('suma el número del viaje y la racha, pero no una racha de un solo día', () => {
    const resultados = [acierto('basura', 'A')];
    expect(textoParaCompartir(resultados, 10, { numero: 4, racha: 3 })).toBe(
      '🚀 Astrillón #4\nLlegué hasta la Luna\n10 puntos en 1 consigna\n⬜\n🔥 Racha de 3 días',
    );
    expect(textoParaCompartir(resultados, 10, { numero: 4, racha: 1 })).not.toContain('Racha');
  });

  it('anota en la bitácora las paradas alcanzadas con cada respuesta', () => {
    const entradas = bitacora([acierto('basura', 'A'), error(), acierto('satelite', 'B')]);
    expect(entradas.map((e) => e.paradas.map((p) => p.id))).toEqual([['luna'], [], ['venus']]);
  });

  it('elige la respuesta de mayor nivel, y la primera si empatan', () => {
    const rara = acierto('nebulosa', 'Primera');
    expect(respuestaMasRara([acierto('basura', 'A'), rara, acierto('nebulosa', 'Segunda'), error()])).toBe(rara);
    expect(respuestaMasRara([error()])).toBeNull();
  });

  it('da una respuesta rara aunque el Turbo le haya dejado 0 puntos', () => {
    const fallido = acierto('satelite', 'A', true, 0);
    expect(respuestaMasRara([fallido])).toBe(fallido);
  });
});

describe('percentil estimado', () => {
  it('va de 0 a 100, nunca baja con más puntos y da siempre lo mismo', () => {
    for (const modo of MODOS) {
      expect(percentilEstimado(0, modo)).toBe(0);
      expect(percentilEstimado(1_000_000, modo)).toBe(100);
      let anterior = 0;
      for (let puntos = 0; puntos <= 3000; puntos += 50) {
        const actual = percentilEstimado(puntos, modo);
        expect(actual).toBeGreaterThanOrEqual(anterior);
        anterior = actual;
      }
    }
    expect(percentilEstimado(150, MODOS[0])).toBe(percentilEstimado(150, MODOS[0]));
  });

  it('deja un viaje normal del modo principal en la zona media, no en un extremo', () => {
    const percentil = percentilEstimado(300, MODOS[0]);
    expect(percentil).toBeGreaterThan(20);
    expect(percentil).toBeLessThan(80);
  });
});
