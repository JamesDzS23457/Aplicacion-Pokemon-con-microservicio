// ---------------------------------------------------------------------------
// PANTALLA: BUSQUEDA DE ONE PIECE
//
// Igual que la de Pokemon, solo habla con el gateway a traves de
// OnePieceContext. La imagen ya viene resuelta en la base de datos (se obtuvo
// en el seed desde Jikan/MyAnimeList), asi que aqui no se sale a internet.
//
// Los textos (tripulacion, oficio, estado, fruta) llegan YA en espanol porque
// el seed los tradujo; la pantalla no traduce nada.
// ---------------------------------------------------------------------------

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  FadeIn,
  Grid,
  InfoTile,
  LoadingCard,
  Notice,
  Pill,
  ScreenHeader,
  SearchBar,
  SectionTitle,
} from '../../components/ui';
import { useOnePiece } from '../../context/OnePieceContext';
import { formatBounty, formatSize } from '../../lib/format';
import { colors, fruitTypeColors, radius, shadows, spacing } from '../../lib/theme';

// Nombre de icono por raza. Sustituye a los emojis del diseno anterior, que se
// veian distintos en cada plataforma. Si la raza no esta en la lista se usa un
// icono generico de persona.
function raceIconName(race?: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const r = (race || '').toLowerCase();
  if (r.includes('pez') || r.includes('triton')) return 'fish';
  if (r.includes('gigante')) return 'image-filter-hdr';
  if (r.includes('mink')) return 'paw';
  if (r.includes('esqueleto')) return 'skull';
  if (r.includes('cyborg')) return 'robot';
  if (r.includes('reno')) return 'paw';
  if (r.includes('dragon')) return 'fire';
  return 'account';
}

// El tipo de fruta puede ser "Zoan Mítica": se usa solo la primera palabra
// ("zoan") para elegir el color, de modo que las variantes compartan color.
function fruitColor(type?: string) {
  const base = (type || '').toLowerCase().split(' ')[0];
  return fruitTypeColors[base] ?? colors.onepiece;
}

export default function OnePieceScreen() {
  const [nombre, setNombre] = useState('Monkey D Luffy');
  const { character, cargando, mensaje, tono, buscarPersonaje } = useOnePiece();
  const buscar = () => buscarPersonaje(nombre);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Grand Line"
          subtitle="Consulta personajes de One Piece"
          accent={colors.onepiece}
          soft={colors.onepieceSoft}
          icon={<MaterialCommunityIcons name="anchor" size={22} color={colors.onepiece} />}
        />

        <SearchBar
          value={nombre}
          onChangeText={setNombre}
          onSubmit={buscar}
          placeholder="Ej. Monkey D Luffy"
          accent={colors.onepiece}
          loading={cargando}
        />

        {mensaje ? <Notice text={mensaje} tone={tono} /> : null}

        {cargando ? <LoadingCard accent={colors.onepiece} label="Buscando personaje..." /> : null}

        {!cargando && character ? (
          <FadeIn key={character.id}>
            <View style={styles.hero}>
              <View style={styles.portrait}>
                {character.image ? (
                  <Image
                    source={{ uri: character.image }}
                    style={styles.portraitImage}
                    resizeMode="contain"
                  />
                ) : (
                  <MaterialCommunityIcons name="account" size={64} color={colors.onepiece} />
                )}
              </View>
              <Text style={styles.heroName}>{character.name}</Text>
              <View style={styles.pillRow}>
                {character.crew?.name ? (
                  <Pill label={character.crew.name} color={colors.onepiece} />
                ) : null}
                {character.crew?.is_yonko ? (
                  <Pill label="Yonko" color={colors.warning} />
                ) : null}
                {character.status ? (
                  <Pill
                    label={character.status}
                    color={character.status === 'Fallecido' ? colors.danger : colors.success}
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={styles.featureTile}>
                <View style={[styles.featureIcon, { backgroundColor: fruitColor(character.fruit?.type) }]}>
                  <Ionicons name="nutrition-outline" size={20} color="#fff" />
                </View>
                <Text style={styles.featureLabel}>Fruta</Text>
                <Text style={styles.featureValue} numberOfLines={2}>
                  {character.fruit?.name || 'Sin fruta'}
                </Text>
              </View>
              <View style={styles.featureTile}>
                <View style={[styles.featureIcon, { backgroundColor: colors.warning }]}>
                  <MaterialCommunityIcons
                    name={raceIconName(character.race)}
                    size={20}
                    color="#fff"
                  />
                </View>
                <Text style={styles.featureLabel}>Raza</Text>
                <Text style={styles.featureValue} numberOfLines={2}>
                  {character.race || 'Sin dato'}
                  {character.raceEstimated ? ' (estimado)' : ''}
                </Text>
              </View>
            </View>

            <SectionTitle title="Informacion" accent={colors.onepiece} />
            <Grid>
              <InfoTile
                icon={<Ionicons name="color-filter-outline" size={18} color={colors.onepiece} />}
                label="Tipo de fruta"
                value={character.fruit?.type || 'Sin fruta'}
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
                label="Ocupacion"
                value={character.job || 'Sin dato'}
                accent={colors.onepiece}
                soft={colors.onepieceSoft}
              />
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
                icon={<Ionicons name="people-outline" size={18} color={colors.onepiece} />}
                label="Tripulacion"
                value={character.crew?.name || 'Sin tripulacion'}
                accent={colors.onepiece}
                soft={colors.onepieceSoft}
              />
            </Grid>

            <View style={styles.hint}>
              <Ionicons name="book-outline" size={18} color={colors.onepieceDark} />
              <Text style={styles.hintText}>
                Abre la pestana Ficha OP para leer la descripcion de la fruta.
              </Text>
            </View>
          </FadeIn>
        ) : null}

        {!cargando && !character && !mensaje ? (
          <EmptyState
            icon={<MaterialCommunityIcons name="anchor" size={34} color={colors.onepiece} />}
            title="Busca un personaje"
            message="Escribe un nombre y pulsa la flecha. Prueba con Luffy, Zoro o Nami."
            accent={colors.onepiece}
            soft={colors.onepieceSoft}
          />
        ) : null}
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

  hero: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#f0dcc9',
    alignItems: 'center',
    ...shadows.card,
  },
  portrait: {
    width: '100%',
    height: 300,
    borderRadius: radius.lg,
    backgroundColor: colors.onepieceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  portraitImage: { width: '100%', height: '100%' },
  heroName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
  },

  featureRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  featureTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.soft,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featureLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featureValue: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 2 },

  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.onepieceSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  hintText: { flex: 1, color: colors.onepieceDark, fontSize: 13, fontWeight: '600' },
});
