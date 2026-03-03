import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import { useAuth } from '@clerk/clerk-expo';
import { syncContacts, addManualContact } from '../services/apiService';

interface ContactItem {
  id: string;
  name: string;
  phone: string;
}

const ContactsScreen: React.FC = () => {
  const { getToken } = useAuth();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Manual add state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const requestPermission = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    setPermissionGranted(status === 'granted');
    return status === 'granted';
  };

  const loadContacts = async () => {
    setLoading(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'NTWRK needs access to your contacts to build your network. Please enable contacts access in Settings.',
        );
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      const parsed: ContactItem[] = data
        .filter((c) => c.name && c.phoneNumbers && c.phoneNumbers.length > 0)
        .map((c) => ({
          id: c.id ?? c.name ?? '',
          name: c.name ?? 'Unknown',
          phone: c.phoneNumbers![0].number ?? '',
        }));

      setContacts(parsed);
    } catch (error) {
      Alert.alert('Error', 'Failed to load contacts.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (contacts.length === 0) {
      Alert.alert('No Contacts', 'Load your contacts first.');
      return;
    }

    setSyncing(true);
    try {
      await syncContacts(
        getToken,
        contacts.map((c) => ({ name: c.name, phone: c.phone })),
      );
      Alert.alert('Success', `Synced ${contacts.length} contacts to your network.`);
    } catch {
      Alert.alert('Error', 'Failed to sync contacts. Make sure the backend is running.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddContact = async () => {
    const trimName = addName.trim();
    const trimPhone = addPhone.trim();
    const trimEmail = addEmail.trim();

    if (!trimName) {
      Alert.alert('Missing Name', 'Please enter a name for the contact.');
      return;
    }
    if (!trimPhone) {
      Alert.alert('Missing Phone', 'A phone number is required.');
      return;
    }

    setAdding(true);
    try {
      const result = await addManualContact(getToken, {
        name: trimName,
        phone: trimPhone,
        ...(trimEmail ? { email: trimEmail } : {}),
      });

      // Add to local list so it appears immediately
      setContacts((prev) => [
        { id: `manual-${result.contact.phone}`, name: result.contact.name, phone: result.contact.phone },
        ...prev,
      ]);

      setShowAddModal(false);
      setAddName('');
      setAddPhone('');
      setAddEmail('');

      if (result.contact.isUser) {
        Alert.alert(
          'Contact Added! 🎉',
          `${result.contact.name} is already on NTWRK${result.contact.linkedName ? ` as "${result.contact.linkedName}"` : ''}. Your networks have been connected!`,
        );
      } else {
        Alert.alert('Contact Added', `${result.contact.name} has been added to your network.`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add contact.');
    } finally {
      setAdding(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const renderContact = ({ item }: { item: ContactItem }) => (
    <View style={styles.contactRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phone}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.count}>
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {!permissionGranted && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📇</Text>
          <Text style={styles.emptyTitle}>Access Your Contacts</Text>
          <Text style={styles.emptyText}>
            Grant permission to sync your contacts and build your network.
          </Text>
          <TouchableOpacity style={styles.button} onPress={loadContacts}>
            <Text style={styles.buttonText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4A90D9" />
          <Text style={styles.emptyText}>Loading contacts...</Text>
        </View>
      )}

      {!loading && permissionGranted && (
        <>
          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.buttonDisabled]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sync Contacts to Network</Text>
            )}
          </TouchableOpacity>

          <FlatList
            data={contacts}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
          />
        </>
      )}

      {/* ---- Manual Add Contact Modal ---- */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowAddModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Contact</Text>
            <Text style={styles.modalSubtitle}>
              Add someone to your network manually
            </Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="#555"
                value={addName}
                onChangeText={setAddName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 (555) 123-4567"
                placeholderTextColor="#555"
                value={addPhone}
                onChangeText={setAddPhone}
                keyboardType="phone-pad"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Email (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor="#555"
                value={addEmail}
                onChangeText={setAddEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  setAddName('');
                  setAddPhone('');
                  setAddEmail('');
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, adding && styles.buttonDisabled]}
                onPress={handleAddContact}
                disabled={adding}
                activeOpacity={0.7}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>Add Contact</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E6E6E6',
  },
  count: {
    fontSize: 14,
    color: '#8892B0',
  },
  addButton: {
    backgroundColor: '#7B61FF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 24,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1F3D',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2A2F4D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#4A90D9',
    fontSize: 18,
    fontWeight: '700',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    color: '#E6E6E6',
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 13,
    color: '#8892B0',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
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
    marginTop: 12,
  },
  button: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 32,
    marginTop: 24,
  },
  syncButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  /* ---- Modal ---- */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: '#141833',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E6E6E6',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8892B0',
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#8892B0',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0A0E27',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#E6E6E6',
    borderWidth: 1,
    borderColor: '#2A2F4D',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#2A2F54',
    alignItems: 'center',
  },
  cancelText: {
    color: '#8892B0',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#7B61FF',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ContactsScreen;
