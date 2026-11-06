import { detruireSession } from '@/lib/auth';
import { ok, route } from '@/lib/http';

export const POST = route(async () => {
  await detruireSession();
  return ok({ ok: true });
}, { public: true });
