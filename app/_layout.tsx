import 'react-native-reanimated';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DataProvider, useCycle, useData } from '@/lib/data/store';
import { useReminderSync } from '@/lib/notifications';
import { clearSharedReports } from '@/lib/report/share';
import { AppLock } from '@/lib/security/AppLock';
import { CloudAutoSync } from '@/lib/supabase/useCloudSync';
import { ThemeProvider, useTheme } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
// A report shared last time has done its job; don't keep it around.
clearSharedReports();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlayfairDisplay_600SemiBold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DataProvider>
          <Themed fontsReady={fontsLoaded || !!fontError} />
        </DataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Themed({ fontsReady }: { fontsReady: boolean }) {
  const { data, ready } = useData();
  const appReady = ready && fontsReady;

  useEffect(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => {});
  }, [appReady]);

  return <ThemeProvider preference={data.preferences.appearance}>{appReady ? <Navigator /> : null}</ThemeProvider>;
}

function Navigator() {
  const { colors, scheme } = useTheme();
  const { data, ready } = useData();
  const { analysis, today } = useCycle();
  useReminderSync(data.reminders, analysis, today, data.preferences.showFertility, ready, data.medications);

  return (
    <AppLock enabled={data.preferences.appLock}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <CloudAutoSync />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding/index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="log/[date]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="account/index" options={{ presentation: 'modal' }} />
        <Stack.Screen name="account/reset" options={{ presentation: 'modal' }} />
      </Stack>
    </AppLock>
  );
}
