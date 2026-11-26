import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getAllowedDomains, sendLoginCode, verifyLoginCode } from '@/lib/api';
import { validateInstitutionalEmail } from '@/lib/email';
import { Body, Button, Card, ErrorText, Field, Muted, Screen, colors } from '@/components/ui';

export default function Login() {
  const domains = useQuery({ queryKey: ['domains'], queryFn: getAllowedDomains });
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onSendCode() {
    const check = validateInstitutionalEmail(email, domains.data ?? []);
    if (!check.valid) return setError(check.reason);
    run(async () => {
      await sendLoginCode(check.email, name.trim() || undefined);
      setEmail(check.email);
      setStep('code');
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          <View style={{ marginTop: 48, gap: 6 }}>
            <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: 3, color: colors.brand }}>PEERIX</Text>
            <Muted>Learn. Teach. Pass It On. A verified peer-to-peer skill exchange for students.</Muted>
          </View>

          <Card>
            {step === 'email' ? (
              <>
                <Field
                  label="College email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder={domains.data?.[0] ? `you@${domains.data[0]}` : 'you@college.edu'}
                />
                <Field label="Your name (first time only)" value={name} onChangeText={setName} maxLength={80} />
                <Button title={busy ? 'Sending…' : 'Send login code'} disabled={busy || domains.isLoading} onPress={onSendCode} />
              </>
            ) : (
              <>
                <Body>
                  We sent a code to <Text style={{ fontWeight: '700' }}>{email}</Text>.
                </Body>
                <Field
                  label="Login code"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={10}
                />
                <Button
                  title={busy ? 'Checking…' : 'Sign in'}
                  disabled={busy || code.trim().length < 6}
                  onPress={() => run(() => verifyLoginCode(email, code.trim()))}
                />
                <Button title="Use a different email" variant="link" onPress={() => setStep('email')} />
              </>
            )}
            <ErrorText error={error} />
            {domains.error && <ErrorText error={`Could not reach PEERIX: ${(domains.error as Error).message}`} />}
          </Card>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
