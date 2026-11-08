// Open Finance via Pluggy (agregador autorizado pelo Banco Central): extrato do Sicoob e da conta InfinitePay.
// Fica inativo até PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET serem cadastrados na Vercel.
// POST (usuário logado): status · token · vincular · sincronizar · desvincular
// GET  (rotina diária da Vercel, com CRON_SECRET): sincroniza todas as clínicas conectadas.
import { createClient } from '@supabase/supabase-js';
import { mesclaConta } from '../src/conexoes.js';

const env = process.env;
const URL_SB = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const PID = env.PLUGGY_CLIENT_ID, PSEC = env.PLUGGY_CLIENT_SECRET;
const PAPI = (env.PLUGGY_API_URL || 'https://api.pluggy.ai').replace(/\/+$/, '');
const DOC = 'conexoes/openfinance';
const r2 = (v) => Math.round(v * 100) / 100;

function corpo(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return req.body;
}
function falha(status, msg) { const e = new Error(msg); e.status = status; return e; }

let chave = null, chaveAte = 0;
async function pluggy(metodo, caminho, dados) {
  if (!chave || Date.now() > chaveAte) {
    const r = await fetch(PAPI + '/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: PID, clientSecret: PSEC }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.apiKey) throw falha(502, 'a Pluggy recusou as credenciais (' + r.status + ')');
    chave = j.apiKey; chaveAte = Date.now() + 90 * 60 * 1000; // a chave vale 2 h
  }
  const r = await fetch(PAPI + '/' + caminho, { method: metodo, headers: { 'content-type': 'application/json', 'X-API-KEY': chave }, body: dados ? JSON.stringify(dados) : undefined });
  if (r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw falha(502, 'Pluggy: ' + ((j && (j.message || j.error)) || 'erro ' + r.status));
  return j;
}

async function lerDoc(adm, clinica, path) {
  const { data, error } = await adm.from('documentos').select('data').eq('clinica_id', clinica).eq('path', path).maybeSingle();
  if (error) throw falha(500, error.message);
  return data ? data.data : null;
}
async function gravarDoc(adm, clinica, path, data) {
  const { error } = await adm.from('documentos').upsert({ clinica_id: clinica, path, data, atualizado_em: new Date().toISOString() });
  if (error) throw falha(500, error.message);
}

function hojeSP() { return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10); }
function inicioMeses(meses) { const h = hojeSP(); const d = new Date(Date.UTC(+h.slice(0, 4), +h.slice(5, 7) - 1 - (meses - 1), 1)); return d.toISOString().slice(0, 10); }
function mesesEntre(ini, fim) { const o = []; let y = +ini.slice(0, 4), m = +ini.slice(5, 7); const fy = +fim.slice(0, 4), fm = +fim.slice(5, 7); while (y < fy || (y === fy && m <= fm)) { o.push(y + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } } return o; }
function ultimoDia(k) { const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0)); return d.toISOString().slice(0, 10); }

async function transacoes(contaId, ini, fim) {
  const lista = []; let after = null, voltas = 0;
  do {
    const q = new URLSearchParams({ accountId: contaId, dateFrom: ini, dateTo: fim }); if (after) q.set('after', after);
    const p = await pluggy('GET', 'v2/transactions?' + q.toString());
    lista.push(...(p.results || []));
    after = p.next ? new URL(p.next, PAPI).searchParams.get('after') : null;
  } while (after && ++voltas < 60);
  return lista;
}

export async function sincronizarClinica(adm, clinica, meses) {
  const cfg = (await lerDoc(adm, clinica, DOC)) || { itens: [] };
  const ini = inicioMeses(Math.min(12, Math.max(1, meses || 3))), fim = hojeSP(), ks = mesesEntre(ini, fim), agora = new Date().toISOString();
  const porMes = {}; let nContas = 0, nLanc = 0; const avisos = [];
  for (const it of cfg.itens || []) {
    let item;
    try { item = await pluggy('GET', 'items/' + it.id); } catch (e) { avisos.push((it.conector || 'instituição') + ': ' + e.message); continue; }
    it.status = item.status; it.conector = (item.connector && item.connector.name) || it.conector;
    if (item.status === 'LOGIN_ERROR' || item.status === 'OUTDATED') avisos.push(it.conector + ': consentimento expirado, reconecte');
    const contas = await pluggy('GET', 'accounts?itemId=' + encodeURIComponent(it.id));
    it.contas = [];
    for (const ac of (contas.results || []).filter((a) => a.type === 'BANK')) {
      const num = String(ac.number || '').replace(/[^0-9A-Za-z]/g, '');
      const chaveC = 'of-' + (num.slice(-14) || String(ac.id).slice(0, 12));
      const nome = it.conector + (ac.subtype === 'SAVINGS_ACCOUNT' ? ' poupança' : '');
      const itens = (await transacoes(ac.id, ini, fim)).map((t) => ({
        id: String(t.id).slice(0, 48), d: String(t.date || '').slice(0, 10),
        desc: String(t.descriptionRaw || t.description || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        v: r2(t.type === 'DEBIT' ? -Math.abs(t.amount) : Math.abs(t.amount))
      })).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.d) && x.v);
      it.contas.push({ chave: chaveC, nome, numero: ac.number || '' }); nContas++; nLanc += itens.length;
      for (const k of ks) {
        const dIni = k + '-01' < ini ? ini : k + '-01', dFim = ultimoDia(k) > fim ? fim : ultimoDia(k);
        const info = { nome, banco: '', agencia: '', conta: ac.number || '', fonte: 'openfinance', arquivo: '', importadoEm: agora, por: null };
        if (k === fim.slice(0, 7) && isFinite(ac.balance)) info.saldo = { valor: r2(ac.balance), data: fim };
        (porMes[k] = porMes[k] || []).push([chaveC, info, itens.filter((x) => x.d.slice(0, 7) === k), dIni, dFim]);
      }
    }
    it.ultimaSync = agora;
  }
  for (const k of Object.keys(porMes)) {
    let doc = await lerDoc(adm, clinica, 'banco/' + k);
    porMes[k].forEach((a) => { doc = mesclaConta(doc, a[0], a[1], a[2], a[3], a[4]); });
    await gravarDoc(adm, clinica, 'banco/' + k, doc);
  }
  await gravarDoc(adm, clinica, DOC, cfg);
  return { contas: nContas, lancamentos: nLanc, meses: Object.keys(porMes).sort(), avisos };
}

export default async function handler(req, res) {
  const configurado = !!(PID && PSEC && URL_SB && KEY);
  try {
    if (req.method === 'GET') { // rotina diária
      if (!env.CRON_SECRET || req.headers.authorization !== 'Bearer ' + env.CRON_SECRET) return res.status(401).json({ erro: 'Não autorizado.' });
      if (!configurado) return res.status(200).json({ ok: true, ignorado: 'Open Finance não configurado' });
      const adm = createClient(URL_SB, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = await adm.from('documentos').select('clinica_id').eq('path', DOC);
      const out = {};
      for (const r of data || []) { try { out[r.clinica_id] = await sincronizarClinica(adm, r.clinica_id, 2); } catch (e) { out[r.clinica_id] = { erro: e.message }; } }
      return res.status(200).json({ ok: true, clinicas: out });
    }
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
    if (!URL_SB || !KEY) return res.status(500).json({ erro: 'Chave de serviço do Supabase ausente na Vercel.' });
    const adm = createClient(URL_SB, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const b = corpo(req);

    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const { data: quem } = token ? await adm.auth.getUser(token) : { data: null };
    if (!quem || !quem.user) return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' });
    if (b.acao === 'status') return res.status(200).json({ configurado });
    if (!configurado) return res.status(400).json({ erro: 'Open Finance ainda não ativado (credenciais da Pluggy ausentes na Vercel)' });

    const clinica = String(b.clinica || '');
    const { data: perfil } = await adm.from('perfis').select('tbw_admin, ativo').eq('user_id', quem.user.id).maybeSingle();
    let pode = !!(perfil && perfil.ativo && perfil.tbw_admin);
    if (!pode && perfil && perfil.ativo) {
      const { data: m } = await adm.from('membros').select('papel').eq('clinica_id', clinica).eq('user_id', quem.user.id).maybeSingle();
      pode = !!(m && m.papel === 'editor');
    }
    if (!clinica || !pode) return res.status(403).json({ erro: 'Sem permissão de edição nesta clínica.' });

    if (b.acao === 'token') {
      const t = await pluggy('POST', 'connect_token', { options: { clientUserId: clinica } });
      return res.status(200).json({ accessToken: t.accessToken });
    }
    if (b.acao === 'vincular') {
      const item = await pluggy('GET', 'items/' + encodeURIComponent(String(b.itemId || '')));
      if (item.clientUserId !== clinica) return res.status(403).json({ erro: 'Esta conexão não pertence à clínica.' });
      const cfg = (await lerDoc(adm, clinica, DOC)) || { itens: [] };
      cfg.itens = (cfg.itens || []).filter((x) => x.id !== item.id);
      cfg.itens.push({ id: item.id, conector: (item.connector && item.connector.name) || 'Instituição', status: item.status, criadoEm: new Date().toISOString(), por: quem.user.id });
      await gravarDoc(adm, clinica, DOC, cfg);
      return res.status(200).json(await sincronizarClinica(adm, clinica, 3));
    }
    if (b.acao === 'sincronizar') return res.status(200).json(await sincronizarClinica(adm, clinica, +b.meses || 3));
    if (b.acao === 'desvincular') {
      const cfg = (await lerDoc(adm, clinica, DOC)) || { itens: [] };
      const id = String(b.itemId || '');
      if (!(cfg.itens || []).some((x) => x.id === id)) return res.status(404).json({ erro: 'Conexão não encontrada.' });
      try { await pluggy('DELETE', 'items/' + encodeURIComponent(id)); } catch (e) { /* já removida na Pluggy */ }
      cfg.itens = cfg.itens.filter((x) => x.id !== id);
      await gravarDoc(adm, clinica, DOC, cfg);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ erro: 'Ação desconhecida.' });
  } catch (e) {
    return res.status(e.status || 500).json({ erro: e.message || 'Falha no Open Finance.' });
  }
}
