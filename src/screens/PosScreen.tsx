import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, useWindowDimensions, Modal } from 'react-native';
import { supabase } from '../../supabase';

type Producto = any;
type ItemCarrito = { producto: Producto; cantidad: number; tipoPrecio: 'detal' | 'mayor'; };
type Entidad = any;

export default function PosScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 1024;
  
  const [productos, setProductos] = useState<Producto[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Tasas de cambio y Cuentas Dinámicas de Supabase
  const [tasaUSD, setTasaUSD] = useState(1);
  const [tasaVES, setTasaVES] = useState(1);
  const [metodosPago, setMetodosPago] = useState<any[]>([]);

  // Estados del Carrito y UI
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [carritoVisibleMovil, setCarritoVisibleMovil] = useState(false);
  
  // Estados del Checkout (Pago)
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [metodoPagoSeleccionadoId, setMetodoPagoSeleccionadoId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const { data: prodData } = await supabase.from('productos').select('*').gt('stock_actual', 0).order('nombre');
      if (prodData) setProductos(prodData);

      const { data: entData } = await supabase.from('entidades').select('*').eq('tipo', 'Cliente').order('nombre');
      if (entData) setEntidades(entData);

      const { data: tasasData } = await supabase.from('tasas_cambio').select('*');
      if (tasasData) {
        const usd = tasasData.find(t => t.moneda === 'USD');
        const ves = tasasData.find(t => t.moneda === 'VES');
        if (usd) setTasaUSD(usd.tasa_en_cop || 1);
        if (ves) setTasaVES(ves.tasa_en_cop || 1);
      }

      const { data: cuentasData } = await supabase.from('cuentas').select('*');
      const cuentasActivas = (cuentasData || []).filter(c => c.activo === true);
        
      const existeSan = cuentasActivas.some(c => c.tipo?.toLowerCase() === 'deuda' || c.nombre?.toLowerCase().includes('san'));
      if (!existeSan) {
          cuentasActivas.push({
              id: 'san-credito-fallback',
              nombre: 'San / Crédito',
              tipo: 'DEUDA',
              moneda: 'COP',
              saldo_actual: 0,
              activo: true
          });
      }

      setMetodosPago(cuentasActivas);
      if (cuentasActivas.length > 0) {
        setMetodoPagoSeleccionadoId(cuentasActivas[0].id);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    (p.codigo_sku && p.codigo_sku.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const agregarAlCarrito = (producto: Producto) => {
    const existe = carrito.find(item => item.producto.id === producto.id);
    if (existe) {
      if (existe.cantidad >= producto.stock_actual) return alert('Stock máximo alcanzado');
      setCarrito(carrito.map(item => item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item));
    } else {
      setCarrito([...carrito, { producto, cantidad: 1, tipoPrecio: 'detal' }]);
    }
  };

  const modificarCantidad = (id: string, delta: number) => {
    setCarrito(carrito.map(item => {
      if (item.producto.id === id) {
        const nuevaCantidad = item.cantidad + delta;
        if (nuevaCantidad > item.producto.stock_actual) { alert('Stock máximo'); return item; }
        return { ...item, cantidad: nuevaCantidad };
      }
      return item;
    }).filter(item => item.cantidad > 0));
  };

  const cambiarTipoPrecio = (id: string, tipo: 'detal' | 'mayor') => {
    setCarrito(carrito.map(item => item.producto.id === id ? { ...item, tipoPrecio: tipo } : item));
  };

  const limpiarCarrito = () => {
    setCarrito([]);
    if (!isDesktop) setCarritoVisibleMovil(false);
  };

  const totalCOP = carrito.reduce((sum, item) => {
    const precio = item.tipoPrecio === 'detal' ? item.producto.precio_detal_cop : item.producto.precio_mayor_cop;
    return sum + (precio * item.cantidad);
  }, 0);

  const totalUSD = totalCOP / tasaUSD;
  const totalVES = totalCOP / tasaVES;

  const abrirCheckout = () => {
    if (carrito.length === 0) return;
    setClienteId('');
    setBusquedaCliente('');
    
    if (!isDesktop) {
      setCarritoVisibleMovil(false);
      setTimeout(() => setCheckoutModal(true), 300); 
    } else {
      setCheckoutModal(true);
    }
  };

  const confirmarVentaFinal = async () => {
    const cuentaDestino = metodosPago.find(c => c.id === metodoPagoSeleccionadoId);
    const esDeuda = cuentaDestino?.tipo?.toLowerCase() === 'deuda' || cuentaDestino?.nombre?.toLowerCase().includes('san');
    
    if (esDeuda && !clienteId) {
      return alert('Debes seleccionar un cliente del directorio para registrar el Crédito / San.');
    }
    
    setProcesando(true);
    try {
      // 1. Crear el registro maestro de la VENTA
      const { data: ventaData, error: ventaError } = await supabase.from('ventas').insert([{
        entidad_id: clienteId || null,
        monto_total: totalCOP,
        metodo_pago_id: cuentaDestino?.id === 'san-credito-fallback' ? null : cuentaDestino?.id
      }]).select().single();

      if (ventaError) throw ventaError;

      // 2. Registrar los ÍTEMS de la venta
      const itemsPayload = carrito.map(item => ({
        venta_id: ventaData.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.tipoPrecio === 'detal' ? item.producto.precio_detal_cop : item.producto.precio_mayor_cop,
        subtotal: (item.tipoPrecio === 'detal' ? item.producto.precio_detal_cop : item.producto.precio_mayor_cop) * item.cantidad
      }));
      await supabase.from('ventas_items').insert(itemsPayload);

      // 3. Restar inventario
      for (const item of carrito) {
        const nuevoStock = item.producto.stock_actual - item.cantidad;
        await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', item.producto.id);
      }
      
      // 4. Si es San/Crédito, inyectar a la tabla Sanes
      if (esDeuda) {
        await supabase.from('sanes').insert([{
           entidad_id: clienteId,
           monto_total: totalCOP,
           saldo_pendiente: totalCOP,
           estado: 'ACTIVO',
           frecuencia_pago: 'Quincenal' // Frecuencia por defecto
        }]);
        alert('¡Venta a crédito registrada y San creado exitosamente!');
      } 
      // 5. Si NO es deuda, ingresar el dinero al flujo de caja
      else if (cuentaDestino && cuentaDestino.id !== 'san-credito-fallback') {
        let montoFinal = totalCOP;
        if (cuentaDestino.moneda === 'USD') montoFinal = totalUSD;
        if (cuentaDestino.moneda === 'VES') montoFinal = totalVES;

        const nombreCli = entidades.find(e => e.id === clienteId)?.nombre || '';
        await supabase.from('movimientos_caja').insert([{
          cuenta_id: cuentaDestino.id,
          tipo_movimiento: 'Ingreso',
          monto: montoFinal,
          descripcion: `POS Venta. ${nombreCli ? 'Cliente: ' + nombreCli : ''}`
        }]);
        alert('¡Venta completada con éxito!');
      }
      
      setCheckoutModal(false);
      limpiarCarrito();
      
      // Recargar catálogo
      const { data } = await supabase.from('productos').select('*').gt('stock_actual', 0).order('nombre');
      if (data) setProductos(data);
    } catch (error) {
      console.error(error);
      alert('Error al procesar la venta. Revisa la consola.');
    } finally {
      setProcesando(false);
    }
  };

  const cuentaDestinoUi = metodosPago.find(c => c.id === metodoPagoSeleccionadoId);
  const esDeudaUi = cuentaDestinoUi?.tipo?.toLowerCase() === 'deuda' || cuentaDestinoUi?.nombre?.toLowerCase().includes('san');

  const TicketCart = () => (
    <View style={styles.ticketCard}>
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketTitle}>Resumen de Venta</Text>
        {carrito.length > 0 && <TouchableOpacity onPress={limpiarCarrito}><Text style={styles.clearText}>Vaciar</Text></TouchableOpacity>}
      </View>

      <ScrollView style={styles.cartItemsList} showsVerticalScrollIndicator={false}>
        {carrito.length === 0 ? (
          <View style={styles.emptyCart}><Text style={{color: '#9CA3AF'}}>El carrito está vacío</Text></View>
        ) : (
          carrito.map((item) => (
            <View key={item.producto.id} style={styles.cartItem}>
              <View style={{flex: 1}}>
                <Text style={styles.cartItemName} numberOfLines={1}>{item.producto.nombre}</Text>
                <View style={styles.priceTypeRow}>
                  <TouchableOpacity style={[styles.priceTypeBtn, item.tipoPrecio === 'detal' && styles.priceTypeActive]} onPress={() => cambiarTipoPrecio(item.producto.id, 'detal')}>
                    <Text style={[styles.priceTypeText, item.tipoPrecio === 'detal' && styles.priceTypeTextActive]}>Detal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.priceTypeBtn, item.tipoPrecio === 'mayor' && styles.priceTypeActive]} onPress={() => cambiarTipoPrecio(item.producto.id, 'mayor')}>
                    <Text style={[styles.priceTypeText, item.tipoPrecio === 'mayor' && styles.priceTypeTextActive]}>Mayor</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.qtyControls}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => modificarCantidad(item.producto.id, -1)}><Text style={styles.qtyText}>-</Text></TouchableOpacity>
                <Text style={styles.qtyValue}>{item.cantidad}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => modificarCantidad(item.producto.id, 1)}><Text style={styles.qtyText}>+</Text></TouchableOpacity>
              </View>
              <Text style={styles.cartItemTotal}>${((item.tipoPrecio === 'detal' ? item.producto.precio_detal_cop : item.producto.precio_mayor_cop) * item.cantidad).toLocaleString()}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.totalsArea}>
        <View style={styles.totalRow}><Text style={styles.totalLabelSub}>Total USD:</Text><Text style={styles.totalValueSub}>$ {totalUSD.toFixed(2)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.totalLabelSub}>Total VES:</Text><Text style={styles.totalValueSub}>Bs. {totalVES.toFixed(2)}</Text></View>
        <View style={[styles.totalRow, {marginTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 10}]}>
          <Text style={styles.totalLabelMain}>Total (COP):</Text>
          <Text style={styles.totalValueMain}>${totalCOP.toLocaleString()}</Text>
        </View>
      </View>

      <TouchableOpacity style={[styles.checkoutBtn, carrito.length === 0 && styles.checkoutBtnDisabled]} disabled={carrito.length === 0} onPress={abrirCheckout}>
        <Text style={styles.checkoutText}>Cobrar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, isDesktop && styles.rowLayout]}>
      
      {/* SECCIÓN IZQUIERDA: CATÁLOGO */}
      <View style={styles.catalogoSection}>
        <View style={styles.header}>
          <Text style={styles.title}>Caja Rápida</Text>
          <View style={styles.searchBox}>
            <TextInput style={[styles.searchInput, {outlineStyle: 'none'} as any]} placeholder="Buscar producto..." value={busqueda} onChangeText={setBusqueda} />
          </View>
        </View>

        {loading ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 50}} /> : (
          <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
            {productosFiltrados.map((prod) => (
              <TouchableOpacity key={prod.id} style={[styles.prodCard, !isDesktop && { width: '47%' }]} onPress={() => agregarAlCarrito(prod)}>
                <Image source={{ uri: prod.imagen_url || 'https://via.placeholder.com/150?text=S/F' }} style={styles.prodImg} />
                <View style={styles.prodInfo}>
                  <Text style={styles.prodName} numberOfLines={2}>{prod.nombre}</Text>
                  <Text style={styles.prodPrice}>${prod.precio_detal_cop.toLocaleString()}</Text>
                  <Text style={styles.prodStock}>Stock: {prod.stock_actual}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* SECCIÓN DERECHA: TICKET (Solo Escritorio) */}
      {isDesktop && (
        <View style={styles.ticketSectionDesktop}>
          <TicketCart />
        </View>
      )}

      {/* BOTÓN FLOTANTE (Solo Móvil) */}
      {!isDesktop && carrito.length > 0 && (
        <TouchableOpacity style={styles.floatingCartBtn} onPress={() => setCarritoVisibleMovil(true)}>
          <Text style={styles.floatingCartText}>🛒 Ver Carrito ({carrito.length}) - ${totalCOP.toLocaleString()}</Text>
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
              <TicketCart />
            </View>
          </View>
        </Modal>
      )}

      {/* --- MODAL: CHECKOUT (PAGO) --- */}
      <Modal visible={checkoutModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.checkoutCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirmar Venta</Text>
                <TouchableOpacity onPress={() => setCheckoutModal(false)}><Text style={styles.modalCloseText}>✕</Text></TouchableOpacity>
              </View>
              
              <View style={styles.checkoutContent}>
                <View style={styles.amountBanner}>
                  <Text style={styles.amountLabel}>Total a cobrar:</Text>
                  <Text style={styles.amountValue}>${totalCOP.toLocaleString()} COP</Text>
                  <Text style={styles.amountSubValue}>USD: ${totalUSD.toFixed(2)}  |  VES: Bs.{totalVES.toFixed(2)}</Text>
                </View>

                <Text style={styles.label}>Método de Pago / Cuenta</Text>
                <View style={styles.pillsContainer}>
                  {metodosPago.map(cuenta => (
                    <TouchableOpacity 
                      key={cuenta.id} 
                      style={[styles.paymentPill, metodoPagoSeleccionadoId === cuenta.id && styles.paymentPillActive]}
                      onPress={() => setMetodoPagoSeleccionadoId(cuenta.id)}
                    >
                      <Text style={[styles.paymentPillText, metodoPagoSeleccionadoId === cuenta.id && styles.paymentPillTextActive]}>{cuenta.nombre}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Cliente {esDeudaUi ? '(Obligatorio para Créditos)' : '(Opcional)'}</Text>
                <TextInput 
                  style={[styles.input, {marginBottom: 10, outlineStyle: 'none'} as any, esDeudaUi && !clienteId && {borderColor: '#DC2626', borderWidth: 2}]} 
                  placeholder="Buscar en directorio..." 
                  value={busquedaCliente} 
                  onChangeText={setBusquedaCliente} 
                />
                
                <View style={[styles.pillsContainer, { maxHeight: 150, overflow: 'hidden' }]}>
                  {entidades.filter(e => e.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())).slice(0, 10).map(ent => (
                    <TouchableOpacity 
                      key={ent.id} 
                      style={[styles.paymentPill, clienteId === ent.id && styles.paymentPillActive]}
                      onPress={() => setClienteId(clienteId === ent.id ? '' : ent.id)}
                    >
                      <Text style={[styles.paymentPillText, clienteId === ent.id && styles.paymentPillTextActive]}>{ent.nombre}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {procesando ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 20}} /> : (
                  <TouchableOpacity style={styles.vinotintoBtn} onPress={confirmarVentaFinal}>
                    <Text style={styles.vinotintoBtnText}>{esDeudaUi ? 'Vender a Crédito / San' : 'Completar y Cobrar'}</Text>
                  </TouchableOpacity>
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
  container: { flex: 1, padding: 15 },
  rowLayout: { flexDirection: 'row', gap: 20 },
  
  // --- CATÁLOGO ---
  catalogoSection: { flex: 1 },
  header: { marginBottom: 15 },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 10 },
  searchBox: { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 15, height: 45, justifyContent: 'center', elevation: 2, shadowOpacity: 0.05 },
  searchInput: { fontSize: 15 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 80 },
  prodCard: { backgroundColor: '#FFF', width: 140, borderRadius: 16, overflow: 'hidden', elevation: 2, shadowOpacity: 0.05 },
  prodImg: { width: '100%', height: 100, backgroundColor: '#F3F4F6' },
  prodInfo: { padding: 10 },
  prodName: { fontSize: 12, fontWeight: '600', color: '#374151', height: 32, marginBottom: 5 },
  prodPrice: { fontSize: 13, fontWeight: 'bold', color: '#6B0D23' },
  prodStock: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  // --- TICKET ---
  ticketSectionDesktop: { width: 380, height: '100%' },
  ticketCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, flex: 1, elevation: 5, shadowColor: '#6B0D23', shadowOpacity: 0.08, shadowRadius: 20 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  ticketTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  clearText: { color: '#DC2626', fontSize: 12, fontWeight: 'bold' },
  cartItemsList: { flex: 1, marginBottom: 15 },
  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 150 },
  cartItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  cartItemName: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', marginBottom: 5 },
  priceTypeRow: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 6, alignSelf: 'flex-start', padding: 2 },
  priceTypeBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  priceTypeActive: { backgroundColor: '#FFF', elevation: 1 },
  priceTypeText: { fontSize: 10, color: '#6B7280', fontWeight: 'bold' },
  priceTypeTextActive: { color: '#6B0D23' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  qtyText: { fontSize: 14, fontWeight: 'bold', color: '#6B0D23' },
  qtyValue: { fontSize: 13, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  cartItemTotal: { fontSize: 13, fontWeight: 'bold', color: '#1A1A1A', width: 70, textAlign: 'right' },
  totalsArea: { backgroundColor: '#FAF8F5', padding: 15, borderRadius: 16, marginBottom: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  totalLabelSub: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  totalValueSub: { color: '#374151', fontSize: 13, fontWeight: 'bold' },
  totalLabelMain: { color: '#1A1A1A', fontSize: 16, fontWeight: '800' },
  totalValueMain: { color: '#6B0D23', fontSize: 18, fontWeight: '900' },
  checkoutBtn: { backgroundColor: '#6B0D23', padding: 18, borderRadius: 16, alignItems: 'center' },
  checkoutBtnDisabled: { backgroundColor: '#D1D5DB' },
  checkoutText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // --- ELEMENTOS MÓVILES ---
  floatingCartBtn: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#1A1A1A', padding: 16, borderRadius: 16, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  floatingCartText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  modalOverlaySlide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  mobileCartSheet: { backgroundColor: '#FAF8F5', height: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 15, paddingBottom: 30 },
  closeSheetBtn: { alignItems: 'center', paddingBottom: 15 },
  closeSheetText: { color: '#6B7280', fontWeight: 'bold', fontSize: 14 },

  // --- MODAL CHECKOUT ---
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  checkoutCard: { backgroundColor: '#FFF', width: '100%', maxWidth: 450, borderRadius: 24, overflow: 'hidden', elevation: 10, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  modalCloseText: { fontSize: 20, color: '#9CA3AF', fontWeight: 'bold', paddingHorizontal: 10 },
  checkoutContent: { padding: 20 },
  amountBanner: { backgroundColor: '#FAF8F5', padding: 15, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  amountLabel: { fontSize: 12, color: '#6B7280', fontWeight: 'bold', marginBottom: 5 },
  amountValue: { fontSize: 26, fontWeight: '900', color: '#6B0D23', marginBottom: 5 },
  amountSubValue: { fontSize: 12, color: '#374151', fontWeight: '600' },
  label: { fontSize: 13, color: '#374151', fontWeight: 'bold', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14 },
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  paymentPill: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  paymentPillActive: { backgroundColor: '#6B0D23', borderColor: '#6B0D23' },
  paymentPillText: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  paymentPillTextActive: { color: '#FFF' },
  vinotintoBtn: { backgroundColor: '#6B0D23', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  vinotintoBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});