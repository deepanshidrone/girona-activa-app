// Marca del centro: vista de cliente, login, recuperar contraseña y correos.
// ÚNICO sitio con estos valores: saldrán de center_settings cuando se haga la
// marca blanca (docs/spec-vista-cliente.md §7.4). No repetirlos en el código.
// (Pendiente: los correos de invitación de clients.ts y employees.ts y las
// páginas antiguas aún los tienen escritos a mano.)
export const BRAND = {
  name: 'Girona Activa',
  shortName: 'GIRONA ACTIVA',
  logoUrl: '/logo.png',
  primary: '#FF914D',
  emailFrom: 'Girona Activa <noreply@gironaactiva.com>',
} as const
