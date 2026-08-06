'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const fullName = formData.get('full_name') as string
  const avatarFile = formData.get('avatar') as File | null

  let avatarUrl: string | undefined

  if (avatarFile && avatarFile.size > 0) {
    const ext = avatarFile.name.split('.').pop()
    const path = `${user.id}.${ext}`
    const arrayBuffer = await avatarFile.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, bytes, { contentType: avatarFile.type, upsert: true })

    if (uploadError) return { error: 'Error subiendo la imagen: ' + uploadError.message }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    avatarUrl = publicUrl + `?t=${Date.now()}`
  }

  const updates: Record<string, string> = {}
  if (fullName) updates.full_name = fullName
  if (avatarUrl) updates.avatar_url = avatarUrl

  const { error } = await supabase.auth.updateUser({ data: updates })
  if (error) return { error: 'Error actualizando perfil: ' + error.message }

  revalidatePath('/dashboard')
  return { success: true }
}
