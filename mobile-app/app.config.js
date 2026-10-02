// Loads .env before Expo merges config so EXPO_PUBLIC_* is available and we can pass values via expo.extra (reliable for Metro web).
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

module.exports = ({ config }) => ({
  ...config,
  expo: {
    ...config.expo,
    android: {
      ...config.expo?.android,
      package: 'com.anonymous.salesmobileapp',
    },
    extra: {
      ...(config.expo?.extra ?? {}),
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
})
