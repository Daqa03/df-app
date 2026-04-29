import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { supabase } from '../../supabase';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Por favor ingresa correo y contraseña.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg('Credenciales incorrectas. Intenta de nuevo.');
    }
    
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {/* Círculos decorativos de fondo */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <View style={[styles.loginCard, { width: isDesktop ? 400 : '90%' }]}>
        <View style={styles.header}>
          <Text style={styles.brandName}>D&F Cosmetics</Text>
          <Text style={styles.subtitle}>Sistema de Gestión Financiera</Text>
        </View>

        {errorMsg !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Text style={styles.label}>Correo Electrónico</Text>
          <TextInput
            style={[styles.input, {outlineStyle: 'none'} as any]}
            placeholder="ejemplo@correo.com"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={[styles.input, {outlineStyle: 'none'} as any]}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity 
            style={styles.loginBtn} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Acceso restringido a personal autorizado.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden'
  },
  bgCircle1: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#6B0D23',
    opacity: 0.1
  },
  bgCircle2: {
    position: 'absolute',
    bottom: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#6B0D23',
    opacity: 0.05
  },
  loginCard: {
    backgroundColor: '#FFF',
    padding: 30,
    borderRadius: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  header: {
    alignItems: 'center',
    marginBottom: 30
  },
  brandName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#6B0D23',
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 5,
    fontWeight: '500'
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    marginBottom: 20
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: 'bold'
  },
  form: {
    gap: 15
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: -5
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827'
  },
  loginBtn: {
    backgroundColor: '#6B0D23',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
    shadowColor: '#6B0D23',
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  footerText: {
    textAlign: 'center',
    marginTop: 25,
    fontSize: 12,
    color: '#9CA3AF'
  }
});
