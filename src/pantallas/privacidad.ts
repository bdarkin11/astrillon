import { el } from '../ui';

/**
 * Qué guarda el juego y dónde. Está escrito para que cualquiera lo entienda, sin jerga legal,
 * y tiene que cambiar si cambia lo que se guarda (src/servidor, src/juego/progreso.ts).
 */
const SECCIONES: [string, string[]][] = [
  [
    'Sin cuentas, sin publicidad',
    [
      'Para jugar no hace falta registrarse ni dar ningún dato personal. El juego no usa cookies ni muestra publicidad, y no comparte nada con otras empresas.',
    ],
  ],
  [
    'En tu navegador',
    [
      'Tu progreso (los viajes del día, la racha, el atlas, el copiloto elegido y los desafíos que recibiste) se guarda sólo en este navegador. Si borrás los datos del sitio, se pierde.',
      'También se guarda un número al azar que identifica a este navegador, para no contar dos veces el mismo viaje del día. No dice nada de vos.',
    ],
  ],
  [
    'En el servidor',
    [
      'Cada respuesta que mandás se guarda sin nada que la vincule a vos, para corregir las listas y, más adelante, mostrar qué porcentaje de viajeros dio cada una.',
      'Al terminar un viaje se guardan el puntaje, el modo, la fecha y el número al azar de tu navegador, para compararte con el resto.',
      'Si tocás "Señal perdida", se guarda la respuesta que reportaste.',
      'Para frenar abusos, el servidor puede contar cuántos pedidos llegan desde una misma conexión. Guarda una huella cifrada de la dirección IP, nunca la dirección en sí, que se borra pasado un día.',
      'El sitio está alojado en Vercel y los datos se guardan en Supabase, que como cualquier servidor web pueden registrar datos técnicos de cada visita.',
    ],
  ],
  [
    'Los links que compartís',
    [
      'El link de "Compartir viaje" lleva tus puntos y tus tiempos de cada consigna, para que tu amigo corra contra tu nave. No lleva tu nombre ni tus respuestas, y esa parte del link no llega al servidor.',
    ],
  ],
];

export function contenidoDePrivacidad(): HTMLElement[] {
  return SECCIONES.flatMap(([titulo, parrafos]) => [el('h3', 'titulo-seccion', titulo), ...parrafos.map((texto) => el('p', '', texto))]);
}
