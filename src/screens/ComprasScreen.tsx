import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions, Modal, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  
  const [carrito, setCarrito] = useState<ItemCarrito[]>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('df_compras_carrito');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return [];
  });
  
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('df_compras_carrito', JSON.stringify(carrito));
    }
  }, [carrito]);

  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Entidad | null>(null);

  // Estados para Cuentas de Pago
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [tasaUSD, setTasaUSD] = useState(1);
  const [tasaVES, setTasaVES] = useState(1);
  const [metodoPagoSeleccionadoId, setMetodoPagoSeleccionadoId] = useState('credito'); // Por defecto, Deuda

  // Modal Nuevo Producto
  const [modalNuevoProducto, setModalNuevoProducto] = useState(false);
  const [nNombre, setNNombre] = useState('');
  const [nSku, setNSku] = useState('');
  const [nCategoria, setNCategoria] = useState('');
  const [nCosto, setNCosto] = useState('');
  const [nPrecioDetal, setNPrecioDetal] = useState('');
  const [nPrecioMayor, setNPrecioMayor] = useState('');
  const [nImagenUri, setNImagenUri] = useState<string | null>(null);
  const [procesandoNuevo, setProcesandoNuevo] = useState(false);

  // Modal Checkout
  const [modalCheckout, setModalCheckout] = useState(false);
  const [procesandoCompra, setProcesandoCompra] = useState(false);

  // Móvil
  const [carritoVisibleMovil, setCarritoVisibleMovil] = useState(false);

  // Modal Editar Precios
  const [modalPrecios, setModalPrecios] = useState(false);
  const [productoEdicion, setProductoEdicion] = useState<Producto | null>(null);
  const [precioDetalEdit, setPrecioDetalEdit] = useState('');
  const [precioMayorEdit, setPrecioMayorEdit] = useState('');
  const [guardandoPrecios, setGuardandoPrecios] = useState(false);

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
    
    // Cargar cuentas activas
    const { data: cuenData } = await supabase.from('cuentas').select('*').eq('activo', true).neq('tipo', 'DEUDA');
    if (cuenData) setCuentas(cuenData);

    // Cargar tasas
    const { data: tasasData } = await supabase.from('tasas_cambio').select('*');
    if (tasasData) {
      const usd = tasasData.find(t => t.moneda === 'USD');
      const ves = tasasData.find(t => t.moneda === 'VES');
      if (usd) setTasaUSD(usd.tasa_en_cop || 1);
      if (ves) setTasaVES(ves.tasa_en_cop || 1);
    }
    
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

  const seleccionarFotoNuevo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled) setNImagenUri(result.assets[0].uri);
  };

  const crearNuevoProducto = async () => {
    if (!nSku || !nNombre || !nCosto || !nPrecioDetal || !nPrecioMayor) {
      return alert('Por favor llena todos los campos obligatorios.');
    }

    setProcesandoNuevo(true);
    try {
      let imageUrlFinal = null;
      if (nImagenUri) {
        const response = await fetch(nImagenUri); 
        const blob = await response.blob(); 
        const fileName = `nuevo-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('productos_img').upload(fileName, blob);
        if (!uploadError) { 
          const { data } = supabase.storage.from('productos_img').getPublicUrl(fileName); 
          imageUrlFinal = data.publicUrl; 
        }
      }

      const payload = {
        nombre: nNombre,
        codigo_sku: nSku,
        categoria: 'General', // Default ya que se eliminó el campo
        costo_cop: Number(nCosto),
        precio_detal_cop: Number(nPrecioDetal),
        precio_mayor_cop: Number(nPrecioMayor),
        stock_actual: 0, // Se suma al finalizar la compra
        imagen_url: imageUrlFinal
      };

      const { data, error } = await supabase.from('productos').insert([payload]).select().single();
      if (error) throw error;

      alert('Producto creado y agregado a la compra.');
      setModalNuevoProducto(false);
      setNNombre(''); setNSku(''); setNCosto(''); setNPrecioDetal(''); setNPrecioMayor(''); setNImagenUri(null);
      
      // Actualizar lista local y agregar al carrito
      setProductos([...productos, data]);
      agregarAlCarrito(data);

    } catch (error: any) {
      alert('Error al crear producto: ' + error.message);
    } finally {
      setProcesandoNuevo(false);
    }
  };

  const abrirEdicionPrecios = (producto: Producto) => {
    setProductoEdicion(producto);
    setPrecioDetalEdit(String(producto.precio_detal_cop || ''));
    setPrecioMayorEdit(String(producto.precio_mayor_cop || ''));
    setModalPrecios(true);
  };

  const guardarPreciosVenta = async () => {
    if (!productoEdicion) return;
    setGuardandoPrecios(true);
    try {
      const pDetal = Number(precioDetalEdit);
      const pMayor = Number(precioMayorEdit);
      const { error } = await supabase.from('productos')
        .update({ precio_detal_cop: pDetal, precio_mayor_cop: pMayor })
        .eq('id', productoEdicion.id);
      if (error) throw error;
      
      alert('Precios actualizados exitosamente.');
      setModalPrecios(false);
      
      setProductos(productos.map(p => p.id === productoEdicion.id ? { ...p, precio_detal_cop: pDetal, precio_mayor_cop: pMayor } : p));
      setCarrito(carrito.map(item => item.producto.id === productoEdicion.id ? { ...item, producto: { ...item.producto, precio_detal_cop: pDetal, precio_mayor_cop: pMayor } } : item));
    } catch (error: any) {
      alert('Error al guardar precios: ' + error.message);
    } finally {
      setGuardandoPrecios(false);
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

      // 3. Crear Deuda o Egreso
      if (metodoPagoSeleccionadoId === 'credito') {
        const { error: errDeuda } = await supabase.from('cuentas_por_pagar').insert([{
          entidad_id: proveedorSeleccionado.id,
          monto_total: total,
          saldo_pendiente: total,
          estado: 'ACTIVA'
        }]);
        if (errDeuda) throw errDeuda;
      } else {
        const cuentaSeleccionada = cuentas.find(c => c.id === metodoPagoSeleccionadoId);
        if (cuentaSeleccionada) {
          let montoFinal = total;
          if (cuentaSeleccionada.moneda === 'USD') montoFinal = total / tasaUSD;
          if (cuentaSeleccionada.moneda === 'VES') montoFinal = total / tasaVES;

          // Validación Opción B: Advertencia si no hay fondos suficientes
          if (cuentaSeleccionada.saldo_actual !== undefined && cuentaSeleccionada.saldo_actual < montoFinal) {
            const proceed = window.confirm(`⚠️ ADVERTENCIA DE SALDO\n\nLa cuenta "${cuentaSeleccionada.nombre}" solo tiene ${cuentaSeleccionada.saldo_actual.toLocaleString()} ${cuentaSeleccionada.moneda}, pero esta compra requiere ${montoFinal.toLocaleString(undefined, {maximumFractionDigits: 2})} ${cuentaSeleccionada.moneda}.\n\nSi continúas, el saldo quedará en negativo.\n\n¿Estás seguro de que deseas procesar la compra de todas formas?`);
            if (!proceed) {
              setProcesandoCompra(false);
              return;
            }
          }

          const detalleProductos = carrito.map(item => `${item.cantidad}x ${item.producto.nombre}`).join(', ');
          const desc = `Compra de Mercancía. Proveedor: ${proveedorSeleccionado.nombre}\nProductos: ${detalleProductos}`;

          const { error: errCaja } = await supabase.from('movimientos_caja').insert([{
            cuenta_id: cuentaSeleccionada.id,
            tipo_movimiento: 'Egreso',
            monto: montoFinal,
            descripcion: desc
          }]);
          if (errCaja) throw errCaja;
        }
      }

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

  const renderPanelResumenCompra = () => (
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
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'flex-start'}}>
                  <View style={{flex: 1, marginRight: 10}}>
                    {item.producto.codigo_sku ? <Text style={styles.skuText}>[{item.producto.codigo_sku}]</Text> : null}
                    <Text style={styles.cartItemName} numberOfLines={2}>{item.producto.nombre}</Text>
                  </View>
                  <View style={{flexDirection: 'row', gap: 15}}>
                    <TouchableOpacity onPress={() => abrirEdicionPrecios(item.producto)}>
                      <Text style={styles.editPriceText}>✏️ Precios</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => eliminarDelCarrito(item.producto.id)}>
                      <Text style={styles.deleteText}>Quitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
                    <Text style={styles.costoLabel}>Costo: $</Text>
                    <TextInput 
                      style={[styles.costoInput, {outlineStyle: 'none'} as any]}
                      keyboardType="numeric"
                      value={String(item.costo_unitario)}
                      onChangeText={(val) => actualizarCosto(item.producto.id, val)}
                    />
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

                  <Text style={styles.cartItemTotal}>${(item.cantidad * item.costo_unitario).toLocaleString()}</Text>
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

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    (p.codigo_sku && p.codigo_sku.toLowerCase().includes(busqueda.toLowerCase()))
  );

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
                <View style={styles.productoImageContainer}>
                  {prod.imagen_url ? (
                    <Image source={{uri: prod.imagen_url}} style={styles.productoImageFull} />
                  ) : (
                    <View style={styles.productoIconFull}>
                      <Text style={{fontSize: 30}}>📦</Text>
                    </View>
                  )}
                </View>
                <View style={styles.productoInfoContainer}>
                  {prod.codigo_sku ? <Text style={styles.skuText}>[{prod.codigo_sku}]</Text> : null}
                  <Text style={styles.productoNombre} numberOfLines={2}>{prod.nombre}</Text>
                  <Text style={styles.productoCostoAnt}>Costo ant: ${prod.costo_cop?.toLocaleString() || 0}</Text>
                  <Text style={styles.productoStockGrid}>Stock: {prod.stock_actual}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* PANEL DERECHO: Resumen de Compra (Escritorio) */}
      {isDesktop && renderPanelResumenCompra()}

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
              {renderPanelResumenCompra()}
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
              
              <View style={{alignItems: 'center', marginBottom: 20}}>
                <TouchableOpacity onPress={seleccionarFotoNuevo} style={styles.imageEditBtn}>
                  {nImagenUri ? (
                    <Image source={{ uri: nImagenUri }} style={styles.imageEditPreview} />
                  ) : (
                    <View style={styles.imageEditPlaceholder}>
                      <Text style={{fontSize: 30}}>📷</Text>
                    </View>
                  )}
                  <Text style={styles.imageEditText}>Añadir Foto</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Código SKU *</Text>
              <TextInput style={[styles.inputField, {outlineStyle:'none'} as any]} value={nSku} onChangeText={setNSku} placeholder="Ej. PB-001" />

              <Text style={styles.inputLabel}>Nombre del Producto *</Text>
              <TextInput style={[styles.inputField, {outlineStyle:'none'} as any]} value={nNombre} onChangeText={setNNombre} placeholder="Ej. Paleta de Sombras" />

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
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{fontSize: 50, textAlign: 'center', marginBottom: 10}}>📦</Text>
            <Text style={styles.modalTitleCenter}>Confirmar Compra</Text>
            <Text style={styles.checkoutDesc}>
              Se agregará el stock al inventario por un valor total de <Text style={{fontWeight: 'bold'}}>${calcularTotal().toLocaleString()} COP</Text>.
            </Text>

            <View style={{width: '100%', marginTop: 20}}>
              <Text style={{fontWeight: 'bold', marginBottom: 10, color: '#374151'}}>¿Cómo vas a pagar esta compra?</Text>
              
              <View style={styles.pillsContainer}>
                <TouchableOpacity 
                  style={[styles.paymentPill, metodoPagoSeleccionadoId === 'credito' && styles.paymentPillActive]}
                  onPress={() => setMetodoPagoSeleccionadoId('credito')}
                >
                  <Text style={[styles.paymentPillText, metodoPagoSeleccionadoId === 'credito' && styles.paymentPillTextActive]}>❌ A Crédito (Crear Deuda)</Text>
                </TouchableOpacity>

                {cuentas.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    style={[styles.paymentPill, metodoPagoSeleccionadoId === c.id && styles.paymentPillActive]}
                    onPress={() => setMetodoPagoSeleccionadoId(c.id)}
                  >
                    <Text style={[styles.paymentPillText, metodoPagoSeleccionadoId === c.id && styles.paymentPillTextActive]}>
                      💰 {c.nombre} ({c.moneda})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL EDITAR PRECIOS --- */}
      <Modal visible={modalPrecios} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✏️ Editar Precios de Venta</Text>
              <TouchableOpacity onPress={() => setModalPrecios(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={{marginBottom: 15, fontWeight: 'bold', color: '#1A1A1A'}}>{productoEdicion?.nombre}</Text>

              <Text style={styles.inputLabel}>Precio Detal (COP) *</Text>
              <TextInput style={[styles.inputField, {outlineStyle:'none'} as any]} value={precioDetalEdit} onChangeText={setPrecioDetalEdit} keyboardType="numeric" />

              <Text style={styles.inputLabel}>Precio Mayor (COP) *</Text>
              <TextInput style={[styles.inputField, {outlineStyle:'none'} as any]} value={precioMayorEdit} onChangeText={setPrecioMayorEdit} keyboardType="numeric" />

              {guardandoPrecios ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 20}} /> : (
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={guardarPreciosVenta}>
                  <Text style={styles.modalSubmitBtnText}>Guardar Cambios</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5', width: '100%', maxWidth: 1400, marginHorizontal: 'auto' },
  leftPanel: { padding: 20, backgroundColor: '#FAF8F5', flex: 1 },
  rightPanel: { padding: 20, backgroundColor: '#FFF', elevation: 5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 },
  title: { fontSize: 26, fontWeight: '900', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 5 },
  
  btnNuevoProducto: { backgroundColor: '#10B981', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, elevation: 2 },
  btnNuevoProductoText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

  searchInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 15, fontSize: 15, marginBottom: 20 },
  
  productosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, paddingBottom: 50 },
  productoCard: { backgroundColor: '#FFF', width: 150, borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, borderWidth: 1, borderColor: '#F3F4F6' },
  productoImageContainer: { width: '100%', height: 120, backgroundColor: '#F3F4F6' },
  productoImageFull: { width: '100%', height: '100%', resizeMode: 'cover' },
  productoIconFull: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  productoInfoContainer: { padding: 12 },
  skuText: { fontSize: 11, color: '#9CA3AF', fontWeight: 'bold', marginBottom: 2 },
  productoNombre: { fontSize: 13, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  productoCostoAnt: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  productoStockGrid: { fontSize: 11, color: '#10B981', fontWeight: 'bold', marginTop: 2 },

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
  
  cartItem: { flexDirection: 'column', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  cartItemName: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  costoLabel: { fontSize: 12, color: '#6B7280', fontWeight: 'bold' },
  costoInput: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, minWidth: 70, maxWidth: 90, fontWeight: 'bold' },
  
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8 },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  qtyBtnText: { fontSize: 16, fontWeight: 'bold', color: '#4B5563' },
  qtyText: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A', minWidth: 20, textAlign: 'center' },
  
  cartItemTotal: { fontSize: 15, fontWeight: '900', color: '#6B0D23', minWidth: 70, textAlign: 'right' },
  deleteText: { fontSize: 12, color: '#EF4444', fontWeight: 'bold' },
  editPriceText: { color: '#4B5563', fontSize: 12, fontWeight: 'bold' },

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
  inputField: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 15 },
  imageEditBtn: { alignItems: 'center', justifyContent: 'center' },
  imageEditPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  imageEditPreview: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: '#E5E7EB' },
  imageEditText: { fontSize: 12, color: '#6B0D23', fontWeight: 'bold', marginTop: 8 },
  infoBox: { backgroundColor: '#EFF6FF', padding: 15, borderRadius: 12, marginTop: 10 },
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
  closeSheetText: { color: '#6B7280', fontWeight: 'bold', fontSize: 14 },

  // Pills de Pagos
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  paymentPill: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#F3F4F6', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  paymentPillActive: { backgroundColor: '#6B0D23', borderColor: '#6B0D23' },
  paymentPillText: { fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  paymentPillTextActive: { color: '#FFF' }
});
