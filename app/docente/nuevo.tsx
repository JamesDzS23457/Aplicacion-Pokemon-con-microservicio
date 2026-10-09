// ---------------------------------------------------------------------------
// PANTALLA: AGREGAR UN DOCENTE
//
// Ruta /docente/nuevo, fuera del grupo (tabs) como la ficha: ocupa la pantalla
// completa y tiene su propio boton de atras. Al guardar (POST) vuelve a la
// lista, que ya trae la tarjeta nueva porque el contexto refresca solo.
//
// No se precarga nada: el formulario arranca vacio y exige el nombre antes de
// llamar al contexto.
// ---------------------------------------------------------------------------

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DocenteForm } from '../../components/DocenteForm';
import { Notice, ScreenHeader } from '../../components/ui';
import { useDocentes } from '../../context/DocentesContext';
import type { DocenteInput } from '../../context/DocentesContext';
import { colors, spacing } from '../../lib/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function NuevoDocenteScreen() {
  const router = useRouter();
  const { crearDocente, cargando, mensaje, tono } = useDocentes();
  const [guardando, setGuardando] = useState(false);

  const guardar = async (datos: DocenteInput) => {
    setGuardando(true);
    const creado = await crearDocente(datos);
    setGuardando(false);
    // crearDocente devuelve null si fallo (y el Notice ya explica el motivo).
    // Solo se sale cuando el docente quedo guardado. Si se entro por enlace
    // directo no hay a donde volver, asi que se reemplaza por la lista en vez
    // de quedarse en el formulario como si no hubiera pasado nada.
    if (creado) {
      if (router.canGoBack()) router.back();
      else router.replace('/docentes');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.barraAtras}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.barraTitulo} numberOfLines={1}>
          Nuevo docente
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Agregar docente"
          subtitle="Completa los datos y pulsa Guardar"
          accent={colors.docentes}
          soft={colors.docentesSoft}
          icon={<MaterialCommunityIcons name="account-plus" size={22} color={colors.docentes} />}
        />

        {mensaje ? <Notice text={mensaje} tone={tono} /> : null}

        <DocenteForm
          etiquetaBoton="Guardar docente"
          guardando={guardando || cargando}
          onSubmit={guardar}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  barraAtras: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barraTitulo: { flex: 1, color: colors.textSoft, fontSize: 18, fontWeight: '800' },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});
