import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TextInput, TouchableOpacity, Image, useWindowDimensions, Modal, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../supabase';

type TipoVista = 'grid' | 'list' | 'compact';

export default function ListaProductosScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [vista, setVista] = useState<TipoVista>('list');
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- PAGINACIÓN Y BÚSQUEDA ---
  const [busqueda, setBusqueda] = useState('');
  const [filtroOrden, setFiltroOrden] = useState('nombre_asc');
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const ITEMS_PER_PAGE = 12;

  // --- ESTADOS: MODAL NUEVO PRODUCTO ---
  const [modalVisible, setModalVisible] = useState(false);
  const [nSku, setNSku] = useState('');
  const [nNombre, setNNombre] = useState('');
  const [nCosto, setNCosto] = useState('');
  const [nPrecioDetal, setNPrecioDetal] = useState('');
  const [nPrecioMayor, setNPrecioMayor] = useState('');
  const [nStock, setNStock] = useState('');
  const [nImagenUri, setNImagenUri] = useState<string | null>(null);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

  // --- ESTADOS: EDICIÓN INLINE ---
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [sku, setSku] = useState('');
  const [nombre, setNombre] = useState('');
  const [costo, setCosto] = useState('');
  const [precioDetal, setPrecioDetal] = useState('');
  const [precioMayor, setPrecioMayor] = useState('');
  const [stock, setStock] = useState('');
  const [imagenUrlEdit, setImagenUrlEdit] = useState<string | null>(null);
  const [nuevaImagenUri, setNuevaImagenUri] = useState<string | null>(null);

  // --- ESTADOS: MODAL REABASTECER (COMPRA) ---
  const [reabastecerModal, setReabastecerModal] = useState(false);
  const [rProductoActivo, setRProductoActivo] = useState<any>(null);
  const [rCantidad, setRCantidad] = useState('');
  const [rCostoTotal, setRCostoTotal] = useState('');
  const [guardandoReabastecimiento, setGuardandoReabastecimiento] = useState(false);

  const numColumns = vista === 'grid' ? (width > 1024 ? 4 : width > 768 ? 3 : 2) : 1;

  const cargarProductos = async () => {
    setLoading(true);
    let query = supabase.from('productos').select('*', { count: 'exact' });
    if (busqueda.trim() !== '') query = query.or(`nombre.ilike.%${busqueda}%,codigo_sku.ilike.%${busqueda}%`);
    const from = (paginaActual - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let col = 'nombre';
    let asc = true;
    if (filtroOrden === 'nombre_desc') { col = 'nombre'; asc = false; }
    if (filtroOrden === 'stock_asc') { col = 'stock_actual'; asc = true; }
    if (filtroOrden === 'stock_desc') { col = 'stock_actual'; asc = false; }
    if (filtroOrden === 'sku_asc') { col = 'codigo_sku'; asc = true; }
    if (filtroOrden === 'sku_desc') { col = 'codigo_sku'; asc = false; }

    const { data, count, error } = await query.order(col, { ascending: asc }).range(from, to);
    if (!error) { setProductos(data || []); setTotalItems(count || 0); }
    setLoading(false);
  };

  useEffect(() => {
    const delay = setTimeout(() => { cargarProductos(); }, 300);
    return () => clearTimeout(delay);
  }, [busqueda, paginaActual, filtroOrden]);

  const abrirModalReabastecer = (producto: any) => {
    setRProductoActivo(producto);
    setRCantidad('');
    setRCostoTotal('');
    setReabastecerModal(true);
  };

  const guardarReabastecimiento = async () => {
    if (!rCantidad || !rCostoTotal || parseInt(rCantidad) <= 0) return alert('Ingresa una cantidad y un costo válidos.');
    setGuardandoReabastecimiento(true);
    const qty = parseInt(rCantidad);
    const totalCost = parseFloat(rCostoTotal);
    const unitCost = totalCost / qty;
    try {
      const { error } = await supabase.from('compras_inventario').insert([{
        producto_id: rProductoActivo.id, cantidad: qty, costo_total_compra: totalCost, costo_unitario: unitCost
      }]);
      if (error) throw error;
      alert('¡Lote ingresado con éxito! El stock y el costo promedio se han actualizado.');
      setReabastecerModal(false);
      cargarProductos();
    } catch (error) { alert('Error al registrar la compra.'); } finally { setGuardandoReabastecimiento(false); }
  };

  const seleccionarFotoNuevo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled) setNImagenUri(result.assets[0].uri);
  };

  const guardarNuevoProducto = async () => {
    if (!nNombre || !nPrecioDetal || !nStock) return alert('Nombre, precio y stock son obligatorios.');
    setGuardandoNuevo(true);
    try {
      let imageUrlFinal = null;
      if (nImagenUri) {
        const response = await fetch(nImagenUri); const blob = await response.blob(); const fileName = `nuevo-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('productos_img').upload(fileName, blob);
        if (!uploadError) { const { data } = supabase.storage.from('productos_img').getPublicUrl(fileName); imageUrlFinal = data.publicUrl; }
      }
      const { error } = await supabase.from('productos').insert([{
        codigo_sku: nSku, nombre: nNombre, costo_cop: parseFloat(nCosto || '0'), 
        precio_detal_cop: parseFloat(nPrecioDetal), precio_mayor_cop: parseFloat(nPrecioMayor || '0'), 
        stock_actual: parseInt(nStock), imagen_url: imageUrlFinal
      }]);
      if (error) throw error;
      setNSku(''); setNNombre(''); setNCosto(''); setNPrecioDetal(''); setNPrecioMayor(''); setNStock(''); setNImagenUri(null);
      setModalVisible(false);
      cargarProductos();
    } catch (error) { alert('Error al guardar el producto.'); } finally { setGuardandoNuevo(false); }
  };

  const activarEdicion = (item: any) => {
    setEditandoId(item.id); setSku(item.codigo_sku || ''); setNombre(item.nombre); setCosto(item.costo_cop?.toString() || '0');
    setPrecioDetal(item.precio_detal_cop?.toString() || '0'); setPrecioMayor(item.precio_mayor_cop?.toString() || '0');
    setStock(item.stock_actual?.toString() || '0'); setImagenUrlEdit(item.imagen_url); setNuevaImagenUri(null);
  };

  const seleccionarNuevaImagen = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled) setNuevaImagenUri(result.assets[0].uri);
  };

  const guardarCambios = async (id: string) => {
    setLoading(true);
    let urlFinal = imagenUrlEdit;
    if (nuevaImagenUri) {
      const response = await fetch(nuevaImagenUri); const blob = await response.blob(); const fileName = `${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('productos_img').upload(fileName, blob);
      if (!uploadError) { const { data } = supabase.storage.from('productos_img').getPublicUrl(fileName); urlFinal = data.publicUrl; }
    }
    const { error } = await supabase.from('productos').update({
      codigo_sku: sku, nombre, costo_cop: parseFloat(costo), precio_detal_cop: parseFloat(precioDetal),
      precio_mayor_cop: parseFloat(precioMayor), stock_actual: parseInt(stock), imagen_url: urlFinal
    }).eq('id', id);
    if (!error) { setEditandoId(null); cargarProductos(); } else alert('Error al actualizar');
  };

  const eliminarProducto = async (id: string) => {
    if (window.confirm("¿Eliminar este producto permanentemente?")) {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (!error) cargarProductos();
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isEditing = editandoId === item.id;

    if (isEditing) {
      return (
        <View style={styles.fullEditCard}>
          <Text style={styles.editTitle}>Editando Producto</Text>
          <View style={styles.editRow}>
            <TouchableOpacity onPress={seleccionarNuevaImagen} style={styles.imageEditBtn}>
              <Image source={{ uri: nuevaImagenUri || imagenUrlEdit || 'https://via.placeholder.com/150?text=Foto' }} style={styles.imageEditPreview} />
              <Text style={styles.imageEditText}>Cambiar Foto</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
              <TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={sku} onChangeText={setSku} placeholder="SKU" />
            </View>
          </View>
          <View style={styles.gridInputs}>
            <View style={styles.inputHalf}><Text style={styles.label}>Precio Detal (COP)</Text><TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={precioDetal} onChangeText={setPrecioDetal} keyboardType="numeric" /></View>
            <View style={styles.inputHalf}><Text style={styles.label}>Precio Mayor (COP)</Text><TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={precioMayor} onChangeText={setPrecioMayor} keyboardType="numeric" /></View>
            <View style={styles.inputHalf}><Text style={styles.label}>Costo Forzado (Opcional)</Text><TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={costo} onChangeText={setCosto} keyboardType="numeric" /></View>
            <View style={styles.inputHalf}><Text style={styles.label}>Ajuste Stock Manual</Text><TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={stock} onChangeText={setStock} keyboardType="numeric" /></View>
          </View>
          <Text style={{fontSize: 11, color: '#9CA3AF', marginBottom: 10}}>* Usa "📦 Ingresar" en la lista para promediar costos automáticamente.</Text>
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.saveBtn} onPress={() => guardarCambios(item.id)}><Text style={styles.btnTextWhite}>Guardar Cambios</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditandoId(null)}><Text style={styles.btnTextWhite}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      );
    }

    if (vista === 'compact') {
      return (
        <View style={styles.compactRow}>
          <View style={{flex: 1, flexDirection: 'row', alignItems: 'center'}}>
             <Text style={styles.compactName} numberOfLines={1}>[{item.codigo_sku}] {item.nombre}</Text>
          </View>
          <Text style={styles.compactPrice}>D: ${item.precio_detal_cop.toLocaleString()}</Text>
          <View style={styles.actionButtonGroup}>
            <TouchableOpacity onPress={() => activarEdicion(item)} style={styles.miniAction}><Text style={{color: '#6B0D23', fontWeight: 'bold'}}>Editar</Text></TouchableOpacity>
          </View>
        </View>
      );
    }

    if (vista === 'list') {
      return (
        <View style={styles.listRow}>
          <Image source={{ uri: item.imagen_url || 'https://via.placeholder.com/150?text=S/F' }} style={styles.listImage} />
          
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.sku}>[{item.codigo_sku}]</Text>
            <Text style={styles.prodName}>{item.nombre}</Text>
            <View style={styles.priceRowMobileContainer}>
              <Text style={styles.price}>Detal: ${item.precio_detal_cop.toLocaleString()}</Text>
              <Text style={styles.priceMayor}>Mayor: ${item.precio_mayor_cop.toLocaleString()}</Text>
            </View>
          </View>
          
          <View style={styles.listActions}>
            <Text style={styles.stockText}>Stock: {item.stock_actual}</Text>
            {/* AQUÍ ESTÁ LA CORRECCIÓN: Usamos un estilo apilado si es móvil */}
            <View style={isMobile ? styles.actionButtonGroupStacked : styles.actionButtonGroupRow}>
              <TouchableOpacity onPress={() => activarEdicion(item)} style={styles.editCircle}>
                <Text style={styles.actionText}>Editar</Text>
              </TouchableOpacity>
            </View>
          </View>
          
        </View>
      );
    }

    return (
      <View style={styles.gridCard}>
        <View style={styles.imageContainer}>
          {item.imagen_url ? <Image source={{ uri: item.imagen_url }} style={styles.productImage} /> : <View style={styles.placeholderGradient}><Text style={styles.placeholderText}>{item.nombre.substring(0,2).toUpperCase()}</Text></View>}
          <View style={styles.stockLabel}><Text style={styles.stockLabelText}>{item.stock_actual}</Text></View>
        </View>
        <View style={styles.gridInfo}>
          <Text style={styles.sku}>[{item.codigo_sku}]</Text>
          <Text style={styles.prodName} numberOfLines={1}>{item.nombre}</Text>
          <Text style={styles.price}>D: ${item.precio_detal_cop.toLocaleString()}</Text>
          <View style={styles.gridActions}>
            <TouchableOpacity onPress={() => activarEdicion(item)}><Text style={styles.actionText}>Editar</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Inventario de Productos</Text>
          <Text style={styles.subtitle}>Gestiona tus productos y existencias</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Nuevo Producto</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.toolbar}>
        <TextInput 
          style={[styles.searchInput, {outlineStyle: 'none'} as any, isMobile ? {width: '100%', marginBottom: 10} : {width: 250}]} 
          placeholder="🔍 Buscar producto..." 
          value={busqueda}
          onChangeText={(text) => { setBusqueda(text); setPaginaActual(1); }}
        />
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortFiltersContainer}>
          {[
            { id: 'nombre_asc', label: 'A-Z' },
            { id: 'nombre_desc', label: 'Z-A' },
            { id: 'stock_desc', label: '+ Stock' },
            { id: 'stock_asc', label: '- Stock' },
            { id: 'sku_asc', label: 'SKU Asc' },
            { id: 'sku_desc', label: 'SKU Desc' },
          ].map(f => (
            <TouchableOpacity 
              key={f.id} 
              style={[styles.sortPill, filtroOrden === f.id && styles.sortPillActive]} 
              onPress={() => { setFiltroOrden(f.id); setPaginaActual(1); }}
            >
              <Text style={[styles.sortPillText, filtroOrden === f.id && styles.sortPillTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.viewToggles}>
          <TouchableOpacity onPress={() => setVista('list')} style={[styles.viewBtn, vista === 'list' && styles.viewBtnActive]}><Text>≡</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setVista('grid')} style={[styles.viewBtn, vista === 'grid' && styles.viewBtnActive]}><Text>🔲</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setVista('compact')} style={[styles.viewBtn, vista === 'compact' && styles.viewBtnActive]}><Text>⁝⁝</Text></TouchableOpacity>
        </View>
      </View>

      {loading && <ActivityIndicator size="large" color="#6B0D23" style={{ marginVertical: 20 }} />}

      <FlatList
        key={`${vista}-${numColumns}`}
        data={productos}
        numColumns={numColumns}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 15 }}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No se encontraron productos.</Text> : null}
        ListFooterComponent={
          totalItems > 0 ? (
            <View style={styles.paginationContainer}>
              <TouchableOpacity style={[styles.pageBtn, paginaActual === 1 && styles.pageBtnDisabled]} disabled={paginaActual === 1} onPress={() => setPaginaActual(p => p - 1)}><Text style={styles.pageBtnText}>← Anterior</Text></TouchableOpacity>
              <Text style={styles.pageInfo}>Página {paginaActual} de {totalPages}</Text>
              <TouchableOpacity style={[styles.pageBtn, paginaActual >= totalPages && styles.pageBtnDisabled]} disabled={paginaActual >= totalPages} onPress={() => setPaginaActual(p => p + 1)}><Text style={styles.pageBtnText}>Siguiente →</Text></TouchableOpacity>
            </View>
          ) : null
        }
      />

      <Modal visible={reabastecerModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardSmall}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ingresar Lote</Text>
              <TouchableOpacity onPress={() => setReabastecerModal(false)}><Text style={styles.modalCloseText}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={{fontSize: 14, color: '#374151', marginBottom: 15}}>Producto: <Text style={{fontWeight: 'bold'}}>{rProductoActivo?.nombre}</Text></Text>
              <Text style={styles.label}>Cantidad</Text>
              <TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={rCantidad} onChangeText={setRCantidad} keyboardType="numeric" placeholder="Ej: 10" />
              <Text style={styles.label}>Costo Total (COP)</Text>
              <TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={rCostoTotal} onChangeText={setRCostoTotal} keyboardType="numeric" placeholder="Ej: 240000" />
              {guardandoReabastecimiento ? <ActivityIndicator color="#6B0D23" /> : (
                <TouchableOpacity style={styles.vinotintoBtn} onPress={guardarReabastecimiento}><Text style={styles.vinotintoBtnText}>Guardar Compra</Text></TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: width > 768 ? '90%' : '95%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Registrar Producto</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.modalCloseText}>✕</Text></TouchableOpacity>
              </View>
              <View style={styles.modalContent}>
                <View style={styles.modalImageSection}>
                  <TouchableOpacity onPress={seleccionarFotoNuevo} style={styles.imageUploadBtn}>
                    {nImagenUri ? <Image source={{ uri: nImagenUri }} style={styles.modalImagePreview} /> : <View style={styles.modalImagePlaceholder}><Text style={{fontSize: 30}}>📷</Text><Text style={{color: '#9CA3AF', fontSize: 12, marginTop: 5}}>Subir foto</Text></View>}
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Nombre *</Text>
                <TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={nNombre} onChangeText={setNNombre} placeholder="Ej: Base" />
                <Text style={styles.label}>SKU</Text>
                <TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={nSku} onChangeText={setNSku} placeholder="Ej: DF-001" />
                <View style={styles.gridInputs}>
                  <View style={styles.inputHalf}><Text style={styles.label}>Costo Lote (COP)</Text><TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={nCosto} onChangeText={setNCosto} keyboardType="numeric" /></View>
                  <View style={styles.inputHalf}><Text style={styles.label}>Stock *</Text><TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={nStock} onChangeText={setNStock} keyboardType="numeric" /></View>
                  <View style={styles.inputHalf}><Text style={styles.label}>Precio Detal (COP) *</Text><TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={nPrecioDetal} onChangeText={setNPrecioDetal} keyboardType="numeric" /></View>
                  <View style={styles.inputHalf}><Text style={styles.label}>Precio Mayor (COP)</Text><TextInput style={[styles.input, {outlineStyle: 'none'} as any]} value={nPrecioMayor} onChangeText={setNPrecioMayor} keyboardType="numeric" /></View>
                </View>
                {guardandoNuevo ? <ActivityIndicator size="large" color="#6B0D23" style={{ marginTop: 20 }} /> : (
                  <TouchableOpacity style={styles.vinotintoBtn} onPress={guardarNuevoProducto}><Text style={styles.vinotintoBtnText}>Guardar</Text></TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 1200 },
  topHeader: { flexDirection: 'row', padding: 15, alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#6B7280' },
  
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, marginBottom: 20, flexWrap: 'wrap', gap: 15 },
  searchInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 15, height: 45, fontSize: 14, elevation: 1 },
  sortFiltersContainer: { flex: 1, maxHeight: 45, paddingVertical: 2 },
  sortPill: { backgroundColor: '#F3F4F6', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  sortPillActive: { backgroundColor: '#6B0D23', borderColor: '#6B0D23' },
  sortPillText: { fontSize: 12, color: '#4B5563', fontWeight: 'bold' },
  sortPillTextActive: { color: '#FFF' },
  viewToggles: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 12, padding: 4 },
  viewBtn: { padding: 8, borderRadius: 8 },
  viewBtnActive: { backgroundColor: '#FFF' },
  
  addBtn: { backgroundColor: '#6B0D23', paddingHorizontal: 15, height: 45, justifyContent: 'center', borderRadius: 12, elevation: 2 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#6B7280', fontSize: 16 },

  // --- MODALES ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', width: '100%', maxWidth: 500, borderRadius: 24, overflow: 'hidden', elevation: 10 },
  modalCardSmall: { backgroundColor: '#FFF', width: '100%', maxWidth: 400, borderRadius: 20, overflow: 'hidden', elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  modalCloseText: { fontSize: 20, color: '#9CA3AF', fontWeight: 'bold', paddingHorizontal: 10 },
  modalContent: { padding: 25 },
  modalImageSection: { alignItems: 'center', marginBottom: 20 },
  imageUploadBtn: { shadowOpacity: 0.05, shadowRadius: 10 },
  modalImagePlaceholder: { width: 120, height: 120, borderRadius: 20, backgroundColor: '#F9FAFB', borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  modalImagePreview: { width: 120, height: 120, borderRadius: 20 },
  vinotintoBtn: { backgroundColor: '#6B0D23', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  vinotintoBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  // --- BOTONES ---
  reabastecerBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  reabastecerText: { fontSize: 11, fontWeight: 'bold', color: '#374151' },
  
  // Modificaciones para que apile en móvil:
  reabastecerBtnLg: { backgroundColor: '#F3F4F6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  reabastecerTextLg: { fontSize: 12, fontWeight: 'bold', color: '#374151' },
  actionButtonGroup: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  
  // Nuevos estilos para decidir si van en fila (Desktop) o columna (Móvil)
  actionButtonGroupRow: { flexDirection: 'row', gap: 8, marginTop: 5 },
  actionButtonGroupStacked: { flexDirection: 'column', gap: 8, marginTop: 5, alignItems: 'flex-end' },

  // --- EDICIÓN COMPLETA ---
  fullEditCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, margin: 8, elevation: 4, borderLeftWidth: 4, borderLeftColor: '#6B0D23', flex: 1 },
  editTitle: { fontSize: 16, fontWeight: 'bold', color: '#6B0D23', marginBottom: 15 },
  editRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  imageEditBtn: { alignItems: 'center', justifyContent: 'center' },
  imageEditPreview: { width: 80, height: 80, borderRadius: 12, marginBottom: 5, backgroundColor: '#F3F4F6' },
  imageEditText: { fontSize: 11, color: '#6B0D23', fontWeight: 'bold' },
  label: { fontSize: 12, color: '#374151', fontWeight: 'bold', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 15 },
  gridInputs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  inputHalf: { width: '48%' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveBtn: { flex: 2, backgroundColor: '#6B0D23', padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { flex: 1, backgroundColor: '#6B7280', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnTextWhite: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

  // --- VISTAS ---
  gridCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, margin: 8, overflow: 'hidden', elevation: 2, minWidth: 140 },
  imageContainer: { aspectRatio: 1.1, backgroundColor: '#F3F4F6' },
  productImage: { width: '100%', height: '100%' },
  placeholderGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5', borderTopWidth: 3, borderTopColor: '#6B0D23' },
  placeholderText: { fontSize: 30, fontWeight: 'bold', color: '#E5E7EB' },
  stockLabel: { position: 'absolute', bottom: 8, right: 8, backgroundColor: '#6B0D23', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  stockLabelText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  gridInfo: { padding: 12 },
  sku: { fontSize: 10, color: '#9CA3AF' },
  prodName: { fontSize: 13, fontWeight: '700', marginVertical: 4 },
  price: { fontSize: 14, fontWeight: '800', color: '#6B0D23' },
  priceRowMobileContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  priceMayor: { fontSize: 13, fontWeight: 'bold', color: '#B58D1D' },
  gridActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8, alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  actionText: { fontSize: 12, fontWeight: 'bold', color: '#6B0D23' },

  listRow: { flexDirection: 'row', backgroundColor: '#FFF', marginBottom: 10, borderRadius: 12, padding: 10, alignItems: 'center', gap: 10, elevation: 1 },
  listImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#F3F4F6' },
  listActions: { alignItems: 'flex-end', gap: 5 },
  stockText: { fontSize: 12, color: '#4B5563', fontWeight: '600' },
  editCircle: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FCE7EB', alignItems: 'center' },

  compactRow: { flexDirection: 'row', backgroundColor: '#FFF', padding: 12, marginBottom: 6, borderRadius: 8, alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  compactName: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  compactPrice: { width: 85, fontSize: 11, fontWeight: 'bold' },
  miniAction: { paddingHorizontal: 10 },

  // --- PAGINACIÓN ---
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 40, gap: 15 },
  pageBtn: { backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', elevation: 1 },
  pageBtnDisabled: { backgroundColor: '#F9FAFB', opacity: 0.5 },
  pageBtnText: { color: '#6B0D23', fontWeight: 'bold', fontSize: 13 },
  pageInfo: { fontSize: 14, fontWeight: '600', color: '#374151' }
});