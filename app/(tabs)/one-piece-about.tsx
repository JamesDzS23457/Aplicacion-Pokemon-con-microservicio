// ---------------------------------------------------------------------------
// PANTALLA: FICHA DE ONE PIECE
//
// Detalle completo del personaje elegido en la pantalla anterior. Comparte el
// OnePieceContext, asi que tampoco hace peticiones: reutiliza lo ya cargado.
//
// La descripcion de la fruta se muestra en su idioma original: es un texto
// largo proveniente de la API y, por decision del proyecto, no se traduce.
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
import { useOnePiece } from '../../context/OnePieceContext';
import { formatBounty, formatSize } from '../../lib/format';
import { colors, radius, shadows, spacing } from '../../lib/theme';

export default function OnePieceDetailsScreen() {
  const { character } = useOnePiece();
  const vivo = character?.status !== 'Fallecido';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={character ? character.name : 'Ficha One Piece'}
          subtitle={character ? 'Detalle del personaje' : 'Datos relevantes'}
          accent={colors.onepiece}
          soft={colors.onepieceSoft}
          icon={<Ionicons name="reader" size={22} color={colors.onepiece} />}
        />

        {character ? (
          <FadeIn key={character.id}>
            <View style={styles.pillRow}>
              {character.crew?.name ? (
                <Pill label={character.crew.name} color={colors.onepiece} />
              ) : null}
              {character.crew?.is_yonko ? <Pill label="Yonko" color={colors.warning} /> : null}
              {character.status ? (
                <Pill
                  label={character.status}
                  color={vivo ? colors.success : colors.danger}
                />
              ) : null}
            </View>

            <SectionTitle title="Datos" accent={colors.onepiece} />
            <Grid>
              <InfoTile
                icon={<Ionicons name="calendar-outline" size={18} color={colors.onepiece} />}
                label="Edad"
                value={character.age || 'Sin dato'}
                accent={colors.onepiece}
                soft={colors.onepieceSoft}
              />
              <InfoTile
                icon={<Ionicons name="resize-outline" size={18} color={colors.onepiece} />}
                label="Altura"
                value={formatSize(character.size)}
                accent={colors.onepiece}
                soft={colors.onepieceSoft}
              />
              <InfoTile
                icon={<Ionicons name="cash-outline" size={18} color={colors.onepiece} />}
                label="Recompensa"
                value={formatBounty(character.bounty)}
                accent={colors.onepiece}
                soft={colors.onepieceSoft}
              />
              <InfoTile
                icon={<Ionicons name="briefcase-outline" size={18} color={colors.onepiece} />}
                label="Cargo"
                value={character.job || 'Sin dato'}
                accent={colors.onepiece}
                soft={colors.onepieceSoft}
              />
              <InfoTile
                icon={<Ionicons name="people-outline" size={18} color={colors.onepiece} />}
                label="Tripulacion"
                value={character.crew?.name || 'Sin tripulacion'}
                accent={colors.onepiece}
                soft={colors.onepieceSoft}
              />
              <InfoTile
                icon={<Ionicons name="globe-outline" size={18} color={colors.onepiece} />}
                label="Raza"
                value={`${character.race || 'Sin dato'}${character.raceEstimated ? ' (estimado)' : ''}`}
                accent={colors.onepiece}
                soft={colors.onepieceSoft}
              />
              <InfoTile
                icon={<Ionicons name="nutrition-outline" size={18} color={colors.onepiece} />}
                label="Fruta"
                value={character.fruit?.name || 'Sin fruta'}
                accent={colors.onepiece}
                soft={colors.onepieceSoft}
              />
              <InfoTile
                icon={<Ionicons name="color-filter-outline" size={18} color={colors.onepiece} />}
                label="Tipo de fruta"
                value={character.fruit?.type || 'Sin fruta'}
                accent={colors.onepiece}
                soft={colors.onepieceSoft}
              />
            </Grid>

            <SectionTitle title="Descripcion de la fruta" accent={colors.onepiece} />
            {character.fruit?.description ? (
              <View style={styles.descriptionCard}>
                <View style={styles.descriptionIcon}>
                  <MaterialCommunityIcons
                    name="book-open-page-variant"
                    size={20}
                    color={colors.onepiece}
                  />
                </View>
                <Text style={styles.descriptionText}>{character.fruit.description}</Text>
              </View>
            ) : (
              <Notice text="Este personaje no tiene una fruta registrada." tone="info" />
            )}
          </FadeIn>
        ) : (
          <EmptyState
            icon={<MaterialCommunityIcons name="anchor" size={34} color={colors.onepiece} />}
            title="Todavia sin datos"
            message="Busca un personaje en la pestana One Piece y aqui veras su ficha completa."
            accent={colors.onepiece}
            soft={colors.onepieceSoft}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundWarm },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  descriptionCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#f0dcc9',
    padding: spacing.lg,
    ...shadows.soft,
  },
  descriptionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.onepieceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  descriptionText: {
    flex: 1,
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 23,
  },
});
