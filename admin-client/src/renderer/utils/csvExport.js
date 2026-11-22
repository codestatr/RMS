function quoteCsvCell(value) {
  if (value === null || value === undefined) return '""'
  const text = value instanceof Date ? value.toISOString() : String(value)
  const safeText = typeof value === 'string' && /^[\t\r ]*[=+@-]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

export function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(quoteCsvCell).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function dateStamp(date = new Date()) {
  const value = new Date(date)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
