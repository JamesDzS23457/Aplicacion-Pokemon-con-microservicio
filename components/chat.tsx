// ---------------------------------------------------------------------------
// COMPONENTES DEL CHAT DEL ASISTENTE
//
// Van aparte de components/ui.tsx (igual que components/docentes.tsx) para no
// arrastrar codigo de la conversacion a las otras pestanas. Son "tontos": reciben
// datos por props y no hablan con la API ni guardan estado; la logica vive en
// AsistenteContext.
// ---------------------------------------------------------------------------

import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, shadows, spacing, type } from '../lib/theme';
import type { Mensaje, ModoAsistente } from '../context/AsistenteContext';

/** Hora corta (HH:MM) para la esquina de la burbuja. */
function horaCorta(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Burbuja de un mensaje. El usuario va a la derecha (fondo con el acento) y el
// asistente a la izquierda (fondo blanco). Si el asistente reconocio que la
// pregunta se salia del contexto, la burbuja se pinta en tono de aviso: no es un
// error, es una respuesta valida del asistente.
// ---------------------------------------------------------------------------
export function BurbujaChat({ mensaje, accent, soft }: { mensaje: Mensaje; accent: string; soft: string }) {
  const esUsuario = mensaje.rol === 'usuario';
  const aviso = mensaje.fueraDeContexto === true;

  const fondo = esUsuario ? accent : aviso ? colors.warningSoft : colors.surface;
  const colorTexto = esUsuario ? '#ffffff' : aviso ? colors.warning : colors.text;
  const borde = esUsuario ? accent : aviso ? colors.warning : colors.border;

  return (
    <View style={[styles.fila, esUsuario ? styles.filaDerecha : styles.filaIzquierda]}>
      {!esUsuario ? (
        <View style={[styles.avatar, { backgroundColor: soft }]}>
          <Ionicons name={aviso ? 'alert-circle' : 'sparkles'} size={16} color={accent} />
        </View>
      ) : null}
      <View style={[styles.burbuja, { backgroundColor: fondo, borderColor: borde }]}>
        <Text style={[styles.texto, { color: colorTexto }]}>{mensaje.texto}</Text>
        <Text style={[styles.hora, { color: esUsuario ? '#e8ecff' : colors.textFaint }]}>
          {horaCorta(mensaje.hora)}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Indicador "el asistente esta escribiendo...". Se muestra mientras llega la
// respuesta de la IA (que puede tardar por el arranque en frio).
// ---------------------------------------------------------------------------
export function IndicadorEscribiendo({ accent, soft }: { accent: string; soft: string }) {
  return (
    <View style={[styles.fila, styles.filaIzquierda]}>
      <View style={[styles.avatar, { backgroundColor: soft }]}>
        <Ionicons name="sparkles" size={16} color={accent} />
      </View>
      <View style={[styles.burbuja, styles.burbujaEscribiendo]}>
        <ActivityIndicator size="small" color={accent} />
        <Text style={styles.escribiendo}>El asistente esta escribiendo...</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Interruptor de modo. Demuestra las dos fases del enunciado en la misma
// pantalla: "Solo mi base de datos" (restringido) y "Abierto".
// ---------------------------------------------------------------------------
export function SelectorModo({
  modo,
  onChange,
  accent,
  soft,
}: {
  modo: ModoAsistente;
  onChange: (modo: ModoAsistente) => void;
  accent: string;
  soft: string;
}) {
  const opcion = (valor: ModoAsistente, etiqueta: string, icono: keyof typeof Ionicons.glyphMap) => {
    const activo = modo === valor;
    return (
      <Pressable
        onPress={() => onChange(valor)}
        accessibilityRole="button"
        accessibilityState={{ selected: activo }}
        style={[styles.opcion, activo && { backgroundColor: accent }]}
      >
        <Ionicons name={icono} size={14} color={activo ? '#ffffff' : colors.textSoft} />
        <Text style={[styles.opcionTexto, { color: activo ? '#ffffff' : colors.textSoft }]}>
          {etiqueta}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.selector, { backgroundColor: soft }]}>
      {opcion('restringido', 'Solo mi base de datos', 'lock-closed-outline')}
      {opcion('abierto', 'Abierto', 'globe-outline')}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chip de sugerencia. Solo se muestra al principio, para dar ideas de que
// preguntar (los ejemplos salen de los datos reales de la app).
// ---------------------------------------------------------------------------
export function ChipSugerencia({
  label,
  onPress,
  accent,
  soft,
}: {
  label: string;
  onPress: () => void;
  accent: string;
  soft: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: soft }, pressed && styles.pressed]}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={14} color={accent} />
      <Text style={[styles.chipTexto, { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Barra de entrada: campo de texto + boton de enviar. Se desactiva el boton
// mientras el asistente piensa para no encadenar preguntas.
// ---------------------------------------------------------------------------
export function EntradaChat({
  value,
  onChangeText,
  onSend,
  cargando,
  accent,
}: {
  value: string;
  onChangeText: (texto: string) => void;
  onSend: () => void;
  cargando: boolean;
  accent: string;
}) {
  const puedeEnviar = value.trim().length > 0 && !cargando;
  return (
    <View style={styles.entrada}>
      <TextInput
        style={styles.entradaInput}
        placeholder="Escribe tu pregunta..."
        placeholderTextColor={colors.textFaint}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSend}
        editable={!cargando}
        multiline
        returnKeyType="send"
      />
      <Pressable
        onPress={onSend}
        disabled={!puedeEnviar}
        accessibilityRole="button"
        accessibilityLabel="Enviar"
        style={[styles.enviar, { backgroundColor: puedeEnviar ? accent : colors.border }]}
      >
        {cargando ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Ionicons name="send" size={18} color="#ffffff" />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },

  fila: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  filaIzquierda: { justifyContent: 'flex-start' },
  filaDerecha: { justifyContent: 'flex-end' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burbuja: {
    maxWidth: '78%',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...shadows.soft,
  },
  burbujaEscribiendo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  texto: { fontSize: type.body, lineHeight: 21 },
  hora: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end', fontWeight: '600' },
  escribiendo: { color: colors.textSoft, fontSize: type.small, fontStyle: 'italic' },

  selector: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 3,
    gap: 3,
    marginBottom: spacing.md,
  },
  opcion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  opcionTexto: { fontSize: 11, fontWeight: '800' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipTexto: { fontSize: type.small, fontWeight: '700' },

  entrada: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  entradaInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontSize: type.body,
    color: colors.text,
  },
  enviar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
