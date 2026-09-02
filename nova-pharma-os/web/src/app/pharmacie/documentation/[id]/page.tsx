import { VueDocument } from '@/components/Documents';
import { traduire } from '@/lib/i18n';
import { libellesDocuments } from '@/lib/i18n/libelles-documents';

export default async function DocumentPharmacie({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { t } = await traduire();
  return (
    <VueDocument id={id} base="/pharmacie/documentation" libelles={libellesDocuments(t)} />
  );
}
