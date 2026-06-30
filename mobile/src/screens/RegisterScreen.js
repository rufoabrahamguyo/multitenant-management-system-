import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ route, navigation }) {
  const inviteToken = route?.params?.token;
  const [preview, setPreview] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginAfterRegister } = useAuth();

  useEffect(() => {
    if (inviteToken) {
      api.get(`/auth/invite/${inviteToken}/`)
        .then(({ data }) => setPreview(data))
        .catch(() => Alert.alert('Invalid Invite', 'This invite link is not valid.'));
    }
  }, [inviteToken]);

  const handleRegister = async () => {
    if (!username || !password || !inviteToken) return;
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match. Please try again.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register-tenant/', {
        invite_token: inviteToken,
        username,
        password,
      });
      await loginAfterRegister(data);
    } catch (err) {
      Alert.alert('Registration Failed', err.response?.data?.invite_token?.[0] || err.response?.data?.detail || 'Could not register.');
    } finally {
      setLoading(false);
    }
  };

  if (!inviteToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>Propizy</Text>
        <Text style={styles.subtitle}>Tenant registration is invite-only.</Text>
        <Text style={styles.hint}>Ask your property manager for an invite link.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.buttonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>Join Propizy</Text>
        {preview && (
          <View style={styles.preview}>
            <Text style={styles.previewOrg}>{preview.organization}</Text>
            {preview.unit && <Text style={styles.previewUnit}>{preview.unit}</Text>}
            <Text style={styles.previewEmail}>{preview.email}</Text>
          </View>
        )}
        <TextInput style={styles.input} placeholder="Choose username" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Password (min 8 chars)" value={password} onChangeText={setPassword} secureTextEntry />
        <TextInput style={styles.input} placeholder="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading || !preview?.is_valid || password !== confirmPassword}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#2563eb', textAlign: 'center', marginBottom: 16 },
  subtitle: { color: '#94a3b8', textAlign: 'center', fontSize: 16 },
  hint: { color: '#64748b', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  preview: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 20 },
  previewOrg: { color: '#fff', fontSize: 18, fontWeight: '600' },
  previewUnit: { color: '#93c5fd', marginTop: 4 },
  previewEmail: { color: '#94a3b8', marginTop: 8, fontSize: 13 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
