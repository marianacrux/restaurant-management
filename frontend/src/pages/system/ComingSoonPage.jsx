import { Card, EmptyState, PageHeader } from '../../components/ui/index.jsx';

// Marcador explícito para módulos aún no construidos (no simula datos).
export default function ComingSoonPage({ title, stage, description }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState title={`Módulo en construcción · ${stage}`}>{description}</EmptyState>
      </Card>
    </>
  );
}
