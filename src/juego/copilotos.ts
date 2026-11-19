import type { NivelId } from './niveles';

export type Cara = 'normal' | 'feliz' | 'triste' | 'desmayo' | 'asombro' | 'parpadeo';
export type Animacion = 'triste' | 'desmayo' | 'contento' | 'asombro' | 'festeja' | 'giro';

export interface Copiloto {
  id: string;
  nombre: string;
  /** Mejor racha que hace falta para desbloquearlo. */
  racha: number;
  /** Lo que dice cuando lo tocan. */
  sonido: string;
  /** Colores: B cuerpo, H brillo, D sombra, S pantalla, E ojos y boca, A antena, F pies. */
  colores: Record<'B' | 'H' | 'D' | 'S' | 'E' | 'A' | 'F', string>;
}

export const COPILOTOS: Copiloto[] = [
  { id: 'robot', nombre: 'Bip', racha: 0, sonido: '¡bip!', colores: { B: '#c9c6e6', H: '#eef0fb', D: '#6d6a8c', S: '#111c44', E: '#3ad6c5', A: '#ff5d73', F: '#ffb238' } },
  { id: 'rover', nombre: 'Óxido', racha: 5, sonido: '¡clonc!', colores: { B: '#e0784a', H: '#f2a77e', D: '#74301b', S: '#2a1410', E: '#ffe066', A: '#3ad6c5', F: '#544d47' } },
  { id: 'lunar', nombre: 'Selene', racha: 14, sonido: '¡blip!', colores: { B: '#8fc4e8', H: '#eaf6ff', D: '#3f67d1', S: '#10204f', E: '#ffffff', A: '#ffb238', F: '#c9c6e6' } },
  { id: 'nebular', nombre: 'Nébula', racha: 30, sonido: '¡fiuuu!', colores: { B: '#d59bff', H: '#f2dcff', D: '#6a3fb0', S: '#1d0f3a', E: '#ff8ad0', A: '#8ff0a4', F: '#6f9cf2' } },
  { id: 'cuantico', nombre: 'Cuark', racha: 45, sonido: '¡zzzt!', colores: { B: '#2c3a78', H: '#3ad6c5', D: '#111c44', S: '#02040a', E: '#ff5d73', A: '#ffe066', F: '#3ad6c5' } },
];

/** Los colores dorados que toma cualquier copiloto al encontrar una joya. */
export const COLORES_DORADOS: Partial<Copiloto['colores']> = { B: '#ffe066', H: '#fff6cf', D: '#c98a35', A: '#ffb238', F: '#ffb238' };

export function estaDesbloqueado(copiloto: Copiloto, mejorRacha: number): boolean {
  return mejorRacha >= copiloto.racha;
}

/** El copiloto a mostrar: el elegido si sigue siendo válido, y si no, el primero. */
export function copilotoElegido(id: string | undefined, mejorRacha: number): Copiloto {
  const elegido = COPILOTOS.find((c) => c.id === id);
  return elegido && estaDesbloqueado(elegido, mejorRacha) ? elegido : COPILOTOS[0];
}

export interface Reaccion {
  cara: Cara;
  animacion: Animacion;
  globo: string;
  /** Cuánto dura, en milisegundos. */
  duracion: number;
}

/** Cómo reacciona a cada respuesta. En Pasado de Vivo se desmaya: se creyó lo de "original". */
export const REACCIONES: Record<NivelId | 'error', Reaccion> = {
  basura: { cara: 'triste', animacion: 'triste', globo: 'bip...', duracion: 2400 },
  vivo: { cara: 'desmayo', animacion: 'desmayo', globo: '¡bzzt!', duracion: 2400 },
  satelite: { cara: 'feliz', animacion: 'contento', globo: 'bip bip', duracion: 1600 },
  cometa: { cara: 'feliz', animacion: 'contento', globo: '¡bip!', duracion: 2000 },
  nebulosa: { cara: 'asombro', animacion: 'asombro', globo: '¿¡bip!?', duracion: 2600 },
  astrillon: { cara: 'feliz', animacion: 'festeja', globo: '¡¡BIIIP!!', duracion: 2400 },
  error: { cara: 'triste', animacion: 'triste', globo: 'bip...', duracion: 2200 },
};

export type Pose = 'inicio' | 'costado' | 'consigna' | 'viaje' | 'resultado';

const ANCHO_DE_LOS_PANELES = 560;
const ANCHO_CON_LUGAR_AL_COSTADO = 800;
const TAMANIO = 64;

/** Dónde se ubica en cada pantalla. Con null se esconde, para no tapar nada en pantallas angostas. */
export function ubicacionDeCopiloto(pose: Pose, ancho: number, alto: number): { x: number; y: number } | null {
  const hayCostado = ancho >= ANCHO_CON_LUGAR_AL_COSTADO;
  const costado = Math.max(TAMANIO / 2 + 8, (ancho - ANCHO_DE_LOS_PANELES) / 2 - TAMANIO / 2 - 16);
  switch (pose) {
    case 'viaje':
      return { x: ancho / 2 + 96, y: alto * 0.74 - 16 };
    case 'inicio':
      return hayCostado ? { x: ancho - costado, y: alto * 0.6 } : { x: ancho - 48, y: alto - 150 };
    case 'consigna':
      // En celular deja libre el rincón del botón de sonido.
      return hayCostado ? { x: costado, y: alto * 0.45 } : { x: 84, y: alto - 44 };
    case 'resultado':
      return hayCostado ? { x: costado, y: alto * 0.4 } : { x: ancho - 44, y: alto - 44 };
    case 'costado':
      return hayCostado ? { x: ancho - costado, y: alto * 0.3 } : null;
  }
}
