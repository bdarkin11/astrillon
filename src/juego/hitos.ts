/** Dibujos disponibles para las sondas. */
export type DibujoDeSonda = 'estacion' | 'telescopio' | 'webb' | 'modulo' | 'rover' | 'plato' | 'paneles';

export interface Hito {
  id: string;
  /** Puntos a los que aparece en el recorrido. */
  puntos: number;
  /** Lado de la pantalla en el que va el texto. */
  lado: 'izquierda' | 'derecha';
  texto: string;
  /** Los títulos de zona se ven más grandes. */
  zona?: boolean;
  sonda?: DibujoDeSonda;
  /** La sonda se dibuja apoyada sobre esta parada, en vez de flotar. */
  sobreParada?: string;
}

/**
 * Lo que se cruza la nave en el camino. Las sondas son reales; la revisión de fechas está en
 * privado/docs/revision-de-datos.md. Los textos evitan decir que algo "sigue" funcionando, porque eso cambia.
 */
export const HITOS: Hito[] = [
  { id: 'estacion', puntos: 3, lado: 'izquierda', texto: 'Estación Espacial Internacional, a unos 400 km', sonda: 'estacion' },
  { id: 'hubble', puntos: 6, lado: 'derecha', texto: 'Telescopio Hubble, en órbita desde 1990', sonda: 'telescopio' },
  { id: 'apolo', puntos: 12, lado: 'izquierda', texto: 'El Apolo 11 llegó acá en 1969', sonda: 'modulo', sobreParada: 'luna' },
  { id: 'webb', puntos: 20, lado: 'derecha', texto: 'Telescopio James Webb, a 1,5 millones de km de la Tierra', sonda: 'webb' },
  { id: 'venus-gira', puntos: 44, lado: 'izquierda', texto: 'Venus gira al revés que casi todos los planetas' },
  { id: 'parker', puntos: 62, lado: 'derecha', texto: 'La sonda Parker atravesó la atmósfera del Sol', sonda: 'paneles' },
  { id: 'curiosity', puntos: 83, lado: 'derecha', texto: 'El rover Curiosity llegó a Marte en 2012', sonda: 'rover', sobreParada: 'marte' },
  { id: 'cinturon', puntos: 112, lado: 'izquierda', texto: 'Cinturón de asteroides', zona: true },
  { id: 'dawn', puntos: 136, lado: 'izquierda', texto: 'La sonda Dawn orbitó Ceres desde 2015', sonda: 'paneles' },
  { id: 'gigantes', puntos: 158, lado: 'derecha', texto: 'Gigantes gaseosos', zona: true },
  { id: 'juno', puntos: 178, lado: 'derecha', texto: 'La sonda Juno llegó a Júpiter en 2016', sonda: 'paneles' },
  { id: 'cassini', puntos: 278, lado: 'derecha', texto: 'Cassini estudió Saturno 13 años y se hundió en él en 2017', sonda: 'plato' },
  { id: 'huygens', puntos: 320, lado: 'derecha', texto: 'La sonda Huygens se posó en Titán en 2005', sonda: 'modulo', sobreParada: 'titan' },
  { id: 'voyager-2', puntos: 376, lado: 'izquierda', texto: 'Sólo la Voyager 2 visitó Urano y Neptuno', sonda: 'plato' },
  { id: 'new-horizons', puntos: 510, lado: 'derecha', texto: 'New Horizons pasó por Plutón en 2015', sonda: 'plato' },
  { id: 'punto-azul', puntos: 535, lado: 'izquierda', texto: 'A esta distancia, la Voyager 1 fotografió la Tierra como un punto azul pálido' },
  { id: 'voyager-1', puntos: 712, lado: 'derecha', texto: 'La Voyager 1, lanzada en 1977, es lo más lejos que llegó algo hecho por humanos', sonda: 'plato' },
  { id: 'interestelar', puntos: 730, lado: 'izquierda', texto: 'Espacio interestelar', zona: true },
  { id: 'sin-humanos', puntos: 760, lado: 'derecha', texto: 'De acá en adelante, ninguna nave humana' },
  { id: 'otra-estrella', puntos: 980, lado: 'izquierda', texto: 'Otras estrellas', zona: true },
  { id: 'fuera-galaxia', puntos: 1800, lado: 'derecha', texto: 'Afuera de la Vía Láctea', zona: true },
];

/** Cuántos puntos sigue a la vista un hito después de cruzarlo, en la franja del celular. */
const PUNTOS_A_LA_VISTA = 25;

/** El último hito que cruzó la nave, si todavía está cerca. */
export function hitoReciente(puntos: number): Hito | null {
  let reciente: Hito | null = null;
  for (const hito of HITOS) if (hito.puntos <= puntos) reciente = hito;
  return reciente && puntos - reciente.puntos <= PUNTOS_A_LA_VISTA ? reciente : null;
}

/** Parte un texto en renglones que entren en el ancho disponible, sin cortar palabras. */
export function partirEnLineas(texto: string, entra: (linea: string) => boolean): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (actual && !entra(candidata)) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidata;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export type ObjetoDeFondo = 'chatarra' | 'roca' | 'hielo' | 'cometa';

/** Qué flota en cada parte del viaje. Lejos de todo no hay nada: el vacío también se tiene que sentir. */
export function zonaDeFondo(puntos: number): { cantidad: number; tipos: ObjetoDeFondo[] } {
  if (puntos < 25) return { cantidad: 5, tipos: ['chatarra'] };
  if (puntos < 112) return { cantidad: 3, tipos: ['roca'] };
  if (puntos < 165) return { cantidad: 6, tipos: ['roca'] };
  if (puntos < 565) return { cantidad: 4, tipos: ['roca', 'hielo'] };
  if (puntos < 800) return { cantidad: 4, tipos: ['hielo', 'cometa'] };
  return { cantidad: 0, tipos: [] };
}

/** Cuánto se oscurecen los bordes: la luz del Sol se va apagando con la distancia. */
export function nivelDeVineta(puntos: number): number {
  if (puntos < 100) return 0;
  if (puntos < 300) return 1;
  if (puntos < 700) return 2;
  return 3;
}
