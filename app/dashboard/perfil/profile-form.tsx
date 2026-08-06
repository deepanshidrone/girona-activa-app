'use client'

import { useState, useRef } from 'react'
import { updateProfileAction } from '@/app/actions/profile'
import { Camera, Check, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface Props {
  initialName: string
  initialAvatarUrl: string | null
  email: string
}

export function ProfileForm({ initialName, initialAvatarUrl, email }: Props) {
  const [name, setName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const formData = new FormData(formRef.current!)
    const result = await updateProfileAction(formData)

    if (result.error) {
      setStatus('error')
      setErrorMsg(result.error)
    } else {
      setStatus('success')
      if (preview) setAvatarUrl(preview)
      setTimeout(() => setStatus('idle'), 2500)
    }
  }

  const displayAvatar = preview ?? avatarUrl
  const initials = name
    ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : email[0]?.toUpperCase() ?? '?'

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Avatar */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-6 flex items-center gap-6">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-[#FF914D]/20 flex items-center justify-center ring-2 ring-white/10">
            {displayAvatar ? (
              <Image
                src={displayAvatar}
                alt="Avatar"
                width={80}
                height={80}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <span className="text-2xl font-bold text-[#FF914D]">{initials}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#FF914D] flex items-center justify-center hover:bg-[#e07a3a] transition-colors"
          >
            <Camera className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
        <div>
          <p className="text-white font-medium">{name || 'Sin nombre'}</p>
          <p className="text-white/40 text-sm">{email}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs text-[#FF914D] mt-1 hover:underline"
          >
            Cambiar foto
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          name="avatar"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Nombre */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-6 flex flex-col gap-4">
        <h2 className="text-white font-semibold">Información personal</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/60">Nombre completo</label>
          <input
            type="text"
            name="full_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            className="bg-[#111111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#FF914D] transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/60">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="bg-[#111111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white/30 outline-none cursor-not-allowed"
          />
        </div>
      </div>

      {errorMsg && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="bg-[#FF914D] text-white font-bold py-3 rounded-lg hover:bg-[#e07a3a] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === 'success' && <Check className="h-4 w-4" />}
        {status === 'success' ? 'Guardado' : status === 'loading' ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}
