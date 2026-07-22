import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from './ScreenHeader';
import SideMenu from './SideMenu';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

export default function AppShell({ children, activeKey }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = useNavigation();
  const { logout } = useAuth();

  return (
    <View style={styles.root}>
      <ScreenHeader
        onMenuPress={() => setMenuOpen(true)}
        onNotifyPress={() => {}}
      />
      <View style={styles.body}>{children}</View>
      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        onLogout={logout}
        activeKey={activeKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
