import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addAvailability,
  addSkill,
  getProfile,
  listAvailability,
  listSkills,
  removeAvailability,
  removeSkill,
  updateProfile,
} from '@/lib/api';
import { useSession, useUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { LEVELS, type Day } from '@/lib/types';
import {
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
import { View } from 'react-native';

export default function ProfileScreen() {
  const userId = useUserId();
  const { session } = useSession();
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ['profile', userId], queryFn: () => getProfile(userId) });
  const skills = useQuery({ queryKey: ['skills', userId], queryFn: () => listSkills(userId) });
  const slots = useQuery({ queryKey: ['availability', userId], queryFn: () => listAvailability(userId) });

  const [details, setDetails] = useState({ name: '', department: '', year: 0, bio: '' });
  useEffect(() => {
    const p = profile.data;
    if (p) setDetails({ name: p.name, department: p.department, year: p.year ?? 0, bio: p.bio });
  }, [profile.data]);

  const saveDetails = useMutation({
    mutationFn: () =>
      updateProfile(userId, {
        name: details.name.trim(),
        department: details.department.trim(),
        year: details.year || null,
        bio: details.bio.trim(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  });

  const [skill, setSkill] = useState({ name: '', level: 3, tags: '', description: '' });
  const createSkill = useMutation({
    mutationFn: () =>
      addSkill({
        name: skill.name.trim(),
        level: skill.level,
        tags: skill.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        description: skill.description.trim(),
      }),
    onSuccess: () => {
      setSkill({ name: '', level: 3, tags: '', description: '' });
      qc.invalidateQueries({ queryKey: ['skills', userId] });
    },
  });
  const deleteSkill = useMutation({
    mutationFn: removeSkill,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills', userId] }),
  });

  const [slot, setSlot] = useState<{ day: Day; start: number; end: number }>({ day: 'Mon', start: 16, end: 18 });
  const createSlot = useMutation({
    mutationFn: () => addAvailability({ day: slot.day, start_hour: slot.start, end_hour: slot.end }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability', userId] }),
  });
  const deleteSlot = useMutation({
    mutationFn: removeAvailability,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability', userId] }),
  });

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
  }

  return (
    <Screen>
      <Card>
        <Title>Your profile</Title>
        <Muted small>{session?.user.email} · only you can see your email</Muted>
        <Field label="Name" maxLength={80} value={details.name} onChangeText={(name) => setDetails({ ...details, name })} />
        <Field
          label="Department"
          maxLength={80}
          value={details.department}
          onChangeText={(department) => setDetails({ ...details, department })}
        />
        <Options
          label="Year"
          options={[0, 1, 2, 3, 4, 5].map((y) => ({ value: y, label: y === 0 ? '-' : `Year ${y}` }))}
          value={details.year}
          onChange={(year) => setDetails({ ...details, year })}
        />
        <Field label="About you" multiline maxLength={500} value={details.bio} onChangeText={(bio) => setDetails({ ...details, bio })} />
        <Button title={saveDetails.isSuccess ? 'Saved ✓' : 'Save profile'} disabled={saveDetails.isPending || !details.name.trim()} onPress={() => saveDetails.mutate()} />
        <ErrorText error={saveDetails.error || profile.error} />
      </Card>

      <Card>
        <Title>Skills you can teach</Title>
        <Muted>Learners are matched with you when you list a skill above their level.</Muted>
        {skills.data?.map((s) => (
          <Row key={s.id} between style={styles.divider}>
            <View style={{ flex: 1 }}>
              <Body bold>
                {s.name} · {LEVELS[s.level]}
              </Body>
              {s.tags.length > 0 && <Muted small>{s.tags.join(', ')}</Muted>}
            </View>
            <Button title="Remove" variant="danger" onPress={() => deleteSkill.mutate(s.id)} />
          </Row>
        ))}
        {skills.data?.length === 0 && <Muted>No skills yet.</Muted>}
        <Field label="Skill" placeholder="e.g. Python" maxLength={60} value={skill.name} onChangeText={(name) => setSkill({ ...skill, name })} />
        <Options
          label="Your level"
          options={Object.entries(LEVELS).map(([v, label]) => ({ value: Number(v), label }))}
          value={skill.level}
          onChange={(level) => setSkill({ ...skill, level })}
        />
        <Field label="Topics (comma separated)" placeholder="pandas, data analysis" value={skill.tags} onChangeText={(tags) => setSkill({ ...skill, tags })} />
        <Field label="Short description" maxLength={300} value={skill.description} onChangeText={(description) => setSkill({ ...skill, description })} />
        <Button title="Add skill" disabled={createSkill.isPending || !skill.name.trim()} onPress={() => createSkill.mutate()} />
        <ErrorText error={createSkill.error || deleteSkill.error || skills.error} />
      </Card>

      <Card>
        <Title>When you are free to teach</Title>
        {slots.data?.map((s) => (
          <Row key={s.id} between style={styles.divider}>
            <Body>
              {s.day} {formatHour(s.start_hour)}–{formatHour(s.end_hour)}
            </Body>
            <Button title="Remove" variant="danger" onPress={() => deleteSlot.mutate(s.id)} />
          </Row>
        ))}
        {slots.data?.length === 0 && <Muted>No free times yet.</Muted>}
        <SlotPicker value={slot} onChange={setSlot} />
        <Button title="Add free time" disabled={createSlot.isPending || slot.end <= slot.start} onPress={() => createSlot.mutate()} />
        <ErrorText error={createSlot.error || deleteSlot.error || slots.error} />
      </Card>

      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
