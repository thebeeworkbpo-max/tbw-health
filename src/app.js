import TBW from './engine.js';
import { lerPlanilha } from './planilha.js';

export function iniciarApp(rootEl, ctx) {
  'use strict';
  var T = TBW;

  /* ================= Utilidades ================= */
  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function ok(v) { return v != null && isFinite(v); }
  function f0(v) { if (!ok(v)) return '—'; var r = Math.round(v); if (r === 0) return '0'; return (r < 0 ? '−' : '') + nf0.format(Math.abs(r)); }
  function f2(v) { if (!ok(v)) return '—'; var r = Math.round(v * 100) / 100; return (r < 0 ? '−' : '') + nf2.format(Math.abs(r)); }
  function R0(v) { if (!ok(v)) return '—'; return (v < -0.5 ? '−' : '') + 'R$ ' + nf0.format(Math.abs(Math.round(v))); }
  function R2(v) { if (!ok(v)) return '—'; return (v < -0.005 ? '−' : '') + 'R$ ' + nf2.format(Math.abs(v)); }
  function pct(v) { if (!ok(v)) return '—'; return (v < -0.0005 ? '−' : '') + nf1.format(Math.abs(v * 100)) + '%'; }
  function compact(v) {
    if (!ok(v)) return '—'; var a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e6) return s + 'R$ ' + nf1.format(a / 1e6) + ' mi';
    if (a >= 1e3) return s + 'R$ ' + nf0.format(a / 1e3) + ' mil';
    return s + 'R$ ' + nf0.format(a);
  }
  function inNum(v, dec) { if (!ok(v) || v === 0) return ''; return dec ? nf2.format(v) : nf0.format(v); }
  function parseBR(s) { var v = T.parseValor(s); return isNaN(v) ? 0 : v; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function sum(a) { return a.reduce(function (x, y) { return x + (+y || 0); }, 0); }
  function range(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }
  function iso() { return new Date().toISOString(); }
  function ym(ano, m) { return ano + '-' + String(m + 1).padStart(2, '0'); }
  function mesNome(m) { return T.MESES[m]; }
  var MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  /* ================= Estado ================= */
  var S = {
    db: null, user: null, dl: null, uid: null, canWrite: true, ready: false, noDb: false, slow: false,
    cfg: null, insumos: null, procs: null, orcs: {}, real: {}, depara: {}, erpcfg: {},
    got: {}, ver: 0, saving: 0, lastSave: null,
    ui: {
      view: 'visao', ano: null, mes: null, per: 'ytd',
      prec: { q: '', g: '', st: '', forma: 'pix', sort: 'o', dir: 1 },
      ins: { q: '', cat: '' }, sel: null, meta: null,
      dreView: 'cmp', dreBase: 'real', dfcView: 'cmp', dfcBase: 'real', open: {},
      imp: null, orcCresc: 5, modal: null, toast: null, pend: false
    }
  };
  var REQ = ['config/geral', 'base/insumos', 'base/procedimentos', 'orcamento', 'realizado', 'erp/depara', 'erp/config'];

  function cfg() { var c = S.cfg || {}; return { t: c.t != null ? +c.t : 0.14, c: c.c != null ? +c.c : 0.06, modo: c.modo || 'planilha', meta: c.meta != null ? +c.meta : 0.35, clinica: c.clinica || (ctx.clinica ? ctx.clinica.nome : 'TBW Health'), ano: c.ano, origem: c.origem }; }
  var memo = {};
  function insMap() { if (memo.imV !== S.ver) { memo.im = T.insMapOf(S.insumos || []); memo.imV = S.ver; } return memo.im; }
  function procMap() { if (memo.pmV !== S.ver) { memo.pm = T.procMapOf(S.procs || []); memo.pmV = S.ver; } return memo.pm; }
  function orcDoc(ano) { return S.orcs[String(ano)] || null; }
  function O(ano) {
    var k = ano + ':' + S.ver; if (memo.oK === k) return memo.o;
    memo.o = T.orcado(orcDoc(ano), S.procs || [], S.insumos || [], cfg()); memo.oK = k; return memo.o;
  }
  function realDoc(ano, m) { return S.real[ym(ano, m)] || null; }
  function ultimoReal(ano) { for (var m = 11; m >= 0; m--) if (realDoc(ano, m)) return m; return -1; }
  function realSerie(ano, kind) {
    var leaves = kind === 'dre' ? T.DRE_LEAVES : T.DFC_LEAVES, v = {}, has = [];
    leaves.forEach(function (id) { v[id] = T.z12(); });
    for (var m = 0; m < 12; m++) {
      var d = realDoc(ano, m); has[m] = !!d;
      if (d) leaves.forEach(function (id) { v[id][m] = +((d[kind] || {})[id] || 0); });
    }
    return { v: v, has: has };
  }
  function anos() {
    var set = {}; var y = new Date().getFullYear(); set[y] = 1;
    Object.keys(S.orcs).forEach(function (a) { set[a] = 1; });
    Object.keys(S.real).forEach(function (k) { set[k.slice(0, 4)] = 1; });
    if (S.cfg && S.cfg.ano) set[S.cfg.ano] = 1;
    return Object.keys(set).map(Number).sort();
  }
  function ano() { return S.ui.ano || (S.cfg && S.cfg.ano) || new Date().getFullYear(); }
  function mesSel() {
    if (S.ui.mes != null) return S.ui.mes;
    var u = ultimoReal(ano()); if (u >= 0) return u;
    var now = new Date(); return ano() === now.getFullYear() ? now.getMonth() : 11;
  }
  function idxs() { var m = mesSel(); return S.ui.per === 'mes' ? [m] : S.ui.per === 'ano' ? range(0, 11) : range(0, m); }
  function perLabel() {
    var m = mesSel();
    if (S.ui.per === 'mes') return mesNome(m) + '/' + ano();
    if (S.ui.per === 'ano') return 'Ano ' + ano();
    return 'Acumulado jan–' + mesNome(m).toLowerCase() + '/' + ano();
  }
  function temExemplo() { return Object.keys(S.real).some(function (k) { return S.real[k].fonte === 'exemplo'; }) || Object.keys(S.orcs).some(function (k) { return S.orcs[k].exemplo; }); }

  /* ================= Persistência ================= */
  var W = { timers: {}, chain: {} };
  function save(path, getData, delay) {
    if (!S.db || !S.canWrite) return;
    clearTimeout(W.timers[path]);
    W.timers[path] = setTimeout(function () {
      delete W.timers[path];
      var data = getData();
      W.chain[path] = (W.chain[path] || Promise.resolve()).then(function () { return write(path, data); });
    }, delay == null ? 700 : delay);
    status();
  }
  function write(path, data, tries) {
    S.saving++; status();
    return S.db.doc(path).set(data).then(function () { S.lastSave = new Date(); })
      .catch(function (e) { return writeErr(e, path, data, tries); })
      .then(function () { S.saving--; status(); });
  }
  function writeErr(e, path, data, tries) {
    var code = e && e.code;
    if (code === 'unavailable' && !tries) return new Promise(function (r) { setTimeout(r, 600 + Math.random() * 800); }).then(function () { S.saving++; return write(path, data, 1).then(function () { S.saving--; }); });
    if (e && e.permissao) { S.canWrite = false; toast('Seu acesso é somente leitura. A alteração não foi salva.'); render(); return; }
    if (code === 'invalid_argument') { toast('Não foi possível salvar: ' + (e.message || 'dados inválidos') + '.'); return; }
    if (code === 'quota_exceeded') { toast('O armazenamento da plataforma está cheio. Remova meses antigos do realizado e tente de novo.'); return; }
    toast('Não foi possível salvar agora. Verifique a conexão e repita a alteração.');
  }
  function del(path) {
    if (!S.db) return Promise.resolve();
    return S.db.doc(path).delete().catch(function (e) { toast('Não foi possível remover: ' + (e && e.message || '')); });
  }
  function saveProcs() { save('base/procedimentos', function () { return { items: S.procs, atualizadoEm: iso() }; }); }
  function saveIns() { save('base/insumos', function () { return { items: S.insumos, atualizadoEm: iso() }; }); }
  function saveCfg() { save('config/geral', function () { return S.cfg; }, 400); }
  function saveOrc(a) { save('orcamento/' + a, function () { return S.orcs[String(a)]; }); }
  function saveDepara() { save('erp/depara', function () { return { map: S.depara }; }, 300); }
  function saveErpCfg() { save('erp/config', function () { return S.erpcfg; }, 300); }
  function touch() { S.ver++; }

  function status() {
    var el = $('#sync'); if (!el) return;
    var pend = Object.keys(W.timers).length;
    var txt = !S.db ? 'Sem conexão com a base' : !S.canWrite ? 'Somente leitura' : (S.saving || pend) ? 'Salvando alterações…' : S.lastSave ? 'Salvo às ' + S.lastSave.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Base sincronizada';
    el.innerHTML = '<span class="dot' + ((!S.db || S.saving || pend) ? ' off' : '') + '"></span>' + esc(txt);
  }

  /* ================= Carga ================= */
  function boot() {
    S.db = ctx.db; S.uid = ctx.uid; S.dl = ctx.dl; S.canWrite = !!ctx.canWrite;
    route(); render();
    if (!S.db) { S.ready = true; if (ctx.isAdmin && S.ui.view !== 'admin') location.hash = '#admin'; render(); return; }
    setTimeout(function () { if (!S.ready) { S.slow = true; render(); } }, 10000);
    subDoc('config/geral', function (d) { S.cfg = d; });
    subDoc('base/insumos', function (d) { S.insumos = d ? d.items || [] : null; });
    subDoc('base/procedimentos', function (d) { S.procs = d ? d.items || [] : null; });
    subDoc('erp/depara', function (d) { S.depara = (d && d.map) || {}; });
    subDoc('erp/config', function (d) { S.erpcfg = d || {}; });
    subCol('orcamento', function (docs) { S.orcs = docs; });
    subCol('realizado', function (docs) { S.real = docs; });
  }
  function subDoc(path, apply) {
    S.db.doc(path).onSnapshot(function (snap) {
      var local = W.timers[path] || snap.metadata.hasPendingWrites;
      if (!local || !S.got[path]) apply(snap.exists ? clone(snap.data()) : null);
      S.got[path] = true; touch(); ready(); later();
    }, function (e) { S.got[path] = true; ready(); later(); console.warn(path, e); });
  }
  function subCol(path, apply) {
    S.db.collection(path).onSnapshot(function (snap) {
      var o = {}; snap.docs.forEach(function (d) { if (d.exists) o[d.id] = clone(d.data()); });
      var pendLocal = Object.keys(W.timers).some(function (k) { return k.indexOf(path + '/') === 0; });
      if (!pendLocal || !S.got[path]) apply(o);
      else { Object.keys(o).forEach(function (k) { if (!W.timers[path + '/' + k]) (path === 'orcamento' ? S.orcs : S.real)[k] = o[k]; }); }
      S.got[path] = true; touch(); ready(); later();
    }, function (e) { S.got[path] = true; ready(); later(); console.warn(path, e); });
  }
  function ready() { if (!S.ready && REQ.every(function (p) { return S.got[p]; })) { S.ready = true; if (!S.ui.ano && S.cfg && S.cfg.ano) S.ui.ano = +S.cfg.ano; } }
  var raf = 0;
  function later(local) {
    var a = document.activeElement;
    if (!local && a && /INPUT|TEXTAREA/.test(a.tagName) && rootEl.contains(a) && a.type !== 'file' && a.type !== 'checkbox') { S.ui.pend = true; return; }
    if (raf) return; raf = requestAnimationFrame(function () { raf = 0; render(); });
  }

  /* ================= Roteamento ================= */
  var VIEWS = [
    { id: 'visao', n: 'Desempenho', sec: 'Gestão', ic: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>' },
    { id: 'dre', n: 'DRE', ic: '<path d="M4 6h16M4 12h10M4 18h13"/>' },
    { id: 'dfc', n: 'Fluxo de caixa', ic: '<path d="M3 15c3-6 6 6 9 0s6-6 9 0"/><path d="M3 9h4M17 9h4"/>' },
    { id: 'orcamento', n: 'Planejamento', ic: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
    { id: 'precificacao', n: 'Precificação', sec: 'Custos', ic: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.5"/>' },
    { id: 'insumos', n: 'Insumos CMV · CSV', ic: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>' },
    { id: 'erp', n: 'Integração ERP', sec: 'Dados', ic: '<path d="M8 7V3M16 7V3M6 7h12v4a6 6 0 0 1-12 0V7zM12 17v4"/>' },
    { id: 'premissas', n: 'Premissas', ic: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>' },
    { id: 'admin', n: 'Administração', sec: 'TBW', ic: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>' }
  ];
  function route() {
    var h = (location.hash || '').replace('#', '');
    S.ui.view = VIEWS.some(function (v) { return v.id === h && (v.id !== 'admin' || ctx.isAdmin); }) ? h : (ctx.clinica ? 'visao' : (ctx.isAdmin ? 'admin' : 'visao'));
  }
  window.addEventListener('hashchange', function () { route(); if (S.ui.view !== 'precificacao') S.ui.sel = null; render(); window.scrollTo(0, 0); });

  /* ================= Render ================= */
  function render() {
    var root = rootEl;
    var a = document.activeElement, fid = a && a.id && root.contains(a) ? a.id : null, ss = null, se = null;
    try { if (fid && a.selectionStart != null) { ss = a.selectionStart; se = a.selectionEnd; } } catch (e) { }
    var scrolls = {}; root.querySelectorAll('[data-keep]').forEach(function (el) { scrolls[el.dataset.keep] = [el.scrollTop, el.scrollLeft]; });
    var y = window.scrollY;
    S.ui.pend = false;
    root.innerHTML = shell();
    root.querySelectorAll('[data-keep]').forEach(function (el) { var s = scrolls[el.dataset.keep]; if (s) { el.scrollTop = s[0]; el.scrollLeft = s[1]; } });
    window.scrollTo(0, y);
    if (fid) { var el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); try { if (ss != null) el.setSelectionRange(ss, se); } catch (e) { } } }
    status();
  }
  function shell() {
    var c = cfg(), v = S.ui.view;
    var nav = VIEWS.filter(function (x) { return (x.id !== 'admin' || ctx.isAdmin) && (ctx.clinica || x.id === 'admin'); }).map(function (x) {
      return (x.sec ? '<div class="sec">' + x.sec + '</div>' : '') + '<a href="#' + x.id + '"' + (x.id === v ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + x.ic + '</svg>' + x.n + '</a>';
    }).join('');
    var body;
    if (!S.ready) body = loading();
    else if (v === 'admin' && ctx.isAdmin) body = vAdmin();
    else if (!ctx.clinica) body = top('Nenhuma clínica cadastrada', '') + '<div class="view"><div class="card empty"><h2>Cadastre a primeira clínica</h2><p class="note">Na Administração, crie a clínica e depois importe a planilha de precificação dela.</p><a class="btn pri" href="#admin">Abrir administração</a></div></div>';
    else if (!S.procs && v !== 'premissas') body = onboarding();
    else body = viewHtml(v);
    return '<div class="app"><aside class="side"><div class="brand"><div class="brand-mark"><img src="/marca/logo-tbw-branco.png" alt="TBW" width="99" height="36"><span class="health">HEALTH</span></div><small>Gestão financeira da clínica</small></div>' + sideClinica() + '<nav class="nav" aria-label="Seções">' + nav + '</nav>' +
      '<div class="side-foot"><div id="sync"></div><div class="who"><b>' + esc(ctx.perfil.nome || ctx.perfil.email) + '</b><span>' + esc(ctx.perfil.email) + ' · ' + esc(PAPEL[ctx.papel] || ctx.papel) + '</span></div><div class="row" style="gap:6px"><button class="btn sm side-btn" data-act="senha">Alterar senha</button><button class="btn sm side-btn" data-act="sair">Sair</button></div></div></aside><main class="main">' + body + '</main></div>' + overlays();
  }
  var PAPEL = { admin: 'Administrador TBW', editor: 'Edição', leitura: 'Consulta' };
  function sideClinica() {
    if (!ctx.clinicas.length) return '';
    if (ctx.clinicas.length === 1) return '<div class="side-clin"><span>Clínica</span><b>' + esc(ctx.clinicas[0].nome) + '</b></div>';
    return '<div class="side-clin"><label for="sb-clin">Clínica</label><select id="sb-clin" data-in="trocaclin">' + ctx.clinicas.map(function (c) { return '<option value="' + esc(c.id) + '"' + (ctx.clinica && c.id === ctx.clinica.id ? ' selected' : '') + '>' + esc(c.nome) + (c.ativo ? '' : ' (inativa)') + '</option>'; }).join('') + '</select></div>';
  }
  function loading() {
    return '<div class="top"><div class="ttl"><h1>Carregando a base da clínica…</h1></div></div><div class="view"><div class="card stack">' +
      (S.slow ? '<p class="note">A base ainda não respondeu. Verifique a conexão; a página continua tentando sozinha.</p>' : '') +
      '<div class="skel" style="width:40%"></div><div class="skel"></div><div class="skel" style="width:80%"></div><div class="skel" style="width:60%"></div></div></div>';
  }
  function top(t, sub, ctl) { return '<div class="top"><div class="ttl"><h1>' + t + '</h1>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><div class="ctl">' + (ctl || '') + '</div></div>'; }
  function dis() { return S.canWrite ? '' : ' disabled'; }
  function sel(id, opts, val, attrs) {
    return '<select class="inp" id="' + id + '" ' + (attrs || '') + '>' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function seg(act, opts, val) { return '<div class="seg" role="group">' + opts.map(function (o) { return '<button type="button" data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="' + (o[0] === val) + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
  function anoCtl() { return sel('ctl-ano', anos().map(function (a) { return [a, a]; }), ano(), 'data-in="ano" aria-label="Ano"'); }
  function perCtl() {
    var m = mesSel();
    return seg('per', [['mes', 'Mês'], ['ytd', 'Acumulado'], ['ano', 'Ano']], S.ui.per) + sel('ctl-mes', T.MESES.map(function (n, i) { return [i, n + (realDoc(ano(), i) ? ' ✓' : '')]; }), m, 'data-in="mes" aria-label="Mês de referência"' + (S.ui.per === 'ano' ? ' disabled' : ''));
  }
  function bannerEx() {
    if (!temExemplo()) return '';
    var oe = Object.keys(S.orcs).filter(function (k) { return S.orcs[k].exemplo; }), re = Object.keys(S.real).some(function (k) { return S.real[k].fonte === 'exemplo'; });
    var o = [oe.length ? 'do orçamento ' + oe.join(', ') : '', re ? 'do realizado marcado como exemplo' : ''].filter(Boolean).join(' e ');
    return '<div class="banner"><span><b>Cenário de exemplo.</b> Os números ' + o + ' são fictícios, para demonstrar a plataforma. A precificação é a da planilha real da clínica. Importe o ERP e ajuste o orçamento para substituir.</span><a class="btn sm" href="#erp">Ir para a integração</a></div>';
  }
  function roBanner() { return S.canWrite ? '' : '<div class="banner"><span><b>Somente leitura.</b> Você pode consultar tudo, mas só editores salvam alterações.</span></div>'; }

  function viewHtml(v) {
    switch (v) {
      case 'precificacao': return vPrec();
      case 'insumos': return vIns();
      case 'orcamento': return vOrc();
      case 'dre': return vDem('dre');
      case 'dfc': return vDem('dfc');
      case 'erp': return vErp();
      case 'premissas': return vPrem();
      default: return vVisao();
    }
  }

  function onboarding() {
    return top('Bem-vindo à plataforma TBW Health', 'Comece pela planilha de precificação da clínica') +
      '<div class="view"><div class="card empty"><h2>A base de precificação ainda não foi carregada</h2><p class="note">Importe a planilha de precificação no layout TBW (abas “Input e Lista de Procedimentos”, “Material IMPUT” e “Procedimento PRECIFICAÇÃO”). Os procedimentos, as fichas técnicas e os custos de insumos viram a base de CMV e CSV.</p>' +
      '<label class="btn pri" for="base-file">Importar planilha de precificação (.xlsx)</label><input type="file" id="base-file" accept=".xlsx,.xlsm,.xls" hidden data-in="base-file"' + dis() + '></div></div>';
  }

  /* ================= Precificação ================= */
  function grupoNome(g) { var x = T.GRUPOS.filter(function (y) { return y.id === g; })[0]; return x ? x.n : 'Outros'; }
  function statusP(u) {
    var meta = cfg().meta;
    if (!(u.E > 0)) return 'sp';
    if (u.pix.mg < 0 || u.car.mg < 0) return 'neg';
    if (u.pix.mgp < meta) return 'meta';
    return 'ok';
  }
  var ST = { sp: ['Sem preço', 'warn'], neg: ['Margem negativa', 'bad'], meta: ['Abaixo da meta', 'warn'], ok: ['Dentro da meta', 'good'] };
  function chipSt(st) { return '<span class="chip ' + ST[st][1] + '">' + ST[st][0] + '</span>'; }
  function precRows() {
    var im = insMap(), c = cfg();
    return (S.procs || []).map(function (p) { var u = T.unit(p, c, im); return { p: p, u: u, st: statusP(u) }; });
  }
  function vPrec() {
    var P = S.ui.prec, c = cfg(), rows = precRows();
    var cnt = { all: rows.length, sp: 0, neg: 0, meta: 0, ok: 0 };
    rows.forEach(function (r) { cnt[r.st]++; });
    var q = T.semAcento(P.q);
    var list = rows.filter(function (r) {
      return (!P.g || r.p.g === P.g) && (!P.st || r.st === P.st) && (!q || T.semAcento(r.p.n).indexOf(q) >= 0);
    });
    var f = P.forma;
    function val(r, k) {
      var x = r.u[f];
      switch (k) {
        case 'o': return r.p.o; case 'n': return r.p.n; case 'g': return grupoNome(r.p.g);
        case 'pix': return r.u.E; case 'car': return r.u.I; case 'imp': return x.imp + x.tx;
        case 'cmv': return r.u.cmv; case 'csv': return x.csv; case 'mg': return x.mg; case 'mgp': return x.mgp;
      }
    }
    list.sort(function (a, b) { var A = val(a, P.sort), B = val(b, P.sort); return (typeof A === 'string' ? A.localeCompare(B, 'pt-BR') : A - B) * P.dir; });
    function th(k, n, cls) { return '<th class="' + (cls || '') + '"><button class="sort" data-act="psort" data-k="' + k + '">' + n + (P.sort === k ? (P.dir > 0 ? ' ↑' : ' ↓') : '') + '</button></th>'; }
    var body = list.map(function (r) {
      var x = r.u[f];
      return '<tr class="click' + (S.ui.sel === r.p.id ? ' sel' : '') + '" data-act="psel" data-id="' + r.p.id + '"><td class="n muted">' + r.p.o + '</td><td class="nm"><span class="clip">' + esc(r.p.n) + '</span></td><td class="muted nowrap">' + esc(grupoNome(r.p.g)) + '</td>' +
        '<td class="n">' + R2(r.u.E) + '</td><td class="n">' + R2(r.u.I) + '</td><td class="n">' + f2(x.imp + x.tx) + '</td><td class="n">' + f2(r.u.cmv) + '</td><td class="n">' + f2(x.csv) + '</td>' +
        '<td class="n ' + (x.mg < 0 ? 'neg' : '') + '">' + f2(x.mg) + '</td><td class="n ' + (x.mgp < 0 ? 'neg' : '') + '">' + (r.u.E > 0 ? pct(x.mgp) : '—') + '</td><td>' + chipSt(r.st) + '</td></tr>';
    }).join('');
    function stChip(k, n, cls) { return '<button class="chip ' + cls + '" data-act="pst" data-v="' + k + '" aria-pressed="' + (P.st === k) + '">' + n + ' · ' + (k ? cnt[k] : cnt.all) + '</button>'; }
    var html = top('Precificação e margem por procedimento', esc(rows.length + ' procedimentos · base: ' + (c.origem || 'planilha da clínica') + ' · modelo ' + (c.modo === 'revisado' ? 'revisado TBW' : 'planilha v6')),
      '<button class="btn" data-act="exp-prec">Exportar Excel</button>') +
      '<div class="view">' + roBanner() +
      '<div class="row">' + stChip('', 'Todos', 'info') + stChip('ok', 'Dentro da meta', 'good') + stChip('meta', 'Abaixo da meta de ' + pct(c.meta), 'warn') + stChip('neg', 'Margem negativa', 'bad') + stChip('sp', 'Sem preço', 'warn') + '</div>' +
      '<div class="spread"><div class="row"><input class="inp" id="p-busca" type="search" placeholder="Buscar procedimento" value="' + esc(P.q) + '" data-in="pq" style="width:240px">' +
      sel('p-grupo', [['', 'Todas as linhas']].concat(T.GRUPOS.map(function (g) { return [g.id, g.n]; })), P.g, 'data-in="pg" aria-label="Linha de receita"') + '</div>' +
      '<div class="row"><span class="note">Venda no</span>' + seg('pforma', [['pix', 'PIX / dinheiro'], ['car', 'Cartão']], f) + '</div></div>' +
      '<div class="tw max" data-keep="prec"><table class="t"><thead><tr>' + th('o', '#', 'n') + th('n', 'Procedimento') + th('g', 'Linha') + th('pix', 'Preço PIX', 'n') + th('car', 'Preço cartão', 'n') + th('imp', 'Impostos e taxas', 'n') + th('cmv', 'CMV', 'n') + th('csv', 'CSV', 'n') + th('mg', 'Margem R$', 'n') + th('mgp', 'Margem %', 'n') + '<th>Situação</th></tr></thead><tbody>' +
      (body || '<tr><td colspan="11" class="muted">Nenhum procedimento com esses filtros.</td></tr>') + '</tbody></table></div>' +
      '<p class="note">CMV = medicamentos, implantes, kits e materiais da ficha técnica. CSV = honorário médico, exames terceirizados, estrutura de atendimento e custo extra. Clique em um procedimento para editar preço, honorário e ficha técnica.</p></div>';
    return html;
  }

  function drawer() {
    var p = procMap()[S.ui.sel]; if (!p) return '';
    var c = cfg(), im = insMap(), u = T.unit(p, c, im), st = statusP(u);
    var meta = S.ui.meta != null ? S.ui.meta : c.meta;
    var alvo = T.precoAlvo(p, c, im, meta);
    function wf(x, rec, nome) {
      var csvIns = u.csvIns, partes = [
        ['Impostos', x.imp, '#7A8CA6'], ['Taxa de cartão', x.tx, '#A9B8CC'], ['Honorário médico (CSV)', x.hon, '#F2B01E'],
        ['Exames e estrutura (CSV)', csvIns, '#D9922B'], ['Custo extra (CSV)', u.P, '#B5651D'], ['CMV', u.cmv, '#12508F']];
      var bar = partes.map(function (q) { return q[1] > 0 && rec > 0 ? '<span style="width:' + Math.min(100, q[1] / rec * 100) + '%;background:' + q[2] + '"></span>' : ''; }).join('') + (x.mg > 0 && rec > 0 ? '<span style="width:' + (x.mg / rec * 100) + '%;background:#17845A"></span>' : '');
      return '<div class="card"><header><h3>' + nome + '</h3>' + '<span class="chip ' + (x.mg < 0 ? 'bad' : x.mgp < c.meta ? 'warn' : 'good') + '">' + (rec > 0 ? pct(x.mgp) : '—') + '</span></header><div class="stackbar">' + bar + '</div>' +
        '<div class="wf"><div class="ln"><span>Preço</span><b class="num">' + R2(rec) + '</b></div>' +
        partes.map(function (q) { return '<div class="ln"><span class="muted">(−) ' + q[0] + '</span><span class="num">' + f2(q[1]) + '</span></div>'; }).join('') +
        '<div class="ln tot"><span>Margem</span><span class="num ' + (x.mg < 0 ? 'neg' : '') + '">' + R2(x.mg) + '</span></div></div></div>';
    }
    var ficha = (p.r || []).map(function (it, i) {
      var ins = im[it[0]]; var cat = ins ? T.CATS[ins.cat] : null, tot = ins ? it[1] * ins.c : 0;
      return '<tr><td class="nm">' + esc(ins ? ins.n : 'Insumo removido') + '</td><td>' + (cat ? '<span class="chip ' + cat.grupo.toLowerCase() + '">' + cat.grupo + '</span> <span class="muted">' + esc(cat.n) + '</span>' : '') + '</td>' +
        '<td class="n" style="width:90px"><input class="inp cell n" id="rq-' + i + '" data-in="rq" data-i="' + i + '" value="' + esc(nf2.format(it[1]).replace(/,00$/, '')) + '"' + dis() + ' aria-label="Quantidade"></td><td class="n">' + f2(ins ? ins.c : 0) + '</td><td class="n">' + f2(tot) + '</td>' +
        '<td><button class="btn ghost danger" data-act="rdel" data-i="' + i + '" aria-label="Remover insumo"' + dis() + '>✕</button></td></tr>';
    }).join('');
    var opts = (S.insumos || []).map(function (i) { return '<option value="' + esc(i.n) + '"></option>'; }).join('');
    var alvoTxt = alvo === null ? 'Com esse honorário e esses impostos, a margem de ' + pct(meta) + ' não é alcançável.' : alvo === 'livre' ? 'Sem custo direto: a margem percentual não depende do preço.' : 'Preço PIX de <b>' + R2(alvo) + '</b> (cartão ' + R2(alvo / (1 - c.t - c.c)) + ') entrega ' + pct(meta) + ' de margem no PIX.';
    return '<div class="drawer-bg" data-act="pclose"></div><aside class="drawer" role="dialog" aria-label="Procedimento"><header><div><small>Procedimento #' + p.o + ' · ' + esc(grupoNome(p.g)) + '</small><h2>' + esc(p.n) + '</h2></div><button class="btn sm" data-act="pclose">Fechar</button></header><div class="body">' +
      '<div class="row">' + chipSt(st) + '<span class="note">Modelo de cálculo: ' + (c.modo === 'revisado' ? 'revisado TBW' : 'planilha v6') + '</span></div>' +
      '<div class="card"><div class="fields">' +
      '<label class="f">Preço PIX (R$)<input class="inp n" id="pp-pr" data-in="ppr" value="' + esc(inNum(p.pr, 1)) + '"' + dis() + '></label>' +
      '<label class="f">Preço no cartão (R$)<input class="inp n" id="pp-car" value="' + esc(nf2.format(u.I)) + '" readonly></label>' +
      '<label class="f">Honorário médico (% do preço)<input class="inp n" id="pp-h" data-in="ph" value="' + esc(nf1.format(p.h * 100)) + '"' + dis() + '></label>' +
      '<label class="f">Custo extra (R$)<input class="inp n" id="pp-x" data-in="px" value="' + esc(inNum(p.x, 1)) + '"' + dis() + '></label>' +
      '<label class="f">Linha de receita' + sel('pp-g', T.GRUPOS.map(function (g) { return [g.id, g.n]; }), p.g, 'data-in="pg2"' + dis()) + '</label>' +
      '</div></div>' +
      '<div class="grid g2">' + wf(u.pix, u.E, 'Venda no PIX / dinheiro') + wf(u.car, u.I, 'Venda no cartão') + '</div>' +
      '<div class="card"><header><div><h3>Ficha técnica</h3><p>Custo direto por atendimento: CMV ' + R2(u.cmv) + ' · CSV de insumos ' + R2(u.csvIns) + '</p></div></header>' +
      '<div class="tw"><table class="t"><thead><tr><th>Insumo</th><th>Classificação</th><th class="n">Qtd</th><th class="n">Custo unit.</th><th class="n">Total</th><th></th></tr></thead><tbody>' + (ficha || '<tr><td colspan="6" class="muted">Sem insumos na ficha técnica.</td></tr>') + '</tbody></table></div>' +
      '<div class="row" style="margin-top:10px"><input class="inp" id="r-add-ins" list="dl-ins" placeholder="Adicionar insumo" style="flex:1;min-width:200px"' + dis() + '><datalist id="dl-ins">' + opts + '</datalist><input class="inp n" id="r-add-q" placeholder="Qtd" style="width:80px" value="1"' + dis() + '><button class="btn" data-act="radd"' + dis() + '>Adicionar</button></div></div>' +
      '<div class="card"><header><h3>Preço sugerido pela margem-alvo</h3></header><div class="row"><label class="f">Margem-alvo no PIX (%)<input class="inp n" id="pp-meta" data-in="pmeta" value="' + esc(nf1.format(meta * 100)) + '" style="width:120px"></label><p class="note" style="flex:1">' + alvoTxt + '</p>' +
      (typeof alvo === 'number' ? '<button class="btn pri" data-act="paplica" data-v="' + alvo + '"' + dis() + '>Aplicar preço</button>' : '') + '</div></div>' +
      '</div></aside>';
  }

  /* ================= Insumos ================= */
  function consumoOrcado() {
    var a = ano(), o = orcDoc(a), pm = procMap(), out = {};
    if (!o || !o.vol) return out;
    Object.keys(o.vol).forEach(function (pid) {
      var p = pm[pid]; if (!p) return; var v = sum(o.vol[pid] || []);
      (p.r || []).forEach(function (it) { out[it[0]] = (out[it[0]] || 0) + v * it[1]; });
    });
    return out;
  }
  function vIns() {
    var F = S.ui.ins, q = T.semAcento(F.q), uso = {}, cons = consumoOrcado();
    (S.procs || []).forEach(function (p) { (p.r || []).forEach(function (it) { uso[it[0]] = (uso[it[0]] || 0) + 1; }); });
    var list = (S.insumos || []).filter(function (i) { return (!F.cat || i.cat === F.cat) && (!q || T.semAcento(i.n).indexOf(q) >= 0); });
    var porCat = {}; Object.keys(T.CATS).forEach(function (k) { porCat[k] = { n: 0, v: 0 }; });
    (S.insumos || []).forEach(function (i) { if (porCat[i.cat]) { porCat[i.cat].n++; porCat[i.cat].v += (cons[i.id] || 0) * i.c; } });
    var catOpts = Object.keys(T.CATS).map(function (k) { return [k, T.CATS[k].grupo + ' · ' + T.CATS[k].n]; });
    var rows = list.map(function (i) {
      var cat = T.CATS[i.cat] || T.CATS.med;
      return '<tr><td class="nm"><input class="inp cell" id="in-' + i.id + '" data-in="inome" data-id="' + i.id + '" value="' + esc(i.n) + '"' + dis() + ' aria-label="Nome do insumo"></td>' +
        '<td style="width:110px"><input class="inp cell" id="iu-' + i.id + '" data-in="iun" data-id="' + i.id + '" value="' + esc(i.u) + '"' + dis() + ' aria-label="Unidade"></td>' +
        '<td class="n" style="width:130px"><input class="inp cell n" id="ic-' + i.id + '" data-in="icus" data-id="' + i.id + '" value="' + esc(nf2.format(i.c)) + '"' + dis() + ' aria-label="Custo unitário"></td>' +
        '<td style="width:290px">' + sel('ik-' + i.id, catOpts, i.cat, 'data-in="icat" data-id="' + i.id + '" aria-label="Classificação"' + dis()) + '</td>' +
        '<td><span class="chip ' + cat.grupo.toLowerCase() + '">' + cat.grupo + '</span></td>' +
        '<td class="n">' + (uso[i.id] || 0) + '</td><td class="n">' + (cons[i.id] ? f0(cons[i.id] * i.c) : '—') + '</td></tr>';
    }).join('');
    var tiles = Object.keys(T.CATS).map(function (k) {
      var x = T.CATS[k];
      return '<div class="kpi"><div class="lb"><span class="chip ' + x.grupo.toLowerCase() + '">' + x.grupo + '</span> ' + esc(x.n) + '</div><div class="vl">' + porCat[k].n + '</div><div class="sb">Consumo orçado ' + ano() + ': ' + R0(porCat[k].v) + '</div></div>';
    }).join('');
    return top('Insumos · classificação em CMV e CSV', (S.insumos || []).length + ' insumos · o custo alterado aqui recalcula todos os procedimentos e o orçamento', '<button class="btn" data-act="inovo"' + dis() + '>Novo insumo</button>') +
      '<div class="view">' + roBanner() + '<div class="kpis">' + tiles + '</div>' +
      '<div class="row"><input class="inp" id="i-busca" type="search" placeholder="Buscar insumo" value="' + esc(F.q) + '" data-in="iq" style="width:260px">' + sel('i-cat', [['', 'Todas as classificações']].concat(catOpts), F.cat, 'data-in="icatf" aria-label="Filtrar classificação"') + '</div>' +
      '<div class="tw max" data-keep="ins"><table class="t"><thead><tr><th>Insumo</th><th>Unidade</th><th class="n">Custo unitário (R$)</th><th>Classificação</th><th>Grupo</th><th class="n">Usado em</th><th class="n">Consumo orçado ' + ano() + ' (R$)</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="muted">Nenhum insumo com esses filtros.</td></tr>') + '</tbody></table></div>' +
      '<p class="note">CMV reúne o que a clínica compra e aplica no paciente (medicamentos, implantes, kits e materiais). CSV reúne o custo do serviço prestado: exames de laboratórios parceiros, estrutura de atendimento, além do honorário médico e do custo extra de cada procedimento.</p></div>';
  }

  /* ================= Orçamento ================= */
  function vOrc() {
    var a = ano(), o = orcDoc(a), c = cfg();
    if (!o) {
      var prev = orcDoc(a - 1);
      return top('Planejamento orçamentário ' + a, 'Nenhum orçamento para este ano', anoCtl()) + '<div class="view">' + roBanner() + '<div class="card empty"><h2>Monte o orçamento de ' + a + '</h2>' +
        (prev ? '<p class="note">Copie o orçamento de ' + (a - 1) + ' aplicando um crescimento de volume e reajuste de despesas.</p><div class="row"><label class="f">Crescimento (%)<input class="inp n" id="o-cresc" data-in="ocresc" value="' + esc(nf1.format(S.ui.orcCresc)) + '" style="width:110px"></label><button class="btn pri" data-act="ocopia"' + dis() + '>Copiar de ' + (a - 1) + '</button></div>' : '') +
        '<button class="btn" data-act="ovazio"' + dis() + '>Começar orçamento em branco</button></div></div>';
    }
    var R = O(a), pm = procMap(), im = insMap();
    var anual = {}; T.DRE_LEAVES.forEach(function (id) { anual[id] = sum(R.dre[id]); });
    var D = T.fechaDRE(anual);
    var dfcA = {}; T.DFC_LEAVES.forEach(function (id) { dfcA[id] = sum(R.dfc[id]); });
    var FC = T.fechaDFC(dfcA, o.saldoInicial);
    var fixos = D.dop + D.dep + D.fin_desp - D.fin_rec + D.ir, mcp = D.rb ? D.mc / D.rb : 0, pe = mcp > 0 ? fixos / mcp / 12 : null;
    var stOpts = [['exemplo', 'Exemplo'], ['elaboracao', 'Em elaboração'], ['aprovado', 'Aprovado']];
    var mix = T.num(o.mixCartao), pz = o.prazos || {};
    function cells(kind, id, arr, dec) {
      return range(0, 11).map(function (m) { return '<td><input class="inp cell n" id="o-' + kind + '-' + id + '-' + m + '" data-in="o' + kind + '" data-id="' + id + '" data-m="' + m + '" value="' + inNum(T.num(arr[m]), dec) + '"' + dis() + ' aria-label="' + mesNome(m) + '"></td>'; }).join('');
    }
    var mh = range(0, 11).map(function (m) { return '<th class="n">' + mesNome(m) + '</th>'; }).join('');
    // Receitas
    var vol = o.vol || {}, recM = T.z12();
    var linhas = Object.keys(vol).filter(function (pid) { return pm[pid]; }).sort(function (x, y) { return pm[x].o - pm[y].o; }).map(function (pid) {
      var p = pm[pid], u = T.unit(p, c, im), pm_ = (1 - mix) * u.E + mix * u.I, arr = vol[pid], v = sum(arr);
      for (var m = 0; m < 12; m++) recM[m] += T.num(arr[m]) * pm_;
      return '<tr><td class="stick nm"><span class="clip">' + esc(p.n) + '</span><small class="muted">' + esc(grupoNome(p.g)) + ' · ' + R2(pm_) + ' médio</small></td>' + cells('vol', pid, arr, false) +
        '<td class="n">' + f0(v) + '</td><td class="n">' + f0(v * pm_) + '</td><td><div class="row" style="gap:2px;flex-wrap:nowrap"><button class="btn ghost sm" data-act="orep" data-k="vol" data-id="' + pid + '" title="Repetir janeiro nos 12 meses"' + dis() + '>Jan→</button><button class="btn ghost danger sm" data-act="odel" data-id="' + pid + '" aria-label="Remover"' + dis() + '>✕</button></div></td></tr>';
    }).join('');
    var naoUsados = (S.procs || []).filter(function (p) { return !vol[p.id] && p.pr > 0; });
    var addSel = sel('o-add-sel', [['', 'Adicionar procedimento ao orçamento…']].concat(naoUsados.map(function (p) { return [p.id, p.n]; })), '', 'aria-label="Procedimento"' + dis());
    // Despesas e caixa
    var despRows = T.ORC_DESP.map(function (id) {
      var arr = (o.desp || {})[id] || T.z12();
      return '<tr><td class="stick">' + esc(T.DRE_BY[id].n) + '</td>' + cells('desp', id, arr, false) + '<td class="n">' + f0(sum(arr)) + '</td><td><button class="btn ghost sm" data-act="orep" data-k="desp" data-id="' + id + '" title="Repetir janeiro nos 12 meses"' + dis() + '>Jan→</button></td></tr>';
    }).join('');
    var cxRows = T.ORC_CAIXA.map(function (id) {
      var arr = (o.caixa || {})[id] || T.z12();
      return '<tr><td class="stick">' + esc(T.DFC_BY[id].n) + '</td>' + cells('cx', id, arr, false) + '<td class="n">' + f0(sum(arr)) + '</td><td><button class="btn ghost sm" data-act="orep" data-k="caixa" data-id="' + id + '" title="Repetir janeiro nos 12 meses"' + dis() + '>Jan→</button></td></tr>';
    }).join('');
    var kp = '<div class="kpis">' +
      kpi('Receita bruta orçada', R0(D.rb), 'Média mensal ' + R0(D.rb / 12)) +
      kpi('Margem de contribuição', pct(mcp), R0(D.mc) + ' no ano') +
      kpi('EBITDA', R0(D.ebitda), 'Margem ' + pct(D.rb ? D.ebitda / D.rb : 0), D.ebitda < 0 ? 'bad' : '') +
      kpi('Resultado líquido', R0(D.res), 'Margem ' + pct(D.rb ? D.res / D.rb : 0), D.res < 0 ? 'bad' : '') +
      kpi('Caixa no fim do ano', R0(FC.sf), 'Geração operacional ' + R0(FC.fco), FC.sf < 0 ? 'bad' : '') +
      kpi('Ponto de equilíbrio', pe ? R0(pe) + '/mês' : '—', 'Receita mínima para cobrir os custos fixos') + '</div>';
    return top('Planejamento orçamentário ' + a, 'Receitas pelo volume de cada procedimento × preço da precificação; CMV, CSV, impostos e taxas saem da ficha técnica', anoCtl() + sel('o-status', stOpts, o.status || (o.exemplo ? 'exemplo' : 'elaboracao'), 'data-in="ostatus" aria-label="Situação do orçamento"' + dis()) + '<button class="btn" data-act="exp-orc">Exportar Excel</button>') +
      '<div class="view">' + roBanner() + (o.exemplo ? '<div class="banner"><span><b>Orçamento de exemplo.</b> Volumes e despesas são ilustrativos. Ajuste os números e mude a situação para “Em elaboração” ou “Aprovado”.</span></div>' : '') + kp +
      '<div class="card"><header><div><h2>Premissas do orçamento</h2><p>O mix de pagamento define quanto da receita entra pelo preço de cartão (com impostos e taxa) e quando o dinheiro chega ao caixa.</p></div></header><div class="fields">' +
      '<label class="f">Vendas no cartão (%)<input class="inp n" id="o-mix" data-in="omix" value="' + esc(nf1.format(mix * 100)) + '"' + dis() + '></label>' +
      '<label class="f">Recebimento do cartão (meses)<input class="inp n" id="o-pz-cartao" data-in="opz" data-k="cartao" value="' + T.num(pz.cartao) + '"' + dis() + '></label>' +
      '<label class="f">Pagamento a fornecedores (meses)<input class="inp n" id="o-pz-forn" data-in="opz" data-k="fornecedores" value="' + T.num(pz.fornecedores) + '"' + dis() + '></label>' +
      '<label class="f">Repasse de honorários (meses)<input class="inp n" id="o-pz-hon" data-in="opz" data-k="honorarios" value="' + T.num(pz.honorarios) + '"' + dis() + '></label>' +
      '<label class="f">Pagamento de impostos (meses)<input class="inp n" id="o-pz-imp" data-in="opz" data-k="impostos" value="' + T.num(pz.impostos) + '"' + dis() + '></label>' +
      '<label class="f">Saldo de caixa em 1º/jan (R$)<input class="inp n" id="o-si" data-in="osi" value="' + esc(inNum(T.num(o.saldoInicial))) + '"' + dis() + '></label>' +
      '</div><p class="note" style="margin-top:10px">Prazos em meses após a competência. Para janeiro, o caixa usa dezembro do próprio orçamento como estimativa dos saldos a receber e a pagar do ano anterior.</p></div>' +
      '<div class="card"><header><div><h2>Receitas · volume de atendimentos por mês</h2><p>' + Object.keys(vol).length + ' procedimentos orçados · ' + f0(sum(range(0, 11).map(function (m) { return R.aux.vol[m]; }))) + ' atendimentos no ano</p></div><div class="row">' + addSel + '<button class="btn" data-act="oadd"' + dis() + '>Adicionar</button></div></header>' +
      '<div class="tw" data-keep="orc-rec"><table class="t grid-in"><thead><tr><th class="stick">Procedimento</th>' + mh + '<th class="n">Volume</th><th class="n">Receita (R$)</th><th></th></tr></thead><tbody>' + (linhas || '<tr><td colspan="16" class="muted">Adicione os procedimentos que a clínica pretende vender.</td></tr>') + '</tbody>' +
      '<tfoot><tr><td class="stick">Receita bruta (R$)</td>' + recM.map(function (v) { return '<td class="n">' + f0(v) + '</td>'; }).join('') + '<td></td><td class="n">' + f0(sum(recM)) + '</td><td></td></tr></tfoot></table></div></div>' +
      '<div class="card"><header><div><h2>Despesas operacionais e resultado financeiro (R$)</h2><p>Valores por competência. Depreciação entra só na DRE; as demais também no caixa.</p></div></header><div class="tw" data-keep="orc-desp"><table class="t grid-in"><thead><tr><th class="stick">Linha da DRE</th>' + mh + '<th class="n">Total</th><th></th></tr></thead><tbody>' + despRows + '</tbody></table></div></div>' +
      '<div class="card"><header><div><h2>Investimentos e financiamentos (R$)</h2><p>Movimentos só de caixa, sem efeito na DRE.</p></div></header><div class="tw" data-keep="orc-cx"><table class="t grid-in"><thead><tr><th class="stick">Linha do fluxo de caixa</th>' + mh + '<th class="n">Total</th><th></th></tr></thead><tbody>' + cxRows + '</tbody></table></div></div>' +
      '</div>';
  }
  function kpi(lb, vl, sb, cls) { return '<div class="kpi ' + (cls || '') + '"><div class="lb">' + lb + '</div><div class="vl">' + vl + '</div><div class="sb">' + (sb || '') + '</div></div>'; }

  /* ================= DRE e DFC ================= */
  function dadosDem(kind, a) {
    var o = orcDoc(a), R = O(a), orcS = kind === 'dre' ? R.dre : R.dfc, real = realSerie(a, kind);
    return { o: o, orcS: orcS, real: real };
  }
  function fecha(kind, leaves, si) { return kind === 'dre' ? T.fechaDRE(leaves) : T.fechaDFC(leaves, si); }
  function siAte(kind, a, m0, base) { // saldo inicial do mês m0
    if (kind !== 'dfc') return 0;
    var o = orcDoc(a), si = T.num(o && o.saldoInicial), d = dadosDem('dfc', a);
    for (var m = 0; m < m0; m++) {
      if (base === 'orc') si += T.fechaDFC(T.somaMeses(d.orcS, [m]), 0)['var'];
      else if (d.real.has[m]) si += T.fechaDFC(T.somaMeses(d.real.v, [m]), 0)['var'];
    }
    return si;
  }
  function vDem(kind) {
    var a = ano(), d = dadosDem(kind, a), defs = kind === 'dre' ? T.DRE : T.DFC, ix = idxs();
    var ixR = ix.filter(function (m) { return d.real.has[m]; });
    var nome = kind === 'dre' ? 'DRE gerencial' : 'Fluxo de caixa (DFC)';
    var viewK = kind + 'View', baseK = kind + 'Base', vw = S.ui[viewK];
    var faltam = ix.filter(function (m) { return !d.real.has[m]; });
    var sub = kind === 'dre' ? 'Regime de competência · orçado do planejamento, realizado do ERP' : 'Regime de caixa (método direto) · orçado do planejamento, realizado do ERP';
    var ctl = anoCtl() + (vw === 'cmp' ? perCtl() : '') + seg(viewK, [['cmp', 'Orçado × realizado'], ['mensal', 'Mês a mês']], vw) + '<button class="btn" data-act="exp-' + kind + '">Exportar Excel</button>';
    var html = top(nome + ' · ' + a, sub, ctl) + '<div class="view">' + bannerEx();
    if (!d.o && !d.real.has.some(Boolean)) return html + '<div class="card empty"><h2>Sem orçamento e sem realizado para ' + a + '</h2><p class="note">Monte o orçamento no Planejamento ou importe o realizado na Integração ERP.</p><div class="row"><a class="btn pri" href="#orcamento">Abrir planejamento</a><a class="btn" href="#erp">Importar do ERP</a></div></div></div>';
    if (vw === 'cmp') {
      var siO = siAte(kind, a, ix[0], 'orc'), siR = siAte(kind, a, ix[0], 'real');
      var FO = fecha(kind, T.somaMeses(d.orcS, ix), siO), FR = fecha(kind, T.somaMeses(d.real.v, ixR), siR);
      var base = kind === 'dre' ? 'rb' : 'ent';
      var rows = defs.map(function (l) {
        if (kind === 'dfc' && l.id === 'si') { return linhaCmp(l, FO.si, FR.si, null, null); }
        var vo = FO[l.id], vr = ixR.length ? FR[l.id] : null;
        var out = linhaCmp(l, vo, vr, FO[base], FR[base], kind);
        if (l.k === 'leaf' && S.ui.open[kind + l.id] && ixR.length) out += detRows(kind, a, l, ixR);
        return out;
      }).join('');
      html += (faltam.length && S.ui.per !== 'mes' && ixR.length ? '<p class="note">Realizado disponível em ' + ixR.length + ' de ' + ix.length + ' meses do período (' + ixR.map(mesNome).join(', ') + '). O orçado considera todos os meses do período.</p>' : '') +
        (!ixR.length ? '<div class="banner"><span>Não há realizado importado para ' + esc(perLabel()) + '. A coluna realizado fica vazia até a importação do ERP.</span><a class="btn sm" href="#erp">Importar</a></div>' : '') +
        '<div class="tw"><table class="t dem"><thead><tr><th>' + esc(perLabel()) + '</th><th class="n">Orçado</th><th class="n">' + (kind === 'dre' ? '% RB' : '') + '</th><th class="n">Realizado</th><th class="n">' + (kind === 'dre' ? '% RB' : '') + '</th><th class="n">Variação R$</th><th class="n">Variação %</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="note">' + (kind === 'dre' ? 'Custos e deduções aparecem com sinal negativo. Variação verde é favorável ao resultado. Clique numa linha para ver as categorias do ERP que a compõem.' : 'Saídas aparecem com sinal negativo. Clique numa linha para ver as categorias do ERP que a compõem.') + '</p>';
    } else {
      var b = S.ui[baseK];
      var siBase = T.num(d.o && d.o.saldoInicial);
      var cols = range(0, 11).map(function (m) {
        var fo = fecha(kind, T.somaMeses(d.orcS, [m]), siAte(kind, a, m, 'orc')), fr = d.real.has[m] ? fecha(kind, T.somaMeses(d.real.v, [m]), siAte(kind, a, m, 'real')) : null;
        return { o: fo, r: fr };
      });
      var totO = fecha(kind, T.somaMeses(d.orcS, range(0, 11)), siBase), rIx = range(0, 11).filter(function (m) { return d.real.has[m]; });
      var totR = rIx.length ? fecha(kind, T.somaMeses(d.real.v, rIx), siBase) : null, totOR = fecha(kind, T.somaMeses(d.orcS, rIx), siBase);
      var mh = range(0, 11).map(function (m) { return '<th class="n">' + mesNome(m) + (d.real.has[m] ? '' : (b === 'orc' ? '' : '*')) + '</th>'; }).join('');
      var body = defs.map(function (l) {
        var cls = 'lv-' + l.k;
        function v(c) {
          if (b === 'orc') return T.exibe(l, c.o[l.id]);
          if (b === 'real') return c.r ? T.exibe(l, c.r[l.id]) : null;
          return c.r ? T.exibe(l, c.r[l.id]) - T.exibe(l, c.o[l.id]) : null;
        }
        var tds = cols.map(function (c) { var x = v(c); return '<td class="n' + (b === 'var' && x != null ? (x >= 0 ? ' pos' : ' neg') : '') + '">' + (x == null ? '—' : f0(x)) + '</td>'; }).join('');
        var tv;
        if (l.k === 'saldo') tv = l.id === 'si' ? (b === 'orc' ? totO.si : totR ? totR.si : null) : (b === 'orc' ? totO.sf : totR ? totR.sf : null);
        else tv = b === 'orc' ? T.exibe(l, totO[l.id]) : b === 'real' ? (totR ? T.exibe(l, totR[l.id]) : null) : (totR ? T.exibe(l, totR[l.id]) - T.exibe(l, totOR[l.id]) : null);
        if (l.k === 'saldo' && b === 'var') tv = null;
        return '<tr class="' + cls + '"><td class="stick">' + esc(l.n) + '</td>' + tds + '<td class="n"><b>' + (tv == null ? '—' : f0(tv)) + '</b></td></tr>';
      }).join('');
      html += '<div class="row">' + seg(baseK, [['real', 'Realizado'], ['orc', 'Orçado'], ['var', 'Variação (real − orçado)']], b) + '</div>' +
        '<div class="tw" data-keep="dem-' + kind + '"><table class="t dem"><thead><tr><th class="stick">R$</th>' + mh + '<th class="n">' + (b === 'orc' ? 'Ano' : 'Acumulado real') + '</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
        (b !== 'orc' ? '<p class="note">* mês sem realizado importado. O total acumulado soma só os meses com realizado' + (b === 'var' ? ' e compara com o orçado desses mesmos meses' : '') + '.</p>' : '');
    }
    return html + '</div>';
  }
  function linhaCmp(l, vo, vr, baseO, baseR, kind) {
    var dO = l.k === 'saldo' ? vo : T.exibe(l, vo), dR = vr == null ? null : (l.k === 'saldo' ? vr : T.exibe(l, vr));
    var diff = dR == null ? null : dR - dO, vp = diff == null || !dO ? null : diff / Math.abs(dO);
    var fav = dR == null ? null : T.favoravel(l, vo, vr);
    var chip = '';
    if (vp != null && Math.abs(vp) >= 0.1 && Math.abs(diff) >= 500 && l.k !== 'saldo') chip = '<span class="chip ' + (fav ? 'good' : 'bad') + '">' + (fav ? 'favorável' : 'atenção') + '</span>';
    var drill = l.k === 'leaf' && dR != null ? ' drill' + (S.ui.open[kind + l.id] ? ' open' : '') : '';
    var avO = kind === 'dre' && baseO ? pct(vo / baseO * (l.k === 'tot' ? 1 : 1)) : '', avR = kind === 'dre' && baseR && vr != null ? pct(vr / baseR) : '';
    return '<tr class="lv-' + l.k + drill + '"' + (drill ? ' data-act="drill" data-id="' + kind + l.id + '"' : '') + '><td>' + esc(l.n) + '</td><td class="n">' + f0(dO) + '</td><td class="n av">' + avO + '</td><td class="n">' + (dR == null ? '—' : f0(dR)) + '</td><td class="n av">' + avR + '</td>' +
      '<td class="n ' + (diff == null || Math.abs(diff) < 0.5 ? '' : fav ? 'pos' : 'neg') + '">' + (diff == null ? '—' : f0(diff)) + '</td><td class="n ' + (vp == null ? '' : fav ? 'pos' : 'neg') + '">' + (vp == null ? '—' : pct(vp)) + '</td><td>' + chip + '</td></tr>';
  }
  function detRows(kind, a, l, ixR) {
    var agg = {};
    ixR.forEach(function (m) { var d = realDoc(a, m); var det = d && d.det && d.det[kind] && d.det[kind][l.id]; if (det) Object.keys(det).forEach(function (c) { agg[c] = (agg[c] || 0) + det[c]; }); });
    var ks = Object.keys(agg).sort(function (x, y) { return Math.abs(agg[y]) - Math.abs(agg[x]); });
    if (!ks.length) return '<tr class="det"><td colspan="8">Sem detalhamento por categoria para este período.</td></tr>';
    return ks.map(function (c) { return '<tr class="det"><td>' + esc(c) + '</td><td></td><td></td><td class="n">' + f0(l.s * agg[c]) + '</td><td colspan="4"></td></tr>'; }).join('');
  }

  /* ================= Visão geral ================= */
  function vVisao() {
    var a = ano(), ix = idxs(), dre = dadosDem('dre', a), dfc = dadosDem('dfc', a), c = cfg();
    var ixR = ix.filter(function (m) { return dre.real.has[m]; }), temR = ixR.length > 0;
    var DO = T.fechaDRE(T.somaMeses(dre.orcS, ix)), DR = T.fechaDRE(T.somaMeses(dre.real.v, ixR));
    var siO = siAte('dfc', a, ix[0], 'orc'), siR = siAte('dfc', a, ix[0], 'real');
    var FO = T.fechaDFC(T.somaMeses(dfc.orcS, ix), siO), FR = T.fechaDFC(T.somaMeses(dfc.real.v, ix.filter(function (m) { return dfc.real.has[m]; })), siR);
    function tile(lb, lid, fo, fr, fmtv, extra) {
      var l = T.DRE_BY[lid] || T.DFC_BY[lid] || { k: 'tot', s: 1 }, vo = fo, vr = temR ? fr : null;
      var d = vr == null ? null : vr - vo, vp = d == null || !vo ? null : d / Math.abs(vo), fav = vr == null ? null : (l.k === 'leaf' || l.k === 'sum' ? l.s * d >= 0 : d >= 0);
      return '<div class="kpi ' + (vr == null ? '' : fav ? 'good' : 'bad') + '"><div class="lb">' + lb + '</div><div class="vl">' + (vr == null ? fmtv(vo) : fmtv(vr)) + '</div><div class="sb">' +
        (vr == null ? 'Orçado · sem realizado' : 'Orçado ' + fmtv(vo) + (vp != null ? ' <span class="chip ' + (fav ? 'good' : 'bad') + '">' + (d >= 0 ? '+' : '') + pct(vp) + '</span>' : '')) + (extra ? ' · ' + extra : '') + '</div></div>';
    }
    var mcp = temR ? (DR.rb ? DR.mc / DR.rb : 0) : (DO.rb ? DO.mc / DO.rb : 0), ebp = temR ? (DR.rb ? DR.ebitda / DR.rb : 0) : (DO.rb ? DO.ebitda / DO.rb : 0);
    var kp = '<div class="kpis">' + tile('Receita bruta', 'rb', DO.rb, DR.rb, R0) + tile('Margem de contribuição', 'mc', DO.mc, DR.mc, R0, pct(mcp) + ' da receita') + tile('EBITDA', 'ebitda', DO.ebitda, DR.ebitda, R0, 'margem ' + pct(ebp)) +
      tile('Resultado líquido', 'res', DO.res, DR.res, R0) + tile('Caixa operacional gerado', 'fco', FO.fco, FR.fco, R0) + tile('Saldo de caixa no fim do período', 'sf', FO.sf, FR.sf, R0) + '</div>';
    // gráficos
    var rbO = range(0, 11).map(function (m) { return T.fechaDRE(T.somaMeses(dre.orcS, [m])).rb; }), rbR = range(0, 11).map(function (m) { return dre.real.has[m] ? T.fechaDRE(T.somaMeses(dre.real.v, [m])).rb : null; });
    var ebO = range(0, 11).map(function (m) { return T.fechaDRE(T.somaMeses(dre.orcS, [m])).ebitda; }), ebR = range(0, 11).map(function (m) { return dre.real.has[m] ? T.fechaDRE(T.somaMeses(dre.real.v, [m])).ebitda : null; });
    var linhas = T.DRE_BY.rb.of.map(function (id) { return { n: T.DRE_BY[id].n, o: DO[id], r: temR ? DR[id] : null }; }).filter(function (x) { return x.o || x.r; });
    // desvios
    var desv = T.DRE_LEAVES.map(function (id) { var l = T.DRE_BY[id], o = DO[id], r = DR[id], d = r - o; return { l: l, o: o, r: r, d: d, fav: T.favoravel(l, o, r) }; })
      .filter(function (x) { return Math.abs(x.d) >= 1; }).sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); }).slice(0, 7);
    var desvHtml = temR ? '<table class="t"><thead><tr><th>Linha</th><th class="n">Orçado</th><th class="n">Realizado</th><th class="n">Variação</th></tr></thead><tbody>' + desv.map(function (x) {
      return '<tr><td>' + esc(x.l.n) + '</td><td class="n">' + f0(x.o) + '</td><td class="n">' + f0(x.r) + '</td><td class="n ' + (x.fav ? 'pos' : 'neg') + '">' + (x.d >= 0 ? '+' : '') + f0(x.d) + '</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="note">Importe o realizado para ver os desvios.</p>';
    // ponto de equilíbrio
    var base = temR ? DR : DO, nM = temR ? ixR.length : ix.length;
    var fixos = base.dop + base.dep + base.fin_desp - base.fin_rec + base.ir, mcpB = base.rb ? base.mc / base.rb : 0;
    var pe = mcpB > 0 ? fixos / mcpB / nM : null, rbMed = base.rb / nM, folga = pe ? rbMed / pe - 1 : null;
    // precificação
    var pr = precRows(), cnt = { sp: 0, neg: 0, meta: 0, ok: 0 }; pr.forEach(function (r) { cnt[r.st]++; });
    var porG = T.GRUPOS.map(function (g) { var xs = pr.filter(function (r) { return r.p.g === g.id && r.u.E > 0; }); var rec = sum(xs.map(function (r) { return r.u.E; })), mg = sum(xs.map(function (r) { return r.u.pix.mg; })); return { n: g.n, k: xs.length, mgp: rec ? mg / rec : null }; }).filter(function (x) { return x.k; });
    var piores = pr.filter(function (r) { return r.u.E > 0; }).sort(function (x, y) { return x.u.pix.mgp - y.u.pix.mgp; }).slice(0, 5);
    var precHtml = '<div class="row" style="margin-bottom:10px"><a class="chip bad" href="#precificacao" data-act="gost" data-v="neg">' + cnt.neg + ' com margem negativa</a><a class="chip warn" href="#precificacao" data-act="gost" data-v="meta">' + cnt.meta + ' abaixo da meta</a><a class="chip warn" href="#precificacao" data-act="gost" data-v="sp">' + cnt.sp + ' sem preço</a></div>' +
      hbarsPct(porG, c.meta) + '<h3 style="margin:14px 0 6px">Menores margens no PIX</h3><table class="t"><tbody>' + piores.map(function (r) { return '<tr class="click" data-act="gosel" data-id="' + r.p.id + '"><td class="nm"><span class="clip">' + esc(r.p.n) + '</span></td><td class="n">' + R2(r.u.E) + '</td><td class="n ' + (r.u.pix.mg < 0 ? 'neg' : '') + '">' + pct(r.u.pix.mgp) + '</td></tr>'; }).join('') + '</tbody></table>';
    return top('Desempenho da clínica', esc(perLabel() + (temR ? ' · realizado até ' + mesNome(ixR[ixR.length - 1]).toLowerCase() : ' · sem realizado importado')), anoCtl() + perCtl()) +
      '<div class="view">' + bannerEx() + kp +
      '<div class="grid g-21"><div class="card"><header><div><h2>Receita bruta mensal</h2><p>Barras claras: orçado · barras azuis: realizado</p></div></header>' + chartBars(rbO, rbR) + '</div>' +
      '<div class="card"><header><div><h2>Ponto de equilíbrio</h2><p>' + (temR ? 'Pelo realizado do período' : 'Pelo orçado do período') + '</p></div></header><div class="stack">' +
      '<div><div class="muted" style="font-size:12px">Receita mínima por mês</div><div class="bignum">' + (pe ? R0(pe) : '—') + '</div></div>' +
      '<div class="wf"><div class="ln"><span>Receita média do período</span><span class="num">' + R0(rbMed) + '</span></div><div class="ln"><span>Custos fixos médios</span><span class="num">' + R0(fixos / nM) + '</span></div><div class="ln"><span>Margem de contribuição</span><span class="num">' + pct(mcpB) + '</span></div>' +
      '<div class="ln tot"><span>Folga sobre o equilíbrio</span><span class="num ' + (folga < 0 ? 'neg' : 'pos') + '">' + (folga == null ? '—' : pct(folga)) + '</span></div></div></div></div></div>' +
      '<div class="grid g2"><div class="card"><header><div><h2>EBITDA mensal</h2><p>Tracejado: orçado · linha cheia: realizado</p></div></header>' + chartLines(ebO, ebR) + '</div>' +
      '<div class="card"><header><div><h2>Receita por linha de serviço</h2><p>' + esc(perLabel()) + ' · marcador: orçado</p></div></header>' + hbars(linhas) + '</div></div>' +
      '<div class="grid g2"><div class="card"><header><div><h2>Maiores desvios da DRE</h2><p>' + esc(perLabel()) + ', em R$</p></div><a class="btn ghost" href="#dre">Abrir DRE</a></header><div class="tw">' + desvHtml + '</div></div>' +
      '<div class="card"><header><div><h2>Precificação · pontos de atenção</h2><p>Margem média no PIX por linha · meta ' + pct(c.meta) + '</p></div><a class="btn ghost" href="#precificacao">Abrir precificação</a></header>' + precHtml + '</div></div>' +
      '</div>';
  }

  /* ================= Gráficos (SVG) ================= */
  function niceMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))); var ms = [1, 2, 2.5, 5, 10]; for (var i = 0; i < ms.length; i++) if (ms[i] * p >= v) return ms[i] * p; return 10 * p; }
  function chartBars(orc, real) {
    var W = 640, H = 230, L = 64, Rm = 8, Tp = 10, B = 24, iw = W - L - Rm, ih = H - Tp - B;
    var mx = niceMax(Math.max.apply(null, orc.concat(real.filter(ok)).concat([1])));
    function y(v) { return Tp + ih - Math.max(0, v) / mx * ih; }
    var g = '<g class="grid">' + [0, 0.25, 0.5, 0.75, 1].map(function (f) { var v = mx * f; return '<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + compact(v) + '</text>'; }).join('') + '</g>';
    var bw = iw / 12, bars = '';
    for (var m = 0; m < 12; m++) {
      var x0 = L + m * bw, o = orc[m] || 0, r = real[m];
      bars += '<rect class="b-orc" x="' + (x0 + bw * 0.12) + '" y="' + y(o) + '" width="' + (bw * 0.76) + '" height="' + (Tp + ih - y(o)) + '" rx="2"/>';
      if (ok(r)) bars += '<rect class="b-real" x="' + (x0 + bw * 0.3) + '" y="' + y(r) + '" width="' + (bw * 0.4) + '" height="' + (Tp + ih - y(r)) + '" rx="2"/>';
      bars += '<text x="' + (x0 + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + mesNome(m) + '</text>';
      bars += '<rect class="hit" x="' + x0 + '" y="' + Tp + '" width="' + bw + '" height="' + ih + '" data-tip="' + esc(mesNome(m) + '\nOrçado    ' + R0(o) + '\nRealizado ' + (ok(r) ? R0(r) + '\nVariação  ' + pct(o ? (r - o) / o : 0) : '—')) + '"/>';
    }
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Receita bruta mensal, orçado e realizado">' + g + bars + '</svg>';
  }
  function chartLines(orc, real) {
    var W = 640, H = 220, L = 64, Rm = 12, Tp = 12, B = 24, iw = W - L - Rm, ih = H - Tp - B;
    var vals = orc.concat(real.filter(ok)), mx = Math.max.apply(null, vals.concat([0])), mn = Math.min.apply(null, vals.concat([0]));
    var span = niceMax(Math.max(mx - mn, 1)), step = span / 4, lo = Math.floor(mn / step) * step, hi = lo + span; if (hi < mx) hi = lo + span * 1.25;
    function y(v) { return Tp + ih - (v - lo) / (hi - lo) * ih; }
    function x(m) { return L + (m + 0.5) * iw / 12; }
    var ticks = ''; for (var v = lo; v <= hi + 1e-6; v += (hi - lo) / 4) ticks += '<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + compact(v) + '</text>';
    var pO = orc.map(function (v, m) { return (m ? 'L' : 'M') + x(m) + ' ' + y(v); }).join('');
    var pts = real.map(function (v, m) { return ok(v) ? [x(m), y(v), v, m] : null; }).filter(Boolean);
    var pR = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join('');
    var area = pts.length > 1 ? '<path class="a-real" d="' + pR + 'L' + pts[pts.length - 1][0] + ' ' + y(Math.max(lo, 0)) + 'L' + pts[0][0] + ' ' + y(Math.max(lo, 0)) + 'Z"/>' : '';
    var dots = pts.map(function (p, i) { return '<circle class="d-real" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === pts.length - 1 ? 4.5 : 3) + '"/>'; }).join('');
    var hits = range(0, 11).map(function (m) { return '<rect class="hit" x="' + (L + m * iw / 12) + '" y="' + Tp + '" width="' + (iw / 12) + '" height="' + ih + '" data-tip="' + esc(mesNome(m) + '\nOrçado    ' + R0(orc[m]) + '\nRealizado ' + (ok(real[m]) ? R0(real[m]) : '—')) + '"/>'; }).join('');
    var labels = range(0, 11).map(function (m) { return '<text x="' + x(m) + '" y="' + (H - 6) + '" text-anchor="middle">' + mesNome(m) + '</text>'; }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="EBITDA mensal, orçado e realizado"><g class="grid">' + ticks + '</g>' + (lo < 0 ? '<line class="zero" x1="' + L + '" x2="' + (W - Rm) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>' : '') + area + '<path class="l-orc" d="' + pO + '"/><path class="l-real" d="' + pR + '"/>' + dots + labels + hits + '</svg>';
  }
  function hbars(rows) {
    if (!rows.length) return '<p class="note">Sem receita no período.</p>';
    var W = 640, rh = 30, L = 190, Rm = 80, H = rows.length * rh + 8, iw = W - L - Rm;
    var mx = niceMax(Math.max.apply(null, rows.map(function (r) { return Math.max(r.o || 0, r.r || 0); }).concat([1])));
    var s = rows.map(function (r, i) {
      var yy = i * rh + 4, wr = ok(r.r) ? Math.max(0, r.r) / mx * iw : 0, xo = L + Math.max(0, r.o || 0) / mx * iw;
      return '<text x="' + (L - 10) + '" y="' + (yy + 17) + '" text-anchor="end">' + esc(r.n) + '</text><rect class="b-orc" x="' + L + '" y="' + (yy + 6) + '" width="' + Math.max(0, (r.o || 0) / mx * iw) + '" height="16" rx="3"/>' +
        (ok(r.r) ? '<rect class="b-real" x="' + L + '" y="' + (yy + 9) + '" width="' + wr + '" height="10" rx="2"/>' : '') + '<line class="mk-orc" x1="' + xo + '" x2="' + xo + '" y1="' + (yy + 3) + '" y2="' + (yy + 25) + '"/>' +
        '<text class="lbl-strong" x="' + (L + iw + 8) + '" y="' + (yy + 17) + '">' + compact(ok(r.r) ? r.r : r.o) + '</text><rect class="hit" x="0" y="' + yy + '" width="' + W + '" height="' + rh + '" data-tip="' + esc(r.n + '\nOrçado    ' + R0(r.o) + '\nRealizado ' + (ok(r.r) ? R0(r.r) : '—')) + '"/>';
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Receita por linha de serviço">' + s + '</svg>';
  }
  function hbarsPct(rows, meta) {
    var W = 640, rh = 26, L = 190, Rm = 60, H = rows.length * rh + 22, iw = W - L - Rm, mx = 1;
    var xm = L + meta * iw;
    var s = rows.map(function (r, i) {
      var yy = i * rh + 4, v = Math.max(0, r.mgp || 0);
      return '<text x="' + (L - 10) + '" y="' + (yy + 15) + '" text-anchor="end">' + esc(r.n) + '</text><rect class="b-orc" x="' + L + '" y="' + (yy + 4) + '" width="' + iw + '" height="14" rx="3"/><rect class="b-real' + ((r.mgp || 0) < meta ? ' neg' : '') + '" x="' + L + '" y="' + (yy + 4) + '" width="' + (v / mx * iw) + '" height="14" rx="3"/>' +
        '<text class="lbl-strong" x="' + (L + iw + 8) + '" y="' + (yy + 15) + '">' + pct(r.mgp) + '</text><rect class="hit" x="0" y="' + yy + '" width="' + W + '" height="' + rh + '" data-tip="' + esc(r.n + '\n' + r.k + ' procedimentos com preço\nMargem média no PIX ' + pct(r.mgp)) + '"/>';
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Margem média por linha">' + s + '<line class="mk-orc" x1="' + xm + '" x2="' + xm + '" y1="0" y2="' + (H - 16) + '"/><text x="' + xm + '" y="' + (H - 3) + '" text-anchor="middle">meta ' + pct(meta) + '</text></svg>';
  }

  /* ================= Integração ERP ================= */
  var DESTINOS = (function () {
    var o = [['', 'Escolha o destino…']];
    T.DRE.filter(function (l) { return l.k === 'leaf'; }).forEach(function (l) { o.push([l.id, 'DRE · ' + l.n]); });
    ['inv_cap', 'fin_ent', 'fin_sai', 'fin_dist'].forEach(function (id) { o.push([id, 'Só caixa · ' + T.DFC_BY[id].n]); });
    o.push(['ign', 'Ignorar (transferências, aplicações)']);
    return o;
  })();
  var CAMPOS = [
    ['comp', 'Data de competência', /compet/],
    ['venc', 'Data de vencimento', /venc/],
    ['pag', 'Data de pagamento / recebimento', /pagamento|pago em|baixa|quitac|data.*receb|liquida|data do pag/],
    ['cat', 'Categoria (plano de contas)', /categoria|plano de conta|conta gerencial|classifica/],
    ['desc', 'Descrição', /descri|historico|observ/],
    ['val', 'Valor', /^valor|valor \(r\$\)|montante|^total/],
    ['tipo', 'Tipo (receita / despesa)', /^tipo|natureza|operac|entrada.*saida|receita.*despesa/],
    ['sit', 'Situação', /situac|status/]
  ];
  function vErp() {
    var a = ano(), I = S.ui.imp;
    var mb = range(0, 11).map(function (m) { var d = realDoc(a, m); return '<span class="' + (d ? (d.fonte === 'exemplo' ? 'ex' : 'erp') : '') + '" title="' + (d ? esc((d.fonte === 'exemplo' ? 'Exemplo' : 'ERP') + ' · ' + (d.arquivo || '') + ' · ' + (d.linhas || 0) + ' lançamentos') : 'Sem realizado') + '">' + mesNome(m) + '</span>'; }).join('');
    var ult = Object.keys(S.real).map(function (k) { return S.real[k]; }).filter(function (d) { return d.fonte === 'erp'; }).sort(function (x, y) { return (y.importadoEm || '').localeCompare(x.importadoEm || ''); })[0];
    var erps = [['A definir', 'A definir'], ['Conta Azul', 'Conta Azul'], ['Omie', 'Omie'], ['Klingo', 'Klingo'], ['Bling', 'Bling'], ['Outro', 'Outro']];
    var html = top('Integração com o ERP', 'Realizado da DRE e do fluxo de caixa a partir da exportação financeira do ERP da clínica', anoCtl()) + '<div class="view">' + roBanner() +
      '<div class="grid g2"><div class="card"><header><div><h2>Situação do realizado · ' + a + '</h2><p>Verde: importado do ERP · amarelo: exemplo · cinza: sem dados</p></div></header><div class="mesbar">' + mb + '</div>' +
      '<div class="row" style="margin-top:12px"><label class="f">ERP da clínica' + sel('erp-nome', erps, S.erpcfg.erp || 'A definir', 'data-in="erpnome"' + dis()) + '</label><p class="note" style="flex:1">' + (ult ? 'Última importação: ' + esc(ult.arquivo || '') + ' em ' + new Date(ult.importadoEm).toLocaleString('pt-BR') : 'Nenhuma importação do ERP ainda.') + '</p></div>' +
      (temExemplo() && Object.keys(S.real).some(function (k) { return S.real[k].fonte === 'exemplo'; }) ? '<div class="row" style="margin-top:10px"><button class="btn danger" data-act="erp-limpa"' + dis() + '>Remover realizado de exemplo</button></div>' : '') + '</div>' +
      '<div class="card"><header><h2>Como funciona a conexão</h2></header><div class="stack note" style="color:var(--ink)">' +
      '<p class="note">1. No ERP, exporte o relatório de lançamentos financeiros (contas pagas e recebidas) em Excel ou CSV, com data, categoria e valor. Exporte o período completo dos meses que quer atualizar.</p>' +
      '<p class="note">2. Envie o arquivo aqui. A plataforma reconhece as colunas e agrupa as categorias do plano de contas.</p>' +
      '<p class="note">3. Indique uma vez a linha da DRE de cada categoria. O de-para fica salvo e as próximas importações saem prontas.</p>' +
      '<p class="note">A DRE usa a data de competência; o fluxo de caixa usa a data de pagamento e ignora o que está em aberto. A página não acessa a API do ERP diretamente: a carga é feita pelo arquivo exportado.</p></div></div></div>';
    if (!I) {
      html += '<div class="card"><header><h2>Importar lançamentos do ERP</h2></header><label class="drop" id="drop" for="erp-file"><b>Arraste o arquivo aqui ou clique para escolher</b><span class="note">Excel (.xlsx, .xls) ou CSV · exportação de contas pagas e recebidas</span></label><input type="file" id="erp-file" accept=".xlsx,.xls,.csv,.txt" hidden data-in="erp-file"' + dis() + '></div>';
      html += deparaCard();
      return html + '</div>';
    }
    // passo 2: colunas
    var hdr = I.aoa[I.hr] || [];
    var colOpts = [['', '— não usar —']].concat(hdr.map(function (h, i) { return [i, (h == null || h === '' ? 'Coluna ' + (i + 1) : String(h))]; }));
    var campos = CAMPOS.map(function (c) { return '<label class="f">' + c[1] + sel('ic-' + c[0], colOpts, I.cols[c[0]] == null ? '' : I.cols[c[0]], 'data-in="icol" data-k="' + c[0] + '"') + '</label>'; }).join('');
    var prev = I.aoa.slice(I.hr + 1, I.hr + 7).map(function (r) { return '<tr>' + hdr.map(function (_, i) { var v = r[i]; return '<td>' + esc(v instanceof Date ? v.toLocaleDateString('pt-BR') : v == null ? '' : v) + '</td>'; }).join('') + '</tr>'; }).join('');
    var R = I.res || { cats: {}, meses: {}, n: 0, ign: 0 };
    var catRows = Object.keys(R.cats).sort(function (x, y) { return Math.abs(R.cats[y].t) - Math.abs(R.cats[x].t); }).map(function (k, i) {
      var c = R.cats[k], dest = I.dest[k] || '';
      return '<tr><td class="nm">' + esc(k) + '</td><td class="n">' + c.n + '</td><td class="n ' + (c.t < 0 ? 'neg' : '') + '">' + f0(c.t) + '</td><td>' + sel('dp-' + i, DESTINOS, dest, 'data-in="idest" data-cat="' + esc(k) + '"') + '</td><td>' + (S.depara[k] ? '<span class="chip info">salvo</span>' : '<span class="chip warn">sugestão</span>') + '</td></tr>';
    }).join('');
    var ms = Object.keys(R.meses).sort();
    var mesRows = ms.map(function (k) {
      var M = R.meses[k], ex = S.real[k], D = T.fechaDRE(M.dre), F = T.fechaDFC(M.dfc, 0);
      return '<tr><td><input type="checkbox" id="im-' + k + '" data-in="imes" data-k="' + k + '"' + (I.sel[k] ? ' checked' : '') + '></td><td><label for="im-' + k + '">' + MESES_LONGOS[+k.slice(5) - 1] + '/' + k.slice(0, 4) + '</label></td><td class="n">' + M.n + '</td><td class="n">' + f0(D.rb) + '</td><td class="n">' + f0(D.ebitda) + '</td><td class="n">' + f0(F['var']) + '</td><td>' + (ex ? '<span class="chip ' + (ex.fonte === 'exemplo' ? 'warn' : 'info') + '">substitui ' + (ex.fonte === 'exemplo' ? 'exemplo' : 'importação anterior') + '</span>' : '') + '</td></tr>';
    }).join('');
    var nSel = ms.filter(function (k) { return I.sel[k]; }).length, semDest = Object.keys(R.cats).filter(function (k) { return !I.dest[k]; }).length;
    html += '<div class="card steps"><div class="spread"><div class="step-h"><span class="no">1</span><h2>' + esc(I.nome) + '</h2></div><div class="row">' + (I.sheets.length > 1 ? sel('imp-sheet', I.sheets.map(function (s, i) { return [i, s.name]; }), I.sheet, 'data-in="isheet" aria-label="Aba"') : '') + '<button class="btn" data-act="imp-cancel">Cancelar</button></div></div>' +
      '<div class="step-h"><span class="no">2</span><h3>Colunas reconhecidas</h3><span class="note">' + R.n + ' lançamentos válidos' + (R.ign ? ' · ' + R.ign + ' linhas sem valor ou data ignoradas' : '') + '</span></div><div class="fields">' + campos + '</div>' +
      '<details><summary class="note">Ver as primeiras linhas do arquivo</summary><div class="tw" style="margin-top:8px"><table class="t"><thead><tr>' + hdr.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + prev + '</tbody></table></div></details>' +
      '<div class="step-h"><span class="no">3</span><h3>De-para das categorias do ERP</h3><span class="note">' + (semDest ? semDest + ' categoria(s) sem destino ficam fora da importação' : 'Todas as categorias têm destino') + '</span></div>' +
      '<div class="tw max" data-keep="dp"><table class="t"><thead><tr><th>Categoria no ERP</th><th class="n">Lançamentos</th><th class="n">Total (R$)</th><th>Destino na DRE / caixa</th><th></th></tr></thead><tbody>' + (catRows || '<tr><td colspan="5" class="muted">Indique a coluna de categoria e a de valor.</td></tr>') + '</tbody></table></div>' +
      '<div class="step-h"><span class="no">4</span><h3>Meses a importar</h3><span class="note">Cada mês marcado substitui o realizado já gravado</span></div>' +
      '<div class="tw"><table class="t"><thead><tr><th></th><th>Mês</th><th class="n">Lançamentos</th><th class="n">Receita bruta</th><th class="n">EBITDA</th><th class="n">Variação de caixa</th><th></th></tr></thead><tbody>' + (mesRows || '<tr><td colspan="7" class="muted">Nenhum mês reconhecido. Confira as colunas de data.</td></tr>') + '</tbody></table></div>' +
      '<div class="row"><button class="btn pri" data-act="imp-go"' + (nSel && S.canWrite ? '' : ' disabled') + '>Importar ' + nSel + ' ' + (nSel === 1 ? 'mês' : 'meses') + '</button><span class="note">O de-para usado nesta importação fica salvo para as próximas.</span></div></div>';
    return html + '</div>';
  }
  function deparaCard() {
    var ks = Object.keys(S.depara || {}).sort(function (x, y) { return x.localeCompare(y, 'pt-BR'); });
    if (!ks.length) return '';
    var rows = ks.map(function (k, i) { return '<tr><td class="nm">' + esc(k) + '</td><td>' + sel('dps-' + i, DESTINOS, S.depara[k], 'data-in="dpsave" data-cat="' + esc(k) + '"' + dis()) + '</td></tr>'; }).join('');
    return '<div class="card"><header><div><h2>De-para salvo</h2><p>' + ks.length + ' categorias do ERP já vinculadas às linhas da DRE e do caixa. Alterações valem para as próximas importações.</p></div></header><div class="tw max" data-keep="dps"><table class="t"><thead><tr><th>Categoria no ERP</th><th>Destino</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  function impCalc() {
    var I = S.ui.imp; if (!I) return;
    var c = I.cols, rows = [], cats = {}, ign = 0, sat = /aberto|pendente|vencid|a receber|a pagar|atrasad|previst|agendad/;
    for (var r = I.hr + 1; r < I.aoa.length; r++) {
      var row = I.aoa[r]; if (!row) continue;
      var val = c.val != null ? T.parseValor(row[c.val]) : NaN;
      if (isNaN(val) || val === 0) { if (row.some(function (x) { return x != null && x !== ''; })) ign++; continue; }
      var v = val;
      if (c.tipo != null && row[c.tipo] != null && row[c.tipo] !== '') {
        var tp = T.semAcento(row[c.tipo]).trim();
        if (/despesa|saida|pagar|debito|^d$|pagamento/.test(tp)) v = -Math.abs(val); else if (/receita|entrada|receber|credito|^c$|recebimento/.test(tp)) v = Math.abs(val);
      }
      var comp = (c.comp != null && T.parseMes(row[c.comp])) || (c.venc != null && T.parseMes(row[c.venc])) || (c.pag != null && T.parseMes(row[c.pag])) || null;
      if (!comp) { ign++; continue; }
      var aberto = c.sit != null && sat.test(T.semAcento(row[c.sit]));
      var caixa;
      if (aberto) caixa = null;
      else if (c.pag != null) caixa = T.parseMes(row[c.pag]);
      else if (c.sit != null) caixa = (c.venc != null && T.parseMes(row[c.venc])) || comp;
      else caixa = comp;
      var cat = c.cat != null && row[c.cat] != null && String(row[c.cat]).trim() ? String(row[c.cat]).trim() : '(sem categoria)';
      rows.push({ comp: comp, caixa: caixa, cat: cat, v: v });
      cats[cat] = cats[cat] || { n: 0, t: 0 }; cats[cat].n++; cats[cat].t += v;
    }
    Object.keys(cats).forEach(function (k) { if (I.dest[k] == null) I.dest[k] = S.depara[k] || T.sugereDestino(k, cats[k].t); });
    var meses = T.agregaRealizado(rows, I.dest);
    Object.keys(meses).forEach(function (k) { if (I.sel[k] == null) I.sel[k] = k.slice(0, 4) === String(ano()) || !Object.keys(meses).some(function (q) { return q.slice(0, 4) === String(ano()); }); });
    I.res = { cats: cats, meses: meses, n: rows.length, ign: ign };
  }
  function autoCols(hdr) {
    var cols = {}, used = {};
    var hs = hdr.map(function (h) { return T.semAcento(h == null ? '' : h).trim(); });
    CAMPOS.forEach(function (c) {
      for (var i = 0; i < hs.length; i++) { if (!used[i] && hs[i] && c[2].test(hs[i])) { cols[c[0]] = i; used[i] = 1; break; } }
    });
    if (cols.comp == null && cols.venc == null) { var di = hs.findIndex(function (h, i) { return !used[i] && /^data/.test(h); }); if (di >= 0) { cols.comp = di; used[di] = 1; } }
    if (cols.val == null) { var vi = hs.findIndex(function (h, i) { return !used[i] && /valor/.test(h); }); if (vi >= 0) cols.val = vi; }
    return cols;
  }
  function acharCabecalho(aoa) {
    for (var r = 0; r < Math.min(aoa.length, 40); r++) {
      var row = aoa[r] || [], txt = row.filter(function (x) { return typeof x === 'string' && x.trim(); }).map(T.semAcento);
      if (txt.length >= 3 && txt.some(function (t) { return /valor/.test(t); }) && txt.some(function (t) { return /data|venc|compet/.test(t); })) return r;
    }
    return 0;
  }
  function parseCSV(text) {
    var first = text.split(/\r?\n/)[0] || '', d = [';', ',', '\t'].sort(function (x, y) { return first.split(y).length - first.split(x).length; })[0];
    var out = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === d) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur || row.length) { row.push(cur); out.push(row); }
    return out.map(function (r) { return r.map(function (x) { var s = x.trim(); return s === '' ? null : s; }); });
  }
  var xlsxP = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxP) xlsxP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = function () { res(window.XLSX); }; s.onerror = function () { xlsxP = null; rej(new Error('Não foi possível carregar o leitor de Excel. Verifique a conexão.')); };
      document.head.appendChild(s);
    });
    return xlsxP;
  }
  function lerArquivo(file) {
    var nome = file.name || 'arquivo';
    if (/\.(csv|txt)$/i.test(nome)) {
      return file.arrayBuffer().then(function (buf) {
        var t = new TextDecoder('utf-8').decode(buf); if (t.indexOf(String.fromCharCode(0xFFFD)) >= 0) t = new TextDecoder('windows-1252').decode(buf);
        return [{ name: 'CSV', aoa: parseCSV(t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t) }];
      });
    }
    return Promise.all([loadXLSX(), file.arrayBuffer()]).then(function (r) {
      var X = r[0], wb = X.read(new Uint8Array(r[1]), { type: 'array', cellDates: true });
      return wb.SheetNames.map(function (n) { return { name: n, aoa: X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }) }; });
    });
  }
  function abrirImport(file) {
    if (!file) return;
    toast('Lendo ' + file.name + '…');
    lerArquivo(file).then(function (sheets) {
      var best = 0; sheets.forEach(function (s, i) { if (s.aoa.length > sheets[best].aoa.length) best = i; });
      S.ui.imp = { nome: file.name, sheets: sheets, sheet: best, dest: {}, sel: {} };
      prepSheet(); impCalc(); toast(null); render();
    }).catch(function (e) { toast('Não foi possível ler o arquivo: ' + (e && e.message || e)); });
  }
  function prepSheet() { var I = S.ui.imp; I.aoa = I.sheets[I.sheet].aoa; I.hr = acharCabecalho(I.aoa); I.cols = autoCols(I.aoa[I.hr] || []); }
  function importar() {
    var I = S.ui.imp; if (!I || !I.res || !S.canWrite) return;
    var ks = Object.keys(I.res.meses).filter(function (k) { return I.sel[k]; }).sort();
    if (!ks.length) return;
    var agora = iso(), seq = Promise.resolve();
    ks.forEach(function (k) {
      var M = I.res.meses[k];
      var doc = { ano: +k.slice(0, 4), mes: +k.slice(5), dre: M.dre, dfc: M.dfc, det: M.det, linhas: M.n, fonte: 'erp', erp: S.erpcfg.erp || 'A definir', arquivo: I.nome, importadoEm: agora, por: S.uid || null };
      seq = seq.then(function () { return write('realizado/' + k, doc); });
    });
    Object.keys(I.dest).forEach(function (c) { if (I.dest[c] && I.res.cats[c]) S.depara[c] = I.dest[c]; });
    seq.then(function () { return write('erp/depara', { map: S.depara }); }).then(function () {
      toast(ks.length + (ks.length === 1 ? ' mês importado' : ' meses importados') + ' de ' + I.nome + '.');
      S.ui.imp = null; S.ui.ano = +ks[ks.length - 1].slice(0, 4); S.ui.mes = null; render();
    });
  }

  /* ================= Premissas e base ================= */
  function vPrem() {
    var c = cfg();
    var html = top('Premissas e base de cálculo', 'Valem para a precificação, o orçamento e a análise de margem') + '<div class="view">' + roBanner() +
      '<div class="card"><header><h2>Clínica e tributação</h2></header><div class="fields">' +
      '<label class="f">Nome da clínica<input class="inp" id="c-nome" data-in="cnome" value="' + esc(c.clinica) + '"' + dis() + '></label>' +
      '<label class="f">Impostos sobre o faturamento (%)<input class="inp n" id="c-t" data-in="ct" value="' + esc(nf2.format(c.t * 100)) + '"' + dis() + '></label>' +
      '<label class="f">Taxa média de cartão (%)<input class="inp n" id="c-c" data-in="cc" value="' + esc(nf2.format(c.c * 100)) + '"' + dis() + '></label>' +
      '<label class="f">Meta de margem no PIX (%)<input class="inp n" id="c-meta" data-in="cmeta" value="' + esc(nf1.format(c.meta * 100)) + '"' + dis() + '></label>' +
      '<label class="f">Ano em foco<input class="inp n" id="c-ano" data-in="cano" value="' + esc(c.ano || ano()) + '"' + dis() + '></label></div></div>' +
      '<div class="card"><header><div><h2>Modelo de cálculo da margem</h2><p>Escolha como impostos, taxa de cartão e honorário incidem em cada procedimento.</p></div>' + (S.canWrite ? seg('cmodo', [['planilha', 'Planilha v6'], ['revisado', 'Revisado TBW']], c.modo) : '') + '</header>' +
      '<div class="grid g2"><div class="stack"><h3>Planilha v6 (padrão)</h3><p class="note">Reproduz a planilha da clínica célula a célula. Preço no cartão = preço PIX ÷ (1 − impostos − taxa). Imposto do PIX calculado “por dentro” (preço ÷ (1 − ' + pct(c.t) + ') × ' + pct(c.t) + ', ' + pct(c.t / (1 - c.t)) + ' efetivo). Honorário calculado sobre o preço de cartão nas duas formas de pagamento.</p></div>' +
      '<div class="stack"><h3>Revisado TBW</h3><p class="note">Impostos de ' + pct(c.t) + ' e taxa de cartão de ' + pct(c.c) + ' aplicados sobre o preço efetivamente cobrado. Honorário sobre o preço de cada forma de pagamento (PIX ou cartão). Tende a mostrar margem maior no PIX que a planilha.</p></div></div></div>' +
      '<div class="card"><header><div><h2>Base de precificação</h2><p>' + esc((S.procs || []).length + ' procedimentos e ' + (S.insumos || []).length + ' insumos · origem: ' + (c.origem || '—')) + '</p></div>' +
      '<label class="btn" for="base-file2">Importar nova versão da planilha</label><input type="file" id="base-file2" accept=".xlsx,.xlsm,.xls" hidden data-in="base-file"' + dis() + '></header>' +
      '<p class="note">A importação substitui preços, honorários, fichas técnicas e custos pelos da planilha nova (layout TBW). Classificação CMV/CSV e linha de receita são mantidas para os itens com o mesmo nome. Os volumes do orçamento continuam ligados pelo número de ordem do procedimento.</p></div>' +
      '</div>';
    return html;
  }
  function parseBase(file) {
    return Promise.all([loadXLSX(), file.arrayBuffer()]).then(function (r) {
      return lerPlanilha(r[0], new Uint8Array(r[1]), file.name, { insumos: S.insumos, procs: S.procs });
    }).then(function (b) { return { ins: b.insumos, procs: b.procs, t: b.t, c: b.c, nome: b.nome }; });
  }

  /* ================= Exportação ================= */
  function exportar(nome, sheets) {
    if (!S.dl) { toast('O download não está disponível nesta visualização. Abra a plataforma no claude.ai.'); return; }
    loadXLSX().then(function (X) {
      var wb = X.utils.book_new();
      sheets.forEach(function (s) { var ws = X.utils.aoa_to_sheet(s.aoa); ws['!cols'] = s.cols || [{ wch: 44 }].concat(s.aoa[0].slice(1).map(function () { return { wch: 14 }; })); X.utils.book_append_sheet(wb, ws, s.name.slice(0, 31)); });
      var buf = X.write(wb, { bookType: 'xlsx', type: 'array' });
      return S.dl.save({ filename: nome, data: new Uint8Array(buf) });
    }).then(function (r) { if (r) toast('Arquivo ' + nome + ' pronto.'); }).catch(function (e) { if (!e || e.code !== 'declined') toast('Não foi possível gerar o arquivo: ' + (e && e.message || e)); });
  }
  function rnd2(v) { return Math.round(v * 100) / 100; }
  function expDem(kind) {
    var a = ano(), d = dadosDem(kind, a), defs = kind === 'dre' ? T.DRE : T.DFC, ix = idxs(), ixR = ix.filter(function (m) { return d.real.has[m]; });
    var FO = fecha(kind, T.somaMeses(d.orcS, ix), siAte(kind, a, ix[0], 'orc')), FR = fecha(kind, T.somaMeses(d.real.v, ixR), siAte(kind, a, ix[0], 'real'));
    var cmp = [[perLabel(), 'Orçado', 'Realizado', 'Variação R$', 'Variação %']].concat(defs.map(function (l) {
      var o = l.k === 'saldo' ? FO[l.id] : T.exibe(l, FO[l.id]), r = ixR.length ? (l.k === 'saldo' ? FR[l.id] : T.exibe(l, FR[l.id])) : null;
      return [l.n, rnd2(o), r == null ? '' : rnd2(r), r == null ? '' : rnd2(r - o), r == null || !o ? '' : rnd2((r - o) / Math.abs(o) * 100) / 100];
    }));
    function mensal(base) {
      return [['R$'].concat(T.MESES)].concat(defs.map(function (l) {
        return [l.n].concat(range(0, 11).map(function (m) {
          if (base === 'real' && !d.real.has[m]) return '';
          var F = base === 'orc' ? fecha(kind, T.somaMeses(d.orcS, [m]), siAte(kind, a, m, 'orc')) : fecha(kind, T.somaMeses(d.real.v, [m]), siAte(kind, a, m, 'real'));
          return rnd2(l.k === 'saldo' ? F[l.id] : T.exibe(l, F[l.id]));
        }));
      }));
    }
    exportar((kind === 'dre' ? 'DRE' : 'DFC') + '_' + a + '_' + cfg().clinica.replace(/[^\wÀ-ú]+/g, '_') + '.xlsx', [{ name: 'Orçado x Realizado', aoa: cmp }, { name: 'Realizado mês a mês', aoa: mensal('real') }, { name: 'Orçado mês a mês', aoa: mensal('orc') }]);
  }
  function expPrec() {
    var rows = precRows();
    var aoa = [['Ordem', 'Procedimento', 'Linha', 'Preço PIX', 'Preço cartão', 'Impostos PIX', 'Impostos cartão', 'Taxa cartão', 'Honorário PIX', 'Honorário cartão', 'CMV', 'CSV insumos', 'Custo extra', 'Margem PIX', 'Margem PIX %', 'Margem cartão', 'Margem cartão %', 'Situação']].concat(rows.map(function (r) {
      var u = r.u; return [r.p.o, r.p.n, grupoNome(r.p.g), rnd2(u.E), rnd2(u.I), rnd2(u.F), rnd2(u.J), rnd2(u.Sc), rnd2(u.Np), rnd2(u.Nc), rnd2(u.cmv), rnd2(u.csvIns), rnd2(u.P), rnd2(u.pix.mg), Math.round(u.pix.mgp * 10000) / 10000, rnd2(u.car.mg), Math.round(u.car.mgp * 10000) / 10000, ST[r.st][0]];
    }));
    var im = insMap(), ficha = [['Ordem', 'Procedimento', 'Insumo', 'Classificação', 'Grupo', 'Qtd', 'Custo unit.', 'Total']];
    (S.procs || []).forEach(function (p) { (p.r || []).forEach(function (it) { var i = im[it[0]]; if (!i) return; ficha.push([p.o, p.n, i.n, T.CATS[i.cat].n, T.CATS[i.cat].grupo, it[1], rnd2(i.c), rnd2(it[1] * i.c)]); }); });
    exportar('Precificacao_' + cfg().clinica.replace(/[^\wÀ-ú]+/g, '_') + '.xlsx', [{ name: 'Precificação', aoa: aoa, cols: [{ wch: 7 }, { wch: 52 }, { wch: 24 }] }, { name: 'Fichas técnicas', aoa: ficha, cols: [{ wch: 7 }, { wch: 52 }, { wch: 36 }, { wch: 28 }] }]);
  }
  function expOrc() {
    var a = ano(), o = orcDoc(a); if (!o) return;
    var pm = procMap(), R = O(a);
    var vol = [['Procedimento'].concat(T.MESES, ['Total'])].concat(Object.keys(o.vol || {}).filter(function (k) { return pm[k]; }).map(function (k) { return [pm[k].n].concat(o.vol[k].map(T.num), [sum(o.vol[k])]); }));
    var dre = [['R$'].concat(T.MESES, ['Ano'])].concat(T.DRE.map(function (l) {
      var ms = range(0, 11).map(function (m) { return rnd2(T.exibe(l, T.fechaDRE(T.somaMeses(R.dre, [m]))[l.id])); });
      return [l.n].concat(ms, [rnd2(T.exibe(l, T.fechaDRE(T.somaMeses(R.dre, range(0, 11)))[l.id]))]);
    }));
    exportar('Orcamento_' + a + '.xlsx', [{ name: 'DRE orçada', aoa: dre }, { name: 'Volumes', aoa: vol }]);
  }

  /* ================= Administração TBW ================= */
  var ACT_ADM = {}, IN_ADM = {};
  S.adm = { ok: false, carregando: false, erro: null, clinicas: [], perfis: [], membros: [], novo: { tipo: 'clinica', papel: 'editor', clinica: '', senha: '' } };
  function admCarregar() {
    if (S.adm.carregando) return;
    S.adm.carregando = true;
    Promise.all([
      ctx.supa.from('clinicas').select('*').order('nome'),
      ctx.supa.from('perfis').select('*').order('nome'),
      ctx.supa.from('membros').select('*')
    ]).then(function (r) {
      var e = r.filter(function (x) { return x.error; })[0];
      S.adm.carregando = false; S.adm.ok = true;
      if (e) { S.adm.erro = e.error.message; } else { S.adm.erro = null; S.adm.clinicas = r[0].data || []; S.adm.perfis = r[1].data || []; S.adm.membros = r[2].data || []; }
      later(true);
    });
  }
  function senhaAleatoria() {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', a = new Uint32Array(10), out = '';
    crypto.getRandomValues(a); a.forEach(function (n) { out += abc[n % abc.length]; });
    return out;
  }
  function vAdmin() {
    var A = S.adm;
    if (!A.ok) { admCarregar(); return top('Administração TBW', 'Carregando clínicas e usuários…') + '<div class="view"><div class="card stack"><div class="skel"></div><div class="skel" style="width:70%"></div></div></div>'; }
    if (!A.novo.clinica && A.clinicas.length) A.novo.clinica = (ctx.clinica || A.clinicas[0]).id;
    if (!A.novo.senha) A.novo.senha = senhaAleatoria();
    var nUsu = {}; A.membros.forEach(function (m) { nUsu[m.clinica_id] = (nUsu[m.clinica_id] || 0) + 1; });
    var nomeClin = {}; A.clinicas.forEach(function (c) { nomeClin[c.id] = c.nome; });
    var clinOpts = A.clinicas.map(function (c) { return [c.id, c.nome]; });
    var clinRows = A.clinicas.map(function (c) {
      return '<tr><td class="nm"><input class="inp cell" id="ac-n-' + c.id + '" data-in="admclinnome" data-id="' + c.id + '" value="' + esc(c.nome) + '" aria-label="Nome da clínica"></td>' +
        '<td><span class="chip ' + (c.ativo ? 'good' : 'warn') + '">' + (c.ativo ? 'Ativa' : 'Inativa') + '</span></td><td class="n">' + (nUsu[c.id] || 0) + '</td><td class="muted">' + new Date(c.criado_em).toLocaleDateString('pt-BR') + '</td>' +
        '<td><div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-act="admabrir" data-id="' + c.id + '">Abrir</button><button class="btn ghost sm" data-act="admclinativo" data-id="' + c.id + '" data-v="' + (c.ativo ? 0 : 1) + '">' + (c.ativo ? 'Desativar' : 'Reativar') + '</button></div></td></tr>';
    }).join('');
    var userRows = A.perfis.map(function (p) {
      var ms = A.membros.filter(function (m) { return m.user_id === p.user_id; });
      var acesso = p.tbw_admin ? '<span class="chip info">Administrador TBW · todas as clínicas</span>' : (ms.length ? ms.map(function (m) {
        return '<span class="chip ' + (m.papel === 'editor' ? 'cmv' : 'csv') + '">' + esc(nomeClin[m.clinica_id] || 'Clínica') + ' · ' + (m.papel === 'editor' ? 'Edição' : 'Consulta') + ' <button class="x" data-act="admdesvinc" data-u="' + p.user_id + '" data-c="' + m.clinica_id + '" aria-label="Remover acesso">✕</button></span>';
      }).join(' ') : '<span class="muted">Sem clínica</span>');
      var eu = p.user_id === ctx.uid;
      return '<tr><td><b>' + esc(p.nome || '—') + '</b>' + (eu ? ' <span class="chip">você</span>' : '') + (p.trocar_senha ? ' <span class="chip warn">senha provisória</span>' : '') + '<br><span class="muted">' + esc(p.email) + '</span></td>' +
        '<td><div class="row" style="gap:4px">' + acesso + '</div></td><td><span class="chip ' + (p.ativo ? 'good' : 'bad') + '">' + (p.ativo ? 'Ativo' : 'Desativado') + '</span></td>' +
        '<td><div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-act="admsenha" data-id="' + p.user_id + '">Nova senha</button>' + (eu ? '' : '<button class="btn ghost sm' + (p.ativo ? ' danger' : '') + '" data-act="admativo" data-id="' + p.user_id + '" data-v="' + (p.ativo ? 0 : 1) + '">' + (p.ativo ? 'Desativar' : 'Reativar') + '</button>') + '</div></td></tr>';
    }).join('');
    var N = A.novo;
    var userOpts = A.perfis.filter(function (p) { return !p.tbw_admin; }).map(function (p) { return [p.user_id, (p.nome || p.email) + ' · ' + p.email]; });
    return top('Administração TBW', A.clinicas.length + ' clínicas · ' + A.perfis.length + ' usuários') + '<div class="view">' +
      (A.erro ? '<div class="banner"><span><b>Erro ao carregar.</b> ' + esc(A.erro) + '</span><button class="btn sm" data-act="admrecarregar">Tentar de novo</button></div>' : '') +
      '<div class="card"><header><div><h2>Clínicas</h2><p>Cada clínica tem dados isolados: precificação, orçamento, realizado e de-para do ERP.</p></div>' +
      '<div class="row"><input class="inp" id="adm-nova-clin" placeholder="Nome da nova clínica" style="width:260px"><button class="btn pri" data-act="admclincriar">Criar clínica</button></div></header>' +
      '<div class="tw"><table class="t"><thead><tr><th>Clínica</th><th>Situação</th><th class="n">Usuários</th><th>Criada em</th><th></th></tr></thead><tbody>' + (clinRows || '<tr><td colspan="5" class="muted">Nenhuma clínica ainda.</td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><header><div><h2>Novo usuário</h2><p>A pessoa entra com a senha provisória e define a própria senha no primeiro acesso.</p></div></header><div class="fields">' +
      '<label class="f">Nome<input class="inp" id="nu-nome" autocomplete="off"></label>' +
      '<label class="f">E-mail<input class="inp" id="nu-email" type="email" autocomplete="off"></label>' +
      '<label class="f">Senha provisória<input class="inp" id="nu-senha" value="' + esc(N.senha) + '" data-in="admnovo" data-k="senha"></label>' +
      '<label class="f">Tipo de acesso' + sel('nu-tipo', [['clinica', 'Usuário de clínica'], ['admin', 'Administrador TBW']], N.tipo, 'data-in="admnovo" data-k="tipo"') + '</label>' +
      (N.tipo === 'clinica' ? '<label class="f">Clínica' + sel('nu-clin', clinOpts.length ? clinOpts : [['', 'Crie uma clínica antes']], N.clinica, 'data-in="admnovo" data-k="clinica"') + '</label>' +
        '<label class="f">Permissão' + sel('nu-papel', [['editor', 'Edição'], ['leitura', 'Consulta']], N.papel, 'data-in="admnovo" data-k="papel"') + '</label>' : '') +
      '</div><div class="row" style="margin-top:12px"><button class="btn pri" data-act="admcriaruser">Criar usuário</button><button class="btn ghost" data-act="admgerar">Gerar outra senha</button><span class="note">Administrador TBW vê e edita todas as clínicas e gerencia usuários.</span></div></div>' +
      '<div class="card"><header><div><h2>Usuários</h2><p>Edição altera preços, orçamento e importa o ERP. Consulta só visualiza.</p></div></header>' +
      '<div class="tw"><table class="t"><thead><tr><th>Usuário</th><th>Acesso</th><th>Situação</th><th></th></tr></thead><tbody>' + (userRows || '<tr><td colspan="4" class="muted">Nenhum usuário.</td></tr>') + '</tbody></table></div>' +
      (userOpts.length && clinOpts.length ? '<div class="row" style="margin-top:12px"><span class="note">Dar acesso a outra clínica:</span>' + sel('vinc-u', userOpts, '', 'aria-label="Usuário"') + sel('vinc-c', clinOpts, '', 'aria-label="Clínica"') + sel('vinc-p', [['editor', 'Edição'], ['leitura', 'Consulta']], 'editor', 'aria-label="Permissão"') + '<button class="btn" data-act="admvinc">Vincular</button></div>' : '') +
      '</div></div>';
  }
  function admExec(p, okMsg) {
    return Promise.resolve(p).then(function (r) {
      if (r && r.error) throw r.error;
      if (okMsg) toast(okMsg);
      S.adm.ok = false; admCarregar();
      return r;
    }).catch(function (e) { toast('Não foi possível concluir: ' + (e && e.message || e)); });
  }
  Object.assign(ACT_ADM, {
    admrecarregar: function () { S.adm.ok = false; render(); },
    admclincriar: function () {
      var nome = (($('#adm-nova-clin') || {}).value || '').trim(); if (!nome) { toast('Informe o nome da clínica.'); return; }
      admExec(ctx.supa.from('clinicas').insert({ nome: nome }), 'Clínica ' + nome + ' criada. Abra a clínica e importe a planilha de precificação.');
    },
    admclinativo: function (b) { admExec(ctx.supa.from('clinicas').update({ ativo: b.dataset.v === '1' }).eq('id', b.dataset.id), 'Situação da clínica atualizada.'); },
    admabrir: function (b) { ctx.trocarClinica(b.dataset.id); },
    admgerar: function () { S.adm.novo.senha = senhaAleatoria(); render(); },
    admcriaruser: function () {
      var N = S.adm.novo, nome = ($('#nu-nome').value || '').trim(), email = ($('#nu-email').value || '').trim(), senha = ($('#nu-senha').value || '').trim();
      if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Informe nome e um e-mail válido.'); return; }
      if (senha.length < 8) { toast('A senha provisória precisa de pelo menos 8 caracteres.'); return; }
      if (N.tipo === 'clinica' && !N.clinica) { toast('Escolha a clínica do usuário.'); return; }
      var corpo = { acao: 'criar', nome: nome, email: email, senha: senha, tbw_admin: N.tipo === 'admin', clinica_id: N.tipo === 'clinica' ? N.clinica : null, papel: N.papel };
      toast('Criando usuário…');
      ctx.api(corpo).then(function () {
        S.adm.novo.senha = senhaAleatoria();
        confirmar('Usuário criado', 'Envie a ' + nome + ' o endereço da plataforma, o e-mail ' + email + ' e a senha provisória abaixo. No primeiro acesso a pessoa define a própria senha.', 'Fechar', null);
        S.ui.modal.input = senha; render();
        S.adm.ok = false; admCarregar();
      }).catch(function (e) { toast('Não foi possível criar: ' + e.message); });
    },
    admsenha: function (b) {
      var id = b.dataset.id, nova = senhaAleatoria();
      confirmar('Nova senha provisória', 'O usuário entra com esta senha e precisa trocá-la no próximo acesso. Ajuste se quiser e confirme.', 'Definir senha', function (v) {
        var s = (v || '').trim(); if (s.length < 8) { toast('A senha precisa de pelo menos 8 caracteres.'); return; }
        ctx.api({ acao: 'senha', user_id: id, senha: s }).then(function () { toast('Senha provisória definida. Envie ao usuário: ' + s); S.adm.ok = false; admCarregar(); }).catch(function (e) { toast('Não foi possível: ' + e.message); });
      });
      S.ui.modal.input = nova; render();
    },
    admativo: function (b) {
      var ativo = b.dataset.v === '1';
      ctx.api({ acao: 'ativo', user_id: b.dataset.id, ativo: ativo }).then(function () { toast(ativo ? 'Usuário reativado.' : 'Usuário desativado.'); S.adm.ok = false; admCarregar(); }).catch(function (e) { toast('Não foi possível: ' + e.message); });
    },
    admvinc: function () {
      var u = $('#vinc-u').value, c = $('#vinc-c').value, p = $('#vinc-p').value;
      admExec(ctx.supa.from('membros').upsert({ user_id: u, clinica_id: c, papel: p }), 'Acesso concedido.');
    },
    admdesvinc: function (b) {
      admExec(ctx.supa.from('membros').delete().eq('user_id', b.dataset.u).eq('clinica_id', b.dataset.c), 'Acesso removido.');
    }
  });
  Object.assign(IN_ADM, {
    admclinnome: function (t) { var n = t.value.trim(); if (n) admExec(ctx.supa.from('clinicas').update({ nome: n }).eq('id', t.dataset.id), 'Nome da clínica atualizado.'); },
    admnovo: function (t) { S.adm.novo[t.dataset.k] = t.value; if (t.dataset.k === 'tipo') render(); }
  });

  /* ================= Modal, toast e tooltip ================= */
  function overlays() {
    var h = '';
    if (S.ui.view === 'precificacao' && S.ui.sel) h += drawer();
    if (S.ui.modal) h += '<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true"><h2>' + esc(S.ui.modal.t) + '</h2><p>' + esc(S.ui.modal.m) + '</p>' + (S.ui.modal.input != null ? '<input class="inp" id="modal-in" value="' + esc(S.ui.modal.input) + '" aria-label="Valor">' : '') + '<div class="row" style="justify-content:flex-end">' + (S.ui.modal.fn ? '<button class="btn" data-act="mno">Cancelar</button>' : '') + '<button class="btn pri" data-act="myes">' + esc(S.ui.modal.ok || 'Confirmar') + '</button></div></div></div>';
    if (S.ui.toast) h += '<div class="toast" role="status">' + esc(S.ui.toast) + '</div>';
    return h;
  }
  var tTimer = 0;
  function toast(m) { S.ui.toast = m; clearTimeout(tTimer); if (m) tTimer = setTimeout(function () { S.ui.toast = null; later(true); }, 4200); later(true); }
  function confirmar(t, m, ok, fn) { S.ui.modal = { t: t, m: m, ok: ok, fn: fn }; render(); }
  var tip = null;
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) { if (tip) tip.style.display = 'none'; return; }
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); }
    tip.textContent = el.getAttribute('data-tip'); tip.style.display = 'block';
  });
  document.addEventListener('mousemove', function (e) {
    if (!tip || tip.style.display !== 'block') return;
    var w = tip.offsetWidth, h = tip.offsetHeight, x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  });

  /* ================= Ações ================= */
  function proc() { return procMap()[S.ui.sel]; }
  function editProc(fn) { var p = proc(); if (!p || !S.canWrite) return; fn(p); touch(); saveProcs(); later(true); }
  function orcAtual() { return orcDoc(ano()); }
  function editOrc(fn) { var o = orcAtual(); if (!o || !S.canWrite) return; fn(o); touch(); saveOrc(ano()); later(true); }
  function editCfg(fn) { if (!S.canWrite) return; S.cfg = S.cfg || {}; fn(S.cfg); touch(); saveCfg(); later(true); }
  function novoOrc(a, base, cresc) {
    var o;
    if (base) {
      o = clone(base); o.ano = a; o.exemplo = false; o.status = 'elaboracao';
      var f = 1 + (cresc || 0) / 100;
      Object.keys(o.vol || {}).forEach(function (k) { o.vol[k] = o.vol[k].map(function (v) { return Math.round(T.num(v) * f); }); });
      Object.keys(o.desp || {}).forEach(function (k) { o.desp[k] = o.desp[k].map(function (v) { return Math.round(T.num(v) * f); }); });
      var prevR = O(a - 1), si = T.num(base.saldoInicial);
      var dfcA = {}; T.DFC_LEAVES.forEach(function (id) { dfcA[id] = sum(prevR.dfc[id]); });
      o.saldoInicial = Math.round(T.fechaDFC(dfcA, si).sf);
    } else {
      o = { ano: a, exemplo: false, status: 'elaboracao', mixCartao: 0.6, prazos: { cartao: 1, fornecedores: 1, honorarios: 1, impostos: 1 }, saldoInicial: 0, vol: {}, desp: {}, caixa: {} };
    }
    S.orcs[String(a)] = o; touch(); saveOrc(a); render();
  }

  var ACT = {
    per: function (b) { S.ui.per = b.dataset.v; render(); },
    pforma: function (b) { S.ui.prec.forma = b.dataset.v; render(); },
    pst: function (b) { S.ui.prec.st = b.dataset.v; render(); },
    psort: function (b) { var k = b.dataset.k, P = S.ui.prec; if (P.sort === k) P.dir = -P.dir; else { P.sort = k; P.dir = /^(n|g)$/.test(k) || k === 'o' ? 1 : -1; } render(); },
    psel: function (b) { S.ui.sel = b.dataset.id; S.ui.meta = null; render(); },
    pclose: function () { S.ui.sel = null; render(); },
    gost: function (b, e) { e.preventDefault(); S.ui.prec.st = b.dataset.v; location.hash = '#precificacao'; },
    gosel: function (b) { S.ui.sel = b.dataset.id; location.hash = '#precificacao'; },
    rdel: function (b) { editProc(function (p) { p.r.splice(+b.dataset.i, 1); }); },
    radd: function () {
      var nome = ($('#r-add-ins') || {}).value || '', q = parseBR(($('#r-add-q') || {}).value || '1') || 1;
      var ins = (S.insumos || []).filter(function (i) { return i.n === nome.trim(); })[0];
      if (!ins) { toast('Escolha um insumo da lista.'); return; }
      editProc(function (p) { var ex = p.r.filter(function (it) { return it[0] === ins.id; })[0]; if (ex) ex[1] += q; else p.r.push([ins.id, q]); });
    },
    paplica: function (b) { var v = +b.dataset.v; editProc(function (p) { p.pr = v; }); toast('Preço PIX atualizado para ' + R2(v) + '.'); },
    inovo: function () {
      if (!S.canWrite) return; var mx = 0; (S.insumos || []).forEach(function (i) { mx = Math.max(mx, +i.id.slice(1) || 0); });
      var id = 'i' + String(mx + 1).padStart(3, '0'); S.insumos.unshift({ id: id, n: 'Novo insumo', u: 'unidade', c: 0, cat: 'med' });
      S.ui.ins = { q: '', cat: '' }; touch(); saveIns(); render(); var el = document.getElementById('in-' + id); if (el) { el.focus(); el.select(); }
    },
    oadd: function () { var id = ($('#o-add-sel') || {}).value; if (!id) { toast('Escolha um procedimento.'); return; } editOrc(function (o) { o.vol = o.vol || {}; o.vol[id] = T.z12(); }); },
    odel: function (b) { editOrc(function (o) { delete o.vol[b.dataset.id]; }); },
    orep: function (b) { var k = b.dataset.k, id = b.dataset.id; editOrc(function (o) { o[k] = o[k] || {}; var arr = o[k][id] || T.z12(); var v = T.num(arr[0]); o[k][id] = T.z12().map(function () { return v; }); }); },
    ocopia: function () { var a = ano(); novoOrc(a, orcDoc(a - 1), S.ui.orcCresc); },
    ovazio: function () { novoOrc(ano(), null); },
    dreView: function (b) { S.ui.dreView = b.dataset.v; render(); },
    dfcView: function (b) { S.ui.dfcView = b.dataset.v; render(); },
    dreBase: function (b) { S.ui.dreBase = b.dataset.v; render(); },
    dfcBase: function (b) { S.ui.dfcBase = b.dataset.v; render(); },
    drill: function (b) { var k = b.dataset.id; S.ui.open[k] = !S.ui.open[k]; render(); },
    'exp-dre': function () { expDem('dre'); }, 'exp-dfc': function () { expDem('dfc'); }, 'exp-prec': expPrec, 'exp-orc': expOrc,
    'imp-cancel': function () { S.ui.imp = null; render(); },
    'imp-go': function () {
      var I = S.ui.imp; if (!I || !I.res) return;
      var ks = Object.keys(I.res.meses).filter(function (k) { return I.sel[k]; });
      var subst = ks.filter(function (k) { return S.real[k]; });
      if (subst.length) confirmar('Substituir realizado já gravado?', subst.length + ' dos ' + ks.length + ' meses marcados já têm realizado (' + subst.join(', ') + '). Eles serão substituídos pelos dados deste arquivo.', 'Importar e substituir', importar);
      else importar();
    },
    'erp-limpa': function () {
      confirmar('Remover o realizado de exemplo?', 'Os meses marcados como exemplo serão apagados. O orçamento e a precificação não mudam.', 'Remover', function () {
        var ks = Object.keys(S.real).filter(function (k) { return S.real[k].fonte === 'exemplo'; });
        ks.reduce(function (p, k) { return p.then(function () { return del('realizado/' + k); }); }, Promise.resolve()).then(function () { toast(ks.length + ' meses de exemplo removidos.'); });
      });
    },
    cmodo: function (b) { editCfg(function (c) { c.modo = b.dataset.v; }); },
    mno: function () { S.ui.modal = null; render(); },
    myes: function () { var f = S.ui.modal && S.ui.modal.fn, inp = document.getElementById('modal-in'), v = inp ? inp.value : null; S.ui.modal = null; render(); if (f) f(v); },
    senha: function () { ctx.trocarSenha(); },
    sair: function () { ctx.sair(); }
  };

  var IN = {
    ano: function (t) { S.ui.ano = +t.value; S.ui.mes = null; render(); },
    trocaclin: function (t) { ctx.trocarClinica(t.value); },
    mes: function (t) { S.ui.mes = +t.value; if (S.ui.per === 'ano') S.ui.per = 'ytd'; render(); },
    pq: function (t) { S.ui.prec.q = t.value; render(); },
    pg: function (t) { S.ui.prec.g = t.value; render(); },
    ppr: function (t) { var v = Math.max(0, parseBR(t.value)); editProc(function (p) { p.pr = Math.round(v * 100) / 100; }); },
    ph: function (t) { var v = parseBR(t.value) / 100; editProc(function (p) { p.h = Math.min(0.95, Math.max(0, v)); }); },
    px: function (t) { var v = Math.max(0, parseBR(t.value)); editProc(function (p) { p.x = v; }); },
    pg2: function (t) { editProc(function (p) { p.g = t.value; }); },
    rq: function (t) { var v = parseBR(t.value); editProc(function (p) { var it = p.r[+t.dataset.i]; if (it) it[1] = v; }); },
    pmeta: function (t) { S.ui.meta = Math.min(0.95, Math.max(0, parseBR(t.value) / 100)); render(); },
    iq: function (t) { S.ui.ins.q = t.value; render(); },
    icatf: function (t) { S.ui.ins.cat = t.value; render(); },
    inome: function (t) { editIns(t, function (i) { i.n = t.value.trim() || i.n; }); },
    iun: function (t) { editIns(t, function (i) { i.u = t.value.trim(); }); },
    icus: function (t) { editIns(t, function (i) { i.c = Math.max(0, parseBR(t.value)); }); },
    icat: function (t) { editIns(t, function (i) { i.cat = t.value; }); },
    ovol: function (t) { editOrc(function (o) { o.vol[t.dataset.id] = o.vol[t.dataset.id] || T.z12(); o.vol[t.dataset.id][+t.dataset.m] = Math.max(0, Math.round(parseBR(t.value))); }); },
    odesp: function (t) { editOrc(function (o) { o.desp = o.desp || {}; o.desp[t.dataset.id] = o.desp[t.dataset.id] || T.z12(); o.desp[t.dataset.id][+t.dataset.m] = parseBR(t.value); }); },
    ocx: function (t) { editOrc(function (o) { o.caixa = o.caixa || {}; o.caixa[t.dataset.id] = o.caixa[t.dataset.id] || T.z12(); o.caixa[t.dataset.id][+t.dataset.m] = Math.max(0, parseBR(t.value)); }); },
    omix: function (t) { editOrc(function (o) { o.mixCartao = Math.min(1, Math.max(0, parseBR(t.value) / 100)); }); },
    opz: function (t) { editOrc(function (o) { o.prazos = o.prazos || {}; o.prazos[t.dataset.k] = Math.min(6, Math.max(0, Math.round(parseBR(t.value)))); }); },
    osi: function (t) { editOrc(function (o) { o.saldoInicial = parseBR(t.value); }); },
    ostatus: function (t) { editOrc(function (o) { o.status = t.value; o.exemplo = t.value === 'exemplo'; }); },
    ocresc: function (t) { S.ui.orcCresc = parseBR(t.value); },
    erpnome: function (t) { if (!S.canWrite) return; S.erpcfg = S.erpcfg || {}; S.erpcfg.erp = t.value; saveErpCfg(); },
    'erp-file': function (t) { abrirImport(t.files && t.files[0]); t.value = ''; },
    isheet: function (t) { S.ui.imp.sheet = +t.value; S.ui.imp.dest = {}; S.ui.imp.sel = {}; prepSheet(); impCalc(); render(); },
    icol: function (t) { var I = S.ui.imp; I.cols[t.dataset.k] = t.value === '' ? null : +t.value; I.sel = {}; impCalc(); render(); },
    idest: function (t) { var I = S.ui.imp; I.dest[t.dataset.cat] = t.value; impCalc(); render(); },
    imes: function (t) { S.ui.imp.sel[t.dataset.k] = t.checked; render(); },
    dpsave: function (t) { if (!S.canWrite) return; S.depara[t.dataset.cat] = t.value; saveDepara(); },
    cnome: function (t) { editCfg(function (c) { c.clinica = t.value.trim() || c.clinica; }); },
    ct: function (t) { editCfg(function (c) { c.t = Math.min(0.6, Math.max(0, parseBR(t.value) / 100)); }); },
    cc: function (t) { editCfg(function (c) { c.c = Math.min(0.3, Math.max(0, parseBR(t.value) / 100)); }); },
    cmeta: function (t) { editCfg(function (c) { c.meta = Math.min(0.95, Math.max(0, parseBR(t.value) / 100)); }); },
    cano: function (t) { var v = Math.round(parseBR(t.value)); if (v > 2000 && v < 2100) { editCfg(function (c) { c.ano = v; }); S.ui.ano = v; } },
    'base-file': function (t) {
      var f = t.files && t.files[0]; t.value = ''; if (!f || !S.canWrite) return;
      toast('Lendo ' + f.name + '…');
      parseBase(f).then(function (b) {
        var go = function () {
          S.insumos = b.ins; S.procs = b.procs; S.cfg = S.cfg || { clinica: ctx.clinica.nome, modo: 'planilha', meta: 0.35, ano: new Date().getFullYear() };
          if (b.t != null && isFinite(b.t)) S.cfg.t = b.t; if (b.c != null && isFinite(b.c)) S.cfg.c = b.c; S.cfg.origem = b.nome;
          touch(); write('base/insumos', { items: S.insumos, atualizadoEm: iso() }); write('base/procedimentos', { items: S.procs, atualizadoEm: iso() }); write('config/geral', S.cfg);
          toast('Base atualizada: ' + b.procs.length + ' procedimentos e ' + b.ins.length + ' insumos.'); render();
        };
        toast(null);
        if (S.procs) confirmar('Substituir a base de precificação?', b.nome + ' traz ' + b.procs.length + ' procedimentos e ' + b.ins.length + ' insumos. Preços, honorários, fichas técnicas e custos atuais serão substituídos.', 'Substituir base', go);
        else go();
      }).catch(function (e) { toast('Não foi possível importar a planilha: ' + (e && e.message || e) + '.'); });
    }
  };
  Object.assign(ACT, ACT_ADM); Object.assign(IN, IN_ADM);
  function editIns(t, fn) { if (!S.canWrite) return; var i = (S.insumos || []).filter(function (x) { return x.id === t.dataset.id; })[0]; if (!i) return; fn(i); touch(); saveIns(); later(true); }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'); if (!a) return;
    var f = ACT[a.dataset.act]; if (f) f(a, e);
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.in) return;
    if (t.dataset.in === 'pq' || t.dataset.in === 'iq') return;
    var f = IN[t.dataset.in]; if (f) f(t, e);
    if (S.ui.pend) later(true);
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t.dataset) return;
    if (t.dataset.in === 'pq' || t.dataset.in === 'iq') IN[t.dataset.in](t);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('inp') && e.target.tagName === 'INPUT') { e.target.blur(); }
    if (e.key === 'Escape') { if (S.ui.modal) { S.ui.modal = null; render(); } else if (S.ui.sel) { S.ui.sel = null; render(); } }
  });
  document.addEventListener('focusin', function (e) { if (e.target.classList && e.target.classList.contains('cell')) { try { e.target.select(); } catch (x) { } } });
  document.addEventListener('focusout', function () { setTimeout(function () { if (S.ui.pend) { var a = document.activeElement; if (!a || !/INPUT|TEXTAREA/.test(a.tagName)) later(true); } }, 0); });
  document.addEventListener('dragover', function (e) { var d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.add('on'); } });
  document.addEventListener('dragleave', function (e) { var d = e.target.closest && e.target.closest('#drop'); if (d) d.classList.remove('on'); });
  document.addEventListener('drop', function (e) { var d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.remove('on'); if (S.canWrite) abrirImport(e.dataTransfer.files[0]); } });

  boot();
}
