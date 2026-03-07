import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';

const AuthScreen: React.FC = () => {
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: isSignUpLoaded } = useSignUp();

  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [pendingPhoneVerification, setPendingPhoneVerification] = useState(false);
  const [pendingSignInVerification, setPendingSignInVerification] = useState(false);
  const [signInStrategy, setSignInStrategy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email.');
      return false;
    }

    if (!password) {
      setError('Please enter your password.');
      return false;
    }

    if (isSignUpMode) {
      if (!username.trim()) {
        setError('Please enter a username.');
        return false;
      }

      if (!phoneNumber.trim()) {
        setError('Please enter your phone number.');
        return false;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return false;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return false;
      }
    }

    return true;
  };

  const handleSignIn = async () => {
    if (!isSignInLoaded || !signIn) return;
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      console.log('Sign-in result:', JSON.stringify({
        status: result.status,
        firstFactors: result.supportedFirstFactors?.map((f: any) => f.strategy),
        secondFactors: result.supportedSecondFactors?.map((f: any) => f.strategy),
      }));

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
      } else if (result.status === 'needs_first_factor') {
        const factors = result.supportedFirstFactors ?? [];
        const strategies = factors.map((f: any) => f.strategy);
        console.log('First factor strategies:', JSON.stringify(factors));
        // Use the first available factor Clerk returns
        const factor = factors[0];
        if (factor) {
          // Prepare using the exact strategy Clerk provides
          const payload: any = { strategy: factor.strategy };
          // Only add ids if present (type-safe)
          if ('emailAddressId' in factor && factor.emailAddressId) payload.emailAddressId = factor.emailAddressId;
          if ('phoneNumberId' in factor && factor.phoneNumberId) payload.phoneNumberId = factor.phoneNumberId;
          await signIn.prepareFirstFactor(payload);
          setSignInStrategy(factor.strategy);
          setPendingSignInVerification(true);
        } else {
          setError('No supported first factor found. Check Clerk settings.');
        }
      } else if (result.status === 'needs_second_factor') {
        const secondFactors = result.supportedSecondFactors ?? [];
        const factor = secondFactors[0];
        if (factor) {
          // Only call prepareSecondFactor for allowed strategies
          if (factor.strategy === 'phone_code') {
            try {
              const payload: any = { strategy: 'phone_code' };
              if ('phoneNumberId' in factor && factor.phoneNumberId) payload.phoneNumberId = factor.phoneNumberId;
              await signIn.prepareSecondFactor(payload);
            } catch (e) {}
          } else if (factor.strategy === 'email_code' || factor.strategy === 'email_link') {
            try {
              const payload: any = { strategy: factor.strategy };
              if ('emailAddressId' in factor && factor.emailAddressId) payload.emailAddressId = factor.emailAddressId;
              await signIn.prepareSecondFactor(payload);
            } catch (e) {}
          }
          setSignInStrategy(factor.strategy);
          setPendingSignInVerification(true);
        } else {
          setError('Two-factor authentication required but no method available. Check Clerk dashboard.');
        }
      } else {
        // Show a clear error and allow user to try again
        setError('Sign-in requires additional steps or an unsupported flow. Please check your Clerk dashboard settings or contact support.');
        setPendingSignInVerification(false);
        setSignInStrategy(null);
      }
    } catch (err: any) {
      console.log('Sign-in error:', JSON.stringify(err?.errors ?? err));
      const message = err?.errors?.[0]?.longMessage
        ?? err?.errors?.[0]?.message
        ?? 'Sign-in failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isSignInLoaded || !signIn) return;

    setLoading(true);
    setError(null);

    try {
      if (signInStrategy === 'email_code') {
        const factors = signIn.supportedFirstFactors ?? [];
        const emailFactor = factors.find((f: any) => f.strategy === 'email_code') as any;
        if (emailFactor) {
          await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: emailFactor.emailAddressId });
        }
      } else if (signInStrategy === 'phone_code') {
        const factors = signIn.supportedFirstFactors ?? [];
        const phoneFactor = factors.find((f: any) => f.strategy === 'phone_code') as any;
        if (phoneFactor) {
          await signIn.prepareFirstFactor({ strategy: 'phone_code', phoneNumberId: phoneFactor.phoneNumberId });
        }
      } else if (signInStrategy === 'phone_code_2fa') {
        await signIn.prepareSecondFactor({ strategy: 'phone_code' });
      }
      setError(null);
      setVerificationCode('');
      console.log('✅ Code resent');
    } catch (err: any) {
      console.log('Resend error:', JSON.stringify(err?.errors ?? err));
      const message = err?.errors?.[0]?.longMessage ?? 'Failed to resend code.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInVerification = async () => {
    if (!isSignInLoaded || !signIn) return;

    setLoading(true);
    setError(null);

    try {
      let result;

      if (signInStrategy === 'email_code' || signInStrategy === 'phone_code') {
        result = await signIn.attemptFirstFactor({
          strategy: signInStrategy,
          code: verificationCode,
        });
      } else if (signInStrategy === 'phone_code_2fa') {
        result = await signIn.attemptSecondFactor({
          strategy: 'phone_code',
          code: verificationCode,
        });
      } else if (signInStrategy === 'totp') {
        result = await signIn.attemptSecondFactor({
          strategy: 'totp',
          code: verificationCode,
        });
      } else if (signInStrategy === 'backup_code') {
        result = await signIn.attemptSecondFactor({
          strategy: 'backup_code',
          code: verificationCode,
        });
      } else {
        // Fallback: try as second factor with whatever strategy name we have
        console.log('Attempting second factor with strategy:', signInStrategy);
        result = await signIn.attemptSecondFactor({
          strategy: signInStrategy as any,
          code: verificationCode,
        });
      }

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
      } else if (result.status === 'needs_second_factor') {
        // First factor passed, now need second factor
        const supportedStrategies = result.supportedSecondFactors?.map(
          (f: any) => f.strategy
        ) ?? [];

        if (supportedStrategies.includes('phone_code')) {
          await signIn.prepareSecondFactor({ strategy: 'phone_code' });
          setSignInStrategy('phone_code_2fa');
          setVerificationCode('');
        } else if (supportedStrategies.includes('totp')) {
          setSignInStrategy('totp');
          setVerificationCode('');
        } else {
          setError('Two-factor authentication required but no supported method found.');
        }
      } else {
        console.log('Sign-in verification status:', result.status);
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      console.log('Sign-in verification error:', JSON.stringify(err?.errors ?? err));
      const message = err?.errors?.[0]?.longMessage
        ?? err?.errors?.[0]?.message
        ?? 'Invalid verification code.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!isSignUpLoaded || !signUp) return;
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      await signUp.create({
        emailAddress: email.trim(),
        username: username.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage
        ?? err?.errors?.[0]?.message
        ?? 'Sign-up failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isSignUpLoaded || !signUp) return;

    setLoading(true);
    setError(null);

    try {
      let result;

      if (pendingPhoneVerification) {
        // Verify phone code
        result = await signUp.attemptPhoneNumberVerification({
          code: verificationCode,
        });
      } else {
        // Verify email code
        result = await signUp.attemptEmailAddressVerification({
          code: verificationCode,
        });
      }

      console.log('Verification result:', JSON.stringify({
        status: result.status,
        missingFields: result.missingFields,
        unverifiedFields: result.unverifiedFields,
        createdSessionId: result.createdSessionId,
      }));

      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
      } else if (
        result.status === 'missing_requirements' &&
        result.unverifiedFields?.includes('phone_number') &&
        !pendingPhoneVerification
      ) {
        // Phone still needs verification — send SMS code
        await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
        setPendingPhoneVerification(true);
        setVerificationCode('');
        setError(null);
      } else if (result.createdSessionId) {
        await setSignUpActive({ session: result.createdSessionId });
      } else {
        setError(
          `Additional info required: ${result.missingFields?.join(', ') ?? result.unverifiedFields?.join(', ') ?? 'unknown'}. Please check your Clerk dashboard settings.`,
        );
      }
    } catch (err: any) {
      console.log('Verification error:', JSON.stringify(err?.errors ?? err));
      const message = err?.errors?.[0]?.longMessage
        ?? err?.errors?.[0]?.message
        ?? 'Invalid verification code.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUpMode(!isSignUpMode);
    setError(null);
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setPhoneNumber('');
    setPendingVerification(false);
    setPendingPhoneVerification(false);
    setPendingSignInVerification(false);
    setSignInStrategy(null);
    setVerificationCode('');
  };

  // Sign-in verification screen (first factor / 2FA)
  if (pendingSignInVerification) {
    const verificationLabel =
      signInStrategy === 'totp'
        ? 'Enter your authenticator code'
        : signInStrategy === 'phone_code_2fa'
        ? 'Enter the SMS code sent to your phone'
        : signInStrategy === 'phone_code'
        ? 'Enter the SMS code sent to your phone'
        : `Enter the code sent to ${email}`;

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>NTWRK</Text>
            <Text style={styles.subtitle}>Verify your identity</Text>
            <Text style={styles.description}>{verificationLabel}</Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Verification Code"
            placeholderTextColor="#999"
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignInVerification}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>

          {(signInStrategy === 'email_code' || signInStrategy === 'phone_code' || signInStrategy === 'phone_code_2fa') && (
            <TouchableOpacity
              onPress={handleResendCode}
              disabled={loading}
              style={styles.toggleButton}
            >
              <Text style={styles.toggleText}>Resend Code</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              setPendingSignInVerification(false);
              setSignInStrategy(null);
              setVerificationCode('');
              setError(null);
            }}
            disabled={loading}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>Back to Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Sign-up email / phone verification screen
  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>NTWRK</Text>
            <Text style={styles.subtitle}>
              {pendingPhoneVerification ? 'Verify your phone' : 'Verify your email'}
            </Text>
            <Text style={styles.description}>
              {pendingPhoneVerification
                ? `We sent an SMS code to ${phoneNumber}`
                : `We sent a code to ${email}`}
            </Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Verification Code"
            placeholderTextColor="#999"
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {pendingPhoneVerification ? 'Verify Phone' : 'Verify Email'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleMode} disabled={loading} style={styles.toggleButton}>
            <Text style={styles.toggleText}>Back to Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>NTWRK</Text>
          <Text style={styles.subtitle}>
            {isSignUpMode ? 'Create your account' : 'Welcome back'}
          </Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        {isSignUpMode && (
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        )}

        {isSignUpMode && (
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="#999"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            editable={!loading}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="none"
          autoComplete="off"
          editable={!loading}
        />

        {isSignUpMode && (
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
            editable={!loading}
          />
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={isSignUpMode ? handleSignUp : handleSignIn}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUpMode ? 'Create Account' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleMode} disabled={loading} style={styles.toggleButton}>
          <Text style={styles.toggleText}>
            {isSignUpMode
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#4A90D9',
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8892B0',
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: '#8892B0',
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FF5252',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#1A1F3D',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#E6E6E6',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2A2F4D',
  },
  button: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  toggleButton: {
    alignItems: 'center',
    marginTop: 20,
    padding: 8,
  },
  toggleText: {
    color: '#4A90D9',
    fontSize: 14,
  },
});

export default AuthScreen;
