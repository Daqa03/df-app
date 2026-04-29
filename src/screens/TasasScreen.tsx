import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Button, ActivityIndicator } from 'react-native';
import { supabase } from '../../supabase'; // Subimos dos niveles para encontrar supabase.ts

export default function TasasScreen() {
  const [tasaUSD, setTasaUSD] = useState('');
  const [tasaVES, setTasaVES] = useState('');
  const [saving, setSaving] = useState(false);

  const guardarTasas = async () => {
    if (!tasaUSD || !tasaVES) return alert('Ingresa ambas tasas.');
    setSaving(true);
    try {
      await supabase.from('tasas_cambio').insert([{ moneda: 'USD', tasa_en_cop: parseFloat(tasaUSD) }]);
      await supabase.from('tasas_cambio').insert([{ moneda: 'VES', tasa_en_cop: parseFloat(tasaVES) }]);
      alert('¡Tasas guardadas con éxito!');
      setTasaUSD(''); setTasaVES('');
    } catch (error) {
      alert('Error al guardar tasas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tasas Diarias</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>💵 1 Dólar (USD) en COP:</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={tasaUSD} onChangeText={setTasaUSD} />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>🇻🇪 1 Bolívar (VES) en COP:</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={tasaVES} onChangeText={setTasaVES} />
      </View>
      {saving ? <ActivityIndicator size="large" color="#0E793C" /> : <Button title="Guardar Tasas" onPress={guardarTasas} color="#0E793C" />}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#F9FAFB' },
});