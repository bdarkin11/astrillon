import type { NivelId } from '../juego/niveles';

export interface Destellos {
  color: string;
  veces: number;
  cadaMs: number;
}

/** Qué pasa en pantalla con cada nivel: cuanto más rara la respuesta, más reacciona todo. */
export interface Coreografia {
  color: string;
  /** Duración del viaje, en milisegundos. */
  duracion: number;
  /** Cuánto se hamaca la nave de costado, en píxeles. */
  balanceo: number;
  /** Cuánto vibra la nave durante el viaje, en píxeles. */
  vibracion: number;
  destellos: Destellos | null;
  sacudidaAlSalir: number;
  sacudidaAlLlegar: number;
  /** Colores de las partículas que deja la nave, y cada cuántos milisegundos suelta una. */
  estela: { colores: string[]; cadaMs: number };
  /** Partículas que explotan al llegar. */
  estallido: number;
  /** Multiplica el largo de las estrellas durante el viaje. */
  estirarEstrellas: number;
  /** Naves iguales a la tuya que cruzan la pantalla. */
  navesCruzando: number;
  satelites: number;
  chatarra: number;
  oscuridad: boolean;
  gas: boolean;
  /** La nave queda dorada el resto del viaje. */
  dorar: boolean;
  /** El puntaje golpea al sumarse, en vez de solo contar. */
  golpeDePuntaje: boolean;
}

const BASE = {
  balanceo: 0,
  vibracion: 0,
  destellos: null,
  sacudidaAlSalir: 0,
  sacudidaAlLlegar: 0,
  estirarEstrellas: 1,
  navesCruzando: 0,
  satelites: 0,
  chatarra: 0,
  oscuridad: false,
  gas: false,
  dorar: false,
  golpeDePuntaje: false,
};

export const COREOGRAFIAS: Record<NivelId, Coreografia> = {
  basura: {
    ...BASE,
    color: '#c9c6e6',
    duracion: 1900,
    balanceo: 22,
    chatarra: 6,
    estela: { colores: ['#8d8aa8', '#5f5c7c'], cadaMs: 90 },
    estallido: 8,
  },
  vivo: {
    ...BASE,
    color: '#ffb238',
    duracion: 2300,
    vibracion: 3,
    destellos: { color: '#ff9b2e', veces: 3, cadaMs: 360 },
    sacudidaAlSalir: 8,
    sacudidaAlLlegar: 6,
    navesCruzando: 10,
    estela: { colores: ['#ffb238', '#ff8a3c'], cadaMs: 60 },
    estallido: 18,
  },
  satelite: {
    ...BASE,
    color: '#3ad6c5',
    duracion: 2300,
    balanceo: 6,
    satelites: 3,
    estela: { colores: ['#3ad6c5', '#b7f3ff'], cadaMs: 45 },
    estallido: 22,
  },
  cometa: {
    ...BASE,
    color: '#8ff0a4',
    duracion: 2900,
    balanceo: 5,
    destellos: { color: '#b7f3ff', veces: 1, cadaMs: 400 },
    sacudidaAlLlegar: 10,
    estirarEstrellas: 6,
    estela: { colores: ['#ffffff', '#b7f3ff', '#8ff0a4'], cadaMs: 14 },
    estallido: 30,
    golpeDePuntaje: true,
  },
  nebulosa: {
    ...BASE,
    color: '#d59bff',
    duracion: 3600,
    balanceo: 3,
    oscuridad: true,
    gas: true,
    sacudidaAlLlegar: 6,
    estela: { colores: ['#d59bff', '#ff8ad0', '#6f9cf2'], cadaMs: 40 },
    estallido: 26,
    golpeDePuntaje: true,
  },
  astrillon: {
    ...BASE,
    color: '#ffe066',
    duracion: 4200,
    balanceo: 4,
    destellos: { color: '#ffe066', veces: 2, cadaMs: 800 },
    sacudidaAlSalir: 6,
    sacudidaAlLlegar: 14,
    estirarEstrellas: 26,
    dorar: true,
    estela: { colores: ['#ffe066', '#fff6cf', '#ffb238'], cadaMs: 10 },
    estallido: 70,
    golpeDePuntaje: true,
  },
};

/** Los destellos nunca superan los 3 por segundo, el límite de seguridad para personas fotosensibles. */
export const DESTELLOS_POR_SEGUNDO_MAXIMOS = 3;

/** Largo máximo de la respuesta en el cartel: se corta en el último espacio o letra que entre. */
export function recortarParaCartel(texto: string, entra: (texto: string) => boolean): string {
  if (entra(texto)) return texto;
  let corte = texto.length - 1;
  while (corte > 1 && !entra(`${texto.slice(0, corte).trimEnd()}...`)) corte -= 1;
  return `${texto.slice(0, corte).trimEnd()}...`;
}
