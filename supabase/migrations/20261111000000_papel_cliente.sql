-- Perfil "cliente": acesso de leitura com a visão do cliente (sem telas internas da TBW).
alter table public.membros drop constraint if exists membros_papel_check;
alter table public.membros add constraint membros_papel_check check (papel in ('editor', 'leitura', 'cliente'));
