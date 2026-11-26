import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRequest, listMyRequests } from '@/lib/api';
import { useUserId } from '@/lib/session';
import { LEVELS, type Day, type Slot } from '@/lib/types';
import {
  Badge,
  Body,
  Button,
  Card,
  ErrorText,
  Field,
  Muted,
  Options,
  Row,
  Screen,
  SlotPicker,
  Title,
  formatHour,
  styles,
} from '@/components/ui';

export default function LearnScreen() {
  const userId = useUserId();
  const qc = useQueryClient();
  const requests = useQuery({ queryKey: ['requests', userId], queryFn: () => listMyRequests(userId) });

  const [form, setForm] = useState({ skill: '', level: 1, goal: '' });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<{ day: Day; start: number; end: number }>({ day: 'Mon', start: 16, end: 18 });

  const create = useMutation({
    mutationFn: () => createRequest({ skill: form.skill.trim(), level: form.level, goal: form.goal.trim(), slots }),
    onSuccess: (req) => {
      setForm({ skill: '', level: 1, goal: '' });
      setSlots([]);
      qc.invalidateQueries({ queryKey: ['requests', userId] });
      router.push(`/requests/${req.id}`);
    },
  });

  return (
    <Screen>
      <Card>
        <Title>What do you want to learn?</Title>
        <Muted>Describe your need and PEERIX finds the best mentors for you.</Muted>
        <Field label="Skill" placeholder="e.g. Python" maxLength={60} value={form.skill} onChangeText={(skill) => setForm({ ...form, skill })} />
        <Options
          label="Your current level"
          options={[1, 2, 3].map((l) => ({ value: l, label: LEVELS[l] }))}
          value={form.level}
          onChange={(level) => setForm({ ...form, level })}
        />
        <Field
          label="Your goal"
          multiline
          maxLength={500}
          placeholder="e.g. clean and analyse data with pandas for my mini project"
          value={form.goal}
          onChangeText={(goal) => setForm({ ...form, goal })}
        />

        <Body bold>When are you free?</Body>
        {slots.length > 0 && (
          <Row>
            {slots.map((s, i) => (
              <Pressable
                key={i}
                accessibilityLabel={`Remove ${s.day} time`}
                onPress={() => setSlots(slots.filter((_, j) => j !== i))}
                style={styles.chip}
              >
                <Text style={styles.chipText}>
                  {s.day} {formatHour(s.startHour)}–{formatHour(s.endHour)} ✕
                </Text>
              </Pressable>
            ))}
          </Row>
        )}
        <SlotPicker value={slot} onChange={setSlot} />
        <Button
          title="Add this time"
          variant="secondary"
          disabled={slot.end <= slot.start}
          onPress={() => setSlots([...slots, { day: slot.day, startHour: slot.start, endHour: slot.end }])}
        />
        <Button title="Find mentors" disabled={create.isPending || !form.skill.trim()} onPress={() => create.mutate()} />
        <ErrorText error={create.error} />
      </Card>

      <Card>
        <Title>Your requests</Title>
        {requests.data?.map((r) => (
          <Pressable key={r.id} onPress={() => router.push(`/requests/${r.id}`)} style={styles.divider}>
            <Row between>
              <Body bold>
                {r.skill} · {LEVELS[r.level]}
              </Body>
              <Badge status={r.status} />
            </Row>
            {r.goal ? <Muted>{r.goal}</Muted> : null}
            <Muted small>Tap to see matches</Muted>
          </Pressable>
        ))}
        {requests.data?.length === 0 && <Muted>No requests yet.</Muted>}
        <ErrorText error={requests.error} />
      </Card>
    </Screen>
  );
}
