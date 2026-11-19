import { espejar } from './pixeles';

/**
 * Mitad izquierda de la nave, vista desde atrás y apuntando hacia arriba. La última columna es el centro.
 * O contorno · R casco rojo · P brillo rojo · L casco claro · W brillo blanco · S metal
 * C ventanilla · w reflejo de la ventanilla · G motor · Y luz de navegación.
 */
export const MITAD_DE_LA_NAVE = [
  '.............O',
  '............OR',
  '...........OPR',
  '...........OPR',
  '..........OPRR',
  '..........OWLL',
  '.........OWLLL',
  '.........OWLOO',
  '.........OWOwC',
  '.........OWOCC',
  '.........OWOCC',
  '.........OWLOO',
  '.........OWLLL',
  '.........OWLLL',
  '.........OSSSS',
  '........OSWLLL',
  '.......ORSWLLL',
  '......ORRSWLLL',
  '.....ORPRSWLLL',
  '....ORPRRSWLLL',
  '...ORPRRRSWLLL',
  '..ORPRRRRSWLLL',
  '.OYPRRRROSSSSS',
  '.OrrrrrO.OGGGG',
  '..OOOOO..OGGO.',
  '.........OssO.',
  '..........OO..',
];

/** Del lado derecho, a la sombra, cada color se cambia por su versión oscura. */
export const SOMBRA_DE_LA_NAVE: Record<string, string> = { W: 'l', L: 'l', P: 'R', R: 'r', S: 's', C: 'c', w: 'C' };

export const NAVE = espejar(MITAD_DE_LA_NAVE, SOMBRA_DE_LA_NAVE);

export const PALETA_DE_LA_NAVE: Record<string, string> = {
  O: '#241b45',
  R: '#ff5d73',
  r: '#b3324f',
  P: '#ffa3b1',
  L: '#e9e6f7',
  l: '#a9a3cf',
  W: '#ffffff',
  S: '#9c97c9',
  s: '#5f5a8a',
  C: '#3ad6c5',
  c: '#1f8f8a',
  w: '#d4fff8',
  G: '#4a4580',
  Y: '#3ad6c5',
};

export const PALETA_DORADA: Record<string, string> = {
  ...PALETA_DE_LA_NAVE,
  O: '#3a2410',
  R: '#ffb238',
  r: '#c98a35',
  P: '#ffe9a8',
  L: '#ffe066',
  l: '#c9a23a',
  W: '#fff6cf',
  S: '#c98a35',
  s: '#7d4a1e',
  C: '#fff6cf',
  c: '#ffb238',
  w: '#ffffff',
  G: '#7d4a1e',
  Y: '#ffffff',
};

/** Columnas donde están las dos toberas, en píxeles del dibujo: de ahí salen las llamas. */
export const TOBERAS = [11, 15];
