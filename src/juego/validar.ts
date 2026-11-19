import type { Consigna, Respuesta } from './tipos.js';

export type Validacion =
  | { tipo: 'aceptada'; respuesta: Respuesta }
  | { tipo: 'correccion'; sugerencia: Respuesta }
  | { tipo: 'rechazada' };

const ARTICULOS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo']);

/** Pasa a minúsculas y saca tildes, signos y espacios de más. "¡La Ñandú!" -> "la nandu". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Clave de comparación: texto normalizado, sin artículo inicial ni prefijos de la consigna. */
export function clave(texto: string, prefijos: string[] = []): string {
  let palabras = normalizar(texto).split(' ').filter(Boolean);
  const prefijosNormalizados = new Set(prefijos.map(normalizar));
  let cambio = true;
  while (cambio && palabras.length > 1) {
    cambio = false;
    if (ARTICULOS.has(palabras[0]) || prefijosNormalizados.has(palabras[0])) {
      palabras = palabras.slice(1);
      cambio = true;
    }
  }
  return palabras.join(' ');
}

/** Variantes en singular de una clave, para aceptar "uvas" como "uva". */
function variantes(texto: string): string[] {
  const resultado = [texto];
  if (texto.length > 3 && texto.endsWith('s')) resultado.push(texto.slice(0, -1));
  if (texto.length > 4 && texto.endsWith('es')) resultado.push(texto.slice(0, -2));
  return resultado;
}

/** Distancia de edición que cuenta inserciones, borrados, cambios y letras invertidas. */
export function distancia(a: string, b: string): number {
  const filas = a.length + 1;
  const columnas = b.length + 1;
  const d: number[][] = Array.from({ length: filas }, () => new Array<number>(columnas).fill(0));
  for (let i = 0; i < filas; i++) d[i][0] = i;
  for (let j = 0; j < columnas; j++) d[0][j] = j;
  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < columnas; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Cuántos errores se toleran según el largo: las palabras cortas exigen más precisión. */
function toleranciaPara(largo: number): number {
  if (largo <= 3) return 0;
  if (largo <= 8) return 1;
  return 2;
}

/** Todas las claves con las que se puede nombrar una respuesta. */
export function clavesDe(respuesta: Respuesta, prefijos: string[] = []): string[] {
  return [respuesta.nombre, ...respuesta.alias].map((texto) => clave(texto, prefijos));
}

export function validar(texto: string, consigna: Consigna): Validacion {
  const entrada = clave(texto, consigna.prefijos);
  if (!entrada) return { tipo: 'rechazada' };

  const candidatas = variantes(entrada);
  for (const respuesta of consigna.respuestas) {
    const claves = clavesDe(respuesta, consigna.prefijos);
    if (claves.some((k) => variantes(k).some((v) => candidatas.includes(v)))) {
      return { tipo: 'aceptada', respuesta };
    }
  }

  let mejor: Respuesta | null = null;
  let menorDistancia = Infinity;
  for (const respuesta of consigna.respuestas) {
    for (const k of clavesDe(respuesta, consigna.prefijos)) {
      const valor = distancia(entrada, k);
      if (valor <= toleranciaPara(k.length) && valor < menorDistancia) {
        mejor = respuesta;
        menorDistancia = valor;
      }
    }
  }
  if (mejor) return { tipo: 'correccion', sugerencia: mejor };

  const base = consigna.admiteVariedades ? respuestaBase(entrada, consigna) : null;
  return base ? { tipo: 'aceptada', respuesta: base } : { tipo: 'rechazada' };
}

/** La respuesta cuyo nombre más largo es el comienzo de lo escrito: "oso polar del norte" -> "oso polar". */
function respuestaBase(entrada: string, consigna: Consigna): Respuesta | null {
  let base: Respuesta | null = null;
  let largo = 0;
  for (const respuesta of consigna.respuestas) {
    for (const k of clavesDe(respuesta, consigna.prefijos)) {
      if (k.length > largo && entrada.startsWith(`${k} `)) {
        base = respuesta;
        largo = k.length;
      }
    }
  }
  return base;
}
