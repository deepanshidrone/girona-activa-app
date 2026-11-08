// Esqueleto mientras carga cualquier pantalla de /client.
export default function ClientLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="h-4 w-16 rounded bg-white/10" />
      <div className="h-6 w-48 rounded bg-white/10" />
      <div className="h-48 rounded-2xl bg-[#1C1C1C] border border-white/10" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-[#1C1C1C] border border-white/10" />
        <div className="h-24 rounded-2xl bg-[#1C1C1C] border border-white/10" />
      </div>
    </div>
  )
}
