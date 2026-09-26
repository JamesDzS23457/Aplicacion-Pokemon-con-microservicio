import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { usePokemon } from '../../context/PokemonContext';

export default function HomeScreen() {
  const [nombre, setNombre] = useState('');
  const { pokemon, cargando, mensaje, buscarPokemon } = usePokemon();

  const movimientos = pokemon?.moves ?? [];
  const primerMovimiento = movimientos[0]?.move?.name ?? 'N/A';
  const segundoMovimiento = movimientos[1]?.move?.name ?? 'N/A';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.encabezado}>
          <View>
            <Text style={styles.titulo}>Pokedex</Text>
            <Text style={styles.subtitulo}>Busca tu Pokemon favorito</Text>
          </View>
          <Text style={styles.simbolo}>P</Text>
        </View>

        <View style={styles.filaBusqueda}>
          <TextInput
            style={styles.input}
            placeholder="Nombre del Pokemon"
            placeholderTextColor="#777"
            value={nombre}
            onChangeText={setNombre}
            onSubmitEditing={() => buscarPokemon(nombre)}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <Pressable
            style={styles.botonConfirmar}
            onPress={() => buscarPokemon(nombre)}
            accessibilityLabel="Confirmar busqueda"
          >
            <Text style={styles.iconoConfirmar}>✓</Text>
          </Pressable>
        </View>

        {pokemon ? (
          <View style={styles.identidadPokemon}>
            <Text style={styles.numeroPokemon}>#{pokemon.id}</Text>
            <Text style={styles.nombrePokemon}>{pokemon.name.toUpperCase()}</Text>
          </View>
        ) : null}

        <View style={styles.tarjetaImagen}>
          {cargando ? (
            <ActivityIndicator size="large" color="#159bd3" />
          ) : pokemon ? (
            <Image
              source={{ uri: pokemon.sprites?.front_default ?? undefined }}
              style={styles.imagenPokemon}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.textoImagen}>Imagen</Text>
          )}
        </View>

        {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}

        <View style={styles.filaTarjetas}>
          <View style={styles.tarjetaExtra}>
            <Text style={styles.iconoTarjeta}>G</Text>
            <Text style={styles.etiquetaTarjeta}>Genero</Text>
            <Text style={styles.valorTarjeta}>{pokemon?.gender ?? '-'}</Text>
          </View>
          <View style={styles.tarjetaExtra}>
            <Text style={styles.iconoTarjeta}>E</Text>
            <Text style={styles.etiquetaTarjeta}>Elemento</Text>
            <Text style={styles.valorTarjeta}>
              {pokemon?.types?.map((item) => item.type?.name).filter(Boolean).join(' / ') ?? '-'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef5f8',
  },
  contenido: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 30,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  titulo: {
    color: '#172b35',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitulo: {
    color: '#637983',
    fontSize: 14,
    marginTop: 3,
  },
  simbolo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f2b84b',
    color: '#fff',
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 44,
    textAlign: 'center',
  },
  filaBusqueda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#19343f',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 22,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#d5e1e5',
    borderRadius: 9,
    backgroundColor: '#f8fbfc',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#172b35',
  },
  botonConfirmar: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: '#e85d4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoConfirmar: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  tarjetaImagen: {
    height: 260,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c8e2eb',
    backgroundColor: '#dff3fa',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#19343f',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  identidadPokemon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  numeroPokemon: {
    color: '#159bd3',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  nombrePokemon: {
    color: '#172b35',
    fontSize: 18,
    fontWeight: '800',
  },
  imagenPokemon: {
    width: '90%',
    height: '90%',
  },
  textoImagen: {
    color: '#159bd3',
    fontSize: 14,
  },
  mensaje: {
    color: '#c0392b',
    backgroundColor: '#fde9e5',
    borderRadius: 9,
    padding: 10,
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
  filaTarjetas: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  tarjetaExtra: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    minHeight: 112,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#19343f',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  iconoTarjeta: {
    color: '#e85d4a',
    fontSize: 24,
    fontWeight: '800',
  },
  etiquetaTarjeta: {
    color: '#637983',
    fontSize: 13,
    marginTop: 5,
  },
  valorTarjeta: {
    color: '#172b35',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 5,
  },
});
