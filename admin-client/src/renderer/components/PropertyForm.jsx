import React, { useState } from 'react'
import { FiX, FiUpload } from 'react-icons/fi'
import '../../styles/property-form.css'

/**
 * Property Form Component
 * Modal form for creating/editing properties
 */
export default function PropertyForm({ property, onSave, onCancel }) {
  const [formData, setFormData] = useState(
    property || {
      name: '',
      type: 'airbnb',
      address: '',
      city: '',
      country: '',
      pricePerNight: '',
      pricePerWeek: '',
      pricePerMonth: '',
      capacity: '',
      bedrooms: '',
      bathrooms: '',
      description: '',
      status: 'available',
      imageUrl: '',
    }
  )
  const [errors, setErrors] = useState({})

  const propertyTypes = [
    'one_bedroom',
    'airbnb',
    'single_room',
    'bedsitter',
    'bnb',
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }))
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, imageUrl: 'Please select an image file' }))
      return
    }
    const reader = new FileReader()
    reader.onload = () => setFormData((prev) => ({ ...prev, imageUrl: reader.result }))
    reader.readAsDataURL(file)
    setErrors((prev) => ({ ...prev, imageUrl: '' }))
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Property name is required'
    }
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required'
    }
    if (!formData.city.trim()) {
      newErrors.city = 'City is required'
    }
    if (!formData.pricePerNight) {
      newErrors.pricePerNight = 'Price per night is required'
    } else if (isNaN(formData.pricePerNight)) {
      newErrors.pricePerNight = 'Price must be a number'
    }
    if (!formData.capacity) {
      newErrors.capacity = 'Capacity is required'
    } else if (isNaN(formData.capacity)) {
      newErrors.capacity = 'Capacity must be a number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) {
      onSave(formData)
    }
  }

  return (
    <div className="form-modal-overlay" onClick={onCancel}>
      <div className="form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="form-header">
          <h2>{property ? 'Edit Property' : 'Create Property'}</h2>
          <button className="close-btn" onClick={onCancel}>
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="property-form">
          <div className="form-row">
            <div className="form-group">
              <label>Property Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Beachfront Apartment"
              />
              {errors.name && <span className="error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label>Type *</label>
              <select name="type" value={formData.type} onChange={handleChange}>
                {propertyTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group full-width">
              <label>Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="e.g., 123 Beach Street"
              />
              {errors.address && <span className="error">{errors.address}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>City *</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g., Nairobi"
              />
              {errors.city && <span className="error">{errors.city}</span>}
            </div>

            <div className="form-group">
              <label>Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="e.g., Kenya"
              />
            </div>
          </div>

          <div className="form-row form-row-three">
            <div className="form-group">
              <label>Price per Night (KES) *</label>
              <input
                type="number"
                name="pricePerNight"
                value={formData.pricePerNight}
                onChange={handleChange}
                placeholder="5500"
                step="50"
              />
              {errors.pricePerNight && <span className="error">{errors.pricePerNight}</span>}
            </div>

            <div className="form-group">
              <label>Price per Week (KES)</label>
              <input
                type="number"
                name="pricePerWeek"
                value={formData.pricePerWeek}
                onChange={handleChange}
                placeholder="35000"
                step="100"
              />
            </div>

            <div className="form-group">
              <label>Price per Month (KES)</label>
              <input
                type="number"
                name="pricePerMonth"
                value={formData.pricePerMonth}
                onChange={handleChange}
                placeholder="110000"
                step="500"
              />
            </div>
          </div>

          <div className="form-row form-row-three">
            <div className="form-group">
              <label>Capacity *</label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                placeholder="4"
              />
              {errors.capacity && <span className="error">{errors.capacity}</span>}
            </div>

            <div className="form-group">
              <label>Bedrooms</label>
              <input
                type="number"
                name="bedrooms"
                value={formData.bedrooms}
                onChange={handleChange}
                placeholder="2"
              />
            </div>

            <div className="form-group">
              <label>Bathrooms</label>
              <input
                type="number"
                name="bathrooms"
                value={formData.bathrooms}
                onChange={handleChange}
                placeholder="1"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the property..."
              rows={4}
            ></textarea>
          </div>

          <div className="form-group">
            <label>Property Image</label>
            <label className="image-upload-button">
              <FiUpload size={17} />
              Choose image
              <input type="file" accept="image/*" onChange={handleImageChange} hidden />
            </label>
            {formData.imageUrl && (
              <img className="property-image-preview" src={formData.imageUrl} alt="Property preview" />
            )}
            {errors.imageUrl && <span className="error">{errors.imageUrl}</span>}
          </div>

          <div className="form-group">
            <label>Status</label>
            <select name="status" value={formData.status} onChange={handleChange}>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {property ? 'Update Property' : 'Create Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
