import { I18nManager } from 'react-native'
import { AppNavigator } from '../src/navigation/AppNavigator'

// Force Hebrew RTL before any component mounts.
I18nManager.allowRTL(true)
I18nManager.forceRTL(true)

export default function Root() {
  return <AppNavigator />
}
