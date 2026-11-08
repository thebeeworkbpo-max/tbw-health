/* Importação da planilha de precificação no layout TBW (abas "Material IMPUT" e "Procedimento PRECIFICAÇÃO").
   Função pura: recebe o objeto XLSX (SheetJS) e os bytes do arquivo. Testada em scripts/testar-motor.mjs. */
import TBW from './engine.js';

const T = TBW;

export function classificaInsumo(nome) {
  const s = T.semAcento(nome).trim();
  if (/tempo de cadeira|estrutura de atendimento/.test(s)) return 'cad';
  if (/nutrigen|biofeme|probiome|exame|laborat/.test(s)) return 'exa';
  if (/agulha|seringa|luva|gaze|equipo|jelco|scalp|algodao|avental|mascara|touca|campo esteril|curativo|micropore|soro fisiol|clorex|sonda|tubo de coleta|bisturi|fio de|prestobarba|kti infus|kit infus|kit intramus|kit implante|kit subcut|rede tubular|agua oxigenada|canhao|spot|blond|cloreto de sodio/.test(s)) return 'mat';
  if (/implanon|^kit|placa|^ita |oxigenio|gestrinona|oxandrolona|oxondrolona|estradiol|testosterona \d|tadalafila|drosperinona|nadh/.test(s)) return 'imp';
  return 'med';
}

export function classificaProcedimento(nome) {
  const s = T.semAcento(nome).trim();
  if (/consulta|retorno|breve conversa/.test(s)) return 'con';
  if (/retirada de pontos/.test(s)) return 'out';
  if (/implan|testosterona \d|gestrinona|estradiol|oxandrolona|tadalafila|drosperinona|nadh/.test(s)) return 'imp';
  if (/^ita /.test(s)) return 'ita';
  if (/mesoterap|\bprp\b|radiofreq|ghk/.test(s)) return 'est';
  if (/mineralogr|polissono|oligoscan|bioimped|nutrigen|biofeme|probiome/.test(s)) return 'exa';
  if (/laser|ozon|reac|nppo|pacote anual|^bota de compress|detox ionico|hidroz|ilib/.test(s)) return 'tec';
  return 'sor';
}

// anterior = { insumos, procs } da clínica, para manter classificações já revisadas
export function lerPlanilha(XLSX, bytes, nomeArquivo, anterior) {
  const wb = XLSX.read(bytes, { type: 'array' });
  const nM = wb.SheetNames.find((n) => /material/i.test(n));
  const nP = wb.SheetNames.find((n) => /precifica/i.test(n));
  if (!nM || !nP) throw new Error('não encontrei as abas "Material IMPUT" e "Procedimento PRECIFICAÇÃO"');
  const wm = wb.Sheets[nM], wp = wb.Sheets[nP];
  const cell = (ws, r, c) => { const x = ws[XLSX.utils.encode_cell({ r, c })]; return x ? x.v : null; };
  const refM = XLSX.utils.decode_range(wm['!ref']), refP = XLSX.utils.decode_range(wp['!ref']);

  let hr = -1;
  for (let i = 0; i <= Math.min(refM.e.r, 40); i++) {
    if (/procedimento/i.test(String(cell(wm, i, 4) || '')) && /ordem/i.test(String(cell(wm, i, 3) || ''))) { hr = i; break; }
  }
  if (hr < 0) throw new Error('cabeçalho da aba de materiais não reconhecido');
  let cr = -1;
  for (let i = 0; i < hr; i++) if (/sem fracionamento|custo cheio/i.test(String(cell(wm, i, 4) || ''))) cr = i;
  if (cr < 0) cr = hr - 3;

  const antI = {}; ((anterior && anterior.insumos) || []).forEach((x) => { antI[T.semAcento(x.n).trim()] = x; });
  const antP = {}; ((anterior && anterior.procs) || []).forEach((x) => { antP[T.semAcento(x.n).trim()] = x; });

  const insumos = [], colId = {};
  for (let c = 6; c <= refM.e.c; c++) {
    const nm = cell(wm, hr, c); if (nm == null || String(nm).trim() === '') continue;
    const nome = String(nm).trim(), custo = +cell(wm, cr, c) || 0;
    if (/^outros\d*$/i.test(nome) && !custo) continue;
    const id = 'i' + String(c - 5).padStart(3, '0'), ant = antI[T.semAcento(nome)];
    colId[c] = id;
    insumos.push({ id, n: nome, u: String(cell(wm, 1, c) || 'unidade').trim().toLowerCase(), c: custo, cat: ant ? ant.cat : classificaInsumo(nome) });
  }
  const fichas = {};
  for (let r = hr + 1; r <= refM.e.r; r++) {
    const o = cell(wm, r, 3); if (o == null) continue;
    const its = [];
    Object.keys(colId).forEach((k) => { const q = T.parseValor(cell(wm, r, +k)); if (q && !isNaN(q)) its.push([colId[k], q]); });
    fichas[o] = its;
  }

  let ph = -1;
  for (let i = 0; i <= Math.min(refP.e.r, 30); i++) if (/^procedimento/i.test(String(cell(wp, i, 2) || '').trim())) { ph = i; break; }
  if (ph < 0) throw new Error('cabeçalho da aba de precificação não reconhecido');
  let colPr = 4, colH = 12, colX = 15;
  for (let c = 0; c <= refP.e.c; c++) {
    const h = T.semAcento(cell(wp, ph, c) || '');
    if (/preco base/.test(h)) colPr = c; else if (/custo %/.test(h) && /honor/.test(h)) colH = c; else if (/custo extra/.test(h)) colX = c;
  }
  let t = null, cartao = null;
  for (let i = 0; i < ph; i++) for (let c = 0; c <= refP.e.c; c++) {
    const s = T.semAcento(cell(wp, i, c) || '');
    if (/input tx impostos/.test(s) && t == null) t = +cell(wp, i + 1, c);
    if (/input tx cartao/.test(s) && cartao == null) cartao = +cell(wp, i + 1, c);
  }
  const procs = [];
  for (let r = ph + 1; r <= refP.e.r; r++) {
    const ord = cell(wp, r, 1), nmP = cell(wp, r, 2);
    if (ord == null || nmP == null || String(nmP).trim() === '') continue;
    const nome = String(nmP).replace(/\s+/g, ' ').trim(), ant = antP[T.semAcento(nome)];
    procs.push({
      id: 'p' + String(ord).padStart(3, '0'), o: +ord, n: nome, g: ant ? ant.g : classificaProcedimento(nome),
      pr: Math.round((T.parseValor(cell(wp, r, colPr)) || 0) * 100) / 100, h: +cell(wp, r, colH) || 0, x: +cell(wp, r, colX) || 0,
      r: fichas[ord] || []
    });
  }
  if (!procs.length) throw new Error('nenhum procedimento encontrado');
  return { insumos, procs, t: isFinite(t) ? t : null, c: isFinite(cartao) ? cartao : null, nome: nomeArquivo };
}
