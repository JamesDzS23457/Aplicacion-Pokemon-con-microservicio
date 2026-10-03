// ---------------------------------------------------------------------------
// TOKENS DE DISENO
//
// Un unico sitio para colores, espaciados, radios y sombras. Antes cada
// pantalla repetia sus propios valores ("#159bd3" aqui, "#e85d4a" alla) y
// quedaban inconsistentes. Con tokens, cambiar un color se hace en un solo
// lugar y las cuatro pantallas se mantienen coherentes.
//
// Se separa por "acento": Pokemon usa azul, One Piece usa coral. Cada pantalla
// recibe su acento y su version suave (para fondos de iconos y fichas), de
// modo que el mismo componente se ve bien en ambas secciones.
// ---------------------------------------------------------------------------

import { Platform } from 'react-native';

export const colors = {
  // Fondos generales.
  background: '#eef3f8',
  backgroundWarm: '#fdf4ea',
  surface: '#ffffff',
  surfaceMuted: '#f4f8fb',
  border: '#dde7ee',

  // Texto en tres niveles de jerarquia: fuerte, medio y suave.
  text: '#11232e',
  textSoft: '#5b7180',
  textFaint: '#8ea4b1',
  ink: '#0d1b24',

  // Acento Pokemon (azul).
  pokemon: '#159bd3',
  pokemonDark: '#0c6f9e',
  pokemonSoft: '#e2f3fb',

  // Acento One Piece (coral).
  onepiece: '#e85d4a',
  onepieceDark: '#b23c2f',
  onepieceSoft: '#fdeae6',

  // Estados.
  success: '#2e8b57',
  successSoft: '#e6f5ec',
  danger: '#c0392b',
  dangerSoft: '#fdecea',
  warning: '#b7791f',
  warningSoft: '#fdf3e2',
};

// Espaciados en una escala corta. Evita numeros magicos sueltos (7, 13, 22...).
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

// Radios de esquina. Se usan segun el tamano del bloque: los cuadros pequenos
// llevan "md", las tarjetas "lg" y los contenedores grandes "xl".
export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

// Sombras reutilizables. En Android manda "elevation"; en iOS/web mandan los
// "shadow*". Se definen juntas para que el mismo objeto funcione en las 3
// plataformas (la app corre en web, Android e iOS).
export const shadows = {
  card: {
    shadowColor: '#0d2a3a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  soft: {
    shadowColor: '#0d2a3a',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
};

// Colores oficiales de los tipos de Pokemon. Se usan para las fichas de tipo.
// Si un tipo no esta en el mapa, se cae al color de texto suave.
export const pokemonTypeColors: Record<string, string> = {
  normal: '#9fa19f',
  fire: '#ee8130',
  water: '#6390f0',
  electric: '#f7d02c',
  grass: '#7ac74c',
  ice: '#96d9d6',
  fighting: '#c22e28',
  poison: '#a33ea1',
  ground: '#e2bf65',
  flying: '#a98ff3',
  psychic: '#f95587',
  bug: '#a6b91a',
  rock: '#b6a136',
  ghost: '#735797',
  dragon: '#6f35fc',
  dark: '#705746',
  steel: '#b7b7ce',
  fairy: '#d685ad',
};

// Color por tipo de fruta del diablo. La clave va en minusculas porque la API
// entrega el tipo tal cual ("Paramecia", "Zoan", "Zoan Mythique").
export const fruitTypeColors: Record<string, string> = {
  paramecia: '#e85d4a',
  zoan: '#2e8b57',
  logia: '#4a6fe8',
};

// Sombras de texto no existen en RN, asi que la tipografia se centraliza en
// tamanos y pesos para no repetirlos.
export const type = {
  screenTitle: 30,
  screenSubtitle: 14,
  sectionTitle: 15,
  cardTitle: 24,
  label: 12,
  value: 15,
  body: 15,
  small: 12,
};

// Helper para elegir la sombra correcta en web. react-native-web soporta los
// props shadow*, pero no elevation; aun asi se deja el objeto completo.
export const isWeb = Platform.OS === 'web';
