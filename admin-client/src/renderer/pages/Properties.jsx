import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi'
import PropertyForm from '../components/PropertyForm'
import '../../styles/properties.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function authConfig() {
  return {
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}`,
    },
  }
}

/**
 * Properties Management Page
 * CRUD operations for property listings
 */
export default function Properties() {
  const [properties, setProperties] = useState([])
  const [filteredProperties, setFilteredProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProperty, setEditingProperty] = useState(null)
  const [managerAccounts, setManagerAccounts] = useState([])
  const [savingOwnerId, setSavingOwnerId] = useState('')
  const [ownerAssignmentMessage, setOwnerAssignmentMessage] = useState('')
  const [ownerAssignmentFailed, setOwnerAssignmentFailed] = useState(false)

  // Keep the admin list backed by the same API used by the customer website.
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true)
        let page = 1
        let totalPages = 1
        const result = []
        do {
          const response = await axios.get(`${API_URL}/properties`, {
            ...authConfig(),
            params: { page, limit: 100, includeInactive: true },
          })
          const payload = response.data?.data
          result.push(...(Array.isArray(payload?.data) ? payload.data : []))
          totalPages = Math.max(1, Number(payload?.pagination?.pages) || 1)
          page += 1
        } while (page <= totalPages)
        setProperties(result)
        setFilteredProperties(result)
        const accounts = await Promise.all(['admin', 'property_owner'].map(async (role) => {
          const response = await axios.get(`${API_URL}/users`, {
            ...authConfig(),
            params: { page: 1, limit: 100, role, status: 'active' },
          })
          return response.data?.data?.data || []
        }))
        setManagerAccounts(accounts.flat())
        setLoading(false)
      } catch (error) {
        console.error('Error fetching properties:', error)
        setLoading(false)
      }
    }

    fetchProperties()
  }, [])

  // Filter properties based on search term
  useEffect(() => {
    const filtered = properties.filter(
      (p) =>
        String(p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.city || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredProperties(filtered)
  }, [searchTerm, properties])

  const handleAddProperty = () => {
    setEditingProperty(null)
    setShowForm(true)
  }

  const handleEditProperty = (property) => {
    setEditingProperty(property)
    setShowForm(true)
  }

  const handleDeleteProperty = async (id) => {
    if (window.confirm('Are you sure you want to delete this property?')) {
      try {
        await axios.delete(`${API_URL}/properties/${id}`, authConfig())
        setProperties(properties.filter((p) => p.id !== id))
      } catch (error) {
        console.error('Error deleting property:', error)
      }
    }
  }

  const handleSaveProperty = async (propertyData) => {
    try {
      if (editingProperty) {
        const response = await axios.put(
          `${API_URL}/properties/${editingProperty.id}`,
          propertyData,
          authConfig()
        )
        const updatedProperty = response.data?.data
        setProperties(properties.map((p) => (p.id === editingProperty.id ? updatedProperty : p)))
      } else {
        const response = await axios.post(`${API_URL}/properties`, propertyData, authConfig())
        const newProperty = response.data?.data
        if (newProperty) {
          setProperties([...properties, newProperty])
        }
      }
      setShowForm(false)
      setEditingProperty(null)
    } catch (error) {
      console.error('Error saving property:', error)
    }
  }

  const assignPropertyOwner = async (propertyId, ownerId) => {
    if (!ownerId) return
    setSavingOwnerId(propertyId)
    setOwnerAssignmentMessage('')
    setOwnerAssignmentFailed(false)
    try {
      const response = await axios.patch(`${API_URL}/properties/${propertyId}/owner`, { ownerId }, authConfig())
      const updatedProperty = response.data?.data
      setProperties((current) => current.map((property) => property.id === propertyId ? { ...property, ...updatedProperty } : property))
      setOwnerAssignmentMessage('Owner account updated. The property and its related records will now appear in that owner portal.')
    } catch (error) {
      setOwnerAssignmentMessage(error.response?.data?.error || 'Could not assign this property to that account.')
      setOwnerAssignmentFailed(true)
    } finally {
      setSavingOwnerId('')
    }
  }

  if (loading) {
    return <div className="loading-spinner">Loading properties...</div>
  }

  return (
    <div className="properties-container">
      {/* Header with Search and Add Button */}
      <div className="properties-header">
        <div className="search-bar">
          <FiSearch size={20} />
          <input
            type="text"
            placeholder="Search properties by name, address, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <button className="btn-primary" onClick={handleAddProperty}>
          <FiPlus size={20} />
          Add Property
        </button>
      </div>
      {ownerAssignmentMessage && <div className={ownerAssignmentFailed ? 'login-error' : 'settings-feedback-success'} role={ownerAssignmentFailed ? 'alert' : 'status'}>{ownerAssignmentMessage}</div>}

      {/* Property List */}
      <div className="properties-list">
        {filteredProperties.length === 0 ? (
          <div className="empty-state">
            <p>
              {searchTerm ? 'No properties match your search' : 'No properties yet'}
            </p>
            {!searchTerm && (
              <button className="btn-secondary" onClick={handleAddProperty}>
                Create First Property
              </button>
            )}
          </div>
        ) : (
            <table className="admin-table properties-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Price / Night</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Owner account</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
            {filteredProperties.map((property) => (
                <tr key={property.id}>
                  <td>
                    <strong className="property-table-name">{property.name}</strong>
                  </td>
                  <td className="property-table-type">{property.type.replace('_', ' ')}</td>
                  <td>
                    <span className="property-table-address">{property.address}</span>
                    <span className="property-table-city">{property.city}</span>
                  </td>
                  <td className="amount">KES {Number(property.pricePerNight || property.price_per_night || 0).toLocaleString()}</td>
                  <td>{property.capacity || 0} guests</td>
                  <td>
                    <span className={`status-badge ${property.status}`}>
                      {property.status}
                    </span>
                  </td>
                  <td>
                    <select
                      aria-label={`Owner account for ${property.name}`}
                      className="form-input property-owner-select"
                      value={property.ownerId || ''}
                      disabled={savingOwnerId === property.id || managerAccounts.length === 0}
                      onChange={(event) => assignPropertyOwner(property.id, event.target.value)}
                    >
                      <option value="" disabled>Select account</option>
                      {managerAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {[account.firstName, account.lastName].filter(Boolean).join(' ') || account.email} ({account.role === 'property_owner' ? 'Property owner' : 'Admin'})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="property-table-actions">
                      <button
                        className="table-action-button"
                        onClick={() => handleEditProperty(property)}
                        title="Edit property"
                        aria-label={`Edit ${property.name}`}
                      >
                        <FiEdit2 size={15} />
                      </button>
                      <button
                        className="table-action-button danger"
                        onClick={() => handleDeleteProperty(property.id)}
                        title="Delete property"
                        aria-label={`Delete ${property.name}`}
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
            ))}
              </tbody>
            </table>
        )}
      </div>

      {/* Property Form Modal */}
      {showForm && (
        <PropertyForm
          property={editingProperty}
          onSave={handleSaveProperty}
          onCancel={() => {
            setShowForm(false)
            setEditingProperty(null)
          }}
        />
      )}
    </div>
  )
}
