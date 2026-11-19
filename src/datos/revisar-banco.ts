import { NIVELES } from '../juego/niveles.js';
import type { Consigna } from '../juego/tipos.js';
import { clavesDe, validar } from '../juego/validar.js';

/**
 * Lo que tiene que cumplir cualquier banco antes de jugarse o de subirse a la base.
 * Devuelve la lista de problemas: vacía si está todo bien.
 */
export function problemasDelBanco(consignas: Consigna[]): string[] {
  const problemas: string[] = [];
  const repetidos = (valores: string[]) => valores.filter((v, i) => valores.indexOf(v) !== i);
  for (const id of repetidos(consignas.map((c) => c.id))) problemas.push(`id repetido: ${id}`);
  for (const texto of repetidos(consignas.map((c) => c.texto))) problemas.push(`texto repetido: ${texto}`);
  for (const c of consignas) {
    const joyas = c.respuestas.filter((r) => r.nivel === 'astrillon').length;
    if (joyas !== 1) problemas.push(`${c.id}: tiene ${joyas} joyas y debe tener una`);
    for (const r of c.respuestas) if (!(r.nivel in NIVELES)) problemas.push(`${c.id}: ${r.nombre} tiene un nivel que no existe`);
    const claves = c.respuestas.flatMap((r) => [...new Set(clavesDe(r, c.prefijos))]);
    for (const k of new Set(repetidos(claves))) problemas.push(`${c.id}: la clave "${k}" está repetida`);
    for (const r of c.respuestas) {
      for (const nombre of [r.nombre, ...r.alias]) {
        const v = validar(nombre, c);
        if (v.tipo !== 'aceptada' || v.respuesta.nombre !== r.nombre) problemas.push(`${c.id}: "${nombre}" no se acepta como ${r.nombre}`);
      }
    }
  }
  return problemas;
}
