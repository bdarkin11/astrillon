import { nivelDeVineta, zonaDeFondo } from '../juego/hitos';
import type { ObjetoDeFondo } from '../juego/hitos';
import { crearMascaraDeVineta, crearSpritesDeObjeto } from './sprites';
import type { Sprite } from './sprites';

const CELDA_DE_VINETA = 6;
const FUERZAS_DE_VINETA = [0, 0.35, 0.6, 0.85];
const INICIO_DEL_CINTURON = 112;
const FIN_DEL_CINTURON = 165;
const ROCAS_DEL_CINTURON = 48;

interface Viajero {
  x: number;
  y: number;
  velocidad: number;
  sprite: Sprite;
  escala: number;
  parallax: number;
}

const azar = (desde: number, hasta: number) => desde + Math.random() * (hasta - desde);

/** Lo que flota de fondo: objetos que cruzan según la zona, y el cinturón de asteroides. */
export class Fondo {
  private readonly reducido: boolean;
  private readonly sprites = new Map<ObjetoDeFondo, Sprite[]>();
  private readonly cinturon: { puntos: number; x: number; sprite: Sprite; escala: number }[];
  private viajeros: Viajero[] = [];
  private mascaraDeVineta: { clave: string; sprite: Sprite | null } = { clave: '', sprite: null };

  constructor(reducido: boolean) {
    this.reducido = reducido;
    const rocas = this.spritesDe('roca');
    this.cinturon = Array.from({ length: ROCAS_DEL_CINTURON }, () => ({
      puntos: azar(INICIO_DEL_CINTURON, FIN_DEL_CINTURON),
      x: Math.random(),
      sprite: rocas[Math.floor(Math.random() * rocas.length)],
      // Los dibujos ya vienen refinados al doble: con escala 1 y 2 miden lo mismo de siempre.
      escala: Math.random() > 0.75 ? 2 : 1,
    }));
  }

  reiniciar(): void {
    this.viajeros = [];
  }

  private spritesDe(tipo: ObjetoDeFondo): Sprite[] {
    let lista = this.sprites.get(tipo);
    if (!lista) {
      lista = crearSpritesDeObjeto(tipo);
      this.sprites.set(tipo, lista);
    }
    return lista;
  }

  private nuevoViajero(tipos: ObjetoDeFondo[], ancho: number, alto: number, enPantalla: boolean): Viajero {
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
    const lista = this.spritesDe(tipo);
    const sprite = lista[Math.floor(Math.random() * lista.length)];
    const haciaLaDerecha = Math.random() > 0.5;
    const rapido = tipo === 'cometa' ? 3 : 1;
    return {
      x: enPantalla ? Math.random() * ancho : haciaLaDerecha ? -60 : ancho + 60,
      y: Math.random() * alto,
      velocidad: azar(10, 26) * rapido * (haciaLaDerecha ? 1 : -1),
      sprite,
      escala: Math.random() > 0.6 ? 2 : 1,
      parallax: azar(0.35, 0.7),
    };
  }

  actualizar(dt: number, puntos: number, arrastre: number, ancho: number, alto: number): void {
    const { cantidad, tipos } = zonaDeFondo(puntos);
    if (this.viajeros.length === 0 && cantidad > 0) {
      this.viajeros = Array.from({ length: cantidad }, () => this.nuevoViajero(tipos, ancho, alto, true));
    }
    const paso = this.reducido ? 0 : dt;
    this.viajeros = this.viajeros.flatMap((v) => {
      v.x += v.velocidad * paso;
      v.y += arrastre * v.parallax * dt;
      if (v.y > alto + 60) v.y -= alto + 120;
      if (v.x > -80 && v.x < ancho + 80) return [v];
      // Al salir de pantalla se reemplaza por algo propio de la zona actual, o desaparece.
      return tipos.length > 0 && this.viajeros.length <= cantidad ? [this.nuevoViajero(tipos, ancho, alto, false)] : [];
    });
    while (this.viajeros.length < cantidad) this.viajeros.push(this.nuevoViajero(tipos, ancho, alto, false));
  }

  dibujar(c: CanvasRenderingContext2D, puntos: number, naveY: number, pixelesPorPunto: number, ancho: number, alto: number): void {
    for (const v of this.viajeros) {
      const anchoSprite = v.sprite.ancho * v.escala;
      c.save();
      c.translate(Math.round(v.x), Math.round(v.y));
      // Los cometas tienen la cola dibujada a la izquierda: se dan vuelta según hacia dónde van.
      if (v.velocidad < 0) c.scale(-1, 1);
      c.drawImage(v.sprite.lienzo, -anchoSprite / 2, 0, anchoSprite, v.sprite.alto * v.escala);
      c.restore();
    }
    if (puntos < INICIO_DEL_CINTURON - 80 || puntos > FIN_DEL_CINTURON + 80) return;
    for (const roca of this.cinturon) {
      const y = naveY - (roca.puntos - puntos) * pixelesPorPunto;
      if (y < -30 || y > alto + 30) continue;
      c.drawImage(roca.sprite.lienzo, Math.round(roca.x * ancho), Math.round(y), roca.sprite.ancho * roca.escala, roca.sprite.alto * roca.escala);
    }
  }

  /** Oscurece los bordes según lo lejos que se esté del Sol. */
  dibujarVineta(c: CanvasRenderingContext2D, puntos: number, ancho: number, alto: number): void {
    const nivel = nivelDeVineta(puntos);
    if (nivel === 0) return;
    const celdasX = Math.ceil(ancho / CELDA_DE_VINETA);
    const celdasY = Math.ceil(alto / CELDA_DE_VINETA);
    const clave = `${celdasX}x${celdasY}:${nivel}`;
    if (this.mascaraDeVineta.clave !== clave) {
      this.mascaraDeVineta = { clave, sprite: crearMascaraDeVineta(celdasX, celdasY, FUERZAS_DE_VINETA[nivel]) };
    }
    const sprite = this.mascaraDeVineta.sprite;
    if (sprite) c.drawImage(sprite.lienzo, 0, 0, celdasX * CELDA_DE_VINETA, celdasY * CELDA_DE_VINETA);
  }
}
