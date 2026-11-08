// Simula a Pluggy e o banco para testar a sincronização do Open Finance sem credenciais reais.
import assert from 'node:assert/strict';
process.env.PLUGGY_CLIENT_ID = 'x'; process.env.PLUGGY_CLIENT_SECRET = 'y';
const docs = new Map([['c1|conexoes/openfinance', { itens: [{ id: 'item1', conector: 'Sicoob' }] }]]);
const adm = {
  from() {
    const f = {};
    const q = { select() { return q; }, eq(k, v) { f[k] = v; return q; }, async maybeSingle() { const d = docs.get(f.clinica_id + '|' + f.path); return { data: d ? { data: d } : null, error: null }; },
      async upsert(row) { docs.set(row.clinica_id + '|' + row.path, JSON.parse(JSON.stringify(row.data))); return { error: null }; } };
    return q;
  }
};
const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), mes = hoje.slice(0, 7);
let chamadas = [];
globalThis.fetch = async (url, op) => {
  const u = new URL(url); chamadas.push(u.pathname);
  const json = (j) => ({ ok: true, status: 200, json: async () => j });
  if (u.pathname === '/auth') return json({ apiKey: 'k' });
  assert.equal(op.headers['X-API-KEY'], 'k');
  if (u.pathname === '/items/item1') return json({ id: 'item1', status: 'UPDATED', connector: { name: 'Sicoob' } });
  if (u.pathname === '/accounts') return json({ results: [{ id: 'acc1', type: 'BANK', subtype: 'CHECKING_ACCOUNT', number: '3054/123456-7', balance: 9000.5 }, { id: 'cc', type: 'CREDIT' }] });
  if (u.pathname === '/v2/transactions') {
    if (!u.searchParams.get('after')) return json({ results: [{ id: 't1', date: mes + '-02T00:00:00.000Z', description: 'PIX RECEBIDO', amount: 100, type: 'CREDIT' }], next: '/v2/transactions?accountId=acc1&after=abc' });
    return json({ results: [{ id: 't2', date: mes + '-03T00:00:00.000Z', descriptionRaw: 'TARIFA  PACOTE', amount: -12.5, type: 'DEBIT' }], next: null });
  }
  throw new Error('rota inesperada ' + u.pathname);
};
const { sincronizarClinica } = await import('../api/openfinance.js');
const r = await sincronizarClinica(adm, 'c1', 2);
assert.equal(r.contas, 1); assert.equal(r.lancamentos, 2); assert.equal(r.meses.length, 2);
const d = docs.get('c1|banco/' + mes).contas['of-30541234567'];
assert.equal(d.n, 2); assert.equal(d.ent, 100); assert.equal(d.sai, 12.5); assert.equal(d.saldo.valor, 9000.5); assert.equal(d.itens[1].desc, 'TARIFA PACOTE');
assert.ok(docs.get('c1|conexoes/openfinance').itens[0].ultimaSync);
console.log('open finance: sincronização simulada ok');
