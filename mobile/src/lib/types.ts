export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];

export const LEVELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Expert',
};

export interface Slot {
  day: Day;
  startHour: number;
  endHour: number;
}

export interface Skill {
  name: string;
  level: number;
  tags: string[];
  description: string;
}

export interface SkillRow extends Skill {
  id: string;
}

export interface AvailabilityRow {
  id: string;
  day: Day;
  start_hour: number;
  end_hour: number;
}

export interface Reputation {
  rating: number;
  sessions: number;
}

export interface Profile {
  id: string;
  name: string;
  department: string;
  year: number | null;
  bio: string;
  rating: number;
  sessions_count: number;
}

export interface LearningRequest {
  id: string;
  learner_id: string;
  skill: string;
  level: number;
  goal: string;
  slots: Slot[];
  status: 'open' | 'matched' | 'closed';
  created_at: string;
}

export interface MentorCandidate {
  id: string;
  name: string;
  department?: string;
  year?: number | null;
  skills: Skill[];
  availability: Slot[];
  reputation?: Reputation;
}

export interface MatchBreakdown {
  proficiency: number;
  availability: number;
  reputation: number;
  goal: number;
}

export interface Match {
  mentorId: string;
  name: string;
  score: number;
  breakdown: MatchBreakdown;
  skill: Skill;
}

export interface PlanItem {
  id: string;
  title: string;
  done: boolean;
  created_at: string;
}

export interface RoomSession {
  id: string;
  scheduled_at: string;
  duration_mins: number;
  notes: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface Room {
  id: string;
  request_id: string;
  mentor_id: string;
  learner_id: string;
  skill: string;
  status: 'active' | 'completed';
  created_at: string;
  mentor: { name: string } | null;
  learner: { name: string } | null;
  plan_items: PlanItem[];
  room_sessions: RoomSession[];
}

export interface DoubtReply {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: { name: string } | null;
}

export interface Doubt {
  id: string;
  room_id: string;
  author_id: string;
  body: string;
  resolved: boolean;
  created_at: string;
  author: { name: string } | null;
  doubt_replies: DoubtReply[];
}
