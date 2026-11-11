import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';

import { TabBar } from '@/components/ui/TabBar';
import { useTheme } from '@/theme/theme';

export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  const icon = (name: React.ComponentProps<typeof Feather>['name']) => {
    const TabIcon = ({ color }: { color: string }) => <Feather name={name} size={22} color={color} />;
    return TabIcon;
  };

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('bar-chart-2') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('book-open') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
