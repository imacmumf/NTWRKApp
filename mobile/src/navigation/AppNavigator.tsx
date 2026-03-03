import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ContactsScreen from '../screens/ContactsScreen';
import SearchScreen from '../screens/SearchScreen';
import NetworkScreen from '../screens/NetworkScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ConnectionDetailsScreen from '../screens/ConnectionDetailsScreen';

export type ContactListItem = {
  name: string;
  phone: string;
};

export type AppStackParamList = {
  Home: undefined;
  Contacts: undefined;
  Search: undefined;
  Network: undefined;
  Profile: undefined;
  ConnectionDetails: {
    contactName: string;
    contactPhone: string;
    /** Full ordered contact list for prev/next navigation */
    contactsList?: ContactListItem[];
    /** Index within contactsList */
    currentIndex?: number;
  };
};

const Stack = createNativeStackNavigator<AppStackParamList>();

const subScreenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: '#0A0E27' },
  headerTintColor: '#E6E6E6',
  headerTitleStyle: { fontWeight: '700' as const },
  headerBackTitle: 'Back',
};

const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: '#0A0E27' },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{ ...subScreenOptions, title: 'Contacts' }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ ...subScreenOptions, title: 'Search Network' }}
      />
      <Stack.Screen
        name="Network"
        component={NetworkScreen}
        options={{ ...subScreenOptions, title: 'My Network' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ ...subScreenOptions, title: 'My Profile' }}
      />
      <Stack.Screen
        name="ConnectionDetails"
        component={ConnectionDetailsScreen}
        options={({ route }) => ({
          ...subScreenOptions,
          title: route.params.contactName,
          headerBackTitle: 'Network',
        })}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;
