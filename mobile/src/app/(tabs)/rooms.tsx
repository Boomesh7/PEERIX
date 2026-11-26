import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { listMyRooms } from '@/lib/api';
import { otherParty, roomSummary } from '@/lib/progress';
import { useUserId } from '@/lib/session';
import { Badge, Body, Button, Card, ErrorText, Muted, ProgressBar, Row, Screen } from '@/components/ui';

export default function RoomsScreen() {
  const userId = useUserId();
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: listMyRooms });

  return (
    <Screen>
      {rooms.data?.length === 0 && (
        <Card>
          <Muted>
            No rooms yet. Post a learning request and connect with a mentor, or add skills to your profile so learners can
            find you.
          </Muted>
        </Card>
      )}
      {rooms.data?.map((room) => {
        const other = otherParty(room, userId);
        const s = roomSummary(room);
        return (
          <Pressable key={room.id} onPress={() => router.push(`/rooms/${room.id}`)}>
            <Card>
              <Row between>
                <Body bold>{room.skill}</Body>
                <Badge status={room.status} />
              </Row>
              <Muted>
                {other.role === 'mentor' ? 'Mentor' : 'Learner'}: {other.name}
              </Muted>
              <ProgressBar value={s.progress} />
              <Muted small>
                {s.progress}% of plan · {s.completedSessions} done · {s.upcomingSessions} upcoming
              </Muted>
            </Card>
          </Pressable>
        );
      })}
      <Button title={rooms.isFetching ? 'Refreshing…' : 'Refresh'} variant="link" onPress={() => rooms.refetch()} />
      <ErrorText error={rooms.error} />
    </Screen>
  );
}
