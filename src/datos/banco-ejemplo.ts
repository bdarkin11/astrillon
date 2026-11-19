import type { Consigna } from '../juego/tipos.js';
import datos from './banco-ejemplo.json' with { type: 'json' };

/**
 * Un banco chico y ficticio, para las pruebas y para desarrollar sin el banco real.
 * El real no está en el repositorio: vive en Supabase y se carga con scripts/subir-banco.mjs.
 */
export const BANCO_DE_EJEMPLO = datos as Consigna[];
