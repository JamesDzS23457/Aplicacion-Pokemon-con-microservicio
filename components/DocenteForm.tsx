// ---------------------------------------------------------------------------
// FORMULARIO DE DOCENTE (crear y editar)
//
// Un solo formulario para las dos pantallas: `nuevo` lo usa vacio y `editar` lo
// usa precargado. Es el mismo caso que el contrato del backend, donde POST y
// PUT aceptan los mismos campos: si se duplicara el formulario, un campo nuevo
// habria que añadirlo en dos sitios.
//
// Es "tonto" como el resto de components: guarda el texto que se escribe y al
// pulsar Guardar entrega los datos al padre, que es quien habla con el
// contexto (y este con el gateway). Lo unico que valida aqui es lo que se
// puede saber sin red: que el nombre no venga vacio. El resto (duplicados,
// email mal formado, tabla llena) lo dice el servicio y lo muestra el padre
// con el Notice del contexto.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing, type } from '../lib/theme';
import type { DocenteInput } from '../context/DocentesContext';

/** Los campos del formulario, tal cual los escribe el usuario. */
export type ValoresFormulario = {
  nombre: string;
  cargo: string;
  departamento: string;
  carrera: string;
  facultad: string;
  email: string;
  foto_url: string;
  resumen: string;
  biografia: string;
  areas: string;
  formacion: string;
};

/** Convierte un docente (o nada) en valores editables del formulario. */
export function valoresIniciales(inicial?: DocenteInput): ValoresFormulario {
  return {
    nombre: inicial?.nombre ?? '',
    cargo: inicial?.cargo ?? '',
    departamento: inicial?.departamento ?? '',
    carrera: inicial?.carrera ?? '',
    facultad: inicial?.facultad ?? '',
    email: inicial?.email ?? '',
    foto_url: inicial?.foto_url ?? '',
    resumen: inicial?.resumen ?? '',
    biografia: inicial?.biografia ?? '',
    areas: (inicial?.areas ?? []).join('\n'),
    formacion: (inicial?.formacion ?? []).join('\n'),
  };
}

/**
 * Convierte lo escrito en el formulario al objeto que espera el contexto.
 *
 * Las listas se mandan como arrays (una linea = un elemento); las lineas
 * vacias se quitan aqui para no guardar basura en la base.
 */
export function valoresADatos(valores: ValoresFormulario): DocenteInput {
  const lineas = (texto: string) =>
    texto
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '');
  return {
    nombre: valores.nombre.trim(),
    cargo: valores.cargo.trim(),
    departamento: valores.departamento.trim(),
    carrera: valores.carrera.trim(),
    facultad: valores.facultad.trim(),
    email: valores.email.trim(),
    foto_url: valores.foto_url.trim(),
    resumen: valores.resumen.trim(),
    biografia: valores.biografia.trim(),
    areas: lineas(valores.areas),
    formacion: lineas(valores.formacion),
  };
}

function Campo({
  etiqueta,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  autoCapitalize = 'sentences',
}: {
  etiqueta: string;
  value: string;
  onChangeText: (texto: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        style={[styles.entrada, multiline && styles.entradaMultilinea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

export function DocenteForm({
  inicial,
  etiquetaBoton,
  guardando,
  onSubmit,
}: {
  /** Datos precargados (editar) o nada (crear). */
  inicial?: DocenteInput;
  /** Texto del boton, p. ej. "Guardar docente" o "Guardar cambios". */
  etiquetaBoton: string;
  /** Si true, el boton muestra espera y se desactiva. */
  guardando: boolean;
  /** Recibe los datos ya convertidos. El padre decide si es POST o PUT. */
  onSubmit: (datos: DocenteInput) => void;
}) {
  const [valores, setValores] = useState<ValoresFormulario>(() => valoresIniciales(inicial));
  const [aviso, setAviso] = useState('');

  const poner = (clave: keyof ValoresFormulario) => (texto: string) => {
    setValores((anterior) => ({ ...anterior, [clave]: texto }));
    if (aviso) setAviso('');
  };

  const guardar = () => {
    if (!valores.nombre.trim()) {
      setAviso('El nombre es obligatorio.');
      return;
    }
    onSubmit(valoresADatos(valores));
  };

  return (
    <View>
      <Campo etiqueta="Nombre *" value={valores.nombre} onChangeText={poner('nombre')}
        placeholder="Nombre completo" autoCapitalize="words" />
      <Campo etiqueta="Cargo" value={valores.cargo} onChangeText={poner('cargo')}
        placeholder="p. ej. Profesor Titular" />
      <Campo etiqueta="Carrera" value={valores.carrera} onChangeText={poner('carrera')}
        placeholder="p. ej. Ingenieria en Sistemas" />
      <Campo etiqueta="Departamento" value={valores.departamento} onChangeText={poner('departamento')}
        placeholder="p. ej. Departamento de Matematica" />
      <Campo etiqueta="Facultad" value={valores.facultad} onChangeText={poner('facultad')}
        placeholder="p. ej. Facultad de Ingenieria" />
      <Campo etiqueta="Email" value={valores.email} onChangeText={poner('email')}
        placeholder="nombre@uninpahu.edu.py" keyboardType="email-address" autoCapitalize="none" />
      <Campo etiqueta="URL de la foto" value={valores.foto_url} onChangeText={poner('foto_url')}
        placeholder="https://... (opcional)" keyboardType="url" autoCapitalize="none" />
      <Campo etiqueta="Resumen breve" value={valores.resumen} onChangeText={poner('resumen')}
        placeholder="Lo que se ve en la tarjeta" multiline />
      <Campo etiqueta="Biografia completa" value={valores.biografia} onChangeText={poner('biografia')}
        placeholder="Lo que se ve en la ficha" multiline />
      <Campo etiqueta="Areas (una por linea)" value={valores.areas} onChangeText={poner('areas')}
        placeholder={'Modelado numerico\nMetodos numericos'} multiline />
      <Campo etiqueta="Formacion (una por linea)" value={valores.formacion} onChangeText={poner('formacion')}
        placeholder={'Doctor en Matematica\nLicenciatura en Fisica'} multiline />

      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

      <Pressable
        onPress={guardar}
        disabled={guardando}
        accessibilityRole="button"
        accessibilityLabel={etiquetaBoton}
        style={({ pressed }) => [
          styles.boton,
          pressed && !guardando && styles.pressed,
          guardando && styles.botonApagado,
        ]}
      >
        {guardando ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.botonTexto}>{etiquetaBoton}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  campo: { marginTop: spacing.md },
  etiqueta: {
    color: colors.text,
    fontSize: type.small + 1,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  entrada: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: type.body,
    color: colors.text,
    minHeight: 44,
  },
  entradaMultilinea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  aviso: {
    color: colors.danger,
    fontSize: type.small + 1,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  boton: {
    marginTop: spacing.xl,
    backgroundColor: colors.docentes,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  botonApagado: { opacity: 0.6 },
  botonTexto: { color: '#ffffff', fontSize: type.body, fontWeight: '800' },
});
