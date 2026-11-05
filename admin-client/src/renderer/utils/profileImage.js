const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export function profileImageSource(imageUrl) {
  if (!imageUrl) return ''
  try {
    const base = /^https?:\/\//i.test(API_URL) ? API_URL : window.location.origin
    return new URL(imageUrl, base).toString()
  } catch {
    return imageUrl
  }
}
