import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Linking } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import MyUnitScreen from '../screens/MyUnitScreen';
import PaymentScreen from '../screens/PaymentScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const linking = {
  prefixes: ['propizy://', 'http://localhost:5173', 'https://propizy.app'],
  config: {
    screens: {
      Register: 'invite/:token',
      Login: 'login',
      Main: { screens: { Home: 'home' } },
    },
  },
};

function TabIcon({ label, focused }) {
  const icons = { Home: '🏠', Unit: '🏢', Pay: '💰', Fix: '🔧', Me: '👤' };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label]}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#1e40af' },
        headerTintColor: '#fff',
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarActiveTintColor: '#2563eb',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Propizy' }} />
      <Tab.Screen name="Unit" component={MyUnitScreen} options={{ title: 'My Unit' }} />
      <Tab.Screen name="Pay" component={PaymentScreen} options={{ title: 'Payments' }} />
      <Tab.Screen name="Fix" component={MaintenanceScreen} options={{ title: 'Maintenance' }} />
      <Tab.Screen name="Me" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
