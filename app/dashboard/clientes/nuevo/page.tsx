'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientAction } from '@/app/actions/clients'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, UserPlus } from 'lucide-react'
import Link from 'next/link'

export default function NuevoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    sex: '',
    birth_date: '',
    height_cm: '',
    weight_kg: '',
    start_date: '',
    email: '',
    notes: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await createClientAction({
      first_name: form.first_name,
      last_name: form.last_name,
      sex: form.sex,
      birth_date: form.birth_date,
      height_cm: parseInt(form.height_cm),
      weight_kg: parseFloat(form.weight_kg),
      start_date: form.start_date,
      email: form.email,
      notes: form.notes,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/dashboard/clientes'), 2000)
  }

  if (success) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-[#1C1C1C] mb-1">Cliente creado correctamente</h2>
          <p className="text-[#666666] text-sm">Se ha enviado un email al cliente para establecer su contraseña.</p>
          <p className="text-[#666666] text-xs mt-2">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/clientes" className="text-[#666666] hover:text-[#1C1C1C] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">Nuevo cliente</h1>
          <p className="text-[#666666] text-sm mt-0.5">Rellena los datos para dar de alta al cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E5E5E5] p-6 flex flex-col gap-5">

        {/* Nombre y Apellido */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="first_name">Nombre <span className="text-red-500">*</span></Label>
            <Input id="first_name" name="first_name" value={form.first_name} onChange={handleChange} placeholder="Ezequiel" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="last_name">Apellido <span className="text-red-500">*</span></Label>
            <Input id="last_name" name="last_name" value={form.last_name} onChange={handleChange} placeholder="García" required />
          </div>
        </div>

        {/* Sexo */}
        <div className="flex flex-col gap-1.5">
          <Label>Sexo <span className="text-red-500">*</span></Label>
          <Select value={form.sex} onValueChange={(val) => setForm({ ...form, sex: val ?? '' })} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona...">
                {form.sex === 'male' ? 'Hombre' : form.sex === 'female' ? 'Mujer' : form.sex === 'other' ? 'Otro' : ''}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Hombre</SelectItem>
              <SelectItem value="female">Mujer</SelectItem>
              <SelectItem value="other">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fecha de nacimiento */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="birth_date">Fecha de nacimiento <span className="text-red-500">*</span></Label>
          <Input id="birth_date" name="birth_date" type="date" value={form.birth_date} onChange={handleChange} required />
        </div>

        {/* Altura y Peso */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="height_cm">Altura (cm) <span className="text-red-500">*</span></Label>
            <Input id="height_cm" name="height_cm" type="number" value={form.height_cm} onChange={handleChange} placeholder="175" min={100} max={250} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="weight_kg">Peso (kg) <span className="text-red-500">*</span></Label>
            <Input id="weight_kg" name="weight_kg" type="number" value={form.weight_kg} onChange={handleChange} placeholder="70" min={30} max={300} step={0.1} required />
          </div>
        </div>

        {/* Fecha de inicio */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start_date">Fecha de inicio <span className="text-red-500">*</span></Label>
          <Input id="start_date" name="start_date" type="date" value={form.start_date} onChange={handleChange} required />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
          <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="cliente@email.com" required />
          <p className="text-xs text-[#666666]">Se enviará un email al cliente para que establezca su contraseña de acceso.</p>
        </div>

        {/* Comentarios */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Comentarios adicionales</Label>
          <Textarea id="notes" name="notes" value={form.notes} onChange={handleChange} placeholder="Observaciones, lesiones previas, objetivos específicos..." rows={3} />
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading || !form.sex} className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold flex-1">
            {loading ? 'Creando cliente...' : 'Crear cliente'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
