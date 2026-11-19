import type { NivelId } from './niveles.js';

export interface Respuesta {
  nombre: string;
  nivel: NivelId;
  alias: string[];
  dato?: string;
}

/** Lo único que ve el navegador de una consigna: las respuestas quedan en el servidor. */
export interface ConsignaPublica {
  id: string;
  texto: string;
}

export interface Consigna extends ConsignaPublica {
  /** Palabras que el jugador puede anteponer sin que cambie la respuesta ("río Nilo"). */
  prefijos?: string[];
  /** Acepta una variedad de una respuesta: "oso polar" vale como "oso" si no figura aparte. */
  admiteVariedades?: boolean;
  respuestas: Respuesta[];
}
