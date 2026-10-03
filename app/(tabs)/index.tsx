// ---------------------------------------------------------------------------
// PANTALLA: BUSQUEDA DE POKEMON
//
// Solo se comunica con el gateway a traves de PokemonContext (nunca con
// PokeAPI). Aqui se muestra el resultado de forma visual: identidad, tipos,
// imagen, variantes shiny y los datos basicos en mosaicos.
// ---------------------------------------------------------------------------

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Image, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  FadeIn,
  Grid,
  InfoTile,
  LoadingCard,
  Notice,
  Pill,
  RefreshButton,
  ScreenHeader,
  SearchBar,
  SectionTitle,
} from '../../components/ui';
import { usePokemon } from '../../context/PokemonContext';
import { capitalize, formatHeight, formatWeight } from '../../lib/format';
import { colors, pokemonTypeColors, radius, shadows, spacing } from '../../lib/theme';

export default function HomeScreen() {
  const [nombre, setNombre] = useState('');
  const { pokemon, cargando, mensaje, tono, ultimaBusqueda, buscarPokemon, refrescar } = usePokemon();
  const buscar = () => buscarPokemon(nombre);
  const tipos = (pokemon?.types?.map((t) => t.type?.name).filter(Boolean) as string[]) ?? [];

  // Al volver a esta pestaña se vuelve a consultar el Pokemon que ya se estaba
  // viendo. Motivo: si alguien edita la base de datos mientras el usuario esta
  // en otra pantalla, al regresar aqui debe ver el dato nuevo y no el que se
  // quedo congelado en memoria.
  //
  // `useCallback` es obligatorio porque `useFocusEffect` vuelve a ejecutar el
  // efecto en cada render si recibe una funcion nueva; sin eso entraria en un
  // bucle de peticiones.
  useFocusEffect(
    useCallback(() => {
      if (ultimaBusqueda) refrescar();
      // Solo al entrar en la pantalla: reejecutarlo en cada render pediria los
      // datos sin parar.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ultimaBusqueda]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // Deslizar hacia abajo recarga lo que hay en pantalla. Es la segunda via
        // para ver un cambio hecho en la base de datos, sin usar el boton.
        refreshControl={
          <RefreshControl
            refreshing={cargando}
            onRefresh={refrescar}
            colors={[colors.pokemon]}
            tintColor={colors.pokemon}
          />
        }
      >
        <ScreenHeader
          title="Pokedex"
          subtitle="Consulta tu Pokemon favorito"
          accent={colors.pokemon}
          soft={colors.pokemonSoft}
          icon={<MaterialCommunityIcons name="pokeball" size={22} color={colors.pokemon} />}
        />

        <SearchBar
          value={nombre}
          onChangeText={setNombre}
          onSubmit={buscar}
          placeholder="Nombre del Pokemon"
          accent={colors.pokemon}
          loading={cargando}
        />

        {pokemon && !cargando ? (
          <View style={styles.refreshRow}>
            <RefreshButton
              onPress={refrescar}
              accent={colors.pokemon}
              loading={cargando}
              disabled={!ultimaBusqueda}
            />
          </View>
        ) : null}

        {mensaje ? <Notice text={mensaje} tone={tono} /> : null}

        {cargando ? <LoadingCard accent={colors.pokemon} label="Buscando Pokemon..." /> : null}

        {!cargando && pokemon ? (
          <FadeIn key={pokemon.id}>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <Text style={styles.heroNumber}>#{String(pokemon.id).padStart(3, '0')}</Text>
                <Text style={styles.heroName}>{capitalize(pokemon.name)}</Text>
              </View>

              {tipos.length > 0 ? (
                <View style={styles.pillRow}>
                  {tipos.map((tipo) => (
                    <Pill
                      key={tipo}
                      label={tipo}
                      color={pokemonTypeColors[tipo] ?? colors.textSoft}
                    />
                  ))}
                </View>
              ) : null}

              <View style={styles.imageStage}>
                {pokemon.sprites?.front_default ? (
                  <Image
                    source={{ uri: pokemon.sprites.front_default }}
                    style={styles.heroImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name="image-outline" size={46} color={colors.pokemon} />
                )}
              </View>

              <View style={styles.shinyRow}>
                <View style={styles.shinyCard}>
                  {pokemon.sprites?.front_shiny ? (
                    <Image
                      source={{ uri: pokemon.sprites.front_shiny }}
                      style={styles.shinyImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.shinyPlaceholder}>-</Text>
                  )}
                  <Text style={styles.shinyLabel}>Shiny</Text>
                </View>
                <View style={styles.shinyCard}>
                  {pokemon.sprites?.back_shiny ? (
                    <Image
                      source={{ uri: pokemon.sprites.back_shiny }}
                      style={styles.shinyImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.shinyPlaceholder}>-</Text>
                  )}
                  <Text style={styles.shinyLabel}>Shiny espalda</Text>
                </View>
              </View>
            </View>

            <SectionTitle title="Datos" accent={colors.pokemon} />
            <Grid>
              <InfoTile
                icon={<Ionicons name="resize-outline" size={18} color={colors.pokemon} />}
                label="Altura"
                value={formatHeight(pokemon.height)}
                accent={colors.pokemon}
                soft={colors.pokemonSoft}
              />
              <InfoTile
                icon={<Ionicons name="barbell-outline" size={18} color={colors.pokemon} />}
                label="Peso"
                value={formatWeight(pokemon.weight)}
                accent={colors.pokemon}
                soft={colors.pokemonSoft}
              />
              <InfoTile
                icon={<Ionicons name="male-female-outline" size={18} color={colors.pokemon} />}
                label="Genero"
                value={pokemon.genero || 'Sin dato'}
                accent={colors.pokemon}
                soft={colors.pokemonSoft}
              />
              <InfoTile
                icon={<Ionicons name="leaf-outline" size={18} color={colors.pokemon} />}
                label="Especie"
                value={pokemon.especie || 'Sin dato'}
                accent={colors.pokemon}
                soft={colors.pokemonSoft}
              />
            </Grid>

            <View style={styles.hint}>
              <Ionicons name="list-outline" size={18} color={colors.pokemonDark} />
              <Text style={styles.hintText}>
                Abre la pestana Ficha para ver los {pokemon.moves?.length ?? 0} movimientos.
              </Text>
            </View>
          </FadeIn>
        ) : null}

        {!cargando && !pokemon && !mensaje ? (
          <EmptyState
            icon={<MaterialCommunityIcons name="pokeball" size={34} color={colors.pokemon} />}
            title="Empieza una busqueda"
            message="Escribe el nombre de un Pokemon y pulsa la flecha. Prueba con pikachu, charizard o bulbasaur."
            accent={colors.pokemon}
            soft={colors.pokemonSoft}
          />
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

  // Margen bajo el campo de busqueda para que el boton de refresco no quede
  // pegado a el.
  refreshRow: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },

  hero: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  heroTop: { alignItems: 'center' },
  heroNumber: { color: colors.pokemon, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  heroName: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  imageStage: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.pokemonSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  heroImage: { width: '80%', height: '80%' },

  shinyRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  shinyCard: {
    flex: 1,
    height: 108,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shinyImage: { width: '70%', height: '68%' },
  shinyPlaceholder: { color: colors.textFaint, fontSize: 20 },
  shinyLabel: {
    color: colors.pokemonDark,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.pokemonSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  hintText: { flex: 1, color: colors.pokemonDark, fontSize: 13, fontWeight: '600' },
});
