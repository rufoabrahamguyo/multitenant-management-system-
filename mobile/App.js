import { useEffect } from 'react';
import 'react-native-get-random-values';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

function AppRoot() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  return <AppNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
