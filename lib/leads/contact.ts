// Enlaces de contacto del lead (docs/spec-crm.md §8.3). Se construyen solo con
// el teléfono normalizado (dígitos, formato internacional) y el email ya
// validados al entrar, nunca con el texto tal como lo escribió la persona.

export function telHref(phoneNormalized: string | null): string | null {
  return phoneNormalized && /^[0-9]{6,15}$/.test(phoneNormalized) ? `tel:+${phoneNormalized}` : null
}

export function whatsappHref(phoneNormalized: string | null): string | null {
  return phoneNormalized && /^[0-9]{6,15}$/.test(phoneNormalized) ? `https://wa.me/${phoneNormalized}` : null
}

export function mailHref(email: string | null): string | null {
  return email && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email) ? `mailto:${encodeURIComponent(email).replace('%40', '@')}` : null
}
