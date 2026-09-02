import { ListeDocuments } from '@/components/Documents';
import { traduire } from '@/lib/i18n';
import { libellesDocuments } from '@/lib/i18n/libelles-documents';

export default async function DocumentsPharmacie() {
  const { t } = await traduire();
  return (
    <>
      <div className="page-head">
        <h1>{t('doc.titre')}</h1>
      </div>
      <ListeDocuments base="/pharmacie/documentation" libelles={libellesDocuments(t)} />
    </>
  );
}
