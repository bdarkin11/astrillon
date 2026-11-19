import '@fontsource/jersey-15/400.css';
import './estilos.css';
import CONSIGNAS from './datos/consignas-publicas.json';
import { pedirPorcentajes, pedirRespuestas, registrarPartida, reportarSenalPerdida, textoDePorcentaje, validarEnServidor } from './juego/api';
import type { PartidaRegistrada, Porcentajes, RespuestaDeLista } from './juego/api';
import type { Validacion } from './juego/validar';
import { mezclar } from './juego/azar';
import { consignasDelDia, fechaDeHoy, fechaLegible, fechasDelArchivo, numeroDeViaje } from './juego/diario';
import {
  CLAVE_DEL_LINK,
  codificarDesafio,
  desafioDelLink,
  desafioDeViaje,
  leerDesafio,
  puntosAntesDe,
  puntosDelFantasma,
  totalDelDesafio,
  veredicto,
} from './juego/desafio';
import type { Desafio } from './juego/desafio';
import { bitacora, cantidadDeConsignas, respuestaMasRara, textoParaCompartir } from './juego/final';
import type { EntradaBitacora } from './juego/final';
import { MODOS } from './juego/modos';
import type { Modo } from './juego/modos';
import { NIVELES_ORDENADOS } from './juego/niveles';
import { Partida } from './juego/partida';
import type { ResultadoConsigna } from './juego/partida';
import { percentilEstimado } from './juego/percentil';
import {
  aGuardada,
  calcularRacha,
  CLAVE_DEL_PROGRESO,
  guardarProgreso,
  leerProgreso,
  registrarViaje,
  restaurarResultados,
} from './juego/progreso';
import type { Almacen, Novedades, ViajeDelDia } from './juego/progreso';
import { contenidoDelAtlas } from './pantallas/atlas';
import { contenidoDePrivacidad } from './pantallas/privacidad';
import { boton, el } from './ui';
import {
  aLaParada,
  avanceDelTramo,
  formatearDistancia,
  nombreEnFrase,
  paradaActual,
  paradasEntre,
  proximaParada,
  recorridoMillonesKm,
} from './juego/ruta';
import { copilotoElegido } from './juego/copilotos';
import type { Pose } from './juego/copilotos';
import { Chispas } from './viaje/chispas';
import { CopilotoEnPantalla } from './viaje/copiloto';
import { crearBotonDeSonido, Sonido } from './viaje/sonido';
import { COREOGRAFIAS } from './viaje/coreografia';
import { anguloDelBarrido, dibujarRadar, enPeligro, LADO_DEL_RADAR } from './viaje/radar';
import { Escena } from './viaje/escena';

const SEGUNDOS_URGENTES = 5;
const FILAS_DEL_ARCHIVO = 30;
/** El viaje del día siempre se juega con las reglas del modo principal, para que todos compitan igual. */
const MODO_DIARIO = MODOS[0];

const app = document.querySelector<HTMLElement>('#app')!;
const escena = new Escena(document.querySelector<HTMLCanvasElement>('#espacio')!);
let detenerReloj: (() => void) | null = null;

function abrirAlmacen(): Almacen | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const almacen = abrirAlmacen();
const progreso = leerProgreso(almacen);
/** La fecha del viaje del día en curso, o null si es un viaje libre. */
let fechaDelViaje: string | null = null;
/** El desafío del viaje en curso, si un amigo mandó uno para esa fecha. */
let desafioEnCurso: Desafio | null = null;
let temporizadorDelFantasma = 0;

/** Un link con desafío se guarda para su fecha y se limpia de la barra, así no se vuelve a leer al recargar. */
function recibirDesafio(): string | null {
  const desafio = desafioDelLink(location.hash, fechaDeHoy());
  if (location.hash.includes(CLAVE_DEL_LINK)) history.replaceState(null, '', location.pathname + location.search);
  if (!desafio) return null;
  const codigo = codificarDesafio(desafio);
  const propio = progreso.dias[desafio.fecha];
  // Si abrís tu propio link, no te desafiás a vos mismo.
  if (propio?.terminado && codificarDesafio(desafioDeViaje(desafio.fecha, propio.respuestas)) === codigo) return null;
  progreso.desafios = { ...progreso.desafios, [desafio.fecha]: codigo };
  guardarProgreso(almacen, progreso);
  return desafio.fecha;
}

function desafioDe(fecha: string): Desafio | null {
  const codigo = progreso.desafios?.[fecha];
  return codigo ? leerDesafio(codigo, fechaDeHoy()) : null;
}

/** Las líneas del monitor de a bordo, que parpadean en cada cambio de pantalla. */
const monitor = el('div', 'monitor');
monitor.setAttribute('aria-hidden', 'true');
document.body.append(monitor);

/** Bordes rojos que laten cuando se acaba el tiempo. */
const bordeDePeligro = el('div', 'borde-peligro');
bordeDePeligro.setAttribute('aria-hidden', 'true');
document.body.append(bordeDePeligro);

const fechaDelDesafioRecibido = recibirDesafio();

const chispas = new Chispas();
const sonido = new Sonido();
crearBotonDeSonido(sonido);
const copiloto = new CopilotoEnPantalla(copilotoElegido(progreso.copiloto, calcularRacha(progreso, fechaDeHoy()).mejor), () => sonido.reproducir('toque'));
const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Dónde termina lo escrito en un campo de texto, para que las chispas salgan de ahí. */
const medidorDeTexto = document.createElement('canvas').getContext('2d')!;

function posicionDelCursor(entrada: HTMLInputElement): { x: number; y: number } {
  const rectangulo = entrada.getBoundingClientRect();
  const estilo = getComputedStyle(entrada);
  medidorDeTexto.font = `${estilo.fontSize} ${estilo.fontFamily}`;
  const ancho = medidorDeTexto.measureText(entrada.value).width;
  const x = rectangulo.left + parseFloat(estilo.paddingLeft) + ancho;
  return { x: Math.min(x, rectangulo.right - 8), y: rectangulo.top + 6 };
}

function parpadearMonitor(): void {
  monitor.classList.remove('parpadeo');
  void monitor.offsetWidth;
  monitor.classList.add('parpadeo');
}

/** Vuelve la nave y el copiloto a la plataforma, sin rastros del viaje anterior. */
function volverAPlataforma(pose: Pose): void {
  escena.reiniciar();
  copiloto.dorar(false);
  copiloto.ubicar(pose);
}

function mostrar(...elementos: HTMLElement[]): void {
  detenerReloj?.();
  detenerReloj = null;
  window.clearTimeout(temporizadorDelFantasma);
  escena.despejarNave(null);
  parpadearMonitor();
  app.replaceChildren(...elementos);
  window.scrollTo(0, 0);
}

function totalDe(viaje: ViajeDelDia): number {
  return viaje.respuestas.reduce((suma, r) => suma + r.puntos, 0);
}

function resumenDelViaje(viaje: ViajeDelDia): string {
  const total = totalDe(viaje);
  return `${paradaActual(total).nombre}, ${total} puntos`;
}

function pantallaInicio(): void {
  volverAPlataforma('inicio');
  const hoy = fechaDeHoy();
  const viaje = progreso.dias[hoy];
  const racha = calcularRacha(progreso, hoy).actual;

  const titulo = el('h1', 'titulo', 'Astrillón');
  const bajada = el('p', 'bajada', 'Cuanto más rara tu respuesta, más lejos viaja tu nave');
  const reto = panelDelDesafio();

  const panel = el('section', 'panel');
  const encabezado = el('h2', 'titulo-pantalla', `Viaje del día #${numeroDeViaje(hoy)}`);
  panel.append(encabezado, el('small', 'fecha', fechaLegible(hoy)));
  if (racha > 0) panel.append(el('p', 'racha', racha === 1 ? 'Racha de 1 día' : `Racha de ${racha} días`));

  let accion: HTMLButtonElement;
  if (viaje?.terminado) {
    panel.append(el('p', 'resultado-del-dia', `Hoy llegaste hasta ${resumenDelViaje(viaje)}.`));
    panel.append(el('small', 'fecha', 'El próximo sale a la medianoche, hora de Argentina.'));
    accion = boton('principal', 'Ver mi viaje', () => empezarViajeDelDia(hoy));
  } else if (viaje) {
    panel.append(el('p', 'resultado-del-dia', `Dejaste el viaje en ${resumenDelViaje(viaje)}.`));
    accion = boton('principal', 'Seguir viaje', () => empezarViajeDelDia(hoy));
  } else {
    panel.append(el('p', 'resultado-del-dia', `Las mismas consignas para todos, un solo intento. ${MODO_DIARIO.descripcion}`));
    accion = boton('principal', 'Despegar', () => empezarViajeDelDia(hoy));
  }
  const desafioDeHoy = !reto && !viaje?.terminado ? desafioDe(hoy) : null;
  if (desafioDeHoy) panel.append(el('p', 'aviso-desafio', `Corrés contra la nave de tu amigo, que llegó a ${totalDelDesafio(desafioDeHoy)} puntos.`));
  panel.append(accion);

  const navegacion = el('nav', 'navegacion');
  navegacion.append(
    boton('secundario', 'Viaje libre', pantallaLibre),
    boton('secundario', 'Archivo', () => pantallaArchivo()),
    boton('secundario', 'Atlas', pantallaAtlas),
  );
  panel.append(navegacion, boton('enlace', 'Privacidad', pantallaPrivacidad));

  mostrar(titulo, bajada, ...(reto ? [reto.panel] : []), panel);
  escena.despejarNave(app);
  (reto?.accion ?? accion).focus();
}

/** Si llegaste por el link de un amigo, la invitación a correr contra su nave va primero. */
function panelDelDesafio(): { panel: HTMLElement; accion: HTMLButtonElement } | null {
  const fecha = fechaDelDesafioRecibido;
  const desafio = fecha ? desafioDe(fecha) : null;
  if (!fecha || !desafio) return null;
  const total = totalDelDesafio(desafio);
  const viaje = progreso.dias[fecha];
  const panel = el('section', 'panel desafio');
  panel.append(
    el('h2', 'titulo-pantalla', 'Te desafiaron'),
    el('small', 'fecha', `Viaje del día #${numeroDeViaje(fecha)}, ${fechaLegible(fecha)}`),
    el('p', '', `Tu amigo llegó hasta ${nombreEnFrase(paradaActual(total))}, con ${total} puntos. Vas a ver su nave fantasma avanzar al lado de la tuya.`),
  );
  const texto = viaje?.terminado ? 'Ver quién llegó más lejos' : viaje ? 'Seguir contra su nave' : 'Aceptar el desafío';
  const accion = boton('principal', texto, () => empezarViajeDelDia(fecha));
  panel.append(accion);
  return { panel, accion };
}

/** Empieza, retoma o vuelve a mostrar el viaje de una fecha. Cada fecha tiene un solo intento. */
function empezarViajeDelDia(fecha: string): void {
  const guardado = progreso.dias[fecha];
  const previos = restaurarResultados(guardado?.respuestas ?? [], CONSIGNAS);
  fechaDelViaje = fecha;
  desafioEnCurso = desafioDe(fecha);
  if (!guardado) sonido.reproducir('despegar');
  escena.mostrarRuta();
  escena.saltarA(previos.reduce((suma, r) => suma + r.puntos, 0));
  if (desafioEnCurso) {
    escena.ponerFantasma(puntosAntesDe(desafioEnCurso, guardado?.terminado ? desafioEnCurso.pasos.length : previos.length));
  }
  if (previos.some((r) => r.puntos > 0 && r.nivel?.id === 'astrillon')) {
    escena.dorar();
    copiloto.dorar(true);
  }

  if (guardado?.terminado) {
    pantallaFinal(previos, MODO_DIARIO, fecha, null, undefined, guardado.pases ?? {});
    return;
  }
  if (!guardado) {
    progreso.dias[fecha] = { jugadoEn: fechaDeHoy(), respuestas: [], terminado: false };
    guardarProgreso(almacen, progreso);
  }
  pantallaConsigna(new Partida(consignasDelDia(fecha, CONSIGNAS), MODO_DIARIO, false, previos));
}

function guardarAvance(partida: Partida): void {
  const viaje = fechaDelViaje && progreso.dias[fechaDelViaje];
  if (!viaje) return;
  viaje.respuestas = partida.resultados.map(aGuardada);
  guardarProgreso(almacen, progreso);
}

/** Un número al azar para este navegador, sin datos personales: evita contar dos veces la misma partida. */
function identificadorDeJugador(): string {
  if (!progreso.jugador) {
    progreso.jugador = crypto.randomUUID();
    guardarProgreso(almacen, progreso);
  }
  return progreso.jugador;
}

function terminarViaje(partida: Partida): void {
  const novedades = registrarViaje(progreso, partida.resultados, partida.total);
  const viaje = fechaDelViaje && progreso.dias[fechaDelViaje];
  if (viaje) {
    viaje.respuestas = partida.resultados.map(aGuardada);
    viaje.terminado = true;
  }
  guardarProgreso(almacen, progreso);
  sonido.reproducir('final');
  const fecha = fechaDelViaje;
  const registrada = registrarPartida({
    jugador: identificadorDeJugador(),
    fecha,
    modo: partida.modo.id,
    jugadas: partida.resultados.map((r) => ({ consignaId: r.consigna.id, texto: r.respuesta?.nombre ?? null, turbo: r.turbo })),
  }).then((resultado) => {
    const delDia = fecha ? progreso.dias[fecha] : null;
    if (delDia) {
      if (resultado.percentil !== null) delDia.percentil = resultado.percentil;
      delDia.pases = resultado.pases;
      guardarProgreso(almacen, progreso);
    }
    return resultado;
  });
  pantallaFinal(partida.resultados, partida.modo, fecha, novedades, registrada);
}

function pantallaArchivo(filas = FILAS_DEL_ARCHIVO): void {
  volverAPlataforma('costado');
  const panel = el('section', 'panel');
  panel.append(el('h2', 'titulo-pantalla', 'Archivo'));
  const fechas = fechasDelArchivo(fechaDeHoy());

  if (fechas.length === 0) {
    panel.append(el('p', '', 'Todavía no hay viajes anteriores. El de hoy aparece acá a partir de mañana.'));
  } else {
    panel.append(el('small', 'fecha', 'Jugá los días que te perdiste. Tienen un solo intento y no suman a la racha.'));
    const lista = el('ul', 'lista-archivo');
    for (const fecha of fechas.slice(0, filas)) {
      const viaje = progreso.dias[fecha];
      const estado = viaje?.terminado ? resumenDelViaje(viaje) : viaje ? 'A medio viaje' : 'Sin jugar';
      const fila = boton('fila-archivo', '', () => empezarViajeDelDia(fecha));
      fila.append(el('span', '', `#${numeroDeViaje(fecha)}, ${fechaLegible(fecha)}`), el('small', '', estado));
      const item = el('li');
      item.append(fila);
      lista.append(item);
    }
    panel.append(lista);
    if (fechas.length > filas) {
      panel.append(boton('secundario', 'Ver más días', () => pantallaArchivo(filas + FILAS_DEL_ARCHIVO)));
    }
  }
  panel.append(boton('secundario', 'Volver al inicio', pantallaInicio));
  mostrar(panel);
}

function elegirCopiloto(id: string): void {
  progreso.copiloto = id;
  guardarProgreso(almacen, progreso);
  copiloto.cambiarPersonaje(copilotoElegido(id, calcularRacha(progreso, fechaDeHoy()).mejor));
  pantallaAtlas();
}

function pantallaAtlas(): void {
  volverAPlataforma('costado');
  const volver = boton('principal', 'Volver al inicio', pantallaInicio);
  const racha = calcularRacha(progreso, fechaDeHoy());
  const elegido = copilotoElegido(progreso.copiloto, racha.mejor).id;
  mostrar(...contenidoDelAtlas(progreso, racha, CONSIGNAS, { elegido, alElegir: elegirCopiloto }), volver);
}

function pantallaPrivacidad(): void {
  volverAPlataforma('costado');
  const panel = el('section', 'panel privacidad');
  panel.append(el('h2', 'titulo-pantalla', 'Privacidad'), ...contenidoDePrivacidad());
  let confirmando = false;
  const borrar = boton('secundario', 'Borrar mi progreso de este navegador', () => {
    if (!confirmando) {
      confirmando = true;
      borrar.textContent = 'Tocá de nuevo para borrar todo: no se puede deshacer';
      return;
    }
    try {
      almacen?.removeItem?.(CLAVE_DEL_PROGRESO);
    } catch {
      // Si el navegador no deja tocar el almacén, igual se recarga desde cero abajo.
    }
    location.reload();
  });
  panel.append(el('h3', 'titulo-seccion', 'Tus datos'), el('p', '', 'Podés borrar todo lo que el juego guardó en este navegador. Lo que ya llegó al servidor no tiene nada que lo vincule a vos.'), borrar, boton('principal', 'Volver al inicio', pantallaInicio));
  mostrar(panel);
}

function pantallaLibre(): void {
  volverAPlataforma('inicio');
  const panel = el('section', 'panel');
  panel.append(el('h2', 'titulo-pantalla', 'Viaje libre'));
  const principal = MODOS[0];
  const descripcion = el('p', 'descripcion-modo');
  const nombreModo = el('strong', '', principal.nombre);
  const textoModo = el('span', '', principal.descripcion);
  descripcion.append(nombreModo, textoModo);
  panel.append(descripcion);

  const radios = MODOS.map((modo, indice) => {
    const etiqueta = el('label', 'opcion');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'modo';
    radio.value = modo.id;
    radio.checked = indice === 0;
    radio.addEventListener('change', () => {
      nombreModo.textContent = modo.nombre;
      textoModo.textContent = modo.descripcion;
    });
    const texto = el('span', '', modo.nombre);
    texto.append(el('small', '', modo.descripcion));
    etiqueta.append(radio, texto);
    return { etiqueta, radio, modo };
  });
  const otros = el('details', 'otros-modos');
  otros.append(el('summary', '', 'Otros modos'), ...radios.map((r) => r.etiqueta));

  const opcionTurbo = el('label', 'opcion');
  const casilla = el('input');
  casilla.type = 'checkbox';
  const textoTurbo = el('span', '', 'Jugar con Turbo');
  textoTurbo.append(el('small', '', 'Duplica una consigna por viaje. Si no llegás a Cometa, vale 0.'));
  opcionTurbo.append(casilla, textoTurbo);

  const despegar = el('button', 'principal', 'Despegar');
  despegar.type = 'button';
  despegar.addEventListener('click', () => {
    const elegido = radios.find(({ radio }) => radio.checked)?.modo ?? principal;
    fechaDelViaje = null;
    desafioEnCurso = null;
    sonido.reproducir('despegar');
    escena.mostrarRuta();
    pantallaConsigna(new Partida(mezclar(CONSIGNAS, Math.random), elegido, casilla.checked));
  });

  panel.append(opcionTurbo, otros, despegar, boton('secundario', 'Volver al inicio', pantallaInicio));
  mostrar(panel);
  escena.despejarNave(app);
  despegar.focus();
}

/** `puntajeVisible` es el puntaje que se muestra: durante el viaje todavía no incluye la respuesta recién dada. */
function tablero(partida: Partida, numero: number, puntajeVisible = partida.total): HTMLElement {
  const { limiteConsignas, erroresParaTerminar } = partida.modo;
  const contenedor = el('header', 'tablero');

  const puntaje = el('p', 'puntaje');
  puntaje.append(el('span', 'puntaje-numero', String(puntajeVisible)), el('small', '', 'puntos'));
  const tramo = el('div', 'tramo');
  tramo.append(el('div'));
  const marcador = el('div', 'marcador');
  marcador.append(el('span', 'proxima'));
  marcador.append(el('span', '', limiteConsignas === null ? `Consigna ${numero}` : `Consigna ${numero} de ${limiteConsignas}`));
  if (erroresParaTerminar !== null) {
    marcador.append(el('span', '', `Errores ${partida.cantidadErrores} de ${erroresParaTerminar}`));
  }
  if (desafioEnCurso) {
    marcador.append(el('span', 'fantasma', `Tu amigo: ${puntosAntesDe(desafioEnCurso, partida.resultados.length)} pts`));
  }
  contenedor.append(el('p', 'lugar'), puntaje, el('p', 'recorrido'), tramo, marcador);
  actualizarUbicacion(contenedor, puntajeVisible);
  return contenedor;
}

/** Actualiza dónde está la nave. Se llama en cada cuadro del viaje, así que sólo toca lo que cambió. */
function actualizarUbicacion(contenedor: HTMLElement, puntos: number): void {
  const poner = (selector: string, texto: string) => {
    const elemento = contenedor.querySelector(selector);
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  };
  const proxima = proximaParada(puntos);
  poner('.lugar', `En ${nombreEnFrase(paradaActual(puntos))}`);
  poner('.recorrido', `Recorriste ${formatearDistancia(recorridoMillonesKm(puntos))}`);
  poner('.proxima', proxima ? `Próxima parada: ${proxima.nombre}` : 'Más allá de todo lo conocido');
  const relleno = contenedor.querySelector<HTMLElement>('.tramo > div');
  if (relleno) relleno.style.width = `${avanceDelTramo(puntos) * 100}%`;
}

/** Cuenta el puntaje hasta su nuevo valor. Con `golpe`, además salta al terminar. */
function animarPuntaje(contenedor: HTMLElement, desde: number, hasta: number, golpe: boolean): void {
  const numero = contenedor.querySelector<HTMLElement>('.puntaje-numero');
  if (!numero || desde === hasta) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    numero.textContent = String(hasta);
    return;
  }
  const inicio = performance.now();
  const duracion = golpe ? 900 : 500;
  const avanzar = (ahora: number) => {
    const t = Math.min(1, (ahora - inicio) / duracion);
    numero.textContent = String(Math.round(desde + (hasta - desde) * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(avanzar);
    else if (golpe) numero.classList.add('golpe');
  };
  requestAnimationFrame(avanzar);
}

function sacudirPaneles(): void {
  app.classList.remove('sacudida');
  void app.offsetWidth;
  app.classList.add('sacudida');
}

function pantallaConsigna(partida: Partida): void {
  const consigna = partida.consignaActual;
  if (!consigna) {
    terminarViaje(partida);
    return;
  }

  const panel = el('section', 'panel entra-rebotando');
  panel.append(el('h2', 'consigna', consigna.texto));

  const zonaDelReloj = el('div', 'zona-reloj');
  const radar = el('div', 'radar');
  const lienzoRadar = el('canvas');
  lienzoRadar.width = LADO_DEL_RADAR;
  lienzoRadar.height = LADO_DEL_RADAR;
  lienzoRadar.setAttribute('aria-hidden', 'true');
  const reloj = el('div', 'reloj');
  reloj.setAttribute('role', 'timer');
  radar.append(lienzoRadar, reloj);
  const barra = el('div', 'reloj-barra');
  const barraRelleno = el('div');
  barra.append(barraRelleno);
  zonaDelReloj.append(radar, barra);

  const formulario = el('form', 'entrada');
  const entrada = el('input');
  entrada.type = 'text';
  entrada.placeholder = 'Tu respuesta';
  entrada.setAttribute('aria-label', 'Tu respuesta');
  entrada.autocomplete = 'off';
  entrada.autocapitalize = 'off';
  entrada.spellcheck = false;
  entrada.maxLength = 80;
  const enviar = el('button', '', 'Enviar');
  enviar.type = 'submit';
  formulario.append(entrada, enviar);

  const aviso = el('p', 'aviso');
  aviso.setAttribute('aria-live', 'polite');

  panel.append(zonaDelReloj, formulario);

  let largoAnterior = 0;
  entrada.addEventListener('input', () => {
    if (entrada.value.length > largoAnterior) {
      const { x, y } = posicionDelCursor(entrada);
      chispas.tipear(x, y);
      sonido.reproducir('tecla');
    }
    largoAnterior = entrada.value.length;
  });

  if (partida.turboDisponible) {
    const botonTurbo = el('button', 'turbo', 'Activar Turbo ×2');
    botonTurbo.type = 'button';
    botonTurbo.addEventListener('click', () => {
      if (partida.activarTurbo()) {
        botonTurbo.textContent = 'Turbo encendido';
        botonTurbo.classList.add('encendido');
        botonTurbo.disabled = true;
      }
      entrada.focus();
    });
    panel.append(botonTurbo);
  }
  panel.append(aviso);

  copiloto.ubicar('consigna');
  const tableroDeLaConsigna = tablero(partida, partida.numeroActual);
  mostrar(tableroDeLaConsigna, panel);
  const inicioDeLaConsigna = performance.now();
  programarFantasma(partida, tableroDeLaConsigna);

  let esperandoAlServidor = false;
  let tiempoAgotado = false;

  const cerrarPorTiempo = () => {
    partida.agotarTiempo();
    void viajarYMostrarResultado(partida);
  };

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!entrada.value.trim() || esperandoAlServidor) return;

    const escrito = entrada.value.trim();
    esperandoAlServidor = true;
    enviar.disabled = true;
    let validacion: Validacion;
    try {
      validacion = await validarEnServidor(consigna.id, escrito);
    } catch {
      esperandoAlServidor = false;
      enviar.disabled = false;
      if (tiempoAgotado) {
        cerrarPorTiempo();
        return;
      }
      aviso.className = 'aviso error';
      aviso.textContent = 'Se cortó la señal con el servidor. Probá enviar de nuevo.';
      entrada.focus();
      return;
    }
    esperandoAlServidor = false;
    enviar.disabled = false;

    const cerradasAntes = partida.resultados.length;
    const segundos = Math.min(partida.segundosActuales, Math.round((performance.now() - inicioDeLaConsigna) / 100) / 10);
    partida.aplicar(escrito, validacion, segundos);
    if (partida.resultados.length > cerradasAntes) {
      if (partida.resultados[partida.resultados.length - 1].respuesta) {
        const { left, right, top } = entrada.getBoundingClientRect();
        chispas.enviar(left, right, top);
        sonido.reproducir('enviar');
      }
      void viajarYMostrarResultado(partida);
    } else if (validacion.tipo === 'correccion') {
      entrada.value = validacion.sugerencia.nombre;
      largoAnterior = entrada.value.length;
      aviso.className = 'aviso correccion';
      aviso.textContent = `¿Quisiste decir "${validacion.sugerencia.nombre}"? Enviá de nuevo para confirmar, o corregila.`;
      entrada.focus();
    } else {
      aviso.className = 'aviso error';
      aviso.textContent = `"${escrito}" no está en la lista. Probá con otra.`;
      formulario.classList.remove('rechazo');
      void formulario.offsetWidth;
      formulario.classList.add('rechazo');
      sonido.reproducir('rechazo');
      entrada.select();
    }
  });

  entrada.focus();
  iniciarReloj({
    segundos: partida.segundosActuales,
    zona: zonaDelReloj,
    reloj,
    barraRelleno,
    lienzoRadar,
    alAgotarse: () => {
      // Si la respuesta ya salió, se espera al servidor: la demora de la red no le cuesta al jugador.
      if (esperandoAlServidor) {
        tiempoAgotado = true;
        return;
      }
      cerrarPorTiempo();
    },
  });
}

/** El fantasma arranca la consigna donde terminó la anterior y avanza en el segundo en que su dueño respondió. */
function programarFantasma(partida: Partida, contenedor: HTMLElement): void {
  const desafio = desafioEnCurso;
  if (!desafio) return;
  const indice = partida.resultados.length;
  const paso = desafio.pasos[indice];
  if (!paso || paso.puntos === 0) return;
  temporizadorDelFantasma = window.setTimeout(() => {
    const puntos = puntosDelFantasma(desafio, indice, paso.segundos);
    escena.moverFantasma(puntos);
    const etiqueta = contenedor.querySelector('.fantasma');
    if (etiqueta) etiqueta.textContent = `Tu amigo: ${puntos} pts`;
  }, paso.segundos * 1000);
}

/** Saca los paneles para que se vea la nave moverse (o temblar) y después muestra qué pasó. */
async function viajarYMostrarResultado(partida: Partida): Promise<void> {
  const resultado = partida.resultados[partida.resultados.length - 1];
  guardarAvance(partida);
  // Si respondiste antes que tu amigo, su nave completa la consigna mientras viajás.
  if (desafioEnCurso) escena.moverFantasma(puntosAntesDe(desafioEnCurso, partida.resultados.length));

  // El cartel de la consigna se va hacia arriba mientras la nave arranca.
  const saliente = el('section', 'panel saliendo');
  saliente.append(el('h2', 'consigna', resultado.consigna.texto));
  const tableroDelViaje = tablero(partida, partida.resultados.length, partida.total - resultado.puntos);
  mostrar(tableroDelViaje, saliente);
  copiloto.ubicar('viaje');

  if (resultado.puntos > 0 && resultado.nivel && resultado.respuesta) {
    const esJoya = resultado.nivel.id === 'astrillon';
    // Con la joya primero se asombra, y festeja recién al llegar.
    copiloto.reaccionar(esJoya ? 'nebulosa' : resultado.nivel.id);
    sonido.reproducir(`viaje-${resultado.nivel.id}`);
    await escena.viajarA({
      puntos: partida.total,
      turbo: resultado.turbo,
      nivel: resultado.nivel.id,
      respuesta: resultado.respuesta.nombre,
      alProgreso: (puntos) => actualizarUbicacion(tableroDelViaje, puntos),
      alCruzarLinea: () => sonido.reproducir('linea'),
    });
    sonido.reproducir(`llegada-${resultado.nivel.id}`);
    if (esJoya) {
      copiloto.dorar(true);
      copiloto.reaccionar('astrillon');
    }
  } else {
    copiloto.reaccionar('error');
    sonido.reproducir('error');
    await escena.temblar();
  }
  pantallaResultado(partida);
}

interface OpcionesReloj {
  segundos: number;
  zona: HTMLElement;
  reloj: HTMLElement;
  barraRelleno: HTMLElement;
  lienzoRadar: HTMLCanvasElement;
  alAgotarse: () => void;
}

/**
 * Cuenta contra una hora de fin, para que el tiempo no se estire si el navegador se traba.
 * El intervalo manda sobre el tiempo, porque sigue andando con la pestaña oculta;
 * el dibujo del radar va aparte, sólo para que el barrido se vea suave.
 */
function iniciarReloj({ segundos, zona, reloj, barraRelleno, lienzoRadar, alAgotarse }: OpcionesReloj): void {
  const total = segundos * 1000;
  const fin = performance.now() + total;
  const contexto = lienzoRadar.getContext('2d')!;
  let animacion = 0;
  let ultimoSegundo = 0;

  const dibujar = (ahora: number) => {
    const restante = fin - ahora;
    const urgente = Math.ceil(restante / 1000) <= SEGUNDOS_URGENTES;
    dibujarRadar(contexto, restante / total, urgente, movimientoReducido ? null : anguloDelBarrido(ahora, urgente));
    animacion = requestAnimationFrame(dibujar);
  };

  const actualizar = () => {
    const restante = fin - performance.now();
    if (restante <= 0) {
      alAgotarse();
      return;
    }
    const quedan = Math.ceil(restante / 1000);
    if (enPeligro(restante) && quedan !== ultimoSegundo) sonido.reproducir('tic');
    ultimoSegundo = quedan;
    reloj.textContent = String(quedan);
    zona.classList.toggle('urgente', quedan <= SEGUNDOS_URGENTES);
    bordeDePeligro.classList.toggle('activo', enPeligro(restante));
    barraRelleno.style.width = `${(restante / total) * 100}%`;
  };

  const intervalo = window.setInterval(actualizar, 100);
  detenerReloj = () => {
    window.clearInterval(intervalo);
    cancelAnimationFrame(animacion);
    bordeDePeligro.classList.remove('activo');
  };
  actualizar();
  animacion = requestAnimationFrame(dibujar);
}

function listarNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** La parada a la que se acaba de llegar, con las que se pasaron en el camino. */
function bloqueDeParadas(resultado: ResultadoConsigna, total: number): HTMLElement | null {
  const alcanzadas = paradasEntre(total - resultado.puntos, total);
  const ultima = alcanzadas[alcanzadas.length - 1];
  if (!ultima) return null;

  const bloque = el('div', 'parada');
  bloque.append(el('h3', '', `Llegaste ${aLaParada(ultima)}`), el('p', '', ultima.dato));
  if (alcanzadas.length > 1) {
    const anteriores = alcanzadas.slice(0, -1).map(nombreEnFrase);
    bloque.append(el('small', 'apagado', `En el camino pasaste por ${listarNombres(anteriores)}.`));
  }
  return bloque;
}

/** Si el juego rechazó algo que era válido, el jugador lo avisa y queda anotado para revisarlo. */
function botonSenalPerdida(consignaId: string, texto: string): HTMLElement {
  const contenedor = el('div', 'senal-perdida');
  const estado = el('p', 'apagado');
  estado.setAttribute('aria-live', 'polite');
  const reportar = boton('secundario', 'Señal perdida: mi respuesta era válida', () => {
    reportar.disabled = true;
    estado.textContent = 'Enviando...';
    reportarSenalPerdida(consignaId, texto).then(
      () => {
        reportar.remove();
        estado.textContent = `Anotado. Vamos a revisar "${texto}".`;
      },
      () => {
        reportar.disabled = false;
        estado.textContent = 'No se pudo enviar. Probá de nuevo.';
      },
    );
  });
  contenedor.append(reportar, estado);
  return contenedor;
}

function pantallaResultado(partida: Partida): void {
  const resultado = partida.resultados[partida.resultados.length - 1];
  const panel = el('section', 'panel entra-rebotando');
  const coreografia = resultado.nivel && resultado.puntos > 0 ? COREOGRAFIAS[resultado.nivel.id] : null;
  if (coreografia) {
    panel.style.setProperty('--color-nivel', coreografia.color);
    panel.classList.add('con-nivel');
  } else {
    panel.classList.add('sin-senal');
  }

  if (resultado.nivel && resultado.respuesta) {
    panel.append(
      el('p', `nivel nivel-${resultado.nivel.id}`, resultado.nivel.nombre),
      el('p', 'respuesta-dada', `"${resultado.respuesta.nombre}"`),
      el('p', 'puntos', textoPuntos(resultado)),
      el('p', '', resultado.turbo && resultado.puntos === 0 ? 'El Turbo falló: esta respuesta no llegó a Cometa.' : resultado.nivel.frase),
    );
    if (resultado.respuesta.dato) panel.append(el('p', 'dato', resultado.respuesta.dato));
    panel.append(lineaDelResto(resultado.consigna.id, resultado.respuesta.nombre));
  } else {
    const causa = resultado.intentoFallido === null
      ? 'Se acabó el tiempo.'
      : `Se acabó el tiempo. Lo último que probaste, "${resultado.intentoFallido}", no está en la lista.`;
    panel.append(
      el('p', 'nivel', 'Sin señal'),
      el('p', 'puntos', '+0 puntos'),
      el('p', '', resultado.turbo ? `${causa} El Turbo se perdió.` : causa),
    );
    if (resultado.intentoFallido !== null) panel.append(botonSenalPerdida(resultado.consigna.id, resultado.intentoFallido));
    const { erroresParaTerminar } = partida.modo;
    if (erroresParaTerminar !== null) {
      panel.append(el('p', '', `Error ${partida.cantidadErrores} de ${erroresParaTerminar}.`));
    }
  }

  const paradas = bloqueDeParadas(resultado, partida.total);
  if (paradas) panel.append(paradas);

  const seguir = el('button', 'principal', partida.terminada ? 'Ver hasta dónde llegaste' : 'Seguir viaje');
  seguir.type = 'button';
  seguir.addEventListener('click', () => pantallaConsigna(partida));
  panel.append(seguir);

  const tableroFinal = tablero(partida, partida.resultados.length, partida.total - resultado.puntos);
  actualizarUbicacion(tableroFinal, partida.total);
  copiloto.ubicar('resultado');
  mostrar(tableroFinal, panel);
  seguir.focus();
  animarPuntaje(tableroFinal, partida.total - resultado.puntos, partida.total, coreografia?.golpeDePuntaje ?? false);
  if (!coreografia || coreografia.sacudidaAlLlegar > 0) sacudirPaneles();
}

/**
 * "El 3% de los viajeros dijo lo mismo". Queda vacía hasta que el servidor tenga suficientes
 * respuestas de esa consigna, o si no contesta: el jugador no se entera de que faltaba.
 */
function lineaDelResto(consignaId: string, nombre: string): HTMLElement {
  const linea = el('p', 'del-resto');
  linea.setAttribute('aria-live', 'polite');
  pedirPorcentajes(consignaId, { respuesta: nombre }).then(
    (porcentajes) => {
      const tuya = porcentajes?.respuestas.find((r) => r.nombre === nombre);
      if (tuya) linea.textContent = `${textoDePorcentaje(tuya.porcentaje)} de los viajeros dijo lo mismo.`.replace(/^./, (l) => l.toUpperCase());
    },
    () => undefined,
  );
  return linea;
}

function textoPuntos(resultado: ResultadoConsigna): string {
  const turbo = resultado.turbo && resultado.puntos > 0 ? ' con Turbo' : '';
  return `+${resultado.puntos} puntos${turbo}`;
}

function detalleConsigna({ resultado, emoji, paradas }: EntradaBitacora, pases: Promise<Record<string, string>>): HTMLElement {
  const detalle = el('details', 'consigna-final');
  const resumen = el('summary');
  resumen.append(
    el('span', 'texto-consigna', resultado.consigna.texto),
    el('span', resultado.nivel ? `nivel-${resultado.nivel.id}` : '', `${emoji} ${resultado.respuesta?.nombre ?? resultado.intentoFallido ?? 'Sin respuesta'}`),
    el('span', 'pts', `${resultado.puntos}${resultado.turbo ? ' (Turbo)' : ''}`),
  );
  const ultimaParada = paradas[paradas.length - 1];
  if (ultimaParada) resumen.append(el('span', 'llegada', `Llegaste ${aLaParada(ultimaParada)}`));

  const listado = el('div', 'respuestas');
  let pedidas = false;
  // Las respuestas viven en el servidor: se piden recién cuando el jugador abre la consigna.
  detalle.addEventListener('toggle', () => {
    if (!detalle.open || pedidas) return;
    pedidas = true;
    listado.replaceChildren(el('p', '', 'Cargando respuestas...'));
    const id = resultado.consigna.id;
    void pases.then((todos) => {
      const pase = todos[id];
      if (!pase) {
        pedidas = false;
        listado.replaceChildren(el('p', '', 'Las respuestas de este viaje no están disponibles: se ven al terminar un viaje con conexión.'));
        return;
      }
      Promise.all([pedirRespuestas(id, pase), pedirPorcentajes(id, { pase }).catch(() => null)]).then(
        ([respuestas, porcentajes]) => pintarRespuestas(listado, respuestas, resultado.respuesta?.nombre ?? null, porcentajes),
        () => {
          pedidas = false;
          listado.replaceChildren(el('p', '', 'No se pudieron cargar. Cerrala y abrila para reintentar.'));
        },
      );
    });
  });

  detalle.append(resumen, listado);
  return detalle;
}

function pintarRespuestas(listado: HTMLElement, respuestas: RespuestaDeLista[], tuya: string | null, porcentajes: Porcentajes | null): void {
  listado.replaceChildren();
  const porcentajeDe = new Map(porcentajes?.respuestas.map((r) => [r.nombre, r.porcentaje]));
  if (porcentajes) listado.append(el('p', 'apagado', `Entre paréntesis, qué porcentaje de ${porcentajes.muestras} viajeros dio cada una.`));
  for (const nivel of NIVELES_ORDENADOS) {
    const delNivel = respuestas.filter((r) => r.nivel === nivel.id);
    if (delNivel.length === 0) continue;
    listado.append(el('h3', `nivel-${nivel.id}`, `${nivel.nombre}, ${nivel.puntos}`));
    const parrafo = el('p');
    delNivel.forEach((respuesta, indice) => {
      if (indice > 0) parrafo.append(', ');
      const porcentaje = porcentajeDe.get(respuesta.nombre);
      const texto = porcentaje === undefined ? respuesta.nombre : `${respuesta.nombre} (${textoDePorcentaje(porcentaje)})`;
      parrafo.append(respuesta.nombre === tuya ? el('span', 'tuya', texto) : texto);
    });
    listado.append(parrafo);
    if (nivel.id === 'astrillon') {
      const joya = delNivel.find((respuesta) => respuesta.dato);
      if (joya?.dato) listado.append(el('p', 'dato', joya.dato));
    }
  }
}

/** En el celular abre el menú de compartir del sistema; en la compu, copia directamente. */
async function compartir(texto: string, aviso: HTMLElement): Promise<void> {
  if (window.matchMedia('(pointer: coarse)').matches && navigator.share) {
    try {
      await navigator.share({ text: texto });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    aviso.className = 'aviso correccion';
    aviso.textContent = 'Copiado. Ya lo podés pegar donde quieras.';
  } catch {
    aviso.className = 'aviso error';
    aviso.textContent = 'No se pudo copiar. Seleccioná el texto de arriba y copialo a mano.';
  }
}

function textoDeNovedades({ paradas, joyas, record }: Novedades): string {
  const partes: string[] = [];
  if (record) partes.push('Es tu viaje más lejano.');
  if (paradas > 0) partes.push(paradas === 1 ? 'Sumaste 1 parada a tu atlas.' : `Sumaste ${paradas} paradas a tu atlas.`);
  if (joyas > 0) partes.push(joyas === 1 ? 'Encontraste 1 joya nueva.' : `Encontraste ${joyas} joyas nuevas.`);
  return partes.join(' ');
}

function pintarComparacionReal(elemento: HTMLElement, percentil: number): void {
  elemento.textContent = percentil > 0 ? `Llegaste más lejos que el ${Math.min(percentil, 99)}% de los viajes.` : 'Es el comienzo: todos los demás viajes llegaron igual o más lejos.';
}

function pintarComparacionEstimada(elemento: HTMLElement, total: number, modo: Modo): void {
  const percentil = percentilEstimado(total, modo);
  elemento.replaceChildren();
  if (percentil <= 0) return;
  elemento.textContent = `Llegaste más lejos que el ${Math.min(percentil, 99)}% de los viajes simulados.`;
  elemento.append(el('small', '', 'Es una estimación: todavía no hay suficientes viajes reales para comparar.'));
}

function bloqueDelDesafio(tuyo: number, desafio: Desafio): HTMLElement {
  const delAmigo = totalDelDesafio(desafio);
  const diferencia = Math.abs(tuyo - delAmigo);
  const titulos = { ganaste: '¡Ganaste el desafío!', perdiste: 'Tu amigo llegó más lejos', empate: 'Empate exacto' };
  const resultado = veredicto(tuyo, delAmigo);
  const bloque = el('div', `bloque-desafio ${resultado}`);
  bloque.append(
    el('h3', '', titulos[resultado]),
    el('p', '', `Vos: ${tuyo} puntos, hasta ${nombreEnFrase(paradaActual(tuyo))}. Tu amigo: ${delAmigo} puntos, hasta ${nombreEnFrase(paradaActual(delAmigo))}.`),
  );
  if (resultado !== 'empate') bloque.append(el('small', '', `Por ${diferencia} puntos.`));
  return bloque;
}

/** `novedades` es null cuando se vuelve a ver un viaje ya registrado. */
function pantallaFinal(
  resultados: ResultadoConsigna[],
  modo: Modo,
  fecha: string | null,
  novedades: Novedades | null,
  registrada?: Promise<PartidaRegistrada>,
  pasesGuardados: Record<string, string> = {},
): void {
  const total = resultados.reduce((suma, r) => suma + r.puntos, 0);
  const parada = paradaActual(total);

  const destino = el('section', 'destino');
  if (fecha) destino.append(el('p', 'numero-viaje', `Viaje del día #${numeroDeViaje(fecha)}`));
  destino.append(
    el('p', 'llegaste', parada.id === 'tierra' ? 'No saliste de' : 'Llegaste hasta'),
    el('h2', '', parada.nombre),
    el('p', 'tipo', parada.tipo),
  );

  const resumen = el('section', 'panel');
  resumen.append(
    el('p', 'total', `${total} puntos`),
    el('p', '', `En ${cantidadDeConsignas(resultados.length)} recorriste ${formatearDistancia(recorridoMillonesKm(total))}.`),
  );

  const masRara = respuestaMasRara(resultados);
  if (masRara?.nivel && masRara.respuesta) {
    const linea = el('p', 'mas-rara', 'Tu respuesta más rara: ');
    linea.append(el('span', `nivel-${masRara.nivel.id}`, `${masRara.respuesta.nombre}, ${masRara.nivel.nombre}`));
    resumen.append(linea);
  }

  const comparacion = el('p', 'comparacion');
  const guardado = fecha ? progreso.dias[fecha]?.percentil : undefined;
  if (guardado !== undefined) pintarComparacionReal(comparacion, guardado);
  else pintarComparacionEstimada(comparacion, total, modo);
  resumen.append(comparacion);
  // Mientras no haya respuesta, o si no hay conexión, queda la estimación.
  void registrada?.then(
    ({ percentil }) => {
      if (percentil !== null) pintarComparacionReal(comparacion, percentil);
    },
    () => undefined,
  );
  const desafio = fecha ? desafioDe(fecha) : null;
  if (desafio) resumen.append(bloqueDelDesafio(total, desafio));
  const textoNovedades = novedades ? textoDeNovedades(novedades) : '';
  if (textoNovedades) resumen.append(el('p', 'novedades', textoNovedades));
  resumen.append(el('p', 'dato', parada.dato));

  const origen = location.protocol === 'https:' ? location.origin : undefined;
  // En el viaje del día, el link lleva tu nave: quien lo abre corre contra vos.
  const url = origen && fecha ? `${origen}/#${CLAVE_DEL_LINK}=${codificarDesafio(desafioDeViaje(fecha, resultados))}` : origen;
  const hoy = fechaDeHoy();
  const texto = textoParaCompartir(resultados, total, {
    numero: fecha ? numeroDeViaje(fecha) : undefined,
    racha: fecha === hoy ? calcularRacha(progreso, hoy).actual : undefined,
    url,
    desafio: Boolean(origen && fecha),
  });
  const vistaPrevia = el('pre', 'texto-compartir', texto);
  const aviso = el('p', 'aviso');
  aviso.setAttribute('aria-live', 'polite');
  const botonCompartir = el('button', 'principal', 'Compartir viaje');
  botonCompartir.type = 'button';
  botonCompartir.addEventListener('click', () => void compartir(texto, aviso));
  const otra = fecha
    ? boton('secundario', 'Volver al inicio', pantallaInicio)
    : boton('secundario', 'Volver a despegar', pantallaLibre);
  resumen.append(vistaPrevia, botonCompartir, aviso, otra);

  const titulo = el('h3', 'titulo-bitacora', 'Bitácora del viaje');
  const ayuda = el('p', 'ayuda-respuestas', 'Tocá una consigna para ver todas sus respuestas');
  // Los pases llegan con la respuesta de terminar; si no llega, se usan los que ya estaban guardados.
  const pases = registrada ? registrada.then((r) => r.pases ?? pasesGuardados, () => pasesGuardados) : Promise.resolve(pasesGuardados);
  const detalles = bitacora(resultados).map((entrada) => detalleConsigna(entrada, pases));
  copiloto.ubicar('costado');
  mostrar(destino, resumen, titulo, ayuda, ...detalles);
  botonCompartir.focus();
}

pantallaInicio();

// En producción se registra el service worker, que hace instalable al juego. En desarrollo no,
// para que no quede guardada una versión vieja mientras se prueba.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
