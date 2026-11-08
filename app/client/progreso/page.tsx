import { EmptyState } from '../ui'

// Pendiente: segunda entrega (docs/spec-vista-cliente.md §4.1.5).
export default function ClientProgressPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Progreso</h1>
      <EmptyState icon="📈" title="Muy pronto" text="Aquí verás tus sesiones del mes y del año, tu racha y tu adherencia." />
    </div>
  )
}
