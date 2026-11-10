/* TBW Health — motor de cálculo (precificação, orçamento, DRE, DFC, realizado). Puro, sem dependências. */
var TBW = (function () {
  'use strict';

  var MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  var GRUPOS = [
    { id: 'con', n: 'Consultas', dre: 'rb_con' },
    { id: 'sor', n: 'Soroterapia e injetáveis', dre: 'rb_sor' },
    { id: 'imp', n: 'Implantes hormonais', dre: 'rb_imp' },
    { id: 'ita', n: 'Imunoterapia (ITA)', dre: 'rb_ita' },
    { id: 'est', n: 'Estética e regenerativa', dre: 'rb_est' },
    { id: 'tec', n: 'Tecnologias e terapias', dre: 'rb_tec' },
    { id: 'exa', n: 'Exames e testes', dre: 'rb_exa' },
    { id: 'out', n: 'Outros', dre: 'rb_out' }
  ];

  var CATS = {
    med: { n: 'Medicamentos e ativos', grupo: 'CMV', dre: 'cmv_med' },
    imp: { n: 'Implantes, kits e dispositivos', grupo: 'CMV', dre: 'cmv_imp' },
    mat: { n: 'Materiais e descartáveis', grupo: 'CMV', dre: 'cmv_mat' },
    exa: { n: 'Exames e testes terceirizados', grupo: 'CSV', dre: 'csv_exa' },
    cad: { n: 'Estrutura de atendimento', grupo: 'CSV', dre: 'csv_cad' }
  };

  // k: leaf | sum | tot ; s: sinal (+1 receita/entrada, -1 custo/saída)
  var DRE = [
    { id: 'rb', n: 'Receita bruta', k: 'sum', s: 1, of: ['rb_con', 'rb_sor', 'rb_imp', 'rb_ita', 'rb_est', 'rb_tec', 'rb_exa', 'rb_out'] },
    { id: 'rb_con', n: 'Consultas', k: 'leaf', s: 1 },
    { id: 'rb_sor', n: 'Soroterapia e injetáveis', k: 'leaf', s: 1 },
    { id: 'rb_imp', n: 'Implantes hormonais', k: 'leaf', s: 1 },
    { id: 'rb_ita', n: 'Imunoterapia (ITA)', k: 'leaf', s: 1 },
    { id: 'rb_est', n: 'Estética e regenerativa', k: 'leaf', s: 1 },
    { id: 'rb_tec', n: 'Tecnologias e terapias', k: 'leaf', s: 1 },
    { id: 'rb_exa', n: 'Exames e testes', k: 'leaf', s: 1 },
    { id: 'rb_out', n: 'Outras receitas', k: 'leaf', s: 1 },
    { id: 'ded', n: 'Deduções da receita', k: 'sum', s: -1, of: ['ded_imp', 'ded_tx', 'ded_dev'] },
    { id: 'ded_imp', n: 'Impostos sobre o faturamento', k: 'leaf', s: -1 },
    { id: 'ded_tx', n: 'Taxas de cartão', k: 'leaf', s: -1 },
    { id: 'ded_dev', n: 'Devoluções e cancelamentos', k: 'leaf', s: -1 },
    { id: 'rl', n: 'Receita líquida', k: 'tot', s: 1 },
    { id: 'cmv', n: 'CMV · custo das mercadorias', k: 'sum', s: -1, of: ['cmv_med', 'cmv_imp', 'cmv_mat'] },
    { id: 'cmv_med', n: 'Medicamentos e ativos', k: 'leaf', s: -1 },
    { id: 'cmv_imp', n: 'Implantes, kits e dispositivos', k: 'leaf', s: -1 },
    { id: 'cmv_mat', n: 'Materiais e descartáveis', k: 'leaf', s: -1 },
    { id: 'csv', n: 'CSV · custo dos serviços', k: 'sum', s: -1, of: ['csv_hon', 'csv_exa', 'csv_cad', 'csv_out'] },
    { id: 'csv_hon', n: 'Honorários médicos', k: 'leaf', s: -1 },
    { id: 'csv_exa', n: 'Exames e testes terceirizados', k: 'leaf', s: -1 },
    { id: 'csv_cad', n: 'Estrutura de atendimento', k: 'leaf', s: -1 },
    { id: 'csv_out', n: 'Outros custos diretos', k: 'leaf', s: -1 },
    { id: 'mc', n: 'Margem de contribuição', k: 'tot', s: 1 },
    { id: 'dop', n: 'Despesas operacionais', k: 'sum', s: -1, of: ['do_pes', 'do_pro', 'do_ocu', 'do_adm', 'do_mkt', 'do_man', 'do_out'] },
    { id: 'do_pes', n: 'Pessoal e encargos', k: 'leaf', s: -1 },
    { id: 'do_pro', n: 'Pró-labore', k: 'leaf', s: -1 },
    { id: 'do_ocu', n: 'Ocupação (aluguel, condomínio, energia)', k: 'leaf', s: -1 },
    { id: 'do_adm', n: 'Administrativas e sistemas', k: 'leaf', s: -1 },
    { id: 'do_mkt', n: 'Marketing e comercial', k: 'leaf', s: -1 },
    { id: 'do_man', n: 'Manutenção e equipamentos', k: 'leaf', s: -1 },
    { id: 'do_out', n: 'Outras despesas', k: 'leaf', s: -1 },
    { id: 'ebitda', n: 'EBITDA', k: 'tot', s: 1 },
    { id: 'dep', n: 'Depreciação e amortização', k: 'leaf', s: -1 },
    { id: 'fin_rec', n: 'Receitas financeiras', k: 'leaf', s: 1 },
    { id: 'fin_desp', n: 'Despesas financeiras', k: 'leaf', s: -1 },
    { id: 'ir', n: 'IRPJ e CSLL', k: 'leaf', s: -1 },
    { id: 'res', n: 'Resultado líquido', k: 'tot', s: 1 }
  ];

  var DFC = [
    { id: 'si', n: 'Saldo inicial de caixa', k: 'saldo', s: 1 },
    { id: 'ent', n: 'Entradas operacionais', k: 'sum', s: 1, of: ['ent_rec', 'ent_fin', 'ent_out'] },
    { id: 'ent_rec', n: 'Recebimentos de clientes', k: 'leaf', s: 1 },
    { id: 'ent_fin', n: 'Receitas financeiras', k: 'leaf', s: 1 },
    { id: 'ent_out', n: 'Outras entradas', k: 'leaf', s: 1 },
    { id: 'sai', n: 'Saídas operacionais', k: 'sum', s: -1, of: ['sai_forn', 'sai_hon', 'sai_terc', 'sai_tx', 'sai_imp', 'sai_pes', 'sai_desp', 'sai_fin'] },
    { id: 'sai_forn', n: 'Fornecedores (medicamentos e materiais)', k: 'leaf', s: -1 },
    { id: 'sai_hon', n: 'Repasse de honorários médicos', k: 'leaf', s: -1 },
    { id: 'sai_terc', n: 'Laboratórios e serviços diretos', k: 'leaf', s: -1 },
    { id: 'sai_tx', n: 'Taxas de cartão', k: 'leaf', s: -1 },
    { id: 'sai_imp', n: 'Impostos', k: 'leaf', s: -1 },
    { id: 'sai_pes', n: 'Pessoal, encargos e pró-labore', k: 'leaf', s: -1 },
    { id: 'sai_desp', n: 'Despesas operacionais', k: 'leaf', s: -1 },
    { id: 'sai_fin', n: 'Despesas financeiras', k: 'leaf', s: -1 },
    { id: 'fco', n: 'Fluxo de caixa operacional', k: 'tot', s: 1 },
    { id: 'inv', n: 'Investimentos', k: 'sum', s: -1, of: ['inv_cap'] },
    { id: 'inv_cap', n: 'Equipamentos, obras e instalações', k: 'leaf', s: -1 },
    { id: 'fcf', n: 'Fluxo de financiamentos', k: 'tot', s: 1 },
    { id: 'fin_ent', n: 'Captação de empréstimos', k: 'leaf', s: 1 },
    { id: 'fin_sai', n: 'Amortização de empréstimos', k: 'leaf', s: -1 },
    { id: 'fin_dist', n: 'Distribuição de lucros', k: 'leaf', s: -1 },
    { id: 'var', n: 'Variação de caixa no período', k: 'tot', s: 1 },
    { id: 'sf', n: 'Saldo final de caixa', k: 'saldo', s: 1 }
  ];

  var DRE_BY = {}; DRE.forEach(function (l) { DRE_BY[l.id] = l; });
  var DFC_BY = {}; DFC.forEach(function (l) { DFC_BY[l.id] = l; });
  var DRE_LEAVES = DRE.filter(function (l) { return l.k === 'leaf'; }).map(function (l) { return l.id; });
  var DFC_LEAVES = DFC.filter(function (l) { return l.k === 'leaf'; }).map(function (l) { return l.id; });

  // Linha da DRE -> linha da DFC (realizado vindo do ERP)
  var DRE2DFC = {
    rb_con: 'ent_rec', rb_sor: 'ent_rec', rb_imp: 'ent_rec', rb_ita: 'ent_rec', rb_est: 'ent_rec', rb_tec: 'ent_rec', rb_exa: 'ent_rec', rb_out: 'ent_rec',
    ded_imp: 'sai_imp', ded_tx: 'sai_tx', ded_dev: 'ent_rec',
    cmv_med: 'sai_forn', cmv_imp: 'sai_forn', cmv_mat: 'sai_forn',
    csv_hon: 'sai_hon', csv_exa: 'sai_terc', csv_cad: 'sai_terc', csv_out: 'sai_terc',
    do_pes: 'sai_pes', do_pro: 'sai_pes', do_ocu: 'sai_desp', do_adm: 'sai_desp', do_mkt: 'sai_desp', do_man: 'sai_desp', do_out: 'sai_desp',
    dep: null, fin_rec: 'ent_fin', fin_desp: 'sai_fin', ir: 'sai_imp'
  };
  // Destinos só de caixa (não entram na DRE)
  var SO_CAIXA = { inv_cap: 1, fin_ent: 1, fin_sai: 1, fin_dist: 1 };

  // Linhas de despesa digitadas no orçamento (DRE) e de caixa
  var ORC_DESP = ['do_pes', 'do_pro', 'do_ocu', 'do_adm', 'do_mkt', 'do_man', 'do_out', 'dep', 'fin_rec', 'fin_desp', 'ir'];
  var ORC_CAIXA = ['inv_cap', 'fin_ent', 'fin_sai', 'fin_dist'];

  function r2(x) { var s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 100 + 1e-7) / 100; }
  function z12() { return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function insMapOf(insumos) { var m = {}; (insumos || []).forEach(function (i) { m[i.id] = i; }); return m; }
  function procMapOf(procs) { var m = {}; (procs || []).forEach(function (p) { m[p.id] = p; }); return m; }
  function grupoDre(g) { for (var i = 0; i < GRUPOS.length; i++) if (GRUPOS[i].id === g) return GRUPOS[i].dre; return 'rb_out'; }

  /* ---------- Precificação unitária ----------
     modo 'planilha': reproduz a planilha v6 célula a célula.
     modo 'revisado': impostos e taxa de cartão sobre o preço praticado; honorário sobre o preço de cada forma. */
  function unit(p, cfg, insMap) {
    var t = num(cfg.t), c = num(cfg.c), E = num(p.pr), h = num(p.h), P = num(p.x);
    var cat = { med: 0, imp: 0, mat: 0, exa: 0, cad: 0 }, O = 0;
    (p.r || []).forEach(function (it) {
      var i = insMap[it[0]]; if (!i) return;
      var v = num(it[1]) * num(i.c); O += v; cat[i.cat] = (cat[i.cat] || 0) + v;
    });
    // preço no cartão: fator fixo sobre o PIX (ex.: tabela 10x = PIX × 1,137) ou calculado por dentro dos impostos e da taxa
    var I = num(cfg.fc) > 0 ? E * num(cfg.fc) : E / (1 - (t + c));
    var F, J, Sc, Np, Nc;
    if (cfg.modo === 'revisado') { F = E * t; J = I * t; Sc = I * c; Np = E * h; Nc = I * h; }
    else {
      F = r2(E / (1 - t) * t);
      var G = r2((E + F) / (1 - c) * c);
      J = r2(I * t); Sc = G; Np = Nc = r2(I * h);
    }
    var cmv = cat.med + cat.imp + cat.mat, csvIns = cat.exa + cat.cad;
    var pixCusto = F + Np + O + P, carCusto = J + Sc + Nc + O + P;
    var pix = { rec: E, imp: F, tx: 0, hon: Np, cmv: cmv, csv: Np + csvIns + P, custo: pixCusto, mg: r2(E - pixCusto) };
    var car = { rec: I, imp: J, tx: Sc, hon: Nc, cmv: cmv, csv: Nc + csvIns + P, custo: carCusto, mg: r2(I - carCusto) };
    pix.mgp = E ? pix.mg / E : 0; car.mgp = I ? car.mg / I : 0;
    return { E: E, I: I, F: F, J: J, Sc: Sc, Np: Np, Nc: Nc, O: O, P: P, cat: cat, cmv: cmv, csvIns: csvIns, pix: pix, car: car };
  }

  // Preço PIX que entrega a margem-alvo m (fração). null = impossível; 'livre' = sem custo direto
  function precoAlvo(p, cfg, insMap, m) {
    var u = unit(p, cfg, insMap), t = num(cfg.t), c = num(cfg.c), h = num(p.h);
    var fixo = u.O + u.P;
    var den = cfg.modo === 'revisado' ? (1 - t - h - m) : (1 - t / (1 - t) - h / (1 - t - c) - m);
    if (den <= 0) return null;
    if (fixo <= 0) return 'livre';
    return Math.ceil(fixo / den * 100) / 100;
  }

  /* ---------- Orçamento ---------- */
  function lag(serie, k) {
    k = Math.max(0, Math.round(num(k)));
    var out = z12();
    for (var m = 0; m < 12; m++) { var j = m - k; out[m] = j >= 0 ? serie[j] : serie[12 + j]; }
    return out;
  }

  function orcado(orc, procs, insumos, cfg) {
    var dre = {}; DRE_LEAVES.forEach(function (id) { dre[id] = z12(); });
    var dfc = {}; DFC_LEAVES.forEach(function (id) { dfc[id] = z12(); });
    var aux = { recPix: z12(), recCar: z12(), tx: z12(), cmv: z12(), hon: z12(), imp: z12(), vol: z12() };
    if (!orc) return { dre: dre, dfc: dfc, aux: aux };
    var pm = procMapOf(procs), im = insMapOf(insumos);
    var mixC = Math.min(1, Math.max(0, num(orc.mixCartao)));
    var vol = orc.vol || {};
    Object.keys(vol).forEach(function (pid) {
      var p = pm[pid]; if (!p) return;
      var u = unit(p, cfg, im), g = grupoDre(p.g), arr = vol[pid] || [];
      for (var m = 0; m < 12; m++) {
        var v = num(arr[m]); if (!v) continue;
        var vp = v * (1 - mixC), vc = v * mixC;
        dre[g][m] += vp * u.E + vc * u.I;
        dre.ded_imp[m] += vp * u.F + vc * u.J;
        dre.ded_tx[m] += vc * u.Sc;
        dre.cmv_med[m] += v * u.cat.med; dre.cmv_imp[m] += v * u.cat.imp; dre.cmv_mat[m] += v * u.cat.mat;
        dre.csv_hon[m] += vp * u.Np + vc * u.Nc;
        dre.csv_exa[m] += v * u.cat.exa; dre.csv_cad[m] += v * u.cat.cad; dre.csv_out[m] += v * u.P;
        aux.recPix[m] += vp * u.E; aux.recCar[m] += vc * u.I; aux.tx[m] += vc * u.Sc; aux.vol[m] += v;
      }
    });
    var desp = orc.desp || {};
    ORC_DESP.forEach(function (id) { var a = desp[id] || []; for (var m = 0; m < 12; m++) dre[id][m] += num(a[m]); });

    var pz = orc.prazos || {};
    for (var m = 0; m < 12; m++) {
      aux.cmv[m] = dre.cmv_med[m] + dre.cmv_imp[m] + dre.cmv_mat[m];
      aux.hon[m] = dre.csv_hon[m];
      aux.imp[m] = dre.ded_imp[m] + dre.ir[m];
    }
    var recCarL = lag(aux.recCar, pz.cartao), txL = lag(aux.tx, pz.cartao), cmvL = lag(aux.cmv, pz.fornecedores),
      honL = lag(aux.hon, pz.honorarios), impL = lag(aux.imp, pz.impostos);
    var caixa = orc.caixa || {};
    for (m = 0; m < 12; m++) {
      dfc.ent_rec[m] = aux.recPix[m] + recCarL[m] - dre.ded_dev[m];
      dfc.ent_fin[m] = dre.fin_rec[m];
      dfc.sai_forn[m] = cmvL[m];
      dfc.sai_hon[m] = honL[m];
      dfc.sai_terc[m] = dre.csv_exa[m] + dre.csv_cad[m] + dre.csv_out[m];
      dfc.sai_tx[m] = txL[m];
      dfc.sai_imp[m] = impL[m];
      dfc.sai_pes[m] = dre.do_pes[m] + dre.do_pro[m];
      dfc.sai_desp[m] = dre.do_ocu[m] + dre.do_adm[m] + dre.do_mkt[m] + dre.do_man[m] + dre.do_out[m];
      dfc.sai_fin[m] = dre.fin_desp[m];
      ORC_CAIXA.forEach(function (id) { dfc[id][m] += num((caixa[id] || [])[m]); });
    }
    return { dre: dre, dfc: dfc, aux: aux };
  }

  /* ---------- Fechamento das demonstrações ---------- */
  // leaves: {id: valor} -> {id: valor} com somas e totais
  function fechaDRE(v) {
    var o = {}; DRE_LEAVES.forEach(function (id) { o[id] = num(v && v[id]); });
    DRE.forEach(function (l) { if (l.k === 'sum') o[l.id] = l.of.reduce(function (a, id) { return a + o[id]; }, 0); });
    o.rl = o.rb - o.ded;
    o.mc = o.rl - o.cmv - o.csv;
    o.ebitda = o.mc - o.dop;
    o.res = o.ebitda - o.dep + o.fin_rec - o.fin_desp - o.ir;
    return o;
  }
  function fechaDFC(v, si) {
    var o = {}; DFC_LEAVES.forEach(function (id) { o[id] = num(v && v[id]); });
    DFC.forEach(function (l) { if (l.k === 'sum') o[l.id] = l.of.reduce(function (a, id) { return a + o[id]; }, 0); });
    o.fco = o.ent - o.sai;
    o.fcf = o.fin_ent - o.fin_sai - o.fin_dist;
    o['var'] = o.fco - o.inv + o.fcf;
    o.si = num(si); o.sf = o.si + o['var'];
    return o;
  }
  // Valor exibido com sinal (custos negativos)
  function exibe(linha, valor) { return (linha.k === 'leaf' || linha.k === 'sum') ? linha.s * valor : valor; }
  function favoravel(linha, orc, real) { var d = real - orc; return linha.k === 'saldo' || linha.k === 'tot' ? d >= 0 : linha.s * d >= 0; }

  function somaMeses(serieObj, idxs) { // {id:[12]} -> {id: soma nos meses idxs}
    var o = {}; Object.keys(serieObj).forEach(function (id) { o[id] = idxs.reduce(function (a, m) { return a + num(serieObj[id][m]); }, 0); });
    return o;
  }

  /* ---------- Realizado (ERP) ---------- */
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  var REGRAS_REC = [
    [/consult|retorno|teleconsult/, 'rb_con'],
    [/soro|injet|vitamina|tirzepat|mounjaro|endoven|infus/, 'rb_sor'],
    [/implante|pellet|hormon/, 'rb_imp'],
    [/\bita\b|imunoterap|vacina/, 'rb_ita'],
    [/mesoterap|\bprp\b|estetic|radiofreq|botox|preench|bioestim/, 'rb_est'],
    [/laser|ozon|reac|tecnolog|terapia/, 'rb_tec'],
    [/exame|teste|nutrigen|bioimped|mineralogr|oligoscan|polissono/, 'rb_exa'],
    [/rendiment|juros receb|aplicac/, 'fin_rec'],
    [/emprestimo|financiamento/, 'fin_ent'],
    [/transfer|resgate/, 'ign']
  ];
  var REGRAS_DESP = [
    [/irpj|csll/, 'ir'],
    [/simples|\bdas\b|\biss\b|\bpis\b|cofins|imposto|tributo/, 'ded_imp'],
    [/taxa.*cart|maquin|adquir|stone|cielo|getnet|pagseguro|mercado ?pago|\brede\b/, 'ded_tx'],
    [/devoluc|estorno|reembolso/, 'ded_dev'],
    [/implant|pellet|\bkit|dispositiv/, 'cmv_imp'],
    [/medicament|farmac|ativo|manipul|drogar/, 'cmv_med'],
    [/material|descart|hospitalar|seringa|luva|insumo/, 'cmv_mat'],
    [/honorar|repasse|medico/, 'csv_hon'],
    [/laborat|exame/, 'csv_exa'],
    [/pro.?labore/, 'do_pro'],
    [/salari|folha|inss|fgts|encargo|ferias|13|vale|benefic|rescis|pessoal/, 'do_pes'],
    [/aluguel|condomin|energia|\bluz\b|agua|iptu|ocupac/, 'do_ocu'],
    [/contab|bpo|sistema|software|internet|telefon|escritorio|cartorio|advog|administr/, 'do_adm'],
    [/marketing|publicid|anuncio|trafego|google|meta ads|instagram|agencia|comercial/, 'do_mkt'],
    [/manutenc|reparo|conserto/, 'do_man'],
    [/deprecia|amortiza/, 'dep'],
    [/juros|iof|tarifa|multa|financeir/, 'fin_desp'],
    [/distribui|lucros|dividend/, 'fin_dist'],
    [/emprestimo|financiamento|parcela banc/, 'fin_sai'],
    [/equipamento|imobilizado|obra|reforma|mobili/, 'inv_cap'],
    [/transfer|aplicac/, 'ign']
  ];
  function sugereDestino(categoria, total) {
    var s = semAcento(categoria), regras = total >= 0 ? REGRAS_REC : REGRAS_DESP;
    for (var i = 0; i < regras.length; i++) if (regras[i][0].test(s)) return regras[i][1];
    return total >= 0 ? 'rb_out' : 'do_out';
  }

  // linhas: [{comp:'AAAA-MM', caixa:'AAAA-MM'|null, cat, v}] ; depara: {cat: destino}
  function agregaRealizado(linhas, depara) {
    var meses = {};
    function mes(k) {
      if (!meses[k]) meses[k] = { dre: {}, dfc: {}, det: { dre: {}, dfc: {} }, n: 0 };
      return meses[k];
    }
    function add(obj, det, id, cat, val) {
      obj[id] = (obj[id] || 0) + val;
      det[id] = det[id] || {}; det[id][cat] = (det[id][cat] || 0) + val;
    }
    (linhas || []).forEach(function (l) {
      var dest = depara[l.cat]; if (!dest || dest === 'ign') return;
      if (DRE_BY[dest] && DRE_BY[dest].k === 'leaf') {
        if (l.comp) { var M = mes(l.comp); add(M.dre, M.det.dre, dest, l.cat, DRE_BY[dest].s * l.v); M.n++; }
        var d2 = DRE2DFC[dest];
        if (d2 && l.caixa) { var C = mes(l.caixa); add(C.dfc, C.det.dfc, d2, l.cat, DFC_BY[d2].s * l.v); if (l.caixa !== l.comp) C.n++; }
      } else if (SO_CAIXA[dest] && l.caixa) {
        var K = mes(l.caixa); add(K.dfc, K.det.dfc, dest, l.cat, DFC_BY[dest].s * l.v); K.n++;
      }
    });
    Object.keys(meses).forEach(function (k) {
      var M = meses[k];
      Object.keys(M.dre).forEach(function (id) { M.dre[id] = r2(M.dre[id]); });
      Object.keys(M.dfc).forEach(function (id) { M.dfc[id] = r2(M.dfc[id]); });
      ['dre', 'dfc'].forEach(function (q) { Object.keys(M.det[q]).forEach(function (id) { Object.keys(M.det[q][id]).forEach(function (c) { M.det[q][id][c] = r2(M.det[q][id][c]); }); }); });
    });
    return meses;
  }

  /* ---------- Utilidades de importação ---------- */
  function parseValor(v) {
    if (typeof v === 'number') return v;
    if (v == null) return NaN;
    var s = String(v).trim(); if (!s) return NaN;
    var neg = /^\(.*\)$/.test(s) || /-\s*$/.test(s) || /^-/.test(s) || /[\d\s]D$/i.test(s);
    s = s.replace(/[R$\s()]/g, '').replace(/[CD]$/i, '').replace(/-/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s); if (!isFinite(n)) return NaN;
    return neg ? -n : n;
  }
  function parseMes(v) { // -> 'AAAA-MM' | null
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) { var dd = new Date(v.getTime() + 12 * 3600000); return dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0'); }
    if (typeof v === 'number' && v > 20000 && v < 80000) { // serial do Excel
      var d = new Date(Math.round((v - 25569) * 86400000)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) { var y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + String(+m[2]).padStart(2, '0'); }
    if ((m = s.match(/^(\d{4})-(\d{1,2})/))) return m[1] + '-' + String(+m[2]).padStart(2, '0');
    if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return m[2] + '-' + String(+m[1]).padStart(2, '0');
    return null;
  }

  return {
    MESES: MESES, GRUPOS: GRUPOS, CATS: CATS, DRE: DRE, DFC: DFC, DRE_BY: DRE_BY, DFC_BY: DFC_BY,
    DRE_LEAVES: DRE_LEAVES, DFC_LEAVES: DFC_LEAVES, DRE2DFC: DRE2DFC, SO_CAIXA: SO_CAIXA,
    ORC_DESP: ORC_DESP, ORC_CAIXA: ORC_CAIXA,
    r2: r2, z12: z12, num: num, insMapOf: insMapOf, procMapOf: procMapOf, grupoDre: grupoDre,
    unit: unit, precoAlvo: precoAlvo, orcado: orcado, lag: lag, fechaDRE: fechaDRE, fechaDFC: fechaDFC,
    exibe: exibe, favoravel: favoravel, somaMeses: somaMeses, semAcento: semAcento,
    sugereDestino: sugereDestino, agregaRealizado: agregaRealizado, parseValor: parseValor, parseMes: parseMes
  };
})();
export default TBW;
