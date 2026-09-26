import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useOnePiece } from '../../context/OnePieceContext';

const FRUIT_COLORS: Record<string, string> = {
  paramecia: '#e85d4a',
  zoan: '#2e8b57',
  logia: '#4a6fe8',
};

function raceIcon(race?: string) {
  const r = (race || '').toLowerCase();
  if (r.includes('pez')) return '🐟';
  if (r.includes('gigante')) return '🗻';
  if (r.includes('mink')) return '🐾';
  if (r.includes('esqueleto')) return '💀';
  if (r.includes('cyborg')) return '🤖';
  if (r.includes('reno')) return '🦌';
  if (r.includes('dragon')) return '🐉';
  return '🧑';
}

export default function OnePieceScreen() {
  const [nombre, setNombre] = useState('Monkey D Luffy');
  const { character, cargando, mensaje, buscarPersonaje } = useOnePiece();
  const buscar = () => buscarPersonaje(nombre);
  const fruitType = character?.fruit?.type?.toLowerCase();
  const fruitColor = (fruitType && FRUIT_COLORS[fruitType]) || '#8a97a0';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Grand Line</Text>
        <Text style={styles.subtitle}>Consulta personajes de One Piece</Text>
        <View style={styles.search}>
          <TextInput style={styles.input} placeholder="Ej. Monkey D Luffy" placeholderTextColor="#777" value={nombre} onChangeText={setNombre} onSubmitEditing={buscar} />
          <Pressable style={styles.button} onPress={buscar}><Text style={styles.buttonText}>✓</Text></Pressable>
        </View>
        {cargando ? (
          <ActivityIndicator size="large" color="#e85d4a" style={{ marginTop: 30 }} />
        ) : character ? (
          <View style={styles.card}>
            <View style={styles.imageWrap}>
              {character.image ? (
                <Image source={{ uri: character.image }} style={styles.image} resizeMode="cover" />
              ) : (
                <Text style={styles.letter}>OP</Text>
              )}
            </View>
            <Text style={styles.name}>{character.name}</Text>

            <View style={styles.miniRow}>
              <View style={styles.miniCard}>
                <View style={[styles.miniIconWrap, { backgroundColor: fruitColor }]}><Text style={styles.miniIconText}>🍈</Text></View>
                <Text style={styles.miniLabel}>Fruta</Text>
              </View>
              <View style={styles.miniCard}>
                <View style={[styles.miniIconWrap, { backgroundColor: '#fff2df' }]}><Text style={styles.miniIconText}>{raceIcon(character.race)}</Text></View>
                <Text style={styles.miniLabel}>Raza</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}><Text style={styles.infoLabel}>Fruta</Text><Text style={styles.infoValue}>{character.fruit?.name ?? 'Ninguna'}{character.fruit?.type ? ` (${character.fruit.type})` : ''}</Text></View>
              <View style={styles.infoItem}><Text style={styles.infoLabel}>Raza</Text><Text style={styles.infoValue}>{character.race}{character.raceEstimated ? ' (estimado)' : ''}</Text></View>
              <View style={styles.infoItem}><Text style={styles.infoLabel}>Tripulacion</Text><Text style={styles.infoValue}>{character.crew?.name ?? '-'}</Text></View>
              <View style={styles.infoItem}><Text style={styles.infoLabel}>Recompensa</Text><Text style={styles.infoValue}>{character.bounty ?? '-'}</Text></View>
              <View style={styles.infoItem}><Text style={styles.infoLabel}>Ocupacion</Text><Text style={styles.infoValue}>{character.job ?? '-'}</Text></View>
              <View style={styles.infoItem}><Text style={styles.infoLabel}>Estado</Text><Text style={styles.infoValue}>{character.status ?? '-'}</Text></View>
            </View>
          </View>
        ) : (
          <View style={styles.card}><Text style={styles.letter}>OP</Text><Text style={styles.name}>Sin personaje seleccionado</Text></View>
        )}
        {mensaje ? <Text style={styles.error}>{mensaje}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff7e8' },
  content: { flexGrow: 1, padding: 20, paddingBottom: 30 },
  title: { color: '#172b35', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#637983', marginTop: 4, marginBottom: 20 },
  search: { flexDirection: 'row', gap: 10, padding: 10, backgroundColor: '#fff', borderRadius: 14 },
  input: { flex: 1, height: 44, borderWidth: 1, borderColor: '#ead8b5', borderRadius: 9, paddingHorizontal: 14, color: '#172b35' },
  button: { width: 44, height: 44, borderRadius: 9, backgroundColor: '#e85d4a', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 24 },
  card: { marginTop: 24, borderRadius: 20, padding: 24, backgroundColor: '#fff', alignItems: 'center' },
  imageWrap: { width: 200, height: 340, borderRadius: 10, backgroundColor: '#fff2df', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 14 },
  image: { width: '100%', height: '100%' },
  letter: { color: '#e85d4a', fontSize: 40, fontWeight: '900' },
  name: { color: '#172b35', fontSize: 23, fontWeight: '800', textAlign: 'center' },
  miniRow: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  miniCard: { flex: 1, alignItems: 'center', backgroundColor: '#faf6ee', borderRadius: 14, padding: 12 },
  miniIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  miniIconText: { fontSize: 24 },
  miniLabel: { color: '#a15c1e', fontSize: 12, fontWeight: '700', marginTop: 6 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20, width: '100%' },
  infoItem: { width: '47%', backgroundColor: '#faf6ee', borderRadius: 12, padding: 12 },
  infoLabel: { color: '#8a97a0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  infoValue: { color: '#172b35', fontSize: 15, fontWeight: '700', marginTop: 4 },
  error: { color: '#c0392b', marginTop: 14, textAlign: 'center' },
});
