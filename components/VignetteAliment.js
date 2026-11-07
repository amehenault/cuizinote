import { Apple } from 'lucide-react';
import { urlImage } from '@/lib/client';

/** Photo d'un aliment : celle téléversée en priorité, sinon l'image Open Food Facts. */
export const imageAliment = (a) => (a?.image_id ? urlImage(a.image_id) : a?.image_url || null);

export default function VignetteAliment({ aliment, grande = false }) {
  const src = imageAliment(aliment);
  const classe = `aliment__vignette${grande ? ' aliment__vignette--grande' : ''}`;
  if (!src) {
    return (
      <span className={`${classe} aliment__vignette--vide`}>
        <Apple size={grande ? 32 : 20} aria-hidden="true" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={classe} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />;
}
