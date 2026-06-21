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
  const [matriculeFiscal, setMatriculeFiscal] = useState(initialSettings.matricule_fiscal || '')
  const [rneNumber, setRneNumber] = useState(initialSettings.rne_number || '')
  const [ownerFullName, setOwnerFullName] = useState(initialSettings.owner_full_name || '')
  const [email, setEmail] = useState(initialSettings.email || '')
  const [city, setCity] = useState(initialSettings.city || '')
  const [contractLanguage, setContractLanguage] = useState(initialSettings.contract_language || 'fr')
  const [tvaNumber, setTvaNumber] = useState(initialSettings.tva_number || '')
  const [tvaRate, setTvaRate] = useState(initialSettings.tva_rate?.toString() || '0.00')

  // Phase 16.4 — Bilingual Tunisian contract identity fields. These are
  // consumed exclusively by the printed contract template (BookingAgreement
  // Modal / RentalContractPDF). Empty values render as dotted-placeholder
  // rows in the printout so the operator can hand-write them temporarily.
  const [businessNameAr, setBusinessNameAr] = useState(initialSettings.business_name_ar || '')
  const [siegeSocialFr1, setSiegeSocialFr1] = useState(initialSettings.siege_social_fr_1 || '')
  const [siegeSocialFr2, setSiegeSocialFr2] = useState(initialSettings.siege_social_fr_2 || '')
  const [siegeSocialAr1, setSiegeSocialAr1] = useState(initialSettings.siege_social_ar_1 || '')
  const [siegeSocialAr2, setSiegeSocialAr2] = useState(initialSettings.siege_social_ar_2 || '')
  const [phoneSecondary, setPhoneSecondary] = useState(initialSettings.phone_secondary || '')
  const [franchiseAmount, setFranchiseAmount] = useState(initialSettings.franchise_amount?.toString() || '1000')
  const [lateFeePerHour, setLateFeePerHour] = useState(initialSettings.late_fee_per_hour?.toString() || '10')
  const [kmPerDay, setKmPerDay] = useState(initialSettings.km_per_day?.toString() || '250')

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
      formData.append('matricule_fiscal', matriculeFiscal)
      formData.append('rne_number', rneNumber)
      formData.append('owner_full_name', ownerFullName)
      formData.append('email', email)
      formData.append('city', city)
      formData.append('contract_language', contractLanguage)
      formData.append('tva_number', tvaNumber)
      formData.append('tva_rate', tvaRate)

      // Phase 16.4 — bilingual contract identity
      formData.append('business_name_ar', businessNameAr)
      formData.append('siege_social_fr_1', siegeSocialFr1)
      formData.append('siege_social_fr_2', siegeSocialFr2)
      formData.append('siege_social_ar_1', siegeSocialAr1)
      formData.append('siege_social_ar_2', siegeSocialAr2)
      formData.append('phone_secondary', phoneSecondary)
      formData.append('franchise_amount', franchiseAmount)
      formData.append('late_fee_per_hour', lateFeePerHour)
      formData.append('km_per_day', kmPerDay)

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

      <form onSubmit={handleSave} className={styles['settings-form']}>
        <div className={styles['content-grid']}>
          {/* Column 1: Brand Identity & Legal Compliance */}
          <div className={styles['settings-column']}>
            
            {/* Card 1: Brand Settings & Customization */}
            <div className={`glass-panel ${styles['settings-card']}`}>
              <div className={styles['panel-header-row']}>
                <h3 className={styles['section-subtitle']}>
                  <Building size={18} className={styles['input-icon']} style={{ marginRight: '0.5rem', display: 'inline', verticalAlign: 'middle' }} />
                  Brand Settings & Customization
                </h3>
                <span className={styles['badge-branding']}>Branding Profile</span>
              </div>

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
                  placeholder="e.g. Yasmin Car Rental"
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
                    placeholder="e.g. +216 71 123 456"
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
                  placeholder="e.g. Avenue Habib Bourguiba, Tunis 1000"
                  className={styles['form-input']}
                />
              </div>
            </div>

            {/* Card 2: Legal & Tax Information */}
            <div className={`glass-panel ${styles['settings-card']}`}>
              <div className={styles['panel-header-row']}>
                <h3 className={styles['section-subtitle']}>
                  <Coins size={18} className={styles['input-icon']} style={{ marginRight: '0.5rem', display: 'inline', verticalAlign: 'middle' }} />
                  ⚖️ Legal & Tax Information (Tunisian Compliance)
                </h3>
                <span className={styles['badge-branding']}>Legal Compliance</span>
              </div>

              <div className={styles['form-row']}>
                <div className={styles['form-group']}>
                  <label>
                    <span>Matricule Fiscal (Tax ID)</span>
                  </label>
                  <input
                    type="text"
                    value={matriculeFiscal}
                    onChange={(e) => setMatriculeFiscal(e.target.value)}
                    placeholder="e.g. 1234567/A/M/000"
                    className={styles['form-input']}
                  />
                </div>

                <div className={styles['form-group']}>
                  <label>
                    <span>RNE Number (Enterprise Register)</span>
                  </label>
                  <input
                    type="text"
                    value={rneNumber}
                    onChange={(e) => setRneNumber(e.target.value)}
                    placeholder="e.g. 1234567B"
                    className={styles['form-input']}
                  />
                </div>
              </div>

              <div className={styles['form-row']}>
                <div className={styles['form-group']}>
                  <label>
                    <span>Owner / Signatory Name</span>
                  </label>
                  <input
                    type="text"
                    value={ownerFullName}
                    onChange={(e) => setOwnerFullName(e.target.value)}
                    placeholder="e.g. Foulen Ben Foulen"
                    className={styles['form-input']}
                  />
                </div>

                <div className={styles['form-group']}>
                  <label>
                    <span>Legal Contact Email</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. agency@cardash.tn"
                    className={styles['form-input']}
                  />
                </div>
              </div>

              <div className={styles['form-row']}>
                <div className={styles['form-group']}>
                  <label>
                    <span>City / Jurisdiction (Tunisia)</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Tunis"
                    className={styles['form-input']}
                  />
                </div>

                <div className={styles['form-group']}>
                  <label>
                    <span>Contract Language Preference</span>
                  </label>
                  <select
                    value={contractLanguage}
                    onChange={(e) => setContractLanguage(e.target.value)}
                    className={`${styles['form-input']} ${styles['select-input']}`}
                  >
                    <option value="fr">French (fr)</option>
                    <option value="ar">Arabic (ar)</option>
                    <option value="fr_ar">Bilingual (fr + ar)</option>
                  </select>
                </div>
              </div>

              <div className={styles['form-row']}>
                <div className={styles['form-group']}>
                  <label>
                    <span>TVA Tax Code</span>
                  </label>
                  <input
                    type="text"
                    value={tvaNumber}
                    onChange={(e) => setTvaNumber(e.target.value)}
                    placeholder="e.g. 1234567/A/N/000"
                    className={styles['form-input']}
                  />
                </div>

                <div className={styles['form-group']}>
                  <label>
                    <span>TVA Rate (%)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tvaRate}
                    onChange={(e) => setTvaRate(e.target.value)}
                    placeholder="e.g. 19.00"
                    className={styles['form-input']}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Bilingual Contract & Fine Print */}
          <div className={styles['settings-column']}>
            
            {/* Card 3: Bilingual Contract Identity */}
            <div className={`glass-panel ${styles['settings-card']}`}>
              <div className={styles['panel-header-row']}>
                <h3 className={styles['section-subtitle']}>
                  <Sparkles size={18} className={styles['input-icon']} style={{ marginRight: '0.5rem', display: 'inline', verticalAlign: 'middle' }} />
                  🇹🇳 Bilingual Contract Identity (French / Arabic)
                </h3>
                <span className={styles['badge-branding']}>Print Engine</span>
              </div>

              <div className={styles['form-group']}>
                <label>
                  <span>Business Name (Arabic)</span>
                </label>
                <input
                  type="text"
                  value={businessNameAr}
                  onChange={(e) => setBusinessNameAr(e.target.value)}
                  placeholder="e.g. شركة الياسمين لكراء السيارات"
                  dir="rtl"
                  lang="ar"
                  className={styles['form-input']}
                  style={{ fontFamily: "'Noto Naskh Arabic', 'Cairo', 'Tahoma', 'Arial', sans-serif" }}
                />
              </div>

              <div className={styles['form-row']}>
                <div className={styles['form-group']}>
                  <label>
                    <span>Siège Social — Line 1 (FR)</span>
                  </label>
                  <input
                    type="text"
                    value={siegeSocialFr1}
                    onChange={(e) => setSiegeSocialFr1(e.target.value)}
                    placeholder="e.g. Avenue Habib Bourguiba - Tunis 1000"
                    className={styles['form-input']}
                  />
                </div>
                <div className={styles['form-group']}>
                  <label>
                    <span>Siège Social — Line 2 (FR)</span>
                  </label>
                  <input
                    type="text"
                    value={siegeSocialFr2}
                    onChange={(e) => setSiegeSocialFr2(e.target.value)}
                    placeholder="e.g. Route de la plage - Sousse 4000"
                    className={styles['form-input']}
                  />
                </div>
              </div>

              <div className={styles['form-row']}>
                <div className={styles['form-group']}>
                  <label>
                    <span>المقر الرئيسي — Line 1 (AR)</span>
                  </label>
                  <input
                    type="text"
                    value={siegeSocialAr1}
                    onChange={(e) => setSiegeSocialAr1(e.target.value)}
                    placeholder="e.g. شارع الحبيب بورقيبة - تونس 1000"
                    dir="rtl"
                    lang="ar"
                    className={styles['form-input']}
                    style={{ fontFamily: "'Noto Naskh Arabic', 'Cairo', 'Tahoma', 'Arial', sans-serif" }}
                  />
                </div>
                <div className={styles['form-group']}>
                  <label>
                    <span>المقر الرئيسي — Line 2 (AR)</span>
                  </label>
                  <input
                    type="text"
                    value={siegeSocialAr2}
                    onChange={(e) => setSiegeSocialAr2(e.target.value)}
                    placeholder="e.g. طريق الشاطئ - سوسة 4000"
                    dir="rtl"
                    lang="ar"
                    className={styles['form-input']}
                    style={{ fontFamily: "'Noto Naskh Arabic', 'Cairo', 'Tahoma', 'Arial', sans-serif" }}
                  />
                </div>
              </div>

              <div className={styles['form-row']}>
                <div className={styles['form-group']}>
                  <label>
                    <span>Secondary Phone (optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phoneSecondary}
                    onChange={(e) => setPhoneSecondary(e.target.value)}
                    placeholder="e.g. 98 765 432"
                    className={styles['form-input']}
                  />
                </div>
                <div className={styles['form-group']}>
                  <label>
                    <span>Franchise Amount (DT)</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={franchiseAmount}
                    onChange={(e) => setFranchiseAmount(e.target.value)}
                    placeholder="e.g. 1000"
                    className={styles['form-input']}
                  />
                </div>
              </div>

              <div className={styles['form-row']}>
                <div className={styles['form-group']}>
                  <label>
                    <span>Late Fee per Hour (DT)</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={lateFeePerHour}
                    onChange={(e) => setLateFeePerHour(e.target.value)}
                    placeholder="e.g. 10"
                    className={styles['form-input']}
                  />
                </div>
                <div className={styles['form-group']}>
                  <label>
                    <span>Forfait Kilometers / Day</span>
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={kmPerDay}
                    onChange={(e) => setKmPerDay(e.target.value)}
                    placeholder="e.g. 250"
                    className={styles['form-input']}
                  />
                </div>
              </div>
            </div>

            {/* Card 4: Fine Print Terms */}
            <div className={`glass-panel ${styles['settings-card']}`}>
              <div className={styles['panel-header-row']}>
                <h3 className={styles['section-subtitle']}>
                  <FileText size={18} className={styles['input-icon']} style={{ marginRight: '0.5rem', display: 'inline', verticalAlign: 'middle' }} />
                  Custom Rental Terms & Conditions (Fine Print)
                </h3>
              </div>

              <div className={styles['form-group']}>
                <textarea
                  value={rentalTerms}
                  onChange={(e) => setRentalTerms(e.target.value)}
                  rows={5}
                  placeholder="Specify the standard fine print, insurance policies, late return guidelines, and penalties. This text will be printed at the bottom of all generated customer contracts."
                  className={`${styles['form-input']} ${styles['textarea-input']}`}
                />
              </div>

              <button type="submit" className={styles['btn-gold']} disabled={loading} style={{ alignSelf: 'stretch', marginTop: '0.5rem' }}>
                {loading ? (
                  <>
                    <Loader2 className={styles['spinner']} size={18} />
                    <span>Saving Custom Branding...</span>
                  </>
                ) : (
                  'Save Business Settings'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
