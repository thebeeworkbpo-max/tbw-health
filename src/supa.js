/* Conexão com o Supabase e camada de documentos por clínica.
   A plataforma guarda cada bloco de dados (config, base de precificação, orçamento do ano, realizado do mês...)
   como um documento JSON na tabela public.documentos, isolado por clinica_id via RLS. */
import { createClient } from '@supabase/supabase-js';

// Projeto Supabase tbw-health-db (São Paulo). URL e chave anon são públicas por natureza: a proteção dos dados é o RLS.
const PADRAO = {
  url: 'https://acncpweqfqfeyezmjscg.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjbmNwd2VxZnFmZXllem1qc2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxNTc2MzQsImV4cCI6MjEwOTczMzYzNH0.7bLjTd7ynBIFDO60ffqRVOXNKbFXfkAZU6TN9B2ucs4'
};

export async function conectar() {
  let url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); url = j.url; key = j.key; }
    } catch (e) { /* usa o padrão */ }
  }
  if (!url || !key) { url = PADRAO.url; key = PADRAO.key; }
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
}

function erroDb(e) {
  const msg = (e && e.message) || String(e);
  if (e && (e.code === '42501' || /row-level security|permission denied/i.test(msg))) return { code: 'invalid_argument', permissao: true, message: 'sem permissão para alterar esta clínica' };
  if (/fetch|network|Failed to/i.test(msg)) return { code: 'unavailable', message: msg };
  return { code: 'invalid_argument', message: msg };
}

export function criarDb(supa, clinicaId, uid) {
  const cache = new Map();
  const subsDoc = new Map(), subsCol = new Map(), erros = new Set();
  let pronto = false, falha = null;
  const fila = [];

  const meta = (pend) => ({ fromCache: false, hasPendingWrites: !!pend });
  const snapDoc = (path, pend) => { const d = cache.get(path); return { id: path.split('/').pop(), exists: d !== undefined, data: () => d, metadata: meta(pend) }; };
  const snapCol = (col, pend) => {
    const n = col.split('/').length + 1;
    const docs = [...cache.keys()].filter((k) => k.startsWith(col + '/') && k.split('/').length === n).sort().map((k) => snapDoc(k, pend));
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta(pend) };
  };
  function avisa(path, pend) {
    (subsDoc.get(path) || new Set()).forEach((fn) => fn(snapDoc(path, pend)));
    const col = path.split('/').slice(0, -1).join('/');
    (subsCol.get(col) || new Set()).forEach((fn) => fn(snapCol(col, pend)));
  }
  function quandoPronto(fn) { if (pronto) setTimeout(fn, 0); else fila.push(fn); }

  (async () => {
    const { data, error } = await supa.from('documentos').select('path,data').eq('clinica_id', clinicaId);
    if (error) { falha = erroDb(error); erros.forEach((f) => f(falha)); return; }
    (data || []).forEach((r) => cache.set(r.path, r.data));
    pronto = true; fila.splice(0).forEach((f) => f());
  })();

  supa.channel('docs-' + clinicaId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documentos', filter: 'clinica_id=eq.' + clinicaId }, (p) => { cache.set(p.new.path, p.new.data); avisa(p.new.path, false); })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documentos', filter: 'clinica_id=eq.' + clinicaId }, (p) => { cache.set(p.new.path, p.new.data); avisa(p.new.path, false); })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'documentos' }, (p) => {
      const o = p.old || {}; if (o.clinica_id && o.clinica_id !== clinicaId) return;
      if (o.path && cache.has(o.path)) { cache.delete(o.path); avisa(o.path, false); }
    })
    .subscribe();

  function doc(path) {
    return {
      path, id: path.split('/').pop(),
      get: () => new Promise((res) => quandoPronto(() => res(snapDoc(path)))),
      async set(data) {
        cache.set(path, data); avisa(path, true);
        const { error } = await supa.from('documentos').upsert({ clinica_id: clinicaId, path, data, atualizado_por: uid, atualizado_em: new Date().toISOString() });
        if (error) throw erroDb(error);
      },
      async update(parcial) { const atual = cache.get(path) || {}; return this.set(Object.assign({}, atual, parcial)); },
      async delete() {
        cache.delete(path); avisa(path, true);
        const { error } = await supa.from('documentos').delete().eq('clinica_id', clinicaId).eq('path', path);
        if (error) throw erroDb(error);
      },
      onSnapshot(next, err) {
        if (!subsDoc.has(path)) subsDoc.set(path, new Set());
        subsDoc.get(path).add(next); if (err) erros.add(err);
        if (falha && err) setTimeout(() => err(falha), 0); else quandoPronto(() => next(snapDoc(path)));
        return () => subsDoc.get(path).delete(next);
      }
    };
  }
  function collection(col) {
    return {
      path: col, doc: (id) => doc(col + '/' + id),
      onSnapshot(next, err) {
        if (!subsCol.has(col)) subsCol.set(col, new Set());
        subsCol.get(col).add(next); if (err) erros.add(err);
        if (falha && err) setTimeout(() => err(falha), 0); else quandoPronto(() => next(snapCol(col)));
        return () => subsCol.get(col).delete(next);
      }
    };
  }
  return { doc, collection };
}

export const downloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { status: 'saved' };
  }
};
