import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useWindowDimensions, ScrollView } from 'react-native';
import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';

import ListaProductosScreen from './src/screens/ListaProductosScreen';
import ConfiguracionScreen from './src/screens/ConfiguracionScreen';
import PosScreen from './src/screens/PosScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import FlujoCajaScreen from './src/screens/FlujoCajaScreen';
import DirectorioScreen from './src/screens/DirectorioScreen';
import SanesScreen from './src/screens/SanesScreen';
import CuentasPorPagarScreen from './src/screens/CuentasPorPagarScreen';
import ComprasScreen from './src/screens/ComprasScreen';
import LoginScreen from './src/screens/LoginScreen';

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 1024;
  
  const [session, setSession] = useState<Session | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [pantallaActiva, setPantallaActiva] = useState('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  if (!session) {
    return <LoginScreen />;
  }

  const NavegacionLateral = () => (
    <View style={isDesktop ? styles.sidebar : styles.drawer}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.brandName}>D&F App</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        
        <TouchableOpacity
          style={[styles.menuItem, pantallaActiva === "dashboard" && styles.menuItemActive]}
          onPress={() => { setPantallaActiva("dashboard"); setMenuAbierto(false); }}
        >
          <Text style={[styles.menuText, pantallaActiva === "dashboard" && styles.menuTextActive]}>📊 Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, pantallaActiva === "pos" && styles.menuItemActive]}
          onPress={() => { setPantallaActiva("pos"); setMenuAbierto(false); }}
        >
          <Text style={[styles.menuText, pantallaActiva === "pos" && styles.menuTextActive]}>🛒 Ventas (POS)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, pantallaActiva === "compras" && styles.menuItemActive]}
          onPress={() => { setPantallaActiva("compras"); setMenuAbierto(false); }}
        >
          <Text style={[styles.menuText, pantallaActiva === "compras" && styles.menuTextActive]}>📦 Compras</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, pantallaActiva === "flujo" && styles.menuItemActive]}
          onPress={() => { setPantallaActiva("flujo"); setMenuAbierto(false); }}
        >
          <Text style={[styles.menuText, pantallaActiva === "flujo" && styles.menuTextActive]}>💰 Flujo de Caja</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, pantallaActiva === "sanes" && styles.menuItemActive]}
          onPress={() => { setPantallaActiva("sanes"); setMenuAbierto(false); }}
        >
          <Text style={[styles.menuText, pantallaActiva === "sanes" && styles.menuTextActive]}>📝 Cuentas por Cobrar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, pantallaActiva === "cuentas_pagar" && styles.menuItemActive]}
          onPress={() => { setPantallaActiva("cuentas_pagar"); setMenuAbierto(false); }}
        >
          <Text style={[styles.menuText, pantallaActiva === "cuentas_pagar" && styles.menuTextActive]}>💸 Cuentas por Pagar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, pantallaActiva === "inventario" && styles.menuItemActive]}
          onPress={() => { setPantallaActiva("inventario"); setMenuAbierto(false); }}
        >
          <Text style={[styles.menuText, pantallaActiva === "inventario" && styles.menuTextActive]}>📦 Inventario</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, pantallaActiva === "directorio" && styles.menuItemActive]}
          onPress={() => { setPantallaActiva("directorio"); setMenuAbierto(false); }}
        >
          <Text style={[styles.menuText, pantallaActiva === "directorio" && styles.menuTextActive]}>📇 Directorio</Text>
        </TouchableOpacity>

      </ScrollView>

      <View style={styles.footerMenu}>
        <TouchableOpacity
          style={[styles.menuItem, pantallaActiva === "config" && styles.menuItemActive, { marginBottom: 10 }]}
          onPress={() => { setPantallaActiva("config"); setMenuAbierto(false); }}
        >
          <Text style={[styles.menuText, pantallaActiva === "config" && styles.menuTextActive]}>⚙️ Configuración</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => supabase.auth.signOut()}
        >
          <Text style={{ color: "#DC2626", fontWeight: "bold" }}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      {/* Sidebar en escritorio */}
      {isDesktop && <NavegacionLateral />}

      {/* Mobile Header */}
      {!isDesktop && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity onPress={() => setMenuAbierto(!menuAbierto)}>
            <Text style={{ fontSize: 24 }}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.mobileTitle}>D&F Cosmetics</Text>
          <View style={{ width: 24 }} />
        </View>
      )}

      {/* Drawer en móvil */}
      {!isDesktop && menuAbierto && (
        <View style={styles.overlay}>
          <NavegacionLateral />
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setMenuAbierto(false)} />
        </View>
      )}

      {/* Área de Contenido */}
      <View style={styles.contentArea}>
        {pantallaActiva === 'dashboard' && <DashboardScreen />}
        {pantallaActiva === 'pos' && <PosScreen />}
        {pantallaActiva === 'compras' && <ComprasScreen />}
        {pantallaActiva === 'flujo' && <FlujoCajaScreen />}
        {pantallaActiva === 'sanes' && <SanesScreen />}
        {pantallaActiva === 'cuentas_pagar' && <CuentasPorPagarScreen />}
        {pantallaActiva === 'inventario' && <ListaProductosScreen />}
        {pantallaActiva === 'directorio' && <DirectorioScreen />}
        {pantallaActiva === 'config' && <ConfiguracionScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#FAF8F5' },
  sidebar: { width: 260, backgroundColor: '#FFF', padding: 20, borderRightWidth: 1, borderRightColor: '#F3F4F6', height: '100%' },
  drawer: { width: 280, backgroundColor: '#FFF', padding: 20, height: '100%', elevation: 10 },
  sidebarHeader: { marginBottom: 30, paddingHorizontal: 10 },
  brandName: { fontSize: 22, fontWeight: '900', color: '#6B0D23' },
  menuItem: { padding: 15, borderRadius: 12, marginBottom: 8 },
  menuItemActive: { backgroundColor: '#6B0D23' },
  menuText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  menuTextActive: { color: '#FFF' },
  footerMenu: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 20, marginTop: 10 },
  logoutBtn: { padding: 15, marginBottom: 10 },
  mobileHeader: { height: 60, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', width: '100%', position: 'absolute', top: 0, zIndex: 10 },
  mobileTitle: { fontWeight: 'bold', color: '#6B0D23' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 20, flexDirection: 'row' },
  contentArea: { flex: 1, alignItems: 'center', paddingTop: 80 }, // Padding para el header móvil
});