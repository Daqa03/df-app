import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, useWindowDimensions } from 'react-native';
import { supabase } from '../../supabase';

type Entidad = any;

export default function DirectorioScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('Todos');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [entidadActivaId, setEntidadActivaId] = useState<string | null>(null);
  
  // Form State
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoSeleccionado, setTipoSeleccionado] = useState('Cliente');
  const [procesando, setProcesando] = useState(false);

  const tiposDisponibles = ['Cliente', 'Proveedor'];

  const fetchData = async () => {
    setLoading(true);
    // Traemos la entidad y TODAS sus relaciones financieras para el resumen analítico
    const { data, error } = await supabase
      .from('entidades')
      .select('*, ventas(monto_total), sanes(saldo_pendiente, estado), cuentas_por_pagar(monto_total, saldo_pendiente, estado)')
      .order('nombre');
      
    if (data) setEntidades(data);
    if (error) console.error("Error cargando entidades:", error);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setEntidadActivaId(null);
    setNombre('');
    setTelefono('');
    setTipoSeleccionado('Cliente');
    setModalVisible(true);
  };

  const abrirModalEditar = (entidad: Entidad) => {
    setModoEdicion(true);
    setEntidadActivaId(entidad.id);
    setNombre(entidad.nombre || '');
    setTelefono(entidad.telefono || '');
    setTipoSeleccionado(entidad.tipo || 'Cliente');
    setModalVisible(true);
  };

  const guardarEntidad = async () => {
    if (!nombre.trim()) return alert('El nombre es obligatorio');
    setProcesando(true);

    try {
      const payload = {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        tipo: tipoSeleccionado
      };

      if (modoEdicion && entidadActivaId) {
        const { error } = await supabase.from('entidades').update(payload).eq('id', entidadActivaId);
        if (error) throw error;
        alert('Contacto actualizado');
      } else {
        const { error } = await supabase.from('entidades').insert([payload]);
        if (error) throw error;
        alert('Nuevo contacto registrado');
      }

      setModalVisible(false);
      fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const eliminarEntidad = async (id: string, nombreEntidad: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar a ${nombreEntidad}? Esto podría afectar el historial si tiene deudas asociadas.`)) {
      setLoading(true);
      const { error } = await supabase.from('entidades').delete().eq('id', id);
      if (error) {
        alert('No se pudo eliminar. Es posible que tenga registros o deudas asociadas.');
      } else {
        fetchData();
      }
      setLoading(false);
    }
  };

  // Filtrado
  const entidadesFiltradas = entidades.filter(e => {
    const coincideTexto = e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || e.telefono?.includes(busqueda);
    const coincideTipo = filtroTipo === 'Todos' || e.tipo === filtroTipo;
    return coincideTexto && coincideTipo;
  });

  const getBadgeColor = (tipo: string) => {
    switch (tipo?.toLowerCase()) {
      case 'cliente': return { bg: '#DBEAFE', text: '#1D4ED8' }; // Azul
      case 'proveedor': return { bg: '#FEF3C7', text: '#B45309' }; // Amarillo
      case 'laboratorio': return { bg: '#E0E7FF', text: '#4338CA' }; // Indigo
      case 'mayorista': return { bg: '#D1FAE5', text: '#047857' }; // Verde
      default: return { bg: '#F3F4F6', text: '#4B5563' }; // Gris
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Directorio Inteligente</Text>
          <Text style={styles.subtitle}>{entidades.length} registros y analíticas</Text>
        </View>
        <TouchableOpacity style={styles.btnNuevo} onPress={abrirModalNuevo}>
          <Text style={styles.btnNuevoText}>+ Nuevo Contacto</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <TextInput 
          style={[styles.searchInput, {outlineStyle: 'none'} as any, isDesktop ? {width: 300} : {flex: 1}]} 
          placeholder="Buscar por nombre o teléfono..." 
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll}>
          <TouchableOpacity style={[styles.filtroPill, filtroTipo === 'Todos' && styles.filtroPillActive]} onPress={() => setFiltroTipo('Todos')}>
            <Text style={[styles.filtroText, filtroTipo === 'Todos' && styles.filtroTextActive]}>Todos</Text>
          </TouchableOpacity>
          {tiposDisponibles.map(tipo => (
            <TouchableOpacity key={tipo} style={[styles.filtroPill, filtroTipo === tipo && styles.filtroPillActive]} onPress={() => setFiltroTipo(tipo)}>
              <Text style={[styles.filtroText, filtroTipo === tipo && styles.filtroTextActive]}>{tipo}s</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 50}} /> : (
        <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
          {entidadesFiltradas.length === 0 ? (
            <Text style={styles.emptyText}>No se encontraron contactos</Text>
          ) : (
            entidadesFiltradas.map(ent => {
              const badge = getBadgeColor(ent.tipo);
              
              // Analíticas
              const totalComprado = ent.ventas ? ent.ventas.reduce((acc: number, v: any) => acc + Number(v.monto_total), 0) : 0;
              const deudaHaciaNosotros = ent.sanes ? ent.sanes.filter((s: any) => s.estado === 'ACTIVO').reduce((acc: number, s: any) => acc + Number(s.saldo_pendiente), 0) : 0;
              const gastoHistorico = ent.cuentas_por_pagar ? ent.cuentas_por_pagar.reduce((acc: number, c: any) => acc + Number(c.monto_total), 0) : 0;
              const deudaNuestra = ent.cuentas_por_pagar ? ent.cuentas_por_pagar.filter((c: any) => c.estado === 'ACTIVA').reduce((acc: number, c: any) => acc + Number(c.saldo_pendiente), 0) : 0;

              return (
                <View key={ent.id} style={[styles.card, !isDesktop && { width: '100%' }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{ent.nombre?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={styles.cardName} numberOfLines={1}>{ent.nombre}</Text>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.text }]}>{ent.tipo}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.cardBody}>
                    <Text style={styles.infoText}>📞 {ent.telefono || 'Sin teléfono'}</Text>
                    
                    {/* Tarjeta interna de resumen financiero */}
                    <View style={styles.statsBox}>
                      {(ent.tipo === 'Cliente' || totalComprado > 0) && (
                        <>
                          <View style={styles.statRow}><Text style={styles.statLabel}>Total Comprado:</Text><Text style={styles.statValue}>${totalComprado.toLocaleString()}</Text></View>
                          <View style={styles.statRow}><Text style={styles.statLabel}>Nos Debe:</Text><Text style={[styles.statValue, deudaHaciaNosotros > 0 && {color: '#10B981'}]}>${deudaHaciaNosotros.toLocaleString()}</Text></View>
                        </>
                      )}
                      
                      {((ent.tipo !== 'Cliente' && ent.tipo !== 'Otro') || gastoHistorico > 0) && (
                        <>
                          <View style={[styles.statRow, {marginTop: (ent.tipo === 'Cliente' || totalComprado > 0) ? 10 : 0}]}><Text style={styles.statLabel}>Gasto Histórico:</Text><Text style={styles.statValue}>${gastoHistorico.toLocaleString()}</Text></View>
                          <View style={styles.statRow}><Text style={styles.statLabel}>Le Debemos:</Text><Text style={[styles.statValue, deudaNuestra > 0 && {color: '#DC2626'}]}>${deudaNuestra.toLocaleString()}</Text></View>
                        </>
                      )}
                    </View>

                  </View>
                  
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => abrirModalEditar(ent)}>
                      <Text style={styles.actionTextEdit}>✏️ Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => eliminarEntidad(ent.id, ent.nombre)}>
                      <Text style={styles.actionTextDel}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* MODAL: Crear/Editar Contacto */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modoEdicion ? 'Editar Contacto' : 'Nuevo Contacto'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.label}>Nombre completo o Empresa *</Text>
              <TextInput 
                style={[styles.input, {outlineStyle: 'none'} as any]} 
                placeholder="Ej. Distribuidora Caracas" 
                value={nombre}
                onChangeText={setNombre}
              />

              <Text style={styles.label}>Teléfono</Text>
              <TextInput 
                style={[styles.input, {outlineStyle: 'none'} as any]} 
                placeholder="Ej. 0414 1234567" 
                keyboardType="phone-pad"
                value={telefono}
                onChangeText={setTelefono}
              />

              <Text style={styles.label}>Clasificación</Text>
              <View style={styles.tipoContainer}>
                {tiposDisponibles.map(tipo => (
                  <TouchableOpacity 
                    key={tipo} 
                    style={[styles.tipoPill, tipoSeleccionado === tipo && styles.tipoPillActive]}
                    onPress={() => setTipoSeleccionado(tipo)}
                  >
                    <Text style={[styles.tipoText, tipoSeleccionado === tipo && styles.tipoTextActive]}>{tipo}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {procesando ? <ActivityIndicator size="large" color="#6B0D23" style={{marginTop: 20}} /> : (
                <TouchableOpacity style={styles.submitBtn} onPress={guardarEntidad}>
                  <Text style={styles.submitBtnText}>{modoEdicion ? 'Guardar Cambios' : 'Registrar Contacto'}</Text>
                </TouchableOpacity>
              )}
            </View>
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
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 5 },
  btnNuevo: { backgroundColor: '#6B0D23', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, elevation: 2 },
  btnNuevoText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20, flexWrap: 'wrap' },
  searchInput: { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 15, height: 45, borderWidth: 1, borderColor: '#E5E7EB' },
  filtrosScroll: { flexDirection: 'row' },
  filtroPill: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#FFF', borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  filtroPillActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  filtroText: { fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  filtroTextActive: { color: '#FFF' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, paddingBottom: 50 },
  card: { backgroundColor: '#FFF', width: 340, borderRadius: 16, padding: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  avatar: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#6B0D23' },
  cardName: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  cardBody: { marginBottom: 15 },
  infoText: { fontSize: 13, color: '#4B5563', marginBottom: 10 },
  
  statsBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  statValue: { fontSize: 12, color: '#1A1A1A', fontWeight: 'bold' },

  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F9FAFB' },
  actionTextEdit: { fontSize: 13, color: '#3B82F6', fontWeight: 'bold' },
  actionTextDel: { fontSize: 13 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', width: '100%', marginTop: 40 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', width: '100%', maxWidth: 450, borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  closeBtn: { fontSize: 20, color: '#9CA3AF', fontWeight: 'bold' },
  modalContent: { padding: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#374151', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 15 },
  tipoContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tipoPill: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  tipoPillActive: { backgroundColor: '#6B0D23', borderColor: '#6B0D23' },
  tipoText: { fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  tipoTextActive: { color: '#FFF' },
  submitBtn: { backgroundColor: '#6B0D23', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});
