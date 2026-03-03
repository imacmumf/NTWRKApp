import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser, useClerk } from '@clerk/clerk-expo';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import NetworkBackground from '../components/NetworkBackground';

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'Home'>;
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user } = useUser();
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Clerk handles state change
    }
  };

  return (
    <View style={styles.root}>
      <NetworkBackground />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>NTWRK</Text>
          <Text style={styles.greeting}>
            Hello, {user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? 'User'}
          </Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Network')}
            activeOpacity={0.8}
          >
            <Text style={styles.cardIcon}>🔗</Text>
            <Text style={styles.cardTitle}>My Network</Text>
            <Text style={styles.cardDescription}>
              Discover how you're connected to others
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Contacts')}
            activeOpacity={0.8}
          >
            <Text style={styles.cardIcon}>📇</Text>
            <Text style={styles.cardTitle}>Contacts</Text>
            <Text style={styles.cardDescription}>
              Sync and manage your contacts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.8}
          >
            <Text style={styles.cardIcon}>🔍</Text>
            <Text style={styles.cardTitle}>Search</Text>
            <Text style={styles.cardDescription}>
              Find people and see your connection path
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.cardIcon}>👤</Text>
            <Text style={styles.cardTitle}>My Profile</Text>
            <Text style={styles.cardDescription}>
              Add your info so others can find you
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 16,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4A90D9',
    letterSpacing: 6,
  },
  greeting: {
    fontSize: 20,
    color: '#E6E6E6',
    marginTop: 8,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(26, 31, 61, 0.85)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(42, 47, 77, 0.7)',
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6E6E6',
  },
  cardDescription: {
    fontSize: 14,
    color: '#8892B0',
    marginTop: 4,
  },
  signOutButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  signOutText: {
    color: '#FF5252',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
