/* TBW Health · conexões com banco e maquininha (funções puras, testáveis em Node).
   Banco: extrato OFX (Sicoob e demais bancos) ou planilha; vem também do Open Finance (api/openfinance.js).
   Maquininha: relatório de vendas (InfinitePay e outras) em CSV ou Excel. */
import T from './engine.js';

export const BANCOS = {
  '001': 'Banco do Brasil', '033': 'Santander', '077': 'Inter', '104': 'Caixa', '136': 'Unicred', '208': 'BTG Pactual',
  '237': 'Bradesco', '260': 'Nubank', '290': 'PagBank', '323': 'Mercado Pago', '336': 'C6 Bank', '341': 'Itaú',
  '380': 'PicPay', '422': 'Safra', '542': 'InfinitePay', '748': 'Sicredi', '756': 'Sicoob', '197': 'Stone', '403': 'Cora'
};
export function nomeBanco(cod) { const c = String(cod || '').replace(/\D/g, '').padStart(3, '0').slice(-3); return BANCOS[c] || (cod ? 'Banco ' + cod : 'Banco'); }

const r2 = (v) => Math.round(v * 100) / 100;
const sa = (s) => T.semAcento(s == null ? '' : s).trim();
function limpa(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 90); }

/* ---------- Datas e valores ---------- */
export function parseDia(v) { // -> 'AAAA-MM-DD' | null
  if (v == null || v === '') return null;
  const p = (n) => String(n).padStart(2, '0');
  if (v instanceof Date && !isNaN(v)) { const d = new Date(v.getTime() + 12 * 3600000); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()); }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + p(+m[2]) + '-' + p(+m[1]); }
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + p(+m[2]) + '-' + p(+m[3]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
  return null;
}
function valorOFX(s) {
  s = String(s || '').trim(); if (!s) return NaN;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  return Number(s.replace(/[^\d.+-]/g, ''));
}

/* ---------- OFX ---------- */
export function ehOFX(texto) { return /<OFX>/i.test(texto) || /^\s*OFXHEADER/i.test(texto); }
function tag(bloco, nome) { const m = bloco.match(new RegExp('<' + nome + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; }

export function lerOFX(texto) {
  const contas = [];
  const stmts = texto.split(/<STMTRS>/i).slice(1);
  stmts.forEach((st) => {
    const from = (st.match(/<BANKACCTFROM>([\s\S]*?)(<\/BANKACCTFROM>|<BANKTRANLIST>)/i) || [])[1] || st;
    const banco = tag(from, 'BANKID'), agencia = tag(from, 'BRANCHID'), conta = tag(from, 'ACCTID');
    const lista = (st.match(/<BANKTRANLIST>([\s\S]*?)(<\/BANKTRANLIST>|<LEDGERBAL>|$)/i) || [])[1] || st;
    const itens = [];
    lista.split(/<STMTTRN>/i).slice(1).forEach((b, i) => {
      const d = parseDia(tag(b, 'DTPOSTED')), v = valorOFX(tag(b, 'TRNAMT'));
      if (!d || !isFinite(v) || v === 0) return;
      const desc = limpa(tag(b, 'MEMO') || tag(b, 'NAME') || tag(b, 'TRNTYPE'));
      itens.push({ id: limpa(tag(b, 'FITID'), 48) || d + '#' + i, d, desc, v: r2(v) });
    });
    const ini = parseDia(tag(lista, 'DTSTART')) || (itens.length ? itens.map((x) => x.d).sort()[0] : null);
    const fim = parseDia(tag(lista, 'DTEND')) || (itens.length ? itens.map((x) => x.d).sort().pop() : null);
    const bal = (st.match(/<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|$)/i) || [])[1];
    const saldo = bal && isFinite(valorOFX(tag(bal, 'BALAMT'))) ? { valor: r2(valorOFX(tag(bal, 'BALAMT'))), data: parseDia(tag(bal, 'DTASOF')) } : null;
    contas.push({ banco, agencia, conta, nome: nomeBanco(banco), ini, fim, saldo, itens });
  });
  return contas;
}

export function chaveConta(banco, conta) {
  const b = String(banco || '').replace(/\D/g, '').padStart(3, '0').slice(-3) || 'bco';
  const c = String(conta || '').replace(/[^0-9A-Za-z]/g, '').slice(-14) || 'conta';
  return b + '-' + c;
}

/* ---------- Extrato em planilha ---------- */
export const CAMPOS_BANCO = [
  ['data', 'Data', /^data|^dt\b|^dia$/],
  ['desc', 'Histórico / descrição', /hist|descri|memo|^lancamento$/],
  ['val', 'Valor (com sinal ou D/C)', /^valor|montante|quantia/],
  ['dc', 'Débito / crédito', /^d\/c$|^c\/d$|^d \/ c$|natureza|^tipo|deb.*cred|cred.*deb/],
  ['cred', 'Coluna de entradas', /^credito|^entrada/],
  ['deb', 'Coluna de saídas', /^debito|^saida/]
];
export function colunasAuto(hdr, campos) {
  const cols = {}, usado = {}, hs = hdr.map((h) => sa(h));
  campos.forEach((c) => {
    for (let i = 0; i < hs.length; i++) if (!usado[i] && hs[i] && (!c[3] || !c[3].test(hs[i])) && c[2].test(hs[i])) { cols[c[0]] = i; usado[i] = 1; break; }
  });
  return cols;
}
export function achaCabecalho(aoa, teste) {
  for (let r = 0; r < Math.min(aoa.length, 40); r++) {
    const txt = (aoa[r] || []).filter((x) => typeof x === 'string' && x.trim()).map(sa);
    if (txt.length >= 2 && teste(txt)) return r;
  }
  return 0;
}
export const cabecalhoBanco = (t) => t.some((x) => /^data|^dt\b/.test(x)) && t.some((x) => /valor|credito|debito|entrada|saida/.test(x));

export function extratoDaPlanilha(aoa, hr, cols) {
  const itens = []; let ign = 0;
  for (let r = hr + 1; r < aoa.length; r++) {
    const row = aoa[r]; if (!row || !row.some((x) => x != null && x !== '')) continue;
    const d = cols.data != null ? parseDia(row[cols.data]) : null;
    let v = NaN;
    if (cols.val != null) {
      v = T.parseValor(row[cols.val]);
      if (isFinite(v) && cols.dc != null && row[cols.dc] != null) {
        const t = sa(row[cols.dc]);
        if (/^d$|^deb|^saida/.test(t)) v = -Math.abs(v); else if (/^c$|^cred|^entrada/.test(t)) v = Math.abs(v);
      }
    } else if (cols.cred != null || cols.deb != null) {
      const c = cols.cred != null ? T.parseValor(row[cols.cred]) : NaN, db = cols.deb != null ? T.parseValor(row[cols.deb]) : NaN;
      v = (isFinite(c) ? Math.abs(c) : 0) - (isFinite(db) ? Math.abs(db) : 0);
    }
    const desc = limpa(cols.desc != null ? row[cols.desc] : '');
    if (!d || !isFinite(v) || v === 0 || /^saldo\b|saldo anterior|saldo do dia|saldo final/.test(sa(desc))) { ign++; continue; }
    itens.push({ id: d + '#' + r, d, desc, v: r2(v) });
  }
  const ds = itens.map((x) => x.d).sort();
  return { itens, ign, ini: ds[0] || null, fim: ds[ds.length - 1] || null };
}

/* ---------- Agrupamento e mescla por mês ---------- */
export function resumoBanco(itens) {
  const meses = {};
  (itens || []).forEach((x) => {
    const k = x.d.slice(0, 7), M = meses[k] || (meses[k] = { n: 0, ent: 0, sai: 0 });
    M.n++; if (x.v > 0) M.ent += x.v; else M.sai -= x.v;
  });
  Object.keys(meses).forEach((k) => { meses[k].ent = r2(meses[k].ent); meses[k].sai = r2(meses[k].sai); });
  return meses;
}
/* Junta a importação de uma conta ao documento banco/<AAAA-MM>: troca só os lançamentos dentro do período do arquivo. */
export function mesclaConta(docMes, chave, info, itensMes, ini, fim) {
  const doc = Object.assign({ contas: {} }, docMes || {}); doc.contas = Object.assign({}, doc.contas);
  const ant = doc.contas[chave] || {};
  const fora = (ant.itens || []).filter((x) => (ini && x.d < ini) || (fim && x.d > fim));
  const itens = fora.concat(itensMes).sort((a, b) => a.d.localeCompare(b.d) || a.id.localeCompare(b.id));
  let ent = 0, sai = 0; itens.forEach((x) => { if (x.v > 0) ent += x.v; else sai -= x.v; });
  const c = Object.assign({}, ant, info, { itens, n: itens.length, ent: r2(ent), sai: r2(sai) });
  if (info.saldo === undefined) c.saldo = ant.saldo || null;
  doc.contas[chave] = c;
  return doc;
}

/* ---------- Maquininha ---------- */
export const CAMPOS_CARTAO = [
  ['data', 'Data da venda', /^data|^dia$|^hora|data e hora/, /receb|previs|pagamento|liquida|deposito|repasse|credito em/],
  ['bruto', 'Valor bruto', /bruto|^valor$|valor da venda|valor total|valor \(r\$\)|valor original|^total$/],
  ['taxa', 'Taxa (R$)', /^taxa|tarifa|^mdr|desconto/, /%|percent/],
  ['liq', 'Valor líquido', /liquido|a receber|recebido|valor final/],
  ['forma', 'Forma de pagamento', /forma|metodo|meio de pag|tipo de pag|modalidade|^produto|^tipo/],
  ['band', 'Bandeira', /bandeira|^marca|brand/],
  ['parc', 'Parcelas', /parcela/],
  ['sit', 'Situação', /status|situac/]
];
export const cabecalhoCartao = (t) => t.some((x) => /^data|^dia$|^hora/.test(x)) && t.some((x) => /valor|bruto|liquido/.test(x));

export function formaPag(s, parc) {
  const t = sa(s);
  if (/pix/.test(t)) return 'pix';
  if (/debito|debit/.test(t)) return 'debito';
  if (/credito|credit|parcel|a vista|avista/.test(t)) return 'credito';
  if (!t && +parc > 1) return 'credito';
  return t ? 'outros' : 'credito';
}
const CANCEL = /estorn|cancel|recus|negad|chargeback|contest|falh|devolv|expirad|nao aprovad/;
export const FORMAS = [['credito', 'Crédito'], ['debito', 'Débito'], ['pix', 'Pix'], ['outros', 'Outros']];

export function vendasDaPlanilha(aoa, hr, cols) {
  const meses = {}; let ign = 0, n = 0;
  const vazio = () => ({ n: 0, bruto: 0, taxa: 0, liq: 0 });
  const soma = (o, b, t, l) => { o.n++; o.bruto += b; o.taxa += t; o.liq += l; };
  for (let r = hr + 1; r < aoa.length; r++) {
    const row = aoa[r]; if (!row || !row.some((x) => x != null && x !== '')) continue;
    const d = cols.data != null ? parseDia(row[cols.data]) : null;
    let b = cols.bruto != null ? T.parseValor(row[cols.bruto]) : NaN;
    let l = cols.liq != null ? T.parseValor(row[cols.liq]) : NaN;
    let t = cols.taxa != null ? T.parseValor(row[cols.taxa]) : NaN;
    if (!isFinite(b) && isFinite(l) && isFinite(t)) b = l + Math.abs(t);
    if (!d || !isFinite(b) || b === 0) { ign++; continue; }
    const k = d.slice(0, 7), M = meses[k] || (meses[k] = Object.assign(vazio(), { formas: {}, band: {}, canc: { n: 0, bruto: 0 } }));
    const st = cols.sit != null ? sa(row[cols.sit]) : '';
    if (CANCEL.test(st) || b < 0) { M.canc.n++; M.canc.bruto += Math.abs(b); n++; continue; }
    t = isFinite(t) ? Math.abs(t) : (isFinite(l) ? Math.max(0, b - Math.abs(l)) : 0);
    l = isFinite(l) ? Math.abs(l) : b - t;
    const f = formaPag(cols.forma != null ? row[cols.forma] : '', cols.parc != null ? row[cols.parc] : 0);
    soma(M, b, t, l); soma(M.formas[f] || (M.formas[f] = vazio()), b, t, l);
    if (f !== 'pix' && cols.band != null && row[cols.band] != null && String(row[cols.band]).trim()) {
      const bd = limpa(row[cols.band], 24).toLowerCase(); soma(M.band[bd] || (M.band[bd] = vazio()), b, t, l);
    }
    n++;
  }
  const arred = (o) => { o.bruto = r2(o.bruto); o.taxa = r2(o.taxa); o.liq = r2(o.liq); };
  Object.keys(meses).forEach((k) => { const M = meses[k]; arred(M); Object.values(M.formas).forEach(arred); Object.values(M.band).forEach(arred); M.canc.bruto = r2(M.canc.bruto); });
  return { meses, n, ign };
}
/* Taxa efetiva só das vendas em cartão (crédito + débito), que é o que a premissa de taxa de cartão representa. */
export function taxaCartao(M) {
  if (!M || !M.formas) return null;
  let b = 0, t = 0; ['credito', 'debito'].forEach((f) => { const x = M.formas[f]; if (x) { b += x.bruto; t += x.taxa; } });
  return b > 0 ? { bruto: r2(b), taxa: r2(t), pct: t / b } : null;
}

/* ---------- Conciliação ---------- */
export function totaisBancoMes(docMes) {
  const o = { ent: 0, sai: 0, n: 0, contas: 0, saldo: 0, temSaldo: false };
  Object.values((docMes && docMes.contas) || {}).forEach((c) => {
    o.ent += +c.ent || 0; o.sai += +c.sai || 0; o.n += +c.n || 0; o.contas++;
    if (c.saldo && isFinite(c.saldo.valor)) { o.saldo += c.saldo.valor; o.temSaldo = true; }
  });
  o.ent = r2(o.ent); o.sai = r2(o.sai); o['var'] = r2(o.ent - o.sai);
  return o;
}
export function caixaErpMes(dfc) {
  const D = T.fechaDFC(dfc || {}, 0);
  return { ent: r2(D.ent + D.fin_ent), sai: r2(D.sai + D.inv + D.fin_sai + D.fin_dist), 'var': r2(D['var']) };
}
export function situacao(banco, erp) {
  if (banco == null && erp == null) return 'vazio';
  if (banco == null) return 'sem-extrato';
  if (erp == null) return 'sem-erp';
  const tol = Math.max(50, 0.01 * Math.max(banco.ent + banco.sai, erp.ent + erp.sai));
  return Math.abs(banco['var'] - erp['var']) <= tol ? 'ok' : 'diverge';
}
