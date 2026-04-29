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
        <Text style={styles.subTitle}>Gestiona tus preferencias, tasas de cambio y perfil de usuario.</Text>
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

      {/* TARJETA 2: PERFIL DE USUARIO */}
      <View style={styles.card}>
        <View style={styles.profileCenter}>
          <View style={styles.avatarCircle}>
            <Text style={{fontSize: 40}}>👩🏻‍💻</Text>
          </View>
          <Text style={styles.profileName}>{nombre}</Text>
          <Text style={styles.profileRole}>Administradora Principal</Text>
          <TouchableOpacity style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>Cambiar Foto</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TARJETA 3: PREFERENCIAS GENERALES */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.iconText}>🎛️</Text>
          <Text style={styles.cardTitle}>Preferencias Generales</Text>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>NOMBRE COMPLETO</Text>
          <TextInput 
            style={[styles.inputStandard, {outlineStyle: 'none'} as any]} 
            value={nombre} 
            onChangeText={setNombre} 
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
          <TextInput 
            style={[styles.inputStandard, {outlineStyle: 'none'} as any]} 
            value={correo} 
            onChangeText={setCorreo} 
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>IDIOMA DEL SISTEMA</Text>
          {/* Simulando un Dropdown con un TextInput estático por ahora */}
          <View style={styles.dropdownFake}>
            <Text style={styles.dropdownText}>Español (Latinoamérica)</Text>
            <Text style={{color: '#9CA3AF'}}>▼</Text>
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={{flex: 1, paddingRight: 15}}>
            <Text style={styles.switchTitle}>Notificaciones por Email</Text>
            <Text style={styles.switchDesc}>Recibir alertas de stock bajo y reportes diarios.</Text>
          </View>
          <Switch 
            trackColor={{ false: '#E5E7EB', true: '#6B0D23' }}
            thumbColor={'#FFF'}
            onValueChange={setNotificaciones}
            value={notificaciones}
          />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.vinotintoBtnLarge}>
            <Text style={styles.vinotintoBtnText}>Guardar Cambios</Text>
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 30, width: '100%', maxWidth: 600, alignSelf: 'center', paddingBottom: 100 },
  containerMobile: { padding: 15, paddingBottom: 80 }, // Menos padding en celular
  
  // CABECERA
  header: { marginBottom: 30 },
  mainTitle: { fontSize: 32, fontWeight: '900', color: '#6B0D23', marginBottom: 8 },
  subTitle: { fontSize: 15, color: '#4B5563', lineHeight: 22 },

  // TARJETAS
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 25, marginBottom: 25, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  iconText: { fontSize: 24 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  cardDesc: { fontSize: 14, color: '#4B5563', marginBottom: 20, lineHeight: 20 },

  // INPUTS CON PREFIJO (MONEDAS)
  inputWrapper: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: '#1A1A1A', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  inputWithPrefix: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 15, height: 50 },
  prefix: { fontSize: 16, color: '#6B7280', marginRight: 10, fontWeight: '500' },
  inputInner: { flex: 1, fontSize: 16, color: '#1A1A1A' },
  
  // INPUT NORMAL
  inputStandard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 15, height: 50, fontSize: 16, color: '#1A1A1A' },

  // DROPDOWN FAKE
  dropdownFake: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 15, height: 50 },
  dropdownText: { fontSize: 16, color: '#1A1A1A' },

  // SWITCH
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  switchTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  switchDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // PERFIL
  profileCenter: { alignItems: 'center', paddingVertical: 10 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  profileName: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 5 },
  profileRole: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  outlineBtn: { borderWidth: 1, borderColor: '#6B0D23', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 12, width: '100%', alignItems: 'center' },
  outlineBtnText: { color: '#6B0D23', fontWeight: '700', fontSize: 15 },

  // BOTONES ACCIÓN
  rightAlignContainer: { alignItems: 'flex-end', marginTop: 5 },
  vinotintoBtn: { backgroundColor: '#6B0D23', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12, minWidth: 140, alignItems: 'center' },
  vinotintoBtnLarge: { backgroundColor: '#6B0D23', paddingVertical: 14, paddingHorizontal: 25, borderRadius: 12, flex: 1, alignItems: 'center' },
  vinotintoBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 15 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12 },
  cancelBtnText: { color: '#4B5563', fontWeight: 'bold', fontSize: 15 }
});