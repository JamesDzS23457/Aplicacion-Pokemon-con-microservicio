// ---------------------------------------------------------------------------
// PANTALLA: FICHA DE POKEMON
//
// Muestra el detalle completo del Pokemon que se busco en la pantalla
// anterior. Comparte el PokemonContext, asi que no hace ninguna peticion
// propia: solo lee el estado que ya esta cargado.
// ---------------------------------------------------------------------------

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  FadeIn,
  Grid,
  InfoTile,
  Notice,
  Pill,
  ScreenHeader,
  SectionTitle,
} from '../../components/ui';
import { usePokemon } from '../../context/PokemonContext';
import { capitalize, formatHeight, formatWeight, prettyMove } from '../../lib/format';
import { colors, pokemonTypeColors, radius, shadows, spacing } from '../../lib/theme';

export default function PokemonDetailsScreen() {
  const { pokemon } = usePokemon();
  const moves = pokemon?.moves ?? [];
  const tipos = (pokemon?.types?.map((t) => t.type?.name).filter(Boolean) as string[]) ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={pokemon ? capitalize(pokemon.name) : 'Ficha Pokemon'}
          subtitle={pokemon ? `Numero ${String(pokemon.id).padStart(3, '0')}` : 'Detalle del Pokemon'}
          accent={colors.pokemon}
          soft={colors.pokemonSoft}
          icon={<Ionicons name="stats-chart" size={22} color={colors.pokemon} />}
        />

        {pokemon ? (
          <FadeIn key={pokemon.id}>
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

            <SectionTitle title="Caracteristicas" accent={colors.pokemon} />
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

            <SectionTitle
              title="Movimientos"
              accent={colors.pokemon}
              right={String(moves.length)}
            />
            {moves.length > 0 ? (
              <View style={styles.moveWrap}>
                {moves.map((item, index) => (
                  <View key={`${item.move?.name}-${index}`} style={styles.moveChip}>
                    <Text style={styles.moveText}>{prettyMove(item.move?.name)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Notice text="Este Pokemon no tiene movimientos registrados." tone="info" />
            )}
          </FadeIn>
        ) : (
          <EmptyState
            icon={<MaterialCommunityIcons name="pokeball" size={34} color={colors.pokemon} />}
            title="Todavia sin datos"
            message="Busca un Pokemon en la pestana Pokemon y aqui veras su ficha completa."
            accent={colors.pokemon}
            soft={colors.pokemonSoft}
          />
        )}
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

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  moveWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  moveChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.soft,
  },
  moveText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
