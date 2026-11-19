-- Aplicada el 2026-11-19. Suma dos cosas al servidor:
--   1. api_porcentajes: cuántas veces se dio cada respuesta aceptada de una consigna,
--      para mostrar "qué dijo el resto" cuando haya suficientes partidas.
--   2. api_permitir: un límite de pedidos por minuto, contado por una huella de la IP
--      (un hash, nunca la IP en sí). Se enciende con ASTRILLON_LIMITES=si en Vercel.
-- Usa public.api_verificar, que ya existe desde la migración del paso 6.

create table public.limites (
  clave text not null check (char_length(clave) <= 80),
  ventana timestamptz not null,
  cuenta int not null default 1,
  primary key (clave, ventana)
);
create index limites_por_ventana on public.limites (ventana);
alter table public.limites enable row level security;
revoke all on public.limites from anon, authenticated;

create function public.api_permitir(p_secreto text, p_clave text, p_maximo int, p_segundos int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_ventana timestamptz := to_timestamp(floor(extract(epoch from now()) / p_segundos) * p_segundos);
  v_cuenta int;
begin
  perform public.api_verificar(p_secreto);
  insert into public.limites (clave, ventana) values (left(p_clave, 80), v_ventana)
  on conflict (clave, ventana) do update set cuenta = public.limites.cuenta + 1
  returning cuenta into v_cuenta;
  -- Las huellas no se guardan más de un día: el aviso de privacidad lo promete.
  delete from public.limites where ventana < now() - interval '1 day';
  return v_cuenta <= p_maximo;
end;
$$;

create function public.api_porcentajes(p_secreto text, p_consigna text) returns table (respuesta text, cuenta bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.api_verificar(p_secreto);
  return query
    select r.respuesta, r.cuenta
    from public.respuestas_dadas r
    where r.consigna_id = p_consigna and r.tipo = 'aceptada';
end;
$$;

revoke all on function public.api_permitir(text, text, int, int) from public;
revoke all on function public.api_porcentajes(text, text) from public;
grant execute on function public.api_permitir(text, text, int, int) to anon;
grant execute on function public.api_porcentajes(text, text) to anon;
