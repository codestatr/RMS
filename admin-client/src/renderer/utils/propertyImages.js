export function optimizePropertyImage(file) {
  return new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      reject(new Error('Choose JPG, PNG, or WebP photos.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error(`Could not process ${file.name}.`))
      image.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const optimized = canvas.toDataURL('image/jpeg', 0.8)
        if (optimized.length > 1_500_000) reject(new Error(`${file.name} is still too large after compression.`))
        else resolve(optimized)
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
