export type NivelId =
  | 'basura'
  | 'vivo'
  | 'satelite'
  | 'cometa'
  | 'nebulosa'
  | 'astrillon';

export interface Nivel {
  id: NivelId;
  nombre: string;
  puntos: number;
  frase: string;
}

export const NIVELES: Record<NivelId, Nivel> = {
  basura: {
    id: 'basura',
    nombre: 'Basura Espacial',
    puntos: 10,
    frase: 'La que dice todo el mundo. Orbita cerca de casa.',
  },
  vivo: {
    id: 'vivo',
    nombre: 'Pasado de Vivo',
    puntos: 15,
    frase: 'Te creíste original, pero a todos se les ocurrió lo mismo.',
  },
  satelite: {
    id: 'satelite',
    nombre: 'Satélite',
    puntos: 30,
    frase: 'Sólida. Ya saliste de la atmósfera.',
  },
  cometa: {
    id: 'cometa',
    nombre: 'Cometa',
    puntos: 60,
    frase: 'Poco común. Linda estela.',
  },
  nebulosa: {
    id: 'nebulosa',
    nombre: 'Nebulosa',
    puntos: 85,
    frase: 'Muy pocos llegan hasta acá.',
  },
  astrillon: {
    id: 'astrillon',
    nombre: 'Una en un Astrillón',
    puntos: 100,
    frase: 'La joya de la consigna. Absurdo.',
  },
};

/** Los niveles de mayor a menor puntaje, en el orden en que se muestran. */
export const NIVELES_ORDENADOS: Nivel[] = Object.values(NIVELES).sort(
  (a, b) => b.puntos - a.puntos,
);

/** Puntos mínimos que tiene que valer la respuesta para que el Turbo funcione. */
export const MINIMO_TURBO = NIVELES.cometa.puntos;
