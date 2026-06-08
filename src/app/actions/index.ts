// Barrel export. Consumers keep importing from '@/app/actions'; only the
// internal file layout has changed. Each underlying file enforces tenant
// isolation via getAuthedUser() + .eq('owner_id', user.id).

export {
  addVehicle,
  updateVehicle,
  deleteVehicle,
  withdrawVehicle,
  restoreVehicle,
  updateVehicleMechanicalState,
  executeMechanicalService,
  updateManualMechanicalTarget,
  syncVehicleMaxOdometer,
  upsertVehicleLegalDoc,
  renewVehicleDocument,
} from './vehicles'

export {
  recalculateClientTrustScore,
  addBooking,
  updateBooking,
  addCoDriverToBooking,
  updateBookingStatus,
  updateBookingHistoricalDetails,
  clearOutstandingLedgerItem,
  toggleTrancheStatus,
  settleBookingTrancheCascade,
  updateBookingHandover,
} from './bookings'

export {
  addExpense,
  updateExpense,
  deleteExpense,
  addMaintenance,
  updateMaintenance,
  deleteMaintenance,
} from './expenses'

export {
  getClients,
  addClient,
  updateClient,
  updateClientLegalDetails,
  deleteClient,
  syncAndRelateClients,
} from './clients'

export {
  getBusinessSettings,
  saveBusinessSettings,
} from './settings'

export {
  addOwner,
  deleteOwner,
} from './admin'

export {
  getTodos,
  addTodo,
  updateTodo,
  completeTodo,
  reopenTodo,
  deleteTodo,
} from './todos'

