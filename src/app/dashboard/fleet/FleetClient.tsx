'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useRouter } from 'next/navigation'
import { Car, Plus, Edit2, X, Upload, Trash, ChevronLeft, ChevronRight, History, Archive, RotateCcw, Check } from 'lucide-react'
import { addVehicle, updateVehicle, withdrawVehicle, restoreVehicle, executeMechanicalService, updateVehicleMechanicalState, renewVehicleDocument, addExpense, updateManualMechanicalTarget, archiveVehicle, unarchiveVehicle, renewBulkInsurance } from '@/app/actions'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { Badge } from '@/components/Badge'
import { createClient } from '@/utils/supabase/client'
import { useLanguage } from '@/lib/i18n'

export default function FleetClient({ initialVehicles, bookings = [], expenses = [] }: { initialVehicles: any[], bookings?: any[], expenses?: any[] }) {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const router = useRouter()
  const { t, lang } = useLanguage()

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Centralized operations states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'rented' | 'vidange' | 'expiring' | 'withdrawn' | 'archived'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, searchQuery])

  // Soft-withdrawal modal state
  const [withdrawModalVehicle, setWithdrawModalVehicle] = useState<any | null>(null)
  const [withdrawDate, setWithdrawDate] = useState('')
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  // Restore modal state
  const [restoreModalVehicle, setRestoreModalVehicle] = useState<any | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [renewDurations, setRenewDurations] = useState<Record<string, '6_months' | '1_year'>>({})
  const [renewingDocs, setRenewingDocs] = useState<Record<string, boolean>>({})
  const [odometers, setOdometers] = useState<Record<string, string>>({})
  const [confirmingRenew, setConfirmingRenew] = useState<Record<string, boolean>>({})
  const [renewCosts, setRenewCosts] = useState<Record<string, string>>({})
  const [settlingMech, setSettlingMech] = useState<Record<string, boolean>>({})
  const [mechCosts, setMechCosts] = useState<Record<string, string>>({})
  const [mechIntervals, setMechIntervals] = useState<Record<string, string>>({})
  
  // Manual Mechanical Target States
  const [editingManualMech, setEditingManualMech] = useState<Record<string, boolean>>({})
  const [manualMechTargets, setManualMechTargets] = useState<Record<string, string>>({})
  const [editingManualDate, setEditingManualDate] = useState<Record<string, boolean>>({})
  const [manualDates, setManualDates] = useState<Record<string, string>>({})
  const renewTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(renewTimers.current).forEach(clearTimeout)
    }
  }, [])

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

  // Bulk Insurance Modal States
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkExpiryDate, setBulkExpiryDate] = useState('')
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set())
  const [bulkExpenseAmount, setBulkExpenseAmount] = useState('')
  const [bulkSearchQuery, setBulkSearchQuery] = useState('')
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false)

  const handleOpenBulkModal = () => {
    const activeVehicles = initialVehicles.filter(car => !car.withdrawn_at && !car.archived_at)
    setBulkSelectedIds(new Set(activeVehicles.map(car => car.id)))
    const nextYearDate = new Date()
    nextYearDate.setFullYear(nextYearDate.getFullYear() + 1)
    setBulkExpiryDate(nextYearDate.toISOString().split('T')[0])
    setBulkExpenseAmount('')
    setBulkSearchQuery('')
    setIsBulkModalOpen(true)
  }



  // Add modal state
  const [addFiles, setAddFiles] = useState<File[]>([])
  const addFileInputRef = useRef<HTMLInputElement>(null)
  
  // Edit modal state
  const [editExistingImages, setEditExistingImages] = useState<string[]>([])
  const [editNewFiles, setEditNewFiles] = useState<File[]>([])
  const editFileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [addOilDueKm, setAddOilDueKm] = useState<string>('')
  const [addPadsDueKm, setAddPadsDueKm] = useState<string>('')

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

  const handleLastPadsChangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val) {
      const num = parseInt(val)
      if (!isNaN(num)) {
        setAddPadsDueKm((num + 30000).toString())
      }
    } else {
      setAddPadsDueKm('')
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

  const handleBulkSubmit = async () => {
    if (bulkSelectedIds.size === 0) {
      showToast(lang === 'fr' ? 'Veuillez sélectionner au moins un véhicule.' : 'Please select at least one vehicle.', 'error')
      return
    }
    if (!bulkExpiryDate) {
      showToast(lang === 'fr' ? 'Veuillez entrer une date d\'expiration valide.' : 'Please enter a valid expiry date.', 'error')
      return
    }

    setIsBulkSubmitting(true)
    try {
      const expenseAmount = bulkExpenseAmount ? parseFloat(bulkExpenseAmount) : null
      await renewBulkInsurance(
        Array.from(bulkSelectedIds),
        bulkExpiryDate,
        expenseAmount
      )
      showToast(
        lang === 'fr' 
          ? `Assurance renouvelée pour ${bulkSelectedIds.size} véhicules avec succès !`
          : `Insurance successfully renewed for ${bulkSelectedIds.size} vehicles!`, 
        'success'
      )
      setIsBulkModalOpen(false)
    } catch (error: any) {
      showToast(
        lang === 'fr' 
          ? 'Erreur lors du renouvellement en masse : ' + error.message 
          : 'Error performing bulk renewal: ' + error.message, 
        'error'
      )
    } finally {
      setIsBulkSubmitting(false)
    }
  }

  // Soft-withdraw a vehicle
  const handleWithdrawConfirm = async () => {
    if (!withdrawModalVehicle || !withdrawDate) return
    setIsWithdrawing(true)
    try {
      await withdrawVehicle(withdrawModalVehicle.id, withdrawDate)
      showToast(lang === 'fr' ? `${withdrawModalVehicle.brand} ${withdrawModalVehicle.model} a été retiré de la flotte.` : `${withdrawModalVehicle.brand} ${withdrawModalVehicle.model} has been withdrawn from the fleet.`, 'success')
      setWithdrawModalVehicle(null)
      setWithdrawDate('')
    } catch (error: any) {
      showToast(lang === 'fr' ? 'Erreur lors du retrait du véhicule : ' + error.message : 'Error withdrawing vehicle: ' + error.message, 'error')
    }
    setIsWithdrawing(false)
  }

  // Restore a withdrawn vehicle
  const handleRestoreConfirm = async () => {
    if (!restoreModalVehicle) return
    setIsRestoring(true)
    try {
      await restoreVehicle(restoreModalVehicle.id)
      showToast(lang === 'fr' ? `${restoreModalVehicle.brand} ${restoreModalVehicle.model} a été restauré dans la flotte active.` : `${restoreModalVehicle.brand} ${restoreModalVehicle.model} has been restored to the active fleet.`, 'success')
      setRestoreModalVehicle(null)
    } catch (error: any) {
      showToast(lang === 'fr' ? 'Erreur lors de la restauration du véhicule : ' + error.message : 'Error restoring vehicle: ' + error.message, 'error')
    }
    setIsRestoring(false)
  }
  const handleArchiveClick = async (vehicleId: string, brand: string, model: string) => {
    try {
      await archiveVehicle(vehicleId)
      showToast(lang === 'fr' ? `${brand} ${model} a été archivé.` : `${brand} ${model} has been archived.`, 'success')
    } catch (error: any) {
      showToast(lang === 'fr' ? 'Erreur lors de l\'archivage du véhicule : ' + error.message : 'Error archiving vehicle: ' + error.message, 'error')
    }
  }

  const handleUnarchiveClick = async (vehicleId: string, brand: string, model: string) => {
    try {
      await unarchiveVehicle(vehicleId)
      showToast(lang === 'fr' ? `${brand} ${model} a été restauré dans la liste des retraités.` : `${brand} ${model} has been restored to retired list.`, 'success')
    } catch (error: any) {
      showToast(lang === 'fr' ? 'Erreur lors de la restauration du véhicule depuis l\'archive : ' + error.message : 'Error restoring vehicle from archive: ' + error.message, 'error')
    }
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
      setAddPadsDueKm('')
      showToast(lang === 'fr' ? 'Véhicule ajouté avec succès !' : 'Vehicle added successfully!', 'success')
    } catch (error: any) {
      showToast(lang === 'fr' ? 'Erreur lors de l\'ajout du véhicule : ' + error.message : 'Error adding vehicle: ' + error.message, 'error')
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
      showToast(lang === 'fr' ? 'Véhicule mis à jour avec succès !' : 'Vehicle updated successfully!', 'success')
    } catch (error: any) {
      showToast(lang === 'fr' ? 'Erreur lors de la mise à jour du véhicule : ' + error.message : 'Error updating vehicle: ' + error.message, 'error')
    }
    setLoading(false)
  }



  // --- INLINE RECOVERY AND SYNCS ---

  // Helper to compute legal doc count-downs
  const getCountdownLabel = (expiryDateStr: string | null) => {
    if (!expiryDateStr) return { text: 'No Date Set', variant: 'muted', daysLeft: null }
    const expiry = new Date(expiryDateStr)
    const today = new Date(todayStr)
    // Strip time from both dates for accurate day counting
    expiry.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays < 0) {
      return { text: `Expired ${Math.abs(diffDays)} Days Ago`, variant: 'danger', daysLeft: diffDays }
    } else if (diffDays === 0) {
      return { text: 'Expires Today', variant: 'warning-glow', daysLeft: diffDays }
    } else if (diffDays === 1) {
      return { text: '1 Day Left', variant: 'warning', daysLeft: diffDays }
    } else if (diffDays <= 7) {
      return { text: `${diffDays} Days Left`, variant: 'warning', daysLeft: diffDays }
    } else {
      return { text: `${diffDays} Days Left`, variant: 'success-dim', daysLeft: diffDays }
    }
  }

  // Action sync for inline odometer modification on cell blur/Enter key press
  const handleOdometerSubmit = async (carId: string) => {
    const inputVal = odometers[carId]
    if (inputVal === undefined) return // No change made
    const numVal = parseInt(inputVal)
    if (isNaN(numVal) || numVal < 0) {
      showToast(lang === 'fr' ? 'Veuillez entrer un kilométrage valide' : 'Please enter a valid odometer mileage', 'error')
      return
    }

    try {
      const targetCar = initialVehicles.find(c => c.id === carId)
      await updateVehicleMechanicalState(
        carId,
        numVal,
        targetCar?.oil_change_due_km || null,
        targetCar?.brake_pad_state || null
      )
      showToast(lang === 'fr' ? 'Kilométrage mis à jour avec succès !' : 'Odometer mileage updated successfully!', 'success')
      // Remove temporary edit state for this row to fetch fresh DB values
      setOdometers(prev => {
        const copy = { ...prev }
        delete copy[carId]
        return copy
      })
    } catch (error: any) {
      showToast(lang === 'fr' ? 'Erreur lors de la synchronisation de l\'état mécanique : ' + error.message : 'Error syncing mechanical state: ' + error.message, 'error')
    }
  }

  // Monogram generator for active renter privacy (GDPR compliance)
  const getInitograms = (name: string) => {
    if (!name) return ''
    return name
      .trim()
      .split(' ')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase())
      .join('.') + '.'
  }

  // Multi-row stacked mechanical updating systems
  const handleMechanicalService = async (carId: string, type: 'vidange' | 'pads', cost: number, interval: number) => {
    try {
      const targetCar = initialVehicles.find(c => c.id === carId)
      if (!targetCar) return

      const finalKm = targetCar.current_km
      // Lock in the new km threshold and log the expense securely on the server
      await executeMechanicalService(carId, type, targetCar.current_km || 0, cost, interval)

      showToast(lang === 'fr' ? `${type === 'vidange' ? 'Vidange' : 'Plaquettes de frein'} réinitialisée avec succès !` : `${type === 'vidange' ? 'Vidange' : 'Brake Pads'} cycle successfully reset!`, 'success')
    } catch (error: any) {
      showToast(lang === 'fr' ? `Erreur lors de la réinitialisation du cycle de ${type === 'vidange' ? 'vidange' : 'plaquettes de frein'} : ` + error.message : `Error resetting ${type} cycle: ` + error.message, 'error')
    }
  }

  // Statutory quick action doc renewal handler (+6M / +1Y options)
  const handleRenewSubmit = async (carId: string, docType: 'assurance' | 'visite_technique' | 'laissez_passer', currentExpiryStr: string | null, customDate?: string) => {
    const durationKey = `${carId}-${docType}`
    const duration = renewDurations[durationKey] || '1_year'
    const finalCostStr = renewCosts[durationKey]
    const finalCost = finalCostStr ? parseFloat(finalCostStr) : undefined

    let calculatedExpiryDate = customDate
    if (!calculatedExpiryDate) {
      const baseDate = (currentExpiryStr && new Date(currentExpiryStr) > new Date(todayStr))
        ? new Date(currentExpiryStr)
        : new Date(todayStr)

      const nextExpiry = new Date(baseDate)
      if (duration === '6_months') {
        nextExpiry.setMonth(nextExpiry.getMonth() + 6)
      } else {
        nextExpiry.setFullYear(nextExpiry.getFullYear() + 1)
      }
      calculatedExpiryDate = nextExpiry.toISOString().split('T')[0]
    }

    setRenewingDocs(prev => ({ ...prev, [`${carId}-${docType}`]: true }))

    try {
      await renewVehicleDocument(carId, docType, calculatedExpiryDate, finalCost)
      const docLabel = docType === 'assurance' ? 'Assurance' : docType === 'visite_technique' ? 'Visite Technique' : 'Laissez-Passer'
      showToast(lang === 'fr' ? `${docLabel} prolongé avec succès !` : `${docLabel} successfully extended!`, 'success')
      setConfirmingRenew(prev => ({ ...prev, [`${carId}-${docType}`]: false }))
      setEditingManualDate(prev => ({ ...prev, [`${carId}-${docType}`]: false }))
    } catch (error: any) {
      showToast(lang === 'fr' ? 'Erreur lors du renouvellement du document légal : ' + error.message : 'Error executing legal document renewal: ' + error.message, 'error')
    } finally {
      setRenewingDocs(prev => ({ ...prev, [`${carId}-${docType}`]: false }))
    }
  }

  const handleManualMechTargetSubmit = async (carId: string, type: 'vidange' | 'pads', manualValueStr: string) => {
    const val = parseInt(manualValueStr)
    const key = `${carId}-${type}`
    if (isNaN(val)) {
      setEditingManualMech(prev => ({ ...prev, [key]: false }))
      return
    }

    try {
      await updateManualMechanicalTarget(carId, type, val)
      showToast(lang === 'fr' ? `Cible de ${type === 'vidange' ? 'vidange' : 'plaquettes de frein'} mise à jour !` : `${type === 'vidange' ? 'Oil Change' : 'Brake Pads'} target updated!`, 'success')
      setEditingManualMech(prev => ({ ...prev, [key]: false }))
    } catch (error: any) {
      showToast(lang === 'fr' ? `Erreur lors de la mise à jour de la cible : ${error.message}` : `Error updating target: ${error.message}`, 'error')
    }
  }

  // 2-Phase Document Renewal Safeguard (Anti-Misclick Engine)
  const handleRenewClick = (carId: string, docType: 'assurance' | 'visite_technique' | 'laissez_passer', currentExpiryStr: string | null) => {
    const key = `${carId}-${docType}`
    if (confirmingRenew[key]) {
      return
    } else {
      setConfirmingRenew(prev => ({ ...prev, [key]: true }))
      if (renewTimers.current[key]) {
        clearTimeout(renewTimers.current[key])
      }
      renewTimers.current[key] = setTimeout(() => {
        setConfirmingRenew(prev => ({ ...prev, [key]: false }))
      }, 5000)
    }
  }

  const renderTunisianPlate = (plate: string | null) => {
    const match = (plate || '').trim().match(/^(\d+)\s*TU\s*(\d+)\s*([A-Za-z]?)$/i)
    if (match) {
      return (
        <div className="tn-plate">
          <div className="tn-plate-side">
            <span className="tn-plate-tn">TN</span>
          </div>
          <div className="tn-plate-body">
            <span className="tn-plate-num">{match[1]}</span>
            <span className="tn-plate-divider">تونس</span>
            <span className="tn-plate-num" style={{ whiteSpace: 'nowrap' }}>{match[2]}{match[3] ? ` ${match[3].toUpperCase()}` : ''}</span>
          </div>
        </div>
      )
    }
    return (
      <div className="tn-plate custom-plate">
        <span className="tn-plate-num">{plate || '—'}</span>
      </div>
    )
  }

  const renderLegalDocCell = (car: any, docType: 'assurance' | 'visite_technique' | 'laissez_passer') => {
    const doc = car.vehicle_legal_docs?.find((d: any) => d.doc_type === docType)
    const countdown = getCountdownLabel(doc?.expiry_date || null)
    const durationKey = `${car.id}-${docType}`
    const activeDuration = renewDurations[durationKey] || '1_year'
    const isRenewing = renewingDocs[durationKey] || false
    const isConfirming = confirmingRenew[durationKey] || false

    const docTypeLabel = docType === 'assurance' ? 'Assurance' : docType === 'visite_technique' ? 'Visite Technique' : 'Laissez-Passer'

    return (
      <div className="legal-cell-container">
        {doc?.expiry_date ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {editingManualDate[durationKey] ? (
              <input 
                type="date"
                autoFocus
                className="spreadsheet-input"
                style={{ padding: '0.1rem', fontSize: '0.75rem', width: '100px' }}
                value={manualDates[durationKey] || doc.expiry_date}
                onChange={(e) => setManualDates(prev => ({...prev, [durationKey]: e.target.value}))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenewSubmit(car.id, docType, doc.expiry_date, manualDates[durationKey] || doc.expiry_date)
                  if (e.key === 'Escape') setEditingManualDate(prev => ({...prev, [durationKey]: false}))
                }}
                onBlur={() => handleRenewSubmit(car.id, docType, doc.expiry_date, manualDates[durationKey] || doc.expiry_date)}
              />
            ) : (
              <>
                <div className="legal-date">{doc.expiry_date}</div>
                <button className="icon-btn" style={{ padding: 0 }} onClick={() => {
                  setManualDates(prev => ({...prev, [durationKey]: doc.expiry_date}))
                  setEditingManualDate(prev => ({...prev, [durationKey]: true}))
                }}>
                  <Edit2 size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {editingManualDate[durationKey] ? (
              <input 
                type="date"
                autoFocus
                className="spreadsheet-input"
                style={{ padding: '0.1rem', fontSize: '0.75rem', width: '100px' }}
                value={manualDates[durationKey] || todayStr}
                onChange={(e) => setManualDates(prev => ({...prev, [durationKey]: e.target.value}))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenewSubmit(car.id, docType, null, manualDates[durationKey] || todayStr)
                  if (e.key === 'Escape') setEditingManualDate(prev => ({...prev, [durationKey]: false}))
                }}
                onBlur={() => handleRenewSubmit(car.id, docType, null, manualDates[durationKey] || todayStr)}
              />
            ) : (
              <>
                <div className="legal-date text-muted" style={{ fontStyle: 'italic', opacity: 0.6 }}>No Date Set</div>
                <button className="icon-btn" style={{ padding: 0 }} onClick={() => {
                  setManualDates(prev => ({...prev, [durationKey]: todayStr}))
                  setEditingManualDate(prev => ({...prev, [durationKey]: true}))
                }}>
                  <Edit2 size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
              </>
            )}
          </div>
        )}
        
        <span className={`countdown-text ${countdown.variant}`}>
          {countdown.text}
        </span>

        {isConfirming ? (
          <div className="renew-action-row animate-fade-in" style={{ background: 'rgba(229, 193, 125, 0.1)', padding: '0.25rem', borderRadius: '4px', border: '1px solid rgba(229, 193, 125, 0.3)', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input 
              type="number"
              placeholder="Cost DT"
              className="spreadsheet-input"
              style={{ width: '60px', padding: '0.2rem', fontSize: '0.7rem' }}
              value={renewCosts[durationKey] || ''}
              onChange={(e) => setRenewCosts(prev => ({ ...prev, [durationKey]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenewSubmit(car.id, docType, doc?.expiry_date || null)
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => handleRenewSubmit(car.id, docType, doc?.expiry_date || null)}
              disabled={isRenewing}
              className="btn-renew-gold active-confirm"
              style={{ padding: '0.2rem 0.4rem' }}
              title="Confirm Renewal & Log Expense"
            >
              {isRenewing ? <span className="loading-spinner-xs"></span> : '✓ Yes'}
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{ color: '#E5C17D' }}
              onClick={() => setConfirmingRenew(prev => ({ ...prev, [durationKey]: false }))}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="renew-action-row animate-fade-in">
            <div className="renew-selector">
              <button 
                type="button" 
                onClick={() => setRenewDurations(prev => ({ ...prev, [durationKey]: '6_months' }))}
                className={`renew-pill ${activeDuration === '6_months' ? 'active' : ''}`}
              >
                6M
              </button>
              <button 
                type="button" 
                onClick={() => setRenewDurations(prev => ({ ...prev, [durationKey]: '1_year' }))}
                className={`renew-pill ${activeDuration === '1_year' ? 'active' : ''}`}
              >
                1Y
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => handleRenewClick(car.id, docType, doc?.expiry_date || null)}
              className="btn-renew-gold"
              title={`Renew statutory ${docTypeLabel} for ${activeDuration === '6_months' ? '6 Months' : '1 Year'}`}
            >
              ⚡ Renew
            </button>
          </div>
        )}
      </div>
    )
  }

  // Memoized advanced querying & mechanical filters
  const filteredVehicles = useMemo(() => {
    return initialVehicles.filter(car => {
      const isWithdrawn = !!car.withdrawn_at
      const isArchived = !!car.archived_at

      // 1. Status Filter isolates
      if (statusFilter === 'withdrawn') {
        if (!isWithdrawn || isArchived) return false
      } else if (statusFilter === 'archived') {
        if (!isArchived) return false
      } else {
        // Active filters: always exclude withdrawn/archived vehicles
        if (isWithdrawn || isArchived) return false

        const isRented = bookings.some(b =>
          b.vehicle_id === car.id &&
          (b.status === 'confirmed' || b.status === 'completed') &&
          b.start_date <= todayStr &&
          b.end_date >= todayStr
        )

        const isVidangeDue = car.current_km !== null && (car.next_vidange_km ? car.current_km >= car.next_vidange_km : (car.last_vidange_km !== null && car.current_km >= car.last_vidange_km + 10000))
        const isPadsDue = car.current_km !== null && (car.next_pads_km ? car.current_km >= car.next_pads_km : (car.last_pads_km !== null && car.current_km >= car.last_pads_km + 30000))

        const assuranceDoc = car.vehicle_legal_docs?.find((d: any) => d.doc_type === 'assurance')
        const VTDoc = car.vehicle_legal_docs?.find((d: any) => d.doc_type === 'visite_technique')
        const LPDoc = car.vehicle_legal_docs?.find((d: any) => d.doc_type === 'laissez_passer')

        const isDocExpiringSoon = (doc: any) => {
          if (!doc?.expiry_date) return false
          const exp = new Date(doc.expiry_date)
          const today = new Date(todayStr)
          exp.setHours(0,0,0,0)
          today.setHours(0,0,0,0)
          const diffTime = exp.getTime() - today.getTime()
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
          return diffDays <= 7
        }

        const hasExpiringDocs = isDocExpiringSoon(assuranceDoc) || isDocExpiringSoon(VTDoc) || isDocExpiringSoon(LPDoc)

        if (statusFilter === 'available' && (isRented || !car.availability)) return false
        if (statusFilter === 'rented' && !isRented) return false
        if (statusFilter === 'vidange' && !(isVidangeDue || isPadsDue)) return false
        if (statusFilter === 'expiring' && !hasExpiringDocs) return false
      }

      // 2. Query string search (plate, brand, model, active renter name)
      const q = searchQuery.toLowerCase().trim()
      if (q) {
        const activeBooking = bookings.find(b =>
          b.vehicle_id === car.id &&
          (b.status === 'confirmed' || b.status === 'completed') &&
          b.start_date <= todayStr &&
          b.end_date >= todayStr
        )
        const activeRenter = activeBooking ? (activeBooking.client_name || activeBooking.clients?.full_name || '').toLowerCase() : ''
        const brand = (car.brand || '').toLowerCase()
        const model = (car.model || '').toLowerCase()
        const plate = (car.license_plate || '').toLowerCase()

        const matchSearch = brand.includes(q) || model.includes(q) || plate.includes(q) || activeRenter.includes(q)
        if (!matchSearch) return false
      }

      return true
    })
  }, [initialVehicles, bookings, statusFilter, searchQuery, todayStr])

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE
  const currentVehicles = useMemo(() => {
    return filteredVehicles.slice(indexOfFirstItem, indexOfLastItem)
  }, [filteredVehicles, indexOfFirstItem, indexOfLastItem])
  const totalPages = Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE)

  return (
    <div className='dashboard-page'>
      <style>{`
        /* Tunisian Plate Premium Design */
        .tn-plate {
          display: inline-flex;
          align-items: center;
          background: #111115;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          overflow: hidden;
          height: 34px;
          padding: 0;
          vertical-align: middle;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .tn-plate:hover {
          border-color: rgba(229, 193, 125, 0.5);
          box-shadow: 0 4px 12px rgba(229, 193, 125, 0.2);
        }
        .tn-plate-side {
          background: linear-gradient(180deg, #E53935 0%, #B71C1C 100%);
          width: 24px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }
        .tn-plate-tn {
          color: #FFFFFF;
          font-family: 'Inter', sans-serif;
          font-weight: 900;
          font-size: 0.65rem;
          letter-spacing: 0.5px;
        }
        .tn-plate-body {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          height: 100%;
        }
        .tn-plate-num {
          color: #FFFFFF;
          font-family: 'Courier New', monospace;
          font-weight: 700;
          font-size: 0.95rem;
          letter-spacing: 0.5px;
        }
        .tn-plate-divider {
          color: #E5C17D;
          font-family: sans-serif;
          font-weight: 700;
          font-size: 0.75rem;
        }
        .custom-plate {
          padding: 0 10px;
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-plate .tn-plate-num {
          font-size: 0.85rem;
          color: #E5C17D;
        }

        /* Spreadsheet Inputs */
        .spreadsheet-input {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          color: #FFFFFF;
          font-family: monospace;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 0.3rem 0.5rem;
          width: 90px;
          text-align: right;
          transition: all 0.2s;
        }
        .spreadsheet-input:focus {
          background: rgba(255, 255, 255, 0.08);
          border-color: #E5C17D;
          outline: none;
          box-shadow: 0 0 8px rgba(229, 193, 125, 0.25);
        }

        /* Oil Change Warning Badge */
        .vidange-due-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #F87171;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          margin-top: 0.25rem;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          animation: pulse-red-glow 2s infinite;
        }

        /* Legal Cell Structure */
        .legal-cell-container {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          align-items: flex-start;
        }
        .legal-date {
          font-family: monospace;
          font-size: 0.8rem;
          color: #E2E8F0;
          font-weight: 500;
        }
        .countdown-text {
          font-size: 0.7rem;
          font-weight: 600;
          border-radius: 4px;
          padding: 0.05rem 0.3rem;
          display: inline-block;
        }
        .countdown-text.danger {
          color: #EF4444;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .countdown-text.warning-glow {
          color: #F59E0B;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          animation: pulse-orange-glow 1.5s infinite;
        }
        .countdown-text.warning {
          color: #F59E0B;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
        }
        .countdown-text.success-dim {
          color: #10B981;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .countdown-text.muted {
          color: #94A3B8;
          background: rgba(148, 163, 184, 0.1);
          border: 1px solid rgba(148, 163, 184, 0.15);
        }

        .renew-action-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          width: 100%;
        }
        .renew-selector {
          display: inline-flex;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          overflow: hidden;
          padding: 1px;
        }
        .renew-pill {
          background: transparent;
          border: none;
          color: #94A3B8;
          font-size: 0.6rem;
          font-weight: 700;
          padding: 0.15rem 0.3rem;
          cursor: pointer;
          border-radius: 3px;
          transition: all 0.2s;
        }
        .renew-pill:hover {
          color: #FFFFFF;
          background: rgba(255, 255, 255, 0.05);
        }
        .renew-pill.active {
          background: rgba(229, 193, 125, 0.15);
          color: #E5C17D;
        }
        .btn-renew-gold {
          background: linear-gradient(135deg, #E5C17D 0%, #C9A45C 100%);
          border: none;
          border-radius: 4px;
          color: #1E1B18;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.25rem 0.5rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          box-shadow: 0 2px 4px rgba(229, 193, 125, 0.15);
          transition: all 0.2s;
        }
        .btn-renew-gold:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(229, 193, 125, 0.3);
        }
        .btn-renew-gold.active-confirm {
          background: linear-gradient(135deg, #EF4444 0%, #B71C1C 100%) !important;
          color: #FFFFFF !important;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
          animation: pulse-red-glow 1.5s infinite;
        }
        .btn-renew-gold:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Stacked Mechanical Selection Styles */
        .mechanical-select {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #FFF;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.2rem 0.4rem;
          cursor: pointer;
          outline: none;
          transition: all 0.2s;
        }
        .mechanical-select:focus {
          border-color: #E5C17D;
          box-shadow: 0 0 6px rgba(229, 193, 125, 0.25);
        }
        .mechanical-select.good-select {
          color: #10B981;
          border-color: rgba(16, 185, 129, 0.2);
        }
        .mechanical-select.worn-select {
          color: #F59E0B;
          border-color: rgba(245, 158, 11, 0.2);
        }
        .mechanical-select.critical-select {
          color: #EF4444;
          border-color: rgba(239, 68, 68, 0.3);
          animation: pulse-border-red 2s infinite;
        }
        
        .brake-warning-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #F87171;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          margin-top: 0.2rem;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          animation: pulse-red-glow 2s infinite;
        }

        /* Status Capsules Bar */
        .capsules-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .capsule-btn {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 9999px;
          padding: 0.4rem 1rem;
          color: #94A3B8;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .capsule-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
          color: #FFF;
        }
        .capsule-btn.active {
          background: rgba(229, 193, 125, 0.1);
          border-color: #E5C17D;
          color: #E5C17D;
          box-shadow: 0 0 10px rgba(229, 193, 125, 0.15);
        }
        .capsule-btn.active.vidange {
          background: rgba(239, 68, 68, 0.1);
          border-color: #EF4444;
          color: #EF4444;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.2);
          animation: pulse-border-red 2s infinite;
        }
        .capsule-btn.active.expiring {
          background: rgba(245, 158, 11, 0.1);
          border-color: #F59E0B;
          color: #F59E0B;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.2);
        }

        /* Animations */
        @keyframes pulse-red-glow {
          0% { box-shadow: 0 0 4px rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.4); border-color: rgba(239, 68, 68, 0.7); }
          100% { box-shadow: 0 0 4px rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.4); }
        }
        @keyframes pulse-orange-glow {
          0% { box-shadow: 0 0 4px rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3); }
          50% { box-shadow: 0 0 8px rgba(245, 158, 11, 0.35); border-color: rgba(245, 158, 11, 0.6); }
          100% { box-shadow: 0 0 4px rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3); }
        }
        @keyframes pulse-border-red {
          0% { border-color: rgba(239, 68, 68, 0.4); }
          50% { border-color: rgba(239, 68, 68, 0.8); }
          100% { border-color: rgba(239, 68, 68, 0.4); }
        }
        
        .loading-spinner-xs {
          border: 2px solid rgba(0,0,0,0.15);
          border-left-color: #000;
          border-radius: 50%;
          width: 10px;
          height: 10px;
          animation: spin 0.8s linear infinite;
        }

        .fleet-table {
          table-layout: fixed;
          width: 100%;
        }

        @media (max-width: 1024px) {
          .fleet-table, 
          .fleet-table thead, 
          .fleet-table tbody, 
          .fleet-table th, 
          .fleet-table td, 
          .fleet-table tr { 
            display: block !important; 
            width: 100% !important;
            table-layout: auto !important;
          }
          
          .fleet-table thead {
            display: none !important;
          }
          
          .fleet-table tr {
            margin-bottom: 1.5rem;
            background: rgba(20, 16, 14, 0.6);
            border: 1px solid rgba(229, 193, 125, 0.15) !important;
            border-radius: 12px;
            padding: 1.25rem;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
            transition: all 0.25s ease;
          }

          .fleet-table tr:hover {
            border-color: rgba(229, 193, 125, 0.3) !important;
            background: rgba(25, 20, 18, 0.8) !important;
          }
          
          .fleet-table td { 
            border: none !important;
            border-bottom: 1px solid rgba(229, 193, 125, 0.05) !important; 
            position: relative;
            padding: 0.85rem 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.35rem !important;
          }
          
          .fleet-table td:last-child {
            border-bottom: none !important;
            padding-bottom: 0 !important;
          }

          .fleet-table td::before { 
            content: attr(data-label);
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: rgba(229, 193, 125, 0.55);
            font-weight: 700;
            margin-bottom: 0.35rem;
            display: block;
          }
          
          .fleet-table td .tn-plate {
            margin-bottom: 0.25rem;
          }

          .fleet-table .action-buttons {
            width: 100%;
            justify-content: flex-start;
            gap: 0.75rem;
            margin-top: 0.5rem;
          }
        }
      `}</style>

      <div className='header-section'>
        <div className="header-title-row" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 className='page-title'>My Fleet</h1>
            <p className='subtitle'>High-density Operations & Compliance Spreadsheet.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }} className="no-print">
            <button className="btn-secondary" onClick={handleOpenBulkModal} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(229,193,125,0.3)', color: 'var(--accent-gold)', background: 'rgba(229, 193, 125, 0.05)', fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '8px' }}>
              <History size={16} />
              <span>{lang === 'fr' ? "Renouvellement d'assurance en bloc" : "Bulk Insurance Renewal"}</span>
            </button>
            <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} />
              <span>Add Vehicle</span>
            </button>
          </div>
        </div>

        {/* Master Apex Operations Command Bar */}
        <div className="operations-command-bar glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
          <div style={{ flex: '1', minWidth: '280px', position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search by plate, brand, model, active renter name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 1rem 0.6rem 2.5rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: '#FFF',
                fontSize: '0.85rem'
              }}
            />
            <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          {/* Status Capsules */}
          <div className="capsules-bar">
            <button 
              type="button" 
              className={`capsule-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              {t('fleet.allFleet')}
            </button>
            <button 
              type="button" 
              className={`capsule-btn ${statusFilter === 'available' ? 'active' : ''}`}
              onClick={() => setStatusFilter('available')}
            >
              🟢 {t('fleet.available')}
            </button>
            <button 
              type="button" 
              className={`capsule-btn ${statusFilter === 'rented' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rented')}
            >
              🔴 {t('fleet.rented')}
            </button>

            <button 
              type="button" 
              className={`capsule-btn ${statusFilter === 'expiring' ? 'active' : ''} expiring`}
              onClick={() => setStatusFilter('expiring')}
            >
              ⚠️ {t('fleet.expiringDocs')}
            </button>
            <button
              type="button"
              className={`capsule-btn ${statusFilter === 'withdrawn' ? 'active' : ''}`}
              onClick={() => setStatusFilter('withdrawn')}
              style={statusFilter === 'withdrawn' ? { borderColor: 'rgba(148,163,184,0.6)', color: '#94A3B8', background: 'rgba(148,163,184,0.08)' } : {}}
            >
              🗃️ {t('fleet.retired')}
            </button>
            <button
              type="button"
              className={`capsule-btn ${statusFilter === 'archived' ? 'active' : ''}`}
              onClick={() => setStatusFilter('archived')}
              style={statusFilter === 'archived' ? { borderColor: 'rgba(148,163,184,0.6)', color: '#94A3B8', background: 'rgba(148,163,184,0.08)' } : {}}
            >
              📦 {t('fleet.archived')}
            </button>
          </div>
        </div>
      </div>

      <div className='content-grid'>
        <div className='glass-panel table-container'>
          <table className="data-table fleet-table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>{t('fleet.details')}</th>
                <th style={{ width: '13%' }}>{t('fleet.odometer')}</th>
                <th style={{ width: '14%' }}>{t('fleet.assurance')}</th>
                <th style={{ width: '14%' }}>{t('fleet.visite')}</th>
                <th style={{ width: '15%' }}>{t('fleet.transport')}</th>
                <th style={{ width: '12%' }}>{t('fleet.availability')}</th>
                <th style={{ width: '12%', textAlign: 'right' }}>{t('fleet.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles && currentVehicles.length > 0 ? (
                currentVehicles.map((car) => {
                  const carBookings = bookings.filter((b: any) => b.vehicle_id === car.id && b.status !== 'cancelled')
                  const revenue = carBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0)
                  
                  const carExpenses = expenses.filter((e: any) => e.vehicle_id === car.id)
                  const totalExpenses = carExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
                  
                  const netYield = revenue - totalExpenses
                  const netYieldColor = netYield < 0 ? '#ef4444' : '#E5C17D'
                  const netYieldTextShadow = netYield < 0 ? '0 0 10px rgba(239,68,68,0.5)' : '0 0 8px rgba(229,193,125,0.15)'
                  const netYieldPrefix = netYield >= 0 ? '+' : ''

                  // Calculate on-the-fly rented status using Tunisia sysdate timezone anchor
                  const isRented = bookings.some(b => 
                    b.vehicle_id === car.id && 
                    (b.status === 'confirmed' || b.status === 'completed') && 
                    b.start_date <= todayStr && 
                    b.end_date >= todayStr
                  )

                  const activeBooking = bookings.find(b => 
                    b.vehicle_id === car.id && 
                    (b.status === 'confirmed' || b.status === 'completed') && 
                    b.start_date <= todayStr && 
                    b.end_date >= todayStr
                  )

                  const isVidangeDue = car.current_km !== null && (car.next_vidange_km ? car.current_km >= car.next_vidange_km : (car.last_vidange_km !== null && car.current_km >= car.last_vidange_km + 10000))
                  const isPadsDue = car.current_km !== null && (car.next_pads_km ? car.current_km >= car.next_pads_km : (car.last_pads_km !== null && car.current_km >= car.last_pads_km + 30000))

                  return (
                    <tr key={car.id}>
                      {/* COLUMN 1: Vehicle Details */}
                      <td data-label="Vehicle Details">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {car.images && car.images.length > 0 ? (
                            <img 
                              src={car.images[0]} 
                              alt={`${car.brand} ${car.model}`}
                              className="vehicle-img-thumbnail" 
                              style={{ cursor: 'pointer', width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}
                              title="Click to view images"
                              onClick={() => {
                                setLightboxImages(car.images)
                                setLightboxIndex(0)
                              }}
                            />
                          ) : (
                            <div className="avatar-sm" style={{ width: '48px', height: '48px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Car size={18} />
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {renderTunisianPlate(car.license_plate)}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span className="fw-500" style={{ fontSize: '0.85rem' }}>{car.brand} {car.model}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({car.year})</span>
                            </div>
                            {car.color && (
                              <div style={{ fontSize: '0.75rem', color: car.color, opacity: 0.8 }}>
                                {car.color}
                              </div>
                            )}
                            {car.withdrawn_at && (
                              <div style={{ 
                                fontSize: '0.72rem', 
                                color: car.archived_at ? '#ae9260' : '#f87171', 
                                background: car.archived_at ? 'rgba(174, 146, 96, 0.08)' : 'rgba(239, 68, 68, 0.08)', 
                                border: car.archived_at ? '1px solid rgba(174, 146, 96, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)', 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                width: 'fit-content', 
                                marginTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontWeight: 500,
                                textShadow: car.archived_at ? '0 0 6px rgba(174, 146, 96, 0.25)' : '0 0 6px rgba(239, 68, 68, 0.25)'
                              }}>
                                {car.archived_at ? (
                                  <span>📦 Archived: {car.archived_at}</span>
                                ) : (
                                  <span>🗃️ Retired: {car.withdrawn_at}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* COLUMN 2: Odometer & Mechanical Stack */}
                      <td data-label="Odometer & Mechanical">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                          {/* Line 1: Odometer Input */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <input
                              type="number"
                              value={odometers[car.id] !== undefined ? odometers[car.id] : car.current_km || ''}
                              onChange={(e) => setOdometers(prev => ({ ...prev, [car.id]: e.target.value }))}
                              onBlur={() => handleOdometerSubmit(car.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleOdometerSubmit(car.id)
                                }
                              }}
                              className="spreadsheet-input"
                              placeholder="Odo"
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>km</span>
                          </div>
                          
                          {/* Line 2: Vidange Alert */}
                          {isVidangeDue ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(239,68,68,0.05)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="vidange-due-badge" style={{ border: 'none', background: 'transparent', padding: 0, textShadow: '0 0 8px rgba(239,68,68,0.6)' }}>
                                  🚨 VIDANGE DUE
                                </div>
                                <button 
                                  className="btn-secondary" 
                                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', border: '1px solid rgba(229,193,125,0.3)' }}
                                  onClick={() => setSettlingMech(prev => ({ ...prev, [`${car.id}-vidange`]: !prev[`${car.id}-vidange`] }))}
                                >
                                  {settlingMech[`${car.id}-vidange`] ? 'Cancel' : '🛠️ Settle'}
                                </button>
                              </div>
                              {settlingMech[`${car.id}-vidange`] && (
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', animation: 'fadeIn 0.2s ease-out' }}>
                                  <input
                                    type="number"
                                    placeholder="Cost DT"
                                    className="spreadsheet-input"
                                    style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #E5C17D' }}
                                    value={mechCosts[`${car.id}-vidange`] || ''}
                                    onChange={(e) => setMechCosts(prev => ({ ...prev, [`${car.id}-vidange`]: e.target.value }))}
                                  />
                                  <select 
                                    className="spreadsheet-input"
                                    style={{ width: '75px', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                    value={mechIntervals[`${car.id}-vidange`] || '10000'}
                                    onChange={(e) => setMechIntervals(prev => ({ ...prev, [`${car.id}-vidange`]: e.target.value }))}
                                  >
                                    <option value="10000">+10,000</option>
                                    <option value="15000">+15,000</option>
                                  </select>
                                  <button 
                                    className="btn-renew-gold" 
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => {
                                      const cost = parseFloat(mechCosts[`${car.id}-vidange`] || '')
                                      const interval = parseInt(mechIntervals[`${car.id}-vidange`] || '10000')
                                      if (!isNaN(cost)) {
                                        handleMechanicalService(car.id, 'vidange', cost, interval)
                                        setSettlingMech(prev => ({ ...prev, [`${car.id}-vidange`]: false }))
                                      }
                                    }}
                                  >
                                    ✓
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(229,193,125,0.1)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                                  {editingManualMech[`${car.id}-vidange`] ? (
                                    <input 
                                      type="number"
                                      autoFocus
                                      className="spreadsheet-input"
                                      style={{ padding: '0.1rem', fontSize: '0.75rem', width: '80px', color: '#E5C17D' }}
                                      value={manualMechTargets[`${car.id}-vidange`] || (car.next_vidange_km ? car.next_vidange_km : (car.last_vidange_km ?? car.current_km ?? 0) + 10000)}
                                      onChange={(e) => setManualMechTargets(prev => ({...prev, [`${car.id}-vidange`]: e.target.value}))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleManualMechTargetSubmit(car.id, 'vidange', manualMechTargets[`${car.id}-vidange`] || String(car.next_vidange_km ? car.next_vidange_km : (car.last_vidange_km ?? car.current_km ?? 0) + 10000))
                                        if (e.key === 'Escape') setEditingManualMech(prev => ({...prev, [`${car.id}-vidange`]: false}))
                                      }}
                                      onBlur={() => handleManualMechTargetSubmit(car.id, 'vidange', manualMechTargets[`${car.id}-vidange`] || String(car.next_vidange_km ? car.next_vidange_km : (car.last_vidange_km ?? car.current_km ?? 0) + 10000))}
                                    />
                                  ) : (
                                    <>
                                      <span>Next Oil: <span style={{ color: '#E5C17D' }}>{car.next_vidange_km ? car.next_vidange_km : (car.last_vidange_km ?? car.current_km ?? 0) + 10000}</span> km</span>
                                      <button className="icon-btn" style={{ padding: 0 }} onClick={() => {
                                        setManualMechTargets(prev => ({...prev, [`${car.id}-vidange`]: String(car.next_vidange_km ? car.next_vidange_km : (car.last_vidange_km ?? car.current_km ?? 0) + 10000)}))
                                        setEditingManualMech(prev => ({...prev, [`${car.id}-vidange`]: true}))
                                      }}>
                                        <Edit2 size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                                      </button>
                                    </>
                                  )}
                                </div>
                                <button 
                                  className="btn-secondary" 
                                  style={{ padding: '0.15rem 0.3rem', fontSize: '0.65rem', border: '1px solid rgba(229,193,125,0.3)' }}
                                  title="Settle Early"
                                  onClick={() => setSettlingMech(prev => ({ ...prev, [`${car.id}-vidange`]: !prev[`${car.id}-vidange`] }))}
                                >
                                  {settlingMech[`${car.id}-vidange`] ? 'Cancel' : '🛠️ Settle'}
                                </button>
                              </div>
                              {settlingMech[`${car.id}-vidange`] && (
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', animation: 'fadeIn 0.2s ease-out' }}>
                                  <input
                                    type="number"
                                    placeholder="Cost DT"
                                    className="spreadsheet-input"
                                    style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #E5C17D' }}
                                    value={mechCosts[`${car.id}-vidange`] || ''}
                                    onChange={(e) => setMechCosts(prev => ({ ...prev, [`${car.id}-vidange`]: e.target.value }))}
                                  />
                                  <select 
                                    className="spreadsheet-input"
                                    style={{ width: '75px', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                    value={mechIntervals[`${car.id}-vidange`] || '10000'}
                                    onChange={(e) => setMechIntervals(prev => ({ ...prev, [`${car.id}-vidange`]: e.target.value }))}
                                  >
                                    <option value="10000">+10,000</option>
                                    <option value="15000">+15,000</option>
                                  </select>
                                  <button 
                                    className="btn-renew-gold" 
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => {
                                      const cost = parseFloat(mechCosts[`${car.id}-vidange`] || '')
                                      const interval = parseInt(mechIntervals[`${car.id}-vidange`] || '10000')
                                      if (!isNaN(cost)) {
                                        handleMechanicalService(car.id, 'vidange', cost, interval)
                                        setSettlingMech(prev => ({ ...prev, [`${car.id}-vidange`]: false }))
                                      }
                                    }}
                                  >
                                    ✓
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Line 3: Brake Pads Alert */}
                          {isPadsDue ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(239,68,68,0.05)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', marginTop: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="brake-warning-badge" style={{ border: 'none', background: 'transparent', padding: 0, textShadow: '0 0 8px rgba(239,68,68,0.6)' }}>
                                  🚨 PADS DUE
                                </div>
                                <button 
                                  className="btn-secondary" 
                                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', border: '1px solid rgba(229,193,125,0.3)' }}
                                  onClick={() => setSettlingMech(prev => ({ ...prev, [`${car.id}-pads`]: !prev[`${car.id}-pads`] }))}
                                >
                                  {settlingMech[`${car.id}-pads`] ? 'Cancel' : '🛠️ Settle'}
                                </button>
                              </div>
                              {settlingMech[`${car.id}-pads`] && (
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', animation: 'fadeIn 0.2s ease-out' }}>
                                  <input
                                    type="number"
                                    placeholder="Cost DT"
                                    className="spreadsheet-input"
                                    style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #E5C17D' }}
                                    value={mechCosts[`${car.id}-pads`] || ''}
                                    onChange={(e) => setMechCosts(prev => ({ ...prev, [`${car.id}-pads`]: e.target.value }))}
                                  />
                                  <select 
                                    className="spreadsheet-input"
                                    style={{ width: '75px', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                    value={mechIntervals[`${car.id}-pads`] || '30000'}
                                    onChange={(e) => setMechIntervals(prev => ({ ...prev, [`${car.id}-pads`]: e.target.value }))}
                                  >
                                    <option value="30000">+30,000</option>
                                    <option value="40000">+40,000</option>
                                  </select>
                                  <button 
                                    className="btn-renew-gold" 
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => {
                                      const cost = parseFloat(mechCosts[`${car.id}-pads`] || '')
                                      const interval = parseInt(mechIntervals[`${car.id}-pads`] || '30000')
                                      if (!isNaN(cost)) {
                                        handleMechanicalService(car.id, 'pads', cost, interval)
                                        setSettlingMech(prev => ({ ...prev, [`${car.id}-pads`]: false }))
                                      }
                                    }}
                                  >
                                    ✓
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(229,193,125,0.1)', marginTop: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                                  {editingManualMech[`${car.id}-pads`] ? (
                                    <input 
                                      type="number"
                                      autoFocus
                                      className="spreadsheet-input"
                                      style={{ padding: '0.1rem', fontSize: '0.75rem', width: '80px', color: '#E5C17D' }}
                                      value={manualMechTargets[`${car.id}-pads`] || (car.next_pads_km ? car.next_pads_km : (car.last_pads_km ?? car.current_km ?? 0) + 30000)}
                                      onChange={(e) => setManualMechTargets(prev => ({...prev, [`${car.id}-pads`]: e.target.value}))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleManualMechTargetSubmit(car.id, 'pads', manualMechTargets[`${car.id}-pads`] || String(car.next_pads_km ? car.next_pads_km : (car.last_pads_km ?? car.current_km ?? 0) + 30000))
                                        if (e.key === 'Escape') setEditingManualMech(prev => ({...prev, [`${car.id}-pads`]: false}))
                                      }}
                                      onBlur={() => handleManualMechTargetSubmit(car.id, 'pads', manualMechTargets[`${car.id}-pads`] || String(car.next_pads_km ? car.next_pads_km : (car.last_pads_km ?? car.current_km ?? 0) + 30000))}
                                    />
                                  ) : (
                                    <>
                                      <span>Next Pads: <span style={{ color: '#E5C17D' }}>{car.next_pads_km ? car.next_pads_km : (car.last_pads_km ?? car.current_km ?? 0) + 30000}</span> km</span>
                                      <button className="icon-btn" style={{ padding: 0 }} onClick={() => {
                                        setManualMechTargets(prev => ({...prev, [`${car.id}-pads`]: String(car.next_pads_km ? car.next_pads_km : (car.last_pads_km ?? car.current_km ?? 0) + 30000)}))
                                        setEditingManualMech(prev => ({...prev, [`${car.id}-pads`]: true}))
                                      }}>
                                        <Edit2 size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                                      </button>
                                    </>
                                  )}
                                </div>
                                <button 
                                  className="btn-secondary" 
                                  style={{ padding: '0.15rem 0.3rem', fontSize: '0.65rem', border: '1px solid rgba(229,193,125,0.3)' }}
                                  title="Settle Early"
                                  onClick={() => setSettlingMech(prev => ({ ...prev, [`${car.id}-pads`]: !prev[`${car.id}-pads`] }))}
                                >
                                  {settlingMech[`${car.id}-pads`] ? 'Cancel' : '🛠️ Settle'}
                                </button>
                              </div>
                              {settlingMech[`${car.id}-pads`] && (
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', animation: 'fadeIn 0.2s ease-out' }}>
                                  <input
                                    type="number"
                                    placeholder="Cost DT"
                                    className="spreadsheet-input"
                                    style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #E5C17D' }}
                                    value={mechCosts[`${car.id}-pads`] || ''}
                                    onChange={(e) => setMechCosts(prev => ({ ...prev, [`${car.id}-pads`]: e.target.value }))}
                                  />
                                  <select 
                                    className="spreadsheet-input"
                                    style={{ width: '75px', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                    value={mechIntervals[`${car.id}-pads`] || '30000'}
                                    onChange={(e) => setMechIntervals(prev => ({ ...prev, [`${car.id}-pads`]: e.target.value }))}
                                  >
                                    <option value="30000">+30,000</option>
                                    <option value="40000">+40,000</option>
                                  </select>
                                  <button 
                                    className="btn-renew-gold" 
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => {
                                      const cost = parseFloat(mechCosts[`${car.id}-pads`] || '')
                                      const interval = parseInt(mechIntervals[`${car.id}-pads`] || '30000')
                                      if (!isNaN(cost)) {
                                        handleMechanicalService(car.id, 'pads', cost, interval)
                                        setSettlingMech(prev => ({ ...prev, [`${car.id}-pads`]: false }))
                                      }
                                    }}
                                  >
                                    ✓
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* COLUMN 3: Assurance (Statutory) */}
                      <td data-label="Assurance (Statutory)">
                        {car.insurance_start_date && (
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.75)', marginBottom: '0.35rem', fontWeight: 500 }}>
                            <span style={{ color: '#E5C17D', fontWeight: 600 }}>Start: </span>{car.insurance_start_date}
                          </div>
                        )}
                        {renderLegalDocCell(car, 'assurance')}
                      </td>

                      {/* COLUMN 4: Visite Technique */}
                      <td data-label="Visite Technique">
                        {renderLegalDocCell(car, 'visite_technique')}
                      </td>

                      {/* COLUMN 5: Transport Authorization (Laissez-Passer) */}
                      <td data-label="Transport Authorization">
                        {renderLegalDocCell(car, 'laissez_passer')}
                      </td>

                      {/* COLUMN 6: Availability & Yield */}
                      <td data-label="Availability & Yield">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                          <div 
                            title={isRented && activeBooking ? `Renter: ${getInitograms(activeBooking.client_name || activeBooking.clients?.full_name || 'N/A')}` : undefined}
                            style={{ cursor: isRented ? 'help' : 'default' }}
                          >
                            <Badge variant={isRented ? 'danger' : 'success'}>
                              {isRented ? '🔴 Rented' : '🟢 Available'}
                            </Badge>
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: netYieldColor, textShadow: netYieldTextShadow }}>
                            {netYieldPrefix}{netYield.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT
                          </div>
                        </div>
                      </td>

                      {/* COLUMN 7: Actions */}
                      <td data-label="Actions" style={{ textAlign: 'right' }}>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button className="icon-btn" title="View History" onClick={() => router.push(`/dashboard/vehicles/${car.id}/history`)}>
                            <History size={16} />
                          </button>
                          {!car.withdrawn_at ? (
                            <>
                              <button className="icon-btn" title="Edit Vehicle" onClick={() => openEditModal(car)}>
                                <Edit2 size={16} />
                              </button>
                              <button
                                className="icon-btn"
                                title="Withdraw Vehicle"
                                style={{ color: '#94A3B8' }}
                                onClick={() => { setWithdrawModalVehicle(car); setWithdrawDate('') }}
                              >
                                <Archive size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              {car.archived_at ? (
                                <button
                                  className="icon-btn"
                                  title="Restore to Retired"
                                  style={{ color: '#ae9260' }}
                                  onClick={() => handleUnarchiveClick(car.id, car.brand, car.model)}
                                >
                                  <RotateCcw size={16} />
                                </button>
                              ) : (
                                <>
                                  <button
                                    className="icon-btn"
                                    title="Restore Vehicle"
                                    style={{ color: '#34D399' }}
                                    onClick={() => setRestoreModalVehicle(car)}
                                  >
                                    <RotateCcw size={16} />
                                  </button>
                                  <button
                                    className="icon-btn"
                                    title="Archive Vehicle"
                                    style={{ color: '#E5C17D' }}
                                    onClick={() => handleArchiveClick(car.id, car.brand, car.model)}
                                  >
                                    <Check size={16} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-4">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
                      <Car size={48} style={{ opacity: 0.5, color: 'var(--text-muted)' }} />
                      <p>No matching vehicles found.</p>
                      <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => setIsAddModalOpen(true)}>Add a Vehicle</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid rgba(229,193,125,0.1)', background: 'rgba(255,255,255,0.01)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', flexWrap: 'wrap', gap: '1rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#888' }}>
                Showing <strong style={{ color: '#fff' }}>{indexOfFirstItem + 1}</strong> to <strong style={{ color: '#fff' }}>{Math.min(indexOfLastItem, filteredVehicles.length)}</strong> of <strong style={{ color: '#fff' }}>{filteredVehicles.length}</strong> vehicles
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(229,193,125,0.15)',
                    borderRadius: '6px',
                    color: currentPage === 1 ? '#555' : '#ae9260',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                >
                  Previous
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum = idx + 1;
                  // Center the active page if possible
                  if (currentPage > 3 && totalPages > 5) {
                    pageNum = currentPage - 3 + idx;
                    if (pageNum + (4 - idx) > totalPages) {
                      pageNum = totalPages - 4 + idx;
                    }
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: currentPage === pageNum ? '#ae9260' : 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(229,193,125,0.15)',
                        borderRadius: '6px',
                        color: currentPage === pageNum ? '#000' : '#fff',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: currentPage === pageNum ? 600 : 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(229,193,125,0.15)',
                    borderRadius: '6px',
                    color: currentPage === totalPages ? '#555' : '#ae9260',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ADD VEHICLE MODAL */}
      {mounted && isAddModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{t('fleet.addTitle')}</h2>
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
                {t('fleet.coreSpecs')}
              </h4>

              <div className="form-group">
                <label>{t('fleet.brand')}</label>
                <input type="text" name="brand" required placeholder={t('fleet.brandPlaceholder')} className="form-input" />
              </div>
              <div className="form-group">
                <label>{t('fleet.model')}</label>
                <input type="text" name="model" required placeholder={t('fleet.modelPlaceholder')} className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('fleet.year')}</label>
                  <input type="number" name="year" required placeholder={t('fleet.yearPlaceholder')} min="1900" max="2100" className="form-input" />
                </div>
                <div className="form-group">
                  <label>{t('fleet.pricePerDay')}</label>
                  <input type="number" name="price_per_day" required placeholder={t('fleet.pricePlaceholder')} min="0" step="0.01" className="form-input" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('fleet.licensePlate')}</label>
                  <input type="text" name="license_plate" placeholder={t('fleet.platePlaceholder')} className="form-input" />
                </div>
                <div className="form-group">
                  <label>{t('fleet.color')}</label>
                  <input type="text" name="color" placeholder={t('fleet.colorPlaceholder')} className="form-input" />
                </div>
              </div>
              
              {/* VEHICLE IMAGE SYSTEM: UPLOAD & PREVIEW */}
              <div className="form-group">
                <label>{t('fleet.images')}</label>
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
                  <p>{t('fleet.clickToUpload')}</p>
                  <span>{t('fleet.uploadSupport')}</span>
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
                {t('fleet.mechHeader')}
              </h4>
              
              <div className="form-group">
                <label>{t('fleet.currentKm')}</label>
                <input type="number" name="current_km" placeholder={t('fleet.currentKmPlaceholder')} className="form-input" min="0" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('fleet.lastOilChange')}</label>
                  <input 
                    type="number" 
                    name="last_vidange_km"
                    placeholder={t('fleet.lastOilChangePlaceholder')} 
                    className="form-input" 
                    min="0"
                    onChange={handleLastOilChangeChange}
                  />
                </div>
                <div className="form-group">
                  <label>{t('fleet.nextOilChange')}</label>
                  <input 
                    type="number" 
                    name="next_vidange_km" 
                    placeholder={t('fleet.nextOilChangePlaceholder')} 
                    className="form-input" 
                    min="0"
                    value={addOilDueKm}
                    onChange={(e) => setAddOilDueKm(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('fleet.lastPadsChange')}</label>
                  <input 
                    type="number" 
                    name="last_pads_km"
                    placeholder={t('fleet.lastPadsChangePlaceholder')} 
                    className="form-input" 
                    min="0"
                    onChange={handleLastPadsChangeChange}
                  />
                </div>
                <div className="form-group">
                  <label>{t('fleet.nextPadsChange')}</label>
                  <input 
                    type="number" 
                    name="next_pads_km" 
                    placeholder={t('fleet.nextPadsChangePlaceholder')} 
                    className="form-input" 
                    min="0"
                    value={addPadsDueKm}
                    onChange={(e) => setAddPadsDueKm(e.target.value)}
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
                {t('fleet.legalHeader')}
              </h4>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('fleet.insuranceStart')}</label>
                  <input type="date" name="insurance_start_date" className="form-input" />
                </div>
                <div className="form-group">
                  <label>{t('fleet.insuranceExpiry')}</label>
                  <input type="date" name="assurance_expiry" className="form-input" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('fleet.visiteExpiry')}</label>
                  <input type="date" name="visite_technique_expiry" className="form-input" />
                </div>
                <div className="form-group">
                  <label>{t('fleet.laissezPasserExpiry')}</label>
                  <input type="date" name="laissez_passer_expiry" className="form-input" />
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input type="checkbox" name="availability" defaultChecked id="avail" />
                <label htmlFor="avail" style={{ margin: 0 }}>{t('fleet.availImmediately')}</label>
              </div>
              
              <div className="modal-footer" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => { setIsAddModalOpen(false); setAddFiles([]); setAddOilDueKm(''); }}>{t('common.cancel')}</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="loading-spinner"></span>
                      <span>{t('fleet.saving')}</span>
                    </div>
                  ) : t('fleet.add') /* Ajouter un Véhicule / Add Vehicle */}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EDIT VEHICLE MODAL */}
      {mounted && isEditModalOpen && editingVehicle && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>{t('fleet.editTitle')}</h2>
              <button className="icon-btn" onClick={() => { setIsEditModalOpen(false); setEditingVehicle(null); setEditNewFiles([]); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="form-group">
                <label>{t('fleet.brand')}</label>
                <input 
                  type="text" 
                  name="brand" 
                  required 
                  defaultValue={editingVehicle.brand} 
                  placeholder={t('fleet.brandPlaceholder')} 
                  className="form-input" 
                />
              </div>
              <div className="form-group">
                <label>{t('fleet.model')}</label>
                <input 
                  type="text" 
                  name="model" 
                  required 
                  defaultValue={editingVehicle.model} 
                  placeholder={t('fleet.modelPlaceholder')} 
                  className="form-input" 
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('fleet.year')}</label>
                  <input 
                    type="number" 
                    name="year" 
                    required 
                    defaultValue={editingVehicle.year} 
                    placeholder={t('fleet.yearPlaceholder')} 
                    min="1900" 
                    max="2100" 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>{t('fleet.pricePerDay')}</label>
                  <input 
                    type="number" 
                    name="price_per_day" 
                    required 
                    defaultValue={editingVehicle.price_per_day} 
                    placeholder={t('fleet.pricePlaceholder')} 
                    min="0" 
                    step="0.01" 
                    className="form-input" 
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('fleet.licensePlate')}</label>
                  <input 
                    type="text" 
                    name="license_plate" 
                    defaultValue={editingVehicle.license_plate || ''} 
                    placeholder={t('fleet.platePlaceholder')} 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>{t('fleet.color')}</label>
                  <input 
                    type="text" 
                    name="color" 
                    defaultValue={editingVehicle.color || ''} 
                    placeholder={t('fleet.colorPlaceholder')} 
                    className="form-input" 
                  />
                </div>
              </div>

              {/* VEHICLE IMAGE SYSTEM: EXISTING & NEW UPLOADS */}
              <div className="form-group">
                <label>{t('fleet.images')}</label>
                
                {/* Existing Images list */}
                {editExistingImages.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {t('fleet.activeImages')}
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
                  <p style={{ fontSize: '0.75rem' }}>{t('fleet.uploadAdditional')}</p>
                </div>
                
                {editNewFiles.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {t('fleet.toUploadPreview')}
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

              {/* Insurance dates in Edit form */}
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
                {t('fleet.insuranceDates')}
              </h4>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('fleet.insuranceStart')}</label>
                  <input 
                    type="date"
                    name="insurance_start_date"
                    defaultValue={editingVehicle.insurance_start_date || ''}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>{t('fleet.insuranceExpiry')}</label>
                  <input 
                    type="date"
                    name="assurance_expiry_edit"
                    defaultValue={editingVehicle.vehicle_legal_docs?.find((d: any) => d.doc_type === 'assurance')?.expiry_date || ''}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox"
                  name="availability"
                  defaultChecked={editingVehicle.availability}
                  id="edit-avail"
                />
                <label htmlFor="edit-avail" style={{ margin: 0 }}>{t('fleet.availImmediately')}</label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setIsEditModalOpen(false); setEditingVehicle(null); setEditNewFiles([]); }}>{t('common.cancel')}</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="loading-spinner"></span>
                      <span>{t('fleet.saving')}</span>
                    </div>
                  ) : t('fleet.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* WITHDRAW VEHICLE MODAL */}
      {mounted && withdrawModalVehicle && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>{t('fleet.withdrawTitle')}</h2>
              <button className="icon-btn" onClick={() => { setWithdrawModalVehicle(null); setWithdrawDate('') }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '0 1.5rem 0.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
                {t('fleet.withdrawDescPre')}{' '}
                <strong style={{ color: '#E2E8F0' }}>
                  {withdrawModalVehicle.brand} {withdrawModalVehicle.model}{withdrawModalVehicle.license_plate ? ` (${withdrawModalVehicle.license_plate})` : ''}
                </strong>{' '}
                {t('fleet.withdrawDescPost')}
              </p>
              <div className="form-group">
                <label>{t('fleet.withdrawalDate')} <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={withdrawDate}
                  onChange={(e) => setWithdrawDate(e.target.value)}
                  max={todayStr}
                />
                {!withdrawDate && (
                  <span style={{ fontSize: '0.75rem', color: 'rgba(239,68,68,0.8)', marginTop: '0.25rem', display: 'block' }}>
                    {t('fleet.withdrawalDateError')}
                  </span>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setWithdrawModalVehicle(null); setWithdrawDate('') }}
                disabled={isWithdrawing}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleWithdrawConfirm}
                disabled={!withdrawDate || isWithdrawing}
                style={{
                  background: withdrawDate ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.05)',
                  border: `1px solid ${withdrawDate ? 'rgba(148,163,184,0.5)' : 'rgba(148,163,184,0.15)'}`,
                  color: withdrawDate ? '#94A3B8' : 'rgba(148,163,184,0.3)',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: withdrawDate && !isWithdrawing ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                {isWithdrawing ? (
                  <><span className="loading-spinner-xs"></span><span>{t('fleet.withdrawing')}</span></>
                ) : (
                  <><Archive size={15} /><span>{t('fleet.confirmWithdrawal')}</span></>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* RESTORE VEHICLE MODAL */}
      {mounted && restoreModalVehicle && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>{t('fleet.restoreTitle')}</h2>
              <button className="icon-btn" onClick={() => setRestoreModalVehicle(null)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '0 1.5rem 0.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
                {t('fleet.restoreDescPre')}{' '}
                <strong style={{ color: '#E2E8F0' }}>
                  {restoreModalVehicle.brand} {restoreModalVehicle.model}{restoreModalVehicle.license_plate ? ` (${restoreModalVehicle.license_plate})` : ''}
                </strong>{' '}
                {t('fleet.restoreDescPost')}
              </p>
              {restoreModalVehicle.withdrawn_at && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                  {t('fleet.withdrawnOn')} <span style={{ fontFamily: 'monospace' }}>{restoreModalVehicle.withdrawn_at}</span>
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRestoreModalVehicle(null)}
                disabled={isRestoring}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleRestoreConfirm}
                disabled={isRestoring}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isRestoring ? (
                  <><span className="loading-spinner-xs"></span><span>{t('fleet.restoring')}</span></>
                ) : (
                  <><RotateCcw size={15} /><span>{t('fleet.confirmRestore')}</span></>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* BULK INSURANCE RENEWAL MODAL */}
      {mounted && isBulkModalOpen && createPortal(
        <div className="modal-overlay" style={{ zIndex: 999 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '580px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{lang === 'fr' ? "Renouvellement d'assurance en bloc" : "Bulk Fleet Insurance Renewal"}</h2>
              <button className="icon-btn" onClick={() => setIsBulkModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '0 1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Expiry Date Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'rgba(229,193,125,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {lang === 'fr' ? "Nouvelle date d'expiration" : "New Expiry Date"}
                </label>
                <input
                  type="date"
                  value={bulkExpiryDate}
                  onChange={(e) => setBulkExpiryDate(e.target.value)}
                  className="form-input"
                  style={{ colorScheme: 'dark' }}
                  required
                />
              </div>

              {/* Expense Amount Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'rgba(229,193,125,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {lang === 'fr' ? "Coût total de l'assurance (DT) - Optionnel" : "Total Insurance Cost (TND) - Optional"}
                </label>
                <input
                  type="number"
                  placeholder={lang === 'fr' ? "Ex. 2500 (Laisser vide pour ne pas enregistrer de dépense)" : "e.g. 2500 (Leave blank for no expense logging)"}
                  value={bulkExpenseAmount}
                  onChange={(e) => setBulkExpenseAmount(e.target.value)}
                  className="form-input"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Search Filter for Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'rgba(229,193,125,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {lang === 'fr' ? "Filtrer les véhicules" : "Filter Vehicles"}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'fr' ? "Rechercher par plaque, marque ou modèle..." : "Search by plate, brand, or model..."}
                  value={bulkSearchQuery}
                  onChange={(e) => setBulkSearchQuery(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Vehicle Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(229,193,125,0.15)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={
                        initialVehicles.filter(car => !car.withdrawn_at && !car.archived_at).length > 0 &&
                        initialVehicles.filter(car => !car.withdrawn_at && !car.archived_at).every(car => bulkSelectedIds.has(car.id))
                      }
                      onChange={(e) => {
                        const activeCars = initialVehicles.filter(car => !car.withdrawn_at && !car.archived_at)
                        if (e.target.checked) {
                          setBulkSelectedIds(new Set(activeCars.map(car => car.id)))
                        } else {
                          setBulkSelectedIds(new Set())
                        }
                      }}
                      style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--accent-gold)' }}
                    />
                    <span>{lang === 'fr' ? "Tout sélectionner" : "Select All"}</span>
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {bulkSelectedIds.size} / {initialVehicles.filter(car => !car.withdrawn_at && !car.archived_at).length} {lang === 'fr' ? "Sélectionné(s)" : "Selected"}
                  </span>
                </div>

                {/* Scrollable List container */}
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', padding: '0.5rem' }}>
                  {(() => {
                    const activeVehicles = initialVehicles.filter(car => !car.withdrawn_at && !car.archived_at)
                    const q = bulkSearchQuery.toLowerCase().trim()
                    
                    const filteredList = activeVehicles.filter(car => {
                      if (!q) return true
                      return (
                        (car.brand || '').toLowerCase().includes(q) ||
                        (car.model || '').toLowerCase().includes(q) ||
                        (car.license_plate || '').toLowerCase().includes(q)
                      )
                    })

                    if (filteredList.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          {lang === 'fr' ? "Aucun véhicule actif ne correspond." : "No matching active vehicles."}
                        </div>
                      )
                    }

                    return filteredList.map(car => {
                      const isChecked = bulkSelectedIds.has(car.id)
                      const currentAssurance = car.vehicle_legal_docs?.find((d: any) => d.doc_type === 'assurance')
                      const expiryStr = currentAssurance?.expiry_date 
                        ? new Date(currentAssurance.expiry_date).toLocaleDateString('fr-FR')
                        : (lang === 'fr' ? 'Aucune' : 'None')

                      return (
                        <label
                          key={car.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0.5rem',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            transition: 'background 0.2s',
                          }}
                          className="hover-bg-glass"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const newIds = new Set(bulkSelectedIds)
                                if (isChecked) {
                                  newIds.delete(car.id)
                                } else {
                                  newIds.add(car.id)
                                }
                                setBulkSelectedIds(newIds)
                              }}
                              style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--accent-gold)' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                                {car.brand} {car.model}
                              </span>
                              {car.license_plate && (
                                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
                                  {car.license_plate}
                                </span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(229,193,125,0.7)', background: 'rgba(229,193,125,0.06)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            {lang === 'fr' ? `Exp : ${expiryStr}` : `Exp: ${expiryStr}`}
                          </span>
                        </label>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid rgba(229,193,125,0.1)' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsBulkModalOpen(false)}
                disabled={isBulkSubmitting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={isBulkSubmitting || bulkSelectedIds.size === 0 || !bulkExpiryDate}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {isBulkSubmitting ? (
                  <><span className="loading-spinner-xs"></span><span>{lang === 'fr' ? 'Enregistrement...' : 'Saving...'}</span></>
                ) : (
                  <><Check size={16} /><span>{lang === 'fr' ? `Renouveler (${bulkSelectedIds.size})` : `Renew (${bulkSelectedIds.size})`}</span></>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* IMAGE LIGHTBOX MODAL */}
      {mounted && lightboxImages && lightboxImages.length > 0 && createPortal(
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
                {t('fleet.lightboxImage')} {lightboxIndex + 1} {t('fleet.lightboxOf')} {lightboxImages.length}
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
        </div>,
        document.body
      )}

    </div>
  )
}
