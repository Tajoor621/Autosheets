import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../theme';
import { ROLES } from '../data/mockData';
import GlassCard from '../components/GlassCard';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('owner@autosheets.com');
  const [password, setPassword] = useState('demo1234');
  const [selectedRole, setSelectedRole] = useState('owner');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      try {
        await SecureStore.setItemAsync('autosheets_logged_in', 'true');
        await SecureStore.setItemAsync('autosheets_role', selectedRole);
      } catch (e) {
        // SecureStore unavailable (e.g. web) — continue without persistence
      }
      setLoading(false);
      navigation.replace('Main', { role: selectedRole });
    }, 800);
  };

  const handleBiometric = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Biometrics', 'Biometric authentication is not available on this device. Using demo login.');
        handleLogin();
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock AutoSheets',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) {
        handleLogin();
      }
    } catch (e) {
      handleLogin();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../../assets/logo-silver.jpg')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Secure executive access</Text>

        <GlassCard style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@company.com"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
          />

          <Text style={[styles.label, { marginTop: 20 }]}>Workspace Role</Text>
          <View style={styles.roles}>
            {ROLES.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.roleChip,
                  selectedRole === role.id && styles.roleChipActive,
                ]}
                onPress={() => setSelectedRole(role.id)}
              >
                <Text
                  style={[
                    styles.roleText,
                    selectedRole === role.id && styles.roleTextActive,
                  ]}
                >
                  {role.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginBtnText}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bioBtn} onPress={handleBiometric}>
            <Ionicons name="finger-print" size={22} color={COLORS.accent} />
            <Text style={styles.bioText}>Use Biometrics</Text>
          </TouchableOpacity>
        </GlassCard>

        <Text style={styles.demoNote}>Demo credentials pre-filled • Offline-first ready</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: SPACING.lg,
    paddingTop: 60,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 120,
    marginBottom: 12,
  },
  title: {
    ...TYPOGRAPHY.h1,
    marginBottom: 4,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginBottom: 28,
  },
  form: {
    width: '100%',
    padding: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.caption,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleChipActive: {
    backgroundColor: COLORS.primary + '33',
    borderColor: COLORS.primary,
  },
  roleText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  roleTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  loginBtn: {
    marginTop: 28,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 8,
  },
  bioText: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  demoNote: {
    ...TYPOGRAPHY.caption,
    marginTop: 24,
    opacity: 0.5,
  },
});
