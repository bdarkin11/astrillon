/** Lado del radar en píxeles del dibujo. En pantalla se ve al doble, con los píxeles a la vista. */
export const LADO_DEL_RADAR = 40;

const RADIO_DEL_TIEMPO = 18;
const RADIO_INTERIOR = 11;
const ESTELA_DEL_BARRIDO = 0.9;
const COLOR_FONDO = '#111c44';
const COLOR_APAGADO = '#2c3a78';
const COLOR_NORMAL = '#3ad6c5';
const COLOR_URGENTE = '#ff8a9e';

/** Cuántos segundos antes del final se encienden los bordes rojos. */
export const SEGUNDOS_DE_PELIGRO = 3;

export function enPeligro(restanteMs: number): boolean {
  return restanteMs > 0 && restanteMs <= SEGUNDOS_DE_PELIGRO * 1000;
}

/** El ángulo del barrido: da una vuelta cada 2,4 segundos, y al doble de velocidad si queda poco tiempo. */
export function anguloDelBarrido(ahoraMs: number, urgente: boolean): number {
  const vuelta = urgente ? 1200 : 2400;
  return ((ahoraMs % vuelta) / vuelta) * Math.PI * 2;
}

/** Cuántos pasos del aro de tiempo siguen encendidos. Va de `pasos` a 0 a medida que se acaba. */
export function pasosEncendidos(fraccionRestante: number, pasos: number): number {
  return Math.ceil(Math.max(0, Math.min(1, fraccionRestante)) * pasos);
}

const PASOS_DEL_ARO = 48;

/** Dibuja el radar. Con `barrido` en null, para movimiento reducido, muestra sólo el aro de tiempo. */
export function dibujarRadar(c: CanvasRenderingContext2D, fraccionRestante: number, urgente: boolean, barrido: number | null): void {
  const centro = LADO_DEL_RADAR / 2;
  const color = urgente ? COLOR_URGENTE : COLOR_NORMAL;
  c.clearRect(0, 0, LADO_DEL_RADAR, LADO_DEL_RADAR);

  // Fondo redondo, recorrido por renglones para que el borde quede escalonado.
  c.fillStyle = COLOR_FONDO;
  for (let y = 0; y < LADO_DEL_RADAR; y++) {
    const dy = y + 0.5 - centro;
    const medio = Math.sqrt(Math.max(0, (centro - 1) ** 2 - dy * dy));
    if (medio > 0) c.fillRect(Math.round(centro - medio), y, Math.round(medio * 2), 1);
  }

  // Aro interior y marcas en cruz, como la grilla de un radar de verdad.
  c.fillStyle = COLOR_APAGADO;
  for (let i = 0; i < 24; i++) {
    const angulo = (i / 24) * Math.PI * 2;
    c.fillRect(Math.round(centro + Math.cos(angulo) * 6), Math.round(centro + Math.sin(angulo) * 6), 1, 1);
  }
  for (const r of [3, 8, 13]) {
    c.fillRect(centro + r, centro, 1, 1);
    c.fillRect(centro - r - 1, centro, 1, 1);
    c.fillRect(centro, centro + r, 1, 1);
    c.fillRect(centro, centro - r - 1, 1, 1);
  }

  if (barrido !== null) {
    for (let i = 0; i < 14; i++) {
      const angulo = barrido - (i / 14) * ESTELA_DEL_BARRIDO;
      c.fillStyle = color;
      c.globalAlpha = i === 0 ? 0.9 : 0.35 * (1 - i / 14);
      for (let r = RADIO_INTERIOR; r < RADIO_DEL_TIEMPO - 1; r++) {
        c.fillRect(Math.round(centro + Math.cos(angulo) * r), Math.round(centro + Math.sin(angulo) * r), 1, 1);
      }
    }
    c.globalAlpha = 1;
  }

  // El aro de tiempo se apaga en sentido horario, empezando desde arriba.
  const encendidos = pasosEncendidos(fraccionRestante, PASOS_DEL_ARO);
  for (let i = 0; i < PASOS_DEL_ARO; i++) {
    const angulo = -Math.PI / 2 + (i / PASOS_DEL_ARO) * Math.PI * 2;
    c.fillStyle = i < encendidos ? color : COLOR_APAGADO;
    c.fillRect(Math.round(centro + Math.cos(angulo) * RADIO_DEL_TIEMPO) - 1, Math.round(centro + Math.sin(angulo) * RADIO_DEL_TIEMPO) - 1, 2, 2);
  }
}
