import { HITOS, hitoReciente, partirEnLineas } from '../juego/hitos';
import type { DibujoDeSonda, Hito } from '../juego/hitos';
import { formatearDistanciaCorta, recorridoMillonesKm } from '../juego/ruta';
import { crearSpriteDeSonda } from './sprites';
import type { Sprite } from './sprites';

const ANCHO_DE_REGLA = 26;
const FUENTE = '"Jersey 15", sans-serif';
/** Las sondas ya vienen refinadas al doble de detalle. */
const ESCALA_DE_SONDA = 2;
const COLOR_DE_REGLA = '#8d95c0';
const COLOR_DE_POSICION = '#ff5d73';
const FONDO_DE_TEXTO = '#16123a';
const ALTURA_DEL_TABLERO = 150;
const ALTURA_DE_FRANJA = 146;
const ANCHO_MINIMO_PARA_TEXTOS_AL_COSTADO = 600;

const dibujos = new Map<DibujoDeSonda, Sprite>();

function spriteDe(dibujo: DibujoDeSonda): Sprite {
  let sprite = dibujos.get(dibujo);
  if (!sprite) {
    sprite = crearSpriteDeSonda(dibujo);
    dibujos.set(dibujo, sprite);
  }
  return sprite;
}

export interface Medidas {
  ancho: number;
  alto: number;
  naveY: number;
  pixelesPorPunto: number;
}

/** Dónde cae una parada en pantalla, para apoyar una sonda encima de ella. */
export type UbicarParada = (id: string) => { x: number; arriba: number } | null;

/** Las sondas se ven siempre; los textos, sólo mientras la nave viaja. */
export function dibujarHitos(c: CanvasRenderingContext2D, puntos: number, m: Medidas, opacidadDeTextos: number, ubicar: UbicarParada): void {
  const angosta = m.ancho < ANCHO_MINIMO_PARA_TEXTOS_AL_COSTADO;
  for (const hito of HITOS) {
    const y = m.naveY - (hito.puntos - puntos) * m.pixelesPorPunto;
    if (y < -160 || y > m.alto + 160) continue;
    if (hito.sonda) dibujarSonda(c, hito, y, m, ubicar);
    // Por encima de esta altura está el tablero, que tapa cualquier texto.
    if (opacidadDeTextos > 0 && !angosta && y > ALTURA_DEL_TABLERO) dibujarTexto(c, hito, y, m, opacidadDeTextos);
  }
  if (angosta && opacidadDeTextos > 0) dibujarFranja(c, puntos, m, opacidadDeTextos);
  c.globalAlpha = 1;
  c.textAlign = 'left';
}

/** En celular no hay lugar al costado de la nave: el último hito cruzado se lee debajo del tablero. */
function dibujarFranja(c: CanvasRenderingContext2D, puntos: number, m: Medidas, opacidad: number): void {
  const hito = hitoReciente(puntos);
  if (!hito) return;
  const tamanio = hito.zona ? 24 : 20;
  c.font = `${tamanio}px ${FUENTE}`;
  c.textAlign = 'center';
  const texto = hito.zona ? hito.texto.toUpperCase() : hito.texto;
  const lineas = partirEnLineas(texto, (linea) => c.measureText(linea).width <= m.ancho - ANCHO_DE_REGLA - 24);
  const interlineado = tamanio - 1;
  c.globalAlpha = opacidad;
  c.fillStyle = FONDO_DE_TEXTO;
  c.fillRect(0, ALTURA_DE_FRANJA, m.ancho - ANCHO_DE_REGLA, lineas.length * interlineado + 10);
  c.fillStyle = hito.zona ? '#3ad6c5' : '#c9c6e6';
  lineas.forEach((linea, i) => {
    c.fillText(linea, (m.ancho - ANCHO_DE_REGLA) / 2, ALTURA_DE_FRANJA + tamanio + i * interlineado - 2);
  });
}

function dibujarSonda(c: CanvasRenderingContext2D, hito: Hito, y: number, m: Medidas, ubicar: UbicarParada): void {
  const sprite = spriteDe(hito.sonda!);
  const ancho = sprite.ancho * ESCALA_DE_SONDA;
  const alto = sprite.alto * ESCALA_DE_SONDA;
  const parada = hito.sobreParada ? ubicar(hito.sobreParada) : null;
  c.globalAlpha = 1;
  if (parada) {
    c.drawImage(sprite.lienzo, Math.round(parada.x - ancho / 2), Math.round(parada.arriba - alto + 3), ancho, alto);
    return;
  }
  const flotacion = hito.lado === 'izquierda' ? m.ancho * 0.2 : m.ancho * 0.72;
  c.drawImage(sprite.lienzo, Math.round(flotacion - ancho / 2), Math.round(y - alto - 6), ancho, alto);
}

function dibujarTexto(c: CanvasRenderingContext2D, hito: Hito, y: number, m: Medidas, opacidad: number): void {
  const anchoMaximo = Math.min(m.ancho * 0.62, 340);
  const tamanio = hito.zona ? 28 : 20;
  c.font = `${tamanio}px ${FUENTE}`;
  c.globalAlpha = opacidad;
  const aIzquierda = hito.lado === 'izquierda';
  c.textAlign = aIzquierda ? 'left' : 'right';
  const x = aIzquierda ? 12 : m.ancho - ANCHO_DE_REGLA - 12;
  const texto = hito.zona ? hito.texto.toUpperCase() : hito.texto;
  const lineas = partirEnLineas(texto, (linea) => c.measureText(linea).width <= anchoMaximo);
  const interlineado = tamanio - 1;
  const anchoDeFondo = Math.ceil(Math.max(...lineas.map((linea) => c.measureText(linea).width))) + 12;
  // Con fondo propio, el texto se lee aunque pase por delante de un planeta.
  c.fillStyle = FONDO_DE_TEXTO;
  c.fillRect(aIzquierda ? x - 6 : x - anchoDeFondo + 6, Math.round(y - tamanio + 2), anchoDeFondo, lineas.length * interlineado + 4);
  c.fillStyle = hito.zona ? '#3ad6c5' : '#c9c6e6';
  lineas.forEach((linea, i) => c.fillText(linea, x, Math.round(y + i * interlineado)));
}

/** Regla de distancia al borde derecho. `posicion` son los puntos en los que estaba el jugador. */
export function dibujarRegla(c: CanvasRenderingContext2D, puntos: number, posicion: number, m: Medidas): void {
  const borde = m.ancho - 6;
  c.fillStyle = COLOR_DE_REGLA;
  c.globalAlpha = 0.7;
  const tierraY = m.naveY + puntos * m.pixelesPorPunto;
  const inicio = Math.max(0, Math.round(Math.min(m.alto, tierraY)));
  c.fillRect(borde, 0, 2, inicio);

  c.font = `16px ${FUENTE}`;
  c.textAlign = 'right';
  const desde = Math.max(0, Math.ceil((puntos - (m.alto - m.naveY) / m.pixelesPorPunto) / 10) * 10);
  const hasta = puntos + m.naveY / m.pixelesPorPunto;
  const yDePosicion = Math.round(m.naveY - (posicion - puntos) * m.pixelesPorPunto);
  for (let p = desde; p <= hasta; p += 10) {
    const y = Math.round(m.naveY - (p - puntos) * m.pixelesPorPunto);
    const esGrande = p % 50 === 0;
    c.fillRect(borde - (esGrande ? 14 : 6), y, esGrande ? 14 : 6, 2);
    // La distancia cede su lugar al marcador "VOS" si les toca la misma altura.
    if (esGrande && m.ancho >= 600 && Math.abs(y - yDePosicion) >= 16) {
      c.fillText(formatearDistanciaCorta(recorridoMillonesKm(p)), borde - 18, y + 5);
    }
  }

  const y = yDePosicion;
  if (y > -12 && y < m.alto + 12) {
    c.globalAlpha = 1;
    c.fillStyle = COLOR_DE_POSICION;
    // Triangulito que apunta a la regla, hecho de columnas de píxeles.
    for (let i = 0; i < 4; i++) c.fillRect(borde - 2 - (i + 1) * 2, y - i * 2, 2, i * 4 + 2);
    c.fillText('VOS', borde - 14, y + 6);
  }
  c.globalAlpha = 1;
  c.textAlign = 'left';
}

export { ANCHO_DE_REGLA };
