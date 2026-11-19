-- Aplicada el 2026-11-19. El banco de respuestas (consignas, respuestas válidas y niveles) deja de estar
-- en el repositorio y pasa a vivir sólo acá. Lo lee el servidor del juego con api_banco y lo carga
-- scripts/subir-banco.mjs con api_cargar_banco; las dos piden ASTRILLON_API_SECRETO por api_verificar.
-- La tabla no tiene políticas de acceso: con la clave pública sola no se puede leer ni escribir.

create table public.banco (
  id text primary key check (char_length(id) <= 80),
  orden int not null,
  texto text not null,
  prefijos text[],
  admite_variedades boolean not null default false,
  respuestas jsonb not null check (jsonb_typeof(respuestas) = 'array'),
  actualizado timestamptz not null default now()
);
alter table public.banco enable row level security;
revoke all on public.banco from anon, authenticated;

create function public.api_banco(p_secreto text)
returns table (id text, texto text, prefijos text[], admite_variedades boolean, respuestas jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.api_verificar(p_secreto);
  return query
    select b.id, b.texto, b.prefijos, b.admite_variedades, b.respuestas
    from public.banco b
    order by b.orden;
end;
$$;

-- Reemplaza el banco entero en una sola transacción: lo que no viene en la lista se borra.
create function public.api_cargar_banco(p_secreto text, p_consignas jsonb) returns int
language plpgsql security definer set search_path = '' as $$
begin
  perform public.api_verificar(p_secreto);
  if jsonb_typeof(p_consignas) is distinct from 'array' or jsonb_array_length(p_consignas) = 0 then
    raise exception 'El banco llegó vacío' using errcode = '22023';
  end if;

  delete from public.banco
  where id not in (select c ->> 'id' from jsonb_array_elements(p_consignas) as c);

  insert into public.banco (id, orden, texto, prefijos, admite_variedades, respuestas, actualizado)
  select
    t.c ->> 'id',
    t.o::int,
    t.c ->> 'texto',
    case when t.c ? 'prefijos' then array(select jsonb_array_elements_text(t.c -> 'prefijos')) end,
    coalesce((t.c ->> 'admiteVariedades')::boolean, false),
    t.c -> 'respuestas',
    now()
  from jsonb_array_elements(p_consignas) with ordinality as t(c, o)
  on conflict (id) do update set
    orden = excluded.orden,
    texto = excluded.texto,
    prefijos = excluded.prefijos,
    admite_variedades = excluded.admite_variedades,
    respuestas = excluded.respuestas,
    actualizado = now();

  return jsonb_array_length(p_consignas);
end;
$$;

revoke all on function public.api_banco(text) from public;
revoke all on function public.api_cargar_banco(text, jsonb) from public;
grant execute on function public.api_banco(text) to anon;
grant execute on function public.api_cargar_banco(text, jsonb) to anon;
