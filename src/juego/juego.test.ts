import { describe, expect, it } from 'vitest';
import { BANCO_DE_EJEMPLO as CONSIGNAS_PRUEBA } from '../datos/banco-ejemplo';
import { problemasDelBanco } from '../datos/revisar-banco';
import { MODOS, tiempoDecreciente } from './modos';
import { NIVELES } from './niveles';
import { calcularPuntos } from './partida';
import { Partida } from './partida-prueba';
import { clave, distancia, normalizar, validar } from './validar';

const consigna = (id: string) => {
  const encontrada = CONSIGNAS_PRUEBA.find((c) => c.id === id);
  if (!encontrada) throw new Error(`No existe la consigna ${id}`);
  return encontrada;
};

const modo = (id: string) => {
  const encontrado = MODOS.find((m) => m.id === id);
  if (!encontrado) throw new Error(`No existe el modo ${id}`);
  return encontrado;
};
const CLASICO = modo('clasico');

const nombreAceptado = (texto: string, id: string) => {
  const v = validar(texto, consigna(id));
  return v.tipo === 'aceptada' ? v.respuesta.nombre : null;
};

const nombreSugerido = (texto: string, id: string) => {
  const v = validar(texto, consigna(id));
  return v.tipo === 'correccion' ? v.sugerencia.nombre : null;
};

describe('normalización', () => {
  it('saca tildes, eñes, mayúsculas y signos', () => {
    expect(normalizar('  ¡GUANÁBANA!  ')).toBe('guanabana');
    expect(normalizar('Zampoña')).toBe('zampona');
    expect(normalizar('Bon-o-Bon')).toBe('bon o bon');
  });

  it('saca el artículo inicial, pero nunca la palabra entera', () => {
    expect(clave('La Luna')).toBe('luna');
    expect(clave('la')).toBe('la');
  });

  it('saca los prefijos de la consigna', () => {
    expect(clave('el río Nilo', ['rio'])).toBe('nilo');
  });
});

describe('validación', () => {
  it('acepta sin tildes, con artículo, en plural y por variante regional', () => {
    expect(nombreAceptado('sandia', 'fruta')).toBe('Sandía');
    expect(nombreAceptado('la luna', 'astro')).toBe('Luna');
    expect(nombreAceptado('uvas', 'fruta')).toBe('Uva');
    expect(nombreAceptado('fresa', 'fruta')).toBe('Frutilla');
    expect(nombreAceptado('río Nilo', 'rio')).toBe('Nilo');
    expect(nombreAceptado('Río de la Plata', 'rio')).toBe('De la Plata');
  });

  it('sugiere una corrección sin aceptarla directamente', () => {
    expect(nombreSugerido('manzanna', 'fruta')).toBe('Manzana');
    expect(nombreSugerido('naranaj', 'fruta')).toBe('Naranja');
    expect(nombreSugerido('guanabanna', 'fruta')).toBe('Guanábana');
  });

  it('exige precisión en las palabras muy cortas', () => {
    expect(validar('uba', consigna('fruta')).tipo).toBe('rechazada');
  });

  it('rechaza lo que no está en la lista y el texto vacío', () => {
    expect(validar('qwzxqw', consigna('fruta')).tipo).toBe('rechazada');
    expect(validar('   ', consigna('fruta')).tipo).toBe('rechazada');
    expect(validar('¿?', consigna('fruta')).tipo).toBe('rechazada');
  });

  it('cuenta las letras invertidas como un solo error', () => {
    expect(distancia('naranja', 'naranaj')).toBe(1);
  });
});

describe('banco de preguntas', () => {
  it('el banco de ejemplo cumple las mismas reglas que el real', () => {
    expect(problemasDelBanco(CONSIGNAS_PRUEBA)).toEqual([]);
  });

  it('detecta una consigna sin joya, una clave repetida y un id repetido', () => {
    const [fruta] = CONSIGNAS_PRUEBA;
    const sinJoya = { ...fruta, respuestas: fruta.respuestas.filter((r) => r.nivel !== 'astrillon') };
    const repetida = { ...fruta, id: 'otra', texto: 'Otra', respuestas: [...fruta.respuestas, { nombre: 'Kiwi', nivel: 'cometa' as const, alias: [] }] };
    const problemas = problemasDelBanco([sinJoya, repetida, { ...repetida, texto: 'Otra más' }]);
    expect(problemas).toContain('fruta: tiene 0 joyas y debe tener una');
    expect(problemas).toContain('otra: la clave "kiwi" está repetida');
    expect(problemas).toContain('id repetido: otra');
  });
});

describe('Turbo', () => {
  it('duplica de Cometa para arriba y anula por debajo', () => {
    expect(calcularPuntos(NIVELES.astrillon, true)).toBe(200);
    expect(calcularPuntos(NIVELES.cometa, true)).toBe(120);
    expect(calcularPuntos(NIVELES.satelite, true)).toBe(0);
    expect(calcularPuntos(NIVELES.vivo, true)).toBe(0);
    expect(calcularPuntos(NIVELES.satelite, false)).toBe(30);
  });

  it('se usa una sola vez y sólo afecta a la consigna en la que se activó', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, CLASICO, true);
    expect(partida.activarTurbo()).toBe(true);
    expect(partida.activarTurbo()).toBe(false);
    partida.responder('pitanga');
    expect(partida.total).toBe(200);
    partida.responder('miranda');
    expect(partida.total).toBe(300);
  });

  it('no está disponible si la partida es sin Turbo', () => {
    expect(new Partida(CONSIGNAS_PRUEBA, CLASICO, false).activarTurbo()).toBe(false);
  });

  it('se pierde si se acaba el tiempo', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, CLASICO, true);
    partida.activarTurbo();
    partida.agotarTiempo();
    expect(partida.total).toBe(0);
    expect(partida.turboEncendido).toBe(false);
    expect(partida.turboDisponible).toBe(false);
  });
});

describe('partida', () => {
  it('un rechazo o una corrección no cierran la consigna', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, CLASICO, false);
    partida.responder('qwzxqw');
    partida.responder('manzanna');
    expect(partida.numeroActual).toBe(1);
    partida.responder('manzana');
    expect(partida.numeroActual).toBe(2);
    expect(partida.total).toBe(10);
  });

  it('una partida perfecta sin Turbo suma 700', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, CLASICO, false);
    for (const c of CONSIGNAS_PRUEBA.slice(0, 7)) {
      const joya = c.respuestas.find((r) => r.nivel === 'astrillon');
      partida.responder(joya!.nombre);
    }
    expect(partida.terminada).toBe(true);
    expect(partida.total).toBe(700);
  });
});

describe('modos con errores', () => {
  it('el tiempo baja desde el 4.º acierto, de 25 a 7 segundos, y ahí se queda', () => {
    expect([0, 1, 2, 3, 4, 5, 11, 12, 13, 50].map(tiempoDecreciente)).toEqual([25, 25, 25, 25, 23, 21, 9, 7, 7, 7]);
  });

  it('sólo los aciertos bajan el tiempo: un error no lo cambia', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, modo('regresiva-dos-errores'), false);
    for (const respuesta of ['manzana', 'marte', 'mogul']) partida.responder(respuesta);
    expect(partida.segundosActuales).toBe(25);
    partida.agotarTiempo();
    expect(partida.segundosActuales).toBe(25);
    partida.responder('guitarra');
    expect(partida.aciertos).toBe(4);
    expect(partida.segundosActuales).toBe(23);
  });

  it('el modo principal es la cuenta regresiva con 2 errores', () => {
    expect(MODOS[0].id).toBe('regresiva-dos-errores');
  });

  it('una respuesta fuera de la lista no cierra la consigna ni cuenta como error', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, modo('dos-errores'), false);
    partida.responder('qwzxqw');
    partida.responder('zzzqqq');
    expect(partida.numeroActual).toBe(1);
    expect(partida.cantidadErrores).toBe(0);
    partida.responder('manzana');
    expect(partida.numeroActual).toBe(2);
    expect(partida.resultados[0].intentoFallido).toBeNull();
  });

  it('con 2 errores, quedarse sin tiempo dos veces termina la partida y anota el último intento', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, modo('dos-errores'), false);
    partida.responder('qwzxqw');
    partida.responder('zzzqqq');
    partida.agotarTiempo();
    expect(partida.resultados[0].intentoFallido).toBe('zzzqqq');
    expect(partida.terminada).toBe(false);
    partida.agotarTiempo();
    expect(partida.resultados[1].intentoFallido).toBeNull();
    expect(partida.cantidadErrores).toBe(2);
    expect(partida.terminada).toBe(true);
  });

  it('en cuenta regresiva, una respuesta mala deja seguir y quedarse sin tiempo termina', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, modo('regresiva'), false);
    partida.responder('qwzxqw');
    expect(partida.terminada).toBe(false);
    partida.agotarTiempo();
    expect(partida.terminada).toBe(true);
  });

  it('una sugerencia de corrección no cuenta como error', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, modo('regresiva'), false);
    partida.responder('manzanna');
    expect(partida.cantidadErrores).toBe(0);
    expect(partida.terminada).toBe(false);
    expect(partida.numeroActual).toBe(1);
  });

  it('una respuesta válida de pocos puntos con Turbo no cuenta como error', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, modo('regresiva'), true);
    partida.activarTurbo();
    partida.responder('manzana');
    expect(partida.total).toBe(0);
    expect(partida.terminada).toBe(false);
  });

  it('sin límite de consignas, la partida también termina si se acaban', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA.slice(0, 2), modo('regresiva'), false);
    partida.responder('manzana');
    partida.responder('marte');
    expect(partida.terminada).toBe(true);
    expect(partida.sinErroresRestantes).toBe(false);
  });

  it('en el clásico, el tiempo agotado no cuenta como error', () => {
    const partida = new Partida(CONSIGNAS_PRUEBA, CLASICO, false);
    partida.agotarTiempo();
    expect(partida.cantidadErrores).toBe(0);
    expect(partida.terminada).toBe(false);
  });
});

