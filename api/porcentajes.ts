import { conParametros } from '../src/servidor/http.js';
import { limitado } from '../src/servidor/limites.js';
import { porcentajesDe } from '../src/servidor/logica.js';
import { registroEnSupabase } from '../src/servidor/supabase.js';

export const GET = limitado('porcentajes', conParametros((parametros) => porcentajesDe(parametros.get('consigna'), registroEnSupabase, { pase: parametros.get('pase'), respuesta: parametros.get('respuesta') ?? undefined })));
