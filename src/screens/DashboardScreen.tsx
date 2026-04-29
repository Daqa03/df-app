import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, useWindowDimensions, TextInput, TouchableOpacity, Modal } from 'react-native';
import { supabase } from '../../supabase';

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 1024;
  const isTablet = width > 768 && width <= 1024;

  // Fechas por defecto (Mes Actual)
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

  const [fechaInicio, setFechaInicio] = useState(primerDiaMes.toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(ultimoDiaMes.toISOString().split('T')[0]);

  // Estados UI para Filtro "Tipo Instantly"
  const [filtroDropdownVisible, setFiltroDropdownVisible] = useState(false);
  const [filtroSeleccionado, setFiltroSeleccionado] = useState('Este Mes');
  const [mostrarCustom, setMostrarCustom] = useState(false);

  const [loading, setLoading] = useState(true);
  
  // Métricas
  const [ventasRango, setVentasRango] = useState(0);
  const [ventasHoy, setVentasHoy] = useState(0);
  const [patrimonio, setPatrimonio] = useState(0);
  const [deudasFavor, setDeudasFavor] = useState(0);
  const [deudasContra, setDeudasContra] = useState(0);
  
  // Nuevas Métricas Financieras
  const [costoMercanciaRango, setCostoMercanciaRango] = useState(0);
  const [gananciaRango, setGananciaRango] = useState(0);
  const [ingresosHistoricos, setIngresosHistoricos] = useState(0);
  const [egresosHistoricos, setEgresosHistoricos] = useState(0);

  // Listas
  const [topProductos, setTopProductos] = useState<any[]>([]);
  const [stockBajo, setStockBajo] = useState<any[]>([]);

  const fetchData = async (inicioStr = fechaInicio, finStr = fechaFin) => {
    setLoading(true);
    
    // Parseo de fechas del rango
    const fInicio = new Date(inicioStr + "T00:00:00");
    const fFin = new Date(finStr + "T23:59:59");
    const isoInicio = fInicio.toISOString();
    const isoFin = fFin.toISOString();

    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const isoInicioHoy = inicioHoy.toISOString();

    // 1. Ventas en el rango
    const { data: ventasData } = await supabase.from('ventas').select('monto_total, fecha').gte('fecha', isoInicio).lte('fecha', isoFin);
    if (ventasData) {
      const totalRango = ventasData.reduce((acc, v) => acc + Number(v.monto_total), 0);
      setVentasRango(totalRango);
    }

    // Ventas especificamente de HOY (independiente del rango)
    const { data: ventasHoyData } = await supabase.from('ventas').select('monto_total').gte('fecha', isoInicioHoy);
    if (ventasHoyData) {
      const totalHoy = ventasHoyData.reduce((acc, v) => acc + Number(v.monto_total), 0);
      setVentasHoy(totalHoy);
    }

    // 2. Patrimonio (Solo cuentas reales, excluyendo DEUDA) y Tasas
    const { data: cuentasData } = await supabase.from('cuentas').select('saldo_actual, moneda, tipo').eq('activo', true).neq('tipo', 'DEUDA');
    const { data: tasasData } = await supabase.from('tasas_cambio').select('*');
    
    let tasaUSD = 1, tasaVES = 1;
    if (tasasData) {
      const usd = tasasData.find(t => t.moneda === 'USD');
      const ves = tasasData.find(t => t.moneda === 'VES');
      if (usd) tasaUSD = usd.tasa_en_cop || 1;
      if (ves) tasaVES = ves.tasa_en_cop || 1;
    }

    let patCOP = 0;
    if (cuentasData) {
      cuentasData.forEach(c => {
        let saldo = Number(c.saldo_actual);
        if (c.moneda === 'USD') saldo *= tasaUSD;
        if (c.moneda === 'VES') saldo *= tasaVES;
        patCOP += saldo;
      });
    }
    setPatrimonio(patCOP);

    // 3. Deudas
    const { data: sanesData } = await supabase.from('sanes').select('saldo_pendiente').eq('estado', 'ACTIVO');
    if (sanesData) setDeudasFavor(sanesData.reduce((acc, s) => acc + Number(s.saldo_pendiente), 0));

    const { data: pagarData } = await supabase.from('cuentas_por_pagar').select('saldo_pendiente').eq('estado', 'ACTIVA');
    if (pagarData) setDeudasContra(pagarData.reduce((acc, p) => acc + Number(p.saldo_pendiente), 0));

    // 4. Stock Bajo
    const { data: stockData } = await supabase.from('productos').select('nombre, stock_actual').lte('stock_actual', 5).order('stock_actual', {ascending: true}).limit(8);
    if (stockData) setStockBajo(stockData);

    // 5. Top Productos y Costos en el Rango
    const { data: itemsData } = await supabase
      .from('ventas_items')
      .select('cantidad, subtotal, productos(nombre, costo_cop), ventas(fecha)')
      .gte('ventas.fecha', isoInicio)
      .lte('ventas.fecha', isoFin);
    
    if (itemsData) {
      const productosVendidos: {[key: string]: number} = {};
      let costoTotalRangoTemp = 0;
      let ingresosVentasRangoTemp = 0;

      itemsData.forEach((item: any) => {
        if (item.ventas && new Date(item.ventas.fecha) >= fInicio && new Date(item.ventas.fecha) <= fFin) {
          const nombre = item.productos?.nombre || 'Desconocido';
          productosVendidos[nombre] = (productosVendidos[nombre] || 0) + item.cantidad;
          
          const costoUnitario = item.productos?.costo_cop || 0;
          costoTotalRangoTemp += costoUnitario * item.cantidad;
          ingresosVentasRangoTemp += Number(item.subtotal);
        }
      });

      setCostoMercanciaRango(costoTotalRangoTemp);
      setGananciaRango(ingresosVentasRangoTemp - costoTotalRangoTemp);

      const sortedTop = Object.keys(productosVendidos)
        .map(nombre => ({ nombre, cantidad: productosVendidos[nombre] }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);
      
      setTopProductos(sortedTop);
    }

    // 6. Ingresos y Egresos Históricos
    const { data: movsData } = await supabase.from('movimientos_caja').select('monto, tipo_movimiento, cuentas(moneda)');
    if (movsData) {
      let ingHist = 0;
      let egHist = 0;
      movsData.forEach((m: any) => {
        let montoCOP = Number(m.monto);
        if (m.cuentas?.moneda === 'USD') montoCOP *= tasaUSD;
        if (m.cuentas?.moneda === 'VES') montoCOP *= tasaVES;
        
        if (m.tipo_movimiento === 'Ingreso') ingHist += montoCOP;
        if (m.tipo_movimiento === 'Egreso') egHist += montoCOP;
      });
      setIngresosHistoricos(ingHist);
      setEgresosHistoricos(egHist);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const aplicarFiltroPredefinido = (tipo: string) => {
    if (tipo === 'Personalizado') {
      setFiltroDropdownVisible(false);
      setMostrarCustom(true);
      return;
    }

    let fInicio = new Date();
    let fFin = new Date();

    switch (tipo) {
      case 'Hoy':
        break; // fechas ya son de hoy
      case 'Ayer':
        fInicio.setDate(hoy.getDate() - 1);
        fFin.setDate(hoy.getDate() - 1);
        break;
      case 'Últimos 7 días':
        fInicio.setDate(hoy.getDate() - 7);
        break;
      case 'Este Mes':
        fInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        break;
      case 'Mes Pasado':
        fInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        fFin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        break;
    }

    const startStr = fInicio.toISOString().split('T')[0];
    const endStr = fFin.toISOString().split('T')[0];

    setFechaInicio(startStr);
    setFechaFin(endStr);
    setFiltroSeleccionado(tipo);
    setFiltroDropdownVisible(false);
    
    // Llamar directamente a fetchData con las nuevas fechas
    fetchData(startStr, endStr);
  };

  const aplicarFiltroCustom = () => {
    if (!fechaInicio || !fechaFin) return alert('Selecciona ambas fechas');
    if (new Date(fechaInicio) > new Date(fechaFin)) return alert('La fecha de inicio no puede ser mayor a la final');
    
    setFiltroSeleccionado(`${fechaInicio} al ${fechaFin}`);
    setMostrarCustom(false);
    fetchData(fechaInicio, fechaFin);
  };

  if (loading && !ventasHoy) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color="#6B0D23" />
        <Text style={{marginTop: 10, color: '#6B7280'}}>Compilando métricas...</Text>
      </View>
    );
  }

  const getColStyle = (): any => {
    if (isDesktop) return { width: '48%' };
    if (isTablet) return { width: '48%' };
    return { width: '100%' };
  };

  return (
    <View style={styles.container}>
      
      {/* HEADER ADAPTATIVO CON DROPDOWN */}
      <View style={[styles.header, { flexDirection: isDesktop ? 'row' : 'column' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Panel de Control Financiero</Text>
          <Text style={styles.subtitle}>Resumen Operativo en Tiempo Real</Text>
        </View>

        {/* BOTÓN DROPDOWN TIPO INSTANTLY */}
        <View style={{ position: 'relative', zIndex: 100, marginTop: isDesktop ? 0 : 15 }}>
          <TouchableOpacity 
            style={styles.dropdownBtn}
            onPress={() => setFiltroDropdownVisible(!filtroDropdownVisible)}
          >
            <Text style={styles.dropdownLabel}>Filter</Text>
            <Text style={styles.dropdownValue}>{filtroSeleccionado}</Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>

          {filtroDropdownVisible && (
            <View style={styles.dropdownMenu}>
              {['Hoy', 'Ayer', 'Últimos 7 días', 'Este Mes', 'Mes Pasado', 'Personalizado'].map(opcion => (
                <TouchableOpacity 
                  key={opcion} 
                  style={styles.dropdownItem} 
                  onPress={() => aplicarFiltroPredefinido(opcion)}
                >
                  <Text style={[styles.dropdownItemText, filtroSeleccionado === opcion && styles.dropdownItemTextActive]}>
                    {opcion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
        
        {/* FILA 1: KPIs Principales */}
        <View style={styles.kpiContainer}>
          <View style={[styles.kpiCard, {borderLeftColor: '#10B981', borderLeftWidth: 4}]}>
            <Text style={styles.kpiLabel}>Ventas de Hoy</Text>
            <Text style={styles.kpiValue}>${ventasHoy.toLocaleString()}</Text>
          </View>
          <View style={[styles.kpiCard, {borderLeftColor: '#3B82F6', borderLeftWidth: 4}]}>
            <Text style={styles.kpiLabel}>Ventas en el Rango</Text>
            <Text style={styles.kpiValue}>${ventasRango.toLocaleString()}</Text>
          </View>
          <View style={[styles.kpiCard, {borderLeftColor: '#6B0D23', borderLeftWidth: 4}]}>
            <Text style={styles.kpiLabel}>Patrimonio Total (Caja)</Text>
            <Text style={styles.kpiValue}>${patrimonio.toLocaleString()}</Text>
          </View>
        </View>

        {/* FILA NUEVA: Ganancias y Costos en el Rango */}
        <View style={styles.kpiContainer}>
          <View style={[styles.kpiCard, {borderLeftColor: '#8B5CF6', borderLeftWidth: 4}]}>
            <Text style={styles.kpiLabel}>Costo de Mercancía (Rango)</Text>
            <Text style={styles.kpiValue}>${costoMercanciaRango.toLocaleString()}</Text>
          </View>
          <View style={[styles.kpiCard, {borderLeftColor: '#10B981', borderLeftWidth: 4, backgroundColor: '#ECFDF5'}]}>
            <Text style={styles.kpiLabel}>Ganancia Bruta (Rango)</Text>
            <Text style={[styles.kpiValue, {color: '#047857'}]}>${gananciaRango.toLocaleString()}</Text>
          </View>
        </View>

        {/* FILA NUEVA: Histórico Flujo de Caja */}
        {/* GRÁFICO BARRAS: Ingresos vs Egresos Históricos */}
        <View style={styles.chartCard}>
          <Text style={styles.listTitle}>📈 Histórico Global (Ingresos vs Egresos)</Text>
          <View style={{marginTop: 20}}>
            
            {/* Barra Ingresos */}
            <View style={styles.barChartRow}>
              <View style={styles.barChartLabelContainer}>
                <Text style={styles.barChartLabel}>Ingresos</Text>
                <Text style={[styles.barChartValue, {color: '#10B981'}]}>${ingresosHistoricos.toLocaleString()}</Text>
              </View>
              <View style={styles.barChartTrack}>
                <View style={[styles.barChartFill, {backgroundColor: '#10B981', width: `${Math.max((ingresosHistoricos / Math.max(ingresosHistoricos, egresosHistoricos, 1)) * 100, 2)}%`}]} />
              </View>
            </View>

            {/* Barra Egresos */}
            <View style={styles.barChartRow}>
              <View style={styles.barChartLabelContainer}>
                <Text style={styles.barChartLabel}>Egresos</Text>
                <Text style={[styles.barChartValue, {color: '#DC2626'}]}>${egresosHistoricos.toLocaleString()}</Text>
              </View>
              <View style={styles.barChartTrack}>
                <View style={[styles.barChartFill, {backgroundColor: '#DC2626', width: `${Math.max((egresosHistoricos / Math.max(ingresosHistoricos, egresosHistoricos, 1)) * 100, 2)}%`}]} />
              </View>
            </View>

          </View>
        </View>

        {/* FILA 2: Deudas */}
        <View style={styles.kpiContainer}>
          <View style={[styles.kpiCard, {borderLeftColor: '#F59E0B', borderLeftWidth: 4}]}>
            <Text style={styles.kpiLabel}>Dinero en la Calle (Por Cobrar)</Text>
            <Text style={[styles.kpiValue, {color: '#F59E0B'}]}>${deudasFavor.toLocaleString()}</Text>
          </View>
          <View style={[styles.kpiCard, {borderLeftColor: '#EF4444', borderLeftWidth: 4}]}>
            <Text style={styles.kpiLabel}>Deudas a Proveedores (Por Pagar)</Text>
            <Text style={[styles.kpiValue, {color: '#EF4444'}]}>${deudasContra.toLocaleString()}</Text>
          </View>
        </View>

        {/* FILA 3: Listas Analíticas */}
        <View style={styles.listsContainer}>
          
          {/* Top Productos */}
          {/* Top Productos con Gráfica */}
          <View style={[styles.listCard, getColStyle()]}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>🏆 Top Productos (En el rango)</Text>
            </View>
            <View style={styles.listBody}>
              {topProductos.length === 0 ? (
                <Text style={styles.emptyText}>No hay ventas en este rango de fecha.</Text>
              ) : (
                topProductos.map((prod, index) => {
                  const maxVentas = Math.max(...topProductos.map(p => p.cantidad), 1);
                  const widthPercent = (prod.cantidad / maxVentas) * 100;
                  return (
                    <View key={index} style={styles.topProductItem}>
                      <View style={styles.topProductHeader}>
                        <Text style={styles.rankText}>#{index + 1} {prod.nombre}</Text>
                        <Text style={styles.itemCantidad}>{prod.cantidad} und</Text>
                      </View>
                      <View style={styles.barChartTrackSmall}>
                        <View style={[styles.barChartFillSmall, {width: `${widthPercent}%`}]} />
                      </View>
                    </View>
                  )
                })
              )}
            </View>
          </View>

          {/* Alertas de Stock */}
          <View style={[styles.listCard, getColStyle()]}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>⚠️ Alertas de Inventario</Text>
            </View>
            <View style={styles.listBody}>
              {stockBajo.length === 0 ? (
                <Text style={styles.emptyText}>Todo el inventario está sano.</Text>
              ) : (
                stockBajo.map((prod, index) => (
                  <View key={index} style={styles.listItem}>
                    <View style={[styles.rankBadge, {backgroundColor: prod.stock_actual === 0 ? '#FEE2E2' : '#FEF3C7'}]}>
                      <Text style={[styles.rankText, {color: prod.stock_actual === 0 ? '#DC2626' : '#D97706'}]}>!</Text>
                    </View>
                    <Text style={styles.itemNombre} numberOfLines={1}>{prod.nombre}</Text>
                    <Text style={[styles.itemCantidad, {color: prod.stock_actual === 0 ? '#DC2626' : '#D97706'}]}>
                      Quedan {prod.stock_actual}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>

        </View>

      </ScrollView>

      {/* MODAL: FECHAS PERSONALIZADAS */}
      <Modal visible={mostrarCustom} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.customDateCard}>
            <Text style={styles.modalTitle}>Rango Personalizado</Text>
            
            <View style={{marginTop: 15, gap: 12}}>
               <Text style={styles.label}>Desde:</Text>
               <TextInput 
                 {...{type: "date"} as any}
                 style={[styles.input, {outlineStyle: 'none'} as any]} 
                 value={fechaInicio} 
                 onChangeText={setFechaInicio} 
               />
               
               <Text style={styles.label}>Hasta:</Text>
               <TextInput 
                 {...{type: "date"} as any}
                 style={[styles.input, {outlineStyle: 'none'} as any]} 
                 value={fechaFin} 
                 onChangeText={setFechaFin} 
               />
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginTop: 25}}>
               <TouchableOpacity style={styles.cancelBtn} onPress={() => setMostrarCustom(false)}>
                  <Text style={{color: '#4B5563', fontWeight: 'bold'}}>Cancelar</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.applyBtn} onPress={aplicarFiltroCustom}>
                  <Text style={{color: '#FFF', fontWeight: 'bold'}}>Aplicar</Text>
               </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, maxWidth: 1200, width: '100%', marginHorizontal: 'auto' },
  header: { marginBottom: 20, justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  title: { fontSize: 28, fontWeight: '900', color: '#1A1A1A' },
  subtitle: { fontSize: 15, color: '#4B5563', marginTop: 5 },
  
  // --- DROPDOWN TIPO INSTANTLY ---
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 10, gap: 10 },
  dropdownLabel: { fontSize: 13, color: '#6B7280', fontWeight: 'bold' },
  dropdownValue: { fontSize: 14, color: '#111827', fontWeight: 'bold' },
  dropdownArrow: { fontSize: 10, color: '#9CA3AF', marginLeft: 5 },
  
  dropdownMenu: { position: 'absolute', top: '110%', right: 0, width: 220, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, paddingVertical: 5, zIndex: 1000 },
  dropdownItem: { paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  dropdownItemTextActive: { color: '#6B0D23', fontWeight: 'bold' },

  // --- MODAL CUSTOM DATE ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  customDateCard: { backgroundColor: '#FFF', width: '100%', maxWidth: 350, borderRadius: 16, padding: 20, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10 },
  label: { fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 14 },
  applyBtn: { flex: 1, backgroundColor: '#6B0D23', padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { flex: 1, backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },

  kpiContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 15, zIndex: 1 },
  kpiCard: { flex: 1, minWidth: 200, backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  kpiLabel: { fontSize: 13, color: '#6B7280', fontWeight: 'bold', marginBottom: 5 },
  kpiValue: { fontSize: 24, fontWeight: '900', color: '#1A1A1A' },

  listsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 10 },
  listCard: { backgroundColor: '#FFF', borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  listHeader: { backgroundColor: '#F9FAFB', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  listBody: { padding: 15 },
  listItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', paddingBottom: 10 },
  rankBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankText: { fontSize: 13, fontWeight: 'bold', color: '#4B5563' },
  itemNombre: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151', paddingRight: 10 },
  itemCantidad: { fontSize: 13, fontWeight: 'bold', color: '#1A1A1A' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', paddingVertical: 20, fontStyle: 'italic' },
  
  // Custom Charts Styles
  chartCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 15, zIndex: 1 },
  barChartRow: { marginBottom: 15 },
  barChartLabelContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barChartLabel: { fontSize: 14, fontWeight: 'bold', color: '#4B5563' },
  barChartValue: { fontSize: 14, fontWeight: '900' },
  barChartTrack: { height: 12, backgroundColor: '#F3F4F6', borderRadius: 6, overflow: 'hidden' },
  barChartFill: { height: '100%', borderRadius: 6 },
  
  topProductItem: { marginBottom: 15 },
  topProductHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barChartTrackSmall: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  barChartFillSmall: { height: '100%', backgroundColor: '#6B0D23', borderRadius: 3 },
});
