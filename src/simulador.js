/* TBW Health · simulador de custo-hora, hora de poltrona e reserva de caixa.
   Base: média do realizado dos últimos meses (padrão 12). Funções puras, testáveis em Node. */
import T from './engine.js';

const r2 = (v) => Math.round(v * 100) / 100;

// Linhas de custo da DRE que entram no simulador (valores guardados como magnitude positiva)
export const LINHAS = ['ded_imp', 'ded_tx', 'ded_dev', 'cmv_med', 'cmv_imp', 'cmv_mat', 'csv_hon', 'csv_exa', 'csv_cad', 'csv_out',
  'do_pes', 'do_pro', 'do_ocu', 'do_adm', 'do_mkt', 'do_man', 'do_out', 'fin_desp', 'ir'];
// Saídas só de caixa que pesam na reserva do mês seguinte
export const CAIXA = [['fin_sai', 'Amortização de empréstimos'], ['inv_cap', 'Investimentos e aplicações'], ['fin_dist', 'Distribuição de lucros / retiradas']];

export const PADRAO = { meses: 12, dias: 22, horas: 10, poltronas: 3, horasPoltrona: 10, ocupacao: 0.6, parcela: null, mesesReserva: 1, queda: 0.3, fixo: {}, valor: {}, caixa: { fin_sai: true, inv_cap: true, fin_dist: false } };

// Despesas operacionais, financeiras e a equipe de atendimento são fixas; o resto acompanha a produção.
export function fixoPadrao(id) { return /^do_/.test(id) || id === 'fin_desp' || id === 'csv_cad'; }

export function config(doc, local) {
  const c = Object.assign({}, PADRAO, doc || {}, local || {});
  c.fixo = Object.assign({}, (doc && doc.fixo) || {}, (local && local.fixo) || {});
  c.valor = Object.assign({}, (doc && doc.valor) || {}, (local && local.valor) || {});
  c.caixa = Object.assign({}, PADRAO.caixa, (doc && doc.caixa) || {}, (local && local.caixa) || {});
  return c;
}
export function ehFixo(c, id) { return c.fixo[id] != null ? !!c.fixo[id] : fixoPadrao(id); }

// Últimos n meses com realizado (ignora cenário de exemplo)
export function mesesBase(real, n) {
  const ks = Object.keys(real || {}).filter((k) => /^\d{4}-\d{2}$/.test(k) && real[k] && real[k].fonte !== 'exemplo' && real[k].dre).sort();
  return ks.slice(-Math.max(1, n || 12));
}

const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

export function calcula(real, c) {
  const ks = mesesBase(real, c.meses);
  if (!ks.length) return null;
  const docs = ks.map((k) => real[k]);
  const rbS = docs.map((d) => T.fechaDRE(d.dre).rb);
  const R = media(rbS);
  const sorS = docs.map((d) => +d.dre.rb_sor || 0);
  const linhas = LINHAS.map((id) => {
    const serie = docs.map((d) => +d.dre[id] || 0), m = media(serie), cats = {};
    docs.forEach((d) => { const det = d.det && d.det.dre && d.det.dre[id]; if (det) Object.keys(det).forEach((n) => { cats[n] = (cats[n] || 0) + det[n] / docs.length; }); });
    const fixo = ehFixo(c, id), aj = c.valor[id];
    return { id, n: T.DRE_BY[id].n, serie, media: r2(m), ultimo: serie[serie.length - 1], fixo, ajustado: fixo && aj != null && isFinite(aj), valor: r2(fixo && aj != null && isFinite(aj) ? +aj : m),
      cats: Object.keys(cats).map((n) => [n, r2(cats[n])]).filter((x) => Math.abs(x[1]) >= 0.5).sort((a, b) => b[1] - a[1]) };
  }).filter((l) => l.media || l.ajustado || l.serie.some((x) => x));
  const caixa = CAIXA.map(([id, n]) => {
    const serie = docs.map((d) => +((d.dfc || {})[id]) || 0);
    return { id, n, serie, media: r2(media(serie)), usa: !!c.caixa[id] };
  });
  const F = r2(linhas.filter((l) => l.fixo).reduce((s, l) => s + l.valor, 0));
  const V = r2(linhas.filter((l) => !l.fixo).reduce((s, l) => s + l.media, 0));
  const v = R > 0 ? V / R : 0;
  const H = Math.max(1, (+c.dias || 0) * (+c.horas || 0));
  const meta = isFinite(+c.meta) ? +c.meta : 0;
  const eqMes = v < 1 ? F / (1 - v) : null, metaMes = 1 - v - meta > 0 ? F / (1 - v - meta) : null;
  // poltronas
  const parcelaAuto = R > 0 ? media(sorS) / R : 0;
  const parcela = c.parcela != null && isFinite(c.parcela) ? +c.parcela : parcelaAuto;
  const hpCap = (+c.poltronas || 0) * (+c.dias || 0) * (+c.horasPoltrona || 0);
  const hp = hpCap * (+c.ocupacao || 0);
  const custoHp = hp > 0 ? F * parcela / hp : null;
  // reserva do mês seguinte
  const extra = r2(caixa.filter((x) => x.usa).reduce((s, x) => s + x.media, 0));
  const saidasFixas = r2(F + extra);
  const porMes = ks.map((k, i) => {
    const rb = rbS[i], fix = linhas.filter((l) => l.fixo).reduce((s, l) => s + l.serie[i], 0), vr = linhas.filter((l) => !l.fixo).reduce((s, l) => s + l.serie[i], 0);
    const cx = caixa.filter((x) => x.usa).reduce((s, x) => s + x.serie[i], 0);
    return { k, rb: r2(rb), variaveis: r2(vr), fixos: r2(fix), resultado: r2(rb - vr - fix), caixa: r2(cx), saidasFixas: r2(fix + cx) };
  });
  const pior = porMes.reduce((a, b) => (b.saidasFixas > a.saidasFixas ? b : a), porMes[0]);
  const falta = (rec) => r2(Math.max(0, saidasFixas + v * rec - rec));
  const q = Math.min(1, Math.max(0, +c.queda || 0));
  return {
    meses: ks, n: ks.length, R: r2(R), V, v, F, H, linhas, caixa, porMes,
    custoHora: r2(F / H), eqMes: eqMes != null ? r2(eqMes) : null, eqHora: eqMes != null ? r2(eqMes / H) : null,
    metaMes: metaMes != null ? r2(metaMes) : null, metaHora: metaMes != null ? r2(metaMes / H) : null, recHora: r2(R / H),
    folga: eqMes ? R / eqMes - 1 : null,
    poltrona: { parcela, parcelaAuto, hpCap, hp, custoHora: custoHp != null ? r2(custoHp) : null, eqHora: custoHp != null && v < 1 ? r2(custoHp / (1 - v)) : null, fixoAlocado: r2(F * parcela) },
    reserva: { extra, saidasFixas, pior, semReceita: saidasFixas, mediaFalta: falta(R), queda: q, quedaFalta: falta(R * (1 - q)), quedaReceita: r2(R * (1 - q)),
      recomendada: r2(saidasFixas * Math.max(0, +c.mesesReserva || 0)), recomendadaPior: r2(pior.saidasFixas * Math.max(0, +c.mesesReserva || 0)) }
  };
}

/* Preço mínimo de um procedimento que também paga o tempo de poltrona.
   u = resultado de T.unit; abs = custo fixo absorvido no atendimento (R$). */
export function precoComFixo(u, abs) {
  const out = {};
  [['pix', u.E], ['car', u.I]].forEach(([k, preco]) => {
    const x = u[k], pct = preco > 0 ? (x.imp + x.tx + x.hon) / preco : 0, fixos = x.custo - (x.imp + x.tx + x.hon);
    out[k] = { preco, resultado: r2(x.mg - abs), minimo: pct < 1 ? Math.ceil((fixos + abs) / (1 - pct) * 100) / 100 : null };
  });
  return out;
}
