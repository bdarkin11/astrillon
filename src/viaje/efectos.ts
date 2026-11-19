import type { Coreografia } from './coreografia';
import { crearMascaraDeOscuridad, crearSpriteDeSatelite, crearSpritesDeChatarra } from './sprites';
import type { Sprite } from './sprites';

const MAXIMO_DE_PARTICULAS = 320;
const TAMANIO_DE_CELDA = 6;
const COLOR_DE_OSCURIDAD = '#02040a';
const MS_DE_ESTATICA = 380;
const MS_DE_DESVANECER_OSCURIDAD = 1500;
const CHISPAS_EN_ORBITA = 22;

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  total: number;
  color: string;
  tamanio: number;
}

interface NaveCruzando {
  inicio: number;
  duracion: number;
  haciaLaDerecha: boolean;
  y: number;
}

const azar = (desde: number, hasta: number) => desde + Math.random() * (hasta - desde);

/** Los efectos de cada viaje. Todo se dibuja en bloques enteros, para no perder el aspecto de 8 bits. */
export class Efectos {
  private readonly reducido: boolean;
  private readonly satelite: Sprite = crearSpriteDeSatelite();
  private readonly chatarras: Sprite[] = crearSpritesDeChatarra();
  private readonly mascara: Sprite = crearMascaraDeOscuridad();
  private particulas: Particula[] = [];
  private destellos: { inicio: number; color: string }[] = [];
  private naves: NaveCruzando[] = [];
  private activa: Coreografia | null = null;
  private ultimaEstela = 0;
  private sacudida = { hasta: 0, fuerza: 0, duracion: 1 };
  private estaticaHasta = 0;
  private oscuridadActiva = false;
  private oscuridadApagandoDesde = 0;

  constructor(reducido: boolean) {
    this.reducido = reducido;
  }

  reiniciar(): void {
    this.particulas = [];
    this.destellos = [];
    this.naves = [];
    this.activa = null;
    this.sacudida = { hasta: 0, fuerza: 0, duracion: 1 };
    this.estaticaHasta = 0;
    this.oscuridadActiva = false;
    this.oscuridadApagandoDesde = 0;
  }

  iniciar(coreografia: Coreografia, ahora: number, ancho: number, alto: number): void {
    this.activa = coreografia;
    this.ultimaEstela = ahora;
    if (this.reducido) return;
    if (coreografia.destellos) {
      const { veces, cadaMs, color } = coreografia.destellos;
      for (let i = 0; i < veces; i++) this.destellos.push({ inicio: ahora + i * cadaMs, color });
    }
    if (coreografia.sacudidaAlSalir) this.sacudir(coreografia.sacudidaAlSalir, 420, ahora);
    const cantidad = ancho < 700 ? Math.ceil(coreografia.navesCruzando * 0.7) : coreografia.navesCruzando;
    for (let i = 0; i < cantidad; i++) {
      this.naves.push({
        inicio: ahora + 200 + i * 110,
        duracion: azar(1100, 1700),
        haciaLaDerecha: i % 2 === 0,
        y: azar(alto * 0.2, alto * 0.65),
      });
    }
    this.oscuridadActiva = coreografia.oscuridad;
    this.oscuridadApagandoDesde = 0;
  }

  /** Termina el viaje en (x, y). */
  llegar(x: number, y: number, ahora: number): void {
    const coreografia = this.activa;
    this.activa = null;
    if (!coreografia || this.reducido) return;
    this.estallar(x, y, coreografia.color, coreografia.estallido, coreografia.dorar ? 1.5 : 1);
    if (coreografia.sacudidaAlLlegar) this.sacudir(coreografia.sacudidaAlLlegar, 500, ahora);
    if (coreografia.dorar) this.destellos.push({ inicio: ahora, color: coreografia.color });
    if (coreografia.oscuridad) this.oscuridadApagandoDesde = ahora;
  }

  perderSenal(ahora: number): void {
    if (this.reducido) return;
    this.estaticaHasta = ahora + MS_DE_ESTATICA;
    this.sacudir(10, 480, ahora);
    this.destellos.push({ inicio: ahora, color: '#6d7a9c' });
  }

  sacudir(fuerza: number, duracion: number, ahora: number): void {
    if (this.reducido) return;
    this.sacudida = { hasta: ahora + duracion, fuerza, duracion };
  }

  estallar(x: number, y: number, color: string, cantidad: number, fuerza = 1): void {
    if (this.reducido) return;
    for (let i = 0; i < cantidad; i++) {
      const angulo = Math.random() * Math.PI * 2;
      const velocidad = azar(40, 240) * fuerza;
      this.agregar({
        x,
        y,
        vx: Math.cos(angulo) * velocidad,
        vy: Math.sin(angulo) * velocidad,
        vida: azar(0.5, 1.2),
        total: 1.2,
        color,
        tamanio: Math.random() > 0.7 ? 6 : 4,
      });
    }
  }

  private agregar(particula: Particula): void {
    if (this.particulas.length < MAXIMO_DE_PARTICULAS) this.particulas.push(particula);
  }

  /** Desplazamiento de toda la imagen por las sacudidas, a saltos como en una consola vieja. */
  desplazamiento(ahora: number): { x: number; y: number } {
    const { hasta, fuerza, duracion } = this.sacudida;
    if (ahora >= hasta) return { x: 0, y: 0 };
    const resto = (hasta - ahora) / duracion;
    const paso = Math.floor(ahora / 45);
    const signo = paso % 2 === 0 ? 1 : -1;
    return {
      x: Math.round(signo * fuerza * resto),
      y: Math.round((paso % 3 === 0 ? 1 : -1) * fuerza * 0.5 * resto),
    };
  }

  /** Avanza las partículas. `arrastre` es la velocidad a la que pasa el fondo, en píxeles por segundo. */
  actualizar(ahora: number, dt: number, naveX: number, naveY: number, arrastre: number): void {
    const coreografia = this.activa;
    if (coreografia && !this.reducido) {
      const { colores, cadaMs } = coreografia.estela;
      let cuantas = 0;
      while (ahora - this.ultimaEstela >= cadaMs && cuantas < 6) {
        this.ultimaEstela += cadaMs;
        cuantas += 1;
        this.agregar({
          x: naveX + azar(-14, 14),
          y: naveY + 32,
          vx: azar(-24, 24),
          vy: azar(30, 110),
          vida: azar(0.5, 1.1),
          total: 1.1,
          color: colores[Math.floor(Math.random() * colores.length)],
          tamanio: Math.random() > 0.6 ? 4 : 2,
        });
      }
      if (coreografia.gas && Math.random() < 0.3) {
        const lado = Math.random() > 0.5 ? 1 : -1;
        this.agregar({
          x: naveX + lado * azar(50, 170),
          y: naveY + azar(-140, 140),
          vx: azar(-10, 10),
          vy: azar(-10, 10),
          vida: 1.4,
          total: 1.4,
          color: colores[Math.floor(Math.random() * colores.length)],
          tamanio: 8,
        });
      }
    }
    for (const p of this.particulas) {
      p.x += p.vx * dt;
      p.y += (p.vy + arrastre) * dt;
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
      p.vida -= dt;
    }
    this.particulas = this.particulas.filter((p) => p.vida > 0);
  }

  /** Lo que va por detrás de la nave: partículas y naves que cruzan. */
  dibujarAtras(c: CanvasRenderingContext2D, nave: Sprite, ancho: number, ahora: number): void {
    for (const p of this.particulas) {
      // La opacidad baja a escalones, sin degradado suave.
      c.globalAlpha = Math.ceil((p.vida / p.total) * 3) / 3;
      c.fillStyle = p.color;
      c.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, p.tamanio, p.tamanio);
    }
    c.globalAlpha = 1;

    this.naves = this.naves.filter((n) => ahora < n.inicio + n.duracion);
    // La nave nueva tiene el doble de píxeles: a escala 1 queda del mismo tamaño que antes.
    const anchoNave = nave.ancho;
    for (const n of this.naves) {
      if (ahora < n.inicio) continue;
      const t = (ahora - n.inicio) / n.duracion;
      const recorrido = ancho + 120;
      const x = n.haciaLaDerecha ? -60 + t * recorrido : ancho + 60 - t * recorrido;
      const y = Math.round(n.y + Math.sin(t * 7) * 10);
      c.save();
      c.translate(Math.round(x), y);
      c.rotate(n.haciaLaDerecha ? Math.PI / 2 : -Math.PI / 2);
      c.drawImage(nave.lienzo, -anchoNave / 2, -nave.alto / 2, anchoNave, nave.alto);
      c.restore();
    }
  }

  /** Lo que orbita a la nave durante el viaje. */
  dibujarEscolta(c: CanvasRenderingContext2D, naveX: number, naveY: number, ahora: number): void {
    const coreografia = this.activa;
    if (!coreografia || this.reducido) return;
    for (let i = 0; i < coreografia.satelites; i++) {
      const angulo = ahora / 700 + (i * Math.PI * 2) / coreografia.satelites;
      const x = naveX + Math.cos(angulo) * 92;
      const y = naveY + Math.sin(angulo) * 46;
      c.drawImage(this.satelite.lienzo, Math.round(x - this.satelite.ancho / 2), Math.round(y - this.satelite.alto / 2), this.satelite.ancho, this.satelite.alto);
    }
    if (coreografia.dorar) {
      for (let i = 0; i < CHISPAS_EN_ORBITA; i++) {
        const sentido = i % 2 === 0 ? 1 : -1;
        const angulo = (sentido * ahora) / (420 + (i % 5) * 110) + i * 1.7;
        const radio = 48 + (i % 6) * 15;
        // Titilan a saltos, y cada tanto una queda apagada.
        if (Math.floor(ahora / 110 + i) % 5 === 0) continue;
        c.fillStyle = i % 3 === 0 ? '#fff6cf' : coreografia.color;
        c.fillRect(Math.round(naveX + Math.cos(angulo) * radio * 1.2), Math.round(naveY + Math.sin(angulo) * radio * 0.75), i % 4 === 0 ? 6 : 4, i % 4 === 0 ? 6 : 4);
      }
    }
    for (let i = 0; i < coreografia.chatarra; i++) {
      const pieza = this.chatarras[i % this.chatarras.length];
      const angulo = ahora / 1900 + i * 1.3;
      const radio = 62 + (i % 3) * 26;
      const x = naveX + Math.cos(angulo) * radio;
      const y = naveY + Math.sin(angulo) * radio * 0.55;
      c.drawImage(pieza.lienzo, Math.round(x), Math.round(y), pieza.ancho * 2, pieza.alto * 2);
    }
  }

  /** Lo que va por encima de todo: el foco, la estática y los destellos. */
  dibujarEncima(c: CanvasRenderingContext2D, ancho: number, alto: number, naveX: number, naveY: number, ahora: number): void {
    this.dibujarOscuridad(c, ancho, alto, naveX, naveY, ahora);
    this.dibujarEstatica(c, ancho, alto, ahora);

    this.destellos = this.destellos.filter((d) => ahora < d.inicio + 240);
    for (const d of this.destellos) {
      if (ahora < d.inicio) continue;
      // Baja en tres escalones, como un parpadeo de pantalla vieja.
      const escalon = Math.floor((ahora - d.inicio) / 80);
      c.globalAlpha = [0.32, 0.18, 0.08][escalon] ?? 0;
      c.fillStyle = d.color;
      c.fillRect(0, 0, ancho, alto);
    }
    c.globalAlpha = 1;
  }

  private dibujarOscuridad(c: CanvasRenderingContext2D, ancho: number, alto: number, x: number, y: number, ahora: number): void {
    if (!this.oscuridadActiva) return;
    let opacidad = 1;
    let escala = 1;
    if (this.oscuridadApagandoDesde) {
      const t = (ahora - this.oscuridadApagandoDesde) / MS_DE_DESVANECER_OSCURIDAD;
      if (t >= 1) {
        this.oscuridadActiva = false;
        return;
      }
      opacidad = Math.ceil((1 - t) * 4) / 4;
      escala = 1 + t * 2.5;
    }
    const celda = TAMANIO_DE_CELDA * escala;
    const lado = this.mascara.ancho * celda;
    const izquierda = Math.round(x - lado / 2);
    const arriba = Math.round(y - lado / 2);
    c.globalAlpha = opacidad;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.mascara.lienzo, izquierda, arriba, lado, lado);
    c.fillStyle = COLOR_DE_OSCURIDAD;
    c.fillRect(0, 0, ancho, Math.max(0, arriba));
    c.fillRect(0, arriba + lado, ancho, Math.max(0, alto - arriba - lado));
    c.fillRect(0, arriba, Math.max(0, izquierda), lado);
    c.fillRect(izquierda + lado, arriba, Math.max(0, ancho - izquierda - lado), lado);
    c.globalAlpha = 1;
  }

  private dibujarEstatica(c: CanvasRenderingContext2D, ancho: number, alto: number, ahora: number): void {
    if (ahora >= this.estaticaHasta) return;
    c.globalAlpha = 0.55;
    for (let i = 0; i < 90; i++) {
      c.fillStyle = Math.random() > 0.5 ? '#c9c6e6' : '#2a2f52';
      c.fillRect(Math.floor(Math.random() * ancho / 8) * 8, Math.floor(Math.random() * alto / 4) * 4, 8 + Math.floor(Math.random() * 5) * 8, 4);
    }
    c.globalAlpha = 1;
  }
}
