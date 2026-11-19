import { conCuerpo } from '../src/servidor/http.js';
import { limitado } from '../src/servidor/limites.js';
import { responder } from '../src/servidor/logica.js';
import { registroEnSupabase } from '../src/servidor/supabase.js';

export const POST = limitado('responder', conCuerpo((cuerpo) => responder(cuerpo, registroEnSupabase)));
