'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Car, Plus, Edit2, Trash2, X, Upload, Trash, Image as ImageIcon, ChevronLeft, ChevronRight, History } from 'lucide-react'
import { addVehicle, updateVehicle, deleteVehicle } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { Badge } from '@/components/Badge'
import { createClient } from '@/utils/supabase/client'

export default function FleetClient({ initialVehicles, bookings = [] }: { initialVehicles: any[], bookings?: any[] }) {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const router = useRouter()

  // Memoized timezone-anchored current date string (Africa/Tunis)
  const todayStr = useMemo(() => {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Africa/Tunis',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    return formatter.format(now)
  }, [])

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') {
      setIsAddModalOpen(true)
    }
  }, [searchParams])

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any>(null)
  
  // Lightbox preview state
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)



  // Add modal state
  const [addFiles, setAddFiles] = useState<File[]>([])
  const addFileInputRef = useRef<HTMLInputElement>(null)
  
  // Edit modal state
  const [editExistingImages, setEditExistingImages] = useState<string[]>([])
  const [editNewFiles, setEditNewFiles] = useState<File[]>([])
  const editFileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [addOilDueKm, setAddOilDueKm] = useState<string>('')

  const handleLastOilChangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val) {
      const num = parseInt(val)
      if (!isNaN(num)) {
        setAddOilDueKm((num + 10000).toString())
      }
    } else {
      setAddOilDueKm('')
    }
  }

  // A4 FIX: Stable object URLs for Add modal previews — revoked on cleanup
  const addPreviewUrls = useMemo(
    () => addFiles.map(f => URL.createObjectURL(f)),
    [addFiles]
  )
  useEffect(() => {
    return () => { addPreviewUrls.forEach(url => URL.revokeObjectURL(url)) }
  }, [addPreviewUrls])

  // A4 FIX: Stable object URLs for Edit modal new-file previews — revoked on cleanup
  const editPreviewUrls = useMemo(
    () => editNewFiles.map(f => URL.createObjectURL(f)),
    [editNewFiles]
  )
  useEffect(() => {
    return () => { editPreviewUrls.forEach(url => URL.revokeObjectURL(url)) }
  }, [editPreviewUrls])

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Vehicle',
      message: 'Are you sure you want to delete this vehicle? All its images will also be permanently deleted from storage.',
      confirmLabel: 'Yes, Delete',
      danger: true,
    })
    if (!confirmed) return
    setLoading(true)
    try {
      await deleteVehicle(id)
      showToast('Vehicle deleted successfully.', 'success')
    } catch (error: any) {
      showToast('Error deleting vehicle: ' + error.message, 'error')
    }
    setLoading(false)
  }

  // Add modal handlers
  const handleAddFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setAddFiles(prev => [...prev, ...filesArray])
    }
  }

  const removeAddFile = (index: number) => {
    setAddFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    // Clear any default empty file entries
    formData.delete('images')
    // Append actual selected files
    addFiles.forEach(file => {
      formData.append('images', file)
    })

    try {
      await addVehicle(formData)
      setIsAddModalOpen(false)
      setAddFiles([])
      setAddOilDueKm('')
      showToast('Vehicle added successfully!', 'success')
    } catch (error: any) {
      showToast('Error adding vehicle: ' + error.message, 'error')
    }
    setLoading(false)
  }

  // Edit modal handlers
  const openEditModal = (vehicle: any) => {
    setEditingVehicle(vehicle)
    setEditExistingImages(vehicle.images || [])
    setEditNewFiles([])
    setIsEditModalOpen(true)
  }

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setEditNewFiles(prev => [...prev, ...filesArray])
    }
  }

  const removeEditNewFile = (index: number) => {
    setEditNewFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeEditExistingImage = (imgUrl: string) => {
    setEditExistingImages(prev => prev.filter(img => img !== imgUrl))
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    formData.append('id', editingVehicle.id)
    formData.append('existing_images', JSON.stringify(editExistingImages))
    
    // Clear any default empty file entries
    formData.delete('new_images')
    // Append actual new selected files
    editNewFiles.forEach(file => {
      formData.append('new_images', file)
    })

    try {
      await updateVehicle(formData)
      setIsEditModalOpen(false)
      setEditingVehicle(null)
      setEditNewFiles([])
      showToast('Vehicle updated successfully!', 'success')
    } catch (error: any) {
      showToast('Error updating vehicle: ' + error.message, 'error')
    }
    setLoading(false)
  }



  return (
    <div className='dashboard-page'>
      <div className='header-section'>
        <div className="header-title-row">
          <div>
            <h1 className='page-title'>My Fleet</h1>
            <p className='subtitle'>Manage your rental vehicles, pricing, and images.</p>
          </div>
          <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} />
            <span>Add Vehicle</span>
          </button>
        </div>
      </div>

      <div className='content-grid'>
        <div className='glass-panel table-container'>
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle Details</th>
                <th>License Plate</th>
                <th>Year</th>
                <th>Price / Day</th>
                <th>Analytics (Revenue & Util)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialVehicles && initialVehicles.length > 0 ? (
                initialVehicles.map((car) => {
                  const carBookings = bookings.filter(b => b.vehicle_id === car.id && (b.status === 'confirmed' || b.status === 'completed'))
                  const revenue = carBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0)
                  const rentalCount = carBookings.length

                  // Calculate on-the-fly rented status using Tunisia sysdate timezone anchor
                  const isRented = bookings.some(b => 
                    b.vehicle_id === car.id && 
                    (b.status === 'confirmed' || b.status === 'completed') && 
                    b.start_date <= todayStr && 
                    b.end_date >= todayStr
                  )

                  // Calculate 30-day utilization rate
                  let rentedDaysInLast30 = 0
                  const nowObj = new Date()
                  const startOfPeriod = new Date()
                  startOfPeriod.setDate(nowObj.getDate() - 30)

                  carBookings.forEach(b => {
                    const start = new Date(b.start_date)
                    const end = new Date(b.end_date)
                    
                    const overlapStart = start > startOfPeriod ? start : startOfPeriod
                    const overlapEnd = end < nowObj ? end : nowObj
                    
                    if (overlapStart <= overlapEnd) {
                      const diffTime = overlapEnd.getTime() - overlapStart.getTime()
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
                      rentedDaysInLast30 += diffDays
                    }
                  })

                  const utilization = Math.min(100, Math.round((rentedDaysInLast30 / 30) * 100))

                  return (
                    <tr key={car.id}>
                      <td>
                        <div className="user-info">
                          {car.images && car.images.length > 0 ? (
                            <img 
                              src={car.images[0]} 
                              alt={`${car.brand} ${car.model}`}
                              className="vehicle-img-thumbnail" 
                              style={{ cursor: 'pointer' }}
                              title="Click to view images"
                              onClick={() => {
                                setLightboxImages(car.images)
                                setLightboxIndex(0)
                              }}
                            />
                          ) : (
                            <div className="avatar-sm" style={{ borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                              <Car size={18} />
                            </div>
                          )}
                          <div>
                            <div className="fw-500">{car.brand} {car.model}</div>
                            <div className="text-xs text-muted" style={{ color: car.color ? car.color : 'var(--text-muted)' }}>
                              {car.color || 'No color set'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--accent-gold)' }}>
                          {car.license_plate || '—'}
                        </span>
                      </td>
                      <td>{car.year}</td>
                      <td>{car.price_per_day} DT</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-gold)' }}>
                            {revenue.toLocaleString()} DT
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {rentalCount} rents · {utilization}% util.
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge variant={isRented ? 'danger' : 'success'}>
                          {isRented ? '🔴 Rented' : '🟢 Available'}
                        </Badge>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="icon-btn" title="View History" onClick={() => router.push(`/dashboard/vehicles/${car.id}/history`)}>
                            <History size={16} />
                          </button>
                          <button className="icon-btn" title="Edit Vehicle" onClick={() => openEditModal(car)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="icon-btn text-danger" title="Delete" onClick={() => handleDelete(car.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-4">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
                      <Car size={48} style={{ opacity: 0.5, color: 'var(--text-muted)' }} />
                      <p>You haven't added any vehicles yet.</p>
                      <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => setIsAddModalOpen(true)}>Add Your First Vehicle</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD VEHICLE MODAL */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Add New Vehicle</h2>
              <button className="icon-btn" onClick={() => { setIsAddModalOpen(false); setAddFiles([]); setAddOilDueKm(''); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="modal-form">
              <h4 style={{ 
                color: 'var(--accent-gold)', 
                borderBottom: '1px solid rgba(255, 215, 0, 0.15)', 
                paddingBottom: '0.4rem', 
                marginBottom: '1rem', 
                fontSize: '0.9rem', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Core Specifications
              </h4>

              <div className="form-group">
                <label>Brand</label>
                <input type="text" name="brand" required placeholder="e.g. Mercedes-Benz" className="form-input" />
              </div>
              <div className="form-group">
                <label>Model</label>
                <input type="text" name="model" required placeholder="e.g. G-Class" className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Year</label>
                  <input type="number" name="year" required placeholder="2024" min="1900" max="2100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Price per Day (DT)</label>
                  <input type="number" name="price_per_day" required placeholder="150" min="0" step="0.01" className="form-input" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>License Plate</label>
                  <input type="text" name="license_plate" placeholder="e.g. 123 TU 4567" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <input type="text" name="color" placeholder="e.g. Pearl White" className="form-input" />
                </div>
              </div>
              
              {/* VEHICLE IMAGE SYSTEM: UPLOAD & PREVIEW */}
              <div className="form-group">
                <label>Vehicle Images</label>
                <input 
                  type="file" 
                  ref={addFileInputRef}
                  onChange={handleAddFileChange} 
                  multiple 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                />
                <div className="upload-dropzone" onClick={() => addFileInputRef.current?.click()}>
                  <Upload size={24} style={{ color: 'var(--accent-gold)' }} />
                  <p>Click to upload vehicle images</p>
                  <span>Support JPEG, PNG, WEBP (Max 5MB each)</span>
                </div>
                
                {addFiles.length > 0 && (
                  <div className="previews-grid animate-fade-in">
                    {addFiles.map((file, idx) => (
                      <div key={idx} className="preview-item">
                        <img 
                          src={addPreviewUrls[idx]} 
                          alt="preview" 
                          className="preview-image" 
                        />
                        <button 
                          type="button" 
                          className="delete-btn-overlay"
                          onClick={() => removeAddFile(idx)}
                          title="Remove Image"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* MECHANICAL & MAINTENANCE */}
              <h4 style={{ 
                color: 'var(--accent-gold)', 
                borderBottom: '1px solid rgba(255, 215, 0, 0.15)', 
                paddingBottom: '0.4rem', 
                marginTop: '1.25rem',
                marginBottom: '1rem', 
                fontSize: '0.9rem', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Mechanical & Maintenance
              </h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Current Odometer (KM)</label>
                  <input type="number" name="current_km" placeholder="e.g. 15000" className="form-input" min="0" />
                </div>
                <div className="form-group">
                  <label>Brake Pads Status</label>
                  <select name="brake_pad_state" className="form-input" defaultValue="good">
                    <option value="good">🟢 Good condition</option>
                    <option value="worn">🟡 Worn - Inspect soon</option>
                    <option value="critical">🔴 CRITICAL - Replace now</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Last Oil Change (KM)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 9800" 
                    className="form-input" 
                    min="0"
                    onChange={handleLastOilChangeChange}
                  />
                </div>
                <div className="form-group">
                  <label>Next Oil Change Due (KM)</label>
                  <input 
                    type="number" 
                    name="oil_change_due_km" 
                    placeholder="e.g. 19800" 
                    className="form-input" 
                    min="0"
                    value={addOilDueKm}
                    onChange={(e) => setAddOilDueKm(e.target.value)}
                  />
                </div>
              </div>

              {/* LEGAL COMPLIANCE */}
              <h4 style={{ 
                color: 'var(--accent-gold)', 
                borderBottom: '1px solid rgba(255, 215, 0, 0.15)', 
                paddingBottom: '0.4rem', 
                marginTop: '1.25rem',
                marginBottom: '1rem', 
                fontSize: '0.9rem', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Legal Compliance Dates
              </h4>

              <div className="form-row">
                <div className="form-group">
                  <label>Assurance Expiry</label>
                  <input type="date" name="assurance_expiry" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Visite Technique Expiry</label>
                  <input type="date" name="visite_technique_expiry" className="form-input" />
                </div>
              </div>
              
              <div className="form-group">
                <label>Laissez-Passer Expiry</label>
                <input type="date" name="laissez_passer_expiry" className="form-input" />
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input type="checkbox" name="availability" defaultChecked id="avail" />
                <label htmlFor="avail" style={{ margin: 0 }}>Available for rent immediately</label>
              </div>
              
              <div className="modal-footer" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => { setIsAddModalOpen(false); setAddFiles([]); setAddOilDueKm(''); }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="loading-spinner"></span>
                      <span>Saving...</span>
                    </div>
                  ) : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VEHICLE MODAL */}
      {isEditModalOpen && editingVehicle && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>Edit Vehicle Details</h2>
              <button className="icon-btn" onClick={() => { setIsEditModalOpen(false); setEditingVehicle(null); setEditNewFiles([]); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="form-group">
                <label>Brand</label>
                <input 
                  type="text" 
                  name="brand" 
                  required 
                  defaultValue={editingVehicle.brand} 
                  placeholder="e.g. Mercedes-Benz" 
                  className="form-input" 
                />
              </div>
              <div className="form-group">
                <label>Model</label>
                <input 
                  type="text" 
                  name="model" 
                  required 
                  defaultValue={editingVehicle.model} 
                  placeholder="e.g. G-Class" 
                  className="form-input" 
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Year</label>
                  <input 
                    type="number" 
                    name="year" 
                    required 
                    defaultValue={editingVehicle.year} 
                    placeholder="2024" 
                    min="1900" 
                    max="2100" 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>Price per Day (DT)</label>
                  <input 
                    type="number" 
                    name="price_per_day" 
                    required 
                    defaultValue={editingVehicle.price_per_day} 
                    placeholder="150" 
                    min="0" 
                    step="0.01" 
                    className="form-input" 
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>License Plate</label>
                  <input 
                    type="text" 
                    name="license_plate" 
                    defaultValue={editingVehicle.license_plate || ''} 
                    placeholder="e.g. 123 TU 4567" 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <input 
                    type="text" 
                    name="color" 
                    defaultValue={editingVehicle.color || ''} 
                    placeholder="e.g. Pearl White" 
                    className="form-input" 
                  />
                </div>
              </div>

              {/* VEHICLE IMAGE SYSTEM: EXISTING & NEW UPLOADS */}
              <div className="form-group">
                <label>Vehicle Images</label>
                
                {/* Existing Images list */}
                {editExistingImages.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Active Images
                    </div>
                    <div className="previews-grid">
                      {editExistingImages.map((imgUrl, idx) => (
                        <div key={idx} className="preview-item">
                          <img 
                            src={imgUrl} 
                            alt="existing" 
                            className="preview-image" 
                          />
                          <button 
                            type="button" 
                            className="delete-btn-overlay"
                            onClick={() => removeEditExistingImage(imgUrl)}
                            title="Delete Image"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Add new images inside edit */}
                <input 
                  type="file" 
                  ref={editFileInputRef}
                  onChange={handleEditFileChange} 
                  multiple 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                />
                <div className="upload-dropzone" onClick={() => editFileInputRef.current?.click()}>
                  <Upload size={20} style={{ color: 'var(--accent-gold)' }} />
                  <p style={{ fontSize: '0.75rem' }}>Upload additional images</p>
                </div>
                
                {editNewFiles.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      To Upload (Preview)
                    </div>
                    <div className="previews-grid animate-fade-in">
                      {editNewFiles.map((file, idx) => (
                        <div key={idx} className="preview-item">
                          <img 
                            src={editPreviewUrls[idx]} 
                            alt="preview" 
                            className="preview-image" 
                          />
                          <button 
                            type="button" 
                            className="delete-btn-overlay"
                            onClick={() => removeEditNewFile(idx)}
                            title="Remove"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  name="availability" 
                  defaultChecked={editingVehicle.availability} 
                  id="edit-avail" 
                />
                <label htmlFor="edit-avail" style={{ margin: 0 }}>Available for rent immediately</label>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setIsEditModalOpen(false); setEditingVehicle(null); setEditNewFiles([]); }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="loading-spinner"></span>
                      <span>Saving Changes...</span>
                    </div>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE LIGHTBOX MODAL */}
      {lightboxImages && lightboxImages.length > 0 && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000 }} onClick={() => setLightboxImages(null)}>
          <div 
            className="glass-panel" 
            style={{ 
              position: 'relative', 
              maxWidth: '800px', 
              width: '90%', 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              padding: '1.5rem',
              background: 'rgba(20, 20, 25, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Image {lightboxIndex + 1} of {lightboxImages.length}
              </span>
              <button className="icon-btn" onClick={() => setLightboxImages(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ position: 'relative', width: '100%', height: '500px', maxHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img 
                src={lightboxImages[lightboxIndex]} 
                alt={`Vehicle preview ${lightboxIndex + 1}`} 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
              />
              
              {lightboxImages.length > 1 && (
                <>
                  <button 
                    className="icon-btn" 
                    style={{ position: 'absolute', left: '-0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', padding: '0.6rem' }}
                    onClick={() => setLightboxIndex((prev) => (prev === 0 ? lightboxImages.length - 1 : prev - 1))}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    className="icon-btn" 
                    style={{ position: 'absolute', right: '-0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', padding: '0.6rem' }}
                    onClick={() => setLightboxIndex((prev) => (prev === lightboxImages.length - 1 ? 0 : prev + 1))}
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
