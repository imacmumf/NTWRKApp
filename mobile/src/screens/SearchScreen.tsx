import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchUsers, findConnection } from '../services/apiService';
import { useAuth } from '@clerk/clerk-expo';

interface UserResult {
  id: string;
  displayName: string;
  degree: number | null;
}

interface ConnectionPath {
  path: string[];
  degree: number;
}

const SearchScreen: React.FC = () => {
  const { getToken } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [connectionPath, setConnectionPath] = useState<ConnectionPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [pathLoading, setPathLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setSelectedUser(null);
    setConnectionPath(null);

    try {
      const users = await searchUsers(getToken, query.trim());
      setResults(users);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFindConnection = async (user: UserResult) => {
    setSelectedUser(user);
    setPathLoading(true);
    setConnectionPath(null);

    try {
      const path = await findConnection(getToken, user.id);
      setConnectionPath(path);
    } catch {
      setConnectionPath(null);
    } finally {
      setPathLoading(false);
    }
  };

  const renderResult = ({ item }: { item: UserResult }) => (
    <TouchableOpacity
      style={[
        styles.resultRow,
        selectedUser?.id === item.id && styles.resultRowSelected,
      ]}
      onPress={() => handleFindConnection(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.displayName}</Text>
        {item.degree !== null && (
          <Text style={styles.resultDegree}>
            {item.degree === 1
              ? 'Direct connection'
              : `${item.degree}° connection`}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      )}

      {!loading && results.length === 0 && query.length > 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No results found.</Text>
        </View>
      )}

      <FlatList
        data={results}
        renderItem={renderResult}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />

      {selectedUser && (
        <View style={styles.pathCard}>
          <Text style={styles.pathTitle}>
            Connection to {selectedUser.displayName}
          </Text>
          {pathLoading ? (
            <ActivityIndicator color="#4A90D9" style={{ marginTop: 12 }} />
          ) : connectionPath ? (
            <View style={styles.pathContainer}>
              {connectionPath.path.map((node, index) => (
                <View key={index} style={styles.pathNode}>
                  <View style={styles.pathDot} />
                  <Text style={styles.pathNodeText}>{node}</Text>
                  {index < connectionPath.path.length - 1 && (
                    <View style={styles.pathLine} />
                  )}
                </View>
              ))}
              <Text style={styles.pathDegree}>
                {connectionPath.degree}° of separation
              </Text>
            </View>
          ) : (
            <Text style={styles.noPath}>No connection found.</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  header: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E6E6E6',
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1A1F3D',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#E6E6E6',
    borderWidth: 1,
    borderColor: '#2A2F4D',
  },
  searchButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  centered: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#8892B0',
    fontSize: 16,
  },
  list: {
    paddingHorizontal: 24,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F3D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2F4D',
  },
  resultRowSelected: {
    borderColor: '#4A90D9',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2F4D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#4A90D9',
    fontSize: 16,
    fontWeight: '700',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    color: '#E6E6E6',
    fontWeight: '600',
  },
  resultDegree: {
    fontSize: 13,
    color: '#8892B0',
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: '#4A90D9',
  },
  pathCard: {
    backgroundColor: '#1A1F3D',
    borderRadius: 16,
    padding: 20,
    margin: 24,
    borderWidth: 1,
    borderColor: '#2A2F4D',
  },
  pathTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E6E6E6',
  },
  pathContainer: {
    marginTop: 16,
  },
  pathNode: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pathDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90D9',
    marginRight: 12,
  },
  pathNodeText: {
    fontSize: 15,
    color: '#E6E6E6',
  },
  pathLine: {
    position: 'absolute',
    left: 4,
    top: 14,
    width: 2,
    height: 20,
    backgroundColor: '#2A2F4D',
  },
  pathDegree: {
    fontSize: 14,
    color: '#4A90D9',
    fontWeight: '600',
    marginTop: 8,
  },
  noPath: {
    color: '#8892B0',
    marginTop: 12,
    fontSize: 14,
  },
});

export default SearchScreen;
