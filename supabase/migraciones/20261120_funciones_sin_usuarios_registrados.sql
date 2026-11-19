-- Aplicada el 2026-11-19. Supabase da permiso a los usuarios registrados sobre las funciones nuevas;
-- el juego no tiene cuentas, así que sólo las llama el servidor (rol anon, con la clave secreta).
revoke execute on function public.api_banco(text) from authenticated;
revoke execute on function public.api_cargar_banco(text, jsonb) from authenticated;
revoke execute on function public.api_permitir(text, text, int, int) from authenticated;
revoke execute on function public.api_porcentajes(text, text) from authenticated;
