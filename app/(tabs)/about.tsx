import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePokemon } from '../../context/PokemonContext';

export default function PokemonDetailsScreen() {
  const { pokemon } = usePokemon();
  const moves = pokemon?.moves ?? [];
  return <ScrollView contentContainerStyle={styles.container}>{pokemon ? <><Text style={styles.title}>{pokemon.name.toUpperCase()}</Text><Text style={styles.number}>#{pokemon.id}</Text><View style={styles.panel}><Text>Altura: {pokemon.height}</Text><Text>Peso: {pokemon.weight}</Text><Text>Especie: {pokemon.especie || 'N/A'}</Text></View><Text style={styles.heading}>Movimientos ({moves.length})</Text>{moves.map((item, index) => <Text key={`${item.move?.name}-${index}`} style={styles.row}>{String(index + 1).padStart(2, '0')} {item.move?.name ?? 'N/A'}</Text>)}</> : <><Text style={styles.title}>Datos Pokemon</Text><Text style={styles.text}>Busca un Pokemon en Home para ver sus datos.</Text></>}</ScrollView>;
}

const styles = StyleSheet.create({ container: { flexGrow: 1, padding: 24, backgroundColor: '#f7f9fb' }, title: { color: '#20242a', fontSize: 28, fontWeight: '700', textAlign: 'center' }, number: { color: '#159bd3', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 24 }, panel: { gap: 16, padding: 18, borderRadius: 12, backgroundColor: '#fff', marginBottom: 28 }, heading: { color: '#20242a', fontSize: 18, fontWeight: '700', marginBottom: 12 }, row: { color: '#253d47', fontSize: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#d5e1e5' }, text: { color: '#4c5963', fontSize: 16, textAlign: 'center', marginTop: 18 } });
