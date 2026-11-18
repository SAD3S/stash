// Récupère titre, image d'aperçu et durée (vidéo) ou temps de lecture (article) d'une URL.
// Appelée par l'app avec la session de l'utilisateur (JWT vérifié par Supabase).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const pick = (s: string, re: RegExp) => s.match(re)?.[1];
const meta = (h: string, p: string) =>
  pick(h, new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${p}["'][^>]*content=["']([^"']+)`, 'i')) ??
  pick(h, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${p}["']`, 'i'));
const decode = (s?: string) => s?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const iso = (d?: string) => { // PT1H2M3S -> secondes
  const m = d?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0)) : undefined;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const { url } = await req.json().catch(() => ({}));
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return Response.json({ error: 'url invalide' }, { status: 400, headers: cors });
  try {
    const r = await fetch(url, {
      // SOCS/CONSENT : évite la page de consentement YouTube servie aux IP européennes
      headers: { 'User-Agent': UA, 'Accept-Language': 'fr,en;q=0.8', Cookie: 'SOCS=CAI; CONSENT=YES+1' },
      redirect: 'follow', signal: AbortSignal.timeout(8000),
    });
    const html = (await r.text()).slice(0, 3_000_000);
    const title = decode(meta(html, 'og:title') ?? pick(html, /<title[^>]*>([^<]+)/i));
    const image = decode(meta(html, 'og:image'));
    const secs = Number(pick(html, /"lengthSeconds":"(\d+)"/)) || Number(meta(html, 'video:duration')) || iso(meta(html, 'duration'));
    let mins: number | null = null;
    if (secs) mins = Math.max(1, Math.round(secs / 60));
    else {
      const text = (pick(html, /<article[^>]*>([\s\S]*?)<\/article>/i) ?? pick(html, /<body[^>]*>([\s\S]*)<\/body>/i) ?? '')
        .replace(/<(script|style|nav|header|footer|aside|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
      const words = text.split(/\s+/).filter((w) => w.length > 1).length;
      if (words > 200) mins = Math.max(1, Math.round(words / 230));
    }
    return Response.json({ title, image, mins }, { headers: cors });
  } catch {
    return Response.json({}, { headers: cors });
  }
});
