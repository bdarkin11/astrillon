import { conParametros } from '../src/servidor/http.js';
import { limitado } from '../src/servidor/limites.js';
import { respuestasDe } from '../src/servidor/logica.js';
import { registroEnSupabase } from '../src/servidor/supabase.js';

export const GET = limitado('respuestas', conParametros((parametros) => respuestasDe(parametros.get('consigna'), parametros.get('pase'), registroEnSupabase)));
