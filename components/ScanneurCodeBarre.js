'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Message } from './Elements';

/**
 * Lit un code-barres avec la caméra. Utilise l'API native BarcodeDetector
 * quand elle existe (Android, Chrome), sinon la bibliothèque ZXing.
 */
export default function ScanneurCodeBarre({ onDetecte }) {
  const video = useRef(null);
  const [erreur, setErreur] = useState('');
  const [manuel, setManuel] = useState('');
  const detecte = useRef(false);

  useEffect(() => {
    let flux;
    let arret = false;
    let controlesZxing;
    let boucle;

    function signaler(code) {
      if (detecte.current || !/^[0-9]{6,14}$/.test(code)) return;
      detecte.current = true;
      navigator.vibrate?.(80);
      onDetecte(code);
    }

    async function demarrer() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErreur('La caméra n\'est pas disponible sur cet appareil. Entrez le code manuellement.');
        return;
      }
      try {
        if ('BarcodeDetector' in window) {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          const detecteur = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter((f) => formats.includes(f)),
          });
          flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          if (arret) return;
          video.current.srcObject = flux;
          await video.current.play();
          boucle = setInterval(async () => {
            if (!video.current || video.current.readyState < 2) return;
            const codes = await detecteur.detect(video.current).catch(() => []);
            if (codes[0]) signaler(codes[0].rawValue);
          }, 250);
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (arret) return;
          const lecteur = new BrowserMultiFormatReader();
          controlesZxing = await lecteur.decodeFromConstraints(
            { video: { facingMode: 'environment' }, audio: false },
            video.current,
            (resultat) => resultat && signaler(resultat.getText())
          );
          if (arret) controlesZxing.stop();
        }
      } catch {
        setErreur('Accès à la caméra refusé ou impossible. Autorisez la caméra ou entrez le code manuellement.');
      }
    }

    demarrer();
    return () => {
      arret = true;
      clearInterval(boucle);
      controlesZxing?.stop();
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetecte]);

  return (
    <div className="pile">
      <div className="scanneur">
        <video className="scanneur__video" ref={video} muted playsInline />
        <div className="scanneur__cadre" aria-hidden="true" />
      </div>
      <Message type="erreur">{erreur}</Message>
      <form
        className="rangee"
        onSubmit={(e) => {
          e.preventDefault();
          const code = manuel.replace(/\D/g, '');
          if (code) onDetecte(code);
        }}
      >
        <input
          className="champ__saisie"
          inputMode="numeric"
          placeholder="Ou entrez le code-barres"
          value={manuel}
          onChange={(e) => setManuel(e.target.value)}
          aria-label="Code-barres"
        />
        <button type="submit" className="bouton bouton--secondaire">
          <Search size={16} aria-hidden="true" />
          Chercher
        </button>
      </form>
    </div>
  );
}
