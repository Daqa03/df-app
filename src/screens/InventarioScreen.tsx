import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Button, ActivityIndicator, Image, TouchableOpacity, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../supabase';

export default function InventarioScreen() {
  const [codigoSku, setCodigoSku] = useState('');
  const [nombreProd, setNombreProd] = useState('');
  const [costoProd, setCostoProd] = useState('');
  const [precioMayor, setPrecioMayor] = useState('');
  const [precioDetal, setPrecioDetal] = useState('');
  const [stockProd, setStockProd] = useState('');
  
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 1. Función para abrir la galería
  const seleccionarImagen = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Cuadrado perfecto para e-commerce
      quality: 0.5, // Comprimimos un poco para no saturar la base de datos
    });

    if (!result.canceled) {
      setImagenUri(result.assets[0].uri);
    }
  };

  // 2. Función para subir a Supabase Storage
  const subirImagenASupabase = async (uri: string) => {
    try {
      // Convertimos la imagen a un formato que Supabase entienda (Blob)
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Creamos un nombre único para el archivo
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Subimos al bucket
      const { data, error } = await supabase.storage
        .from('productos_img')
        .upload(fileName, blob);

      if (error) throw error;

      // Obtenemos la URL pública
      const { data: publicUrlData } = supabase.storage
        .from('productos_img')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error("Error subiendo imagen:", error);
      return null;
    }
  };

  const guardarProducto = async () => {
    if (!nombreProd || !costoProd || !precioDetal || !stockProd) return alert('Llena los datos básicos del producto.');
    setSaving(true);
    
    try {
      let imageUrlFinal = null;
      
      // Si el usuario seleccionó una foto, la subimos primero
      if (imagenUri) {
        imageUrlFinal = await subirImagenASupabase(imagenUri);
      }

      // Guardamos en la base de datos
      const { error } = await supabase.from('productos').insert([{
        codigo_sku: codigoSku,
        nombre: nombreProd,
        costo_cop: parseFloat(costoProd),
        precio_mayor_cop: parseFloat(precioMayor || '0'),
        precio_detal_cop: parseFloat(precioDetal),
        stock_actual: parseInt(stockProd),
        imagen_url: imageUrlFinal // <--- Guardamos el link
      }]);
      
      if (error) throw error;
      
      alert('¡Producto agregado al inventario!');
      // Limpiamos todo
      setCodigoSku(''); setNombreProd(''); setCostoProd(''); setPrecioMayor(''); setPrecioDetal(''); setStockProd(''); setImagenUri(null);
    } catch (error) {
      alert('Error al guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ width: '100%', maxWidth: 400 }}>
      <View style={styles.card}>
        <Text style={styles.title}>Nuevo Producto</Text>

        {/* --- SECCIÓN DE FOTO --- */}
        <View style={styles.imageSection}>
          {imagenUri ? (
            <Image source={{ uri: imagenUri }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={{color: '#9CA3AF'}}>📷 Sin foto</Text>
            </View>
          )}
          <TouchableOpacity style={styles.imageBtn} onPress={seleccionarImagen}>
            <Text style={styles.btnTextWhite}>{imagenUri ? 'Cambiar Foto' : 'Subir Foto'}</Text>
          </TouchableOpacity>
        </View>

        {/* --- FORMULARIO NORMAL --- */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Código / SKU:</Text>
          <TextInput style={styles.input} value={codigoSku} onChangeText={setCodigoSku} placeholder="Ej: DF-001" />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre del Producto:</Text>
          <TextInput style={styles.input} value={nombreProd} onChangeText={setNombreProd} placeholder="Ej: Base Glow" />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Costo (COP):</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={costoProd} onChangeText={setCostoProd} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Precio Detal (COP):</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={precioDetal} onChangeText={setPrecioDetal} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Precio Mayor (COP):</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={precioMayor} onChangeText={setPrecioMayor} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Stock:</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={stockProd} onChangeText={setStockProd} />
        </View>
        
        {saving ? <ActivityIndicator size="large" color="#0E793C" /> : <Button title="Guardar Producto" onPress={guardarProducto} color="#0E793C" />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#F9FAFB' },
  imageSection: { alignItems: 'center', marginBottom: 20 },
  imagePreview: { width: 120, height: 120, borderRadius: 10, marginBottom: 10 },
  imagePlaceholder: { width: 120, height: 120, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  imageBtn: { backgroundColor: '#374151', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  btnTextWhite: { color: '#fff', fontWeight: 'bold' }
});