import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** False until mobile/.env has the project URL and key. The app shows setup steps instead. */
export const isConfigured = Boolean(url && key && url.startsWith('http') && !url.includes('your-project-ref'));

export const supabase = createClient(url || 'http://localhost:54321', key || 'not-configured', {
  auth: {
    // Sessions can exceed SecureStore's 2 KB limit, so use AsyncStorage (Supabase's React Native guidance).
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
if (isConfigured && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
