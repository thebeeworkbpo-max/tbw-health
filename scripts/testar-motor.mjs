// Confere o motor de cálculo contra os valores calculados pela própria planilha.
// Uso: node scripts/testar-motor.mjs "caminho/da/planilha.xlsx"
import fs from 'node:fs';
import XLSX from 'xlsx';
import TBW from '../src/engine.js';
import { lerPlanilha } from '../src/planilha.js';

const arq = process.argv[2];
let falhas = 0;
function confere(nome, a, b, tol = 0.005) { if (Math.abs(a - b) > tol) { falhas++; if (falhas <= 20) console.log('DIVERGE', nome, a, b); } }

// 1) Casos fixos do motor
const ins = [{ id: 'i1', n: 'Ativo', u: 'un', c: 100, cat: 'med' }, { id: 'i2', n: 'Seringa', u: 'un', c: 2, cat: 'mat' }];
const p = { id: 'p1', o: 1, n: 'Teste', g: 'sor', pr: 500, h: 0.2, x: 0, r: [['i1', 1], ['i2', 2]] };
const u = TBW.unit(p, { t: 0.14, c: 0.06, modo: 'planilha' }, TBW.insMapOf(ins));
confere('preço cartão', u.I, 625); confere('imposto PIX', u.F, 81.4); confere('honorário', u.Nc, 125); confere('CMV', u.cmv, 104);
confere('margem PIX', u.pix.mg, 189.6); confere('margem cartão', u.car.mg, 271.39);
confere('parse valor', TBW.parseValor('R$ 1.234,56'), 1234.56);

// 2) Planilha real, se informada
if (arq) {
  const bytes = fs.readFileSync(arq);
  const base = lerPlanilha(XLSX, bytes, arq, null);
  const wb = XLSX.read(bytes, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames.find((n) => /precifica/i.test(n))];
  const v = (r, c) => { const x = ws[XLSX.utils.encode_cell({ r, c })]; return x ? x.v : null; };
  const cfg = { t: base.t, c: base.c, modo: 'planilha' }, im = TBW.insMapOf(base.insumos);
  const porOrdem = {}; base.procs.forEach((q) => { porOrdem[q.o] = q; });
  let n = 0;
  for (let r = 7; r < 400; r++) {
    const o = v(r, 1); if (o == null || !porOrdem[o]) continue;
    const un = TBW.unit(porOrdem[o], cfg, im); n++;
    confere('retorno PIX #' + o, un.pix.mg, +v(r, 20) || 0);
    confere('retorno cartão #' + o, un.car.mg, +v(r, 23) || 0);
  }
  console.log(`Planilha: ${base.procs.length} procedimentos, ${base.insumos.length} insumos, impostos ${base.t}, cartão ${base.c}; conferidos ${n}.`);
}
console.log(falhas ? `${falhas} divergência(s).` : 'Motor confere com a planilha.');
process.exit(falhas ? 1 : 0);
