import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, useWindowDimensions } from 'react-native';
import { supabase } from '../../supabase';

type Deuda = any;
type Entidad = any;
type Cuenta = any;

export default function CuentasPorPagarScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'ACTIVA' | 'PAGADA'>('ACTIVA');

  // Tasas de cambio
  const [tasaUSD, setTasaUSD] = useState(1);
  const [tasaVES, setTasaVES] = useState(1);

  // Modal Nueva Deuda
  const [modalNuevaDeuda, setModalNuevaDeuda] = useState(false);
  const [nuevaEntidadId, setNuevaEntidadId] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [nuevaFrecuencia, setNuevaFrecuencia] = useState('Quincenal');
  const [procesando, setProcesando] = useState(false);

  // Modal Pago
  const [modalPago, setModalPago] = useState(false);
  const [deudaSeleccionada, setDeudaSeleccionada] = useState<Deuda | null>(null);
  const [cuentaPagoId, setCuentaPagoId] = useState('');
  const [montoPago, setMontoPago] = useState('');

  const frecuencias = ['Semanal', 'Quincenal', 'Mensual'];

  const fetchData = async () => {
    setLoading(true);
    
    // Cargar Tasas
    const { data: tasasData } = await supabase.from('tasas_cambio').select('*');
    if (tasasData) {
      const usd = tasasData.find(t => t.moneda === 'USD');
      const ves = tasasData.find(t => t.moneda === 'VES');
      if (usd) setTasaUSD(usd.tasa_en_cop || 1);
      if (ves) setTasaVES(ves.tasa_en_cop || 1);
    }

    // Cargar Deudas
    const { data: deudasData } = await supabase
      .from('cuentas_por_pagar')
      .select('*, entidades(nombre, telefono)')
      .order('fecha_creacion', { ascending: false });
    
    if (deudasData) setDeudas(deudasData);

    // Cargar Proveedores / Entidades
    const { data: entData } = await supabase.from('entidades').select('*').order('nombre');
    if (entData) setEntidades(entData);

    // Cargar Cuentas
    const { data: cuenData } = await supabase.from('cuentas').select('*').eq('activo', true).neq('tipo', 'DEUDA');
    if (cuenData) {
      setCuentas(cuenData);
      if (cuenData.length > 0 && !cuentaPagoId) setCuentaPagoId(cuenData[0].id);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const crearDeuda = async () => {
    if (!nuevaEntidadId) return alert('Selecciona un proveedor/entidad.');
    if (!nuevoMonto || isNaN(Number(nuevoMonto)) || Number(nuevoMonto) <= 0) return alert('Monto inválido.');

    setProcesando(true);
    try {
      const payload = {
        entidad_id: nuevaEntidadId,
        monto_total: Number(nuevoMonto),
        saldo_pendiente: Number(nuevoMonto),
        estado: 'ACTIVA'
      };

      const { error } = await supabase.from('cuentas_por_pagar').insert([payload]);
      if (error) throw error;

      alert('Deuda registrada con éxito');
      setModalNuevaDeuda(false);
      setNuevoMonto('');
      fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const getCuentaSeleccionada = () => cuentas.find(c => c.id === cuentaPagoId);

  // Calcular equivalencia en COP al vuelo
  const getEquivalenciaCOP = () => {
    const cuenta = getCuentaSeleccionada();
    if (!cuenta || !montoPago || isNaN(Number(montoPago))) return 0;
    
    const pago = Number(montoPago);
    if (cuenta.moneda === 'COP') return pago;
    if (cuenta.moneda === 'USD') return pago * tasaUSD;
    if (cuenta.moneda === 'VES') return pago * tasaVES;
    return pago;
  };

  const pagoCOP = getEquivalenciaCOP();

  const registrarPago = async () => {
    if (!deudaSeleccionada) return;
    if (!cuentaPagoId) return alert('Selecciona una cuenta de origen del dinero.');
    if (!montoPago || isNaN(Number(montoPago)) || Number(montoPago) <= 0) return alert('Monto inválido.');
    
    // Validación: No pagar de más
    if (pagoCOP > deudaSeleccionada.saldo_pendiente) {
      return alert(`❌ ¡Error! El pago equivalente (${pagoCOP.toLocaleString()} COP) supera la deuda restante (${deudaSeleccionada.saldo_pendiente.toLocaleString()} COP).`);
    }

    setProcesando(true);
    try {
      const { error } = await supabase.from('pagos_cuentas_pagar').insert([{
        deuda_id: deudaSeleccionada.id,
        cuenta_id: cuentaPagoId,
        monto_pagado_cuenta: Number(montoPago),
        monto_pagado_cop: pagoCOP
      }]);

      if (error) throw error;

      await supabase.from('movimientos_caja').insert([{
        cuenta_id: cuentaPagoId,
        tipo_movimiento: 'Egreso',
        monto: Number(montoPago),
        descripcion: `Pago de Deuda. Proveedor: ${deudaSeleccionada.entidades?.nombre || 'Desconocido'}`
      }]);

      alert('¡Pago registrado correctamente! Se descontó de tu flujo de caja.');
      setModalPago(false);
      setMontoPago('');
      setDeudaSeleccionada(null);
      fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const getProgreso = (deuda: Deuda) => {
    const pagado = deuda.monto_total - deuda.saldo_pendiente;
    return (pagado / deuda.monto_total) * 100;
  };

  const deudasFiltradas = deudas.filter(d => {
    const coincideFiltro = d.estado === filtroEstado;
    const coincideBusqueda = d.entidades?.nombre?.toLowerCase().includes(busqueda.toLowerCase());
    return coincideFiltro && (!busqueda ? true : coincideBusqueda);
  });

  const totalDeudaActiva = deudas.filter(d => d.estado === 'ACTIVA').reduce((sum, d) => sum + Number(d.saldo_pendiente), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cuentas por Pagar</Text>
          <Text style={styles.subtitle}>Dinero que debemos: <Text style={{fontWeight: 'bold', color: '#DC2626'}}>${totalDeudaActiva.toLocaleString()} COP</Text></Text>
        </View>
        <TouchableOpacity style={styles.btnNuevo} onPress={() => setModalNuevaDeuda(true)}>
          <Text style={styles.btnNuevoText}>+ Registrar Deuda</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <TextInput 
          style={[styles.searchInput, {outlineStyle: 'none'} as any, isDesktop ? {width: 300} : {flex: 1}]} 
          placeholder="Buscar proveedor..." 
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tab, filtroEstado === 'ACTIVA' && styles.tabActive]} onPress={() => setFiltroEstado('ACTIVA')}>
            <Text style={[styles.tabText, filtroEstado === 'ACTIVA' && styles.tabTextActive]}>Deudas Activas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, filtroEstado === 'PAGADA' && styles.tabActive]} onPress={() => setFiltroEstado('PAGADA')}>
            <Text style={[styles.tabText, filtroEstado === 'PAGADA' && styles.tabTextActive]}>Deudas Pagadas</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? <ActivityIndicator size="large" color="#DC2626" style={{marginTop: 50}} /> : (
        <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
          {deudasFiltradas.length === 0 ? (
            <Text style={styles.emptyText}>No hay registros en esta categoría.</Text>
          ) : (
            deudasFiltradas.map(deuda => {
              const progreso = getProgreso(deuda);
              return (
                <View key={deuda.id} style={[styles.card, !isDesktop && { width: '100%' }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{deuda.entidades?.nombre?.charAt(0)}</Text>
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={styles.cardName} numberOfLines={1}>{deuda.entidades?.nombre}</Text>
                      <Text style={styles.cardFreq}>A Pagar</Text>
                    </View>
                    {deuda.estado === 'PAGADA' && <View style={styles.badgeSuccess}><Text style={styles.badgeSuccessText}>PAGADA</Text></View>}
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Total Deuda:</Text>
                      <Text style={styles.amountValue}>${deuda.monto_total.toLocaleString()}</Text>
                    </View>
                    <View style={styles.amountRow}>
                      <Text style={[styles.amountLabel, {color: '#DC2626', fontWeight: 'bold'}]}>Por Pagar:</Text>
                      <Text style={[styles.amountValue, {color: '#DC2626', fontSize: 18}]}>${deuda.saldo_pendiente.toLocaleString()}</Text>
                    </View>

                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBar, { width: `${progreso}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{progreso.toFixed(0)}% Pagado</Text>
                  </View>

                  {deuda.estado === 'ACTIVA' && (
                    <TouchableOpacity style={styles.abonoBtn} onPress={() => { setDeudaSeleccionada(deuda); setModalPago(true); }}>
                      <Text style={styles.abonoBtnText}>📤 Registrar Pago</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* --- MODAL: NUEVA DEUDA --- */}
      <Modal visible={modalNuevaDeuda} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Deuda de la Empresa</Text>
              <TouchableOpacity onPress={() => setModalNuevaDeuda(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>A quién le debemos (Del Directorio) *</Text>
              <View style={styles.pillsContainer}>
                {entidades.map(ent => (
                  <TouchableOpacity 
                    key={ent.id} 
                    style={[styles.pill, nuevaEntidadId === ent.id && styles.pillActive]}
                    onPress={() => setNuevaEntidadId(ent.id)}
                  >
                    <Text style={[styles.pillText, nuevaEntidadId === ent.id && styles.pillTextActive]}>{ent.nombre}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Monto Total de la Deuda (COP) *</Text>
              <TextInput 
                style={[styles.input, {outlineStyle: 'none'} as any]} 
                placeholder="0.00" 
                keyboardType="numeric"
                value={nuevoMonto}
                onChangeText={setNuevoMonto}
              />

              {procesando ? <ActivityIndicator size="large" color="#DC2626" style={{marginTop: 20}} /> : (
                <TouchableOpacity style={styles.submitBtn} onPress={crearDeuda}>
                  <Text style={styles.submitBtnText}>Registrar Deuda</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: REGISTRAR PAGO --- */}
      <Modal visible={modalPago} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pago a Proveedor</Text>
              <TouchableOpacity onPress={() => setModalPago(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={{marginBottom: 20, backgroundColor: '#F9FAFB', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB'}}>
                <Text style={{fontSize: 14, color: '#4B5563', marginBottom: 5}}>
                  Proveedor: <Text style={{fontWeight: 'bold', color: '#1A1A1A'}}>{deudaSeleccionada?.entidades?.nombre}</Text>
                </Text>
                <Text style={{fontSize: 14, color: '#4B5563', marginBottom: 5}}>
                  Debemos: <Text style={{fontWeight: 'bold', color: '#DC2626'}}>${deudaSeleccionada?.saldo_pendiente.toLocaleString()} COP</Text>
                </Text>
                <Text style={{fontSize: 12, color: '#6B7280'}}>
                  USD: ${(deudaSeleccionada?.saldo_pendiente / tasaUSD).toFixed(2)}  |  VES: Bs.${(deudaSeleccionada?.saldo_pendiente / tasaVES).toFixed(2)}
                </Text>
              </View>

              <Text style={styles.label}>¿De qué cuenta salió el dinero? *</Text>
              <View style={styles.pillsContainer}>
                {cuentas.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    style={[styles.pill, cuentaPagoId === c.id && styles.pillActive]}
                    onPress={() => setCuentaPagoId(c.id)}
                  >
                    <Text style={[styles.pillText, cuentaPagoId === c.id && styles.pillTextActive]}>{c.nombre}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Monto pagado en {getCuentaSeleccionada()?.moneda || ''} *</Text>
              <TextInput 
                style={[styles.input, {outlineStyle: 'none'} as any, {marginBottom: 10}]} 
                placeholder="0.00" 
                keyboardType="numeric"
                value={montoPago}
                onChangeText={setMontoPago}
              />
              
              <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
                {[
                  { label: 'Total', pct: 1 },
                  { label: 'Mitad', pct: 0.5 },
                  { label: 'Un cuarto', pct: 0.25 }
                ].map(opcion => {
                  const saldoCOP = deudaSeleccionada?.saldo_pendiente || 0;
                  const copValue = saldoCOP * opcion.pct;
                  const isCOP = getCuentaSeleccionada()?.moneda === 'COP';
                  const isUSD = getCuentaSeleccionada()?.moneda === 'USD';
                  const finalVal = isCOP ? Math.round(copValue) : (isUSD ? copValue / tasaUSD : copValue / tasaVES);
                  const displayVal = isCOP ? finalVal.toString() : finalVal.toFixed(2);
                  
                  return (
                    <TouchableOpacity 
                      key={opcion.label}
                      style={styles.quickPayBtn}
                      onPress={() => setMontoPago(displayVal)}
                    >
                      <Text style={styles.quickPayBtnText}>{opcion.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Conversión en tiempo real */}
              {montoPago !== '' && getCuentaSeleccionada()?.moneda !== 'COP' && (
                <View style={styles.conversionBox}>
                  <Text style={styles.conversionText}>
                    Equivale a un descuento de: <Text style={{fontWeight: 'bold'}}>${pagoCOP.toLocaleString()} COP</Text>
                  </Text>
                  {pagoCOP > (deudaSeleccionada?.saldo_pendiente || 0) && (
                    <Text style={{color: '#DC2626', fontSize: 12, marginTop: 5, fontWeight: 'bold'}}>
                      ⚠️ Estás pagando más de lo que debes.
                    </Text>
                  )}
                </View>
              )}

              {procesando ? <ActivityIndicator size="large" color="#DC2626" style={{marginTop: 20}} /> : (
                <TouchableOpacity 
                  style={[styles.submitBtnSuccess, pagoCOP > (deudaSeleccionada?.saldo_pendiente || 0) && {backgroundColor: '#9CA3AF'}]} 
                  onPress={registrarPago}
                  disabled={pagoCOP > (deudaSeleccionada?.saldo_pendiente || 0)}
                >
                  <Text style={styles.submitBtnText}>Confirmar Pago</Text>
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
  container: { flex: 1, padding: 20, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 },
  title: { fontSize: 28, fontWeight: '900', color: '#1A1A1A' },
  subtitle: { fontSize: 15, color: '#4B5563', marginTop: 5 },
  btnNuevo: { backgroundColor: '#DC2626', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, elevation: 2 },
  btnNuevoText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20, flexWrap: 'wrap' },
  searchInput: { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 15, height: 45, borderWidth: 1, borderColor: '#E5E7EB' },
  tabsContainer: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 12, padding: 4 },
  tab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  tabActive: { backgroundColor: '#FFF', elevation: 1 },
  tabText: { fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  tabTextActive: { color: '#1A1A1A' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, paddingBottom: 50 },
  card: { backgroundColor: '#FFF', width: 340, borderRadius: 20, padding: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  avatar: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#DC2626' },
  cardName: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 2 },
  cardFreq: { fontSize: 12, color: '#6B7280' },
  badgeSuccess: { backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeSuccessText: { color: '#047857', fontSize: 10, fontWeight: 'bold' },
  
  cardBody: { marginBottom: 15 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  amountLabel: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  amountValue: { fontSize: 15, color: '#1A1A1A', fontWeight: 'bold' },
  
  progressContainer: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden', marginVertical: 10 },
  progressBar: { height: '100%', backgroundColor: '#10B981' },
  progressText: { fontSize: 11, color: '#6B7280', textAlign: 'right', fontWeight: 'bold' },

  abonoBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', padding: 12, borderRadius: 12, alignItems: 'center' },
  abonoBtnText: { color: '#DC2626', fontWeight: 'bold', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', width: '100%', marginTop: 40 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', width: '100%', maxWidth: 450, borderRadius: 24, overflow: 'hidden', maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  closeBtn: { fontSize: 20, color: '#9CA3AF', fontWeight: 'bold' },
  modalContent: { padding: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#374151', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 15 },
  
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  pill: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#F3F4F6', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  pillActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  pillText: { fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  pillTextActive: { color: '#FFF' },

  quickPayBtn: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  quickPayBtnText: { fontSize: 12, fontWeight: 'bold', color: '#4B5563' },

  conversionBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginBottom: 15 },
  conversionText: { color: '#92400E', fontSize: 13 },

  submitBtn: { backgroundColor: '#DC2626', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnSuccess: { backgroundColor: '#DC2626', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});
