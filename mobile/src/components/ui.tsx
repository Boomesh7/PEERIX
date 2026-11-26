import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { DAYS, type Day } from '@/lib/types';

export const colors = {
  bg: '#F6F7FB',
  card: '#FFFFFF',
  text: '#1C2233',
  muted: '#667085',
  line: '#E4E7EC',
  brand: '#4F46E5',
  brandSoft: '#EEF2FF',
  ok: '#067647',
  okSoft: '#ECFDF3',
  danger: '#B42318',
};

export function Screen({ children, refreshing }: { children: ReactNode; refreshing?: boolean }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      {refreshing && <ActivityIndicator color={colors.brand} />}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children, bold, strike }: { children: ReactNode; bold?: boolean; strike?: boolean }) {
  return (
    <Text style={[styles.body, bold && { fontWeight: '700' }, strike && { textDecorationLine: 'line-through', color: colors.muted }]}>
      {children}
    </Text>
  );
}

export function Muted({ children, small }: { children: ReactNode; small?: boolean }) {
  return <Text style={[styles.muted, small && { fontSize: 13 }]}>{children}</Text>;
}

export function Row({ children, between, style }: { children: ReactNode; between?: boolean; style?: ViewStyle }) {
  return <View style={[styles.row, between && { justifyContent: 'space-between' }, style]}>{children}</View>;
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...input} style={[styles.input, input.multiline && { minHeight: 64 }]} />
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'link' | 'danger';
}) {
  const isLink = variant === 'link' || variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        !isLink && styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        (disabled || pressed) && { opacity: 0.5 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant !== 'primary' && { color: colors.brand },
          variant === 'danger' && { color: colors.danger },
          isLink && { fontWeight: '500' },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** A row of tappable choices, used in place of a dropdown. */
export function Options<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 4 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.chips}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && { color: '#fff' }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <Row>
        <Pressable accessibilityLabel={`Decrease ${label}`} style={styles.step} onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={[styles.body, { minWidth: 56, textAlign: 'center' }]}>{format ? format(value) : value}</Text>
        <Pressable accessibilityLabel={`Increase ${label}`} style={styles.step} onPress={() => onChange(Math.min(max, value + 1))}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </Row>
    </View>
  );
}

export function SlotPicker({
  value,
  onChange,
}: {
  value: { day: Day; start: number; end: number };
  onChange: (v: { day: Day; start: number; end: number }) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Options options={DAYS.map((d) => ({ value: d, label: d }))} value={value.day} onChange={(day) => onChange({ ...value, day })} />
      <Row>
        <Stepper label="From" value={value.start} min={0} max={23} format={formatHour} onChange={(start) => onChange({ ...value, start })} />
        <Stepper label="To" value={value.end} min={1} max={24} format={formatHour} onChange={(end) => onChange({ ...value, end })} />
      </Row>
    </View>
  );
}

export function ProgressBar({ value, thin }: { value: number; thin?: boolean }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={[styles.progress, thin && { height: 6, flex: 1, marginVertical: 0 }]}
    >
      <View style={{ width: `${value}%`, height: '100%', backgroundColor: colors.brand }} />
    </View>
  );
}

export function Badge({ status }: { status: string }) {
  const ok = status === 'completed' || status === 'matched' || status === 'resolved';
  const grey = status === 'cancelled' || status === 'closed';
  return (
    <Text
      style={[
        styles.badge,
        ok && { backgroundColor: colors.okSoft, color: colors.ok },
        grey && { backgroundColor: '#F2F4F7', color: colors.muted },
      ]}
    >
      {status}
    </Text>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <Text style={{ color: colors.danger }}>{error instanceof Error ? error.message : String(error)}</Text>;
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12 am';
  if (h === 12) return '12 pm';
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

export const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16, paddingBottom: 48 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: colors.text,
  },
  button: { backgroundColor: colors.brand, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  buttonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.brand },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.brandSoft },
  chipActive: { backgroundColor: colors.brand },
  chipText: { color: colors.brand, fontWeight: '600', fontSize: 13 },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.brand, fontSize: 20, fontWeight: '700' },
  progress: { height: 8, backgroundColor: colors.brandSoft, borderRadius: 999, overflow: 'hidden', marginVertical: 4 },
  badge: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.brandSoft,
    color: colors.brand,
    alignSelf: 'flex-start',
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 10 },
});
