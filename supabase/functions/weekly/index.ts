// Rappel hebdo : appelé chaque samedi par pg_cron (header x-cron-secret).
// Un utilisateur connecté peut aussi l'appeler pour s'envoyer une notification de test.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const env = (k: string) => Deno.env.get(k)!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  let onlyUser: string | null = null;
  if (req.headers.get('x-cron-secret') !== env('CRON_SECRET')) {
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data } = await db.auth.getUser(jwt);
    if (!data.user) return new Response('forbidden', { status: 403, headers: cors });
    onlyUser = data.user.id; // test : seulement ses propres appareils
  }

  webpush.setVapidDetails('https://sad3s.github.io/stash/', env('VAPID_PUBLIC'), env('VAPID_PRIVATE'));
  let q = db.from('push_subs').select('endpoint,user_id,sub');
  if (onlyUser) q = q.eq('user_id', onlyUser);
  const { data: subs } = await q;

  let sent = 0;
  for (const s of subs ?? []) {
    const { count } = await db.from('items').select('id', { count: 'exact', head: true })
      .eq('user_id', s.user_id).eq('type', 'video').not('seen', 'is', true);
    if (!count && !onlyUser) continue;
    const n = count ?? 0;
    const body = n
      ? `Tu as ${n} vidéo${n > 1 ? 's' : ''} non vue${n > 1 ? 's' : ''}, c'est le week-end 🍿`
      : 'Tout est vu, bravo ! Les rappels sont bien activés.';
    try {
      await webpush.sendNotification(s.sub, JSON.stringify({ title: 'Stash', body, url: './?view=unseen' }));
      sent++;
    } catch (e) { // abonnement expiré : on le supprime
      if ([404, 410].includes((e as { statusCode?: number }).statusCode ?? 0)) await db.from('push_subs').delete().eq('endpoint', s.endpoint);
    }
  }
  return Response.json({ sent }, { headers: cors });
});
