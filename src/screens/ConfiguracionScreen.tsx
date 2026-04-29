import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, Switch, useWindowDimensions } from 'react-native';
import { supabase } from '../../supabase';

export default function ConfiguracionScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // --- Estados de Tasas ---
  const [tasaUSD, setTasaUSD] = useState('');
  const [tasaVES, setTasaVES] = useState('');
  const [savingTasas, setSavingTasas] = useState(false);

  // --- Estados de Preferencias (Simulados para el UI) ---
  const [nombre, setNombre] = useState('Fabiola Sanchez');
  const [correo, setCorreo] = useState('contacto@dfcosmetics.com');
  const [notificaciones, setNotificaciones] = useState(true);

  useEffect(() => {
    const fetchTasas = async () => {
      const { data } = await supabase.from('tasas_cambio').select('*');
      if (data) {
        const usd = data.find(t => t.moneda === 'USD');
        const ves = data.find(t => t.moneda === 'VES');
        if (usd) setTasaUSD(usd.tasa_en_cop.toString());
        if (ves) setTasaVES(ves.tasa_en_cop.toString());
      }
    };
    fetchTasas();
  }, []);

  const guardarTasas = async () => {
    setSavingTasas(true);
    try {
      await supabase.from('tasas_cambio').upsert([
        { moneda: 'USD', tasa_en_cop: parseFloat(tasaUSD) },
        { moneda: 'VES', tasa_en_cop: parseFloat(tasaVES) }
      ], { onConflict: 'moneda' });
      alert('Tasas actualizadas correctamente');
    } catch (error) {
      alert('Error al actualizar las tasas');
    } finally {
      setSavingTasas(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, isMobile && styles.containerMobile]} showsVerticalScrollIndicator={false}>
      
      {/* CABECERA */}
      <View style={styles.header}>
        <Text style={styles.mainTitle}>Configuración</Text>
        <Text style={styles.subTitle}>Gestiona las tasas de cambio para las conversiones automáticas del sistema.</Text>
      </View>

      {/* TARJETA 1: TASAS DE CAMBIO */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.iconText}>🔄</Text>
          <Text style={styles.cardTitle}>Tasas de Cambio Diarias</Text>
        </View>
        <Text style={styles.cardDesc}>Actualiza las tasas de conversión para las transacciones del día.</Text>
        
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>TASA USD A COP</Text>
          <View style={styles.inputWithPrefix}>
            <Text style={styles.prefix}>$</Text>
            <TextInput 
              style={[styles.inputInner, {outlineStyle: 'none'} as any]} 
              value={tasaUSD} 
              onChangeText={setTasaUSD} 
              keyboardType="numeric" 
            />
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>TASA VES A COP</Text>
          <View style={styles.inputWithPrefix}>
            <Text style={styles.prefix}>Bs</Text>
            <TextInput 
              style={[styles.inputInner, {outlineStyle: 'none'} as any]} 
              value={tasaVES} 
              onChangeText={setTasaVES} 
              keyboardType="numeric" 
            />
          </View>
        </View>

        <View style={styles.rightAlignContainer}>
          <TouchableOpacity style={styles.vinotintoBtn} onPress={guardarTasas} disabled={savingTasas}>
            {savingTasas ? <ActivityIndicator color="#FFF" /> : <Text style={styles.vinotintoBtnText}>Guardar Tasas</Text>}
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 30, width: '100%', maxWidth: 600, alignSelf: 'center', paddingBottom: 100 },
  containerMobile: { padding: 15, paddingBottom: 80 }, 
  
  header: { marginBottom: 30 },
  mainTitle: { fontSize: 32, fontWeight: '900', color: '#6B0D23', marginBottom: 8 },
  subTitle: { fontSize: 15, color: '#4B5563', lineHeight: 22 },

  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 25, marginBottom: 25, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  iconText: { fontSize: 24 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  cardDesc: { fontSize: 14, color: '#4B5563', marginBottom: 20, lineHeight: 20 },

  inputWrapper: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: '#1A1A1A', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  inputWithPrefix: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 15, height: 50 },
  prefix: { fontSize: 16, color: '#6B7280', marginRight: 10, fontWeight: '500' },
  inputInner: { flex: 1, fontSize: 16, color: '#1A1A1A' },
  
  rightAlignContainer: { alignItems: 'flex-end', marginTop: 5 },
  vinotintoBtn: { backgroundColor: '#6B0D23', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12, minWidth: 140, alignItems: 'center' },
  vinotintoBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});