export type Estilo =
  | 'rocoso'
  | 'tierra'
  | 'volcanico'
  | 'helado'
  | 'bandas'
  | 'gas'
  | 'estrella'
  | 'campo'
  | 'nebulosa'
  | 'galaxia'
  | 'frontera';

export interface Parada {
  id: string;
  nombre: string;
  /** Para los nombres que lo llevan al escribir frases: "la Luna", "el Cinturón de Kuiper". */
  articulo?: 'el' | 'la';
  /** Qué es: "Luna de Júpiter", "Planeta enano"... */
  tipo: string;
  /** Puntos que hacen falta para llegar. */
  puntos: number;
  /** Distancia al Sol en millones de km, usada para calcular lo recorrido. */
  distanciaSol: number;
  dato: string;
  estilo: Estilo;
  /** Radio en pantalla, en píxeles grandes del dibujo. */
  radio: number;
  colores: [string, string, string];
  anillos?: boolean;
}

const luna = (planeta: string) => `Luna de ${planeta}`;

/**
 * La ruta en orden de viaje. Después de la Luna se pasa por Venus y Mercurio,
 * un sobrevuelo para tomar impulso como hacen las sondas reales, y de ahí hacia afuera.
 */
export const RUTA: Parada[] = [
  { id: 'tierra', nombre: 'Tierra', articulo: 'la', tipo: 'Punto de partida', puntos: 0, distanciaSol: 150, dato: 'Es el único mundo donde sabemos que hay vida.', estilo: 'tierra', radio: 60, colores: ['#2a78d6', '#3fa35b', '#eef6ff'] },
  { id: 'luna', nombre: 'Luna', articulo: 'la', tipo: 'Satélite de la Tierra', puntos: 10, distanciaSol: 150.3844, dato: 'Es el único mundo fuera de la Tierra que pisaron seres humanos.', estilo: 'rocoso', radio: 14, colores: ['#c9c9c4', '#8d8d89', '#5d5d5b'] },
  { id: 'venus', nombre: 'Venus', tipo: 'Planeta', puntos: 30, distanciaSol: 108, dato: 'Es el planeta más caliente, con unos 465 °C, y su día dura más que su año.', estilo: 'gas', radio: 30, colores: ['#f2d59a', '#d9a65c', '#a8743a'] },
  { id: 'mercurio', nombre: 'Mercurio', tipo: 'Planeta', puntos: 50, distanciaSol: 58, dato: 'Es el planeta más chico, y da una vuelta al Sol en solo 88 días.', estilo: 'rocoso', radio: 16, colores: ['#b5a899', '#83776b', '#544b43'] },
  { id: 'marte', nombre: 'Marte', tipo: 'Planeta', puntos: 80, distanciaSol: 228, dato: 'Tiene el Monte Olimpo, el volcán más alto del sistema solar, de unos 22 km.', estilo: 'rocoso', radio: 24, colores: ['#e0784a', '#b24f2c', '#74301b'] },
  { id: 'fobos', nombre: 'Fobos', tipo: luna('Marte'), puntos: 90, distanciaSol: 228, dato: 'Orbita tan cerca que da unas tres vueltas a Marte por cada día marciano.', estilo: 'rocoso', radio: 7, colores: ['#a39482', '#75695c', '#4d443b'] },
  { id: 'deimos', nombre: 'Deimos', tipo: luna('Marte'), puntos: 100, distanciaSol: 228, dato: 'Mide apenas unos 12 km de diámetro.', estilo: 'rocoso', radio: 6, colores: ['#b3a593', '#857a6b', '#574f44'] },
  { id: 'ceres', nombre: 'Ceres', tipo: 'Planeta enano', puntos: 130, distanciaSol: 414, dato: 'Es el objeto más grande del cinturón de asteroides.', estilo: 'rocoso', radio: 11, colores: ['#a9a6a0', '#7b7873', '#514f4b'] },
  { id: 'jupiter', nombre: 'Júpiter', tipo: 'Planeta', puntos: 170, distanciaSol: 778, dato: 'Tiene más masa que todos los demás planetas juntos.', estilo: 'bandas', radio: 50, colores: ['#ecd9b8', '#c98f5e', '#8f5a3a'] },
  { id: 'io', nombre: 'Ío', tipo: luna('Júpiter'), puntos: 185, distanciaSol: 778, dato: 'Es el cuerpo con más actividad volcánica del sistema solar.', estilo: 'volcanico', radio: 11, colores: ['#f0dc6e', '#d9a53d', '#7d4a1e'] },
  { id: 'europa', nombre: 'Europa', tipo: luna('Júpiter'), puntos: 200, distanciaSol: 778, dato: 'Bajo su corteza de hielo habría un océano de agua líquida, más grande que todos los de la Tierra juntos.', estilo: 'helado', radio: 10, colores: ['#f1e9dc', '#cdbfa9', '#9c7f62'] },
  { id: 'ganimedes', nombre: 'Ganímedes', tipo: luna('Júpiter'), puntos: 215, distanciaSol: 779, dato: 'Es la luna más grande del sistema solar, más grande que Mercurio.', estilo: 'rocoso', radio: 14, colores: ['#b8ad9d', '#857b6c', '#5a5247'] },
  { id: 'calisto', nombre: 'Calisto', tipo: luna('Júpiter'), puntos: 230, distanciaSol: 780, dato: 'Es uno de los cuerpos con más cráteres del sistema solar.', estilo: 'rocoso', radio: 13, colores: ['#8d8173', '#655c51', '#423c34'] },
  { id: 'saturno', nombre: 'Saturno', tipo: 'Planeta', puntos: 270, distanciaSol: 1434, dato: 'Es menos denso que el agua, y sus anillos son sobre todo de hielo.', estilo: 'bandas', radio: 42, colores: ['#f1e0b5', '#d9bd85', '#a98a56'], anillos: true },
  { id: 'mimas', nombre: 'Mimas', tipo: luna('Saturno'), puntos: 285, distanciaSol: 1434, dato: 'Un cráter enorme la hace parecida a la Estrella de la Muerte.', estilo: 'rocoso', radio: 8, colores: ['#d6d4cf', '#a3a19c', '#6f6d69'] },
  { id: 'encelado', nombre: 'Encélado', tipo: luna('Saturno'), puntos: 300, distanciaSol: 1434, dato: 'Lanza al espacio géiseres de agua desde su polo sur.', estilo: 'helado', radio: 8, colores: ['#ffffff', '#dcecf5', '#9dbccd'] },
  { id: 'titan', nombre: 'Titán', tipo: luna('Saturno'), puntos: 315, distanciaSol: 1435, dato: 'Es la única luna con atmósfera densa, y tiene lagos de metano.', estilo: 'gas', radio: 14, colores: ['#e9b65c', '#c98a35', '#8a5a20'] },
  { id: 'japeto', nombre: 'Japeto', tipo: luna('Saturno'), puntos: 330, distanciaSol: 1438, dato: 'Tiene una mitad muy oscura y la otra muy clara.', estilo: 'rocoso', radio: 10, colores: ['#e6e1d8', '#8f8678', '#2f2a24'] },
  { id: 'urano', nombre: 'Urano', tipo: 'Planeta', puntos: 370, distanciaSol: 2871, dato: 'Gira acostado: su eje está inclinado unos 98 grados.', estilo: 'gas', radio: 32, colores: ['#c8f0ef', '#93d8dc', '#5ba3ad'] },
  { id: 'miranda', nombre: 'Miranda', tipo: luna('Urano'), puntos: 385, distanciaSol: 2871, dato: 'Tiene Verona Rupes, uno de los acantilados más altos que se conocen en el sistema solar.', estilo: 'helado', radio: 8, colores: ['#dcdcd8', '#a8a8a4', '#6d6d6a'] },
  { id: 'titania', nombre: 'Titania', tipo: luna('Urano'), puntos: 400, distanciaSol: 2872, dato: 'Es la luna más grande de Urano.', estilo: 'rocoso', radio: 10, colores: ['#c2b9ae', '#8f867b', '#5e574e'] },
  { id: 'neptuno', nombre: 'Neptuno', tipo: 'Planeta', puntos: 445, distanciaSol: 4495, dato: 'Tiene los vientos más rápidos del sistema solar, de unos 2.000 km/h.', estilo: 'gas', radio: 32, colores: ['#6f9cf2', '#3f67d1', '#233c8f'] },
  { id: 'triton', nombre: 'Tritón', tipo: luna('Neptuno'), puntos: 460, distanciaSol: 4495, dato: 'Es la única luna grande que orbita en sentido contrario al de su planeta.', estilo: 'helado', radio: 10, colores: ['#f0dcd6', '#c9aaa5', '#8c6f6b'] },
  { id: 'pluton', nombre: 'Plutón', tipo: 'Planeta enano', puntos: 505, distanciaSol: 5906, dato: 'Tiene una gran llanura de hielo con forma de corazón.', estilo: 'helado', radio: 12, colores: ['#e7d3b8', '#b89a78', '#7a5f47'] },
  { id: 'caronte', nombre: 'Caronte', tipo: luna('Plutón'), puntos: 515, distanciaSol: 5906, dato: 'Es tan grande que Plutón y Caronte giran alrededor de un punto entre los dos.', estilo: 'rocoso', radio: 8, colores: ['#b5aca5', '#857d77', '#574f4b'] },
  { id: 'kuiper', nombre: 'Cinturón de Kuiper', articulo: 'el', tipo: 'Región de cuerpos helados', puntos: 565, distanciaSol: 7500, dato: 'La sonda New Horizons visitó allí al objeto Arrokoth en 2019.', estilo: 'campo', radio: 40, colores: ['#c5d4e8', '#8fa3bf', '#5a6d87'] },
  { id: 'eris', nombre: 'Eris', tipo: 'Planeta enano', puntos: 625, distanciaSol: 10100, dato: 'Tiene más masa que Plutón, y su hallazgo llevó a redefinir qué es un planeta.', estilo: 'helado', radio: 11, colores: ['#f4f2ee', '#c8c5bf', '#85827c'] },
  { id: 'heliopausa', nombre: 'Heliopausa', articulo: 'la', tipo: 'Frontera del Sol', puntos: 700, distanciaSol: 18000, dato: 'Aquí termina la influencia del viento solar. La Voyager 1 la cruzó en 2012.', estilo: 'frontera', radio: 60, colores: ['#7fd4ff', '#4f8fd9', '#2b4f8f'] },
  { id: 'oort', nombre: 'Nube de Oort', articulo: 'la', tipo: 'Nube de cometas', puntos: 800, distanciaSol: 300000, dato: 'Sería el origen de los cometas de período largo, pero nunca se la observó directamente.', estilo: 'campo', radio: 55, colores: ['#e8eefc', '#a9b8d8', '#6c7ba0'] },
  { id: 'proxima', nombre: 'Próxima Centauri', tipo: 'Estrella', puntos: 1000, distanciaSol: 40_000_000, dato: 'Es la estrella más cercana al Sol, a 4,24 años luz.', estilo: 'estrella', radio: 18, colores: ['#ffd0a8', '#ff8a5c', '#c9402a'] },
  { id: 'sirio', nombre: 'Sirio', tipo: 'Estrella', puntos: 1200, distanciaSol: 81_000_000, dato: 'Es la estrella más brillante del cielo nocturno, a 8,6 años luz.', estilo: 'estrella', radio: 24, colores: ['#ffffff', '#cfe4ff', '#7fb0ff'] },
  { id: 'orion', nombre: 'Nebulosa de Orión', articulo: 'la', tipo: 'Nebulosa', puntos: 1400, distanciaSol: 12_700_000_000, dato: 'Está a unos 1.344 años luz y se puede ver a simple vista.', estilo: 'nebulosa', radio: 70, colores: ['#ff8ad0', '#9a6bff', '#3c7be0'] },
  { id: 'centro', nombre: 'Centro de la Vía Láctea', articulo: 'el', tipo: 'Agujero negro Sagitario A*', puntos: 1700, distanciaSol: 246_000_000_000, dato: 'Está a unos 26.000 años luz y tiene la masa de unos 4 millones de soles.', estilo: 'estrella', radio: 26, colores: ['#fff1c9', '#ffb84d', '#b3541e'] },
  { id: 'andromeda', nombre: 'Galaxia de Andrómeda', articulo: 'la', tipo: 'Galaxia', puntos: 2000, distanciaSol: 23_600_000_000_000, dato: 'A unos 2,5 millones de años luz, suele considerarse lo más lejano que se ve a simple vista.', estilo: 'galaxia', radio: 70, colores: ['#fff4d6', '#c9b6ff', '#6a7fd9'] },
];

/** El nombre para usar en una frase: "la Luna", "Marte". */
export function nombreEnFrase(parada: Parada): string {
  return parada.articulo ? `${parada.articulo} ${parada.nombre}` : parada.nombre;
}

/** "a la Luna", "al Cinturón de Kuiper", "a Marte". */
export function aLaParada(parada: Parada): string {
  return parada.articulo === 'el' ? `al ${parada.nombre}` : `a ${nombreEnFrase(parada)}`;
}

/** Millones de km acumulados al llegar a cada parada, sumando cada tramo del viaje. */
const RECORRIDO: number[] = (() => {
  const acumulado = [0];
  for (let i = 1; i < RUTA.length; i++) {
    const tramo = Math.abs(RUTA[i].distanciaSol - RUTA[i - 1].distanciaSol);
    acumulado.push(acumulado[i - 1] + tramo);
  }
  return acumulado;
})();

function indiceDeUltimaParada(puntos: number): number {
  let indice = 0;
  for (let i = 0; i < RUTA.length; i++) {
    if (RUTA[i].puntos <= puntos) indice = i;
  }
  return indice;
}

/** La última parada alcanzada con estos puntos. */
export function paradaActual(puntos: number): Parada {
  return RUTA[indiceDeUltimaParada(puntos)];
}

/** La próxima parada, o null si ya se pasó la última. */
export function proximaParada(puntos: number): Parada | null {
  return RUTA[indiceDeUltimaParada(puntos) + 1] ?? null;
}

/** Fracción del tramo actual ya recorrida, de 0 a 1. */
export function avanceDelTramo(puntos: number): number {
  const actual = paradaActual(puntos);
  const proxima = proximaParada(puntos);
  if (!proxima) return 1;
  return (puntos - actual.puntos) / (proxima.puntos - actual.puntos);
}

/** Las paradas alcanzadas al pasar de un puntaje a otro, en orden de viaje. */
export function paradasEntre(desde: number, hasta: number): Parada[] {
  return RUTA.filter((p) => p.puntos > desde && p.puntos <= hasta);
}

/** Millones de km recorridos con estos puntos, interpolando entre paradas. */
export function recorridoMillonesKm(puntos: number): number {
  const i = indiceDeUltimaParada(puntos);
  const proxima = RUTA[i + 1];
  if (!proxima) {
    // Pasada la última parada, cada punto sigue sumando al ritmo del último tramo.
    const ultimo = RUTA.length - 1;
    const ritmo = (RECORRIDO[ultimo] - RECORRIDO[ultimo - 1]) / (RUTA[ultimo].puntos - RUTA[ultimo - 1].puntos);
    return RECORRIDO[ultimo] + (puntos - RUTA[ultimo].puntos) * ritmo;
  }
  return RECORRIDO[i] + avanceDelTramo(puntos) * (RECORRIDO[i + 1] - RECORRIDO[i]);
}

const MILLONES_KM_POR_ANIO_LUZ = 9_461_000;

const numero = (valor: number, decimales = 0) =>
  valor.toLocaleString('es-AR', { maximumFractionDigits: decimales });

/** Para la regla, donde hay poco lugar: "384 mil km", "230 M km", "4,5 mil M km", "4,2 años luz". */
export function formatearDistanciaCorta(millonesKm: number): string {
  if (millonesKm === 0) return '0 km';
  if (millonesKm < 1) return `${numero(millonesKm * 1000)} mil km`;
  if (millonesKm < 1000) return `${numero(millonesKm)} M km`;
  if (millonesKm < 1_000_000) return `${numero(millonesKm / 1000, 1)} mil M km`;
  return `${numero(millonesKm / MILLONES_KM_POR_ANIO_LUZ, 1)} años luz`;
}

/** "384.400 km", "230 millones de km", "4,2 años luz"... */
export function formatearDistancia(millonesKm: number): string {
  if (millonesKm < 1) return `${numero(Math.round(millonesKm * 1000) * 1000)} km`;
  if (millonesKm < 1000) return `${numero(millonesKm)} millones de km`;
  if (millonesKm < 1_000_000) return `${numero(millonesKm / 1000, 1)} mil millones de km`;
  return `${numero(millonesKm / MILLONES_KM_POR_ANIO_LUZ, 1)} años luz`;
}
