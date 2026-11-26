import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addPlanItem,
  askDoubt,
  getRoom,
  listDoubts,
  replyToDoubt,
  resolveDoubt,
  scheduleSession,
  setPlanItemDone,
  setRoomStatus,
  setSessionStatus,
} from '@/lib/api';
import { otherParty, roomSummary } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/lib/session';
import type { Doubt } from '@/lib/types';
import {
  Badge,
  Body,
  Button,
  Card,
  ErrorText,
  Field,
  Loading,
  Muted,
  Options,
  ProgressBar,
  Row,
  Screen,
  Stepper,
  Title,
  colors,
  formatHour,
  styles,
} from '@/components/ui';

export default function RoomScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const qc = useQueryClient();
  const room = useQuery({ queryKey: ['room', id], queryFn: () => getRoom(id) });
  const refreshRoom = () => {
    qc.invalidateQueries({ queryKey: ['room', id] });
    qc.invalidateQueries({ queryKey: ['rooms'] });
  };

  const [planTitle, setPlanTitle] = useState('');
  const addPlan = useMutation({
    mutationFn: () => addPlanItem(id, planTitle.trim()),
    onSuccess: () => {
      setPlanTitle('');
      refreshRoom();
    },
  });
  const togglePlan = useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) => setPlanItemDone(itemId, done),
    onSuccess: refreshRoom,
  });

  // Next 14 days as choices; time picked by hour.
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);
  const [session, setSession] = useState({ dayIndex: 1, hour: 17, duration: 60, notes: '' });
  const schedule = useMutation({
    mutationFn: () => {
      const when = new Date(days[session.dayIndex]);
      when.setHours(session.hour, 0, 0, 0);
      return scheduleSession(id, when.toISOString(), session.duration, session.notes.trim());
    },
    onSuccess: () => {
      setSession({ ...session, notes: '' });
      refreshRoom();
    },
  });
  const updateSession = useMutation({
    mutationFn: ({ sessionId, status }: { sessionId: string; status: 'completed' | 'cancelled' }) =>
      setSessionStatus(sessionId, status),
    onSuccess: refreshRoom,
  });
  const finishRoom = useMutation({
    mutationFn: () => setRoomStatus(id, room.data?.status === 'completed' ? 'active' : 'completed'),
    onSuccess: refreshRoom,
  });

  if (room.isLoading) return <Loading />;
  if (!room.data)
    return (
      <Screen>
        <ErrorText error={room.error ?? 'Room not found'} />
      </Screen>
    );

  const r = room.data;
  const other = otherParty(r, userId);
  const summary = roomSummary(r);

  return (
    <Screen>
      <Stack.Screen options={{ title: r.skill }} />
      <Card>
        <Row between>
          <Title>{r.skill}</Title>
          <Badge status={r.status} />
        </Row>
        <Muted>
          You are the {other.role === 'mentor' ? 'learner' : 'mentor'} · {other.role === 'mentor' ? 'Mentor' : 'Learner'}: {other.name}
        </Muted>
        <ProgressBar value={summary.progress} />
        <Muted small>
          {summary.progress}% of plan done · {summary.completedSessions} sessions completed · {summary.upcomingSessions} upcoming
        </Muted>
        <Button
          title={r.status === 'completed' ? 'Reopen room' : 'Mark room completed'}
          variant="secondary"
          onPress={() => finishRoom.mutate()}
        />
        <ErrorText error={finishRoom.error} />
      </Card>

      <Card>
        <Title>Learning plan</Title>
        {r.plan_items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done }}
            onPress={() => togglePlan.mutate({ itemId: item.id, done: !item.done })}
            style={[styles.row, styles.divider]}
          >
            <Text style={{ fontSize: 18, color: item.done ? colors.ok : colors.muted }}>{item.done ? '☑' : '☐'}</Text>
            <Body strike={item.done}>{item.title}</Body>
          </Pressable>
        ))}
        {r.plan_items.length === 0 && <Muted>No plan items yet.</Muted>}
        <Field label="Add a topic" maxLength={200} value={planTitle} onChangeText={setPlanTitle} />
        <Button title="Add to plan" disabled={addPlan.isPending || !planTitle.trim()} onPress={() => addPlan.mutate()} />
        <ErrorText error={addPlan.error || togglePlan.error} />
      </Card>

      <Card>
        <Title>Sessions</Title>
        {r.room_sessions.map((s) => (
          <View key={s.id} style={[styles.divider, { gap: 4 }]}>
            <Row between>
              <Body>
                {new Date(s.scheduled_at).toLocaleString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                · {s.duration_mins} min
              </Body>
              <Badge status={s.status} />
            </Row>
            {s.notes ? <Muted small>{s.notes}</Muted> : null}
            {s.status === 'scheduled' && (
              <Row>
                <Button title="Mark done" variant="link" onPress={() => updateSession.mutate({ sessionId: s.id, status: 'completed' })} />
                <Button title="Cancel" variant="danger" onPress={() => updateSession.mutate({ sessionId: s.id, status: 'cancelled' })} />
              </Row>
            )}
          </View>
        ))}
        {r.room_sessions.length === 0 && <Muted>No sessions yet.</Muted>}

        <Body bold>Schedule a session</Body>
        <Options
          options={days.map((d, i) => ({
            value: i,
            label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
          }))}
          value={session.dayIndex}
          onChange={(dayIndex) => setSession({ ...session, dayIndex })}
        />
        <Stepper label="Start time" value={session.hour} min={6} max={22} format={formatHour} onChange={(hour) => setSession({ ...session, hour })} />
        <Options
          label="Length"
          options={[30, 45, 60, 90, 120].map((m) => ({ value: m, label: `${m} min` }))}
          value={session.duration}
          onChange={(duration) => setSession({ ...session, duration })}
        />
        <Field label="Notes (optional)" maxLength={1000} value={session.notes} onChangeText={(notes) => setSession({ ...session, notes })} />
        <Button title="Schedule session" disabled={schedule.isPending} onPress={() => schedule.mutate()} />
        <ErrorText error={schedule.error || updateSession.error} />
      </Card>

      <DoubtCorner roomId={id} userId={userId} />
    </Screen>
  );
}

function DoubtCorner({ roomId, userId }: { roomId: string; userId: string }) {
  const qc = useQueryClient();
  const doubts = useQuery({ queryKey: ['doubts', roomId], queryFn: () => listDoubts(roomId) });

  // Live updates: new doubts, replies and resolutions appear without a refresh.
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: ['doubts', roomId] });
    const channel = supabase
      .channel(`doubts-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doubts', filter: `room_id=eq.${roomId}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'doubt_replies' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, qc]);

  const [text, setText] = useState('');
  const ask = useMutation({
    mutationFn: () => askDoubt(roomId, text.trim()),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['doubts', roomId] });
    },
  });

  return (
    <Card>
      <Title>Doubt Corner</Title>
      <Muted small>Ask any time, even after your sessions end.</Muted>
      <Field label="Your doubt" multiline maxLength={2000} value={text} onChangeText={setText} />
      <Button title="Ask" disabled={ask.isPending || !text.trim()} onPress={() => ask.mutate()} />
      <ErrorText error={ask.error || doubts.error} />
      {doubts.data?.map((d) => (
        <DoubtThread key={d.id} doubt={d} userId={userId} onChange={() => qc.invalidateQueries({ queryKey: ['doubts', roomId] })} />
      ))}
      {doubts.data?.length === 0 && <Muted>No doubts yet.</Muted>}
    </Card>
  );
}

function DoubtThread({ doubt, userId, onChange }: { doubt: Doubt; userId: string; onChange: () => void }) {
  const [reply, setReply] = useState('');
  const send = useMutation({
    mutationFn: () => replyToDoubt(doubt.id, reply.trim()),
    onSuccess: () => {
      setReply('');
      onChange();
    },
  });
  const resolve = useMutation({ mutationFn: () => resolveDoubt(doubt.id), onSuccess: onChange });

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 12,
        padding: 12,
        gap: 6,
        backgroundColor: doubt.resolved ? colors.okSoft : '#fff',
      }}
    >
      <Row between>
        <Body bold>{doubt.author?.name ?? 'Student'}</Body>
        {doubt.resolved ? (
          <Badge status="resolved" />
        ) : (
          doubt.author_id === userId && <Button title="Mark resolved" variant="link" onPress={() => resolve.mutate()} />
        )}
      </Row>
      <Body>{doubt.body}</Body>
      <Muted small>{new Date(doubt.created_at).toLocaleString()}</Muted>
      {doubt.doubt_replies.map((rep) => (
        <View key={rep.id} style={{ borderLeftWidth: 3, borderLeftColor: colors.brandSoft, paddingLeft: 10 }}>
          <Body>
            <Text style={{ fontWeight: '700' }}>{rep.author?.name ?? 'Student'}: </Text>
            {rep.body}
          </Body>
        </View>
      ))}
      <Field label="Reply" maxLength={2000} value={reply} onChangeText={setReply} />
      <Button title="Send reply" variant="secondary" disabled={send.isPending || !reply.trim()} onPress={() => send.mutate()} />
      <ErrorText error={send.error || resolve.error} />
    </View>
  );
}
