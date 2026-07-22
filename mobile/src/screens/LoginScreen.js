import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  ImageBackground, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import PropizyLogo from '../components/PropizyLogo';
import { colors, radius } from '../theme';

const HERO =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';
const { height: SCREEN_H } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!username || !password) return;
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.detail || err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={{ uri: HERO }} style={styles.hero} resizeMode="cover">
        <View style={styles.heroDim} />
      </ImageBackground>
      <View style={styles.whiteFloor} />

      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <BlurView intensity={55} tint="dark" style={styles.sheet}>
            <View style={styles.sheetInner}>
              <PropizyLogo size="lg" variant="light" />
              <Text style={styles.title}>Sign in</Text>

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Username or email"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.forgot} onPress={() => Alert.alert('Forgot password', 'Ask your property manager to reset your password, or use the web portal.')}>
                <Text style={styles.forgotText}>Forget Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Sign in</Text>}
              </TouchableOpacity>

              <Text style={styles.hint}>
                Have an invite? Open the invite link from your email to register.
              </Text>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  hero: { height: SCREEN_H * 0.52, width: '100%' },
  heroDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  whiteFloor: {
    flex: 1,
    backgroundColor: colors.white,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  sheetWrap: {
    paddingHorizontal: 22,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  sheetInner: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    backgroundColor: colors.glass,
  },
  title: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  label: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 44, marginBottom: 8 },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 13,
  },
  forgot: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: colors.accent, fontSize: 14, fontWeight: '500' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  hint: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 16,
    lineHeight: 18,
  },
});
