import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Application from 'expo-application'
import * as Crypto from 'expo-crypto'

export async function getDeviceFingerprint(): Promise<string> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const parts = ['web-preview', navigator.userAgent ?? 'ua', navigator.language ?? 'en']
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      parts.join('|'),
    )
  }

  const parts = [
    Device.modelId ?? 'unknown-model',
    Device.osVersion ?? 'unknown-os',
    Application.applicationId ?? 'unknown-app',
  ].join('|')

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    parts,
  )
}

export function getDeviceMeta() {
  if (Platform.OS === 'web') {
    return {
      device_model: 'Web preview (PC browser)',
      android_version: '—',
      app_version: Application.nativeApplicationVersion ?? '1.0.0',
    }
  }
  return {
    device_model: Device.modelName ?? 'Unknown',
    android_version: Device.osVersion ?? 'Unknown',
    app_version: Application.nativeApplicationVersion ?? '1.0.0',
  }
}
