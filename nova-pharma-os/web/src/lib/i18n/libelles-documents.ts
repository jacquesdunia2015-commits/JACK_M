import type { LibellesDocuments } from '@/components/Documents';
import type { Traduire } from './index';

/** Libellés de la section documents, communs aux deux espaces. */
export function libellesDocuments(t: Traduire): LibellesDocuments {
  return {
    titre: t('doc.titre'),
    telechargerWord: t('doc.telecharger_word'),
    ouvrir: t('doc.ouvrir'),
    retour: t('doc.retour'),
    introuvable: t('doc.introuvable'),
  };
}
