const SEGUNDOS_INICIALES = 25;
const SEGUNDOS_MINIMOS = 7;
const SEGUNDOS_MENOS_POR_ACIERTO = 2;
/** Los aciertos a tiempo completo: el tiempo empieza a bajar después del último de estos. */
const ACIERTOS_ANTES_DE_BAJAR = 3;

export interface Modo {
  id: string;
  nombre: string;
  descripcion: string;
  /** Con cuántas consignas sin acierto a tiempo termina la partida. Con null, quedarse sin tiempo no cuesta nada. */
  erroresParaTerminar: number | null;
  /** Cantidad fija de consignas. Con null, se sigue mientras queden. */
  limiteConsignas: number | null;
  /** Segundos de la próxima consigna, según cuántas respuestas correctas lleva el jugador. */
  segundosPara: (aciertos: number) => number;
}

const tiempoFijo = () => SEGUNDOS_INICIALES;

/** 25 segundos hasta la 4.ª respuesta correcta; desde ahí, cada acierto quita 2, hasta quedar en 7. */
export function tiempoDecreciente(aciertos: number): number {
  const aciertosQueDescuentan = Math.max(0, aciertos - ACIERTOS_ANTES_DE_BAJAR);
  return Math.max(SEGUNDOS_MINIMOS, SEGUNDOS_INICIALES - aciertosQueDescuentan * SEGUNDOS_MENOS_POR_ACIERTO);
}

/** El primero es el modo principal: es el que viene elegido al empezar. */
export const MODOS: Modo[] = [
  {
    id: 'regresiva-dos-errores',
    nombre: 'Cuenta regresiva con 2 errores',
    descripcion: 'Empezás con 25 segundos. Desde tu cuarto acierto, cada uno te quita 2, hasta llegar a 7. Si no está en la lista, probá otra. Quedarte sin tiempo es un error, y con 2 termina el viaje.',
    erroresParaTerminar: 2,
    limiteConsignas: null,
    segundosPara: tiempoDecreciente,
  },
  {
    id: 'clasico',
    nombre: '7 consignas',
    descripcion: '25 segundos cada una. Podés probar todas las que quieras mientras quede tiempo.',
    erroresParaTerminar: null,
    limiteConsignas: 7,
    segundosPara: tiempoFijo,
  },
  {
    id: 'dos-errores',
    nombre: 'Hasta 2 errores',
    descripcion: '25 segundos cada una. Si no está en la lista, probá otra. Quedarte sin tiempo es un error, y con 2 termina el viaje.',
    erroresParaTerminar: 2,
    limiteConsignas: null,
    segundosPara: tiempoFijo,
  },
  {
    id: 'regresiva',
    nombre: 'Cuenta regresiva',
    descripcion: 'Empezás con 25 segundos. Desde tu cuarto acierto, cada uno te quita 2, hasta llegar a 7. Si no está en la lista, probá otra. La primera vez que te quedás sin tiempo termina el viaje.',
    erroresParaTerminar: 1,
    limiteConsignas: null,
    segundosPara: tiempoDecreciente,
  },
];
