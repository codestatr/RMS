import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { FaHistory, FaUsers, FaUserPlus } from 'react-icons/fa'
import PasswordInput from '../../components/PasswordInput'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const authConfig = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || ''}` } })
const roleLabels = { property_owner: 'Property Owner', admin: 'Administrator', cashier: 'Cashier', housekeeping: 'Housekeeping', catering: 'Catering' }

export default function OwnerTeam({ properties = [] }) {
  const [members, setMembers] = useState([])
  const [activity, setActivity] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newStaff, setNewStaff] = useState({ firstName: '', lastName: '', email: '', phone: '', role: 'cashier', password: '', propertyIds: [] })

  const refresh = useCallback(async () => {
    try {
      const [teamResponse, activityResponse] = await Promise.all([
        axios.get(`${API_URL}/owner-portal/team`, authConfig()),
        axios.get(`${API_URL}/owner-portal/activity?limit=50`, authConfig()),
      ])
      const nextMembers = teamResponse.data?.data || []
      setMembers(nextMembers)
      setDrafts((current) => {
        const next = { ...current }
        for (const member of nextMembers) {
          if (!next[member.id]) next[member.id] = { role: member.role, propertyIds: member.properties.map((property) => property.id) }
        }
        return next
      })
      setActivity(activityResponse.data?.data || [])
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not refresh your team and activity.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 10000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const toggleProperty = (propertyId) => {
    setNewStaff((current) => ({
      ...current,
      propertyIds: current.propertyIds.includes(propertyId)
        ? current.propertyIds.filter((id) => id !== propertyId)
        : [...current.propertyIds, propertyId],
    }))
  }

  async function createStaff(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await axios.post(`${API_URL}/owner-portal/team`, {
        ...newStaff,
        firstName: newStaff.firstName.trim(),
        lastName: newStaff.lastName.trim(),
        email: newStaff.email.trim().toLowerCase(),
      }, authConfig())
      setNewStaff({ firstName: '', lastName: '', email: '', phone: '', role: 'cashier', password: '', propertyIds: [] })
      setNotice('System account created.')
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not create this team account.')
    } finally {
      setSaving(false)
    }
  }

  async function saveAccess(member) {
    const draft = drafts[member.id]
    if (!draft?.propertyIds?.length && !['admin', 'property_owner'].includes(draft?.role)) {
      setError('Keep at least one property assigned to each active team member.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await axios.patch(`${API_URL}/owner-portal/team/${member.id}`, draft, authConfig())
      setNotice(`Access updated for ${member.firstName} ${member.lastName}.`)
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not update this team member.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(member) {
    setSaving(true)
    setError('')
    try {
      const isActive = member.status === 'active'
      const action = isActive ? 'deactivate' : 'reactivate'
      await axios.post(`${API_URL}/users/${member.id}/${action}`, {}, authConfig())
      setNotice(`${member.firstName} ${member.lastName} account ${isActive ? 'deactivated' : 'reactivated'}.`)
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not update this team member status.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="owner-team-page">
    <section className="admin-card owner-team-intro">
      <div><FaUsers aria-hidden="true" /><div><h3>Staff &amp; property access</h3><p>As property owner, manage staff roles and property assignments across the entire system. You alone can deactivate or reactivate accounts and monitor activity across all properties.</p></div></div>
    </section>
    {error && <div className="login-error" role="alert">{error}</div>}
    {notice && <div className="settings-feedback-success" role="status">{notice}</div>}

    <form className="admin-card owner-team-create" onSubmit={createStaff}>
      <div className="owner-team-section-heading"><div><h3><FaUserPlus /> Add a system account</h3><p>Create administrator, owner, cashier, housekeeping, or catering accounts.</p></div></div>
      <div className="owner-team-form-grid">
        <label>First name<input required maxLength={100} value={newStaff.firstName} onChange={(event) => setNewStaff({ ...newStaff, firstName: event.target.value })} /></label>
        <label>Last name<input required maxLength={100} value={newStaff.lastName} onChange={(event) => setNewStaff({ ...newStaff, lastName: event.target.value })} /></label>
        <label>Email<input required type="email" value={newStaff.email} onChange={(event) => setNewStaff({ ...newStaff, email: event.target.value })} /></label>
        <label>Phone<input type="tel" value={newStaff.phone} onChange={(event) => setNewStaff({ ...newStaff, phone: event.target.value })} /></label>
        <label>Portal role<select value={newStaff.role} onChange={(event) => setNewStaff({ ...newStaff, role: event.target.value })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Temporary password<PasswordInput required minLength={8} autoComplete="new-password" value={newStaff.password} onChange={(event) => setNewStaff({ ...newStaff, password: event.target.value })} placeholder="Use a strong temporary password" /></label>
      </div>
      <fieldset className="owner-team-property-picker"><legend>Property access</legend>
        {properties.length ? properties.map((property) => <label key={property.id}><input type="checkbox" checked={newStaff.propertyIds.includes(property.id)} onChange={() => toggleProperty(property.id)} /> <span>{property.name}</span></label>) : <p>Add a property before creating a team account.</p>}
      </fieldset>
      <button className="btn-primary" disabled={saving || !properties.length}>{saving ? 'Saving…' : 'Create team account'}</button>
    </form>

    <section className="admin-card owner-team-members">
      <div className="owner-team-section-heading"><div><h3>People across the system</h3><p>Staff status and activity refresh every 10 seconds.</p></div></div>
      {loading ? <p>Loading team…</p> : members.length === 0 ? <p>No team accounts yet.</p> : <div className="owner-team-member-list">
        {members.map((member) => {
          const draft = drafts[member.id] || { role: member.role, propertyIds: member.properties.map((property) => property.id) }
          return <article className="owner-team-member" key={member.id}>
            <div className="owner-team-member-summary"><div><strong>{member.firstName} {member.lastName}</strong><span>{member.email}{member.phone ? ` · ${member.phone}` : ''}</span><small>{member.lastLogin ? `Last sign-in ${new Date(member.lastLogin).toLocaleString()}` : 'Has not signed in yet'}</small></div><span className={`owner-team-status ${member.status}`}>{member.status}</span></div>
            <div className="owner-team-form-grid compact">
              <label>Role<select value={draft.role} onChange={(event) => setDrafts({ ...drafts, [member.id]: { ...draft, role: event.target.value } })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <fieldset className="owner-team-property-picker"><legend>Assigned properties</legend>
                {properties.map((property) => <label key={property.id}><input type="checkbox" checked={draft.propertyIds.includes(property.id)} onChange={() => setDrafts({ ...drafts, [member.id]: { ...draft, propertyIds: draft.propertyIds.includes(property.id) ? draft.propertyIds.filter((id) => id !== property.id) : [...draft.propertyIds, property.id] } })} /> <span>{property.name}</span></label>)}
              </fieldset>
            </div>
            <div className="owner-team-member-actions"><button type="button" className="btn-secondary" disabled={saving} onClick={() => saveAccess(member)}>Save access</button><button type="button" className="btn-secondary" disabled={saving} onClick={() => toggleStatus(member)}>{member.status === 'active' ? 'Deactivate account' : 'Reactivate account'}</button></div>
          </article>
        })}
      </div>}
    </section>

    <section className="admin-card owner-team-activity">
      <div className="owner-team-section-heading"><div><h3><FaHistory /> Live team activity</h3><p>Successful account and operational changes across the system.</p></div><span className="owner-team-live"><i /> Live</span></div>
      {activity.length ? <div className="owner-team-activity-list" aria-live="polite">{activity.map((event) => <article key={event.id}><span className="owner-team-activity-dot" /><div><strong>{event.actorName}</strong><p>{event.action}{event.property_name ? ` · ${event.property_name}` : ''}</p><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></div></article>)}</div> : <p>No activity recorded yet.</p>}
    </section>
  </div>
}

