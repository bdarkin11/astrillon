import { crearSalida, programarSonido } from './sonidos';
import type { Evento } from './sonidos';

const CLAVE_SILENCIO = 'astrillon:silencio';
const VOLUMEN = 0.8;

function leerSilencio(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_SILENCIO) === '1';
  } catch {
    return false;
  }
}

/**
 * Todo el sonido se genera en el momento, sin archivos de audio. Los navegadores no dejan sonar
 * nada hasta que el jugador toca algo, así que el audio arranca con el primer toque o tecla.
 * Si el navegador no tiene audio, el juego sigue andando en silencio.
 */
export class Sonido {
  private ac: AudioContext | null = null;
  private salida: GainNode | null = null;
  private silencio = leerSilencio();
  private readonly avisos: (() => void)[] = [];

  constructor() {
    const desbloquear = () => this.abrir();
    document.addEventListener('pointerdown', desbloquear, { capture: true, passive: true });
    document.addEventListener('keydown', desbloquear, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ac) return;
      void (document.hidden ? this.ac.suspend() : this.ac.resume());
    });
  }

  private abrir(): void {
    if (this.silencio) return;
    try {
      if (!this.ac) {
        this.ac = new AudioContext();
        this.salida = crearSalida(this.ac, VOLUMEN);
      }
      if (this.ac.state === 'suspended' && !document.hidden) void this.ac.resume();
    } catch {
      this.ac = null;
      this.salida = null;
    }
  }

  reproducir(evento: Evento): void {
    const { ac, salida } = this;
    if (this.silencio || !ac || !salida) return;
    if (ac.state === 'running') {
      programarSonido(ac, salida, evento);
    } else if (ac.state === 'suspended' && !document.hidden) {
      // Justo después del primer toque el audio todavía está arrancando: el sonido sale apenas esté listo.
      void ac.resume().then(() => {
        if (!this.silencio) programarSonido(ac, salida, evento);
      });
    }
  }

  get enSilencio(): boolean {
    return this.silencio;
  }

  alternarSilencio(): void {
    this.silencio = !this.silencio;
    try {
      window.localStorage.setItem(CLAVE_SILENCIO, this.silencio ? '1' : '0');
    } catch {
      // Sin almacenamiento, la elección dura hasta cerrar la página.
    }
    if (this.salida) this.salida.gain.value = this.silencio ? 0 : VOLUMEN;
    if (!this.silencio) this.abrir();
    this.avisos.forEach((avisar) => avisar());
  }

  alCambiarSilencio(avisar: () => void): void {
    this.avisos.push(avisar);
  }
}

const PARLANTE = '<rect x="2" y="6" width="3" height="4"/><rect x="5" y="5" width="2" height="6"/><rect x="7" y="3" width="2" height="10"/>';
const ONDAS = '<rect x="11" y="6" width="2" height="4"/><rect x="14" y="3" width="2" height="10"/>';
const CRUZ = '<rect x="11" y="5" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/><rect x="15" y="9" width="2" height="2"/><rect x="15" y="5" width="2" height="2"/><rect x="11" y="9" width="2" height="2"/>';

/** Botón fijo para silenciar. Sin foco de teclado, para que Enter nunca lo active por error al responder. */
export function crearBotonDeSonido(sonido: Sonido): HTMLButtonElement {
  const elemento = document.createElement('button');
  elemento.type = 'button';
  elemento.className = 'boton-sonido';
  const pintar = () => {
    elemento.innerHTML = `<svg viewBox="0 0 18 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${PARLANTE}${sonido.enSilencio ? CRUZ : ONDAS}</svg>`;
    elemento.setAttribute('aria-label', sonido.enSilencio ? 'Activar el sonido' : 'Silenciar');
    elemento.setAttribute('aria-pressed', String(sonido.enSilencio));
  };
  elemento.addEventListener('pointerdown', (evento) => evento.preventDefault());
  elemento.addEventListener('click', () => sonido.alternarSilencio());
  sonido.alCambiarSilencio(pintar);
  pintar();
  document.body.append(elemento);
  return elemento;
}
