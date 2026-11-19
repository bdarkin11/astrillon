import { NIVELES_ORDENADOS } from '../juego/niveles';
import { calcularPuntos } from '../juego/partida';
import { RUTA } from '../juego/ruta';
import type { Parada } from '../juego/ruta';
import type { NivelId } from '../juego/niveles';
import { COREOGRAFIAS, recortarParaCartel } from './coreografia';
import type { Coreografia } from './coreografia';
import { Efectos } from './efectos';
import { Fondo } from './fondo';
import { AmbienteDelMenu } from './menu';
import type { GeometriaDeLaTierra } from './menu';
import { TOBERAS } from './nave';
import { ANCHO_DE_REGLA, dibujarHitos, dibujarRegla } from './rotulos';
import {
  ATMOSFERA_DEL_HORIZONTE,
  crearSpriteDeHorizonte,
  crearSpriteDeFantasma,
  crearSpriteDeNave,
  crearSpriteDeParada,
  crearSpriteDeResplandor,
  crearVeloDeFondo,
  hexARgb,
  mezclar,
} from './sprites';
import type { Sprite } from './sprites';

const PIXELES_POR_PUNTO = 12;
const ALTURA_DE_LA_NAVE = 0.74;
const RADIO_DEL_HORIZONTE = 220;
/** La nave tiene el doble de píxeles que antes, así que se dibuja a la mitad de escala: mismo tamaño, más detalle. */
const ESCALA_NAVE = 2;
/** Tamaño en pantalla de cada píxel de planetas y Tierra. Antes eran 3: ahora entran más píxeles en el mismo lugar. */
const PIXEL_DE_ASTROS = 2;
/** Los rótulos no se dibujan más arriba de esto, para no pisar el tablero. */
const ALTURA_DEL_TABLERO = 150;
const FUENTE = '"Jersey 15", sans-serif';
const DURACION_DEL_FANTASMA = 1400;
const COLOR_DEL_FANTASMA = '#c9b8ff';
/** Más arriba que esto, la nave del amigo suele quedar tapada por los carteles. */
const DISTANCIA_VISIBLE_DEL_FANTASMA = 120;

/** Color del espacio según lo lejos que se llegó. */
const CIELO: [number, string][] = [
  [0, '#1b2a5e'],
  [8, '#16123a'],
  [45, '#3a1a3f'],
  [75, '#16123a'],
  [565, '#121438'],
  [700, '#0e2148'],
  [1000, '#23123f'],
  [1400, '#34155c'],
  [2000, '#141a52'],
];

interface Estrella {
  x: number;
  y: number;
  tamanio: number;
  parallax: number;
  brillo: string;
  fase: number;
}

function crearEstrellas(cantidad: number): Estrella[] {
  const tonos = ['#ffffff', '#cfd6ff', '#ffe9c4', '#b7f3ff'];
  return Array.from({ length: cantidad }, () => {
    const capa = Math.random();
    return {
      x: Math.random(),
      y: Math.random(),
      tamanio: capa > 0.9 ? 3 : capa > 0.5 ? 2 : 1,
      parallax: capa > 0.9 ? 0.5 : capa > 0.5 ? 0.25 : 0.1,
      brillo: tonos[Math.floor(Math.random() * tonos.length)],
      fase: Math.random() * Math.PI * 2,
    };
  });
}

function colorDeCielo(puntos: number): string {
  let i = 0;
  while (i < CIELO.length - 1 && CIELO[i + 1][0] <= puntos) i++;
  const [desde, colorDesde] = CIELO[i];
  const siguiente = CIELO[i + 1];
  if (!siguiente) return colorDesde;
  const t = (puntos - desde) / (siguiente[0] - desde);
  const [r, g, b] = mezclar(hexARgb(colorDesde), hexARgb(siguiente[1]), t);
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

interface Tramo {
  desde: number;
  hasta: number;
  inicio: number;
  duracion: number;
  turbo: boolean;
  coreografia: Coreografia;
  respuesta: string;
  alProgreso?: (puntos: number) => void;
  alCruzarLinea?: () => void;
  /** Cuándo se cruzó cada línea de nivel. */
  cruces: Map<NivelId, number>;
}

export interface OpcionesDeViaje {
  puntos: number;
  turbo: boolean;
  nivel: NivelId;
  respuesta: string;
  alProgreso?: (puntos: number) => void;
  alCruzarLinea?: () => void;
}

/** Dibuja el viaje de fondo. Dibuja con requestAnimationFrame, pero los tiempos del juego no dependen de eso. */
export class Escena {
  private readonly contexto: CanvasRenderingContext2D;
  private readonly lienzo: HTMLCanvasElement;
  private readonly estrellas = crearEstrellas(170);
  private readonly sprites = new Map<string, Sprite>();
  private readonly nave = crearSpriteDeNave();
  private readonly naveDorada = crearSpriteDeNave(true);
  private readonly naveFantasma = crearSpriteDeFantasma();
  /** La nave del amigo en un desafío. Se mueve sola, con su propio tramo, mientras la tuya espera o viaja. */
  private fantasma: { desde: number; hasta: number; inicio: number } | null = null;
  private readonly movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly efectos = new Efectos(this.movimientoReducido);
  private readonly fondo = new Fondo(this.movimientoReducido);
  private opacidadDeTextos = 0;
  private dorada = false;
  private ultimoCuadro = 0;
  private puntosDelCuadroAnterior = 0;
  private horizonte: Sprite | null = null;
  private radioDelHorizonte = 0;
  private resplandor: Sprite | null = null;
  private velo: Sprite | null = null;
  private geometriaDeLaTierra: GeometriaDeLaTierra | null = null;
  private readonly ambiente = new AmbienteDelMenu(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  private puntos = 0;
  private tramo: Tramo | null = null;
  private temblorHasta = 0;
  private rutaVisible = false;
  private ancho = 0;
  private alto = 0;
  /** Dónde está la nave ahora. En el menú se corre para que los carteles no la tapen. */
  private naveX = NaN;
  private naveY = NaN;
  private carteles: HTMLElement | null = null;
  private zonaOcupada: { right: number; bottom: number } | null = null;
  private ultimaMedicion = 0;

  constructor(lienzo: HTMLCanvasElement) {
    this.lienzo = lienzo;
    this.contexto = lienzo.getContext('2d')!;
    this.ajustarTamanio();
    window.addEventListener('resize', () => this.ajustarTamanio());
    requestAnimationFrame((t) => this.dibujar(t));
  }

  /** Vuelve a la plataforma de despegue, con el cielo limpio para la pantalla de inicio. */
  reiniciar(): void {
    this.tramo = null;
    this.puntos = 0;
    this.temblorHasta = 0;
    this.rutaVisible = false;
    this.dorada = false;
    this.efectos.reiniciar();
    this.fondo.reiniciar();
    this.opacidadDeTextos = 0;
    this.fantasma = null;
  }

  /**
   * En el menú, la nave se corre al costado de los carteles si hay lugar, o abajo de ellos si no.
   * Con null vuelve a su lugar de siempre, que es el que usa el viaje.
   */
  despejarNave(carteles: HTMLElement | null): void {
    this.carteles = carteles;
    this.zonaOcupada = null;
    this.ultimaMedicion = 0;
  }

  private acomodarNave(dt: number, ahora: number): void {
    let objetivoX = this.ancho / 2;
    let objetivoY = this.alto * ALTURA_DE_LA_NAVE;
    const enElMenu = !this.rutaVisible && !this.tramo;
    if (enElMenu && this.carteles) {
      // Medir el DOM en cada cuadro es caro: alcanza con un par de veces por segundo.
      if (ahora - this.ultimaMedicion > 400) {
        this.ultimaMedicion = ahora;
        this.zonaOcupada = medirCarteles(this.carteles);
      }
      const zona = this.zonaOcupada;
      const mitadDeLaNave = (this.nave.alto * ESCALA_NAVE) / 2;
      if (zona && objetivoY - mitadDeLaNave < zona.bottom + 12) {
        const costado = this.ancho - zona.right;
        if (costado >= 140) objetivoX = zona.right + costado / 2;
        else objetivoY = Math.min(zona.bottom + mitadDeLaNave + 24, this.alto - mitadDeLaNave - 16);
      }
    }
    if (Number.isNaN(this.naveX) || this.movimientoReducido) {
      this.naveX = objetivoX;
      this.naveY = objetivoY;
      return;
    }
    const paso = Math.min(1, dt * 5);
    this.naveX += (objetivoX - this.naveX) * paso;
    this.naveY += (objetivoY - this.naveY) * paso;
    if (Math.abs(objetivoX - this.naveX) < 0.5) this.naveX = objetivoX;
    if (Math.abs(objetivoY - this.naveY) < 0.5) this.naveY = objetivoY;
  }

  /** Muestra la nave fantasma de un desafío en ese puntaje, o la saca con null. */
  ponerFantasma(puntos: number | null): void {
    this.fantasma = puntos === null ? null : { desde: puntos, hasta: puntos, inicio: 0 };
  }

  /** La nave fantasma viaja hasta ese puntaje, como la tuya cuando respondés. */
  moverFantasma(puntos: number): void {
    if (!this.fantasma || this.fantasma.hasta === puntos) return;
    const ahora = performance.now();
    this.fantasma = { desde: this.puntosDelFantasma(ahora), hasta: puntos, inicio: ahora };
  }

  private puntosDelFantasma(ahora: number): number {
    const f = this.fantasma;
    if (!f) return 0;
    const t = this.movimientoReducido ? 1 : Math.min(1, (ahora - f.inicio) / DURACION_DEL_FANTASMA);
    return f.desde + (f.hasta - f.desde) * (1 - (1 - t) ** 3);
  }

  /** Para retomar o volver a ver un viaje en el que ya se encontró una joya. */
  dorar(): void {
    this.dorada = true;
  }

  mostrarRuta(): void {
    this.rutaVisible = true;
  }

  /** Ubica la nave directamente, para retomar o volver a ver un viaje ya hecho. */
  saltarA(puntos: number): void {
    this.tramo = null;
    this.puntos = puntos;
  }

  /** Viaja hasta el puntaje indicado. La promesa se cumple al llegar, aunque la pestaña esté oculta. */
  viajarA({ puntos, turbo, nivel, respuesta, alProgreso, alCruzarLinea }: OpcionesDeViaje): Promise<void> {
    const coreografia = COREOGRAFIAS[nivel];
    const duracion = this.movimientoReducido ? 250 : coreografia.duracion;
    const inicio = performance.now();
    this.tramo = { desde: this.puntos, hasta: puntos, inicio, duracion, turbo, coreografia, respuesta, alProgreso, alCruzarLinea, cruces: new Map() };
    this.efectos.iniciar(coreografia, inicio, this.ancho, this.alto);
    return new Promise((resolver) => {
      window.setTimeout(() => {
        this.puntos = puntos;
        this.tramo = null;
        this.efectos.llegar(this.ancho / 2, this.alto * ALTURA_DE_LA_NAVE, performance.now());
        if (coreografia.dorar) this.dorada = true;
        alProgreso?.(puntos);
        resolver();
      }, duracion);
    });
  }

  /** Al errar: estática, sacudida y un destello apagado. */
  temblar(): Promise<void> {
    const duracion = this.movimientoReducido ? 150 : 650;
    const ahora = performance.now();
    this.temblorHasta = ahora + duracion;
    this.efectos.perderSenal(ahora);
    return new Promise((resolver) => window.setTimeout(resolver, duracion));
  }

  private ajustarTamanio(): void {
    const proporcion = window.devicePixelRatio || 1;
    this.ancho = window.innerWidth;
    this.alto = window.innerHeight;
    this.lienzo.width = Math.floor(this.ancho * proporcion);
    this.lienzo.height = Math.floor(this.alto * proporcion);
    this.contexto.setTransform(proporcion, 0, 0, proporcion, 0, 0);
    this.contexto.imageSmoothingEnabled = false;
  }

  private puntosVisibles(ahora: number): number {
    const tramo = this.tramo;
    if (!tramo) return this.puntos;
    const t = Math.min(1, (ahora - tramo.inicio) / tramo.duracion);
    const suavizado = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    return tramo.desde + (tramo.hasta - tramo.desde) * suavizado;
  }

/** En pantalla los astros miden lo mismo que antes (3 píxeles por punto en compu, 2 en celular), pero con píxeles de 2. */
  private resolucionDeAstros(): number {
    return (this.ancho < 500 ? 2 : 3) / PIXEL_DE_ASTROS;
  }

  private spriteDe(parada: Parada): Sprite {
    const resolucion = this.resolucionDeAstros();
    const clave = `${parada.id}:${resolucion}`;
    let sprite = this.sprites.get(clave);
    if (!sprite) {
      sprite = crearSpriteDeParada(parada, resolucion);
      this.sprites.set(clave, sprite);
    }
    return sprite;
  }

  private dibujar(ahora: number): void {
    const visibles = this.puntosVisibles(ahora);
    const dt = Math.min(0.1, (ahora - this.ultimoCuadro) / 1000);
    const avance = this.tramo ? visibles - this.puntosDelCuadroAnterior : 0;
    this.puntosDelCuadroAnterior = visibles;
    this.ultimoCuadro = ahora;
    const c = this.contexto;
    c.fillStyle = colorDeCielo(visibles);
    c.fillRect(0, 0, this.ancho, this.alto);

    this.acomodarNave(dt, ahora);
    const naveY = this.naveY;
    const naveX = this.naveX + this.desvioDeNave(ahora);
    const tramo = this.tramo;
    // Las estrellas se estiran al acelerar y vuelven a ser puntos al llegar.
    const impulso = tramo ? Math.sin(Math.min(1, (ahora - tramo.inicio) / tramo.duracion) * Math.PI) : 0;
    const velocidad = tramo ? ((tramo.hasta - tramo.desde) / tramo.duracion) * tramo.coreografia.estirarEstrellas * impulso : 0;
    tramo?.alProgreso?.(visibles);

    const arrastre = dt > 0 ? (avance * PIXELES_POR_PUNTO) / dt : 0;
    this.efectos.actualizar(ahora, dt, naveX, naveY, arrastre);
    if (this.rutaVisible) this.fondo.actualizar(dt, visibles, arrastre, this.ancho, this.alto);
    const objetivoTextos = tramo ? 1 : 0;
    this.opacidadDeTextos += Math.sign(objetivoTextos - this.opacidadDeTextos) * Math.min(Math.abs(objetivoTextos - this.opacidadDeTextos), dt * 3);

    const medidas = { ancho: this.ancho, alto: this.alto, naveY, pixelesPorPunto: PIXELES_POR_PUNTO };
    const desplazamiento = this.efectos.desplazamiento(ahora);
    c.save();
    c.translate(desplazamiento.x, desplazamiento.y);
    const enElMenu = !this.rutaVisible && !tramo;
    this.dibujarVelo(visibles, ahora, enElMenu);
    this.dibujarEstrellas(visibles, ahora, velocidad, enElMenu);
    if (enElMenu) {
      this.ambiente.actualizar(ahora, dt, this.ancho, this.alto, this.geometriaDeLaTierra);
      this.ambiente.dibujarCielo(c, ahora, this.ancho, this.geometriaDeLaTierra);
    }
    this.dibujarSol(visibles);
    // La viñeta oscurece sólo el cielo: los planetas y los textos quedan enteros por encima.
    this.fondo.dibujarVineta(c, visibles, this.ancho, this.alto);
    if (this.rutaVisible) {
      this.fondo.dibujar(c, visibles, naveY, PIXELES_POR_PUNTO, this.ancho, this.alto);
      this.dibujarParadas(visibles, naveY);
      dibujarHitos(c, visibles, medidas, this.opacidadDeTextos, (id) => this.ubicarParada(id, visibles, naveY));
      dibujarRegla(c, visibles, tramo ? tramo.desde : this.puntos, medidas);
    }
    this.dibujarHorizonte(visibles, naveY);
    if (enElMenu) this.ambiente.dibujarSobreLaTierra(c, this.geometriaDeLaTierra);
    if (tramo) this.dibujarMarcasDeNivel(tramo, visibles, naveY, ahora);
    this.efectos.dibujarAtras(c, this.nave, this.ancho, ahora);
    if (this.fantasma) this.dibujarFantasma(visibles, naveY, ahora);
    this.dibujarNave(naveX, naveY, ahora);
    this.efectos.dibujarEscolta(c, naveX, naveY, ahora);
    c.restore();

    this.efectos.dibujarEncima(c, this.ancho, this.alto, naveX, naveY, ahora);
    if (tramo) this.dibujarCartel(tramo, naveX, naveY);

    requestAnimationFrame((t) => this.dibujar(t));
  }

  /** Cuánto se corre la nave del centro: el hamacado y la vibración de cada nivel. */
  private desvioDeNave(ahora: number): number {
    const tramo = this.tramo;
    if (!tramo || this.movimientoReducido) return 0;
    const { balanceo, vibracion } = tramo.coreografia;
    const t = (ahora - tramo.inicio) / tramo.duracion;
    const hamaca = Math.sin(t * Math.PI * 5) * balanceo * (1 - t * 0.4);
    const temblor = vibracion ? (Math.floor(ahora / 40) % 2 === 0 ? vibracion : -vibracion) : 0;
    return Math.round(hamaca + temblor);
  }

  /** Tu respuesta viaja colgada de la nave, con el color de su nivel. */
  private dibujarCartel(tramo: Tramo, naveX: number, naveY: number): void {
    const c = this.contexto;
    const { color } = tramo.coreografia;
    c.font = `26px ${FUENTE}`;
    c.textAlign = 'center';
    const anchoMaximo = Math.min(this.ancho - 48, 480);
    const texto = recortarParaCartel(`"${tramo.respuesta.toUpperCase()}"`, (t) => c.measureText(t).width <= anchoMaximo);
    const ancho = Math.round(c.measureText(texto).width) + 24;
    const alto = 36;
    const x = Math.round(Math.max(ancho / 2 + 8, Math.min(this.ancho - ancho / 2 - 8, naveX)) - ancho / 2);
    const y = Math.round(naveY - this.nave.alto * ESCALA_NAVE - alto + 8);
    c.fillStyle = '#111c44';
    c.fillRect(x, y, ancho, alto);
    c.fillStyle = color;
    c.fillRect(x, y, ancho, 3);
    c.fillRect(x, y + alto - 3, ancho, 3);
    c.fillRect(x, y, 3, alto);
    c.fillRect(x + ancho - 3, y, 3, alto);
    c.fillText(texto, x + ancho / 2, y + 26);
    c.textAlign = 'left';
  }

  private dibujarEstrellas(puntos: number, ahora: number, velocidad: number, enElMenu: boolean): void {
    const c = this.contexto;
    // En el menú las estrellas derivan despacio, como si la nave flotara en órbita.
    const deriva = enElMenu && !this.movimientoReducido ? ahora * 0.006 : 0;
    const desplazamiento = puntos * PIXELES_POR_PUNTO + deriva;
    const estela = this.movimientoReducido ? 0 : velocidad * 60;
    for (const e of this.estrellas) {
      const y = Math.floor((e.y * this.alto + desplazamiento * e.parallax) % this.alto);
      const x = Math.floor(e.x * this.ancho);
      const brillo = this.movimientoReducido ? 0.8 : 0.55 + Math.sin(ahora / 900 + e.fase) * 0.35;
      c.globalAlpha = brillo;
      c.fillStyle = e.brillo;
      c.fillRect(x, y, e.tamanio, e.tamanio + estela * e.parallax);
      // Las estrellas más cercanas tienen una cruz tenue y un núcleo blanco, cuando están quietas.
      if (e.tamanio === 3 && estela < 1) {
        c.globalAlpha = brillo * 0.45;
        c.fillRect(x - 2, y + 1, 2, 1);
        c.fillRect(x + 3, y + 1, 2, 1);
        c.fillRect(x + 1, y - 2, 1, 2);
        c.fillRect(x + 1, y + 3, 1, 2);
        c.globalAlpha = brillo;
        c.fillStyle = '#ffffff';
        c.fillRect(x + 1, y + 1, 1, 1);
      }
    }
    c.globalAlpha = 1;
  }

  /** El resplandor del Sol, que se siente durante el sobrevuelo de Venus y Mercurio. */
  private dibujarSol(puntos: number): void {
    const intensidad = Math.max(0, 1 - Math.abs(puntos - 50) / 32);
    if (intensidad <= 0) return;
    const c = this.contexto;
    if (!this.resplandor) this.resplandor = crearSpriteDeResplandor(170);
    const lado = this.resplandor.ancho * PIXEL_DE_ASTROS;
    // La intensidad sube a escalones, para que el tramado no se vea como un degradado.
    c.globalAlpha = Math.ceil(intensidad * 4) / 4 * 0.55;
    c.drawImage(this.resplandor.lienzo, -lado / 2, this.alto * 0.42 - lado / 2, lado, lado);
    c.globalAlpha = 1;
  }

  /** Nebulosas lejanas de fondo: se mueven mucho más lento que las estrellas y dan sensación de hondura. */
  private dibujarVelo(puntos: number, ahora: number, enElMenu: boolean): void {
    const pixel = 6;
    const ancho = Math.ceil(this.ancho / pixel);
    const alto = Math.ceil(this.alto / pixel) + 40;
    if (!this.velo || this.velo.ancho !== ancho || this.velo.alto !== alto) this.velo = crearVeloDeFondo(ancho, alto);
    const altoEnPantalla = this.velo.alto * pixel;
    const deriva = enElMenu && !this.movimientoReducido ? ahora * 0.002 : 0;
    const desplazamiento = ((puntos * PIXELES_POR_PUNTO * 0.04 + deriva) % altoEnPantalla + altoEnPantalla) % altoEnPantalla;
    const c = this.contexto;
    c.globalAlpha = 0.22;
    const y = Math.round(desplazamiento / pixel) * pixel;
    c.drawImage(this.velo.lienzo, 0, y, this.velo.ancho * pixel, altoEnPantalla);
    c.drawImage(this.velo.lienzo, 0, y - altoEnPantalla, this.velo.ancho * pixel, altoEnPantalla);
    c.globalAlpha = 1;
  }

  /** Dónde cae el borde de arriba de una parada, para apoyar una sonda encima. */
  private ubicarParada(id: string, puntos: number, naveY: number): { x: number; arriba: number } | null {
    const indice = RUTA.findIndex((p) => p.id === id);
    if (indice < 0) return null;
    const parada = RUTA[indice];
    const separacion = Math.min(this.ancho * 0.36, 380);
    const escala = PIXEL_DE_ASTROS;
    const y = naveY - (parada.puntos - puntos) * PIXELES_POR_PUNTO;
    const x = this.ancho / 2 + (indice % 2 === 1 ? separacion : -separacion);
    return { x, arriba: y - (this.spriteDe(parada).alto * escala) / 2 };
  }

  private dibujarParadas(puntos: number, naveY: number): void {
    const c = this.contexto;
    const separacion = Math.min(this.ancho * 0.36, 380);
    const escala = PIXEL_DE_ASTROS;
    RUTA.forEach((parada, indice) => {
      if (parada.id === 'tierra') return;
      const y = naveY - (parada.puntos - puntos) * PIXELES_POR_PUNTO;
      const sprite = this.spriteDe(parada);
      const altoEnPantalla = sprite.alto * escala;
      if (y < -altoEnPantalla - 60 || y > this.alto + altoEnPantalla + 60) return;

      const anchoEnPantalla = sprite.ancho * escala;
      const haciaLaDerecha = indice % 2 === 1;
      const expansivo = parada.estilo === 'campo' || parada.estilo === 'frontera';
      const x = expansivo ? this.ancho / 2 : this.ancho / 2 + (haciaLaDerecha ? separacion : -separacion);
      c.drawImage(sprite.lienzo, Math.round(x - anchoEnPantalla / 2), Math.round(y - altoEnPantalla / 2), anchoEnPantalla, altoEnPantalla);

      const rotuloY = expansivo ? y + altoEnPantalla / 2 + 22 : y + altoEnPantalla / 2 + 20;
      if (rotuloY < ALTURA_DEL_TABLERO) return;
      const rotuloX = Math.max(70, Math.min(this.ancho - 70, x));
      c.textAlign = 'center';
      c.fillStyle = '#ffffff';
      c.font = `24px ${FUENTE}`;
      c.fillText(parada.nombre, rotuloX, rotuloY);
      c.fillStyle = '#c9c6e6';
      c.font = `19px ${FUENTE}`;
      c.fillText(parada.tipo, rotuloX, rotuloY + 19);
    });
  }

  private dibujarHorizonte(puntos: number, naveY: number): void {
    const c = this.contexto;
    const y = naveY + 40 + puntos * PIXELES_POR_PUNTO;
    if (y > this.alto) return;
    // La Tierra mide lo mismo de siempre, pero con píxeles de 2: el radio del dibujo crece en proporción.
    const escalaDeAntes = Math.max(3, Math.ceil(this.ancho / (RADIO_DEL_HORIZONTE * 2)));
    const radio = Math.round((RADIO_DEL_HORIZONTE * escalaDeAntes) / PIXEL_DE_ASTROS);
    if (!this.horizonte || this.radioDelHorizonte !== radio) {
      this.horizonte = crearSpriteDeHorizonte(RUTA[0], radio);
      this.radioDelHorizonte = radio;
    }
    const escala = PIXEL_DE_ASTROS;
    this.geometriaDeLaTierra = { centroX: this.ancho / 2, centroY: Math.round(y) + radio * escala, radio: radio * escala, arriba: Math.round(y) };
    const ancho = this.horizonte.ancho * escala;
    const alto = this.horizonte.alto * escala;
    // El dibujo empieza más arriba que el planeta, para incluir la franja de atmósfera.
    const arriba = Math.round(y) - ATMOSFERA_DEL_HORIZONTE * escala;
    const altoVisible = Math.min(alto, Math.ceil(this.alto - arriba + 4));
    if (altoVisible <= 0) return;
    c.drawImage(
      this.horizonte.lienzo,
      0,
      0,
      this.horizonte.ancho,
      altoVisible / escala,
      Math.round(this.ancho / 2 - ancho / 2),
      arriba,
      ancho,
      altoVisible,
    );
  }

  /** Durante el viaje se ve hasta dónde hubiera llegado la nave con cada nivel. */
  private dibujarMarcasDeNivel(tramo: Tramo, puntos: number, naveY: number, ahora: number): void {
    const c = this.contexto;
    c.textAlign = 'right';
    c.font = `20px ${FUENTE}`;
    const deMenorAMayor = [...NIVELES_ORDENADOS].reverse();
    deMenorAMayor.forEach((nivel, indice) => {
      const valor = calcularPuntos(nivel, tramo.turbo);
      if (valor === 0) return;
      const y = Math.round(naveY - (tramo.desde + valor - puntos) * PIXELES_POR_PUNTO);

      // La línea que la nave acaba de cruzar se enciende con su color y suelta chispas.
      let cruce = tramo.cruces.get(nivel.id);
      if (cruce === undefined && y >= naveY) {
        cruce = ahora;
        tramo.cruces.set(nivel.id, ahora);
        tramo.alCruzarLinea?.();
        this.efectos.estallar(this.ancho / 2, naveY, COREOGRAFIAS[nivel.id].color, 10, 0.7);
      }
      if (y < 0 || y > this.alto) return;

      const cruzada = cruce !== undefined;
      const recien = cruce !== undefined && ahora - cruce < 400;
      // Las líneas aparecen de a una, de la más cercana a la más lejana.
      const aparicion = Math.min(1, Math.max(0, (ahora - tramo.inicio - indice * 90) / 200));
      const color = COREOGRAFIAS[nivel.id].color;
      c.fillStyle = cruzada ? color : '#8d95c0';
      c.globalAlpha = aparicion * (cruzada ? 1 : 0.6);
      for (let x = 0; x < this.ancho; x += 16) c.fillRect(x, y, 8, recien ? 4 : 2);
      c.globalAlpha = aparicion;
      const rotulo = `${nivel.nombre}, ${valor}`;
      const anchoRotulo = c.measureText(rotulo).width + 12;
      const fondo = c.fillStyle;
      c.fillStyle = '#16123a';
      c.fillRect(this.ancho - anchoRotulo - ANCHO_DE_REGLA - 6, y - 22, anchoRotulo, 20);
      c.fillStyle = fondo;
      c.fillText(rotulo, this.ancho - ANCHO_DE_REGLA - 12, y - 6);
      c.globalAlpha = 1;
    });
  }

  private dibujarNave(naveX: number, naveY: number, ahora: number): void {
    const c = this.contexto;
    const tiembla = ahora < this.temblorHasta;
    const dx = tiembla ? Math.round(Math.sin(ahora / 28) * 5) : 0;
    const ancho = this.nave.ancho * ESCALA_NAVE;
    const alto = this.nave.alto * ESCALA_NAVE;
    const x = Math.round(naveX - ancho / 2) + dx;
    const y = Math.round(naveY - alto / 2);

    const viajando = this.tramo !== null;
    const parpadeo = this.movimientoReducido ? 0 : Math.floor(ahora / 90) % 2;
    // Una llama por tobera, de núcleo blanco a borde naranja, que se afina a saltos.
    let largo = viajando ? 13 + parpadeo * 2 : 4 + parpadeo;
    if (this.tramo?.turbo) largo += 10;
    const borde = this.tramo?.turbo ? '#3ad6c5' : '#ff8a3c';
    const fondoDeLaNave = y + alto - 2 * ESCALA_NAVE;
    for (const columna of TOBERAS) {
      const centro = x + (columna + 0.5) * ESCALA_NAVE;
      for (let i = 0; i < largo; i++) {
        const t = i / largo;
        const ancho2 = Math.max(1, Math.round((1 - t) * 2.5)) * ESCALA_NAVE;
        c.fillStyle = t < 0.25 ? '#fff6cf' : t < 0.55 ? '#ffe066' : borde;
        c.fillRect(Math.round(centro - ancho2 / 2), fondoDeLaNave + i * ESCALA_NAVE, ancho2, ESCALA_NAVE);
      }
    }
    c.drawImage((this.dorada ? this.naveDorada : this.nave).lienzo, x, y, ancho, alto);
    if (!viajando) this.dibujarLucesDeNavegacion(x, y, ahora);
  }

  /** Luces en la punta de las alas que parpadean mientras la nave espera. */
  private dibujarLucesDeNavegacion(x: number, y: number, ahora: number): void {
    if (this.movimientoReducido || Math.floor(ahora / 600) % 3 !== 0) return;
    const c = this.contexto;
    const fila = 22 * ESCALA_NAVE;
    c.fillStyle = '#ff5d73';
    c.fillRect(x + 1 * ESCALA_NAVE, y + fila, ESCALA_NAVE, ESCALA_NAVE);
    c.fillStyle = '#8ff0a4';
    c.fillRect(x + (this.nave.ancho - 2) * ESCALA_NAVE, y + fila, ESCALA_NAVE, ESCALA_NAVE);
  }

  /**
   * La nave del amigo va al costado de la tuya, más arriba si va ganando. Si quedó lejos,
   * tapada por los carteles o fuera de la pantalla, una flecha al lado de tu nave dice
   * para qué lado está y por cuántos puntos.
   */
  private dibujarFantasma(visibles: number, naveY: number, ahora: number): void {
    const c = this.contexto;
    const puntos = this.puntosDelFantasma(ahora);
    const sprite = this.naveFantasma;
    const ancho = sprite.ancho * ESCALA_NAVE;
    const alto = sprite.alto * ESCALA_NAVE;
    const centroX = Math.round(this.ancho / 2 + Math.min(150, this.ancho * 0.3));
    const centroY = naveY - (puntos - visibles) * PIXELES_POR_PUNTO;
    const diferencia = Math.round(puntos - visibles);
    const lejosArriba = centroY < naveY - DISTANCIA_VISIBLE_DEL_FANTASMA;
    const lejosAbajo = centroY > this.alto - alto / 2;

    if (centroY > -alto && centroY < this.alto + alto) {
      const x = Math.round(centroX - ancho / 2);
      const y = Math.round(centroY - alto / 2);
      const viajando = this.fantasma !== null && ahora - this.fantasma.inicio < DURACION_DEL_FANTASMA;
      c.save();
      c.globalAlpha = 0.72;
      if (viajando) {
        c.fillStyle = COLOR_DEL_FANTASMA;
        for (const columna of TOBERAS) {
          const centro = Math.round(x + columna * ESCALA_NAVE);
          for (let i = 0; i < 9; i += 2) c.fillRect(centro, y + alto - 2 * ESCALA_NAVE + i * ESCALA_NAVE, ESCALA_NAVE, ESCALA_NAVE);
        }
      }
      c.drawImage(sprite.lienzo, x, y, ancho, alto);
      c.restore();
      if (!lejosArriba && !lejosAbajo) {
        c.font = `18px ${FUENTE}`;
        c.textAlign = 'center';
        c.fillStyle = COLOR_DEL_FANTASMA;
        c.fillText('Tu amigo', centroX, y + alto + 18);
      }
    }

    if (!lejosArriba && !lejosAbajo) return;
    const y = lejosArriba ? naveY - 52 : naveY + 40;
    c.fillStyle = COLOR_DEL_FANTASMA;
    // Una flecha escalonada de 4 renglones, apuntando hacia donde está.
    for (let i = 0; i < 4; i++) {
      const fila = lejosArriba ? i : 3 - i;
      c.fillRect(centroX - (i + 1) * 2, y + fila * 2, (i + 1) * 4, 2);
    }
    c.font = `20px ${FUENTE}`;
    c.textAlign = 'center';
    c.fillText(`Tu amigo ${diferencia > 0 ? '+' : ''}${diferencia}`, centroX, lejosArriba ? y + 26 : y - 6);
  }
}

/** El borde derecho y el de abajo de lo que ocupan los carteles en pantalla. */
function medirCarteles(carteles: HTMLElement): { right: number; bottom: number } | null {
  let right = -Infinity;
  let bottom = -Infinity;
  for (const hijo of Array.from(carteles.children)) {
    const caja = hijo.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) continue;
    right = Math.max(right, caja.right);
    bottom = Math.max(bottom, caja.bottom);
  }
  return Number.isFinite(right) ? { right, bottom } : null;
}
