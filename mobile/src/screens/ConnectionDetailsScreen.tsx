import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import {
  getMutualConnections,
  MutualConnection,
  MutualConnectionsData,
} from '../services/apiService';
import NetworkGraph from '../components/NetworkGraph';

type ConnectionDetailsProps = NativeStackScreenProps<AppStackParamList, 'ConnectionDetails'>;

const ConnectionDetailsScreen: React.FC<ConnectionDetailsProps> = ({ route, navigation }) => {
  const { getToken } = useAuth();
  const { contactsList, currentIndex } = route.params;

  // Local state so we can cycle prev/next without full remount
  const [activeIndex, setActiveIndex] = useState(currentIndex ?? 0);
  const activeContact = contactsList?.[activeIndex];
  const contactName = activeContact?.name ?? route.params.contactName;
  const contactPhone = activeContact?.phone ?? route.params.contactPhone;

  const [data, setData] = useState<MutualConnectionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasPrev = contactsList != null && activeIndex > 0;
  const hasNext = contactsList != null && activeIndex < contactsList.length - 1;

  const fetchMutualConnections = useCallback(async (phone: string) => {
    try {
      setError(null);
      setLoading(true);
      setData(null);
      const result = await getMutualConnections(getToken, phone);
      setData(result);
    } catch (err: any) {
      console.error('Failed to load mutual connections:', err);
      setError(err.message || 'Failed to load mutual connections');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // Fetch on mount and whenever activeIndex changes
  useEffect(() => {
    fetchMutualConnections(contactPhone);
    // Update the header title
    navigation.setOptions({ title: contactName });
  }, [activeIndex, contactPhone, contactName]);

  const goToPrev = () => {
    if (hasPrev) setActiveIndex((i) => i - 1);
  };

  const goToNext = () => {
    if (hasNext) setActiveIndex((i) => i + 1);
  };

  const renderMutualContact = ({ item }: { item: MutualConnection }) => (
    <View style={styles.contactCard}>
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
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactDetail}>
          {item.isUser ? '✅ On NTWRK' : item.phone}
        </Text>
      </View>
    </View>
  );

  // --- Prev / Next bar ---
  const PrevNextBar = () => {
    if (!contactsList || contactsList.length <= 1) return null;
    return (
      <View style={styles.prevNextBar}>
        <TouchableOpacity
          style={[styles.prevNextButton, !hasPrev && styles.prevNextDisabled]}
          onPress={goToPrev}
          disabled={!hasPrev}
          activeOpacity={0.7}
        >
          <Text style={[styles.prevNextArrow, !hasPrev && styles.prevNextTextDisabled]}>‹</Text>
          <Text style={[styles.prevNextLabel, !hasPrev && styles.prevNextTextDisabled]}>Prev</Text>
        </TouchableOpacity>

        <Text style={styles.prevNextCounter}>
          {activeIndex + 1} of {contactsList.length}
        </Text>

        <TouchableOpacity
          style={[styles.prevNextButton, !hasNext && styles.prevNextDisabled]}
          onPress={goToNext}
          disabled={!hasNext}
          activeOpacity={0.7}
        >
          <Text style={[styles.prevNextLabel, !hasNext && styles.prevNextTextDisabled]}>Next</Text>
          <Text style={[styles.prevNextArrow, !hasNext && styles.prevNextTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <PrevNextBar />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7B61FF" />
          <Text style={styles.loadingText}>Finding mutual connections...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <PrevNextBar />
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchMutualConnections(contactPhone)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Prev / Next navigation */}
      <PrevNextBar />

      <FlatList
        data={data?.mutualConnections ?? []}
        keyExtractor={(item) => item.phone}
        renderItem={renderMutualContact}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Header with target contact info */}
            <View style={styles.header}>
              <View style={styles.mainAvatarContainer}>
                <Text style={styles.mainAvatarText}>
                  {contactName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </Text>
                {data?.targetContact?.isUser && <View style={styles.mainOnAppBadge} />}
              </View>
              <Text style={styles.contactTitle}>{contactName}</Text>
              <Text style={styles.connectionCount}>
                {data?.count ?? 0} mutual connection{data?.count !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Connection Path — Neo4j-style network graph visualization */}
            {data?.connectionPath && data.connectionPath.length > 1 && (
              <View style={styles.pathSection}>
                <Text style={styles.pathLabel}>
                  🔗 Network Connection · {data.connectionDegree!}° of separation
                </Text>
                <Text style={styles.pathSublabel}>
                  Connected through {data.connectionDegree! - 1} {data.connectionDegree! - 1 === 1 ? 'person' : 'people'}
                </Text>
                <NetworkGraph path={data.connectionPath} />
              </View>
            )}

            {/* If the contact is an app user but no indirect path exists */}
            {data?.targetContact?.isUser && !data?.connectionPath && (
              <View style={styles.noPathSection}>
                <Text style={styles.noPathText}>
                  No network connections found yet — grow your network to discover how you're connected!
                </Text>
              </View>
            )}

            {/* Mutual connections header or empty state */}
            {data && data.count > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Mutual Connections</Text>
                <Text style={styles.sectionSubtitle}>People you both know</Text>
              </View>
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptyIcon}>🔗</Text>
                <Text style={styles.emptyTitle}>No mutual connections</Text>
                <Text style={styles.emptyText}>
                  You don't have any contacts in common with {contactName}.
                </Text>
              </View>
            )}
          </>
        }
      />
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
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#E6E6E6', marginBottom: 8 },
  errorText: { fontSize: 14, color: '#8892B0', textAlign: 'center' },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#7B61FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },

  /* ---- Prev / Next bar ---- */
  prevNextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(42, 47, 77, 0.5)',
  },
  prevNextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#141833',
    gap: 4,
  },
  prevNextDisabled: {
    opacity: 0.35,
  },
  prevNextArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: '#7B61FF',
  },
  prevNextLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E6E6E6',
  },
  prevNextTextDisabled: {
    color: '#555',
  },
  prevNextCounter: {
    fontSize: 13,
    color: '#8892B0',
    fontWeight: '600',
  },

  /* ---- Header ---- */
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  mainAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2A2F54',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#7B61FF',
  },
  mainOnAppBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4ADE80',
    borderWidth: 3,
    borderColor: '#0A0E27',
  },
  contactTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E6E6E6',
    marginBottom: 4,
  },
  connectionCount: {
    fontSize: 14,
    color: '#8892B0',
  },

  /* ---- Section ---- */
  sectionHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E6E6E6',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8892B0',
  },

  /* ---- List ---- */
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 31, 61, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(42, 47, 77, 0.6)',
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
    borderColor: '#0A0E27',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E6E6E6',
  },
  contactDetail: {
    fontSize: 13,
    color: '#8892B0',
    marginTop: 2,
  },

  /* ---- Empty state ---- */
  emptySection: {
    alignItems: 'center',
    padding: 40,
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

  /* ---- Connection Path ---- */
  pathSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(26, 31, 61, 0.8)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(123, 97, 255, 0.3)',
  },
  pathLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7B61FF',
    textAlign: 'center',
    marginBottom: 4,
  },
  pathSublabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8892B0',
    textAlign: 'center',
    marginBottom: 16,
  },
  /* ---- No indirect path state ---- */
  noPathSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(26, 31, 61, 0.6)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(42, 47, 77, 0.4)',
    alignItems: 'center',
  },
  noPathText: {
    fontSize: 14,
    color: '#8892B0',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ConnectionDetailsScreen;
