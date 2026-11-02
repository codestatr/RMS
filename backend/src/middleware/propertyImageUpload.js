import multer from 'multer'
import cloudinary from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import { ValidationError } from '../utils/errors.js'

const cloudinaryClient = cloudinary.v2

const storage = new CloudinaryStorage({
  cloudinary: cloudinaryClient,
  params: {
    folder: 'rms_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  },
})

const multerUpload = multer({
  storage,
  // Keep below Vercel Functions' 4.5 MB total request body limit.
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedMimeTypes.includes(file.mimetype)) {
      callback(new ValidationError('Only JPG, PNG, and WebP images are allowed'))
      return
    }
    callback(null, true)
  },
})

export function uploadPropertyImage(req, res, next) {
  // Preserve the endpoint's existing JSON imageUrl option without requiring Cloudinary.
  if (!req.is('multipart/form-data')) return next()

  if (!process.env.CLOUDINARY_NAME || !process.env.CLOUDINARY_KEY || !process.env.CLOUDINARY_SECRET) {
    return next(new Error('Cloudinary is not configured. Set CLOUDINARY_NAME, CLOUDINARY_KEY, and CLOUDINARY_SECRET.'))
  }

  // app.js loads dotenv at startup; configure lazily because ES module imports
  // are evaluated before app.js executes dotenv.config().
  cloudinaryClient.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
  })

  multerUpload.single('image')(req, res, next)
}
