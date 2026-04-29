import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, useWindowDimensions } from 'react-native';
import { supabase } from '../../supabase';

type San = any;
type Entidad = any;
type Cuenta = any;

export default function SanesScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [sanes, setSanes] = useState<San[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'ACTIVO' | 'PAGADO'>('ACTIVO');

  // Tasas de cambio
  const [tasaUSD, setTasaUSD] = useState(1);
  const [tasaVES, setTasaVES] = useState(1);

  // Modal Nuevo San (Manual)
  const [modalNuevoSan, setModalNuevoSan] = useState(false);
  const [nuevaEntidadId, setNuevaEntidadId] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [nuevaFrecuencia, setNuevaFrecuencia] = useState('Quincenal');
  const [procesando, setProcesando] = useState(false);

  // Modal Abono
  const [modalAbono, setModalAbono] = useState(false);
  const [sanSeleccionado, setSanSeleccionado] = useState<San | null>(null);
  const [cuentaAbonoId, setCuentaAbonoId] = useState('');
  const [montoAbono, setMontoAbono] = useState('');

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

    // Cargar Sanes
    const { data: sanesData } = await supabase
      .from('sanes')
      .select('*, entidades(nombre, telefono)')
      .order('fecha_creacion', { ascending: false });
    
    if (sanesData) setSanes(sanesData);

    // Cargar Entidades
    const { data: entData } = await supabase.from('entidades').select('*').order('nombre');
    if (entData) setEntidades(entData);

    // Cargar Cuentas
    const { data: cuenData } = await supabase.from('cuentas').select('*').eq('activo', true).neq('tipo', 'DEUDA');
    if (cuenData) {
      setCuentas(cuenData);
      if (cuenData.length > 0 && !cuentaAbonoId) setCuentaAbonoId(cuenData[0].id);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const crearSanManual = async () => {
    if (!nuevaEntidadId) return alert('Selecciona un cliente del directorio.');
    if (!nuevoMonto || isNaN(Number(nuevoMonto)) || Number(nuevoMonto) <= 0) return alert('Monto inválido.');

    setProcesando(true);
    try {
      const payload = {
        entidad_id: nuevaEntidadId,
        monto_total: Number(nuevoMonto),
        saldo_pendiente: Number(nuevoMonto),
        frecuencia_pago: nuevaFrecuencia,
        estado: 'ACTIVO'
      };

      const { error } = await supabase.from('sanes').insert([payload]);
      if (error) throw error;

      alert('Deuda/San registrada con éxito');
      setModalNuevoSan(false);
      setNuevoMonto('');
      fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const getCuentaSeleccionada = () => cuentas.find(c => c.id === cuentaAbonoId);

  // Calcular equivalencia en COP al vuelo
  const getEquivalenciaCOP = () => {
    const cuenta = getCuentaSeleccionada();
    if (!cuenta || !montoAbono || isNaN(Number(montoAbono))) return 0;
    
    const abono = Number(montoAbono);
    if (cuenta.moneda === 'COP') return abono;
    if (cuenta.moneda === 'USD') return abono * tasaUSD;
    if (cuenta.moneda === 'VES') return abono * tasaVES;
    return abono;
  };

  const abonoCOP = getEquivalenciaCOP();

  const registrarAbono = async () => {
    if (!sanSeleccionado) return;
    if (!cuentaAbonoId) return alert('Selecciona una cuenta de destino.');
    if (!montoAbono || isNaN(Number(montoAbono)) || Number(montoAbono) <= 0) return alert('Monto inválido.');
    
    // Validación Crucial: No pagar más de lo que debe (usando el equivalente en COP)
    if (abonoCOP > sanSeleccionado.saldo_pendiente) {
      return alert(`❌ ¡Error! El abono equivalente (${abonoCOP.toLocaleString()} COP) supera la deuda restante (${sanSeleccionado.saldo_pendiente.toLocaleString()} COP).`);
    }

    setProcesando(true);
    try {
      const { error } = await supabase.from('pagos_san').insert([{
        san_id: sanSeleccionado.id,
        cuenta_id: cuentaAbonoId,
        monto_abonado_cuenta: Number(montoAbono),
        monto_abonado_cop: abonoCOP
      }]);

      if (error) throw error;

      // await supabase.from('movimientos_caja').insert([{
      //   cuenta_id: cuentaAbonoId,
      //   tipo_movimiento: 'Ingreso',
      //   monto: Number(montoAbono),
      //   descripcion: `Abono de Crédito/San. Cliente: ${sanSeleccionado.entidades?.nombre || 'Desconocido'}`
      // }]);

      alert('¡Abono registrado correctamente con conversión de moneda!');
      setModalAbono(false);
      setMontoAbono('');
      setSanSeleccionado(null);
      fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const getProgreso = (san: San) => {
    const pagado = san.monto_total - san.saldo_pendiente;
    return (pagado / san.monto_total) * 100;
  };

  const sanesFiltrados = sanes.filter(s => {
    const coincideFiltro = s.estado === filtroEstado;
    const coincideBusqueda = s.entidades?.nombre?.toLowerCase().includes(busqueda.toLowerCase());
    return coincideFiltro && (!busqueda ? true : coincideBusqueda);
  });

  const totalDeudaActiva = sanes.filter(s => s.estado === 'ACTIVO').reduce((sum, s) => sum + Number(s.saldo_pendiente), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cuentas por Cobrar</Text>
          <Text style={styles.subtitle}>Dinero en la calle: <Text style={{fontWeight: 'bold', color: '#DC2626'}}>${totalDeudaActiva.toLocaleString()} COP</Text></Text>
        </View>
        <TouchableOpacity style={styles.btnNuevo} onPress={() => setModalNuevoSan(true)}>
          <Text style={styles.btnNuevoText}>+ Nuevo Crédito / San</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <TextInput 
          style={[styles.searchInput, {outlineStyle: 'none'} as any, isDesktop ? {width: 300} : {flex: 1}]} 
          placeholder="Buscar cliente..." 
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tab, filtroEstado === 'ACTIVO' && styles.tabActive]} onPress={() => setFiltroEstado('ACTIVO')}>
            <Text style={[styles.tabText, filtroEstado === 'ACTIVO' && styles.tabTextActive]}>Deudas Activas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, filtroEstado === 'PAGADO' && styles.tabActive]} onPress={() => setFiltroEstado('PAGADO')}>
            <Text style={[styles.tabText, filtroEstado === 'PAGADO' && styles.tabTextActive]}>Sanes Completados</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 50}} /> : (
        <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
          {sanesFiltrados.length === 0 ? (
            <Text style={styles.emptyText}>No hay registros en esta categoría.</Text>
          ) : (
            sanesFiltrados.map(san => {
              const progreso = getProgreso(san);
              return (
                <View key={san.id} style={[styles.card, !isDesktop && { width: '100%' }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{san.entidades?.nombre?.charAt(0)}</Text>
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={styles.cardName} numberOfLines={1}>{san.entidades?.nombre}</Text>
                      <Text style={styles.cardFreq}>Frecuencia: {san.frecuencia_pago}</Text>
                    </View>
                    {san.estado === 'PAGADO' && <View style={styles.badgeSuccess}><Text style={styles.badgeSuccessText}>PAGADO</Text></View>}
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Total Crédito:</Text>
                      <Text style={styles.amountValue}>${san.monto_total.toLocaleString()}</Text>
                    </View>
                    <View style={styles.amountRow}>
                      <Text style={[styles.amountLabel, {color: '#DC2626', fontWeight: 'bold'}]}>Saldo Pendiente:</Text>
                      <Text style={[styles.amountValue, {color: '#DC2626', fontSize: 18}]}>${san.saldo_pendiente.toLocaleString()}</Text>
                    </View>

                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBar, { width: `${progreso}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{progreso.toFixed(0)}% Pagado</Text>
                  </View>

                  {san.estado === 'ACTIVO' && (
                    <TouchableOpacity style={styles.abonoBtn} onPress={() => { setSanSeleccionado(san); setModalAbono(true); }}>
                      <Text style={styles.abonoBtnText}>💰 Registrar Abono</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* --- MODAL: NUEVO SAN MANUAL --- */}
      <Modal visible={modalNuevoSan} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Deuda Manual</Text>
              <TouchableOpacity onPress={() => setModalNuevoSan(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Cliente (Del Directorio) *</Text>
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

              <Text style={styles.label}>Acuerdo de Pago *</Text>
              <View style={styles.freqContainer}>
                {frecuencias.map(f => (
                  <TouchableOpacity 
                    key={f} 
                    style={[styles.freqPill, nuevaFrecuencia === f && styles.freqPillActive]}
                    onPress={() => setNuevaFrecuencia(f)}
                  >
                    <Text style={[styles.freqText, nuevaFrecuencia === f && styles.freqTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {procesando ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 20}} /> : (
                <TouchableOpacity style={styles.submitBtn} onPress={crearSanManual}>
                  <Text style={styles.submitBtnText}>Registrar Crédito</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: REGISTRAR ABONO --- */}
      <Modal visible={modalAbono} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Pago / Abono</Text>
              <TouchableOpacity onPress={() => setModalAbono(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={{fontSize: 14, color: '#4B5563', marginBottom: 20}}>
                Cliente: <Text style={{fontWeight: 'bold'}}>{sanSeleccionado?.entidades?.nombre}</Text>{"\n"}
                Deuda Restante: <Text style={{fontWeight: 'bold', color: '#DC2626'}}>${sanSeleccionado?.saldo_pendiente.toLocaleString()} COP</Text>
              </Text>

              <Text style={styles.label}>¿A dónde ingresó este dinero? *</Text>
              <View style={styles.pillsContainer}>
                {cuentas.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    style={[styles.pill, cuentaAbonoId === c.id && styles.pillActive]}
                    onPress={() => setCuentaAbonoId(c.id)}
                  >
                    <Text style={[styles.pillText, cuentaAbonoId === c.id && styles.pillTextActive]}>{c.nombre}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Monto depositado en {getCuentaSeleccionada()?.moneda || ''} *</Text>
              <TextInput 
                style={[styles.input, {outlineStyle: 'none'} as any]} 
                placeholder="0.00" 
                keyboardType="numeric"
                value={montoAbono}
                onChangeText={setMontoAbono}
              />

              {/* Muestra la conversión en tiempo real */}
              {montoAbono !== '' && getCuentaSeleccionada()?.moneda !== 'COP' && (
                <View style={styles.conversionBox}>
                  <Text style={styles.conversionText}>
                    Equivale a: <Text style={{fontWeight: 'bold'}}>${abonoCOP.toLocaleString()} COP</Text>
                  </Text>
                  {abonoCOP > (sanSeleccionado?.saldo_pendiente || 0) && (
                    <Text style={{color: '#DC2626', fontSize: 12, marginTop: 5, fontWeight: 'bold'}}>
                      ⚠️ El pago supera la deuda actual.
                    </Text>
                  )}
                </View>
              )}

              {procesando ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 20}} /> : (
                <TouchableOpacity 
                  style={[styles.submitBtnSuccess, abonoCOP > (sanSeleccionado?.saldo_pendiente || 0) && {backgroundColor: '#9CA3AF'}]} 
                  onPress={registrarAbono}
                  disabled={abonoCOP > (sanSeleccionado?.saldo_pendiente || 0)}
                >
                  <Text style={styles.submitBtnText}>Procesar Abono</Text>
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
  btnNuevo: { backgroundColor: '#6B0D23', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, elevation: 2 },
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

  abonoBtn: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', padding: 12, borderRadius: 12, alignItems: 'center' },
  abonoBtnText: { color: '#1A1A1A', fontWeight: 'bold', fontSize: 14 },
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
  pillActive: { backgroundColor: '#6B0D23', borderColor: '#6B0D23' },
  pillText: { fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  pillTextActive: { color: '#FFF' },

  freqContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  freqPill: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#F3F4F6', borderRadius: 12 },
  freqPillActive: { backgroundColor: '#1A1A1A' },
  freqText: { fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  freqTextActive: { color: '#FFF' },

  conversionBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginBottom: 15 },
  conversionText: { color: '#92400E', fontSize: 13 },

  submitBtn: { backgroundColor: '#6B0D23', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnSuccess: { backgroundColor: '#10B981', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});
