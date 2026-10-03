// ---------------------------------------------------------------------------
// BARRA DE PESTANAS
//
// Mejora sobre el diseno anterior:
//   - Cada seccion tiene su color activo: azul para Pokemon, coral para One
//     Piece y verde para Docentes. Ayuda a saber en que parte de la app estas.
//   - La quinta pestana (Docentes) tiene una etiqueta larga, asi que el texto de
//     la barra baja un punto de tamano. Con cinco elementos la etiqueta "Docentes"
//     se cortaba en "Docent..." en pantallas estrechas.
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
        // Un punto mas chico que antes (eran 11 con cuatro pestanas). Con cinco
        // iconos la barra se estrecha y a 11 puntos "Docentes" se cortaba. El
        // peso se sube para compensar el tamano.
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
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
      {/* Quinta pestana: el listado de docentes. Va ULTIMA a proposito, para
          que las dos secciones anteriores (Pokemon y One Piece) sigan estando
          donde estaban y no se desplace lo que ya se conoce. */}
      <Tabs.Screen
        name="docentes"
        options={{
          title: 'Docentes',
          tabBarActiveTintColor: colors.docentes,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="school-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
