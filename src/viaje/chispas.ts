const COLORES = ['#ffe066', '#ffb238', '#ff8a3c', '#3ad6c5'];
const MAXIMO = 120;

interface Chispa {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  total: number;
  color: string;
  tamanio: number;
}

const azar = (desde: number, hasta: number) => desde + Math.random() * (hasta - desde);

/**
 * Chispas por encima de los paneles, en su propio lienzo: el del viaje queda tapado por ellos.
 * Sólo dibuja mientras hay chispas vivas, así no gasta batería al estar quieto.
 */
export class Chispas {
  private readonly lienzo: HTMLCanvasElement;
  private readonly contexto: CanvasRenderingContext2D;
  private readonly reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private chispas: Chispa[] = [];
  private animando = false;
  private ultimo = 0;

  constructor() {
    this.lienzo = document.createElement('canvas');
    this.lienzo.className = 'lienzo-chispas';
    this.lienzo.setAttribute('aria-hidden', 'true');
    document.body.append(this.lienzo);
    this.contexto = this.lienzo.getContext('2d')!;
    window.addEventListener('resize', () => this.ajustar());
    this.ajustar();
  }

  private ajustar(): void {
    this.lienzo.width = window.innerWidth;
    this.lienzo.height = window.innerHeight;
  }

  /** Unas pocas chispas desde donde se acaba de escribir. */
  tipear(x: number, y: number): void {
    this.soltar(x, x, y, 3, 1);
  }

  /** Una descarga a lo largo del campo, al enviar la respuesta. */
  enviar(izquierda: number, derecha: number, y: number): void {
    this.soltar(izquierda, derecha, y, 22, 1.5);
  }

  private soltar(desdeX: number, hastaX: number, y: number, cantidad: number, fuerza: number): void {
    if (this.reducido) return;
    for (let i = 0; i < cantidad && this.chispas.length < MAXIMO; i++) {
      const vida = azar(0.3, 0.7);
      this.chispas.push({
        x: azar(desdeX, hastaX),
        y,
        vx: azar(-50, 50) * fuerza,
        vy: azar(-170, -60) * fuerza,
        vida,
        total: vida,
        color: COLORES[Math.floor(Math.random() * COLORES.length)],
        tamanio: Math.random() > 0.7 ? 4 : 2,
      });
    }
    if (!this.animando) {
      this.animando = true;
      this.ultimo = performance.now();
      requestAnimationFrame((t) => this.cuadro(t));
    }
  }

  private cuadro(ahora: number): void {
    const dt = Math.min(0.1, (ahora - this.ultimo) / 1000);
    this.ultimo = ahora;
    const c = this.contexto;
    c.clearRect(0, 0, this.lienzo.width, this.lienzo.height);
    for (const p of this.chispas) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.vida -= dt;
      c.globalAlpha = Math.max(0, Math.ceil((p.vida / p.total) * 3) / 3);
      c.fillStyle = p.color;
      c.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, p.tamanio, p.tamanio);
    }
    c.globalAlpha = 1;
    this.chispas = this.chispas.filter((p) => p.vida > 0);
    if (this.chispas.length > 0) {
      requestAnimationFrame((t) => this.cuadro(t));
    } else {
      c.clearRect(0, 0, this.lienzo.width, this.lienzo.height);
      this.animando = false;
    }
  }
}
