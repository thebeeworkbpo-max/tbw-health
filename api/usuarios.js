// Gestão de usuários (precisa da chave de serviço, por isso roda no servidor).
// Ações: bootstrap (primeiro administrador), criar, senha, ativo. Todas, exceto bootstrap, exigem administrador TBW.
import { createClient } from '@supabase/supabase-js';

const env = process.env;
const URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function corpo(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  if (!URL || !KEY) return res.status(500).json({ erro: 'Chave de serviço do Supabase ausente na Vercel (SUPABASE_SERVICE_ROLE_KEY).' });
  const adm = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const b = corpo(req);

  try {
    if (b.acao === 'bootstrap') {
      const email = String(b.email || '').trim().toLowerCase(), nome = String(b.nome || '').trim(), senha = String(b.senha || '');
      if (!EMAIL.test(email) || !nome || senha.length < 8) return res.status(400).json({ erro: 'Dados incompletos.' });
      const { data: jaTem } = await adm.from('perfis').select('user_id').eq('tbw_admin', true).limit(1);
      if (jaTem && jaTem.length) return res.status(403).json({ erro: 'A plataforma já tem administrador. Peça o acesso a ele.' });
      const { data: lib } = await adm.from('admins_iniciais').select('email').eq('email', email).maybeSingle();
      if (!lib) return res.status(403).json({ erro: 'Este e-mail não está liberado para o primeiro acesso.' });
      const { data: u, error } = await adm.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
      if (error) return res.status(400).json({ erro: error.message });
      await adm.from('perfis').upsert({ user_id: u.user.id, email, nome, tbw_admin: true, ativo: true, trocar_senha: false });
      return res.status(200).json({ ok: true });
    }

    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ erro: 'Sessão ausente. Entre de novo.' });
    const { data: quem, error: eq } = await adm.auth.getUser(token);
    if (eq || !quem || !quem.user) return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' });
    const { data: perfil } = await adm.from('perfis').select('tbw_admin, ativo').eq('user_id', quem.user.id).maybeSingle();
    if (!perfil || !perfil.tbw_admin || !perfil.ativo) return res.status(403).json({ erro: 'Só administradores TBW gerenciam usuários.' });

    if (b.acao === 'criar') {
      const email = String(b.email || '').trim().toLowerCase(), nome = String(b.nome || '').trim(), senha = String(b.senha || '');
      const tbw_admin = !!b.tbw_admin, papel = ['leitura', 'cliente'].includes(b.papel) ? b.papel : 'editor', clinica_id = b.clinica_id || null;
      if (!EMAIL.test(email) || !nome || senha.length < 8) return res.status(400).json({ erro: 'Informe nome, e-mail válido e senha com 8 caracteres ou mais.' });
      if (!tbw_admin && !clinica_id) return res.status(400).json({ erro: 'Escolha a clínica do usuário.' });
      let userId;
      const { data: existente } = await adm.from('perfis').select('user_id').eq('email', email).maybeSingle();
      if (existente) {
        userId = existente.user_id;
      } else {
        const { data: u, error } = await adm.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
        if (error) return res.status(400).json({ erro: error.message });
        userId = u.user.id;
        await adm.from('perfis').upsert({ user_id: userId, email, nome, tbw_admin, ativo: true, trocar_senha: true });
      }
      if (existente && tbw_admin) await adm.from('perfis').update({ tbw_admin: true }).eq('user_id', userId);
      if (!tbw_admin && clinica_id) {
        const { error: em } = await adm.from('membros').upsert({ user_id: userId, clinica_id, papel });
        if (em) return res.status(400).json({ erro: em.message });
      }
      return res.status(200).json({ ok: true, user_id: userId, existia: !!existente });
    }

    if (b.acao === 'senha') {
      const senha = String(b.senha || '');
      if (!b.user_id || senha.length < 8) return res.status(400).json({ erro: 'Senha com 8 caracteres ou mais.' });
      const { error } = await adm.auth.admin.updateUserById(b.user_id, { password: senha });
      if (error) return res.status(400).json({ erro: error.message });
      await adm.from('perfis').update({ trocar_senha: true }).eq('user_id', b.user_id);
      return res.status(200).json({ ok: true });
    }

    if (b.acao === 'ativo') {
      if (!b.user_id) return res.status(400).json({ erro: 'Usuário não informado.' });
      if (b.user_id === quem.user.id) return res.status(400).json({ erro: 'Você não pode desativar o próprio acesso.' });
      const ativo = !!b.ativo;
      const { error } = await adm.auth.admin.updateUserById(b.user_id, { ban_duration: ativo ? 'none' : '876000h' });
      if (error) return res.status(400).json({ erro: error.message });
      await adm.from('perfis').update({ ativo }).eq('user_id', b.user_id);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ erro: 'Ação desconhecida.' });
  } catch (e) {
    return res.status(500).json({ erro: (e && e.message) || 'Erro inesperado.' });
  }
}
