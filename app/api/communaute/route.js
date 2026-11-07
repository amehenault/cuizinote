import { listerCommunaute } from '@/lib/recettes';
import { ok, route } from '@/lib/http';

export const GET = route(async ({ requete, utilisateur }) => {
  const p = requete.nextUrl.searchParams;
  return ok(
    await listerCommunaute(utilisateur.id, {
      recherche: (p.get('q') || '').slice(0, 100),
      limite: Number(p.get('limite')) || 200,
    })
  );
});
