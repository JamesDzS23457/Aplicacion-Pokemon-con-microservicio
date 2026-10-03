// ---------------------------------------------------------------------------
// BARRA DE PESTANAS
//
// Mejora sobre el diseno anterior:
//   - Cada seccion tiene su color activo: azul para Pokemon, coral para One
//     Piece. Ayuda a saber en que mitad de la app estas.
//   - Etiquetas mas claras ("Ficha" en vez de "Datos").
//   - La barra lleva borde superior y una sombra suave para separarse del
//     contenido al hacer scroll.
// ---------------------------------------------------------------------------

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pokemon,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          height: 80,
          paddingTop: 10,
          paddingBottom: 14,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          shadowColor: '#0d2a3a',
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -4 },
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Pokemon',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'Ficha',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="one-piece"
        options={{
          title: 'One Piece',
          tabBarActiveTintColor: colors.onepiece,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="boat-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="one-piece-about"
        options={{
          title: 'Ficha OP',
          tabBarActiveTintColor: colors.onepiece,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="reader-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
