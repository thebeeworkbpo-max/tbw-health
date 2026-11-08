-- TBW Health · estrutura inicial (multi-clínica)
-- Cada clínica tem seus dados isolados em public.documentos (JSON por bloco), protegidos por RLS.
-- Papéis: administrador TBW (todas as clínicas) · editor (altera a clínica) · leitura (só consulta).

create extension if not exists pgcrypto;

create table if not exists public.clinicas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  tbw_admin boolean not null default false,
  ativo boolean not null default true,
  trocar_senha boolean not null default false,
  criado_em timestamptz not null default now()
);
create unique index if not exists perfis_email_idx on public.perfis (lower(email));

create table if not exists public.membros (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  user_id uuid not null references public.perfis(user_id) on delete cascade,
  papel text not null check (papel in ('editor', 'leitura')),
  criado_em timestamptz not null default now(),
  primary key (clinica_id, user_id)
);
create index if not exists membros_user_idx on public.membros (user_id);

create table if not exists public.documentos (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  path text not null check (path ~ '^[A-Za-z0-9_.:@+~-]+(/[A-Za-z0-9_.:@+~-]+)+$'),
  data jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null,
  primary key (clinica_id, path)
);

-- E-mails liberados para o primeiro acesso de administrador (preenchido na instalação, só a chave de serviço lê).
create table if not exists public.admins_iniciais (
  email text primary key check (email = lower(email))
);

-- ---------- Funções de permissão ----------
create or replace function public.e_admin_tbw()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where user_id = auth.uid() and tbw_admin and ativo);
$$;

create or replace function public.papel_na_clinica(c uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.papel from public.membros m join public.perfis p on p.user_id = m.user_id
  where m.clinica_id = c and m.user_id = auth.uid() and p.ativo;
$$;

create or replace function public.pode_ler(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.e_admin_tbw() or public.papel_na_clinica(c) is not null;
$$;

create or replace function public.pode_editar(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.e_admin_tbw() or coalesce(public.papel_na_clinica(c) = 'editor', false);
$$;

create or replace function public.precisa_primeiro_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.perfis where tbw_admin);
$$;

create or replace function public.senha_trocada()
returns void language sql security definer set search_path = public as $$
  update public.perfis set trocar_senha = false where user_id = auth.uid();
$$;

-- Perfil criado junto com o usuário de autenticação
create or replace function public.novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (user_id, email, nome)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

revoke execute on function public.novo_usuario() from public, anon, authenticated;
grant execute on function public.precisa_primeiro_admin() to anon, authenticated;
grant execute on function public.senha_trocada() to authenticated;

-- ---------- RLS ----------
alter table public.clinicas enable row level security;
alter table public.perfis enable row level security;
alter table public.membros enable row level security;
alter table public.documentos enable row level security;
alter table public.admins_iniciais enable row level security;

drop policy if exists clinicas_ler on public.clinicas;
create policy clinicas_ler on public.clinicas for select to authenticated using (public.pode_ler(id));
drop policy if exists clinicas_admin_ins on public.clinicas;
create policy clinicas_admin_ins on public.clinicas for insert to authenticated with check (public.e_admin_tbw());
drop policy if exists clinicas_admin_upd on public.clinicas;
create policy clinicas_admin_upd on public.clinicas for update to authenticated using (public.e_admin_tbw()) with check (public.e_admin_tbw());
drop policy if exists clinicas_admin_del on public.clinicas;
create policy clinicas_admin_del on public.clinicas for delete to authenticated using (public.e_admin_tbw());

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated using (user_id = auth.uid() or public.e_admin_tbw());
drop policy if exists perfis_admin_upd on public.perfis;
create policy perfis_admin_upd on public.perfis for update to authenticated using (public.e_admin_tbw()) with check (public.e_admin_tbw());

drop policy if exists membros_ler on public.membros;
create policy membros_ler on public.membros for select to authenticated using (user_id = auth.uid() or public.e_admin_tbw());
drop policy if exists membros_admin_ins on public.membros;
create policy membros_admin_ins on public.membros for insert to authenticated with check (public.e_admin_tbw());
drop policy if exists membros_admin_upd on public.membros;
create policy membros_admin_upd on public.membros for update to authenticated using (public.e_admin_tbw()) with check (public.e_admin_tbw());
drop policy if exists membros_admin_del on public.membros;
create policy membros_admin_del on public.membros for delete to authenticated using (public.e_admin_tbw());

drop policy if exists documentos_ler on public.documentos;
create policy documentos_ler on public.documentos for select to authenticated using (public.pode_ler(clinica_id));
drop policy if exists documentos_inserir on public.documentos;
create policy documentos_inserir on public.documentos for insert to authenticated with check (public.pode_editar(clinica_id));
drop policy if exists documentos_alterar on public.documentos;
create policy documentos_alterar on public.documentos for update to authenticated using (public.pode_editar(clinica_id)) with check (public.pode_editar(clinica_id));
drop policy if exists documentos_excluir on public.documentos;
create policy documentos_excluir on public.documentos for delete to authenticated using (public.pode_editar(clinica_id));

-- ---------- Tempo real ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documentos') then
    alter publication supabase_realtime add table public.documentos;
  end if;
end $$;
