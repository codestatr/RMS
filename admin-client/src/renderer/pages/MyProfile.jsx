import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { FaCamera, FaLock, FaUser } from 'react-icons/fa'
import { profileImageSource } from '../utils/profileImage'
import '../../styles/my-profile.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const authConfig = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || ''}` } })
const errorText = (error, fallback) => error.response?.data?.error || error.message || fallback

async function prepareProfilePhoto(file) {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Image compression is unavailable in this browser.')
  }

  let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  let blob = null
  try {
    while (scale >= 0.2) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      for (let quality = 0.88; quality >= 0.48; quality -= 0.1) {
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
        if (blob && blob.size <= 3_500_000) break
      }
      if (blob && blob.size <= 3_500_000) break
      scale *= 0.75
    }
  } finally {
    bitmap.close()
  }

  if (!blob || blob.size > 3_500_000) throw new Error('This image could not be prepared for upload.')
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'profile-photo'}.jpg`, { type: 'image/jpeg' })
}

export default function MyProfile({ user, onUserUpdate }) {
  const [profile, setProfile] = useState(user || {})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  useEffect(() => {
    axios.get(`${API_URL}/users/me`, authConfig())
      .then((response) => {
        const nextProfile = response.data?.data || user || {}
        setProfile(nextProfile)
        onUserUpdate?.(nextProfile)
      })
      .catch((requestError) => setError(errorText(requestError, 'Could not load your profile.')))
      .finally(() => setLoading(false))
  }, [])

  async function saveProfile(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await axios.put(`${API_URL}/users/me`, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone || '',
        address: profile.address || '',
        city: profile.city || '',
        country: profile.country || '',
      }, authConfig())
      const nextProfile = response.data?.data || profile
      setProfile(nextProfile)
      onUserUpdate?.(nextProfile)
      setMessage('Profile details saved.')
    } catch (requestError) {
      setError(errorText(requestError, 'Could not save your profile.'))
    } finally {
      setSaving(false)
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP photo.')
      return
    }
    setUploadingPhoto(true)
    setError('')
    setMessage('')
    try {
      const preparedPhoto = await prepareProfilePhoto(file)
      const form = new FormData()
      form.append('image', preparedPhoto)
      const response = await axios.post(`${API_URL}/users/me/avatar`, form, authConfig())
      const nextProfile = response.data?.data || profile
      setProfile(nextProfile)
      onUserUpdate?.(nextProfile)
      setMessage('Profile photo updated.')
    } catch (requestError) {
      setError(errorText(requestError, 'Could not upload your photo.'))
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    setChangingPassword(true)
    try {
      await axios.post(`${API_URL}/auth/change-password`, {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      }, authConfig())
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setMessage('Password changed successfully.')
    } catch (requestError) {
      setError(errorText(requestError, 'Could not change your password.'))
    } finally {
      setChangingPassword(false)
    }
  }

  const setField = (field, value) => setProfile((current) => ({ ...current, [field]: value }))
  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase() || 'U'

  return <section className="my-profile-page">
    <header className="my-profile-heading"><div><p>ACCOUNT</p><h2>My profile</h2><span>Update your personal details and secure your account.</span></div></header>
    <div className="my-profile-feedback" aria-live="polite">
      {error && <span role="alert">{error}</span>}
      {message && <span className="success">{message}</span>}
    </div>

    <div className="my-profile-grid">
      <article className="my-profile-card my-profile-photo-card">
        <div className="my-profile-card-title"><FaUser /><div><h3>Profile photo</h3><p>Shown beside your account in the portal.</p></div></div>
        <div className="my-profile-photo-row">
          {profile.profileImageUrl
            ? <img className="my-profile-avatar" src={profileImageSource(profile.profileImageUrl)} alt="Your profile" />
            : <span className="my-profile-avatar my-profile-initials">{initials}</span>}
          <label className="my-profile-upload">
            <FaCamera /> {uploadingPhoto ? 'Uploading…' : 'Choose photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={uploadingPhoto} />
          </label>
        </div>
        <small>JPG, PNG, or WebP · any size, compressed and saved to Cloudinary</small>
      </article>

      <form className="my-profile-card" onSubmit={saveProfile}>
        <div className="my-profile-card-title"><FaUser /><div><h3>Personal details</h3><p>Your role and email are managed by the system.</p></div></div>
        {loading ? <p>Loading your profile…</p> : <>
          <div className="my-profile-fields">
            <label>First name<input required maxLength={80} value={profile.firstName || ''} onChange={(event) => setField('firstName', event.target.value)} /></label>
            <label>Last name<input required maxLength={80} value={profile.lastName || ''} onChange={(event) => setField('lastName', event.target.value)} /></label>
            <label>Email<input value={profile.email || ''} readOnly /></label>
            <label>Phone<input type="tel" maxLength={30} value={profile.phone || ''} onChange={(event) => setField('phone', event.target.value)} /></label>
            <label>City<input maxLength={100} value={profile.city || ''} onChange={(event) => setField('city', event.target.value)} /></label>
            <label>Country<input maxLength={100} value={profile.country || ''} onChange={(event) => setField('country', event.target.value)} /></label>
            <label className="my-profile-wide">Address<input maxLength={255} value={profile.address || ''} onChange={(event) => setField('address', event.target.value)} /></label>
          </div>
          <button className="my-profile-submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        </>}
      </form>

      <form className="my-profile-card my-profile-password-card" onSubmit={changePassword}>
        <div className="my-profile-card-title"><FaLock /><div><h3>Change password</h3><p>Confirm your current password to choose a new one.</p></div></div>
        <div className="my-profile-fields">
          <label className="my-profile-wide">Current password<input type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
          <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={passwords.confirmPassword} onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
        </div>
        <small>Use at least 8 characters with uppercase, lowercase, a number, and a special character.</small>
        <button className="my-profile-submit" disabled={changingPassword}>{changingPassword ? 'Updating…' : 'Change password'}</button>
      </form>
    </div>
  </section>
}
