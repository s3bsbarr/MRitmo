-- MRitmo 1.9.1 · Amistades en vivo.
--
-- La app escucha cambios en `friendships` desde la 1.5 (solicitudes y
-- aceptaciones en el ranking), pero la tabla nunca se agregó a la publicación
-- de Supabase Realtime: esos cambios solo aparecían al recargar. La política
-- "see own friendships" ya limita cada evento a las dos personas de la amistad.
--
-- Idempotente.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
