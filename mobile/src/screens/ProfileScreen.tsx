import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { getMyProfile, updateMyProfile, UserProfile } from '../services/apiService';

interface FieldConfig {
  key: keyof Omit<UserProfile, 'email'>;
  label: string;
  icon: string;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  multiline?: boolean;
  section: string;
}

const FIELDS: FieldConfig[] = [
  // Basic Info
  { key: 'name', label: 'Full Name', icon: '👤', placeholder: 'John Doe', section: 'Basic Info' },
  { key: 'phone', label: 'Phone Number', icon: '📱', placeholder: '+1 (555) 123-4567', keyboardType: 'phone-pad', section: 'Basic Info' },
  { key: 'bio', label: 'Bio', icon: '✏️', placeholder: 'Tell people about yourself...', multiline: true, section: 'Basic Info' },

  // Location
  { key: 'location', label: 'Current City', icon: '📍', placeholder: 'New York, NY', section: 'Location' },
  { key: 'hometown', label: 'Hometown', icon: '🏡', placeholder: 'Where you grew up', section: 'Location' },

  // Education
  { key: 'college', label: 'College / University', icon: '🎓', placeholder: 'University of...', section: 'Education' },
  { key: 'highSchool', label: 'High School', icon: '🏫', placeholder: 'Your high school', section: 'Education' },

  // Career
  { key: 'company', label: 'Company', icon: '🏢', placeholder: 'Where you work', section: 'Career' },
  { key: 'jobTitle', label: 'Job Title', icon: '💼', placeholder: 'Your role', section: 'Career' },
  { key: 'industry', label: 'Industry', icon: '🏭', placeholder: 'e.g. Technology, Finance...', section: 'Career' },
];

const ProfileScreen: React.FC = () => {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [originalProfile, setOriginalProfile] = useState<Partial<UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      const data = await getMyProfile(getToken);
      setProfile(data);
      setOriginalProfile(data);
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchProfile();
    }
  }, [fetchProfile]);

  const hasChanges = () => {
    return FIELDS.some(
      (f) => (profile[f.key] ?? '') !== (originalProfile[f.key] ?? ''),
    );
  };

  const handleSave = async () => {
    if (!hasChanges()) return;

    setSaving(true);
    try {
      // Only send changed fields
      const updates: Record<string, string> = {};
      for (const f of FIELDS) {
        const newVal = profile[f.key] ?? '';
        const oldVal = originalProfile[f.key] ?? '';
        if (newVal !== oldVal) {
          updates[f.key] = newVal as string;
        }
      }

      await updateMyProfile(getToken, updates);
      setOriginalProfile({ ...profile });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7B61FF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchProfile(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Group fields by section
  const sections = FIELDS.reduce<Record<string, FieldConfig[]>>((acc, field) => {
    if (!acc[field.section]) acc[field.section] = [];
    acc[field.section].push(field);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar & Email (read-only) */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile.name || profile.email || '?')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </Text>
            </View>
            <Text style={styles.emailText}>{profile.email}</Text>
            <Text style={styles.emailHint}>Email is managed through your account settings</Text>
          </View>

          {/* Field Sections */}
          {Object.entries(sections).map(([sectionName, fields]) => (
            <View key={sectionName} style={styles.section}>
              <Text style={styles.sectionTitle}>{sectionName}</Text>
              {fields.map((field) => (
                <View key={field.key} style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>
                    {field.icon} {field.label}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      field.multiline && styles.inputMultiline,
                    ]}
                    value={(profile[field.key] as string) ?? ''}
                    onChangeText={(text) => updateField(field.key, text)}
                    placeholder={field.placeholder}
                    placeholderTextColor="#555"
                    keyboardType={field.keyboardType ?? 'default'}
                    multiline={field.multiline}
                    numberOfLines={field.multiline ? 3 : 1}
                    autoCapitalize={field.key === 'phone' ? 'none' : 'words'}
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>
          ))}

          {/* Why this matters */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>💡 Why fill this out?</Text>
            <Text style={styles.infoText}>
              Your profile helps NTWRK show how you're connected to others.
              Shared schools, companies, and locations highlight common ground
              between you and the people in your network.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Save Button */}
        {hasChanges() && (
          <View style={styles.saveBar}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2A2F54',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#7B61FF',
  },
  emailText: {
    fontSize: 16,
    color: '#E6E6E6',
    fontWeight: '500',
  },
  emailHint: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7B61FF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#8892B0',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#141833',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#E6E6E6',
    borderWidth: 1,
    borderColor: '#2A2F4D',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  infoBox: {
    backgroundColor: '#141833',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2F4D',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E6E6E6',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#8892B0',
    lineHeight: 20,
  },
  saveBar: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#0A0E27',
    borderTopWidth: 1,
    borderTopColor: '#1A1F3D',
  },
  saveButton: {
    backgroundColor: '#7B61FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProfileScreen;
