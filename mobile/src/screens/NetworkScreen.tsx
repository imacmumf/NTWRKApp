import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import {
  getMyNetwork,
  NetworkContact,
  NetworkSuggestion,
  NetworkData,
} from '../services/apiService';

type NetworkNavProp = NativeStackNavigationProp<AppStackParamList, 'Network'>;

const NetworkScreen: React.FC = () => {
  const { getToken } = useAuth();
  const navigation = useNavigation<NetworkNavProp>();
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'contacts' | 'suggestions'>('contacts');
  const hasFetched = useRef(false);

  const fetchNetwork = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      if (!isRefresh) setLoading(true);
      const data = await getMyNetwork(getToken);
      setNetwork(data);
    } catch (err: any) {
      console.error('Failed to load network:', err);
      // Don't overwrite cached data on rate-limit errors during refresh
      if (!network || !isRefresh) {
        setError(err.message || 'Failed to load network');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  // Fetch once on mount, not on every tab focus
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchNetwork();
    }
  }, [fetchNetwork]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNetwork(true);
  }, [fetchNetwork]);

  const renderContact = ({ item, index }: { item: NetworkContact; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('ConnectionDetails', {
          contactName: item.name,
          contactPhone: item.phone,
          contactsList: (network?.contacts ?? []).map((c) => ({
            name: c.name,
            phone: c.phone,
          })),
          currentIndex: index,
        })
      }
    >
      <View style={styles.card}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </Text>
          {item.isUser && <View style={styles.onAppBadge} />}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardDetail}>
            {item.isUser ? '✅ On NTWRK' : item.phone}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSuggestion = ({ item }: { item: NetworkSuggestion }) => (
    <View style={styles.card}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {item.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardDetail}>
          via {item.throughName}
        </Text>
      </View>
      <View style={styles.degreeTag}>
        <Text style={styles.degreeText}>2°</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7B61FF" />
          <Text style={styles.loadingText}>Loading your network...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchNetwork()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!network || network.contacts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🔗</Text>
          <Text style={styles.emptyTitle}>Your Network</Text>
          <Text style={styles.emptyText}>
            Sync your contacts to start discovering connections. Your network
            graph will appear here once you have connections.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header & Stats */}
      <View style={styles.header}>
        <Text style={styles.title}>My Network</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{network.stats.totalContacts}</Text>
            <Text style={styles.statLabel}>Contacts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{network.stats.usersInNetwork}</Text>
            <Text style={styles.statLabel}>On NTWRK</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{network.suggestions.length}</Text>
            <Text style={styles.statLabel}>Suggestions</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'contacts' && styles.tabActive]}
          onPress={() => setActiveTab('contacts')}
        >
          <Text
            style={[styles.tabText, activeTab === 'contacts' && styles.tabTextActive]}
          >
            Contacts ({network.contacts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggestions' && styles.tabActive]}
          onPress={() => setActiveTab('suggestions')}
        >
          <Text
            style={[styles.tabText, activeTab === 'suggestions' && styles.tabTextActive]}
          >
            Suggestions ({network.suggestions.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {activeTab === 'contacts' ? (
        <FlatList
          data={network.contacts}
          keyExtractor={(item, index) => `${item.phone}-${index}`}
          renderItem={renderContact}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7B61FF"
            />
          }
        />
      ) : (
        <FlatList
          data={network.suggestions}
          keyExtractor={(item, index) => `${item.phone}-${index}`}
          renderItem={renderSuggestion}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                No suggestions yet. As more of your contacts join NTWRK, you'll see 2nd-degree connections here.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7B61FF"
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8892B0',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E6E6E6',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: '#141833',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 90,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#7B61FF',
  },
  statLabel: {
    fontSize: 11,
    color: '#8892B0',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#141833',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#7B61FF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8892B0',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141833',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2A2F54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7B61FF',
  },
  onAppBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: '#141833',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E6E6E6',
  },
  cardDetail: {
    fontSize: 12,
    color: '#8892B0',
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: '#8892B0',
    marginLeft: 8,
    fontWeight: '300',
  },
  degreeTag: {
    backgroundColor: '#2A2F54',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  degreeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7B61FF',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6E6E6',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8892B0',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#7B61FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default NetworkScreen;
