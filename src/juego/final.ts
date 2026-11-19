import type { NivelId } from './niveles';
import type { ResultadoConsigna } from './partida';
import { nombreEnFrase, paradaActual, paradasEntre } from './ruta';
import type { Parada } from './ruta';

const EMOJI_NIVEL: Record<NivelId, string> = {
  basura: '⬜',
  vivo: '🟧',
  satelite: '🟦',
  cometa: '🟩',
  nebulosa: '🟪',
  astrillon: '🌟',
};
const EMOJI_SIN_PUNTOS = '❌';
const EMOJI_TURBO = '⚡';

export function emojiDe(resultado: ResultadoConsigna): string {
  if (!resultado.nivel || resultado.puntos === 0) return EMOJI_SIN_PUNTOS;
  return EMOJI_NIVEL[resultado.nivel.id] + (resultado.turbo ? EMOJI_TURBO : '');
}

export interface EntradaBitacora {
  resultado: ResultadoConsigna;
  emoji: string;
  /** Las paradas alcanzadas con esta respuesta, en orden de viaje. */
  paradas: Parada[];
}

export function bitacora(resultados: ResultadoConsigna[]): EntradaBitacora[] {
  let acumulado = 0;
  return resultados.map((resultado) => {
    const antes = acumulado;
    acumulado += resultado.puntos;
    return { resultado, emoji: emojiDe(resultado), paradas: paradasEntre(antes, acumulado) };
  });
}

/** La respuesta aceptada de mayor nivel. Si hay empate, la primera que dio el jugador. */
export function respuestaMasRara(resultados: ResultadoConsigna[]): ResultadoConsigna | null {
  let mejor: ResultadoConsigna | null = null;
  for (const resultado of resultados) {
    if (!resultado.nivel) continue;
    if (!mejor?.nivel || resultado.nivel.puntos > mejor.nivel.puntos) mejor = resultado;
  }
  return mejor;
}

export function cantidadDeConsignas(cantidad: number): string {
  return cantidad === 1 ? '1 consigna' : `${cantidad} consignas`;
}

export interface OpcionesCompartir {
  /** El número del viaje del día; en un viaje libre no hay. */
  numero?: number;
  racha?: number;
  url?: string;
  /** Si el link lleva el desafío: invita a jugar contra la nave de quien lo comparte. */
  desafio?: boolean;
}

/** No nombra ninguna respuesta, para no arruinarle las consignas a quien lo reciba. */
export function textoParaCompartir(resultados: ResultadoConsigna[], total: number, { numero, racha, url, desafio }: OpcionesCompartir = {}): string {
  const parada = paradaActual(total);
  const lineas = [
    numero ? `🚀 Astrillón #${numero}` : '🚀 Astrillón',
    total === 0 ? `No salí de ${nombreEnFrase(parada)}` : `Llegué hasta ${nombreEnFrase(parada)}`,
    `${total} puntos en ${cantidadDeConsignas(resultados.length)}`,
    resultados.map(emojiDe).join(''),
  ];
  if (racha && racha >= 2) lineas.push(`🔥 Racha de ${racha} días`);
  if (url && desafio) lineas.push('¿Llegás más lejos? Corré contra mi nave:');
  if (url) lineas.push(url);
  return lineas.join('\n');
}
