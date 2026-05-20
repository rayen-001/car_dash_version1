'use client'

import { useState, useRef } from 'react'
import { Building, Phone, MapPin, Coins, FileText, Image, CheckCircle2, ShieldAlert, Sparkles, Loader2, Upload, Trash } from 'lucide-react'
import { saveBusinessSettings } from '@/app/actions'
import { BusinessSettings } from '@/types'
import styles from './settings.module.css'

interface SettingsClientProps {
  initialSettings: BusinessSettings
}

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [loading, setLoading] = useState(false)
  const [businessName, setBusinessName] = useState(initialSettings.business_name || '')
  const [logoUrl, setLogoUrl] = useState(initialSettings.logo_url || '')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(initialSettings.logo_url || null)
  const [phone, setPhone] = useState(initialSettings.phone || '')
  const [address, setAddress] = useState(initialSettings.address || '')
  const [currency, setCurrency] = useState(initialSettings.currency || 'DT')
  const [rentalTerms, setRentalTerms] = useState(initialSettings.rental_terms || '')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoUrl('')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('business_name', businessName)
      formData.append('logo_url', logoUrl)
      if (logoFile) {
        formData.append('logo_file', logoFile)
      }
      formData.append('phone', phone)
      formData.append('address', address)
      formData.append('currency', currency)
      formData.append('rental_terms', rentalTerms)

      await saveBusinessSettings(formData)
      setMessage({ type: 'success', text: 'Business settings saved successfully!' })
      
      // Dispatch custom event to trigger real-time topbar logo & name updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('business-settings-updated'))
      }
    } catch (err: any) {
      console.error(err)
      setMessage({ 
        type: 'error', 
        text: err.message || 'Failed to save settings' 
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles['dashboard-page']} animate-fade-in`}>
      <div className={styles['header-section']}>
        <h1 className={styles['page-title']}>⚙️ Business Settings</h1>
        <p className={styles['subtitle']}>Configure your dynamic branding, print contract terms, invoices, and odometer configurations.</p>
      </div>

      {message && (
        <div className={`${styles['status-banner']} ${message.type}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className={styles['content-grid']}>
        {/* Form panel */}
        <div className={`glass-panel ${styles['form-panel']}`}>
          <div className={styles['panel-header-row']}>
            <h3 className={styles['section-subtitle']}>Brand Settings & Customization</h3>
            <span className={styles['badge-branding']}>Branding Profile</span>
          </div>

          <form onSubmit={handleSave} className={styles['settings-form']}>
            <div className={styles['form-group']}>
              <label>
                <Building size={14} className={styles['input-icon']} />
                <span>Business Name</span>
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                placeholder="e.g. Royal Luxury Car Rental"
                className={styles['form-input']}
              />
            </div>

            <div className={styles['form-group']}>
              <label>
                <Image size={14} className={styles['input-icon']} />
                <span>Business Logo Brand Image</span>
              </label>
              
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleLogoChange}
                accept="image/*"
                style={{ display: 'none' }}
              />

              <div 
                className={`${styles['upload-dropzone']} ${isDragOver ? styles['drag-over'] : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragOver ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {logoPreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img 
                      src={logoPreview} 
                      alt="Brand Logo Preview" 
                      style={{ height: '80px', objectFit: 'contain', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.15)' }} 
                    />
                    <button
                      type="button"
                      className="delete-btn-overlay"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLogo();
                      }}
                      title="Remove Logo"
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        background: 'rgba(239, 68, 68, 0.9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                      }}
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={24} style={{ color: 'var(--accent-gold)' }} />
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>
                      Drag and drop your logo here, or <span style={{ color: 'var(--accent-gold)' }}>browse</span>
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Supports JPEG, PNG, SVG, WEBP (Max 2MB)
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className={styles['form-row']}>
              <div className={styles['form-group']}>
                <label>
                  <Phone size={14} className={styles['input-icon']} />
                  <span>Business Phone</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 019-2834"
                  className={styles['form-input']}
                />
              </div>

              <div className={styles['form-group']}>
                <label>
                  <Coins size={14} className={styles['input-icon']} />
                  <span>Currency Sign</span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={`${styles['form-input']} ${styles['select-input']}`}
                  disabled
                >
                  <option value="DT">DT (Tunisian Dinar)</option>
                </select>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label>
                <MapPin size={14} className={styles['input-icon']} />
                <span>Business Office Address</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 1024 Prestige Boulevard, Suite 500, New York, NY"
                className={styles['form-input']}
              />
            </div>

            <div className={styles['form-group']}>
              <label>
                <FileText size={14} className={styles['input-icon']} />
                <span>Custom Rental Terms & Conditions (Fine Print)</span>
              </label>
              <textarea
                value={rentalTerms}
                onChange={(e) => setRentalTerms(e.target.value)}
                rows={5}
                placeholder="Specify the standard fine print, insurance policies, late return guidelines, and penalties. This text will be printed at the bottom of all generated customer contracts."
                className={`${styles['form-input']} ${styles['textarea-input']}`}
              />
            </div>

            <button type="submit" className={styles['btn-gold']} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className={styles['spinner']} size={18} />
                  <span>Saving Custom Branding...</span>
                </>
              ) : (
                'Save Business Settings'
              )}
            </button>
          </form>
        </div>

        {/* Live Preview Panel */}
        <div className={`glass-panel ${styles['preview-panel']}`}>
          <h3 className={styles['section-subtitle']}>Real-time Brand Preview</h3>
          <p className={styles['preview-help']}>Here is how your business card, print agreements, and invoice receipt headers will display to your clients:</p>
          
          <div className={`${styles['preview-receipt']} glass-panel`}>
            <div className={styles['receipt-header']}>
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className={styles['preview-logo-img']} onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }} />
              ) : (
                <div className={styles['receipt-avatar']}>{businessName ? businessName.charAt(0) : 'R'}</div>
              )}
              <div>
                <h4 className={styles['receipt-title']}>{businessName || 'Your Business Name'}</h4>
                <p className={styles['receipt-subtext']}>{phone || 'Phone Number'}</p>
                <p className={styles['receipt-subtext']}>{address || 'Business Address'}</p>
              </div>
            </div>

            <div className={styles['receipt-divider']}></div>

            <div className={styles['receipt-body']}>
              <div className={styles['receipt-row']}>
                <span>Vehicle Model:</span>
                <span className={`${styles['white-text']} ${styles['font-medium']}`}>Porsche 911 Carrera S</span>
              </div>
              <div className={styles['receipt-row']}>
                <span>Rental Period:</span>
                <span className={`${styles['white-text']} ${styles['font-medium']}`}>3 Days</span>
              </div>
              <div className={styles['receipt-row']}>
                <span>Rate:</span>
                <span className={`${styles['white-text']} ${styles['font-medium']}`}>250 {currency} / Day</span>
              </div>
              <div className={`${styles['receipt-divider']} ${styles['dotted']}`}></div>
              <div className={`${styles['receipt-row']} ${styles['total']}`}>
                <span>Total Amount:</span>
                <span className={`${styles['gold-text']} ${styles['font-bold']}`}>750 {currency}</span>
              </div>
            </div>

            <div className={styles['receipt-status-stamp']}>
              <span>PAID RECEIPT</span>
            </div>
          </div>

          <div className={styles['branding-notes']}>
            <div className={styles['note-item']}>
              <Sparkles size={14} className={styles['gold-text']} />
              <span><strong>Logo Integration:</strong> Provided logo URL flows dynamically into printable documents.</span>
            </div>
            <div className={styles['note-item']}>
              <Sparkles size={14} className={styles['gold-text']} />
              <span><strong>Currency Adaptability:</strong> All rates, security deposits, and calculations render instantly using <strong>{currency}</strong>.</span>
            </div>
            <div className={styles['note-item']}>
              <Sparkles size={14} className={styles['gold-text']} />
              <span><strong>Odometer Configuration:</strong> Start/Return mileage logs dynamically generate mileage charts.</span>
            </div>
          </div>
        </div>
      </div>

      
    </div>
  )
}
