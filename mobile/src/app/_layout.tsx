import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from '@/lib/session';
import { isConfigured } from '@/lib/supabase';
import { Body, Card, Loading, Muted, Screen, Title, colors } from '@/components/ui';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="dark" />
          <RootStack />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { session, loading } = useSession();
  if (!isConfigured) return <SetupNeeded />;
  if (loading) return <Loading />;

  const signedIn = Boolean(session);
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.brand,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="requests/[id]" options={{ title: 'Matches' }} />
        <Stack.Screen name="rooms/[id]" options={{ title: 'Learning room' }} />
      </Stack.Protected>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

function SetupNeeded() {
  return (
    <Screen>
      <Card style={{ marginTop: 48 }}>
        <Title>PEERIX needs a Supabase project</Title>
        <Body>1. Create a free project at supabase.com.</Body>
        <Body>2. Run supabase/migrations/20261126000000_init.sql in its SQL editor.</Body>
        <Body>3. Copy mobile/.env.example to mobile/.env and fill in the project URL and key.</Body>
        <Body>4. Restart with npx expo start --clear.</Body>
        <Muted small>See README.md for the full steps.</Muted>
      </Card>
    </Screen>
  );
}
