import { Partida as PartidaBase } from './partida';
import type { Consigna } from './tipos';
import { validar } from './validar';
import type { Validacion } from './validar';

/** Para los tests: una partida que valida en el momento, sin pasar por el servidor. */
export class Partida extends PartidaBase {
  responder(texto: string): Validacion {
    const consigna = this.consignaActual as Consigna | null;
    if (!consigna) return { tipo: 'rechazada' };
    const validacion = validar(texto, consigna);
    this.aplicar(texto, validacion);
    return validacion;
  }
}
