import { ActivityIndicator, View, StyleSheet } from 'react-native';
import 'react-native-get-random-values';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme';

function AppRoot() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppRoot />
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
