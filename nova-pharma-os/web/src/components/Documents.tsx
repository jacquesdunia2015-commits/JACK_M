import Link from 'next/link';
import { DOCUMENTS, trouverDocument } from '@/contenu/documents';
import Vide from '@/components/Vide';

export interface LibellesDocuments {
  titre: string;
  telechargerWord: string;
  ouvrir: string;
  retour: string;
  introuvable: string;
}

/**
 * Liste des guides, mise à disposition dans les deux espaces.
 *
 * `base` change selon l'espace qui l'affiche : la pharmacie et le
 * back-office ont chacun leur arborescence, et un lien codé en dur
 * sortirait l'utilisateur de son espace.
 */
export function ListeDocuments({
  base,
  libelles,
}: {
  base: string;
  libelles: LibellesDocuments;
}) {
  if (DOCUMENTS.length === 0) {
    return <Vide message={libelles.introuvable} />;
  }

  return (
    <div className="doc-liste">
      {DOCUMENTS.map((document) => (
        <article key={document.id} className="doc-carte">
          <div className="doc-carte-tete">
            <span className="doc-icone" aria-hidden>
              {document.icone}
            </span>
            <div>
              <h2>{document.titre}</h2>
              <p className="muted">{document.resume}</p>
            </div>
          </div>
          <div className="doc-carte-actions">
            <Link className="bouton-doc" href={`${base}/${document.id}`}>
              {libelles.ouvrir}
            </Link>
            {document.fichierWord && (
              <a
                className="bouton-doc secondaire"
                href={document.fichierWord}
                download
              >
                {libelles.telechargerWord}
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * Un guide, rendu en pleine page.
 *
 * Le HTML injecté est produit à la construction depuis les fichiers
 * Markdown du dépôt (`scripts/preparer-documents.mjs`). Il ne provient
 * d'aucune saisie : ni d'une pharmacie, ni d'un visiteur. C'est ce qui
 * rend l'injection acceptable ici, et ce qui cesserait de l'être si un
 * jour ces textes devenaient modifiables depuis l'interface.
 */
export function VueDocument({
  id,
  base,
  libelles,
}: {
  id: string;
  base: string;
  libelles: LibellesDocuments;
}) {
  const document = trouverDocument(id);

  if (!document) {
    return (
      <>
        <div className="page-head">
          <h1>{libelles.titre}</h1>
        </div>
        <Vide message={libelles.introuvable} />
        <p>
          <Link href={base}>{libelles.retour}</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="page-head doc-tete">
        <div>
          <h1>{document.titre}</h1>
          <p>{document.resume}</p>
        </div>
        {document.fichierWord && (
          <a className="bouton-doc" href={document.fichierWord} download>
            {libelles.telechargerWord}
          </a>
        )}
      </div>

      <article
        className="doc-corps"
        dangerouslySetInnerHTML={{ __html: document.html }}
      />

      <p className="doc-retour">
        <Link href={base}>{libelles.retour}</Link>
      </p>
    </>
  );
}
