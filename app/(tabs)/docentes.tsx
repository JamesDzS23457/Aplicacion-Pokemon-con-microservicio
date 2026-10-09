// ---------------------------------------------------------------------------
// PANTANA: DOCENTES DE UNINPAHU  (quinta pestana)
//
// Es la unica pantalla de la app que muestra una LISTA. Pokemon y One Piece
// preguntan por un nombre y enseñan una ficha; esta pregunta por la lista
// completa y deja que se filtre.
//
// Lo que se ve aqui, por docente:
//   - la FOTO (o un avatar con sus iniciales, si no hay foto guardada),
//   - un RESUMEN breve de una linea o dos, y
//   - el boton "Leer mas", que abre app/docente/[id].tsx con la descripcion
//     COMPLETA.
//
// Esa division (breve aqui, completo alla) es el requisito del enunciado, y por
// eso son dos campos distintos en la base de datos y no el mismo texto cortado
// en dos sitios: `resumen` y `biografia`.
//
// La pantalla no consulta nada por su cuenta: todo pasa por DocentesContext, que
// es el unico que habla con el gateway.
// ---------------------------------------------------------------------------

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChipFiltro, TarjetaDocente } from '../../components/docentes';
import {
  EmptyState,
  LoadingCard,
  Notice,
  RefreshButton,
  ScreenHeader,
  SearchBar,
  SectionTitle,
} from '../../components/ui';
import type { Docente } from '../../context/DocentesContext';
import { useDocentes } from '../../context/DocentesContext';
import { colors, radius, spacing } from '../../lib/theme';

export default function DocentesScreen() {
  const router = useRouter();
  const {
    docentes,
    total,
    filtros,
    facetas,
    cargando,
    mensaje,
    tono,
    vacio,
    filtrar,
    refrescar,
    cargarFacetas,
  } = useDocentes();

  // El texto que se esta escribiendo se guarda aparte del filtro aplicado. Si se
  // escribiera directamente en el contexto, cada tecla dispararia una peticion
  // al gateway. Se envia al pulsar la flecha (o al terminar de escribir).
  const [texto, setTexto] = useState(filtros.q);

  const buscar = () => filtrar({ q: texto });

  /**
   * Abre la ficha completa.
   *
   * Se pasa SOLO el id por la ruta y no el docente entero. Es lo que obliga a que
   * la pagina de detalle vuelva a pedir el dato al microservicio: si se
   * pasara el objeto entero, la ficha se dibujaria con informacion ya cargada
   * en memoria y no se verian los cambios hechos en la base. Ademas mantiene el
   * requisito del enunciado, que es que el dato entre por un PATH PARAM.
   */
  const abrirFicha = (docente: Docente) => router.push(`/docente/${docente.id}`);

  // Al volver a esta pestaña se vuelve a pedir el listado. Motivo: si alguien
  // agrega o borra un docente directamente en Supabase mientras el usuario esta
  // en otra pantalla, al regresar aqui debe verse el cambio y no la lista que se
  // quedo congelada en memoria.
  //
  // Se recargan tambien las facetas porque los botones de filtro de carrera y
  // departamento salen de ellas: un docente nuevo con una carrera nueva tiene
  // que poder filtrarse, y sin recargarlas ese boton no existiria.
  //
  // POR QUE LAS FUNCIONES VAN EN UN REF Y NO EN LAS DEPENDENCIAS:
  // `refrescar` se recrea cada vez que cambian los filtros (los lleva en el
  // cierre). Si fuera una dependencia, cambiar un filtro reejecutaria este efecto
  // y haria una peticion de mas ademas de la que ya lanza el contexto. Y si se
  // dejara fuera con `[]`, el cierre quedaria apuntando al PRIMER `refrescar`,
  // con los filtros vacios: al refrescar se perderian los filtros aplicados. Con
  // un ref se usan siempre las funciones mas recientes y el efecto se ejecuta
  // solo al ganar el foco.
  const refrescarRef = useRef(refrescar);
  refrescarRef.current = refrescar;
  const facetasRef = useRef(cargarFacetas);
  facetasRef.current = cargarFacetas;

  // El provider ya pide el listado al montar (esta por encima de las pestanas),
  // asi que el primer foco no tiene que volver a pedirlo o la app arrancaria con
  // dos peticiones identicas.
  const primerFoco = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (primerFoco.current) {
        primerFoco.current = false;
        return;
      }
      void refrescarRef.current();
      void facetasRef.current();
    }, []),
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={cargando}
            onRefresh={refrescar}
            colors={[colors.docentes]}
            tintColor={colors.docentes}
          />
        }
      >
        <ScreenHeader
          title="Docentes"
          subtitle="Docentes de la Universidad Privada Uninpahu"
          accent={colors.docentes}
          soft={colors.docentesSoft}
          icon={<MaterialCommunityIcons name="account-school" size={22} color={colors.docentes} />}
        />

        <SearchBar
          value={texto}
          onChangeText={setTexto}
          onSubmit={buscar}
          placeholder="Buscar docente por nombre"
          accent={colors.docentes}
          loading={cargando}
        />

        {/* Boton de refresco explicito. El pull-to-refresh de arriba tambien
            sirve, pero aqui se ve que la lista se puede volver a pedir, y no
            depende de que el usuario descubra el gesto de deslizar. */}
        <View style={styles.refreshRow}>
          <RefreshButton
            onPress={() => {
              void refrescar();
              void cargarFacetas();
            }}
            accent={colors.docentes}
            loading={cargando}
            label="Actualizar"
          />
          {/* Alta de docentes (POST). Va al lado de Actualizar porque las dos
              son acciones sobre la lista entera, no sobre una tarjeta: una
              vuelve a pedir lo que hay y la otra agrega lo que falta. */}
          <Pressable
            onPress={() => router.push('/docente/nuevo')}
            accessibilityRole="button"
            accessibilityLabel="Agregar un docente nuevo"
            style={({ pressed }) => [
              styles.botonNuevo,
              { backgroundColor: colors.docentes },
              pressed && styles.botonNuevoPressed,
            ]}
          >
            <MaterialCommunityIcons name="account-plus" size={16} color="#ffffff" />
            <Text style={styles.botonNuevoTexto}>Nuevo</Text>
          </Pressable>
        </View>

        {/* Fila de filtros por carrera. Solo aparece si el servicio devolvio
            carreras: mostrar un desplegable vacio es peor que no mostrarlo. */}
        {facetas.carrera.length > 0 ? (
          <>
            <SectionTitle title="Carrera" accent={colors.docentes} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <ChipFiltro
                etiqueta="Todas"
                activo={!filtros.carrera}
                onPress={() => filtrar({ carrera: '', q: texto })}
              />
              {facetas.carrera.map((carrera) => (
                <ChipFiltro
                  key={carrera}
                  etiqueta={carrera}
                  activo={filtros.carrera === carrera}
                  onPress={() =>
                    // Volver a pulsar la misma carrera la desactiva: es la forma
                    // de volver a "ver todas" sin buscar el chip "Todas" a mano.
                    filtrar({ carrera: filtros.carrera === carrera ? '' : carrera, q: texto })
                  }
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        {mensaje ? <Notice text={mensaje} tone={tono} /> : null}

        {cargando ? <LoadingCard accent={colors.docentes} label="Cargando docentes..." /> : null}

        {!cargando && docentes.length > 0 ? (
          <>
            <SectionTitle
              title={filtros.q || filtros.carrera ? 'Resultados' : 'Todos los docentes'}
              accent={colors.docentes}
              // El total viene SIN paginar del microservicio, asi que el contador
              // es real ("6 de 20") y no el numero de tarjetas que hay en
              // pantalla. Con un filtro puesto se nota la diferencia, y sin
              // mentira: dice que hay mas y que se puede filtrar.
              right={`${docentes.length} de ${total}`}
            />
            {docentes.map((docente) => (
              <TarjetaDocente key={docente.id} docente={docente} onPress={abrirFicha} />
            ))}
          </>
        ) : null}

        {!cargando && vacio ? (
          filtros.q || filtros.carrera ? (
            <EmptyState
              icon={<MaterialCommunityIcons name="account-search" size={34} color={colors.docentes} />}
              title="Sin resultados"
              message={`Ningun docente coincide con "${filtros.q || filtros.carrera}". Prueba con otra carrera o con menos letras.`}
              accent={colors.docentes}
              soft={colors.docentesSoft}
            />
          ) : (
            <EmptyState
              icon={<MaterialCommunityIcons name="account-school" size={34} color={colors.docentes} />}
              title="Aun no hay docentes"
              message="La base de datos esta vacia. Los docentes se agregan desde el Table Editor de Supabase,"
              accent={colors.docentes}
              soft={colors.docentesSoft}
            />
          )
        ) : null}

        {/* Nota al pie. Antes decia que los datos eran de ejemplo: ya no es asi,
            la tabla contiene a la persona real de la que se dio autorizacion. Lo
            que se conserva es el aviso de que la foto puede faltar, porque
            `foto_url` es opcional y la app dibuja iniciales cuando no hay
            imagen o la URL falla (algunos CDN de fotos de perfil responden 403). */}
        {docentes.length > 0 ? (
          <View style={styles.notaPie}>
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.textFaint} />
            <Text style={styles.notaPieTexto}>
              Los datos vienen del microservicio de docentes. Si un docente no tiene
              foto, la tarjeta muestra sus iniciales.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  // Margen bajo el campo de busqueda para el boton de refresco.
  refreshRow: { marginTop: spacing.md, marginBottom: spacing.lg, flexDirection: 'row', gap: spacing.sm },
  botonNuevo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  botonNuevoPressed: { opacity: 0.85 },
  botonNuevoTexto: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  chips: { gap: spacing.xs, paddingRight: spacing.md },
  notaPie: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notaPieTexto: { flex: 1, color: colors.textFaint, fontSize: 11, lineHeight: 16 },
});