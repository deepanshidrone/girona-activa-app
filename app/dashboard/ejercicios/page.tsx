import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EjerciciosGallery } from './gallery'

export default async function EjerciciosPage() {
  const supabase = await createClient()

  const [
    { data: exercises },
    { data: movementPatterns },
    { data: muscleGroups },
    { data: equipment },
    { data: objectives },
  ] = await Promise.all([
    supabase.from('exercises').select(`
      id, name, technical_name, exercise_code, subpattern,
      level, technical_level, progression, regression,
      secondary_muscles, body_zone,
      movement_pattern_id, equipment_id, objective_id,
      movement_patterns (id, name),
      equipment (id, name),
      objectives (id, name),
      exercise_muscle_groups (muscle_groups (id, name))
    `).order('name'),
    supabase.from('movement_patterns').select('id, name').order('name'),
    supabase.from('muscle_groups').select('id, name').order('name'),
    supabase.from('equipment').select('id, name').order('name'),
    supabase.from('objectives').select('id, name').order('name'),
  ])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ejercicios</h1>
          <p className="text-white/50 text-sm mt-1">
            {exercises?.length ?? 0} ejercicio{exercises?.length !== 1 ? 's' : ''} en la galería
          </p>
        </div>
        <Link href="/dashboard/ejercicios/nuevo">
          <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
            <Plus className="h-4 w-4" />
            Nuevo ejercicio
          </Button>
        </Link>
      </div>

      {!exercises || exercises.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF914D]/10 flex items-center justify-center mb-4">
            <Dumbbell className="h-6 w-6 text-[#FF914D]" />
          </div>
          <h3 className="text-white font-semibold mb-1">No hay ejercicios todavía</h3>
          <p className="text-white/40 text-sm mb-4">Empieza añadiendo ejercicios a la galería</p>
          <Link href="/dashboard/ejercicios/nuevo">
            <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
              <Plus className="h-4 w-4" />
              Nuevo ejercicio
            </Button>
          </Link>
        </div>
      ) : (
        <EjerciciosGallery
          exercises={exercises as any}
          movementPatterns={movementPatterns ?? []}
          muscleGroups={muscleGroups ?? []}
          equipment={equipment ?? []}
          objectives={objectives ?? []}
        />
      )}
    </div>
  )
}
