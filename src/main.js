import './style.css';
import { conectar, criarDb, downloads } from './supa.js';
import { iniciarApp } from './app.js';

const root = document.getElementById('root');
const CHAVE_CLINICA = 'tbw.clinica';
let supa = null;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function tela(titulo, corpo) {
  root.innerHTML = '<div class="auth"><header class="auth-hero"><div class="auth-logo"><img src="/marca/logo-tbw-branco.png" alt="TBW" width="302" height="109"><span class="health">HEALTH</span></div></header>' +
    '<main class="auth-body"><div class="auth-card"><h1>' + titulo + '</h1>' + corpo + '</div>' +
    '<p class="auth-claim">Precificação, CMV e CSV, planejamento orçamentário, DRE e fluxo de caixa da clínica em um só lugar.</p>' +
    '<p class="auth-foot">TBW BPO Financeiro · thebeework.com.br</p></main></div>';
}
function aviso(el, msg, ok) { const n = document.getElementById(el); if (n) { n.textContent = msg || ''; n.className = 'auth-msg' + (ok ? ' ok' : ''); } }

function carregando(msg) { tela('Carregando…', '<p class="note">' + esc(msg || 'Conectando à base da TBW Health.') + '</p><div class="skel"></div>'); }

async function telaLogin() {
  let primeiro = false;
  try { const { data } = await supa.rpc('precisa_primeiro_admin'); primeiro = data === true; } catch (e) { /* segue */ }
  tela('Entrar na plataforma',
    '<form id="f-login" class="stack" novalidate><label class="f">E-mail<input class="inp" id="l-email" type="email" autocomplete="username" required></label>' +
    '<label class="f">Senha<input class="inp" id="l-senha" type="password" autocomplete="current-password" required></label>' +
    '<button class="btn pri" type="submit" id="l-ok">Entrar</button><p id="l-msg" class="auth-msg" role="alert"></p></form>' +
    '<p class="note">Esqueceu a senha? Peça à TBW uma senha provisória nova.</p>' +
    (primeiro ? '<hr><p class="note">Nenhum administrador cadastrado ainda.</p><button class="btn" id="l-primeiro" type="button">Primeiro acesso da TBW</button>' : ''));
  document.getElementById('f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('l-email').value.trim(), senha = document.getElementById('l-senha').value;
    if (!email || !senha) return aviso('l-msg', 'Informe e-mail e senha.');
    document.getElementById('l-ok').disabled = true; aviso('l-msg', 'Entrando…', true);
    const { error } = await supa.auth.signInWithPassword({ email, password: senha });
    if (error) { document.getElementById('l-ok').disabled = false; return aviso('l-msg', /invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar: ' + error.message); }
    iniciar();
  });
  const b = document.getElementById('l-primeiro'); if (b) b.addEventListener('click', telaPrimeiroAcesso);
}

function telaPrimeiroAcesso() {
  tela('Primeiro acesso da TBW',
    '<p class="note">Cria o administrador da plataforma. Só funciona para o e-mail liberado na instalação e apenas enquanto não houver administrador.</p>' +
    '<form id="f-pa" class="stack" novalidate><label class="f">Nome<input class="inp" id="pa-nome" autocomplete="name" required></label>' +
    '<label class="f">E-mail<input class="inp" id="pa-email" type="email" autocomplete="username" required></label>' +
    '<label class="f">Senha (mínimo 8 caracteres)<input class="inp" id="pa-senha" type="password" autocomplete="new-password" minlength="8" required></label>' +
    '<button class="btn pri" type="submit" id="pa-ok">Criar administrador</button><p id="pa-msg" class="auth-msg" role="alert"></p></form><button class="btn ghost" id="pa-volta" type="button">Voltar ao login</button>');
  document.getElementById('pa-volta').addEventListener('click', telaLogin);
  document.getElementById('f-pa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('pa-nome').value.trim(), email = document.getElementById('pa-email').value.trim(), senha = document.getElementById('pa-senha').value;
    if (!nome || !email || senha.length < 8) return aviso('pa-msg', 'Preencha nome, e-mail e uma senha de pelo menos 8 caracteres.');
    document.getElementById('pa-ok').disabled = true; aviso('pa-msg', 'Criando…', true);
    try {
      const r = await fetch('/api/usuarios', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao: 'bootstrap', nome, email, senha }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || 'falha ' + r.status);
      const { error } = await supa.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      iniciar();
    } catch (err) { document.getElementById('pa-ok').disabled = false; aviso('pa-msg', 'Não foi possível criar: ' + err.message); }
  });
}

function telaTrocarSenha(obrigatoria) {
  tela(obrigatoria ? 'Defina sua senha' : 'Alterar senha',
    (obrigatoria ? '<p class="note">Você entrou com uma senha provisória. Escolha uma senha pessoal para continuar.</p>' : '') +
    '<form id="f-ts" class="stack" novalidate><label class="f">Nova senha (mínimo 8 caracteres)<input class="inp" id="ts-1" type="password" autocomplete="new-password" required></label>' +
    '<label class="f">Repita a nova senha<input class="inp" id="ts-2" type="password" autocomplete="new-password" required></label>' +
    '<button class="btn pri" type="submit" id="ts-ok">Salvar senha</button><p id="ts-msg" class="auth-msg" role="alert"></p></form>' +
    (obrigatoria ? '<button class="btn ghost" id="ts-sair" type="button">Sair</button>' : '<button class="btn ghost" id="ts-volta" type="button">Voltar à plataforma</button>'));
  const v = document.getElementById('ts-volta'); if (v) v.addEventListener('click', () => iniciar());
  const s = document.getElementById('ts-sair'); if (s) s.addEventListener('click', sair);
  document.getElementById('f-ts').addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = document.getElementById('ts-1').value, b = document.getElementById('ts-2').value;
    if (a.length < 8) return aviso('ts-msg', 'A senha precisa de pelo menos 8 caracteres.');
    if (a !== b) return aviso('ts-msg', 'As duas senhas não conferem.');
    document.getElementById('ts-ok').disabled = true;
    const { error } = await supa.auth.updateUser({ password: a });
    if (error) { document.getElementById('ts-ok').disabled = false; return aviso('ts-msg', 'Não foi possível salvar: ' + error.message); }
    await supa.rpc('senha_trocada');
    iniciar();
  });
}

async function sair() { try { await supa.auth.signOut(); } catch (e) { /* segue */ } location.hash = ''; location.reload(); }

async function api(corpo, rota) {
  const { data } = await supa.auth.getSession();
  const r = await fetch('/api/' + (rota || 'usuarios'), { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (data.session ? data.session.access_token : '') }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || 'falha ' + r.status);
  return j;
}

async function iniciar() {
  carregando();
  const { data: { session } } = await supa.auth.getSession();
  if (!session) return telaLogin();
  const uid = session.user.id;
  const { data: perfil, error: ep } = await supa.from('perfis').select('*').eq('user_id', uid).maybeSingle();
  if (ep || !perfil) return tela('Acesso não liberado', '<p class="note">Seu usuário ainda não tem perfil na plataforma. Fale com a TBW.</p><button class="btn" id="x-sair">Sair</button>'), document.getElementById('x-sair').addEventListener('click', sair);
  if (!perfil.ativo) return tela('Acesso desativado', '<p class="note">Seu acesso à plataforma está desativado. Fale com a TBW.</p><button class="btn" id="x-sair">Sair</button>'), document.getElementById('x-sair').addEventListener('click', sair);
  if (perfil.trocar_senha) return telaTrocarSenha(true);
  const [{ data: clinicas }, { data: membros }] = await Promise.all([
    supa.from('clinicas').select('*').order('nome'),
    supa.from('membros').select('*').eq('user_id', uid)
  ]);
  const ativas = (clinicas || []).filter((c) => c.ativo || perfil.tbw_admin);
  if (!ativas.length && !perfil.tbw_admin) return tela('Sem clínica vinculada', '<p class="note">Seu usuário ainda não está ligado a nenhuma clínica. Fale com a TBW.</p><button class="btn" id="x-sair">Sair</button>'), document.getElementById('x-sair').addEventListener('click', sair);
  let sel = null; try { sel = localStorage.getItem(CHAVE_CLINICA); } catch (e) { /* sem storage */ }
  if (!ativas.some((c) => c.id === sel)) sel = ativas.length ? ativas[0].id : null;
  const clinica = ativas.find((c) => c.id === sel) || null;
  const papel = perfil.tbw_admin ? 'admin' : ((membros || []).find((m) => m.clinica_id === sel) || {}).papel || 'leitura';
  root.innerHTML = '';
  iniciarApp(root, {
    supa, uid, perfil, clinicas: ativas, clinica, papel, api, dl: downloads,
    db: clinica ? criarDb(supa, clinica.id, uid) : null,
    canWrite: perfil.tbw_admin || papel === 'editor',
    isAdmin: !!perfil.tbw_admin,
    trocarClinica(id) { try { localStorage.setItem(CHAVE_CLINICA, id); } catch (e) { /* sem storage */ } location.hash = ''; location.reload(); },
    trocarSenha() { telaTrocarSenha(false); },
    sair
  });
}

(async () => {
  carregando();
  try { supa = await conectar(); }
  catch (e) { tela('Não foi possível conectar', '<p class="note">' + esc(e.message) + '</p><p class="note">Confira se o banco Supabase está ligado ao projeto na Vercel.</p>'); return; }
  supa.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { location.hash = ''; } });
  iniciar();
})();
