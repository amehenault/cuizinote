import 'server-only';

/**
 * Envoi de courriel par l'API Resend (https://resend.com, offre gratuite).
 * Variables : RESEND_API_KEY et COURRIEL_EXPEDITEUR (ex. : « Cuizinote <noreply@votredomaine.ca> »).
 * Sans configuration, le message est écrit dans les journaux du serveur (Vercel > Logs) :
 * l'administratrice peut alors transmettre le lien elle-même.
 */
export async function envoyerCourriel({ a, sujet, texte, html }) {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    console.warn(`[courriel non configuré] À : ${a}\nSujet : ${sujet}\n${texte}`);
    return false;
  }
  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.COURRIEL_EXPEDITEUR || 'Cuizinote <onboarding@resend.dev>',
      to: [a],
      subject: sujet,
      text: texte,
      html,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!reponse.ok) {
    console.error(`Envoi du courriel impossible (${reponse.status}) : ${await reponse.text().catch(() => '')}`);
    console.warn(`[courriel non envoyé] À : ${a}\nSujet : ${sujet}\n${texte}`);
    return false;
  }
  return true;
}

const echapper = (v) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function courrielReinitialisation(nom, lien) {
  return {
    sujet: 'Cuizinote : choisir un nouveau mot de passe',
    texte: `Bonjour ${nom},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valide 1 heure, une seule fois) :\n${lien}\n\nSi vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel reste valide.`,
    html: `<p>Bonjour ${echapper(nom)},</p>
<p>Pour choisir un nouveau mot de passe, cliquez sur ce bouton (valide 1 heure, une seule fois) :</p>
<p><a href="${echapper(lien)}" style="display:inline-block;padding:12px 20px;background:#4f2150;color:#fff;border-radius:8px;text-decoration:none">Choisir un nouveau mot de passe</a></p>
<p>Si vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel reste valide.</p>`,
  };
}
