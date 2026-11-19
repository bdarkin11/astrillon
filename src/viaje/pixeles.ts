/**
 * Herramientas sobre mapas de píxeles escritos como texto: cada letra es un color y el punto es vacío.
 * Son funciones puras, para poder probarlas sin navegador.
 */

const VACIO = '.';

/**
 * Duplica la resolución con Scale2x (EPX): cada píxel pasa a ser cuatro, y las diagonales se suavizan
 * copiando el vecino que corresponde. Es el método clásico de los emuladores: suma detalle sin desenfocar.
 */
export function escalar2x(mapa: string[]): string[] {
  const alto = mapa.length;
  const ancho = mapa[0]?.length ?? 0;
  const en = (x: number, y: number) => (x < 0 || y < 0 || x >= ancho || y >= alto ? VACIO : mapa[y][x]);
  const salida: string[][] = Array.from({ length: alto * 2 }, () => new Array<string>(ancho * 2).fill(VACIO));
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const p = en(x, y);
      const a = en(x, y - 1);
      const b = en(x + 1, y);
      const c = en(x - 1, y);
      const d = en(x, y + 1);
      // El vacío nunca le gana a un píxel pintado: las figuras no se achican, sólo se rellenan las diagonales.
      const elegir = (candidato: string) => (candidato === VACIO && p !== VACIO ? p : candidato);
      salida[y * 2][x * 2] = elegir(c === a && c !== d && a !== b ? a : p);
      salida[y * 2][x * 2 + 1] = elegir(a === b && a !== c && b !== d ? b : p);
      salida[y * 2 + 1][x * 2] = elegir(d === c && d !== b && c !== a ? c : p);
      salida[y * 2 + 1][x * 2 + 1] = elegir(b === d && b !== a && d !== c ? d : p);
    }
  }
  return salida.map((fila) => fila.join(''));
}

/**
 * Arma un mapa simétrico a partir de su mitad izquierda, que incluye la columna central.
 * Del lado derecho cada letra se cambia por su versión en sombra: la luz viene desde la izquierda.
 */
export function espejar(mitad: string[], sombra: Record<string, string>): string[] {
  return mitad.map((fila) => {
    const derecha = [...fila.slice(0, -1)].reverse().map((letra) => sombra[letra] ?? letra);
    return fila + derecha.join('');
  });
}

export type Borde = 'luz' | 'sombra' | null;

/** Si el píxel está en el borde iluminado (arriba o izquierda) o en el de sombra (abajo o derecha). */
export function bordeDe(mapa: string[], x: number, y: number): Borde {
  const vacio = (dx: number, dy: number) => (mapa[y + dy]?.[x + dx] ?? VACIO) === VACIO;
  if (vacio(0, 1) || vacio(1, 0)) return 'sombra';
  if (vacio(0, -1) || vacio(-1, 0)) return 'luz';
  return null;
}
