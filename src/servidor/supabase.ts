import type { Consigna } from '../juego/tipos.js';
import type { Registro } from './logica.js';

// La dirección y la clave pública no son secretas: sin el secreto de abajo no alcanzan para nada.
const URL_DE_SUPABASE = 'https://swelhidyaazqefkzxuvt.supabase.co';
const CLAVE_PUBLICA = 'sb_publishable_c81XtYsDGl1AL4Tb75ZQyQ_0udFbfAG';
const TIEMPO_MAXIMO_MS = 2500;
/** El banco entero pesa unos 400 KB: se le da más tiempo, y se pide pocas veces. */
const TIEMPO_DEL_BANCO_MS = 8000;

function secreto(): string {
  const valor = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.ASTRILLON_API_SECRETO;
  if (!valor) throw new Error('Falta configurar ASTRILLON_API_SECRETO');
  return valor;
}

async function llamar<T>(funcion: string, parametros: Record<string, unknown>, tiempo = TIEMPO_MAXIMO_MS): Promise<T> {
  const respuesta = await fetch(`${URL_DE_SUPABASE}/rest/v1/rpc/${funcion}`, {
    method: 'POST',
    headers: { apikey: CLAVE_PUBLICA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secreto: secreto(), ...parametros }),
    signal: AbortSignal.timeout(tiempo),
  });
  if (!respuesta.ok) throw new Error(`Supabase respondió ${respuesta.status} en ${funcion}`);
  const texto = await respuesta.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

interface FilaDelBanco {
  id: string;
  texto: string;
  prefijos: string[] | null;
  admite_variedades: boolean;
  respuestas: Consigna['respuestas'];
}

export function consignaDeFila(fila: FilaDelBanco): Consigna {
  return {
    id: fila.id,
    texto: fila.texto,
    ...(fila.prefijos ? { prefijos: fila.prefijos } : {}),
    ...(fila.admite_variedades ? { admiteVariedades: true } : {}),
    respuestas: fila.respuestas,
  };
}

/** En desarrollo, vite.config.ts deja acá el banco del disco para no depender de la base. */
function bancoLocal(): Consigna[] | undefined {
  return (globalThis as { __ASTRILLON_BANCO_LOCAL__?: Consigna[] }).__ASTRILLON_BANCO_LOCAL__;
}

export const registroEnSupabase: Registro = {
  async banco() {
    const local = bancoLocal();
    if (local) return local;
    const filas = await llamar<FilaDelBanco[]>('api_banco', {}, TIEMPO_DEL_BANCO_MS);
    return (filas ?? []).map(consignaDeFila);
  },
  async respuesta(consignaId, respuesta, tipo) {
    await llamar('api_registrar_respuesta', { p_consigna: consignaId, p_respuesta: respuesta, p_tipo: tipo });
  },
  async reporte(consignaId, texto) {
    await llamar('api_reportar', { p_consigna: consignaId, p_texto: texto });
  },
  async partida({ jugador, fecha, modo, total, consignas }) {
    const filas = await llamar<{ percentil: number | null; muestras: number }[]>('api_registrar_partida', {
      p_jugador: jugador,
      p_fecha: fecha,
      p_modo: modo,
      p_total: total,
      p_consignas: consignas,
    });
    return filas[0] ?? { percentil: null, muestras: 0 };
  },
  async conteos(consignaId) {
    const filas = await llamar<{ respuesta: string; cuenta: number }[]>('api_porcentajes', { p_consigna: consignaId });
    return filas ?? [];
  },
};

/** Cuenta pedidos por huella y por ruta. Devuelve false si se pasó del máximo de la ventana. */
export async function permitirEnSupabase(clave: string, maximo: number, segundos: number): Promise<boolean> {
  return llamar<boolean>('api_permitir', { p_clave: clave, p_maximo: maximo, p_segundos: segundos });
}
