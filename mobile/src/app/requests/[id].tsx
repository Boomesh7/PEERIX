import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { connectWithMentor, getMatches, getRequest } from '@/lib/api';
import { DEFAULT_WEIGHTS } from '@/lib/matching';
import { LEVELS, type MatchBreakdown } from '@/lib/types';
import { Body, Button, Card, ErrorText, Muted, ProgressBar, Row, Screen, Title, colors } from '@/components/ui';
import { Text } from 'react-native';

const FACTOR_LABELS: Record<keyof MatchBreakdown, string> = {
  proficiency: 'Level fit',
  availability: 'Time overlap',
  reputation: 'Reputation',
  goal: 'Goal fit',
};
const FACTORS = Object.keys(FACTOR_LABELS) as Array<keyof MatchBreakdown>;

export default function MatchesScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const request = useQuery({ queryKey: ['request', id], queryFn: () => getRequest(id) });
  const matches = useQuery({
    queryKey: ['matches', id],
    queryFn: () => getMatches(request.data!),
    enabled: Boolean(request.data),
  });

  const connect = useMutation({
    mutationFn: (mentorId: string) => connectWithMentor(id, mentorId),
    onSuccess: (room) => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['requests'] });
      router.replace(`/rooms/${room.id}`);
    },
  });

  const r = request.data;
  return (
    <Screen>
      {r && (
        <Card>
          <Title>
            Mentors for {r.skill} ({LEVELS[r.level]})
          </Title>
          {r.goal ? <Body>Goal: {r.goal}</Body> : null}
          <Muted small>
            Score = {FACTORS.map((k) => `${DEFAULT_WEIGHTS[k]} × ${FACTOR_LABELS[k].toLowerCase()}`).join(' + ')}
          </Muted>
        </Card>
      )}

      {matches.isLoading && <Muted>Finding mentors…</Muted>}
      {matches.data?.length === 0 && (
        <Card>
          <Muted>No mentors above your level teach this skill yet. Check back later or ask a classmate to add it.</Muted>
        </Card>
      )}

      {matches.data?.map((m, i) => (
        <Card key={m.mentorId}>
          <Row between>
            <View style={{ flex: 1 }}>
              <Body bold>
                #{i + 1} {m.name}
              </Body>
              <Muted>
                {m.skill.name} · {LEVELS[m.skill.level]}
              </Muted>
              {m.skill.description ? <Muted small>{m.skill.description}</Muted> : null}
            </View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: colors.brand }}>{Math.round(m.score * 100)}%</Text>
          </Row>
          {FACTORS.map((k) => (
            <View key={k} style={{ gap: 2 }}>
              <Row between>
                <Muted small>{FACTOR_LABELS[k]}</Muted>
                <Muted small>{Math.round(m.breakdown[k] * 100)}%</Muted>
              </Row>
              <ProgressBar value={Math.round(m.breakdown[k] * 100)} thin />
            </View>
          ))}
          <Button title="Connect & open learning room" disabled={connect.isPending} onPress={() => connect.mutate(m.mentorId)} />
        </Card>
      ))}
      <ErrorText error={request.error || matches.error || connect.error} />
    </Screen>
  );
}
