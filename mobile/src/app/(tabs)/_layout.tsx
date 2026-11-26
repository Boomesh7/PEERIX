import { Text, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '@/components/ui';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('✎') }} />
      <Tabs.Screen name="rooms" options={{ title: 'Rooms', tabBarIcon: icon('◫') }} />
      <Tabs.Screen name="profile" options={{ title: 'Teach & profile', tabBarLabel: 'Profile', tabBarIcon: icon('☺') }} />
    </Tabs>
  );
}
