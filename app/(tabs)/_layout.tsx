import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#159bd3',
        tabBarInactiveTintColor: '#68737c',
        tabBarStyle: {
          height: 76,
          paddingBottom: 12,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'Datos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="information-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="one-piece" options={{ title: 'One Piece', tabBarIcon: ({ color, size }) => <Ionicons name="boat-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="one-piece-about" options={{ title: 'Datos OP', tabBarIcon: ({ color, size }) => <Ionicons name="reader-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
