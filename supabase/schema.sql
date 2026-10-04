-- Bluefin · esquema de base de datos para Supabase
-- Ejecútalo una vez en: Supabase → SQL Editor → New query → Run

-- ===== Tablas =====
create table if not exists public.categorias (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  nombre text not null,
  emoji text not null default '🏷️',
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  slot smallint check (slot between 0 and 7),
  orden integer not null default 0,
  primary key (user_id, id)
);

create table if not exists public.movimientos (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  clase text not null check (clase in ('fijo', 'variable', 'ingreso')),
  importe numeric(12, 2) not null check (importe > 0),
  categoria_id text not null,
  asunto text not null default '',
  fecha date not null,
  fijo_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists movimientos_fecha_idx on public.movimientos (user_id, fecha);

create table if not exists public.fijos (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  nombre text not null,
  importe numeric(12, 2) not null check (importe > 0),
  categoria_id text not null,
  dia smallint not null check (dia between 1 and 31),
  desde text not null,
  activo boolean not null default true,
  generados text[] not null default '{}',
  primary key (user_id, id)
);

create table if not exists public.ajustes (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  presupuesto numeric(12, 2)
);

-- ===== Seguridad: cada usuario solo ve y modifica sus propias filas =====
do $$
declare t text;
begin
  foreach t in array array['categorias', 'movimientos', 'fijos', 'ajustes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo_propietario" on public.%I', t);
    execute format(
      'create policy "solo_propietario" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ===== Tiempo real: avisar a los demás dispositivos de los cambios =====
do $$
declare t text;
begin
  foreach t in array array['categorias', 'movimientos', 'fijos', 'ajustes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
