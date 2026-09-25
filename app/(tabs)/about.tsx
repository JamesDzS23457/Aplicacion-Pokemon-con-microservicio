import { StyleSheet, Text, View } from 'react-native';
import { usePokemon } from '../../context/PokemonContext';

export default function AboutScreen() {
  const { pokemon } = usePokemon();
  const movimientos = pokemon?.moves ?? [];

  return (
    <View style={styles.container}>
      {pokemon ? (
        <>
          <Text style={styles.title}>{pokemon.name.toUpperCase()}</Text>
          <Text style={styles.numero}>#{pokemon.id}</Text>
          <View style={styles.datos}>
            <Text style={styles.etiqueta}>Altura: {pokemon.height}</Text>
            <Text style={styles.etiqueta}>Peso: {pokemon.weight}</Text>
          </View>
          <Text style={styles.subtitulo}>Movimientos</Text>
          {movimientos.slice(0, 2).map((item, index) => (
            <Text key={`${item.move?.name}-${index}`} style={styles.movimiento}>
              {String(index + 1).padStart(2, '0')} {item.move?.name ?? 'N/A'}
            </Text>
          ))}
        </>
      ) : (
        <>
          <Text style={styles.title}>Detalles</Text>
          <Text style={styles.texto}>Busca un Pokemon en Home para ver sus datos aqui.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f7f9fb',
  },
  title: {
    color: '#20242a',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  numero: {
    color: '#159bd3',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 24,
  },
  datos: {
    width: '100%',
    gap: 16,
    padding: 18,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 28,
  },
  etiqueta: {
    color: '#536b75',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitulo: {
    alignSelf: 'flex-start',
    color: '#20242a',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  movimiento: {
    alignSelf: 'flex-start',
    width: '100%',
    color: '#253d47',
    fontSize: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d5e1e5',
  },
  texto: {
    color: '#4c5963',
    fontSize: 16,
    textAlign: 'center',
  },
});
