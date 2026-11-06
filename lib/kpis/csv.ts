// CSV para Excel en castellano: UTF-8 con BOM y separador ';' (docs/spec-kpis.md §9).

type Cell = string | number | null | undefined

function cell(v: Cell): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number'
    ? (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','))
    : v
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map(r => r.map(cell).join(';'))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
