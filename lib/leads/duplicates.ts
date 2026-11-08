// Duplicados (docs/spec-crm.md §7.3, D9): no se fusiona nada, solo se señala.
// - "Ha escrito N veces": otros leads no spam con el mismo email o el mismo teléfono normalizado.
// - "Ya es cliente": una ficha de cliente con el mismo email (clients no tiene teléfono).

export type LeadContactKey = { id: string; email: string | null; phone_normalized: string | null }
export type ClientEmail = { id: string; email: string | null; first_name: string | null; last_name: string | null }

export type DuplicateInfo = {
  otherLeadIds: string[]   // otros envíos de la misma persona
  client: { id: string; name: string } | null
}

export function findDuplicates(
  lead: LeadContactKey,
  related: LeadContactKey[],
  clients: ClientEmail[],
): DuplicateInfo {
  const email = lead.email?.toLowerCase() ?? null
  const otherLeadIds = related
    .filter(r => r.id !== lead.id)
    .filter(r => (email && r.email?.toLowerCase() === email) ||
      (lead.phone_normalized && r.phone_normalized === lead.phone_normalized))
    .map(r => r.id)

  const c = email ? clients.find(x => x.email?.trim().toLowerCase() === email) : undefined
  return {
    otherLeadIds,
    client: c ? { id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Cliente' } : null,
  }
}
