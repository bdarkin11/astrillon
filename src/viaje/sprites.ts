import type { Cara } from '../juego/copilotos';
import type { DibujoDeSonda, ObjetoDeFondo } from '../juego/hitos';
import type { Parada } from '../juego/ruta';
import { NAVE, PALETA_DE_LA_NAVE, PALETA_DORADA } from './nave';
import { bordeDe, escalar2x } from './pixeles';

/** Dibujos pixelados generados por código, a baja resolución: la escena los amplía sin suavizar. */

export const COLOR_SOMBRA: Rgb = [22, 18, 58];

type Rgb = [number, number, number];

export function hexARgb(hex: string): Rgb {
  const valor = parseInt(hex.slice(1), 16);
  return [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255];
}

export function mezclar(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function semillaDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Generador de números con semilla: cada astro sale igual en todas las partidas. */
function azarCon(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function crearRuido(azar: () => number): (x: number, y: number) => number {
  const lado = 64;
  const tabla = Array.from({ length: lado * lado }, () => azar());
  const valor = (x: number, y: number) => tabla[((y & 63) * lado + (x & 63)) | 0];
  const capa = (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const arriba = valor(x0, y0) + (valor(x0 + 1, y0) - valor(x0, y0)) * sx;
    const abajo = valor(x0, y0 + 1) + (valor(x0 + 1, y0 + 1) - valor(x0, y0 + 1)) * sx;
    return arriba + (abajo - arriba) * sy;
  };
  return (x, y) => capa(x, y) * 0.6 + capa(x * 2.1 + 9, y * 2.1 + 4) * 0.3 + capa(x * 4.3 + 3, y * 4.3 + 7) * 0.1;
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const tramado = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;

export interface Sprite {
  lienzo: HTMLCanvasElement;
  ancho: number;
  alto: number;
}

class Pintura {
  readonly lienzo: HTMLCanvasElement;
  private readonly imagen: ImageData;
  private readonly contexto: CanvasRenderingContext2D;
  readonly ancho: number;
  readonly alto: number;

  constructor(ancho: number, alto: number) {
    this.ancho = ancho;
    this.alto = alto;
    this.lienzo = document.createElement('canvas');
    this.lienzo.width = ancho;
    this.lienzo.height = alto;
    this.contexto = this.lienzo.getContext('2d')!;
    this.imagen = this.contexto.createImageData(ancho, alto);
  }

  punto(x: number, y: number, color: Rgb): void {
    if (x < 0 || y < 0 || x >= this.ancho || y >= this.alto) return;
    const i = (Math.floor(y) * this.ancho + Math.floor(x)) * 4;
    this.imagen.data[i] = color[0];
    this.imagen.data[i + 1] = color[1];
    this.imagen.data[i + 2] = color[2];
    this.imagen.data[i + 3] = 255;
  }

  terminar(): Sprite {
    this.contexto.putImageData(this.imagen, 0, 0);
    return { lienzo: this.lienzo, ancho: this.ancho, alto: this.alto };
  }
}

interface Crater {
  x: number;
  y: number;
  r: number;
}

function crearCrateres(azar: () => number, radio: number, cantidad: number): Crater[] {
  return Array.from({ length: cantidad }, () => {
    const angulo = azar() * Math.PI * 2;
    const distancia = Math.sqrt(azar()) * radio * 0.9;
    return {
      x: Math.cos(angulo) * distancia,
      y: Math.sin(angulo) * distancia,
      r: Math.max(1, radio * (0.08 + azar() * 0.17)),
    };
  });
}

function colorDeSuperficie(parada: Parada, x: number, y: number, ruido: (x: number, y: number) => number, crateres: Crater[]): Rgb {
  const [c0, c1, c2] = parada.colores.map(hexARgb);
  const r = parada.radio;
  const n = ruido((x / r) * 2.4 + 11, (y / r) * 2.4 + 5);

  switch (parada.estilo) {
    case 'tierra': {
      const nube = ruido((x / r) * 5 + 30, (y / r) * 11 + 2);
      if (nube > 0.66) return c2;
      return ruido((x / r) * 6 + 7, (y / r) * 6 + 3) > 0.52 ? c1 : c0;
    }
    case 'volcanico': {
      if (ruido((x / r) * 6, (y / r) * 6) > 0.68) return c2;
      return n > 0.5 ? c0 : c1;
    }
    case 'helado': {
      const grieta = Math.abs(ruido((x / r) * 3 + 2, (y / r) * 3 + 8) - 0.5);
      if (grieta < 0.018) return c2;
      return n > 0.55 ? c1 : c0;
    }
    case 'bandas': {
      const ondulada = y / r + (n - 0.5) * 0.28;
      const banda = Math.sin(ondulada * 13);
      if (banda > 0.35) return c0;
      return banda > -0.3 ? c1 : c2;
    }
    case 'gas': {
      const ondulada = y / r + (n - 0.5) * 0.16;
      const banda = Math.sin(ondulada * 6);
      return banda > 0.3 ? c0 : c1;
    }
    default: {
      for (const crater of crateres) {
        const dx = x - crater.x;
        const dy = y - crater.y;
        const d = Math.hypot(dx, dy);
        // La luz viene de arriba a la izquierda: esa pared del cráter queda en sombra y el borde opuesto brilla.
        if (d < crater.r * 0.7) return dx + dy < 0 ? mezclar(c2, COLOR_SOMBRA, 0.35) : c2;
        if (d < crater.r) return dx + dy > 0 ? mezclar(c0, [255, 255, 255], 0.18) : c1;
      }
      return n > 0.5 ? c0 : c1;
    }
  }
}

/** Los astros con atmósfera tienen un halo tramado alrededor, más fuerte del lado iluminado. */
const CON_ATMOSFERA = new Set(['tierra', 'gas', 'bandas']);
const ESCALONES_DE_LUZ = 6;

/** Cuántos píxeles de halo deja alrededor del astro. */
export function margenDeAtmosfera(parada: Parada): number {
  return CON_ATMOSFERA.has(parada.estilo) ? Math.max(2, Math.round(parada.radio * 0.12)) : 0;
}

/**
 * Astro esférico, con luz desde arriba a la izquierda. La sombra baja en seis escalones tramados,
 * el borde iluminado tiene un brillo fino y los planetas helados o gaseosos, un reflejo.
 */
function pintarEsfera(pintura: Pintura, parada: Parada, cx: number, cy: number, azar: () => number): void {
  const r = parada.radio;
  const ruido = crearRuido(azar);
  const crateres = parada.estilo === 'rocoso' ? crearCrateres(azar, r, Math.round(4 + r * 0.5)) : [];
  const [c0] = parada.colores.map(hexARgb);
  const atmosfera = margenDeAtmosfera(parada);
  const reflejo = parada.estilo === 'helado' || parada.estilo === 'gas' || parada.estilo === 'bandas';

  for (let y = -r - atmosfera; y <= r + atmosfera; y++) {
    for (let x = -r - atmosfera; x <= r + atmosfera; x++) {
      const d = Math.hypot(x, y);
      const px = cx + x;
      const py = cy + y;
      if (d > r) {
        // Halo: se desvanece hacia afuera y se concentra del lado del Sol.
        if (!atmosfera || d > r + atmosfera) continue;
        const lado = Math.max(0, (-x - y) / (d * Math.SQRT2));
        const fuerza = (1 - (d - r) / atmosfera) * lado;
        if (fuerza > tramado(px, py) + 0.3) pintura.punto(px, py, mezclar(c0, COLOR_SOMBRA, 0.15));
        continue;
      }
      const nz = Math.sqrt(r * r - d * d) / r;
      const luz = (x / r) * -0.5 + (y / r) * -0.55 + nz * 0.67;
      const nivel = Math.max(0, Math.min(1, luz * 1.1 + 0.12));
      const escalon = Math.floor(nivel * ESCALONES_DE_LUZ + tramado(px, py)) / ESCALONES_DE_LUZ;
      let color = mezclar(COLOR_SOMBRA, colorDeSuperficie(parada, x, y, ruido, crateres), Math.max(0.1, Math.min(1, escalon)));
      // Borde iluminado: una línea fina de luz sobre el contorno del lado del Sol.
      if (d > r - 1.5 && x + y < -r * 0.3) color = mezclar(color, [255, 255, 255], 0.3);
      // Reflejo del Sol en los astros lisos.
      if (reflejo && Math.hypot(x + r * 0.42, y + r * 0.42) < r * 0.13) color = mezclar(color, [255, 255, 255], 0.35);
      // La sombra de los anillos cruza el planeta un poco por debajo del ecuador.
      if (parada.anillos && y > r * 0.1 && y < r * 0.2) color = mezclar(color, COLOR_SOMBRA, 0.4);
      pintura.punto(px, py, color);
    }
  }
}

function pintarAnillos(pintura: Pintura, parada: Parada, cx: number, cy: number, adelante: boolean): void {
  const [c0, c1, c2] = parada.colores.map(hexARgb);
  const r = parada.radio;
  const interno = r * 1.3;
  const externo = r * 2.05;
  const aplastado = 0.28;
  for (let y = -Math.ceil(externo * aplastado); y <= externo * aplastado; y++) {
    if (adelante !== y >= 0) continue;
    for (let x = -Math.ceil(externo); x <= externo; x++) {
      const d = Math.hypot(x, y / aplastado);
      if (d < interno || d > externo) continue;
      if (!adelante && x * x + y * y <= r * r) continue;
      const t = (d - interno) / (externo - interno);
      if (t > 0.62 && t < 0.7) continue;
      let color = t < 0.35 ? c1 : t < 0.62 ? c0 : c2;
      // Finas divisiones entre anillos, y la sombra del planeta sobre el anillo de adelante, a la derecha.
      if (Math.abs(t - 0.2) < 0.03 || Math.abs(t - 0.45) < 0.02) color = mezclar(color, COLOR_SOMBRA, 0.3);
      if (adelante && x > r * 0.2 && x < r * 1.15) color = mezclar(color, COLOR_SOMBRA, 0.55);
      if (!adelante) color = mezclar(color, COLOR_SOMBRA, 0.15);
      pintura.punto(cx + x, cy + y, color);
    }
  }
}

/** Estrella con núcleo blanco, tres tonos, halo tramado y destellos en cruz, como en las fotos de telescopio. */
function pintarEstrella(parada: Parada): Sprite {
  const [c0, c1, c2] = parada.colores.map(hexARgb);
  const r = parada.radio;
  const lado = r * 6 + 2;
  const pintura = new Pintura(lado, lado);
  const c = lado / 2;
  const agujero = parada.id === 'centro';
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      if (agujero && d < r * 0.62) {
        // Sagitario A*: un agujero negro con un disco brillante alrededor.
        pintura.punto(x, y, d > r * 0.55 ? c0 : [4, 2, 12]);
      } else if (d <= r) {
        const color = d < r * 0.35 && !agujero ? mezclar(c0, [255, 255, 255], 0.7) : d < r * 0.7 ? c0 : c1;
        pintura.punto(x, y, color);
      } else if (!agujero && (Math.abs(dx) < 1 || Math.abs(dy) < 1) && d < r * 2.9) {
        // Destellos en cruz, más largos que el halo y apagándose de a saltos.
        if (1 - (d - r) / (r * 1.9) > tramado(x, y) * 0.6) pintura.punto(x, y, d < r * 1.8 ? c0 : c1);
      } else if (d < r * 3 && (1 - (d - r) / (r * 2)) ** 2 > tramado(x, y)) {
        pintura.punto(x, y, d < r * 1.6 ? c1 : c2);
      }
    }
  }
  return pintura.terminar();
}

function pintarCampo(parada: Parada, azar: () => number): Sprite {
  const colores = parada.colores.map(hexARgb);
  const ancho = parada.radio * 5;
  const alto = parada.radio * 2;
  const pintura = new Pintura(ancho, alto);
  const cantidad = Math.round(ancho * alto * 0.018);
  for (let i = 0; i < cantidad; i++) {
    const x = azar() * ancho;
    const y = alto / 2 + (azar() - 0.5) * (azar() * alto);
    const color = colores[Math.floor(azar() * colores.length)];
    pintura.punto(x, y, color);
    if (azar() > 0.75) {
      pintura.punto(x + 1, y, color);
      pintura.punto(x, y + 1, color);
      pintura.punto(x + 1, y + 1, color);
    }
  }
  return pintura.terminar();
}

function pintarFrontera(parada: Parada): Sprite {
  const [c0, c1, c2] = parada.colores.map(hexARgb);
  // Mide igual con cualquier resolución: el radio de la frontera de origen es 60.
  const k = parada.radio / 60;
  const ancho = Math.round(320 * k);
  const alto = Math.round(70 * k);
  const pintura = new Pintura(ancho, alto);
  for (let x = 0; x < ancho; x++) {
    const curva = (50 - Math.sin((x / ancho) * Math.PI) * 28) * k;
    for (let y = 0; y < alto; y++) {
      const d = Math.abs(y - curva) / k;
      if (d > 14) continue;
      if (1 - d / 14 > tramado(x, y) + 0.1) {
        pintura.punto(x, y, d < 3 ? c0 : d < 8 ? c1 : c2);
      }
    }
  }
  return pintura.terminar();
}

function pintarNebulosa(parada: Parada, azar: () => number): Sprite {
  const [c0, c1, c2] = parada.colores.map(hexARgb);
  const r = parada.radio;
  const lado = r * 2 + 2;
  const pintura = new Pintura(lado, lado);
  const ruido = crearRuido(azar);
  const polvo = crearRuido(azar);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const d = Math.hypot(x - r, y - r) / r;
      if (d > 1) continue;
      const n = ruido((x / r) * 3, (y / r) * 3);
      const densidad = n * 1.6 - d * d * 1.3;
      // Franjas de polvo oscuro que cortan el gas, y estrellas jóvenes brillando adentro.
      const franja = polvo((x / r) * 5 + 3, (y / r) * 2 + 9);
      if (franja < 0.3 && densidad < 0.9) continue;
      if (densidad > tramado(x, y) * 0.8) {
        const nucleo = n > 0.7 && d < 0.5 ? mezclar(c0, [255, 255, 255], 0.45) : null;
        pintura.punto(x, y, nucleo ?? (n > 0.62 ? c0 : n > 0.5 ? c1 : c2));
      }
    }
  }
  const estrellas = Math.round(r * 0.6);
  for (let i = 0; i < estrellas; i++) {
    const angulo = azar() * Math.PI * 2;
    const distancia = Math.sqrt(azar()) * r * 0.8;
    pintura.punto(r + Math.cos(angulo) * distancia, r + Math.sin(angulo) * distancia, [255, 255, 255]);
  }
  return pintura.terminar();
}

function pintarGalaxia(parada: Parada, azar: () => number): Sprite {
  const [c0, c1, c2] = parada.colores.map(hexARgb);
  const r = parada.radio;
  const lado = r * 2 + 2;
  const pintura = new Pintura(lado, lado);
  const aplastado = 0.55;
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const dx = x - r;
      const dy = (y - r) / aplastado;
      const d = Math.hypot(dx, dy) / r;
      if (d > 1) continue;
      const brazo = Math.cos(Math.atan2(dy, dx) * 2 - Math.log(d + 0.05) * 4.2);
      const brillo = (1 - d) * (0.45 + brazo * 0.55) + (d < 0.16 ? 1 : 0);
      if (brillo + azar() * 0.08 > tramado(x, y) * 0.8) {
        // Núcleo casi blanco, brazos en dos tonos y cúmulos de estrellas sueltas en los brazos.
        const color = d < 0.07 ? mezclar(c0, [255, 255, 255], 0.6) : d < 0.16 ? c0 : brazo > 0.65 && azar() > 0.85 ? [255, 255, 255] as Rgb : brazo > 0.3 ? c1 : c2;
        pintura.punto(x, y, color);
      }
    }
  }
  return pintura.terminar();
}

/**
 * Con `resolucion` mayor que 1, el astro se dibuja con más píxeles: los mismos rasgos, más detalle.
 * Los planetas se generan con ruido, así que no hace falta dibujarlos de nuevo a mano.
 */
export function crearSpriteDeParada(original: Parada, resolucion = 1): Sprite {
  const parada = resolucion === 1 ? original : { ...original, radio: Math.round(original.radio * resolucion) };
  const azar = azarCon(semillaDe(parada.id));
  switch (parada.estilo) {
    case 'estrella':
      return pintarEstrella(parada);
    case 'campo':
      return pintarCampo(parada, azar);
    case 'frontera':
      return pintarFrontera(parada);
    case 'nebulosa':
      return pintarNebulosa(parada, azar);
    case 'galaxia':
      return pintarGalaxia(parada, azar);
    default: {
      const atmosfera = margenDeAtmosfera(parada);
      const margen = parada.anillos ? Math.ceil(parada.radio * 2.1) : parada.radio + atmosfera;
      const ancho = margen * 2 + 2;
      const alto = (parada.radio + atmosfera) * 2 + 2;
      const pintura = new Pintura(ancho, alto);
      const cx = ancho / 2;
      const cy = alto / 2;
      if (parada.anillos) pintarAnillos(pintura, parada, cx, cy, false);
      pintarEsfera(pintura, parada, cx, cy, azar);
      if (parada.anillos) pintarAnillos(pintura, parada, cx, cy, true);
      return pintura.terminar();
    }
  }
}

/** Píxeles de atmósfera por encima del horizonte: el dibujo empieza esa cantidad más arriba. */
export const ATMOSFERA_DEL_HORIZONTE = 10;

/**
 * La Tierra de la partida es enorme: se ve como un horizonte curvo bajo la nave. Es de noche de este
 * lado, así que hay luces de ciudades en tierra firme, y una franja de atmósfera que brilla en el borde.
 */
export function crearSpriteDeHorizonte(parada: Parada, radio: number): Sprite {
  const arriba = ATMOSFERA_DEL_HORIZONTE;
  const ancho = radio * 2 + 2;
  const alto = Math.ceil(radio * 0.8) + arriba;
  const pintura = new Pintura(ancho, alto);
  const azar = azarCon(semillaDe(parada.id));
  const ruido = crearRuido(azar);
  const gigante = { ...parada, radio };
  const [, tierraFirme] = parada.colores.map(hexARgb);
  const cielo = hexARgb('#3ad6c5');
  const borde = hexARgb('#5f8fd0');
  const luzDeCiudad: Rgb[] = [hexARgb('#ffd27a'), hexARgb('#ffb238'), hexARgb('#fff6cf')];
  for (let y = 0; y < alto; y++) {
    const dy = radio - (y - arriba);
    for (let x = 0; x < ancho; x++) {
      const dx = x - radio;
      const d = Math.hypot(dx, dy);
      if (d > radio) {
        // Atmósfera: una franja tramada que se apaga hacia el espacio.
        const afuera = d - radio;
        if (afuera < arriba && 1 - afuera / arriba > tramado(x, y) + 0.2) pintura.punto(x, y, afuera < 3 ? borde : cielo);
        continue;
      }
      const hondo = radio - d;
      if (hondo < 4) {
        pintura.punto(x, y, hondo < 2 ? mezclar(borde, [255, 255, 255], 0.3) : borde);
        continue;
      }
      // Es de noche en el lado de la Tierra desde donde se despega.
      const superficie = colorDeSuperficie(gigante, dx * 2.4, dy * 2.4, ruido, []);
      const esTierra = superficie[0] === tierraFirme[0] && superficie[1] === tierraFirme[1] && superficie[2] === tierraFirme[2];
      if (esTierra && azar() < 0.012) {
        pintura.punto(x, y, luzDeCiudad[Math.floor(azar() * luzDeCiudad.length)]);
        continue;
      }
      // Cerca del borde, la noche es más profunda: da volumen a la curva.
      const oscuridad = 0.5 - Math.max(0, 1 - hondo / (radio * 0.25)) * 0.15;
      pintura.punto(x, y, mezclar(COLOR_SOMBRA, superficie, oscuridad));
    }
  }
  return pintura.terminar();
}

/**
 * Un velo de nebulosa lejana para el fondo: manchas tramadas, de pocos colores, para dar profundidad
 * al cielo sin taparlo. Se dibuja muy transparente y se mueve más lento que las estrellas.
 */
export function crearVeloDeFondo(ancho: number, alto: number): Sprite {
  const pintura = new Pintura(ancho, alto);
  const azar = azarCon(semillaDe('velo'));
  const ruido = crearRuido(azar);
  const detalle = crearRuido(azar);
  const tonos: Rgb[] = [hexARgb('#3f2a7a'), hexARgb('#2a3f8f'), hexARgb('#5a2a6a'), hexARgb('#1f5a7a')];
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      // Se repite de arriba a abajo sin costura: la última fila empalma con la primera.
      const v = (y / alto) * Math.PI * 2;
      const n = ruido((x / ancho) * 3, Math.sin(v) * 1.2 + 4) * 0.6 + ruido((x / ancho) * 3 + 7, Math.cos(v) * 1.2 + 9) * 0.4;
      const fino = detalle((x / ancho) * 9, (y / alto) * 9);
      const densidad = (n - 0.5) * 2.6 + (fino - 0.5) * 0.5;
      if (densidad > tramado(x, y) + 0.1) pintura.punto(x, y, tonos[Math.floor(fino * tonos.length) % tonos.length]);
    }
  }
  return pintura.terminar();
}

/** El resplandor del Sol en anillos tramados, en vez de círculos lisos que rompían el pixel art. */
export function crearSpriteDeResplandor(radio: number): Sprite {
  const lado = radio * 2;
  const pintura = new Pintura(lado, lado);
  const anillos: [number, Rgb][] = [
    [1, hexARgb('#ff8a3c')],
    [0.7, hexARgb('#ffb238')],
    [0.45, hexARgb('#ffe066')],
    [0.24, hexARgb('#fff6cf')],
  ];
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const d = Math.hypot(x - radio, y - radio) / radio;
      if (d > 1) continue;
      let color = anillos[0][1];
      for (const [hasta, tono] of anillos) if (d <= hasta) color = tono;
      if ((1 - d) * 0.9 + 0.15 > tramado(x, y)) pintura.punto(x, y, color);
    }
  }
  return pintura.terminar();
}

const aRgb = (paleta: Record<string, string>) => Object.fromEntries(Object.entries(paleta).map(([letra, color]) => [letra, hexARgb(color)]));

const SATELITE = [
  'PP.PP.......PP.PP',
  'PP.PP.......PP.PP',
  'PP.PP.GMMMG.PP.PP',
  'PPPPPPMCCCMPPPPPP',
  'PP.PP.GMMMG.PP.PP',
  'PP.PP.......PP.PP',
  'PP.PP.......PP.PP',
];

const PALETA_SATELITE: Record<string, Rgb> = {
  P: hexARgb('#3f67d1'),
  M: hexARgb('#c9c6e6'),
  C: hexARgb('#3ad6c5'),
  G: hexARgb('#6d6a8c'),
};

const CHATARRAS = [
  ['.MM..', 'MMGG.', '.GGGM', '..GM.'],
  ['M..M', 'MMMM', 'G..G'],
  ['.GG', 'GMG', 'MM.'],
];

const PALETA_CHATARRA: Record<string, Rgb> = {
  M: hexARgb('#a3a0bd'),
  G: hexARgb('#65627f'),
};

const PALETA_SONDA: Record<string, Rgb> = {
  M: hexARgb('#d7d4ea'),
  G: hexARgb('#6d6a8c'),
  P: hexARgb('#3f67d1'),
  C: hexARgb('#3ad6c5'),
  O: hexARgb('#ffb238'),
  S: hexARgb('#9c97c9'),
};

const SONDAS: Record<DibujoDeSonda, string[]> = {
  estacion: [
    'PP.PP..M..PP.PP',
    'PP.PP..M..PP.PP',
    'MMMMMMMMMMMMMMM',
    'PP.PP.GGG.PP.PP',
    'PP.PP.GCG.PP.PP',
    '......GGG......',
  ],
  telescopio: [
    '....MMMMMMMM.',
    'PPP.MMMMMMMCC',
    'PPPGMMMMMMMCC',
    'PPP.MMMMMMMCC',
    '....MMMMMMMM.',
  ],
  webb: [
    '...OOOO...',
    '..OOOOOO..',
    '.OOOOOOOO.',
    '..OOOOOO..',
    '...OOOO...',
    '....GG....',
    '.SSSSSSSS.',
    'SSSSSSSSSS',
  ],
  modulo: [
    '....MMM....',
    '...MCCCM...',
    '...MMMMM...',
    '..OOOOOOO..',
    '.OOOOOOOOO.',
    '.G.......G.',
    'G.........G',
  ],
  rover: [
    '...M.......',
    '..MMM......',
    '...M...PPP.',
    '.SSSSSSSSS.',
    '.SSSSSSSSS.',
    'GG..GG..GG.',
    'GG..GG..GG.',
  ],
  plato: [
    '..MMMMMMM..',
    '.MMMMMMMMM.',
    '...GGCGG...',
    '.....G.....',
    '..OOOOOOO..',
    'M....G....M',
    '.G...G...G.',
  ],
  paneles: [
    'PPPP.....PPPP',
    'PPPPMGGGMPPPP',
    'PPPPMGCGMPPPP',
    'PPPP..G..PPPP',
  ],
};

export function crearSpriteDeSonda(dibujo: DibujoDeSonda): Sprite {
  return refinar(SONDAS[dibujo], PALETA_SONDA);
}

const OBJETOS: Record<Exclude<ObjetoDeFondo, 'chatarra'>, string[][]> = {
  roca: [
    ['..GGG.', '.GMMGG', 'GMMGGG', 'GGGGG.', '.GG...'],
    ['.GGG', 'GMGG', 'GGG.'],
    ['...GG...', '.GGMMGG.', 'GMMMGGGG', 'GGMGGGG.', '.GGGGG..'],
  ],
  hielo: [
    ['..WW.', '.WWBB', 'WWBBB', '.BBB.'],
    ['.WW', 'WWB', 'BB.'],
  ],
  cometa: [
    ['........b..B..WW.', '...b...B.BBWWWWW', '......b.BBBWWWWW', '...b....B..BWWW.'].map((f) => f.padEnd(17, '.')),
  ],
};

const PALETA_OBJETOS: Record<string, Rgb> = {
  M: hexARgb('#8d8478'),
  G: hexARgb('#544d47'),
  W: hexARgb('#eaf6ff'),
  B: hexARgb('#8fc4e8'),
  b: hexARgb('#4f7fa8'),
};

export function crearSpritesDeObjeto(tipo: ObjetoDeFondo): Sprite[] {
  if (tipo === 'chatarra') return crearSpritesDeChatarra();
  return OBJETOS[tipo].map((mapa) => refinar(mapa, PALETA_OBJETOS));
}

/** Bordes oscuros tramados, del tamaño de la pantalla. `fuerza` va de 0 a 1. */
export function crearMascaraDeVineta(ancho: number, alto: number, fuerza: number): Sprite {
  const pintura = new Pintura(ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const distancia = Math.hypot((x - ancho / 2) / (ancho / 2), (y - alto / 2) / (alto / 2)) / Math.SQRT2;
      const opacidad = ((distancia - 0.6) / 0.4) * fuerza;
      if (opacidad > tramado(x, y)) pintura.punto(x, y, COLOR_DE_OSCURIDAD);
    }
  }
  return pintura.terminar();
}

/** El robot visto de frente. Las filas de CARAS reemplazan a la pantalla, desde la fila 4 y la columna 4. */
const ROBOT = [
  '.......AA.......',
  '.......DD.......',
  '....BBBBBBBB....',
  '...BHHHHHHHHB...',
  '..DBSSSSSSSSBD..',
  '..DBSSSSSSSSBD..',
  '..DBSSSSSSSSBD..',
  '...BSSSSSSSSB...',
  '...BBBBBBBBBB...',
  '....DDDDDDDD....',
  '..DD.BBBBBB.DD..',
  '..D.BBHHHHBB.D..',
  '..D.BBBBBBBB.D..',
  '.....BBBBBB.....',
  '......F..F......',
  '.....FF..FF.....',
];

const CARAS: Record<Cara, string[]> = {
  normal: ['........', '..E..E..', '........', '...EE...'],
  feliz: ['..E..E..', '..E..E..', '.E....E.', '..EEEE..'],
  triste: ['........', '..E..E..', '...EE...', '..E..E..'],
  desmayo: ['E.E..E.E', '.E....E.', 'E.E..E.E', '...EE...'],
  asombro: ['.EE..EE.', '.EE..EE.', '...EE...', '...EE...'],
  parpadeo: ['........', '.EE..EE.', '........', '...EE...'],
};

/** Dibuja al robot con una cara y unos colores. Se lo llama poco: el resultado queda guardado. */
export function crearSpriteDeRobot(cara: Cara, colores: Record<string, string>): Sprite {
  const mapa = ROBOT.map((fila, y) => {
    const filaDeCara = CARAS[cara][y - 4];
    if (!filaDeCara) return fila;
    return [...fila].map((letra, x) => (x >= 4 && x < 12 && filaDeCara[x - 4] === 'E' ? 'E' : letra)).join('');
  });
  return refinar(mapa, aRgb(colores));
}

function spriteDeMapa(mapa: string[], paleta: Record<string, Rgb>): Sprite {
  const pintura = new Pintura(mapa[0].length, mapa.length);
  mapa.forEach((fila, y) => {
    [...fila].forEach((letra, x) => {
      const color = paleta[letra];
      if (color) pintura.punto(x, y, color);
    });
  });
  return pintura.terminar();
}

/** La nave está dibujada a mano con el doble de detalle: no pasa por el refinado automático. */
export function crearSpriteDeNave(dorada = false): Sprite {
  return spriteDeMapa(NAVE, aRgb(dorada ? PALETA_DORADA : PALETA_DE_LA_NAVE));
}

/** La nave de un amigo en un desafío: la misma silueta, en tonos de lila según el brillo de cada color. */
export function crearSpriteDeFantasma(): Sprite {
  const oscuro = hexARgb('#2b2160');
  const claro = hexARgb('#e6dcff');
  const paleta: Record<string, Rgb> = {};
  for (const [letra, hex] of Object.entries(PALETA_DE_LA_NAVE)) {
    const [r, g, b] = hexARgb(hex);
    const brillo = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
    paleta[letra] = mezclar(oscuro, claro, Math.min(1, brillo * 1.15));
  }
  return spriteDeMapa(NAVE, paleta);
}

export function crearSpriteDeSatelite(): Sprite {
  return refinar(SATELITE, PALETA_SATELITE);
}

export function crearSpritesDeChatarra(): Sprite[] {
  return CHATARRAS.map((mapa) => refinar(mapa, PALETA_CHATARRA));
}

/**
 * Duplica la resolución de un dibujo chico: redondea las diagonales y suma luz en los bordes de
 * arriba y la izquierda, y sombra en los de abajo y la derecha. El resultado mide el doble.
 */
export function refinar(mapa: string[], paleta: Record<string, Rgb>): Sprite {
  const doble = escalar2x(mapa);
  const pintura = new Pintura(doble[0].length, doble.length);
  doble.forEach((fila, y) => {
    [...fila].forEach((letra, x) => {
      const color = paleta[letra];
      if (!color) return;
      const borde = bordeDe(doble, x, y);
      const final = borde === 'luz' ? mezclar(color, [255, 255, 255], 0.22) : borde === 'sombra' ? mezclar(color, COLOR_SOMBRA, 0.38) : color;
      pintura.punto(x, y, final);
    });
  });
  return pintura.terminar();
}

const CELDAS_DE_MASCARA = 160;
const COLOR_DE_OSCURIDAD: Rgb = [2, 4, 10];

/** Oscuridad con un agujero en el centro y borde tramado, para que el foco se vea pixelado. */
export function crearMascaraDeOscuridad(): Sprite {
  const pintura = new Pintura(CELDAS_DE_MASCARA, CELDAS_DE_MASCARA);
  const centro = CELDAS_DE_MASCARA / 2;
  for (let y = 0; y < CELDAS_DE_MASCARA; y++) {
    for (let x = 0; x < CELDAS_DE_MASCARA; x++) {
      const distancia = Math.hypot(x - centro, y - centro) / centro;
      const opacidad = (distancia - 0.2) / 0.3;
      if (opacidad > tramado(x, y)) pintura.punto(x, y, COLOR_DE_OSCURIDAD);
    }
  }
  return pintura.terminar();
}
