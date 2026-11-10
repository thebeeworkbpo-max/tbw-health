// Testes dos leitores de extrato (OFX e planilha) e do relatório da maquininha.
import assert from 'node:assert/strict';
import * as C from '../src/conexoes.js';

const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20261105120000[-3:BRT]<LANGUAGE>POR</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>756<BRANCHID>3054<ACCTID>123456-7<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001<DTEND>20261031
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261002120000[-3:BRT]<TRNAMT>1500.00<FITID>A1<MEMO>PIX RECEBIDO MARIA</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005<TRNAMT>-320,50<FITID>A2<MEMO>PAGAMENTO BOLETO FORNECEDOR</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261020<TRNAMT>2400.10<FITID>A3<NAME>TRANSF INFINITEPAY</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>8765.43<DTASOF>20261031</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

assert.ok(C.ehOFX(ofx));
const [ct] = C.lerOFX(ofx);
assert.equal(ct.nome, 'Sicoob'); assert.equal(ct.conta, '123456-7'); assert.equal(ct.itens.length, 3);
assert.equal(ct.itens[1].v, -320.5); assert.equal(ct.itens[2].desc, 'TRANSF INFINITEPAY');
assert.deepEqual([ct.ini, ct.fim], ['2026-10-01', '2026-10-31']); assert.deepEqual(ct.saldo, { valor: 8765.43, data: '2026-10-31' });
const res = C.resumoBanco(ct.itens); assert.deepEqual(res['2026-10'], { n: 3, ent: 3900.1, sai: 320.5 });

// mescla: reimportar só a 2ª quinzena mantém os lançamentos da 1ª
const k = C.chaveConta(ct.banco, ct.conta); assert.equal(k, '756-1234567');
let doc = C.mesclaConta(null, k, { nome: 'Sicoob', fonte: 'ofx', saldo: ct.saldo }, ct.itens, ct.ini, ct.fim);
doc = C.mesclaConta(doc, k, { fonte: 'ofx' }, [{ id: 'B9', d: '2026-10-25', desc: 'TARIFA', v: -45 }], '2026-10-16', '2026-10-31');
assert.equal(doc.contas[k].n, 3); assert.equal(doc.contas[k].sai, 365.5); assert.equal(doc.contas[k].saldo.valor, 8765.43);
const tb = C.totaisBancoMes(doc); assert.equal(tb['var'], 1500 - 365.5);

// extrato em planilha (layout Sicoob CSV: valor com sufixo C/D)
const aoa = [['Extrato conta corrente'], ['Data', 'Documento', 'Histórico', 'Valor'], ['01/10/2026', '', 'SALDO ANTERIOR', '1.000,00C'], ['02/10/2026', '1', 'PIX RECEB', '150,00C'], ['03/10/2026', '2', 'TARIFA', '12,90D']];
const hr = C.achaCabecalho(aoa, C.cabecalhoBanco); assert.equal(hr, 1);
const cols = C.colunasAuto(aoa[hr], C.CAMPOS_BANCO); assert.deepEqual([cols.data, cols.desc, cols.val], [0, 2, 3]);
const ex = C.extratoDaPlanilha(aoa, hr, cols); assert.equal(ex.itens.length, 2); assert.equal(ex.itens[1].v, -12.9); assert.equal(ex.ign, 1);

// relatório de vendas da maquininha (colunas no estilo InfinitePay)
const vd = [['Data', 'Hora', 'Método de pagamento', 'Bandeira', 'Parcelas', 'Valor bruto', 'Taxa', 'Valor líquido', 'Status'],
  ['03/10/2026', '10:00', 'Crédito', 'Visa', '1', 'R$ 1.000,00', '-R$ 31,50', 'R$ 968,50', 'Aprovada'],
  ['03/10/2026', '11:00', 'Débito', 'Mastercard', '1', '200,00', '1,90', '198,10', 'Aprovada'],
  ['04/10/2026', '09:00', 'Pix', '', '', '500,00', '0,00', '500,00', 'Aprovada'],
  ['05/10/2026', '09:00', 'Crédito', 'Visa', '3', '300,00', '', '285,00', 'Estornada']];
const hc = C.achaCabecalho(vd, C.cabecalhoCartao), cc = C.colunasAuto(vd[hc], C.CAMPOS_CARTAO);
assert.deepEqual([cc.data, cc.forma, cc.band, cc.parc, cc.bruto, cc.taxa, cc.liq, cc.sit], [0, 2, 3, 4, 5, 6, 7, 8]);
const v = C.vendasDaPlanilha(vd, hc, cc), M = v.meses['2026-10'];
assert.equal(M.n, 3); assert.equal(M.bruto, 1700); assert.equal(M.taxa, 33.4); assert.equal(M.canc.n, 1);
assert.equal(M.formas.pix.bruto, 500); assert.equal(M.band.visa.taxa, 31.5);
const tx = C.taxaCartao(M); assert.equal(tx.bruto, 1200); assert.ok(Math.abs(tx.pct - 33.4 / 1200) < 1e-9);

assert.equal(C.situacao({ ent: 1000, sai: 400, 'var': 600 }, { ent: 990, sai: 400, 'var': 590 }), 'ok');
assert.equal(C.situacao({ ent: 1000, sai: 400, 'var': 600 }, { ent: 500, sai: 400, 'var': 100 }), 'diverge');
console.log('conexões: todos os testes passaram');

// calendário de 1904 (Excel para Mac): data lida 4 anos e 1 dia antes do texto da célula
const wb1904 = { Workbook: { WBProps: { date1904: true } }, SheetNames: ['A'], Sheets: { A: { '!ref': 'A1:A2', A1: { t: 'd', v: new Date(2020, 0, 1), w: '1/2/24' }, A2: { t: 'd', v: new Date(2020, 1, 28), w: '2/29/24' } } } };
assert.ok(C.corrigeData1904(wb1904));
assert.equal(C.parseDia(wb1904.Sheets.A.A1.v), '2024-01-02'); assert.equal(C.parseDia(wb1904.Sheets.A.A2.v), '2024-02-29');
const wbOk = { Workbook: { WBProps: { date1904: true } }, SheetNames: ['A'], Sheets: { A: { A1: { t: 'd', v: new Date(2024, 0, 2), w: '1/2/24' } } } };
assert.equal(C.corrigeData1904(wbOk), false);
console.log('conexões: calendário 1904 ok');
