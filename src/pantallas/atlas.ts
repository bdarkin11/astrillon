import { COPILOTOS, estaDesbloqueado } from '../juego/copilotos';
import type { Progreso } from '../juego/progreso';
import { RUTA } from '../juego/ruta';
import type { Parada } from '../juego/ruta';
import type { ConsignaPublica } from '../juego/tipos';
import { boton, el } from '../ui';
import { crearSpriteDeParada, crearSpriteDeRobot } from '../viaje/sprites';

const TAMANIO_DEL_MARCO = 72;
const dibujos = new Map<string, HTMLCanvasElement>();

function dibujoDe(parada: Parada): HTMLCanvasElement {
  let dibujo = dibujos.get(parada.id);
  if (!dibujo) {
    dibujo = crearSpriteDeParada(parada).lienzo;
    // Al doble, para que las lunas chicas se distingan; las grandes se achican para entrar en el marco.
    dibujo.style.width = `${Math.min(TAMANIO_DEL_MARCO, dibujo.width * 2)}px`;
    dibujos.set(parada.id, dibujo);
  }
  return dibujo;
}

function filaDeParada(parada: Parada, descubierta: boolean): HTMLElement {
  const fila = el('li', descubierta ? 'parada-atlas' : 'parada-atlas oculta');
  const marco = el('div', 'marco-parada');
  marco.append(dibujoDe(parada));
  const texto = el('div');
  if (descubierta) {
    texto.append(el('h3', '', parada.nombre), el('small', '', parada.tipo), el('p', '', parada.dato));
  } else {
    texto.append(el('h3', '', 'Sin descubrir'), el('small', '', `Se descubre al llegar a ${parada.puntos} puntos en un viaje`));
  }
  fila.append(marco, texto);
  return fila;
}

function seccionDeCopilotos(mejorRacha: number, elegido: string, alElegir: (id: string) => void): HTMLElement {
  const seccion = el('section', 'panel seccion-joyas');
  seccion.append(el('h2', 'titulo-pantalla', 'Copilotos'));
  const lista = el('ul', 'lista-copilotos');
  for (const copiloto of COPILOTOS) {
    const libre = estaDesbloqueado(copiloto, mejorRacha);
    const lienzo = el('canvas');
    lienzo.width = 32;
    lienzo.height = 32;
    lienzo.setAttribute('aria-hidden', 'true');
    lienzo.getContext('2d')!.drawImage(crearSpriteDeRobot('normal', copiloto.colores).lienzo, 0, 0);
    const item = el('li');
    if (libre) {
      const fila = boton(copiloto.id === elegido ? 'fila-copiloto elegido' : 'fila-copiloto', '', () => alElegir(copiloto.id));
      fila.setAttribute('aria-pressed', String(copiloto.id === elegido));
      fila.append(lienzo, el('span', '', copiloto.nombre), el('small', '', copiloto.id === elegido ? 'A bordo' : 'Elegir'));
      item.append(fila);
    } else {
      const fila = el('div', 'fila-copiloto bloqueado');
      fila.append(lienzo, el('span', '', 'Sin desbloquear'), el('small', '', `Con una racha de ${copiloto.racha} días`));
      item.append(fila);
    }
    lista.append(item);
  }
  seccion.append(lista);
  return seccion;
}

interface OpcionesDeCopiloto {
  elegido: string;
  alElegir: (id: string) => void;
}

/** Arma el contenido del atlas: estadísticas, paradas en orden de viaje, copilotos y joyas encontradas. */
export function contenidoDelAtlas(progreso: Progreso, racha: { actual: number; mejor: number }, consignas: readonly ConsignaPublica[], copiloto: OpcionesDeCopiloto): HTMLElement[] {
  const descubiertas = RUTA.filter((p) => p.id === 'tierra' || progreso.paradas.includes(p.id));
  const encontradas = consignas.filter((c) => progreso.joyas[c.id]);

  const estadisticas = el('dl', 'estadisticas');
  const filas: [string, string][] = [
    ['Paradas', `${descubiertas.length} de ${RUTA.length}`],
    ['Joyas', `${encontradas.length} de ${consignas.length}`],
    ['Viajes', String(progreso.viajes)],
    ['Mejor viaje', `${progreso.mejorTotal} puntos`],
    ['Racha', String(racha.actual)],
    ['Mejor racha', String(racha.mejor)],
  ];
  for (const [nombre, valor] of filas) {
    const grupo = el('div');
    grupo.append(el('dt', '', nombre), el('dd', '', valor));
    estadisticas.append(grupo);
  }
  const resumen = el('section', 'panel');
  resumen.append(el('h2', 'titulo-pantalla', 'Atlas'), estadisticas);

  const lista = el('ol', 'lista-atlas');
  lista.append(...RUTA.map((p) => filaDeParada(p, descubiertas.includes(p))));

  const joyas = el('section', 'panel seccion-joyas');
  joyas.append(el('h2', 'titulo-pantalla', 'Joyas encontradas'));
  if (encontradas.length === 0) {
    joyas.append(el('p', '', 'Cada consigna esconde una respuesta de 100 puntos. Encontrá una y queda guardada acá.'));
  } else {
    const listaJoyas = el('ul', 'lista-joyas');
    for (const consigna of encontradas) {
      const item = el('li');
      item.append(el('small', '', consigna.texto), el('span', 'nivel-astrillon', progreso.joyas[consigna.id]));
      listaJoyas.append(item);
    }
    joyas.append(listaJoyas);
  }
  return [resumen, seccionDeCopilotos(racha.mejor, copiloto.elegido, copiloto.alElegir), lista, joyas];
}
