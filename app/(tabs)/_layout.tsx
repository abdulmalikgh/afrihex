import { Tabs } from 'expo-router';
import { BadgeCheck, Navigation, Search, UserCircle } from 'lucide-react-native';

import { colors } from '../../src/constants/colors';
import { fontFamilies } from '../../src/constants/typography';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // React Navigation renders each tab into a scene container that takes its
        // background from the navigation theme, and that default is light. Left
        // unset it flashes white before a screen paints — most visibly on the
        // map tabs, which have the most to mount.
        sceneStyle: { backgroundColor: colors.surface },
        tabBarActiveTintColor: colors.primaryLight,
        // `faint` measures 3.5:1 on `card` — under AA for a 12px tab label.
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          minHeight: 68,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamilies.bodyMedium,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Find',
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="directions"
        options={{
          title: 'Directions',
          tabBarIcon: ({ color, size }) => <Navigation color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="certificates"
        options={{
          title: 'Verify',
          tabBarIcon: ({ color, size }) => <BadgeCheck color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
