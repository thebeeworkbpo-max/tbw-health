-- Funções de permissão: só usuários logados executam; visitante anônimo só consulta se falta o primeiro administrador.
revoke execute on function public.e_admin_tbw() from public, anon;
revoke execute on function public.papel_na_clinica(uuid) from public, anon;
revoke execute on function public.pode_ler(uuid) from public, anon;
revoke execute on function public.pode_editar(uuid) from public, anon;
revoke execute on function public.senha_trocada() from public, anon;
grant execute on function public.e_admin_tbw() to authenticated;
grant execute on function public.papel_na_clinica(uuid) to authenticated;
grant execute on function public.pode_ler(uuid) to authenticated;
grant execute on function public.pode_editar(uuid) to authenticated;
grant execute on function public.senha_trocada() to authenticated;
revoke execute on function public.precisa_primeiro_admin() from public;
grant execute on function public.precisa_primeiro_admin() to anon, authenticated;
