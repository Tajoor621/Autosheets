import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, SPACING } from '../theme';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 2200);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#090D16', '#0f172a', '#090D16']}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={require('../../assets/logo-gold.jpg')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.tagline}>Fleet • Rental • Parking • Taxi</Text>
      <Text style={styles.version}>v1.0.0  •  621/24</Text>
      <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  logo: {
    width: 280,
    height: 180,
  },
  tagline: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gold,
    letterSpacing: 2,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  version: {
    ...TYPOGRAPHY.caption,
    marginTop: 8,
    opacity: 0.6,
  },
});
