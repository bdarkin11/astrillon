import type { NivelId } from '../juego/niveles';
import { COREOGRAFIAS } from './coreografia';

export interface Nota {
  onda: 'square' | 'triangle' | 'sawtooth' | 'ruido';
  /** Frecuencia inicial en hercios. En el ruido, la frecuencia de muestreo: más baja suena más sucio. */
  desde: number;
  /** Si está, la frecuencia se desliza hasta acá. */
  hasta?: number;
  /** En segundos. */
  duracion: number;
  volumen: number;
  retraso?: number;
}

export type Evento =
  | 'tecla'
  | 'enviar'
  | 'rechazo'
  | 'linea'
  | 'despegar'
  | 'error'
  | 'tic'
  | 'toque'
  | 'final'
  | `viaje-${NivelId}`
  | `llegada-${NivelId}`;

/** Notas seguidas, como en las consolas viejas: nada de acordes, un arpegio rápido. */
function arpegio(frecuencias: number[], paso: number, duracion: number, volumen: number, onda: Nota['onda'] = 'square', retraso = 0): Nota[] {
  return frecuencias.map((desde, i) => ({ onda, desde, duracion, volumen, retraso: retraso + i * paso }));
}

const segundos = (nivel: NivelId) => COREOGRAFIAS[nivel].duracion / 1000;

export const SONIDOS: Record<Evento, Nota[]> = {
  tecla: [{ onda: 'square', desde: 1400, duracion: 0.035, volumen: 0.045 }],
  enviar: [{ onda: 'square', desde: 660, hasta: 990, duracion: 0.09, volumen: 0.1 }],
  rechazo: [
    { onda: 'square', desde: 170, hasta: 110, duracion: 0.2, volumen: 0.14 },
    { onda: 'ruido', desde: 2000, duracion: 0.12, volumen: 0.06 },
  ],
  linea: [{ onda: 'square', desde: 1320, hasta: 1760, duracion: 0.06, volumen: 0.07 }],
  despegar: [
    { onda: 'ruido', desde: 3000, hasta: 800, duracion: 0.7, volumen: 0.05 },
    { onda: 'square', desde: 110, hasta: 440, duracion: 0.7, volumen: 0.08 },
  ],
  error: [
    { onda: 'square', desde: 220, hasta: 55, duracion: 0.45, volumen: 0.14 },
    { onda: 'ruido', desde: 1500, duracion: 0.3, volumen: 0.09 },
  ],
  tic: [{ onda: 'square', desde: 880, duracion: 0.07, volumen: 0.14 }],
  toque: arpegio([900, 1300], 0.07, 0.07, 0.09),
  final: arpegio([392, 523.25, 659.25, 783.99], 0.11, 0.2, 0.1, 'triangle'),

  // Durante el viaje: de un motor que apenas tira a un salto al hiperespacio.
  'viaje-basura': [{ onda: 'triangle', desde: 220, hasta: 130, duracion: segundos('basura'), volumen: 0.1 }],
  'viaje-vivo': [
    ...arpegio([620, 440, 620, 440, 620, 440], 0.18, 0.15, 0.06),
    { onda: 'triangle', desde: 150, hasta: 300, duracion: segundos('vivo'), volumen: 0.08 },
  ],
  'viaje-satelite': [
    { onda: 'triangle', desde: 180, hasta: 520, duracion: segundos('satelite'), volumen: 0.11 },
    ...arpegio([1319, 1319, 1319], 0.7, 0.04, 0.04, 'square', 0.2),
  ],
  'viaje-cometa': [
    { onda: 'triangle', desde: 180, hasta: 880, duracion: segundos('cometa'), volumen: 0.12 },
    { onda: 'ruido', desde: 6000, hasta: 1500, duracion: segundos('cometa'), volumen: 0.04 },
  ],
  'viaje-nebulosa': [
    { onda: 'triangle', desde: 82, hasta: 55, duracion: segundos('nebulosa'), volumen: 0.16 },
    ...arpegio([311.13, 277.18, 233.08], 1, 0.9, 0.05, 'triangle', 0.4),
  ],
  'viaje-astrillon': [
    { onda: 'sawtooth', desde: 70, hasta: 1760, duracion: segundos('astrillon'), volumen: 0.07 },
    { onda: 'ruido', desde: 1500, hasta: 9000, duracion: segundos('astrillon'), volumen: 0.05 },
  ],

  // Al llegar: cuanto más rara la respuesta, más larga y alegre la frase.
  'llegada-basura': [{ onda: 'square', desde: 196, hasta: 147, duracion: 0.28, volumen: 0.1 }],
  // El "trombón triste" de Pasado de Vivo: te creíste original.
  'llegada-vivo': arpegio([392, 370, 349.23, 329.63], 0.17, 0.16, 0.1),
  'llegada-satelite': arpegio([523.25, 659.25], 0.09, 0.16, 0.11),
  'llegada-cometa': [...arpegio([523.25, 659.25, 783.99], 0.08, 0.18, 0.12), { onda: 'ruido', desde: 2500, duracion: 0.2, volumen: 0.06 }],
  'llegada-nebulosa': [...arpegio([392, 523.25, 659.25, 987.77], 0.1, 0.3, 0.12, 'triangle'), { onda: 'ruido', desde: 1200, duracion: 0.3, volumen: 0.07 }],
  'llegada-astrillon': [
    ...arpegio([523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51], 0.1, 0.22, 0.12),
    { onda: 'triangle', desde: 65, hasta: 40, duracion: 1, volumen: 0.2 },
    { onda: 'ruido', desde: 4000, hasta: 1000, duracion: 0.9, volumen: 0.08 },
  ],
};

/** Cuánto dura un evento completo, en segundos. */
export function duracionDe(evento: Evento): number {
  return Math.max(...SONIDOS[evento].map((n) => (n.retraso ?? 0) + n.duracion));
}

const ATAQUE = 0.004;

/** Agenda un sonido en un contexto de audio. Sirve también para medirlo sin reproducirlo. */
export function programarSonido(ac: BaseAudioContext, salida: AudioNode, evento: Evento): void {
  const ahora = ac.currentTime;
  for (const nota of SONIDOS[evento]) {
    const inicio = ahora + (nota.retraso ?? 0);
    const volumen = ac.createGain();
    volumen.gain.setValueAtTime(0, inicio);
    volumen.gain.linearRampToValueAtTime(nota.volumen, inicio + ATAQUE);
    volumen.gain.setValueAtTime(nota.volumen, inicio + nota.duracion * 0.7);
    volumen.gain.linearRampToValueAtTime(0, inicio + nota.duracion);
    volumen.connect(salida);

    if (nota.onda === 'ruido') {
      programarRuido(ac, volumen, nota, inicio);
      continue;
    }
    const oscilador = ac.createOscillator();
    oscilador.type = nota.onda;
    oscilador.frequency.setValueAtTime(nota.desde, inicio);
    if (nota.hasta) oscilador.frequency.exponentialRampToValueAtTime(nota.hasta, inicio + nota.duracion);
    oscilador.connect(volumen);
    oscilador.start(inicio);
    oscilador.stop(inicio + nota.duracion + 0.02);
  }
}

/** Ruido escalonado, como el canal de ruido de una consola: repite cada muestra varias veces. */
function programarRuido(ac: BaseAudioContext, salida: AudioNode, nota: Nota, inicio: number): void {
  const muestras = Math.ceil(ac.sampleRate * (nota.duracion + 0.02));
  const buffer = ac.createBuffer(1, muestras, ac.sampleRate);
  const datos = buffer.getChannelData(0);
  const repeticion = Math.max(1, Math.round(ac.sampleRate / nota.desde));
  let valor = 0;
  for (let i = 0; i < muestras; i++) {
    if (i % repeticion === 0) valor = Math.random() * 2 - 1;
    datos[i] = valor;
  }
  const fuente = ac.createBufferSource();
  fuente.buffer = buffer;
  if (nota.hasta) fuente.playbackRate.setValueAtTime(1, inicio);
  if (nota.hasta) fuente.playbackRate.linearRampToValueAtTime(nota.hasta / nota.desde, inicio + nota.duracion);
  fuente.connect(salida);
  fuente.start(inicio);
  fuente.stop(inicio + nota.duracion + 0.02);
}

/** Volumen general y limitador, para que varios sonidos juntos no saturen. */
export function crearSalida(ac: BaseAudioContext, volumen: number): GainNode {
  const general = ac.createGain();
  general.gain.value = volumen;
  const limitador = ac.createDynamicsCompressor();
  general.connect(limitador);
  limitador.connect(ac.destination);
  return general;
}
