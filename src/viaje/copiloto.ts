import { COLORES_DORADOS, REACCIONES, ubicacionDeCopiloto } from '../juego/copilotos';
import type { Animacion, Cara, Copiloto, Pose, Reaccion } from '../juego/copilotos';
import { crearSpriteDeRobot } from './sprites';
import type { Sprite } from './sprites';

const CLASES_DE_ANIMACION: Animacion[] = ['triste', 'desmayo', 'contento', 'asombro', 'festeja', 'giro'];
/** El robot se refina al doble de su mapa de 16 por 16. */
const LADO_DEL_DIBUJO = 32;

/** El robot que acompaña el viaje: un elemento propio, por encima de los paneles pero sin taparlos. */
export class CopilotoEnPantalla {
  private readonly elemento: HTMLButtonElement;
  private readonly cuerpo: HTMLElement;
  private readonly contexto: CanvasRenderingContext2D;
  private readonly globo: HTMLElement;
  private readonly reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly dibujos = new Map<string, Sprite>();
  private readonly alSerTocado: () => void;
  private personaje: Copiloto;
  private dorado = false;
  private cara: Cara = 'normal';
  private pose: Pose = 'inicio';
  private x = -80;
  private y = 0;
  private ultimoCuadro = 0;
  private proximoParpadeo = 2000;
  private finDeParpadeo = 0;
  private temporizador = 0;

  constructor(personaje: Copiloto, alSerTocado: () => void) {
    this.personaje = personaje;
    this.alSerTocado = alSerTocado;
    this.elemento = document.createElement('button');
    this.elemento.type = 'button';
    this.elemento.className = 'copiloto';
    this.elemento.tabIndex = -1;
    this.elemento.setAttribute('aria-label', `Tocar a ${personaje.nombre}, tu copiloto`);
    this.cuerpo = document.createElement('span');
    this.cuerpo.className = 'copiloto-cuerpo';
    const lienzo = document.createElement('canvas');
    lienzo.width = LADO_DEL_DIBUJO;
    lienzo.height = LADO_DEL_DIBUJO;
    this.contexto = lienzo.getContext('2d')!;
    this.globo = document.createElement('span');
    this.globo.className = 'copiloto-globo';
    this.cuerpo.append(lienzo);
    this.elemento.append(this.cuerpo, this.globo);
    document.body.append(this.elemento);

    // Tocarlo no le saca el foco al campo de texto: no puede costarte tiempo en una consigna.
    this.elemento.addEventListener('pointerdown', (evento) => evento.preventDefault());
    this.elemento.addEventListener('click', () => this.alTocar());
    this.y = window.innerHeight * 0.6;
    requestAnimationFrame((t) => this.cuadro(t));
  }

  ubicar(pose: Pose): void {
    this.pose = pose;
  }

  cambiarPersonaje(personaje: Copiloto): void {
    this.personaje = personaje;
    this.elemento.setAttribute('aria-label', `Tocar a ${personaje.nombre}, tu copiloto`);
    this.pintar(this.cara);
  }

  dorar(dorado: boolean): void {
    this.dorado = dorado;
    this.pintar(this.cara);
  }

  reaccionar(tipo: keyof typeof REACCIONES): void {
    this.aplicar(REACCIONES[tipo]);
  }

  private alTocar(): void {
    this.alSerTocado();
    this.aplicar({ cara: 'feliz', animacion: 'giro', globo: this.personaje.sonido, duracion: 950 });
  }

  private aplicar({ cara, animacion, globo, duracion }: Reaccion): void {
    window.clearTimeout(this.temporizador);
    this.cara = cara;
    this.pintar(cara);
    this.cuerpo.classList.remove(...CLASES_DE_ANIMACION);
    this.globo.classList.remove('visible');
    void this.cuerpo.offsetWidth;
    this.cuerpo.classList.add(animacion);
    this.globo.textContent = globo;
    this.globo.classList.add('visible');
    this.temporizador = window.setTimeout(() => {
      this.cuerpo.classList.remove(animacion);
      this.globo.classList.remove('visible');
      this.cara = 'normal';
      this.pintar('normal');
    }, duracion);
  }

  private pintar(cara: Cara): void {
    const clave = `${this.personaje.id}:${this.dorado}:${cara}`;
    let dibujo = this.dibujos.get(clave);
    if (!dibujo) {
      const colores = this.dorado ? { ...this.personaje.colores, ...COLORES_DORADOS } : this.personaje.colores;
      dibujo = crearSpriteDeRobot(cara, colores);
      this.dibujos.set(clave, dibujo);
    }
    this.contexto.clearRect(0, 0, LADO_DEL_DIBUJO, LADO_DEL_DIBUJO);
    this.contexto.drawImage(dibujo.lienzo, 0, 0);
  }

  private cuadro(ahora: number): void {
    const dt = Math.min(0.1, (ahora - this.ultimoCuadro) / 1000);
    this.ultimoCuadro = ahora;
    const destino = ubicacionDeCopiloto(this.pose, window.innerWidth, window.innerHeight);
    this.elemento.classList.toggle('oculto', destino === null);
    if (destino) {
      const suavizado = this.reducido ? 1 : 1 - Math.exp(-3.5 * dt);
      this.x += (destino.x - this.x) * suavizado;
      this.y += (destino.y - this.y) * suavizado;
      const flotar = this.reducido ? 0 : Math.sin(ahora / 590) * 5;
      this.elemento.style.transform = `translate3d(${Math.round(this.x)}px, ${Math.round(this.y + flotar)}px, 0) translate(-50%, -50%)`;
    }
    this.parpadear(ahora);
    requestAnimationFrame((t) => this.cuadro(t));
  }

  private parpadear(ahora: number): void {
    if (this.cara !== 'normal') return;
    if (this.finDeParpadeo && ahora >= this.finDeParpadeo) {
      this.finDeParpadeo = 0;
      this.pintar('normal');
    } else if (ahora >= this.proximoParpadeo) {
      this.proximoParpadeo = ahora + 2200 + Math.random() * 2800;
      this.finDeParpadeo = ahora + 130;
      this.pintar('parpadeo');
    }
  }
}
