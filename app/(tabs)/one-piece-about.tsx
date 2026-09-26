import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useOnePiece } from '../../context/OnePieceContext';

export default function OnePieceDetailsScreen() {
  const { character } = useOnePiece();
  return <ScrollView contentContainerStyle={styles.container}>{character ? <><Text style={styles.title}>{character.name}</Text><View style={styles.panel}><Text>Edad: {character.age || 'N/A'}</Text><Text>Altura: {character.size || 'N/A'}</Text><Text>Especie: {character.race || 'N/A'}</Text><Text>Recompensa: {character.bounty || 'N/A'}</Text><Text>Cargo: {character.job || 'N/A'}</Text><Text>Estado: {character.status || 'N/A'}</Text><Text>Tripulacion: {character.crew?.name || 'N/A'}</Text><Text>Fruta: {character.fruit?.name || 'N/A'}</Text><Text>Tipo de fruta: {character.fruit?.type || 'N/A'}</Text></View><Text style={styles.heading}>Descripcion de la fruta</Text><Text style={styles.text}>{character.fruit?.description || 'Este personaje no tiene una fruta registrada.'}</Text></> : <><Text style={styles.title}>Datos One Piece</Text><Text style={styles.text}>Busca un personaje en One Piece para ver sus datos relevantes.</Text></>}</ScrollView>;
}

const styles = StyleSheet.create({ container: { flexGrow: 1, padding: 24, backgroundColor: '#f7f9fb' }, title: { color: '#20242a', fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 24 }, panel: { gap: 16, padding: 18, borderRadius: 12, backgroundColor: '#fff' }, heading: { color: '#20242a', fontSize: 18, fontWeight: '700', marginTop: 28, marginBottom: 12 }, text: { color: '#4c5963', fontSize: 16, lineHeight: 24 } });
