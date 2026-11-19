import { crearSpriteDeSonda } from './sprites';
import type { Sprite } from './sprites';

export interface GeometriaDeLaTierra {
  centroX: number;
  centroY: number;
  radio: number;
  /** Altura de la línea del horizonte en pantalla. */
  arriba: number;
}

interface Fugaz {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
}

interface Nube {
  /** Posición horizontal sobre la Tierra, de 0 a 1: se desplaza como si el planeta girara. */
  lon: number;
  /** Profundidad bajo el horizonte, en píxeles de pantalla. */
  bajo: number;
  bloques: [number, number][];
}

interface Destello {
  x: number;
  y: number;
  inicio: number;
}

const PIXEL = 2;
const MS_ENTRE_FUGACES = [2600, 6000];
const MS_ENTRE_DESTELLOS = [500, 1400];
const VUELTA_DE_LA_ESTACION_MS = 26000;

const azar = (desde: number, hasta: number) => desde + Math.random() * (hasta - desde);

/** Una nube hecha de bloques: un óvalo irregular, más ancho que alto. */
function crearNube(): Nube {
  const ancho = Math.round(azar(5, 11));
  const alto = Math.round(azar(2, 3));
  const bloques: [number, number][] = [];
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const dx = (x - ancho / 2) / (ancho / 2);
      const dy = (y - alto / 2) / (alto / 2);
      if (dx * dx + dy * dy < 1.1 + Math.random() * 0.3) bloques.push([x, y]);
    }
  }
  return { lon: Math.random(), bajo: azar(14, 120), bloques };
}

/**
 * Lo que se mueve en el fondo de los menús: estrellas fugaces, la estación espacial pasando,
 * nubes que giran con la Tierra y destellos de estrellas. Con movimiento reducido no hace nada.
 */
export class AmbienteDelMenu {
  private readonly reducido: boolean;
  private readonly estacion: Sprite = crearSpriteDeSonda('estacion');
  private readonly nubes: Nube[] = Array.from({ length: 9 }, crearNube);
  private fugaces: Fugaz[] = [];
  private destellos: Destello[] = [];
  private proximaFugaz = 1200;
  private proximoDestello = 300;
  private inicioDeLaEstacion = -VUELTA_DE_LA_ESTACION_MS * 0.35;

  constructor(reducido: boolean) {
    this.reducido = reducido;
  }

  actualizar(ahora: number, dt: number, ancho: number, alto: number, tierra: GeometriaDeLaTierra | null): void {
    if (this.reducido) return;
    const cielo = tierra ? Math.min(alto, tierra.arriba) : alto;
    if (ahora >= this.proximaFugaz) {
      this.proximaFugaz = ahora + azar(MS_ENTRE_FUGACES[0], MS_ENTRE_FUGACES[1]);
      const haciaLaDerecha = Math.random() > 0.5;
      const velocidad = azar(420, 620);
      this.fugaces.push({
        x: azar(ancho * 0.1, ancho * 0.9),
        y: azar(0, cielo * 0.45),
        vx: (haciaLaDerecha ? 1 : -1) * velocidad,
        vy: velocidad * 0.45,
        vida: azar(0.5, 0.8),
      });
    }
    for (const f of this.fugaces) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vida -= dt;
    }
    this.fugaces = this.fugaces.filter((f) => f.vida > 0 && f.y < cielo);

    if (ahora >= this.proximoDestello) {
      this.proximoDestello = ahora + azar(MS_ENTRE_DESTELLOS[0], MS_ENTRE_DESTELLOS[1]);
      this.destellos.push({ x: Math.round(azar(0, ancho) / PIXEL) * PIXEL, y: Math.round(azar(0, cielo * 0.8) / PIXEL) * PIXEL, inicio: ahora });
    }
    this.destellos = this.destellos.filter((d) => ahora - d.inicio < 900);

    for (const nube of this.nubes) nube.lon = (nube.lon + dt * 0.008) % 1;
  }

  /** Lo que va en el cielo, por detrás de la Tierra. */
  dibujarCielo(c: CanvasRenderingContext2D, ahora: number, ancho: number, tierra: GeometriaDeLaTierra | null): void {
    if (this.reducido) return;
    for (const d of this.destellos) this.dibujarDestello(c, d, ahora);
    for (const f of this.fugaces) this.dibujarFugaz(c, f);
    if (tierra) this.dibujarEstacion(c, ahora, ancho, tierra);
  }

  /** Lo que va sobre la Tierra: las nubes. */
  dibujarSobreLaTierra(c: CanvasRenderingContext2D, tierra: GeometriaDeLaTierra | null): void {
    if (this.reducido || !tierra) return;
    const bloque = PIXEL * 2;
    c.fillStyle = '#c9d6f0';
    for (const nube of this.nubes) {
      const baseX = tierra.centroX - tierra.radio + nube.lon * tierra.radio * 2;
      const baseY = tierra.arriba + nube.bajo;
      for (const [bx, by] of nube.bloques) {
        const x = Math.round((baseX + bx * bloque) / PIXEL) * PIXEL;
        const y = Math.round((baseY + by * bloque) / PIXEL) * PIXEL;
        const distancia = Math.hypot(x - tierra.centroX, y - tierra.centroY);
        if (distancia > tierra.radio - bloque * 3) continue;
        // Las nubes se apagan hacia el borde del planeta, donde la atmósfera se ve de canto.
        c.globalAlpha = distancia > tierra.radio * 0.93 ? 0.18 : 0.32;
        c.fillRect(x, y, bloque, bloque);
      }
    }
    c.globalAlpha = 1;
  }

  private dibujarFugaz(c: CanvasRenderingContext2D, f: Fugaz): void {
    const largo = 10;
    const paso = Math.hypot(f.vx, f.vy);
    for (let i = 0; i < largo; i++) {
      const atras = i * PIXEL * 1.6;
      const x = Math.round((f.x - (f.vx / paso) * atras) / PIXEL) * PIXEL;
      const y = Math.round((f.y - (f.vy / paso) * atras) / PIXEL) * PIXEL;
      c.globalAlpha = Math.max(0, (1 - i / largo) * Math.min(1, f.vida * 3));
      c.fillStyle = i < 2 ? '#ffffff' : i < 5 ? '#fff6cf' : '#8fc4e8';
      c.fillRect(x, y, PIXEL, PIXEL);
    }
    c.globalAlpha = 1;
  }

  /** Destello de cuatro puntas que crece y se apaga a saltos. */
  private dibujarDestello(c: CanvasRenderingContext2D, d: Destello, ahora: number): void {
    const t = (ahora - d.inicio) / 900;
    const brazo = [1, 2, 3, 2, 1][Math.min(4, Math.floor(t * 5))];
    c.fillStyle = '#eaf6ff';
    c.fillRect(d.x, d.y, PIXEL, PIXEL);
    c.globalAlpha = 0.7;
    for (let i = 1; i <= brazo; i++) {
      c.fillRect(d.x - i * PIXEL, d.y, PIXEL, PIXEL);
      c.fillRect(d.x + i * PIXEL, d.y, PIXEL, PIXEL);
      c.fillRect(d.x, d.y - i * PIXEL, PIXEL, PIXEL);
      c.fillRect(d.x, d.y + i * PIXEL, PIXEL, PIXEL);
    }
    c.globalAlpha = 1;
  }

  /** La estación espacial cruza en arco sobre el horizonte, con su luz que parpadea. */
  private dibujarEstacion(c: CanvasRenderingContext2D, ahora: number, ancho: number, tierra: GeometriaDeLaTierra): void {
    const t = (((ahora - this.inicioDeLaEstacion) % VUELTA_DE_LA_ESTACION_MS) + VUELTA_DE_LA_ESTACION_MS) % VUELTA_DE_LA_ESTACION_MS / VUELTA_DE_LA_ESTACION_MS;
    // Pasa durante la primera mitad de la vuelta; la otra mitad está "del otro lado" del planeta.
    if (t > 0.5) return;
    const avance = t / 0.5;
    const x = Math.round((-60 + avance * (ancho + 120)) / PIXEL) * PIXEL;
    const altura = Math.sin(avance * Math.PI) * 60;
    const y = Math.round((tierra.arriba - 70 - altura) / PIXEL) * PIXEL;
    const e = this.estacion;
    c.drawImage(e.lienzo, x - e.ancho / 2, y - e.alto / 2, e.ancho, e.alto);
    if (Math.floor(ahora / 500) % 2 === 0) {
      c.fillStyle = '#ff5d73';
      c.fillRect(x, y - e.alto / 2 - PIXEL, PIXEL, PIXEL);
    }
  }
}
