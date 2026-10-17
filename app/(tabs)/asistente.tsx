// ---------------------------------------------------------------------------
// PANTALLA: ASISTENTE DE IA  (sexta pestana)
//
// Es el chat de la Actividad en Clase 13. Una conversacion estilo ChatGPT con
// una IA PUBLICA (Google Gemini) que responde sobre los datos de la app.
//
// DOS FASES DEL ENUNCIADO, en el interruptor de arriba:
//   - "Solo mi base de datos": la IA solo responde de los Pokemon, los
//     personajes de One Piece y los docentes que estan en la base de la app.
//     Fuera de eso, contesta: "No estoy programada para dar ese tipo de
//     preguntas."
//   - "Abierto": responde cualquier pregunta (primera fase de la actividad).
//
// La pantalla NO habla con la IA ni con los microservicios: solo con el
// AsistenteContext, que a su vez solo habla con el gateway. La clave de la IA
// vive en el servidor.
// ---------------------------------------------------------------------------

import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing, type } from '../../lib/theme';
import { useAsistente } from '../../context/AsistenteContext';
import { Notice, ScreenHeader } from '../../components/ui';
import {
  BurbujaChat,
  ChipSugerencia,
  EntradaChat,
  IndicadorEscribiendo,
  SelectorModo,
} from '../../components/chat';

// Ejemplos que se ofrecen al principio. Salen de los datos REALES de la app
// (un Pokemon, un personaje y la cuenta de la Pokedex), para que la primera
// pregunta siempre caiga dentro del contexto.
const SUGERENCIAS = [
  '¿Que tipos tiene Pikachu?',
  '¿Quien es Luffy?',
  '¿Que fruta del diablo tiene Luffy?',
  '¿Cuantos Pokemon hay en la Pokedex?',
];

export default function AsistenteScreen() {
  const { mensajes, cargando, modo, mensaje, tono, preguntar, limpiar, cambiarModo } = useAsistente();
  const [texto, setTexto] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Solo se muestran las sugerencias al principio (cuando aun no se pregunto
  // nada). Despues ocuparian espacio util de la conversacion.
  const mostrarSugerencias = mensajes.length <= 1 && !cargando;

  const enviar = () => {
    const pregunta = texto.trim();
    if (!pregunta || cargando) return;
    setTexto('');
    preguntar(pregunta);
  };

  const acento = colors.asistente;
  const suave = colors.asistenteSoft;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.cabecera}>
          <ScreenHeader
            title="Asistente"
            subtitle="Pregunta sobre los datos de la app (IA)"
            accent={acento}
            soft={suave}
            icon={<Ionicons name="sparkles" size={20} color={acento} />}
          />
          <SelectorModo modo={modo} onChange={cambiarModo} accent={acento} soft={suave} />
          {mensaje ? <Notice text={mensaje} tone={tono} /> : null}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {mensajes.map((m) => (
            <BurbujaChat key={m.id} mensaje={m} accent={acento} soft={suave} />
          ))}
          {cargando ? <IndicadorEscribiendo accent={acento} soft={suave} /> : null}

          {mostrarSugerencias ? (
            <View style={styles.sugerencias}>
              <Text style={styles.sugerenciasTitulo}>Puedes empezar con:</Text>
              <View style={styles.sugerenciasFila}>
                {SUGERENCIAS.map((s) => (
                  <ChipSugerencia
                    key={s}
                    label={s}
                    onPress={() => preguntar(s)}
                    accent={acento}
                    soft={suave}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.pie}>
          <EntradaChat
            value={texto}
            onChangeText={setTexto}
            onSend={enviar}
            cargando={cargando}
            accent={acento}
          />
          <View style={styles.pieAcciones}>
            <Text style={styles.pieNota}>
              {modo === 'abierto'
                ? 'Modo abierto: responde cualquier pregunta.'
                : 'Solo responde con informacion de la base de datos de la app.'}
            </Text>
            {mensajes.length > 1 ? (
              <Text style={styles.limpiar} onPress={limpiar}>
                Limpiar
              </Text>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  cabecera: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  lista: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  sugerencias: { marginTop: spacing.sm },
  sugerenciasTitulo: {
    color: colors.textSoft,
    fontSize: type.small,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  sugerenciasFila: { flexDirection: 'row', flexWrap: 'wrap' },
  pie: {
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  pieAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  pieNota: { flex: 1, color: colors.textFaint, fontSize: 11, paddingRight: spacing.sm },
  limpiar: { color: colors.asistenteDark, fontSize: type.small, fontWeight: '800' },
});
