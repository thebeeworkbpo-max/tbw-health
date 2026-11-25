// Testes do simulador de custo-hora, poltronas e reserva.
import assert from 'node:assert/strict';
import * as S from '../src/simulador.js';

const mes = (rb, dre, dfc) => ({ fonte: 'erp', dre: Object.assign({ rb_sor: rb * 0.5, rb_con: rb * 0.5 }, dre), dfc: dfc || {} });
const real = {
  '2026-01': mes(100000, { ded_imp: 10000, cmv_med: 20000, do_ocu: 15000, do_pes: 25000, fin_desp: 2000 }, { fin_sai: 3000, fin_dist: 10000 }),
  '2026-02': mes(80000, { ded_imp: 8000, cmv_med: 16000, do_ocu: 15000, do_pes: 25000, fin_desp: 2000 }, { fin_sai: 3000 }),
  '2025-12': { fonte: 'exemplo', dre: { rb_con: 999999 } }
};
const c = S.config({ dias: 20, horas: 10, poltronas: 3, horasPoltrona: 10, ocupacao: 0.5, meta: 0.2 });
const r = S.calcula(real, c);
assert.deepEqual(r.meses, ['2026-01', '2026-02']);
assert.equal(r.R, 90000); assert.equal(r.F, 42000); assert.equal(r.V, 27000); assert.ok(Math.abs(r.v - 0.3) < 1e-12);
assert.equal(r.custoHora, 210); assert.equal(r.eqMes, 60000); assert.equal(r.eqHora, 300); assert.equal(r.metaMes, 84000);
assert.equal(r.poltrona.parcela, 0.5); assert.equal(r.poltrona.hp, 300); assert.equal(r.poltrona.custoHora, 70); assert.equal(r.poltrona.eqHora, 100);
assert.equal(r.reserva.extra, 3000); assert.equal(r.reserva.saidasFixas, 45000); assert.equal(r.reserva.mediaFalta, 0);
assert.equal(r.reserva.quedaFalta, Math.round((45000 + 0.3 * 63000 - 63000) * 100) / 100); // queda de 30%: receita 63 mil
assert.equal(r.reserva.recomendada, 45000);
// ajuste manual de uma linha fixa e reclassificação
const c2 = S.config({ dias: 20, horas: 10 }, { valor: { do_ocu: 10000 }, fixo: { cmv_med: true } });
const r2 = S.calcula(real, c2);
assert.equal(r2.F, 10000 + 25000 + 2000 + 18000); assert.equal(r2.V, 9000);
// preço mínimo cobrindo o tempo de poltrona
const u = { E: 400, I: 460, pix: { imp: 56, tx: 0, hon: 80, custo: 236, mg: 164 }, car: { imp: 64.4, tx: 27.6, hon: 92, custo: 284, mg: 176 } };
const p = S.precoComFixo(u, 100);
assert.equal(p.pix.resultado, 64); assert.equal(p.pix.minimo, Math.ceil((100 + 100) / (1 - 136 / 400) * 100) / 100);
console.log('simulador: todos os testes passaram');
