'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calendar, Wrench, X, ShieldAlert, Check } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { useToast } from '@/components/Toast'
import styles from './history.module.css'

// Actions
import { 
  updateVehicleMechanicalState, 
  upsertVehicleLegalDoc, 
  updateBookingHistoricalDetails 
} from '@/app/actions'

// Components
import MatriculeSearchBar from './components/MatriculeSearchBar'
import VehicleIdentityCard from './components/VehicleIdentityCard'
import LegalComplianceGrid from './components/LegalComplianceGrid'
import MechanicalStatePanel from './components/MechanicalStatePanel'
import BookingHistoryTab from './components/BookingHistoryTab'
import MaintenanceLogsTab from './components/MaintenanceLogsTab'

interface Vehicle {
  id: string
  brand: string
  model: string
  year?: number
  license_plate?: string
  color?: string
  availability?: boolean
  images?: string[]
  price_per_day: number
  current_km?: number | null
  oil_change_due_km?: number | null
  brake_pad_state?: 'good' | 'worn' | 'critical' | null
}

interface LegalDoc {
  id: string
  doc_type: 'assurance' | 'visite_technique' | 'laissez_passer'
  expiry_date: string
  notes?: string
}

interface Booking {
  id: string
  client_name: string
  client_phone?: string
  client_cin_passport?: string
  start_date: string
  end_date: string
  pickup_time?: string
  return_time?: string
  total_amount: number
  amount_paid?: number
  accident_reported?: boolean
  owner_remarks?: string
  status: string
}

interface Maintenance {
  id: string
  description?: string
  cost: number
  service_date: string
  mechanic_name?: string
  mechanic_notes?: string
  km_at_service?: number
  service_type?: string
}

interface VehicleHistoryClientProps {
  currentVehicle: Vehicle
  vehiclesList: any[]
  legalDocs: LegalDoc[]
  bookings: Booking[]
  maintenance: Maintenance[]
}

export default function VehicleHistoryClient({
  currentVehicle,
  vehiclesList,
  legalDocs,
  bookings,
  maintenance
}: VehicleHistoryClientProps) {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'bookings' | 'maintenance'>('bookings')
  const [isPending, startTransition] = useTransition()

  // 1. Legal Document Modal State
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false)
  const [activeDocType, setActiveDocType] = useState<'assurance' | 'visite_technique' | 'laissez_passer' | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [docNotes, setDocNotes] = useState('')

  // 2. Mechanical State Modal State
  const [isMechModalOpen, setIsMechModalOpen] = useState(false)
  const [currentKm, setCurrentKm] = useState<string>(currentVehicle.current_km?.toString() || '')
  const [oilDueKm, setOilDueKm] = useState<string>(currentVehicle.oil_change_due_km?.toString() || '')
  const [lastOilChangeKm, setLastOilChangeKm] = useState<string>(currentVehicle.oil_change_due_km ? (currentVehicle.oil_change_due_km - 10000).toString() : '')
  const [brakesState, setBrakesState] = useState<'good' | 'worn' | 'critical'>(currentVehicle.brake_pad_state || 'good')

  const handleLastOilChangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLastOilChangeKm(val)
    if (val) {
      const num = parseInt(val)
      if (!isNaN(num)) {
        setOilDueKm((num + 10000).toString())
      }
    } else {
      setOilDueKm('')
    }
  }

  // 3. Booking Details Edit Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [paidAmt, setPaidAmt] = useState<string>('')
  const [accidentRep, setAccidentRep] = useState(false)
  const [ownerRem, setOwnerRem] = useState('')

  // Open Legal Doc Modal
  const handleOpenLegalModal = (docType: 'assurance' | 'visite_technique' | 'laissez_passer') => {
    const existing = legalDocs.find((d) => d.doc_type === docType)
    setActiveDocType(docType)
    setExpiryDate(existing?.expiry_date || '')
    setDocNotes(existing?.notes || '')
    setIsLegalModalOpen(true)
  }

  // Submit Legal Doc
  const handleSaveLegalDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeDocType || !expiryDate) return

    startTransition(async () => {
      try {
        await upsertVehicleLegalDoc(currentVehicle.id, activeDocType, expiryDate, docNotes || null)
        showToast('Legal compliance tracker updated successfully!', 'success')
        setIsLegalModalOpen(false)
      } catch (err: any) {
        showToast(err.message || 'Failed to update compliance details.', 'error')
      }
    })
  }

  // Open Mechanical Health Modal
  const handleOpenMechModal = () => {
    setCurrentKm(currentVehicle.current_km?.toString() || '')
    setOilDueKm(currentVehicle.oil_change_due_km?.toString() || '')
    setLastOilChangeKm(currentVehicle.oil_change_due_km ? (currentVehicle.oil_change_due_km - 10000).toString() : '')
    setBrakesState(currentVehicle.brake_pad_state || 'good')
    setIsMechModalOpen(true)
  }

  // Save Mechanical Health
  const handleSaveMechanical = async (e: React.FormEvent) => {
    e.preventDefault()

    const parsedKm = currentKm ? parseInt(currentKm) : null
    const parsedOil = oilDueKm ? parseInt(oilDueKm) : null

    startTransition(async () => {
      try {
        await updateVehicleMechanicalState(currentVehicle.id, parsedKm, parsedOil, brakesState)
        showToast('Mechanical state updated successfully!', 'success')
        setIsMechModalOpen(false)
      } catch (err: any) {
        showToast(err.message || 'Failed to update mechanical details.', 'error')
      }
    })
  }

  // Open Booking Edit Modal
  const handleOpenBookingModal = (booking: Booking) => {
    setSelectedBooking(booking)
    setPaidAmt(booking.amount_paid?.toString() || '')
    setAccidentRep(booking.accident_reported || false)
    setOwnerRem(booking.owner_remarks || '')
    setIsBookingModalOpen(true)
  }

  // Save Booking Details
  const handleSaveBookingDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBooking) return

    const parsedPaid = paidAmt ? parseFloat(paidAmt) : 0

    startTransition(async () => {
      try {
        await updateBookingHistoricalDetails(
          selectedBooking.id,
          currentVehicle.id,
          {
            amount_paid: parsedPaid,
            accident_reported: accidentRep,
            owner_remarks: ownerRem || null,
          }
        )
        showToast('Booking operational log updated successfully!', 'success')
        setIsBookingModalOpen(false)
      } catch (err: any) {
        showToast(err.message || 'Failed to save booking details.', 'error')
      }
    })
  }

  // Calculations for Hero Identity Card
  const totalRevenue = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0)

  const completedRentals = bookings.length

  const getDocTypeLabel = (type: typeof activeDocType) => {
    if (type === 'assurance') return 'Insurance (Assurance)'
    if (type === 'visite_technique') return 'Technical Inspection'
    if (type === 'laissez_passer') return 'Transport Authorization'
    return ''
  }

  return (
    <div className={styles['hub-page']}>
      {/* Back button */}
      <div>
        <Link href="/dashboard/fleet" className={styles['back-nav']}>
          <ArrowLeft size={16} />
          Back to Fleet
        </Link>
      </div>

      {/* Header section */}
      <div>
        <h1 className={styles['page-title']}>Vehicle 360° History Hub</h1>
        <p className={styles['page-subtitle']}>
          Operational, administrative compliance, mechanical, and financial dossier.
        </p>
      </div>

      {/* Matricule command search bar */}
      <MatriculeSearchBar 
        vehiclesList={vehiclesList} 
        currentLicensePlate={currentVehicle.license_plate || ''} 
      />

      {/* Vehicle identity hero card */}
      <VehicleIdentityCard 
        vehicle={currentVehicle}
        totalRentals={completedRentals}
        totalRevenue={totalRevenue}
      />

      {/* 3 glassmorphic legal status cards */}
      <LegalComplianceGrid 
        legalDocs={legalDocs}
        vehicleId={currentVehicle.id}
        onEditDoc={handleOpenLegalModal}
      />

      {/* Mechanical state panel */}
      <MechanicalStatePanel 
        currentKm={currentVehicle.current_km ?? null}
        oilChangeDueKm={currentVehicle.oil_change_due_km ?? null}
        brakePadState={currentVehicle.brake_pad_state ?? null}
        onEditMechanical={handleOpenMechModal}
      />

      {/* Tab select bar */}
      <div className={styles['tab-bar']}>
        <button
          className={`${styles['tab-btn']} ${activeTab === 'bookings' ? styles['active'] : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          <Calendar size={16} />
          <span>Booking History</span>
          <span className={styles['tab-count']}>{bookings.length}</span>
        </button>

        <button
          className={`${styles['tab-btn']} ${activeTab === 'maintenance' ? styles['active'] : ''}`}
          onClick={() => setActiveTab('maintenance')}
        >
          <Wrench size={16} />
          <span>Maintenance Logs</span>
          <span className={styles['tab-count']}>{maintenance.length}</span>
        </button>
      </div>

      {/* Dynamic Tab Render */}
      {activeTab === 'bookings' ? (
        <BookingHistoryTab 
          bookings={bookings} 
          onEditBooking={handleOpenBookingModal} 
        />
      ) : (
        <MaintenanceLogsTab 
          maintenance={maintenance} 
        />
      )}

      {/* ── MODAL 1: LEGAL DOCUMENT EDIT ── */}
      {isLegalModalOpen && activeDocType && (
        <div className={styles['legal-modal-overlay']} onClick={() => setIsLegalModalOpen(false)}>
          <div className={`${styles['legal-modal']} glass-panel`} onClick={(e) => e.stopPropagation()}>
            <div className={styles['legal-modal-header']}>
              <h3 className={styles['legal-modal-title']}>
                Update {getDocTypeLabel(activeDocType)}
              </h3>
              <button className="icon-btn" onClick={() => setIsLegalModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLegalDoc} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="expiry_date">Expiry Date</label>
                <input
                  type="date"
                  id="expiry_date"
                  className="form-input"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="notes">Remarks / Policy number</label>
                <textarea
                  id="notes"
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Policy #99283-A, Comar Assurances"
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsLegalModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={isPending}
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: MECHANICAL HEALTH EDIT ── */}
      {isMechModalOpen && (
        <div className={styles['legal-modal-overlay']} onClick={() => setIsMechModalOpen(false)}>
          <div className={`${styles['legal-modal']} glass-panel`} onClick={(e) => e.stopPropagation()}>
            <div className={styles['legal-modal-header']}>
              <h3 className={styles['legal-modal-title']}>Update Odometer & Health</h3>
              <button className="icon-btn" onClick={() => setIsMechModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMechanical} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="current_km">Current Odometer (KM)</label>
                <input
                  type="number"
                  id="current_km"
                  className="form-input"
                  placeholder="e.g. 48200"
                  value={currentKm}
                  onChange={(e) => setCurrentKm(e.target.value)}
                />
              </div>

               <div className="form-group">
                <label className="form-label" htmlFor="last_oil_change_km">Last Oil Change (KM)</label>
                <input
                  type="number"
                  id="last_oil_change_km"
                  className="form-input"
                  placeholder="e.g. 9800"
                  value={lastOilChangeKm}
                  onChange={handleLastOilChangeChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="oil_due_km">Oil Change Target (KM)</label>
                <input
                  type="number"
                  id="oil_due_km"
                  className="form-input"
                  placeholder="e.g. 19800"
                  value={oilDueKm}
                  onChange={(e) => setOilDueKm(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="brake_pad_state">Brake Pads State</label>
                <select
                  id="brake_pad_state"
                  className="form-input"
                  value={brakesState}
                  onChange={(e) => setBrakesState(e.target.value as any)}
                >
                  <option value="good">🟢 Good condition</option>
                  <option value="worn">🟡 Worn - Inspect soon</option>
                  <option value="critical">🔴 CRITICAL - Replace now</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsMechModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={isPending}
                >
                  {isPending ? 'Updating...' : 'Save Health'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: BOOKING HISTORICAL DETAILS EDIT ── */}
      {isBookingModalOpen && selectedBooking && (
        <div className={styles['legal-modal-overlay']} onClick={() => setIsBookingModalOpen(false)}>
          <div className={`${styles['legal-modal']} glass-panel`} onClick={(e) => e.stopPropagation()}>
            <div className={styles['legal-modal-header']}>
              <h3 className={styles['legal-modal-title']}>Edit Rental Record Details</h3>
              <button className="icon-btn" onClick={() => setIsBookingModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBookingDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'rgba(229, 193, 125, 0.6)' }}>
                Client: <strong>{selectedBooking.client_name}</strong><br />
                Total Rental Cost: <strong>{Number(selectedBooking.total_amount).toFixed(2)} DT</strong>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="paid_amount">Amount Paid (DT)</label>
                <input
                  type="number"
                  step="0.01"
                  id="paid_amount"
                  className="form-input"
                  placeholder="e.g. 800"
                  value={paidAmt}
                  onChange={(e) => setPaidAmt(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="accident_reported"
                  checked={accidentRep}
                  onChange={(e) => setAccidentRep(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="accident_reported" style={{ fontSize: '0.9rem', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldAlert size={16} style={{ color: '#ef4444' }} />
                  Accident / Damage reported on this booking
                </label>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="owner_remarks">Behavioral Remarks & Notes</label>
                <textarea
                  id="owner_remarks"
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Aggressive driving style, returned late, clean inside..."
                  value={ownerRem}
                  onChange={(e) => setOwnerRem(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsBookingModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={isPending}
                >
                  {isPending ? 'Saving...' : 'Save Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
