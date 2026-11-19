import { conCuerpo } from '../src/servidor/http.js';
import { limitado } from '../src/servidor/limites.js';
import { reportar } from '../src/servidor/logica.js';
import { registroEnSupabase } from '../src/servidor/supabase.js';

export const POST = limitado('reportar', conCuerpo((cuerpo) => reportar(cuerpo, registroEnSupabase)));
