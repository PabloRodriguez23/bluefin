-- Bluefin · conexión bancaria (Open Banking con Enable Banking)
-- Ejecútalo una vez en: Supabase → SQL Editor → New query → Run (después de schema.sql)

-- ===== Movimientos: saber cuáles vienen del banco =====
alter table public.movimientos add column if not exists origen text not null default 'manual'
  check (origen in ('manual', 'banco'));
alter table public.movimientos add column if not exists comercio text;
alter table public.movimientos add column if not exists ref_banco text;
create unique index if not exists movimientos_ref_banco_idx
  on public.movimientos (user_id, ref_banco) where ref_banco is not null;

-- ===== Bancos conectados =====
create table if not exists public.bancos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  session_id text not null,
  banco text not null,
  pais text not null,
  logo text,
  cuentas jsonb not null default '[]',
  valido_hasta timestamptz not null,
  ultima_sync timestamptz,
  error text,
  created_at timestamptz not null default now()
);
alter table public.bancos enable row level security;
-- El usuario solo puede ver sus conexiones; las crea y modifica la función del servidor
drop policy if exists "ver_propios" on public.bancos;
create policy "ver_propios" on public.bancos for select to authenticated
  using ((select auth.uid()) = user_id);

-- Estados temporales del proceso de autorización (solo los usa el servidor)
create table if not exists public.bancos_auth (
  state uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  banco text not null,
  pais text not null,
  logo text,
  volver_a text not null,
  created_at timestamptz not null default now()
);
alter table public.bancos_auth enable row level security;

-- ===== Reglas de categorización aprendidas =====
create table if not exists public.reglas (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  patron text not null,
  categoria_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, patron)
);
alter table public.reglas enable row level security;
drop policy if exists "solo_propietario" on public.reglas;
create policy "solo_propietario" on public.reglas for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Avisar a la app en tiempo real de cambios en las conexiones
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bancos'
  ) then
    alter publication supabase_realtime add table public.bancos;
  end if;
end $$;

-- ===== Traspasos entre cuentas propias / al ahorro (no son gasto ni ingreso) =====
alter table public.movimientos drop constraint if exists movimientos_clase_check;
alter table public.movimientos add constraint movimientos_clase_check
  check (clase in ('fijo', 'variable', 'ingreso', 'traspaso'));
alter table public.movimientos add column if not exists sentido text
  check (sentido in ('entrada', 'salida'));
