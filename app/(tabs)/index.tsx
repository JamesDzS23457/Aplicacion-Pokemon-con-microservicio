import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePokemon } from '../../context/PokemonContext';

const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', electric: '#f7d02c',
  grass: '#7ac74c', ice: '#96d9d6', fighting: '#c22e28', poison: '#a33ea1',
  ground: '#e2bf65', flying: '#a98ff3', psychic: '#f95587', bug: '#a6b91a',
  rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc', dark: '#705746',
  steel: '#b7b7ce', fairy: '#d685ad',
};

export default function HomeScreen() {
  const [nombre, setNombre] = useState('');
  const { pokemon, cargando, mensaje, buscarPokemon } = usePokemon();
  const buscar = () => buscarPokemon(nombre);
  const tipos = pokemon?.types?.map((t) => t.type?.name).filter(Boolean) as string[] | undefined;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}><View><Text style={styles.title}>Pokedex</Text><Text style={styles.subtitle}>Consulta tu Pokemon favorito</Text></View><Text style={styles.badge}>P</Text></View>
        <View style={styles.search}><TextInput style={styles.input} placeholder="Nombre del Pokemon" placeholderTextColor="#777" value={nombre} onChangeText={setNombre} onSubmitEditing={buscar} autoCapitalize="none" /><Pressable style={styles.button} onPress={buscar}><Text style={styles.buttonText}>✓</Text></Pressable></View>
        {pokemon ? <View style={styles.identity}><Text style={styles.number}>#{pokemon.id}</Text><Text style={styles.name}>{pokemon.name.toUpperCase()}</Text></View> : null}
        {tipos && tipos.length > 0 ? (
          <View style={styles.typeRow}>
            {tipos.map((tipo) => (
              <View key={tipo} style={[styles.typeChip, { backgroundColor: TYPE_COLORS[tipo] ?? '#68737c' }]}>
                <Text style={styles.typeChipText}>{tipo.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.imageCard}>
          {cargando ? (
            <ActivityIndicator size="large" color="#159bd3" />
          ) : pokemon ? (
            <Image source={{ uri: pokemon.sprites?.front_default ?? undefined }} style={styles.image} resizeMode="contain" />
          ) : (
            <Text style={styles.placeholder}>Imagen</Text>
          )}
        </View>
        {pokemon ? (
          <View style={styles.miniRow}>
            <View style={styles.miniCard}>
              {pokemon.sprites?.front_shiny ? <Image source={{ uri: pokemon.sprites.front_shiny }} style={styles.miniImage} resizeMode="contain" /> : <Text style={styles.miniPlaceholder}>-</Text>}
              <Text style={styles.miniLabel}>Shiny</Text>
            </View>
            <View style={styles.miniCard}>
              {pokemon.sprites?.back_shiny ? <Image source={{ uri: pokemon.sprites.back_shiny }} style={styles.miniImage} resizeMode="contain" /> : <Text style={styles.miniPlaceholder}>-</Text>}
              <Text style={styles.miniLabel}>Shiny espalda</Text>
            </View>
          </View>
        ) : null}
        {mensaje ? <Text style={styles.error}>{mensaje}</Text> : null}
        <View style={styles.cards}><View style={styles.card}><Text style={styles.cardIcon}>I</Text><Text style={styles.cardLabel}>Altura</Text><Text style={styles.cardValue}>{pokemon?.height ?? '-'}</Text></View><View style={styles.card}><Text style={styles.cardIcon}>W</Text><Text style={styles.cardLabel}>Peso</Text><Text style={styles.cardValue}>{pokemon?.weight ?? '-'}</Text></View></View>
        <View style={[styles.cards, { marginTop: 12 }]}><View style={[styles.card, styles.cardWide]}><Text style={styles.cardIcon}>G</Text><Text style={styles.cardLabel}>Genero</Text><Text style={styles.cardValue}>{pokemon?.genero ?? '-'}</Text></View></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#eef5f8' }, content: { flexGrow: 1, padding: 20, paddingBottom: 30 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }, title: { color: '#172b35', fontSize: 30, fontWeight: '800' }, subtitle: { color: '#637983', fontSize: 14, marginTop: 3 }, badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f2b84b', color: '#fff', fontSize: 25, fontWeight: '800', lineHeight: 44, textAlign: 'center' }, search: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: '#fff', marginBottom: 22 }, input: { flex: 1, height: 44, borderWidth: 1, borderColor: '#d5e1e5', borderRadius: 9, backgroundColor: '#f8fbfc', paddingHorizontal: 14, fontSize: 15, color: '#172b35' }, button: { width: 44, height: 44, borderRadius: 9, backgroundColor: '#e85d4a', alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 24, fontWeight: '700' }, identity: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 10 }, typeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }, typeChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }, typeChipText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }, cardWide: { flex: 1 }, miniRow: { flexDirection: 'row', gap: 12, marginTop: 12 }, miniCard: { flex: 1, height: 100, borderRadius: 14, borderWidth: 1, borderColor: '#c8e2eb', backgroundColor: '#dff3fa', alignItems: 'center', justifyContent: 'center', paddingBottom: 6 }, miniImage: { width: '70%', height: '70%' }, miniPlaceholder: { color: '#8fb9c9', fontSize: 20 }, miniLabel: { color: '#159bd3', fontSize: 11, fontWeight: '700', marginTop: 2 }, number: { color: '#159bd3', fontSize: 18, fontWeight: '700' }, name: { color: '#172b35', fontSize: 18, fontWeight: '800' }, imageCard: { height: 260, borderRadius: 20, borderWidth: 1, borderColor: '#c8e2eb', backgroundColor: '#dff3fa', alignItems: 'center', justifyContent: 'center' }, image: { width: '90%', height: '90%' }, placeholder: { color: '#159bd3' }, error: { color: '#c0392b', backgroundColor: '#fde9e5', borderRadius: 9, padding: 10, textAlign: 'center', marginTop: 12 }, cards: { flexDirection: 'row', gap: 12, marginTop: 24 }, card: { flex: 1, minHeight: 112, borderRadius: 12, padding: 12, backgroundColor: '#fff', alignItems: 'center' }, cardIcon: { color: '#e85d4a', fontSize: 24, fontWeight: '800' }, cardLabel: { color: '#637983', fontSize: 13, marginTop: 5 }, cardValue: { color: '#172b35', fontSize: 15, fontWeight: '700', marginTop: 5 } });
