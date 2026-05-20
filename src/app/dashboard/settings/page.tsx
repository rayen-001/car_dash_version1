import { getBusinessSettings } from '@/app/actions'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const initialSettings = await getBusinessSettings()

  return <SettingsClient initialSettings={initialSettings} />
}
