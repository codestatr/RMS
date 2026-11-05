import React, { useEffect, useRef, useState } from 'react'
import { FaChevronDown, FaSignOutAlt, FaUser } from 'react-icons/fa'
import { profileImageSource } from '../utils/profileImage'

const roleNames = {
  admin: 'Administrator',
  cashier: 'Cashier',
  property_owner: 'Property Owner',
  housekeeping: 'Housekeeping',
  catering: 'Catering',
}

export default function ProfileMenu({ user, onEditProfile, onLogout }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Staff account'
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U'

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    const closeEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [open])

  return <div className="profile-menu" ref={menuRef}>
    <button
      type="button"
      className="profile-menu-trigger"
      onClick={() => setOpen((value) => !value)}
      aria-label="Open profile menu"
      aria-expanded={open}
      title="Profile and account options"
    >
      {user?.profileImageUrl
        ? <img src={profileImageSource(user.profileImageUrl)} alt="" />
        : <span className="profile-menu-initials">{initials}</span>}
      <FaChevronDown className="profile-menu-chevron" aria-hidden="true" />
    </button>

    {open && <div className="profile-menu-dropdown" role="menu">
      <div className="profile-menu-summary">
        {user?.profileImageUrl
          ? <img src={profileImageSource(user.profileImageUrl)} alt="" />
          : <span className="profile-menu-summary-initials">{initials}</span>}
        <div><strong>{name}</strong><span>{roleNames[user?.role] || user?.role || 'Staff'}</span></div>
      </div>
      <div className="profile-menu-contact"><FaUser aria-hidden="true" /><span>{user?.email || 'Email not set'}</span></div>
      {user?.phone && <div className="profile-menu-contact"><span className="profile-menu-phone">TEL</span><span>{user.phone}</span></div>}
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onEditProfile() }}>Edit profile</button>
      <button type="button" role="menuitem" className="profile-menu-signout" onClick={onLogout}><FaSignOutAlt /> Sign out</button>
    </div>}
  </div>
}
