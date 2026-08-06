import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileForm } from './profile-form'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fullName = user.user_metadata?.full_name ?? ''
  const avatarUrl = user.user_metadata?.avatar_url ?? null
  const role = user.app_metadata?.role === 'client' ? 'Cliente' : 'Empleado'

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mi perfil</h1>
        <p className="text-white/50 text-sm mt-1">{user.email} · {role}</p>
      </div>

      <ProfileForm
        initialName={fullName}
        initialAvatarUrl={avatarUrl}
        email={user.email ?? ''}
      />
    </div>
  )
}
