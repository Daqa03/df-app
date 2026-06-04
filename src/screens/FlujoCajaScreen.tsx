import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, useWindowDimensions } from 'react-native';
import { supabase } from '../../supabase';
import { fuzzyMatch } from '../utils/searchUtils';

type Cuenta = any;
type Movimiento = any;

export default function FlujoCajaScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 1024;

  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  // Tasas de cambio para el total
  const [tasaUSD, setTasaUSD] = useState(1);
  const [tasaVES, setTasaVES] = useState(1);

  // Filtros Historial
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState('');

  // Estados para el Modal de Nuevo Movimiento
  const [modalVisible, setModalVisible] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<'Ingreso' | 'Egreso'>('Ingreso');
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [procesando, setProcesando] = useState(false);

  // Estados para Modal Detalles
  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<Movimiento | null>(null);

  // Estado para Entidades (Directorio)
  const [entidades, setEntidades] = useState<any[]>([]);

  // Estados para Modal de Transferencia entre Cuentas
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferCuentaOrigenId, setTransferCuentaOrigenId] = useState('');
  const [transferCuentaDestinoId, setTransferCuentaDestinoId] = useState('');
  const [transferMontoEnviado, setTransferMontoEnviado] = useState('');
  const [transferMontoRecibido, setTransferMontoRecibido] = useState('');
  const [procesandoTransferencia, setProcesandoTransferencia] = useState(false);

  // Estados para Modal de Préstamo de Dinero
  const [loanModalVisible, setLoanModalVisible] = useState(false);
  const [loanCuentaId, setLoanCuentaId] = useState('');
  const [loanEntidadId, setLoanEntidadId] = useState('');
  const [loanMonto, setLoanMonto] = useState('');
  const [loanFrecuencia, setLoanFrecuencia] = useState('Quincenal');
  const [loanDescripcion, setLoanDescripcion] = useState('');
  const [procesandoPrestamo, setProcesandoPrestamo] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    
    // Traer Tasas
    const { data: tasasData } = await supabase.from('tasas_cambio').select('*');
    if (tasasData) {
      const usd = tasasData.find(t => t.moneda === 'USD');
      const ves = tasasData.find(t => t.moneda === 'VES');
      if (usd) setTasaUSD(usd.tasa_en_cop || 1);
      if (ves) setTasaVES(ves.tasa_en_cop || 1);
    }

    // Traer Cuentas
    const { data: cuentasData } = await supabase.from('cuentas').select('*').eq('activo', true).order('nombre');
    if (cuentasData && cuentasData.length > 0) {
      setCuentas(cuentasData);
      if (!cuentaSeleccionadaId) setCuentaSeleccionadaId(cuentasData[0].id);
      if (!transferCuentaOrigenId) setTransferCuentaOrigenId(cuentasData[0].id);
      if (!transferCuentaDestinoId && cuentasData.length > 1) setTransferCuentaDestinoId(cuentasData[1].id);
      else if (!transferCuentaDestinoId) setTransferCuentaDestinoId(cuentasData[0].id);
      if (!loanCuentaId) setLoanCuentaId(cuentasData[0].id);
    }

    // Traer Entidades (para Préstamos)
    const { data: entData } = await supabase.from('entidades').select('*').order('nombre');
    if (entData) {
      setEntidades(entData);
      if (entData.length > 0 && !loanEntidadId) setLoanEntidadId(entData[0].id);
    }

    // Traer TODO el historial de movimientos
    const { data: movsData } = await supabase
      .from('movimientos_caja')
      .select('*, cuentas(nombre, moneda)')
      .order('fecha', { ascending: false });
      
    if (movsData) setMovimientos(movsData);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const registrarMovimiento = async () => {
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) return alert('Ingresa un monto válido mayor a 0');
    if (!cuentaSeleccionadaId) return alert('Selecciona una cuenta');

    if (tipoMovimiento === 'Egreso') {
      const cuenta = cuentas.find(c => c.id === cuentaSeleccionadaId);
      if (cuenta && cuenta.saldo_actual !== undefined && cuenta.saldo_actual < Number(monto)) {
        const proceed = window.confirm(`⚠️ ADVERTENCIA DE SALDO\n\nLa cuenta "${cuenta.nombre}" solo tiene ${cuenta.saldo_actual.toLocaleString()} ${cuenta.moneda}, pero estás intentando gastar ${Number(monto).toLocaleString()} ${cuenta.moneda}.\n\nSi continúas, el saldo quedará en negativo.\n\n¿Estás seguro de que deseas registrar este gasto de todas formas?`);
        if (!proceed) return;
      }
    }

    setProcesando(true);
    try {
      const { error } = await supabase.from('movimientos_caja').insert([{
        cuenta_id: cuentaSeleccionadaId,
        tipo_movimiento: tipoMovimiento,
        monto: Number(monto),
        descripcion: descripcion.trim() || (tipoMovimiento === 'Ingreso' ? 'Inyección de Capital' : 'Gasto Operativo')
      }]);

      if (error) throw error;

      alert(`¡${tipoMovimiento} registrado con éxito!`);
      setModalVisible(false);
      setMonto('');
      setDescripcion('');
      fetchData(); // Recargar datos
    } catch (error: any) {
      alert('Error al registrar: ' + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const registrarTransferencia = async () => {
    if (!transferMontoEnviado || isNaN(Number(transferMontoEnviado)) || Number(transferMontoEnviado) <= 0) {
      return alert('Ingresa un monto enviado válido mayor a 0');
    }
    if (!transferMontoRecibido || isNaN(Number(transferMontoRecibido)) || Number(transferMontoRecibido) <= 0) {
      return alert('Ingresa un monto recibido válido mayor a 0');
    }
    if (!transferCuentaOrigenId || !transferCuentaDestinoId) {
      return alert('Selecciona ambas cuentas');
    }
    if (transferCuentaOrigenId === transferCuentaDestinoId) {
      return alert('La cuenta de origen y destino no pueden ser la misma');
    }

    const cuentaOrigen = cuentas.find(c => c.id === transferCuentaOrigenId);
    const cuentaDestino = cuentas.find(c => c.id === transferCuentaDestinoId);
    if (!cuentaOrigen || !cuentaDestino) return alert('Cuenta no encontrada');

    // Validar saldo suficiente en cuenta origen
    if (cuentaOrigen.saldo_actual !== undefined && cuentaOrigen.saldo_actual < Number(transferMontoEnviado)) {
      const proceed = window.confirm(`⚠️ ADVERTENCIA DE SALDO\n\nLa cuenta de origen "${cuentaOrigen.nombre}" solo tiene ${cuentaOrigen.saldo_actual.toLocaleString()} ${cuentaOrigen.moneda}, pero estás intentando transferir ${Number(transferMontoEnviado).toLocaleString()} ${cuentaOrigen.moneda}.\n\nSi continúas, el saldo quedará en negativo.\n\n¿Estás seguro de que deseas realizar esta transferencia de todas formas?`);
      if (!proceed) return;
    }

    setProcesandoTransferencia(true);
    try {
      const enviado = Number(transferMontoEnviado);
      const recibido = Number(transferMontoRecibido);
      const tasa = recibido / enviado;
      const esDistintaMoneda = cuentaOrigen.moneda !== cuentaDestino.moneda;
      
      const descTasa = esDistintaMoneda 
        ? ` (Tasa: 1 ${cuentaOrigen.moneda} = ${tasa.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${cuentaDestino.moneda})` 
        : '';
        
      const descEgreso = `Transferencia saliente a ${cuentaDestino.nombre}${descTasa}`;
      const descIngreso = `Transferencia entrante desde ${cuentaOrigen.nombre}${descTasa}`;

      // Insertar ambos movimientos
      const { error } = await supabase.from('movimientos_caja').insert([
        {
          cuenta_id: transferCuentaOrigenId,
          tipo_movimiento: 'Egreso',
          monto: enviado,
          descripcion: descEgreso
        },
        {
          cuenta_id: transferCuentaDestinoId,
          tipo_movimiento: 'Ingreso',
          monto: recibido,
          descripcion: descIngreso
        }
      ]);

      if (error) throw error;

      alert('¡Transferencia registrada con éxito!');
      setTransferModalVisible(false);
      setTransferMontoEnviado('');
      setTransferMontoRecibido('');
      fetchData();
    } catch (error: any) {
      alert('Error al registrar transferencia: ' + error.message);
    } finally {
      setProcesandoTransferencia(false);
    }
  };

  const registrarPrestamo = async () => {
    if (!loanCuentaId) return alert('Selecciona una cuenta de origen');
    if (!loanEntidadId) return alert('Selecciona un cliente del directorio');
    if (!loanMonto || isNaN(Number(loanMonto)) || Number(loanMonto) <= 0) {
      return alert('Ingresa un monto de préstamo válido');
    }

    const cuenta = cuentas.find(c => c.id === loanCuentaId);
    const cliente = entidades.find(e => e.id === loanEntidadId);
    if (!cuenta || !cliente) return alert('Cuenta o cliente no encontrado');

    // Validar saldo suficiente en cuenta origen
    if (cuenta.saldo_actual !== undefined && cuenta.saldo_actual < Number(loanMonto)) {
      const proceed = window.confirm(`⚠️ ADVERTENCIA DE SALDO\n\nLa cuenta "${cuenta.nombre}" solo tiene ${cuenta.saldo_actual.toLocaleString()} ${cuenta.moneda}, pero estás prestando ${Number(loanMonto).toLocaleString()} ${cuenta.moneda}.\n\nSi continúas, el saldo quedará en negativo.\n\n¿Estás seguro de que deseas registrar este préstamo de todas formas?`);
      if (!proceed) return;
    }

    setProcesandoPrestamo(true);
    try {
      const montoN = Number(loanMonto);
      
      // Calcular equivalente en COP
      let montoCOP = montoN;
      if (cuenta.moneda === 'USD') montoCOP = montoN * tasaUSD;
      if (cuenta.moneda === 'VES') montoCOP = montoN * tasaVES;

      // 1. Insertar Egreso en Flujo de Caja
      const { error: errMov } = await supabase.from('movimientos_caja').insert([{
        cuenta_id: loanCuentaId,
        tipo_movimiento: 'Egreso',
        monto: montoN,
        descripcion: `Préstamo otorgado a ${cliente.nombre}. Cuentas por cobrar.${loanDescripcion ? ' Nota: ' + loanDescripcion.trim() : ''}`
      }]);
      if (errMov) throw errMov;

      // 2. Insertar Crédito (San) en cuentas por cobrar
      const { error: errSan } = await supabase.from('sanes').insert([{
        entidad_id: loanEntidadId,
        monto_total: montoCOP,
        saldo_pendiente: montoCOP,
        frecuencia_pago: loanFrecuencia,
        estado: 'ACTIVO'
      }]);
      if (errSan) throw errSan;

      alert(`¡Préstamo registrado con éxito! Se creó una cuenta por cobrar por $${montoCOP.toLocaleString()} COP.`);
      setLoanModalVisible(false);
      setLoanMonto('');
      setLoanDescripcion('');
      fetchData();
    } catch (error: any) {
      alert('Error al registrar préstamo: ' + error.message);
    } finally {
      setProcesandoPrestamo(false);
    }
  };

  const getIconoCuenta = (tipo: string) => {
    if (tipo?.toUpperCase() === 'BANCO') return '🏦';
    if (tipo?.toUpperCase() === 'EFECTIVO') return '💵';
    if (tipo?.toUpperCase() === 'CRIPTO') return '🪙';
    if (tipo?.toUpperCase() === 'BILLETERA') return '📱';
    return '💳';
  };

  const formatearFecha = (fechaStr: string) => {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString() + ' ' + fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Filtrado del historial
  const movimientosFiltrados = movimientos.filter(mov => {
    let pasaTexto = true;
    if (busquedaHistorial) {
      const termino = busquedaHistorial;
      const fechaText = new Date(mov.fecha).toLocaleDateString();
      pasaTexto = (
        (mov.descripcion && fuzzyMatch(mov.descripcion, termino)) ||
        (mov.cuentas?.nombre && fuzzyMatch(mov.cuentas.nombre, termino)) ||
        mov.monto.toString().includes(termino) ||
        fechaText.includes(termino)
      );
    }
    
    let pasaFecha = true;
    if (fechaFiltro) {
      const movDateStr = new Date(mov.fecha).toISOString().split('T')[0];
      pasaFecha = movDateStr === fechaFiltro;
    }

    return pasaTexto && pasaFecha;
  });

  // Cálculo del Total Patrimonial
  const calcularTotalEnCOP = () => {
    let totalCOP = 0;
    cuentas.filter(c => c.tipo?.toLowerCase() !== 'deuda').forEach(cuenta => {
      const saldo = Number(cuenta.saldo_actual) || 0;
      if (cuenta.moneda === 'COP') totalCOP += saldo;
      else if (cuenta.moneda === 'USD') totalCOP += (saldo * tasaUSD);
      else if (cuenta.moneda === 'VES') totalCOP += (saldo * tasaVES);
    });
    return totalCOP;
  };

  const granTotalCOP = calcularTotalEnCOP();
  const granTotalUSD = granTotalCOP / tasaUSD;
  const granTotalVES = granTotalCOP / tasaVES;

  const MainContentWrapper = isDesktop ? View : ScrollView;
  const LeftColumnWrapper = isDesktop ? ScrollView : View;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Flujo de Caja</Text>
        <View style={[styles.actionButtons, !isDesktop && { width: '100%', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginTop: 10 }]}>
          <TouchableOpacity style={[styles.actionBtn, !isDesktop && { width: '48%', alignItems: 'center', paddingHorizontal: 10 }, {backgroundColor: '#10B981'}]} onPress={() => { setTipoMovimiento('Ingreso'); setModalVisible(true); }}>
            <Text style={styles.actionBtnText}>📥 Inyectar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, !isDesktop && { width: '48%', alignItems: 'center', paddingHorizontal: 10 }, {backgroundColor: '#DC2626'}]} onPress={() => { setTipoMovimiento('Egreso'); setModalVisible(true); }}>
            <Text style={styles.actionBtnText}>📤 Gasto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, !isDesktop && { width: '48%', alignItems: 'center', paddingHorizontal: 10 }, {backgroundColor: '#3B82F6'}]} onPress={() => setTransferModalVisible(true)}>
            <Text style={styles.actionBtnText}>🔀 Transferir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, !isDesktop && { width: '48%', alignItems: 'center', paddingHorizontal: 10 }, {backgroundColor: '#F59E0B'}]} onPress={() => {
            setLoanModalVisible(true);
            if (entidades.length > 0 && !loanEntidadId) setLoanEntidadId(entidades[0].id);
          }}>
            <Text style={styles.actionBtnText}>🤝 Préstamo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 50}} /> : (
        <MainContentWrapper 
          style={isDesktop ? styles.contentLayoutDesktop : styles.contentLayoutMobile} 
          contentContainerStyle={!isDesktop ? styles.mobileScrollContent : undefined}
          showsVerticalScrollIndicator={false}
        >
          
          {/* SECCIÓN IZQUIERDA: Cuentas y Saldos */}
          <LeftColumnWrapper 
            style={isDesktop ? styles.leftColumn : styles.mobileColumn}
            showsVerticalScrollIndicator={false}
          >
            
            {/* TOTAL PATRIMONIAL CARD */}
            <View style={styles.totalCard}>
              <Text style={styles.totalCardLabel}>Patrimonio Total</Text>
              <Text style={styles.totalCardMain}>${granTotalCOP.toLocaleString()} <Text style={{fontSize: 16, color: '#FCD34D'}}>COP</Text></Text>
              <View style={styles.totalCardSub}>
                <Text style={styles.totalCardSubText}>USD: ${granTotalUSD.toFixed(2)}</Text>
                <Text style={styles.totalCardSubText}>VES: Bs.{granTotalVES.toFixed(2)}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Saldos Actuales</Text>
            <View style={isDesktop ? styles.cardsGridDesktop : styles.cardsGridMobile}>
              {cuentas.filter(c => c.tipo?.toLowerCase() !== 'deuda').map(cuenta => (
                <View key={cuenta.id} style={[styles.accountCard, isDesktop ? { width: '48%' } : { width: '100%' }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIcon}>{getIconoCuenta(cuenta.tipo)}</Text>
                    <Text style={styles.cardName}>{cuenta.nombre}</Text>
                  </View>
                  <Text style={styles.cardCurrency}>{cuenta.moneda}</Text>
                  <Text style={styles.cardBalance}>
                    {cuenta.moneda === 'USD' ? '$' : cuenta.moneda === 'VES' ? 'Bs.' : '$'}
                    {cuenta.saldo_actual?.toLocaleString() || '0'}
                  </Text>
                </View>
              ))}
            </View>
          </LeftColumnWrapper>

          {/* SECCIÓN DERECHA: Historial de Movimientos */}
          <View style={isDesktop ? styles.rightColumn : styles.mobileColumn}>
            <Text style={styles.sectionTitle}>Historial de Movimientos</Text>
            
            <View style={styles.historyCard}>
              <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
                <View style={[styles.searchBox, {flex: 2, marginBottom: 0}]}>
                  <TextInput 
                    style={[styles.searchInput, {outlineStyle: 'none'} as any]} 
                    placeholder="Buscar movimientos..." 
                    value={busquedaHistorial}
                    onChangeText={setBusquedaHistorial}
                  />
                </View>
                <View style={[styles.searchBox, {flex: 1, marginBottom: 0}]}>
                  <TextInput 
                    style={[styles.searchInput, {outlineStyle: 'none'} as any]} 
                    {...{type: 'date'} as any}
                    placeholder="YYYY-MM-DD" 
                    value={fechaFiltro}
                    onChangeText={setFechaFiltro}
                  />
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={isDesktop ? undefined : {height: 400}}>
                {movimientosFiltrados.length === 0 ? (
                  <Text style={styles.emptyText}>No se encontraron movimientos.</Text>
                ) : (
                  movimientosFiltrados.map(mov => (
                    <TouchableOpacity 
                      key={mov.id} 
                      style={styles.historyRow}
                      onPress={() => {
                        setMovimientoSeleccionado(mov);
                        setModalDetalleVisible(true);
                      }}
                    >
                      <View style={styles.historyIconBox}>
                        <Text style={{fontSize: 18}}>{mov.tipo_movimiento === 'Ingreso' ? '⬇️' : '⬆️'}</Text>
                      </View>
                      <View style={styles.historyDetails}>
                        <Text style={styles.historyDesc} numberOfLines={1}>{mov.descripcion || mov.tipo_movimiento}</Text>
                        <Text style={styles.historyMeta}>{mov.cuentas?.nombre} • {formatearFecha(mov.fecha)}</Text>
                      </View>
                      <View style={styles.historyAmountBox}>
                        <Text style={[styles.historyAmount, { color: mov.tipo_movimiento === 'Ingreso' ? '#10B981' : '#DC2626' }]}>
                          {mov.tipo_movimiento === 'Ingreso' ? '+' : '-'}{mov.monto.toLocaleString()} {mov.cuentas?.moneda}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>

        </MainContentWrapper>
      )}

      {/* MODAL: Nuevo Movimiento */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {tipoMovimiento === 'Ingreso' ? '📥 Nuevo Ingreso' : '📤 Nuevo Gasto'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <Text style={styles.label}>Cuenta Afectada</Text>
                <View style={styles.pillsContainer}>
                  {cuentas.filter(c => c.tipo?.toLowerCase() !== 'deuda').map(cuenta => (
                    <TouchableOpacity 
                      key={cuenta.id} 
                      style={[styles.pill, cuentaSeleccionadaId === cuenta.id && styles.pillActive]}
                      onPress={() => setCuentaSeleccionadaId(cuenta.id)}
                    >
                      <Text style={[styles.pillText, cuentaSeleccionadaId === cuenta.id && styles.pillTextActive]}>
                        {cuenta.nombre} ({cuenta.moneda})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Monto</Text>
                <TextInput 
                  style={[styles.input, {outlineStyle: 'none'} as any]} 
                  placeholder="0.00" 
                  keyboardType="numeric"
                  value={monto}
                  onChangeText={setMonto}
                />

                <Text style={styles.label}>Concepto / Descripción (Opcional)</Text>
                <TextInput 
                  style={[styles.input, {outlineStyle: 'none'} as any]} 
                  placeholder={tipoMovimiento === 'Ingreso' ? "Ej. Aporte, Cuadre..." : "Ej. Pago luz..."} 
                  value={descripcion}
                  onChangeText={setDescripcion}
                />

                {procesando ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 20}} /> : (
                  <TouchableOpacity 
                    style={[styles.submitBtn, {backgroundColor: tipoMovimiento === 'Ingreso' ? '#10B981' : '#DC2626'}]}
                    onPress={registrarMovimiento}
                  >
                    <Text style={styles.submitBtnText}>Confirmar {tipoMovimiento}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: Detalles del Movimiento */}
      <Modal visible={modalDetalleVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle del Movimiento</Text>
              <TouchableOpacity onPress={() => setModalDetalleVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {movimientoSeleccionado && (
                <>
                  <Text style={styles.detalleLabel}>Fecha y Hora</Text>
                  <Text style={styles.detalleValue}>{formatearFecha(movimientoSeleccionado.fecha)}</Text>

                  <Text style={styles.detalleLabel}>Tipo de Operación</Text>
                  <Text style={[styles.detalleValue, {color: movimientoSeleccionado.tipo_movimiento === 'Ingreso' ? '#10B981' : '#DC2626'}]}>
                    {movimientoSeleccionado.tipo_movimiento}
                  </Text>

                  <Text style={styles.detalleLabel}>Monto</Text>
                  <Text style={styles.detalleValue}>
                    {movimientoSeleccionado.monto.toLocaleString()} {movimientoSeleccionado.cuentas?.moneda}
                  </Text>

                  <Text style={styles.detalleLabel}>Cuenta Afectada</Text>
                  <Text style={styles.detalleValue}>{movimientoSeleccionado.cuentas?.nombre}</Text>

                  <Text style={styles.detalleLabel}>Descripción / Detalles</Text>
                  <Text style={styles.detalleValueDesc}>{movimientoSeleccionado.descripcion || 'Sin detalles registrados.'}</Text>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: Transferencia entre Cuentas */}
      <Modal visible={transferModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🔀 Transferir entre Cuentas</Text>
                <TouchableOpacity onPress={() => setTransferModalVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <Text style={styles.label}>Cuenta de Origen (Envía)</Text>
                <View style={styles.pillsContainer}>
                  {cuentas.filter(c => c.tipo?.toLowerCase() !== 'deuda').map(cuenta => (
                    <TouchableOpacity 
                      key={cuenta.id} 
                      style={[styles.pill, transferCuentaOrigenId === cuenta.id && styles.pillActive]}
                      onPress={() => setTransferCuentaOrigenId(cuenta.id)}
                    >
                      <Text style={[styles.pillText, transferCuentaOrigenId === cuenta.id && styles.pillTextActive]}>
                        {cuenta.nombre} ({cuenta.moneda})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Cuenta de Destino (Recibe)</Text>
                <View style={styles.pillsContainer}>
                  {cuentas.filter(c => c.tipo?.toLowerCase() !== 'deuda').map(cuenta => (
                    <TouchableOpacity 
                      key={cuenta.id} 
                      style={[styles.pill, transferCuentaDestinoId === cuenta.id && styles.pillActive]}
                      onPress={() => setTransferCuentaDestinoId(cuenta.id)}
                    >
                      <Text style={[styles.pillText, transferCuentaDestinoId === cuenta.id && styles.pillTextActive]}>
                        {cuenta.nombre} ({cuenta.moneda})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{flexDirection: 'row', gap: 10}}>
                  <View style={{flex: 1}}>
                    <Text style={styles.label}>Monto Enviado ({cuentas.find(c => c.id === transferCuentaOrigenId)?.moneda || ''})</Text>
                    <TextInput 
                      style={[styles.input, {outlineStyle: 'none'} as any]} 
                      placeholder="0.00" 
                      keyboardType="numeric"
                      value={transferMontoEnviado}
                      onChangeText={setTransferMontoEnviado}
                    />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={styles.label}>Monto Recibido ({cuentas.find(c => c.id === transferCuentaDestinoId)?.moneda || ''})</Text>
                    <TextInput 
                      style={[styles.input, {outlineStyle: 'none'} as any]} 
                      placeholder="0.00" 
                      keyboardType="numeric"
                      value={transferMontoRecibido}
                      onChangeText={setTransferMontoRecibido}
                    />
                  </View>
                </View>

                {/* Mostrar la tasa calculada */}
                {transferMontoEnviado !== '' && transferMontoRecibido !== '' && 
                 !isNaN(Number(transferMontoEnviado)) && !isNaN(Number(transferMontoRecibido)) && 
                 Number(transferMontoEnviado) > 0 && Number(transferMontoRecibido) > 0 && (
                  <View style={[styles.conversionBox, {backgroundColor: '#EFF6FF'}]}>
                    <Text style={{color: '#1E40AF', fontSize: 13, fontWeight: 'bold'}}>
                      Tasa de Cambio Calculada:
                    </Text>
                    <Text style={{color: '#1E40AF', fontSize: 14, marginTop: 4}}>
                      1 {cuentas.find(c => c.id === transferCuentaOrigenId)?.moneda} = {(Number(transferMontoRecibido) / Number(transferMontoEnviado)).toLocaleString(undefined, {maximumFractionDigits: 4})} {cuentas.find(c => c.id === transferCuentaDestinoId)?.moneda}
                    </Text>
                  </View>
                )}

                {procesandoTransferencia ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 20}} /> : (
                  <TouchableOpacity 
                    style={[styles.submitBtn, {backgroundColor: '#3B82F6'}]}
                    onPress={registrarTransferencia}
                  >
                    <Text style={styles.submitBtnText}>Confirmar Transferencia</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: Nuevo Préstamo */}
      <Modal visible={loanModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🤝 Otorgar Préstamo de Dinero</Text>
                <TouchableOpacity onPress={() => setLoanModalVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <Text style={styles.label}>Cuenta de Origen (Sale el dinero)</Text>
                <View style={styles.pillsContainer}>
                  {cuentas.filter(c => c.tipo?.toLowerCase() !== 'deuda').map(cuenta => (
                    <TouchableOpacity 
                      key={cuenta.id} 
                      style={[styles.pill, loanCuentaId === cuenta.id && styles.pillActive]}
                      onPress={() => setLoanCuentaId(cuenta.id)}
                    >
                      <Text style={[styles.pillText, loanCuentaId === cuenta.id && styles.pillTextActive]}>
                        {cuenta.nombre} ({cuenta.moneda})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Cliente (A quién se presta) *</Text>
                <View style={[styles.pillsContainer, {maxHeight: 120, overflow: 'scroll'}]}>
                  {entidades.map(ent => (
                    <TouchableOpacity 
                      key={ent.id} 
                      style={[styles.pill, loanEntidadId === ent.id && styles.pillActive]}
                      onPress={() => setLoanEntidadId(ent.id)}
                    >
                      <Text style={[styles.pillText, loanEntidadId === ent.id && styles.pillTextActive]}>
                        {ent.nombre}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Monto Prestado ({cuentas.find(c => c.id === loanCuentaId)?.moneda || ''}) *</Text>
                <TextInput 
                  style={[styles.input, {outlineStyle: 'none'} as any]} 
                  placeholder="0.00" 
                  keyboardType="numeric"
                  value={loanMonto}
                  onChangeText={setLoanMonto}
                />

                {/* Mostrar conversión a COP al vuelo si la cuenta no es COP */}
                {loanMonto !== '' && !isNaN(Number(loanMonto)) && cuentas.find(c => c.id === loanCuentaId)?.moneda !== 'COP' && (
                  <View style={styles.conversionBox}>
                    <Text style={styles.conversionText}>
                      Se creará una deuda por: <Text style={{fontWeight: 'bold'}}>${(Number(loanMonto) * (cuentas.find(c => c.id === loanCuentaId)?.moneda === 'USD' ? tasaUSD : tasaVES)).toLocaleString()} COP</Text>
                    </Text>
                  </View>
                )}

                <Text style={styles.label}>Acuerdo de Cobro (Frecuencia) *</Text>
                <View style={styles.freqContainer}>
                  {['Semanal', 'Quincenal', 'Mensual'].map(f => (
                    <TouchableOpacity 
                      key={f} 
                      style={[styles.freqPill, loanFrecuencia === f && styles.freqPillActive]}
                      onPress={() => setLoanFrecuencia(f)}
                    >
                      <Text style={[styles.freqText, loanFrecuencia === f && styles.freqTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Descripción / Nota del Préstamo (Opcional)</Text>
                <TextInput 
                  style={[styles.input, {outlineStyle: 'none'} as any]} 
                  placeholder="Ej. Dinero prestado para..." 
                  value={loanDescripcion}
                  onChangeText={setLoanDescripcion}
                />

                {procesandoPrestamo ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 20}} /> : (
                  <TouchableOpacity 
                    style={[styles.submitBtn, {backgroundColor: '#F59E0B'}]}
                    onPress={registrarPrestamo}
                  >
                    <Text style={styles.submitBtnText}>Registrar Préstamo</Text>
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
  container: { flex: 1, padding: 20, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 },
  title: { fontSize: 28, fontWeight: '900', color: '#1A1A1A' },
  actionButtons: { flexDirection: 'row', gap: 10 },
  actionBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, elevation: 2 },
  actionBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  
  contentLayoutDesktop: { flex: 1, flexDirection: 'row', gap: 20 },
  contentLayoutMobile: { flex: 1 },
  mobileScrollContent: { paddingBottom: 50, display: 'flex', flexDirection: 'column' },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 15 },
  
  // Columnas fluidas
  leftColumn: { flex: 1, minWidth: 300 },
  rightColumn: { flex: 1.5, minWidth: 350 },
  mobileColumn: { width: '100%', marginBottom: 30 }, // Sin flex:1 para que no colapse en el ScrollView
  
  // Tarjeta Total Patrimonial
  totalCard: { backgroundColor: '#1A1A1A', borderRadius: 20, padding: 25, marginBottom: 25, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15 },
  totalCardLabel: { color: '#9CA3AF', fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  totalCardMain: { color: '#FFF', fontSize: 32, fontWeight: '900', marginBottom: 15 },
  totalCardSub: { flexDirection: 'row', gap: 20, borderTopWidth: 1, borderTopColor: '#374151', paddingTop: 15 },
  totalCardSubText: { color: '#D1D5DB', fontSize: 14, fontWeight: '600' },

  // Tarjetas de Cuentas
  cardsGridDesktop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 20, rowGap: 15 },
  cardsGridMobile: { flexDirection: 'column', gap: 15 },
  accountCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardIcon: { fontSize: 24 },
  cardName: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A', flex: 1 },
  cardCurrency: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 5 },
  cardBalance: { fontSize: 24, fontWeight: '900', color: '#6B0D23' },

  // Derecha: Historial
  historyCard: { backgroundColor: '#FFF', borderRadius: 20, flex: 1, padding: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  searchBox: { marginBottom: 15 },
  searchInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 15, height: 45, fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 50 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 15 },
  historyIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  historyDetails: { flex: 1 },
  historyDesc: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 3 },
  historyMeta: { fontSize: 12, color: '#6B7280' },
  historyAmountBox: { alignItems: 'flex-end' },
  historyAmount: { fontSize: 15, fontWeight: 'bold' },

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
  submitBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  // Detalles Modal
  detalleLabel: { fontSize: 12, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  detalleValue: { fontSize: 16, color: '#1A1A1A', fontWeight: 'bold', marginBottom: 15 },
  detalleValueDesc: { fontSize: 14, color: '#1A1A1A', lineHeight: 22, backgroundColor: '#F9FAFB', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },

  // Nuevos estilos para Préstamo y Transferencia
  freqContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  freqPill: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#F3F4F6', borderRadius: 12 },
  freqPillActive: { backgroundColor: '#1A1A1A' },
  freqText: { fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  freqTextActive: { color: '#FFF' },
  conversionBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginBottom: 15 },
  conversionText: { color: '#92400E', fontSize: 13 }
});
