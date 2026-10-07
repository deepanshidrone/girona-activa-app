import { getTemplatesAction } from '@/app/actions/cycle-templates'
import { SesionesTabs } from '../sesiones-tabs'
import { PlantillasClient } from './plantillas-client'

export const dynamic = 'force-dynamic'

export default async function PlantillasPage() {
  const { templates } = await getTemplatesAction()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sesiones grupales</h1>
          <p className="text-white/50 text-sm mt-0.5">Ciclos de 4 semanas · Bloques A, B, C</p>
        </div>
      </div>

      <SesionesTabs />

      <PlantillasClient templates={templates as any} />
    </div>
  )
}
