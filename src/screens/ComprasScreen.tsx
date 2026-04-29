import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions, Modal } from 'react-native';
import { supabase } from '../../supabase';

type Producto = any;
type Entidad = any;

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
  costo_unitario: number;
}

export default function ComprasScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 1024;

  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Entidad[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Entidad | null>(null);

  // Modal Nuevo Producto
  const [modalNuevoProducto, setModalNuevoProducto] = useState(false);
  const [nNombre, setNNombre] = useState('');
  const [nCategoria, setNCategoria] = useState('');
  const [nCosto, setNCosto] = useState('');
  const [nPrecioDetal, setNPrecioDetal] = useState('');
  const [nPrecioMayor, setNPrecioMayor] = useState('');
  const [procesandoNuevo, setProcesandoNuevo] = useState(false);

  // Modal Checkout
  const [modalCheckout, setModalCheckout] = useState(false);
  const [procesandoCompra, setProcesandoCompra] = useState(false);

  // Móvil
  const [carritoVisibleMovil, setCarritoVisibleMovil] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Cargar productos
    const { data: prodData } = await supabase.from('productos').select('*').order('nombre');
    if (prodData) setProductos(prodData);

    // Cargar proveedores (Entidades tipo 'Proveedor')
    const { data: provData } = await supabase.from('entidades').select('*').eq('tipo', 'Proveedor').order('nombre');
    if (provData) setProveedores(provData);
    
    setLoading(false);
  };

  const agregarAlCarrito = (prod: Producto) => {
    const existe = carrito.find(item => item.producto.id === prod.id);
    if (existe) {
      setCarrito(carrito.map(item => 
        item.producto.id === prod.id 
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ));
    } else {
      // El costo por defecto es el costo actual del producto
      setCarrito([...carrito, { producto: prod, cantidad: 1, costo_unitario: prod.costo_cop || 0 }]);
    }
  };

  const actualizarCantidad = (prodId: string, delta: number) => {
    setCarrito(carrito.map(item => {
      if (item.producto.id === prodId) {
        const nuevaCantidad = Math.max(1, item.cantidad + delta);
        return { ...item, cantidad: nuevaCantidad };
      }
      return item;
    }));
  };

  const actualizarCosto = (prodId: string, costoString: string) => {
    setCarrito(carrito.map(item => {
      if (item.producto.id === prodId) {
        return { ...item, costo_unitario: Number(costoString) };
      }
      return item;
    }));
  };

  const eliminarDelCarrito = (prodId: string) => {
    setCarrito(carrito.filter(item => item.producto.id !== prodId));
  };

  const calcularTotal = () => {
    return carrito.reduce((sum, item) => sum + (item.cantidad * item.costo_unitario), 0);
  };

  const crearNuevoProducto = async () => {
    if (!nNombre || !nCategoria || !nCosto || !nPrecioDetal || !nPrecioMayor) {
      return alert('Por favor llena todos los campos.');
    }

    setProcesandoNuevo(true);
    try {
      const payload = {
        nombre: nNombre,
        categoria: nCategoria,
        costo_cop: Number(nCosto),
        precio_detal_cop: Number(nPrecioDetal),
        precio_mayor_cop: Number(nPrecioMayor),
        stock_actual: 0 // Se suma al finalizar la compra
      };

      const { data, error } = await supabase.from('productos').insert([payload]).select().single();
      if (error) throw error;

      alert('Producto creado y agregado a la compra.');
      setModalNuevoProducto(false);
      setNNombre(''); setNCategoria(''); setNCosto(''); setNPrecioDetal(''); setNPrecioMayor('');
      
      // Actualizar lista local y agregar al carrito
      setProductos([...productos, data]);
      agregarAlCarrito(data);

    } catch (error: any) {
      alert('Error al crear producto: ' + error.message);
    } finally {
      setProcesandoNuevo(false);
    }
  };

  const finalizarCompra = async () => {
    if (!proveedorSeleccionado) return alert('Selecciona un proveedor antes de finalizar.');
    if (carrito.length === 0) return alert('Agrega productos a la compra.');

    setProcesandoCompra(true);
    try {
      const total = calcularTotal();

      // 1. Crear la Compra (Histórico)
      const { data: compra, error: errCompra } = await supabase.from('compras').insert([{
        proveedor_id: proveedorSeleccionado.id,
        monto_total: total
      }]).select().single();
      if (errCompra) throw errCompra;

      // 2. Insertar Items
      const itemsPayload = carrito.map(item => ({
        compra_id: compra.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        costo_unitario: item.costo_unitario,
        subtotal: item.cantidad * item.costo_unitario
      }));
      const { error: errItems } = await supabase.from('compras_items').insert(itemsPayload);
      if (errItems) throw errItems;

      // 3. Crear Deuda en Cuentas por Pagar
      const { error: errDeuda } = await supabase.from('cuentas_por_pagar').insert([{
        entidad_id: proveedorSeleccionado.id,
        monto_total: total,
        saldo_pendiente: total,
        estado: 'ACTIVA'
      }]);
      if (errDeuda) throw errDeuda;

      // 4. Actualizar Stock y Costos en Productos
      // (Supabase no tiene upsert masivo nativo para update con calculos, lo hacemos uno por uno)
      for (const item of carrito) {
        // Obtenemos stock actual de BD por seguridad
        const { data: pData } = await supabase.from('productos').select('stock_actual').eq('id', item.producto.id).single();
        const stockAnterior = pData ? pData.stock_actual : 0;

        await supabase.from('productos')
          .update({ 
            stock_actual: stockAnterior + item.cantidad,
            costo_cop: item.costo_unitario // Actualizamos el costo al de la última compra
          })
          .eq('id', item.producto.id);
      }

      alert('¡Compra registrada con éxito! El inventario se ha actualizado.');
      setModalCheckout(false);
      setCarrito([]);
      setProveedorSeleccionado(null);
      fetchData(); // Recargar productos para ver nuevo stock

    } catch (error: any) {
      alert('Error en la compra: ' + error.message);
    } finally {
      setProcesandoCompra(false);
    }
  };

  const PanelResumenCompra = () => (
    <View style={[styles.rightPanel, {flex: 1}]}>
      <Text style={styles.panelTitle}>Resumen de la Compra</Text>
      
      {/* Selector de Proveedor */}
      <Text style={styles.labelSection}>Proveedor:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.proveedoresScroll}>
        {proveedores.map(prov => (
          <TouchableOpacity 
            key={prov.id} 
            style={[styles.provPill, proveedorSeleccionado?.id === prov.id && styles.provPillActive]}
            onPress={() => setProveedorSeleccionado(prov)}
          >
            <Text style={[styles.provPillText, proveedorSeleccionado?.id === prov.id && styles.provPillTextActive]}>
              {prov.nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.carritoContainer}>
        {carrito.length === 0 ? (
          <View style={styles.carritoEmpty}>
            <Text style={{fontSize: 40, marginBottom: 10}}>🛒</Text>
            <Text style={styles.emptyText}>No has agregado productos a esta compra</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {carrito.map(item => (
              <View key={item.producto.id} style={styles.cartItem}>
                <View style={{flex: 1, marginRight: 10}}>
                  <Text style={styles.cartItemName} numberOfLines={1}>{item.producto.nombre}</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5}}>
                    <Text style={styles.costoLabel}>Costo c/u: $</Text>
                    <TextInput 
                      style={[styles.costoInput, {outlineStyle: 'none'} as any]}
                      keyboardType="numeric"
                      value={String(item.costo_unitario)}
                      onChangeText={(val) => actualizarCosto(item.producto.id, val)}
                    />
                  </View>
                </View>
                
                <View style={styles.qtyControls}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => actualizarCantidad(item.producto.id, -1)}>
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.cantidad}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => actualizarCantidad(item.producto.id, 1)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={{alignItems: 'flex-end', minWidth: 80}}>
                  <Text style={styles.cartItemTotal}>${(item.cantidad * item.costo_unitario).toLocaleString()}</Text>
                  <TouchableOpacity onPress={() => eliminarDelCarrito(item.producto.id)}>
                    <Text style={styles.deleteText}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.checkoutFooter}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total a Pagar:</Text>
          <Text style={styles.totalValue}>${calcularTotal().toLocaleString()}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.checkoutBtn, (carrito.length === 0 || !proveedorSeleccionado) && {backgroundColor: '#9CA3AF'}]}
          disabled={carrito.length === 0 || !proveedorSeleccionado}
          onPress={() => {
            if (!isDesktop) setCarritoVisibleMovil(false);
            setModalCheckout(true);
          }}
        >
          <Text style={styles.checkoutBtnText}>Procesar Compra</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const productosFiltrados = productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <View style={[styles.container, isDesktop ? {flexDirection: 'row'} : {flexDirection: 'column'}]}>
      
      {/* PANEL IZQUIERDO: Buscador de Productos */}
      <View style={[styles.leftPanel, isDesktop && {flex: 1.5, borderRightWidth: 1, borderColor: '#E5E7EB'}]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>🛒 Ingreso de Mercancía</Text>
            <Text style={styles.subtitle}>Compra a Proveedores y actualiza Stock</Text>
          </View>
          <TouchableOpacity style={styles.btnNuevoProducto} onPress={() => setModalNuevoProducto(true)}>
            <Text style={styles.btnNuevoProductoText}>+ Nuevo Producto</Text>
          </TouchableOpacity>
        </View>

        <TextInput 
          style={[styles.searchInput, {outlineStyle: 'none'} as any]} 
          placeholder="🔍 Buscar producto en inventario..." 
          value={busqueda}
          onChangeText={setBusqueda}
        />

        {loading ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 50}}/> : (
          <ScrollView contentContainerStyle={styles.productosGrid} showsVerticalScrollIndicator={false}>
            {productosFiltrados.map(prod => (
              <TouchableOpacity key={prod.id} style={[styles.productoCard, !isDesktop && { width: '47%' }]} onPress={() => agregarAlCarrito(prod)}>
                <View style={styles.productoIcon}>
                  <Text style={{fontSize: 24}}>📦</Text>
                </View>
                <Text style={styles.productoNombre} numberOfLines={2}>{prod.nombre}</Text>
                <Text style={styles.productoCategoria}>{prod.categoria}</Text>
                <Text style={styles.productoStock}>Stock: {prod.stock_actual}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* PANEL DERECHO: Resumen de Compra (Escritorio) */}
      {isDesktop && <PanelResumenCompra />}

      {/* BOTÓN FLOTANTE (Solo Móvil) */}
      {!isDesktop && carrito.length > 0 && (
        <TouchableOpacity style={styles.floatingCartBtn} onPress={() => setCarritoVisibleMovil(true)}>
          <Text style={styles.floatingCartText}>🛒 Ver Carrito ({carrito.length}) - ${calcularTotal().toLocaleString()}</Text>
        </TouchableOpacity>
      )}

      {/* MODAL: TICKET MÓVIL */}
      {!isDesktop && (
        <Modal visible={carritoVisibleMovil} animationType="slide" transparent={true}>
          <View style={styles.modalOverlaySlide}>
            <View style={styles.mobileCartSheet}>
              <TouchableOpacity style={styles.closeSheetBtn} onPress={() => setCarritoVisibleMovil(false)}>
                <Text style={styles.closeSheetText}>Cerrar Carrito ⬇</Text>
              </TouchableOpacity>
              <PanelResumenCompra />
            </View>
          </View>
        </Modal>
      )}

      {/* --- MODAL CREAR NUEVO PRODUCTO --- */}
      <Modal visible={modalNuevoProducto} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✨ Crear Nuevo Producto</Text>
              <TouchableOpacity onPress={() => setModalNuevoProducto(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              
              <Text style={styles.inputLabel}>Nombre del Producto *</Text>
              <TextInput style={[styles.inputField, {outlineStyle:'none'} as any]} value={nNombre} onChangeText={setNNombre} placeholder="Ej. Paleta de Sombras" />

              <Text style={styles.inputLabel}>Categoría *</Text>
              <TextInput style={[styles.inputField, {outlineStyle:'none'} as any]} value={nCategoria} onChangeText={setNCategoria} placeholder="Ej. Ojos, Rostro" />

              <Text style={styles.inputLabel}>Costo de Compra (Lo que te costó) COP *</Text>
              <TextInput style={[styles.inputField, {outlineStyle:'none'} as any]} value={nCosto} onChangeText={setNCosto} keyboardType="numeric" placeholder="0.00" />

              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Precio Detal (COP) *</Text>
                  <TextInput style={[styles.inputField, {outlineStyle:'none'} as any]} value={nPrecioDetal} onChangeText={setNPrecioDetal} keyboardType="numeric" placeholder="0.00" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Precio Mayor (COP) *</Text>
                  <TextInput style={[styles.inputField, {outlineStyle:'none'} as any]} value={nPrecioMayor} onChangeText={setNPrecioMayor} keyboardType="numeric" placeholder="0.00" />
                </View>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>El stock iniciará en 0. Se sumará automáticamente cuando finalices esta compra.</Text>
              </View>

              {procesandoNuevo ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 20}} /> : (
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={crearNuevoProducto}>
                  <Text style={styles.modalSubmitBtnText}>Guardar y Agregar a la Compra</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL CONFIRMAR COMPRA --- */}
      <Modal visible={modalCheckout} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardCheckout}>
            <Text style={{fontSize: 50, textAlign: 'center', marginBottom: 10}}>📦</Text>
            <Text style={styles.modalTitleCenter}>Confirmar Compra</Text>
            <Text style={styles.checkoutDesc}>
              Se agregará el stock al inventario y se registrará una deuda de <Text style={{fontWeight: 'bold'}}>${calcularTotal().toLocaleString()}</Text> a nombre del proveedor <Text style={{fontWeight: 'bold'}}>{proveedorSeleccionado?.nombre}</Text> en Cuentas por Pagar.
            </Text>

            {procesandoCompra ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 20}} /> : (
              <View style={{flexDirection: 'row', gap: 10, marginTop: 20}}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalCheckout(false)}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={finalizarCompra}>
                  <Text style={styles.confirmBtnText}>Sí, Finalizar Compra</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5', width: '100%', maxWidth: 1400, marginHorizontal: 'auto' },
  leftPanel: { padding: 20, backgroundColor: '#FAF8F5' },
  rightPanel: { padding: 20, backgroundColor: '#FFF', elevation: 5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 },
  title: { fontSize: 26, fontWeight: '900', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 5 },
  
  btnNuevoProducto: { backgroundColor: '#10B981', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, elevation: 2 },
  btnNuevoProductoText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

  searchInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 15, fontSize: 15, marginBottom: 20 },
  
  productosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, paddingBottom: 50 },
  productoCard: { backgroundColor: '#FFF', width: 160, padding: 15, borderRadius: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, borderWidth: 1, borderColor: '#F3F4F6' },
  productoIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  productoNombre: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 5 },
  productoCategoria: { fontSize: 11, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginBottom: 5 },
  productoStock: { fontSize: 12, fontWeight: 'bold', color: '#10B981' },

  panelTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15 },
  labelSection: { fontSize: 13, fontWeight: 'bold', color: '#4B5563', marginBottom: 10 },
  
  proveedoresScroll: { maxHeight: 50, marginBottom: 20 },
  provPill: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', marginRight: 10, alignSelf: 'flex-start' },
  provPillActive: { backgroundColor: '#6B0D23', borderColor: '#6B0D23' },
  provPillText: { fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  provPillTextActive: { color: '#FFF' },

  carritoContainer: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },
  carritoEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  cartItemName: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  costoLabel: { fontSize: 12, color: '#6B7280', fontWeight: 'bold' },
  costoInput: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, width: 80, fontWeight: 'bold' },
  
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, marginHorizontal: 10 },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  qtyBtnText: { fontSize: 16, fontWeight: 'bold', color: '#4B5563' },
  qtyText: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A', minWidth: 20, textAlign: 'center' },
  
  cartItemTotal: { fontSize: 15, fontWeight: '900', color: '#6B0D23' },
  deleteText: { fontSize: 11, color: '#EF4444', fontWeight: 'bold', marginTop: 5 },

  checkoutFooter: { backgroundColor: '#FFF', paddingTop: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#4B5563' },
  totalValue: { fontSize: 24, fontWeight: '900', color: '#1A1A1A' },
  checkoutBtn: { backgroundColor: '#6B0D23', padding: 16, borderRadius: 12, alignItems: 'center' },
  checkoutBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', width: '100%', maxWidth: 500, borderRadius: 24, overflow: 'hidden', maxHeight: '90%' },
  modalCardCheckout: { backgroundColor: '#FFF', width: '100%', maxWidth: 400, borderRadius: 24, padding: 30, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  modalTitleCenter: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', marginBottom: 10 },
  checkoutDesc: { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 22 },
  closeBtn: { fontSize: 20, color: '#9CA3AF', fontWeight: 'bold' },
  modalContent: { padding: 20 },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#374151', marginBottom: 8, marginTop: 10 },
  inputField: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 15 },
  infoBox: { backgroundColor: '#DBEAFE', padding: 15, borderRadius: 12, marginTop: 20 },
  infoText: { color: '#1E40AF', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  modalSubmitBtn: { backgroundColor: '#10B981', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  modalSubmitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  cancelBtn: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', backgroundColor: '#F3F4F6' },
  cancelBtnText: { color: '#4B5563', fontWeight: 'bold' },
  confirmBtn: { flex: 1.5, padding: 15, borderRadius: 12, alignItems: 'center', backgroundColor: '#6B0D23' },
  confirmBtnText: { color: '#FFF', fontWeight: 'bold' },

  // --- ELEMENTOS MÓVILES ---
  floatingCartBtn: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#1A1A1A', padding: 16, borderRadius: 16, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  floatingCartText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  modalOverlaySlide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  mobileCartSheet: { backgroundColor: '#FAF8F5', height: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 15, paddingBottom: 30, overflow: 'hidden' },
  closeSheetBtn: { alignItems: 'center', paddingBottom: 15 },
  closeSheetText: { color: '#6B7280', fontWeight: 'bold', fontSize: 14 }
});
