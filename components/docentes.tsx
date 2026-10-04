// ---------------------------------------------------------------------------
// COMPONENTES DE LA PESTANA DE DOCENTES
//
// Piezas propias de la quinta pestana, separadas de components/ui.tsx porque son
// especificas de esta seccion: si se metieran en el archivo comun, los otros dos
// modulos (Pokemon y One Piece) arrastrarian codigo de docentes que no usan.
//
// Todas son "tontas", igual que las de ui.tsx: reciben datos por props, no
// consultan la API y no guardan estado.
// ---------------------------------------------------------------------------

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, facultadColors, radius, shadows, spacing, type } from '../lib/theme';
import type { Docente } from '../context/DocentesContext';

// ---------------------------------------------------------------------------
// Foto del docente, CON RESPALDO de iniciales.
//
// Que `foto_url` sea opcional no es un detalle: hay docentes sin imagen
// fotos y, mas aun asi, una tarjeta sin imagen se veria rota o, peor, con un
// hueco gris. Asi que cuando no hay foto (o cuando la URL esta rota) se dibuja
// un circulo con las iniciales sobre el color de la facultad.
//
// Las iniciales se sacan de los dos primeros nombre y el primer apellido, que
// es como se abbrevian los nombres compuestos en espanol: "Ana Beatriz Rios
// Alvarez" -> "AR", no "ANA" ni "ABR".
// ---------------------------------------------------------------------------

/**
 * Iniciales de un docente a partir de su nombre.
 *
 * @param nombre Nombre completo tal como viene de la base.
 * @returns {string} Dos letras en mayusculas, o "?" si no hay nombre.
 */
export function inicialesDe(nombre?: string): string {
  const partes = String(nombre || '')
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '?';

  // Un nombre de una sola palabra ("Ana") da solo una letra inicial; se repite
  // para que el circulo no quede descentrado con un caracter en vez de dos.
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

  const primera = partes[0][0] || '';
  // Los apellidos compuestos Paraguayos ("Rios Alvarez") no tienen de que
  // cambiar: se coge el primero, que es el patron normal.
  const apellido = partes[partes.length - 1][0] || '';
  return `${primera}${apellido}`.toUpperCase();
}

/**
 * Color de la facultad de un docente.
 *
 * Se busca una palabra clave del nombre de la facultad ("ingenieria", "social"...)
 * en vez de guardar un mapa de nombre completo: asi el color sigue funcionando
 * si el nombre de la facultad se escribe un poco distinto ("Facultad de
 * Ingenieria" vs "Ingenieria") y si se anade una facultad nueva.
 *
 * @param facultad Nombre de la facultad.
 * @returns {string} Un color hexadecimal.
 */
export function colorDeFacultad(facultad?: string): string {
  const texto = String(facultad || '').toLowerCase();
  for (const clave of Object.keys(facultadColors)) {
    if (texto.includes(clave)) return facultadColors[clave];
  }
  return colors.docentes;
}

/**
 * Foto circular del docente, con respaldo de iniciales.
 *
 * @param docente  Docente del que se saca la foto y el nombre.
 * @param tamano   Diametro en puntos. La segunda pantalla lo agranda.
 */
export function FotoDocente({ docente, tamano = 72 }: { docente: Docente; tamano?: number }) {
  const color = colorDeFacultad(docente.facultad);
  // Estado local para saber si la URL fallo. Vive aqui y no en el contexto
  // porque es estrictamente visual: si la foto de UN docente esta rota, no
  // tienen por que caer las iniciales de los otros veinte.
  const [fallo, setFallo] = useState(false);
  const radio = tamano / 2;
  const radioBorde = Math.max(2, Math.round(tamano / 24));

  // Cuando cambia de docente hay que forgotar el fallo anterior: si el docente
  // A no tiene foto y el B si, al reutilizar el componente no se debe seguir
  // viendo las iniciales de A.
  useEffect(() => {
    setFallo(false);
  }, [docente.id, docente.foto_url]);

  const estilo = {
    width: tamano,
    height: tamano,
    borderRadius: radio,
    borderWidth: radioBorde,
    borderColor: color,
  };

  if (!docente.foto_url || fallo) {
    return (
      <View style={[styles.avatar, estilo, { backgroundColor: `${color}1a` }]}>
        <Text style={[styles.iniciales, { color, fontSize: Math.round(tamano * 0.36) }]}>
          {inicialesDe(docente.nombre)}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: docente.foto_url }}
      style={[styles.foto, estilo]}
      resizeMode="cover"
      onError={() => setFallo(true)}
      accessibilityLabel={`Foto de ${docente.nombre}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de la quinta pestana: foto, nombre, cargo, carrera, RESUMEN breve y el
// boton "Leer mas" que abre la ficha completa.
//
// El requisito de la pantalla es justo este: aqui va la version CORTA del texto
// y el boton lleva a la pagina con la version larga. Por eso el resumen se
// recorta a tres lineas con `numberOfLines`: si se-mostrara entero, la tarjeta
// ocuparia media pantalla y el boton "Leer mas" no tendria sentido.
// ---------------------------------------------------------------------------

/** Cuantas lineas de resumen caben en la tarjeta. */
const LINEAS_RESUMEN = 3;

export function TarjetaDocente({
  docente,
  onPress,
}: {
  docente: Docente;
  onPress: (docente: Docente) => void;
}) {
  const color = colorDeFacultad(docente.facultad);

  return (
    <Pressable
      onPress={() => onPress(docente)}
      accessibilityRole="button"
      accessibilityLabel={`Ver la ficha completa de ${docente.nombre}`}
      style={({ pressed }) => [styles.tarjeta, pressed && styles.pressed]}
    >
      {/* La fila superior lleva la foto y el nombre. Es la parte "identifica a
          quien" y no cambia con la cantidad de texto. */}
      <View style={styles.tarjetaTop}>
        <FotoDocente docente={docente} tamano={64} />
        <View style={styles.tarjetaIdentidad}>
          <Text style={styles.tarjetaNombre} numberOfLines={2}>
            {docente.nombre}
          </Text>
          {docente.cargo ? (
            <Text style={styles.tarjetaCargo} numberOfLines={1}>
              {docente.cargo}
            </Text>
          ) : null}
          <View style={[styles.carreraChip, { backgroundColor: `${color}1a` }]}>
            <Ionicons name="school-outline" size={12} color={color} />
            <Text style={[styles.carreraTexto, { color }]} numberOfLines={1}>
              {docente.carrera || 'Carrera no especificada'}
            </Text>
          </View>
        </View>
      </View>

      {/* El resumen es el texto BREVE. Se recorta porque aqui no cabe la
          biografia entera: para eso esta el boton de abajo. */}
      <Text style={styles.tarjetaResumen} numberOfLines={LINEAS_RESUMEN}>
        {docente.resumen || 'Sin descripcion disponible.'}
      </Text>

      <BotonLeerMas docente={docente} onPress={onPress} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// El boton "Leer mas".
//
// Va dentro de la tarjeta y abre OTRA pagina (no un desplegable dentro de la
// misma): es lo que pidio el enunciado, y ademas tiene una ventaja real. Si el
// texto largo se desplegara en la tarjeta, al abrirla la lista de veinte
// docentes se moveria entera y se perderia el sitio; con una pagina aparte, la
// lista se queda intacta y se vuelve con el boton de atras del sistema.
// ---------------------------------------------------------------------------

export function BotonLeerMas({
  docente,
  onPress,
  compacto = false,
}: {
  docente: Docente;
  onPress?: (docente: Docente) => void;
  /** Version para la ficha, donde el boton va suelto al pie de la pagina. */
  compacto?: boolean;
}) {
  const router = useRouter();
  const color = colorDeFacultad(docente.facultad);
  const handlePress = () => {
    if (onPress) {
      onPress(docente);
      return;
    }
    router.push(`/docente/${docente.id}`);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Leer mas sobre ${docente.nombre}`}
      style={({ pressed }) => [
        styles.botonLeerMas,
        compacto && styles.botonLeerMasCompacto,
        { borderColor: color, backgroundColor: pressed ? `${color}1a` : 'transparent' },
      ]}
    >
      <Text style={[styles.botonLeerMasTexto, { color }]}>Leer mas</Text>
      <Ionicons name="arrow-forward" size={15} color={color} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Chip de filtro. Reutilizable para los botones de carrera y departamento.
//
// Cuando esta seleccionado se rellena con el color de la facultad y el texto se
// pone blanco. El estado se lee de dos formas a la vez (el color Y la palabra
// "Todos") porque en un movil es facil no mirar el color: quien no distingue
// bien verde y gris necesita el texto para saber que filtro esta puesto.
// ---------------------------------------------------------------------------

export function ChipFiltro({
  etiqueta,
  activo,
  onPress,
  color = colors.docentes,
}: {
  etiqueta: string;
  activo: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => [
        styles.chip,
        activo ? { backgroundColor: color, borderColor: color } : null,
        pressed && styles.pressed,
      ]}
    >
      {activo ? <Ionicons name="checkmark" size={13} color="#ffffff" /> : null}
      <Text style={[styles.chipTexto, activo ? styles.chipTextoActivo : null]}>{etiqueta}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Etiqueta de texto con icono, para datos sueltos de la ficha completa
// (departamento, facultad, correo). No usa `InfoTile` de ui.tsx porque aqui las
// etiquetas son de una sola linea y `InfoTile` reserva media rejilla.
// ---------------------------------------------------------------------------

export function EtiquetaDato({
  icono,
  children,
  color,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  children: string;
  color?: string;
}) {
  const tono = color || colors.textSoft;
  return (
    <View style={styles.etiquetaDato}>
      <Ionicons name={icono} size={14} color={tono} />
      <Text style={styles.etiquetaDatoTexto} numberOfLines={2}>
        {children}
      </Text>
    </View>
  );
}

// `Ionicons` se usa en el tipo de `EtiquetaDato` y las etiquetas de texto.

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },

  // --- Foto y avatar -------------------------------------------------------
  foto: { backgroundColor: colors.surfaceMuted },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  iniciales: { fontWeight: '800', letterSpacing: 0.5 },

  // --- Tarjeta -------------------------------------------------------------
  tarjeta: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
    ...shadows.card,
  },
  tarjetaTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tarjetaIdentidad: { flex: 1 },
  tarjetaNombre: { color: colors.text, fontSize: type.value + 2, fontWeight: '800', lineHeight: 22 },
  tarjetaCargo: { color: colors.textSoft, fontSize: type.small + 1, marginTop: 2, fontWeight: '600' },
  carreraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
  carreraTexto: { fontSize: 10, fontWeight: '700', flexShrink: 1 },
  tarjetaResumen: {
    color: colors.textSoft,
    fontSize: type.body - 1,
    lineHeight: 21,
    marginTop: spacing.md,
  },

  // --- Boton "Leer mas" ----------------------------------------------------
  botonLeerMas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  botonLeerMasCompacto: { alignSelf: 'stretch' },
  botonLeerMasTexto: { fontSize: type.small + 2, fontWeight: '800', letterSpacing: 0.3 },

  // --- Chip de filtro ------------------------------------------------------
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 200,
  },
  chipTexto: {
    color: colors.textSoft,
    fontSize: type.small,
    fontWeight: '700',
    flexShrink: 1,
  },
  chipTextoActivo: { color: '#ffffff' },

  // --- Etiqueta de dato ----------------------------------------------------
  etiquetaDato: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  etiquetaDatoTexto: { flex: 1, color: colors.textSoft, fontSize: type.small + 1, fontWeight: '600' },
});