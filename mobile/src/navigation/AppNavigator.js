import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Linking, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import MyUnitScreen from '../screens/MyUnitScreen';
import PaymentScreen from '../screens/PaymentScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CommunityScreen from '../screens/CommunityScreen';
import AppShell from '../components/AppShell';
import { colors } from '../theme';

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
  async getInitialURL() {
    try {
      return await Promise.race([
        Linking.getInitialURL(),
        new Promise((resolve) => setTimeout(() => resolve(null), 800)),
      ]);
    } catch {
      return null;
    }
  },
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({ url }) => listener(url));
    return () => sub.remove();
  },
};

const TAB_CONFIG = {
  Home: { label: 'My Home', icon: 'grid-outline', iconActive: 'grid' },
  Finance: { label: 'Finance', icon: 'wallet-outline', iconActive: 'wallet' },
  Maintenance: { label: 'Maintenance', icon: 'construct-outline', iconActive: 'construct' },
  Community: { label: 'Community', icon: 'people-outline', iconActive: 'people' },
};

function TabIcon({ routeName, focused }) {
  const cfg = TAB_CONFIG[routeName];
  if (!cfg) return null;
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
      <Ionicons
        name={focused ? cfg.iconActive : cfg.icon}
        size={22}
        color={focused ? colors.accentStrong : colors.textSecondary}
      />
    </View>
  );
}

function UnitWithShell(props) {
  return (
    <AppShell activeKey="unit">
      <MyUnitScreen {...props} />
    </AppShell>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon routeName={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.accentStrong,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabel: TAB_CONFIG[route.name]?.label || route.name,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 8,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Finance" component={PaymentScreen} />
      <Tab.Screen name="Maintenance" component={MaintenanceScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen
        name="Unit"
        component={UnitWithShell}
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="Me"
        component={ProfileScreen}
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  );
}

function LinkingFallback() {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function AppNavigator() {
  const { user } = useAuth();

  return (
    <NavigationContainer linking={linking} fallback={<LinkingFallback />}>
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

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrap: {
    width: 40,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.accentSoft,
  },
});
