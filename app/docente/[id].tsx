// ---------------------------------------------------------------------------
// PAGINA: FICHA COMPLETA DE UN DOCENTE
//
// Esta pantalla NO esta dentro del grupo (tabs), asi que ocupa la pantalla
// completa y tiene su propio boton de atras. Es lo que pide el enunciado: la
// quinta pestana muestra foto + resumen breve, y al pulsar "Leer mas" se abre
// OTRA pagina con la foto y la descripcion completa.
//
// ---------------------------------------------------------------------------
// POR QUE LA RUTA LLEVA SOLO EL ID
// ---------------------------------------------------------------------------
// La ruta es `/docente/7`. El objeto entero NO viaja en la URL, por dos motivos:
//
//   - Por el requisito del enunciado: el dato entra por un PATH PARAM, nunca por
//     un cuerpo ni por una query gigante. Meter veinte campos codificados en la
//     URL seria justo lo contrario de lo que pide el trabajo.
//   - Por arquitectura: si la pantalla recibiera el docente entero por la ruta,
//     podria saltarse la peticion y se quedaria con datos viejos. Preguntando
//     por id, la ficha SIEMPRE esta al dia.
//
// Para no partir de una pantalla en blanco, el docente se busca en la lista que
// el DocentesProvider ya tiene cargada (ese provider esta por ENCIMA del Stack,
// justamente para esto). Ese docente solo sirve como estado INICIAL: la peticion
// se hace igual y, si el microservicio devuelve otra cosa, lo reemplaza. Asi la
// ficha se pinta al instante y aun asi refleja el estado real de la base.
// blanco mientras responde y aun asi refleja el estado real de la base.
// ---------------------------------------------------------------------------

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState, LoadingCard, Notice, Pill, SectionTitle } from '../../components/ui';
import { BotonLeerMas, FotoDocente, EtiquetaDato, colorDeFacultad } from '../../components/docentes';
import { useDocentes } from '../../context/DocentesContext';
import type { Docente } from '../../context/DocentesContext';
import { colors, radius, shadows, spacing, type } from '../../lib/theme';

export default function FichaDocenteScreen() {
  const router = useRouter();
  const { obtenerDocente, docentes } = useDocentes();
  // `id` llega como string: expo-router lo entrega desde la ruta, no desde
  // Typescript. `Number` de "abc" da NaN, y eso se comprueba abajo.
  const { id } = useLocalSearchParams<{ id: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [docente, setDocente] = useState<Docente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [tono, setTono] = useState<'error' | 'info'>('error');

  // El docente que la pestana ya tiene en memoria, para pintar sin parpadeo. Se
  // busca por id en vez de pasarlo por la ruta: es la misma informacion sin
  // meterla en la URL. Puede ser null si se entra por un enlace directo, y en
  // ese caso no pasa nada: se pide al microservicio.
  const enMemoria = docentes.find((d) => d.id === Number(id)) ?? null;

  const cargar = useCallback(async () => {
    const numerico = Number(id);
    // Sin esta comprobacion, `obtenerDocente(NaN)` construiria la URL
    // "/api/docentes/NaN" y el microservicio responderia 400 con un mensaje
    // poco claro. Aqui se rechaza antes y se explica en espanol.
    if (!Number.isInteger(numerico) || numerico < 1) {
      setCargando(false);
      setTono('error');
      setMensaje('La direccion de la ficha no es valida.');
      return;
    }
    setCargando(true);
    const encontrado = await obtenerDocente(numerico);
    if (encontrado) {
      setDocente(encontrado);
      setMensaje('');
    }
    setCargando(false);
  }, [id, obtenerDocente]);

  useEffect(() => {
    // Estado inicial desde la lista ya cargada, y despues `cargar` la refresca
    // contra el microservicio. Si `enMemoria` es null (entrada directa por URL)
    // se arranca en blanco hasta que llegue la respuesta, que es lo correcto.
    setDocente(enMemoria);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    void cargar();
    // `enMemoria` cambia de identidad en cada render; depender de el provocaria
    // un bucle. Solo interesa recargar al cambiar de docente (o sea, de id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const color = colorDeFacultad(docente?.facultad);

  if (!docente && !cargando) {
    // Sin docente y sin estar cargando: o el id no existe (404) o la direccion
    // es invalida. En los dos casos no hay nada que mostrar, asi que se da el
    // boton de volver en vez de una ficha a medio rellenar.
    return (
      <View style={styles.vacio}>
        <StatusBar style="dark" />
        <View style={styles.barraAtras}>
          <BotonAtras onPress={() => router.back()} />
        </View>
        <EmptyState
          icon={<MaterialCommunityIcons name="account-off" size={34} color={colors.docentes} />}
          title="Docente no encontrado"
          message={
            mensaje ||
            `No hay ningun docente con el id ${id}. Puede que se haya borrado de la base de datos.`
          }
          accent={colors.docentes}
          soft={colors.docentesSoft}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Barra propia de esta pagina. La de las pestanas no aparece aqui porque
          esta pantalla esta FUERA del grupo (tabs): es una pagina completa y
          necesita su propio boton de atras, ademas del gesto del sistema. */}
      <View style={styles.barraAtras}>
        <BotonAtras onPress={() => router.back()} />
        <Text style={styles.barraTitulo} numberOfLines={1}>
          Ficha del docente
        </Text>
      </View>

      {docente ? (
        <>
          {/* --- Encabezado fijo con la foto grande ---------------------------- */}
          <View style={styles.heroFijo}>
            <FotoDocente docente={docente} tamano={128} />
            <Text style={styles.heroNombre}>{docente.nombre}</Text>
            {docente.cargo ? <Text style={styles.heroCargo}>{docente.cargo}</Text> : null}
            <View style={styles.pillRow}>
              {docente.facultad ? <Pill label={docente.facultad} color={color} /> : null}
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={cargando}
                onRefresh={cargar}
                colors={[colors.docentes]}
                tintColor={colors.docentes}
              />
            }
          >
            {mensaje ? <Notice text={mensaje} tone={tono} /> : null}
            {cargando && !docente ? (
              <LoadingCard accent={colors.docentes} label="Cargando ficha..." />
            ) : null}

            {/* --- Datos de contacto y ubicacion ---------------------------- */}
            <View style={styles.tarjetaDatos}>
              {docente.carrera ? (
                <EtiquetaDato icono="school-outline" color={color}>
                  {docente.carrera}
                </EtiquetaDato>
              ) : null}
              {docente.departamento ? (
                <EtiquetaDato icono="business-outline">{docente.departamento}</EtiquetaDato>
              ) : null}
              {docente.email ? (
                <EtiquetaDato icono="mail-outline">{docente.email}</EtiquetaDato>
              ) : null}
            </View>

            {/* --- La descripcion COMPLETA ---------------------------------- */}
            <SectionTitle title="Descripcion completa" accent={colors.docentes} />
            <View style={styles.tarjetaTexto}>
              <Text style={styles.biografia}>{docente.biografia || 'Sin biografia disponible.'}</Text>
            </View>

            {/* --- Areas de trabajo ----------------------------------------- */}
            {docente.areas && docente.areas.length > 0 ? (
              <>
                <SectionTitle title="Areas de trabajo" accent={colors.docentes} />
                <View style={styles.pillRowIzquierda}>
                  {docente.areas.map((area) => (
                    <Pill key={area} label={area} color={colors.docentesDark} />
                  ))}
                </View>
              </>
            ) : null}

            {/* --- Formacion ------------------------------------------------ */}
            {docente.formacion && docente.formacion.length > 0 ? (
              <>
                <SectionTitle title="Formacion" accent={colors.docentes} />
                <View style={styles.tarjetaTexto}>
                  {docente.formacion.map((titulo) => (
                    <View key={titulo} style={styles.lineaFormacion}>
                      <Ionicons name="school" size={16} color={colors.docentes} />
                      <Text style={styles.formacionTexto}>{titulo}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {/* --- Resumen, al pie y en pequeño ---------------------------- */}
            {docente.resumen ? (
              <View style={styles.resumenPie}>
                <Text style={styles.resumenPieEtiqueta}>EN UNA LINEA</Text>
                <Text style={styles.resumenPieTexto}>{docente.resumen}</Text>
              </View>
            ) : null}

            <BotonLeerMas docente={docente} compacto />
          </ScrollView>
        </>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={cargando}
              onRefresh={cargar}
              colors={[colors.docentes]}
              tintColor={colors.docentes}
            />
          }
        >
          {mensaje ? <Notice text={mensaje} tone={tono} /> : null}
          {cargando && !docente ? (
            <LoadingCard accent={colors.docentes} label="Cargando ficha..." />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Boton de atras.
 *
 * Se define aqui y no se importa de ui.tsx porque es el primero de la app que
 * necesita uno: ninguna de las cuatro pantallas anteriores tiene barra superior
 * (la de las pestanas la pone el navegador). Va con `accessibilityLabel` porque
 * un boton solo con flecha no le dice nada a un lector de pantalla.
 */
function BotonAtras({ onPress }: { onPress: () => void }) {
  return (
    <Ionicons
      name="arrow-back"
      size={24}
      color={colors.text}
      accessibilityRole="button"
      accessibilityLabel="Volver"
      onPress={onPress}
      style={styles.botonAtras}
    />
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
  botonAtras: { padding: spacing.xs },
  barraTitulo: { flex: 1, color: colors.textSoft, fontSize: type.sectionTitle, fontWeight: '800' },

  vacio: { flex: 1, backgroundColor: colors.background },

  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
  },

  heroFijo: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    ...shadows.card,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.card,
  },
  heroNombre: {
    color: colors.text,
    fontSize: type.cardTitle - 2,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 30,
  },
  heroCargo: {
    color: colors.textSoft,
    fontSize: type.body,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  pillRowIzquierda: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  tarjetaDatos: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    ...shadows.soft,
  },

  tarjetaTexto: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  biografia: { color: colors.text, fontSize: type.body, lineHeight: 24 },

  lineaFormacion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  formacionTexto: { flex: 1, color: colors.text, fontSize: type.body - 1, lineHeight: 21 },

  resumenPie: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.docentesSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.docentes}33`,
  },
  resumenPieEtiqueta: {
    color: colors.docentesDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  resumenPieTexto: {
    color: colors.docentesDark,
    fontSize: type.body - 1,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
});