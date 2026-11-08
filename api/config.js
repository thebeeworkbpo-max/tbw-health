// Entrega ao navegador só os dados públicos do Supabase (URL e chave anon/publishable).
// As variáveis são criadas pela integração Supabase da Vercel; aceita os nomes usados em versões diferentes dela.
export default function handler(req, res) {
  const env = process.env;
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.status(500).json({ erro: 'Variáveis do Supabase ausentes no projeto da Vercel. Ligue o banco em Storage → Connect Project.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ url, key });
}
