import { redirect } from 'next/navigation'
import { getProfileAction } from '@/app/actions/profile'
import { ProfileForm } from './profile-form'

export default async function PerfilPage() {
  const profile = await getProfileAction()
  if (!profile) redirect('/login')

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mi perfil</h1>
        <p className="text-white/50 text-sm mt-1">{profile.email} · {profile.role}</p>
      </div>

      <ProfileForm
        initialName={profile.fullName}
        initialAvatarUrl={profile.avatarUrl}
        email={profile.email}
      />
    </div>
  )
}
