import type { Modo } from './modos.js';
import { MINIMO_TURBO, NIVELES } from './niveles.js';
import type { Nivel } from './niveles.js';
import type { ConsignaPublica, Respuesta } from './tipos.js';
import type { Validacion } from './validar.js';

export interface ResultadoConsigna {
  consigna: ConsignaPublica;
  respuesta: Respuesta | null;
  nivel: Nivel | null;
  puntos: number;
  turbo: boolean;
  /** Lo último que escribió el jugador y no estaba en la lista, si la consigna se cerró sin acierto. */
  intentoFallido: string | null;
  /** Cuántos segundos tardó en cerrarse, para la nave fantasma de los desafíos. */
  segundos?: number;
}

/** El Turbo duplica una respuesta de Cometa o mejor; por debajo de eso, la consigna vale 0. */
export function calcularPuntos(nivel: Nivel, turbo: boolean): number {
  if (!turbo) return nivel.puntos;
  return nivel.puntos >= MINIMO_TURBO ? nivel.puntos * 2 : 0;
}

export class Partida {
  readonly resultados: ResultadoConsigna[];
  readonly modo: Modo;
  private errores: number;
  private turboUsado = false;
  private turboActivo = false;
  private ultimoRechazo: string | null = null;
  private readonly conTurbo: boolean;
  private readonly consignas: ConsignaPublica[];

  /** Con `previos`, retoma un viaje que quedó por la mitad. */
  constructor(consignas: ConsignaPublica[], modo: Modo, conTurbo: boolean, previos: ResultadoConsigna[] = []) {
    this.consignas = modo.limiteConsignas === null ? consignas : consignas.slice(0, modo.limiteConsignas);
    this.modo = modo;
    this.conTurbo = conTurbo;
    this.resultados = [...previos];
    this.errores = modo.erroresParaTerminar === null ? 0 : previos.filter((r) => r.respuesta === null).length;
  }

  get numeroActual(): number {
    return this.resultados.length + 1;
  }

  get segundosActuales(): number {
    return this.modo.segundosPara(this.aciertos);
  }

  get aciertos(): number {
    return this.resultados.filter((r) => r.respuesta !== null).length;
  }

  get cantidadErrores(): number {
    return this.errores;
  }

  get sinErroresRestantes(): boolean {
    return this.modo.erroresParaTerminar !== null && this.errores >= this.modo.erroresParaTerminar;
  }

  get consignaActual(): ConsignaPublica | null {
    if (this.sinErroresRestantes) return null;
    return this.consignas[this.resultados.length] ?? null;
  }

  get terminada(): boolean {
    return this.consignaActual === null;
  }

  get total(): number {
    return this.resultados.reduce((suma, r) => suma + r.puntos, 0);
  }

  get turboDisponible(): boolean {
    return this.conTurbo && !this.turboUsado;
  }

  get turboEncendido(): boolean {
    return this.turboActivo;
  }

  /** Enciende el Turbo para la consigna actual. Una vez encendido no se puede apagar. */
  activarTurbo(): boolean {
    if (!this.turboDisponible || this.terminada) return false;
    this.turboUsado = true;
    this.turboActivo = true;
    return true;
  }

  /**
   * Aplica lo que dijo el validador. Sólo una respuesta aceptada cierra la consigna: una que no
   * está en la lista no cuenta como error, y el jugador puede seguir probando mientras haya tiempo.
   */
  aplicar(texto: string, validacion: Validacion, segundos?: number): void {
    const consigna = this.consignaActual;
    if (!consigna) return;
    if (validacion.tipo === 'aceptada') {
      const nivel = NIVELES[validacion.respuesta.nivel];
      this.cerrar({
        consigna,
        respuesta: validacion.respuesta,
        nivel,
        puntos: calcularPuntos(nivel, this.turboActivo),
        turbo: this.turboActivo,
        intentoFallido: null,
        ...(segundos === undefined ? {} : { segundos }),
      });
    } else if (validacion.tipo === 'rechazada') {
      this.ultimoRechazo = texto;
    }
  }

  /** Quedarse sin tiempo es el único error. Si antes probó algo fuera de lista, queda anotado. */
  agotarTiempo(): void {
    const consigna = this.consignaActual;
    if (!consigna) return;
    const segundos = this.segundosActuales;
    if (this.modo.erroresParaTerminar !== null) this.errores += 1;
    this.cerrarSinPuntos(consigna, this.ultimoRechazo, segundos);
  }

  private cerrarSinPuntos(consigna: ConsignaPublica, intentoFallido: string | null, segundos: number): void {
    this.cerrar({
      consigna,
      respuesta: null,
      nivel: null,
      puntos: 0,
      turbo: this.turboActivo,
      intentoFallido,
      segundos,
    });
  }

  private cerrar(resultado: ResultadoConsigna): void {
    this.resultados.push(resultado);
    this.turboActivo = false;
    this.ultimoRechazo = null;
  }
}
