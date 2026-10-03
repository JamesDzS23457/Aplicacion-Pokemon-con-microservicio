// ---------------------------------------------------------------------------
// COMPONENTES DE INTERFAZ REUTILIZABLES
//
// Antes cada pantalla dibujaba su propio encabezado, buscador y tarjetas, y
// por eso se veian distintas entre si. Aqui se define UNA vez cada pieza y las
// cuatro pantallas la reutilizan. Asi el resultado es coherente y cualquier
// retoque visual se hace en un solo archivo.
//
// Todos los componentes son "tontos": reciben datos por props y no consultan
// la API ni guardan estado. La logica vive en los contextos.
// ---------------------------------------------------------------------------

import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, shadows, spacing, type } from '../lib/theme';

// ---------------------------------------------------------------------------
// Encabezado de pantalla: titulo + subtitulo + un icono en un circulo suave.
// El icono llega como nodo para poder usar Ionicons o MaterialCommunityIcons
// segun convenga (por ejemplo el icono de pokebola no existe en Ionicons).
// ---------------------------------------------------------------------------
export function ScreenHeader({
  title,
  subtitle,
  accent,
  soft,
  icon,
}: {
  title: string;
  subtitle: string;
  accent: string;
  soft: string;
  icon: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.headerBadge, { backgroundColor: soft }]}>
        <View style={[styles.headerBadgeInner, { borderColor: accent }]}>{icon}</View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buscador. Es una sola tarjeta con tres partes: lupa, campo de texto y boton.
// Detalles pensados:
//   - El boton muestra un indicador mientras se busca, para dar senal de vida
//     (importante con el "cold start" de Render, que puede tardar ~1 minuto).
//   - Aparece una "x" para limpiar el campo solo cuando hay texto y no se esta
//     buscando, evitando un control muerto.
//   - Se desactiva el boton mientras carga para no encadenar peticiones.
// ---------------------------------------------------------------------------
export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  accent,
  loading,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder: string;
  accent: string;
  loading: boolean;
}) {
  return (
    <View style={styles.searchBar}>
      <Ionicons name="search" size={18} color={colors.textFaint} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && !loading ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={colors.textFaint} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={({ pressed }) => [
          styles.searchButton,
          { backgroundColor: accent },
          pressed && styles.pressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        )}
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Titulo de seccion con una barrita de color a la izquierda. "right" permite
// mostrar un contador a la derecha (por ejemplo, el numero de movimientos).
// ---------------------------------------------------------------------------
export function SectionTitle({
  title,
  accent,
  right,
}: {
  title: string;
  accent: string;
  right?: string;
}) {
  return (
    <View style={styles.sectionTitle}>
      <View style={[styles.sectionBar, { backgroundColor: accent }]} />
      <Text style={styles.sectionText}>{title}</Text>
      {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rejilla de dos columnas para los mosaicos de datos. Se centraliza aqui para
// que el "width: 48%" y la separacion sean iguales en todas las pantallas.
// ---------------------------------------------------------------------------
export function Grid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Mosaico de un dato: icono, etiqueta y valor. Es la pieza que sustituye a las
// lineas de texto planas "Altura: 4" por algo legible de un vistazo.
//
// El icono va en un recuadro con el color suave del acento para dar color sin
// recargar; el valor se limita a 2 lineas para que una tripulacion larga no
// rompa la altura de la fila.
// ---------------------------------------------------------------------------
export function InfoTile({
  icon,
  label,
  value,
  accent,
  soft,
  wide,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
  soft: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.infoTile, wide ? styles.infoTileWide : styles.infoTileHalf]}>
      <View style={[styles.infoIcon, { backgroundColor: soft }]}>{icon}</View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Aviso para errores o mensajes informativos. Se usa una banda con icono en
// lugar de un texto rojo suelto, porque se lee mejor y no se pierde al hacer
// scroll.
// ---------------------------------------------------------------------------
export function Notice({ text, tone = 'error' }: { text: string; tone?: 'error' | 'info' }) {
  const isError = tone === 'error';
  const color = isError ? colors.danger : colors.pokemonDark;
  const soft = isError ? colors.dangerSoft : colors.pokemonSoft;
  return (
    <View style={[styles.notice, { backgroundColor: soft }]}>
      <Ionicons
        name={isError ? 'alert-circle' : 'information-circle'}
        size={18}
        color={color}
      />
      <Text style={[styles.noticeText, { color }]}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Estado vacio. Reemplaza la tarjeta gris sin contexto por un icono, un titulo
// y una frase que explica QUE hacer a continuacion.
// ---------------------------------------------------------------------------
export function EmptyState({
  icon,
  title,
  message,
  accent,
  soft,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  accent: string;
  soft: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: soft, borderColor: accent }]}>
        {icon}
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de carga. En lugar de un spinner flotante, ocupa el mismo espacio que
// el resultado para que la pantalla no "salte" cuando llega la respuesta.
// ---------------------------------------------------------------------------
export function LoadingCard({ accent, label }: { accent: string; label: string }) {
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator size="large" color={accent} />
      <Text style={styles.loadingLabel}>{label}</Text>
      {/* Aviso destacado de arranque en frio: no es un adorno, explica por que
          la primera busqueda puede tardar. Sin esto el usuario cree que la app
          se colgo (o que el trabajo se "dano") cuando en realidad el plan
          gratuito de Render esta despertando el servicio. */}
      <View style={styles.coldStart}>
        <Ionicons name="time-outline" size={20} color={accent} />
        <Text style={styles.coldStartText}>
          Arranque en frio: los microservicios se suspenden cuando pasan un rato sin
          usarse. La primera consulta puede tardar hasta un minuto; no cierres la
          pantalla mientras responde.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ficha de color tipo "chip" para tipos de Pokemon, tripulaciones o estados.
// ---------------------------------------------------------------------------
export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Animacion de entrada. Se monta de cero cada vez que cambia la "key" que le
// pasa la pantalla (por ejemplo el id del personaje), asi el resultado aparece
// con un desvanecido suave en vez de saltar.
//
// En web se desactiva el driver nativo porque react-native-web lo ignora y
// avisa por consola; en movil se usa para que la animacion corra en el hilo de
// UI y no se trabe si hay muchas tarjetas.
// ---------------------------------------------------------------------------
export function FadeIn({ children }: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Estilos compartidos. "pressed" se usa para dar respuesta tactil al pulsar.
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerText: { flex: 1, paddingRight: spacing.md },
  headerTitle: { color: colors.text, fontSize: type.screenTitle, fontWeight: '800' },
  headerSubtitle: { color: colors.textSoft, fontSize: type.screenSubtitle, marginTop: 3 },
  headerBadge: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  headerBadgeInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  searchInput: { flex: 1, height: 42, fontSize: type.body, color: colors.text },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionBar: { width: 4, height: 18, borderRadius: 2, marginRight: spacing.sm },
  sectionText: {
    flex: 1,
    color: colors.text,
    fontSize: type.sectionTitle,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionRight: { color: colors.textFaint, fontSize: type.small, fontWeight: '700' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  infoTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  infoTileHalf: { width: '48.5%' },
  infoTileWide: { width: '100%' },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoText: { flex: 1 },
  infoLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: { color: colors.text, fontSize: type.value, fontWeight: '700', marginTop: 2 },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  noticeText: { flex: 1, fontSize: type.small + 1, fontWeight: '600' },

  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyMessage: {
    color: colors.textSoft,
    fontSize: type.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },

  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
  },
  loadingLabel: {
    color: colors.text,
    fontSize: type.value + 1,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  coldStart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coldStartText: {
    flex: 1,
    color: colors.textSoft,
    fontSize: type.small + 1,
    lineHeight: 18,
  },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  pillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
