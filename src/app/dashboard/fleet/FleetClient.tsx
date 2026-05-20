'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Car, Plus, Edit2, Trash2, X, Upload, Trash, Image as ImageIcon, ChevronLeft, ChevronRight, History } from 'lucide-react'
import { addVehicle, updateVehicle, deleteVehicle } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { Badge } from '@/components/Badge'
import { createClient } from '@/utils/supabase/client'

export default function FleetClient({ initialVehicles, bookings = [] }: { initialVehicles: any[], bookings?: any[] }) {
  const { showToast } = useToast()
  const confirm = useConfirm()

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

  // History Drawer state
  const [historyVehicle, setHistoryVehicle] = useState<any>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [vehicleBookings, setVehicleBookings] = useState<any[]>([])
  const [vehicleMaintenance, setVehicleMaintenance] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'bookings' | 'maintenance'>('bookings')

  // Add modal state
  const [addFiles, setAddFiles] = useState<File[]>([])
  const addFileInputRef = useRef<HTMLInputElement>(null)
  
  // Edit modal state
  const [editExistingImages, setEditExistingImages] = useState<string[]>([])
  const [editNewFiles, setEditNewFiles] = useState<File[]>([])
  const editFileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)

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

  // --- View History Drawer ---
  const openHistoryDrawer = async (vehicle: any) => {
    setHistoryVehicle(vehicle)
    setHistoryLoading(true)
    setActiveTab('bookings')
    try {
      const supabase = createClient()
      
      // Fetch bookings
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('start_date', { ascending: false })
      
      // Fetch maintenance
      const { data: maintData } = await supabase
        .from('maintenance')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('service_date', { ascending: false })
        
      setVehicleBookings(bookingsData || [])
      setVehicleMaintenance(maintData || [])
    } catch (err: any) {
      showToast('Error loading vehicle history: ' + err.message, 'error')
    } finally {
      setHistoryLoading(false)
    }
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
                        <Badge variant={car.availability ? 'success' : 'danger'}>
                          {car.availability ? 'Available' : 'Rented'}
                        </Badge>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="icon-btn" title="View History" onClick={() => openHistoryDrawer(car)}>
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
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>Add New Vehicle</h2>
              <button className="icon-btn" onClick={() => { setIsAddModalOpen(false); setAddFiles([]); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="modal-form">
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

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" name="availability" defaultChecked id="avail" />
                <label htmlFor="avail" style={{ margin: 0 }}>Available for rent immediately</label>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setIsAddModalOpen(false); setAddFiles([]); }}>Cancel</button>
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

      {/* VEHICLE HISTORY DRAWER */}
      {historyVehicle && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 900, justifyContent: 'flex-end', alignItems: 'stretch' }} onClick={() => setHistoryVehicle(null)}>
          <div 
            className="glass-panel" 
            style={{ 
              width: '100%', 
              maxWidth: '500px', 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '2rem',
              background: 'rgba(15, 15, 20, 0.95)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '0',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 650, margin: 0 }}>Vehicle History</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  {historyVehicle.brand} {historyVehicle.model} ({historyVehicle.year})
                </p>
              </div>
              <button className="icon-btn" onClick={() => setHistoryVehicle(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.25rem', borderRadius: '8px' }}>
              <button 
                type="button"
                onClick={() => setActiveTab('bookings')}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'bookings' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: activeTab === 'bookings' ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Bookings ({vehicleBookings.length})
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('maintenance')}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'maintenance' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: activeTab === 'maintenance' ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Maintenance ({vehicleMaintenance.length})
              </button>
            </div>

            {/* Content Area */}
            {historyLoading ? (
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '3rem 0' }}>
                <span className="loading-spinner"></span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading history...</span>
              </div>
            ) : activeTab === 'bookings' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                {vehicleBookings.length > 0 ? (
                  vehicleBookings.map((b) => (
                    <div 
                      key={b.id} 
                      style={{ 
                        padding: '1rem', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{b.client_name}</span>
                        <Badge variant={b.status === 'confirmed' ? 'success' : b.status === 'pending' ? 'warning' : b.status === 'completed' ? 'default' : 'danger'}>
                          {b.status}
                        </Badge>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        📅 {new Date(b.start_date).toLocaleDateString()} - {new Date(b.end_date).toLocaleDateString()}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Total Amount</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>{Number(b.total_amount).toFixed(2)} DT</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '3rem 1rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '2rem' }}>📅</span>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No bookings logged for this vehicle.</p>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                {vehicleMaintenance.length > 0 ? (
                  vehicleMaintenance.map((m) => (
                    <div 
                      key={m.id} 
                      style={{ 
                        padding: '1rem', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</span>
                        <span style={{ fontWeight: 650, color: '#f87171', fontSize: '0.85rem' }}>-{Number(m.cost).toFixed(2)} DT</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        🔧 Service Date: {new Date(m.service_date).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Next service scheduled: 6 months after
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '3rem 1rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '2rem' }}>🔧</span>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No maintenance logs found for this vehicle.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
