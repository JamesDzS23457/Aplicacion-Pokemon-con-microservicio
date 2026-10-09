// ---------------------------------------------------------------------------
// PANTALLA: EDITAR UN DOCENTE
//
// Ruta /docente/editar?id=7, fuera del grupo (tabs) como la ficha y como
// "nuevo". El id viaja en la query (?id=) y los datos se piden al servicio por
// path param, igual que la ficha: la pantalla nunca confia en lo que venga en
// la URL para pintar.
//
// Al guardar (PUT) vuelve a la ficha, que al recuperar el foco vuelve a pedir
// el dato y muestra los cambios sin recargar a mano.
// ---------------------------------------------------------------------------

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DocenteForm } from '../../components/DocenteForm';
import { EmptyState, LoadingCard, Notice, ScreenHeader } from '../../components/ui';
import { useDocentes } from '../../context/DocentesContext';
import type { Docente, DocenteInput } from '../../context/DocentesContext';
import { colors, spacing } from '../../lib/theme';

export default function EditarDocenteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { obtenerDocente, actualizarDocente, cargando, mensaje, tono } = useDocentes();

  const [docente, setDocente] = useState<Docente | null>(null);
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const numerico = Number(id);
      if (!Number.isInteger(numerico) || numerico < 1) {
        if (vivo) setListo(true);
        return;
      }
      const encontrado = await obtenerDocente(numerico);
      if (vivo) {
        setDocente(encontrado);
        setListo(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, obtenerDocente]);

  const guardar = async (datos: DocenteInput) => {
    if (!docente) return;
    setGuardando(true);
    const actualizado = await actualizarDocente(docente.id, datos);
    setGuardando(false);
    // Igual que en nuevo: si no hay a donde volver (enlace directo), se va a
    // la ficha del docente en vez de quedarse en el formulario.
    if (actualizado) {
      if (router.canGoBack()) router.back();
      else router.replace(`/docente/${docente.id}`);
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
          Editar docente
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Editar docente"
          subtitle={docente ? docente.nombre : 'Cargando datos...'}
          accent={colors.docentes}
          soft={colors.docentesSoft}
          icon={<MaterialCommunityIcons name="account-edit" size={22} color={colors.docentes} />}
        />

        {mensaje ? <Notice text={mensaje} tone={tono} /> : null}

        {!listo || (cargando && !docente) ? (
          <LoadingCard accent={colors.docentes} label="Cargando datos..." />
        ) : null}

        {listo && !docente ? (
          <EmptyState
            icon={<MaterialCommunityIcons name="account-off" size={34} color={colors.docentes} />}
            title="Docente no encontrado"
            message={`No hay ningun docente con el id ${id}. Puede que se haya borrado.`}
            accent={colors.docentes}
            soft={colors.docentesSoft}
          />
        ) : null}

        {docente ? (
          <DocenteForm
            key={docente.id}
            inicial={docente}
            etiquetaBoton="Guardar cambios"
            guardando={guardando || cargando}
            onSubmit={guardar}
          />
        ) : null}
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
