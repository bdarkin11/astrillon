import { conCuerpo } from '../src/servidor/http.js';
import { limitado } from '../src/servidor/limites.js';
import { terminar } from '../src/servidor/logica.js';
import { registroEnSupabase } from '../src/servidor/supabase.js';

export const POST = limitado('terminar', conCuerpo((cuerpo) => terminar(cuerpo, registroEnSupabase)));
