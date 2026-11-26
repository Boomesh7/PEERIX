# PEERIX - Learn. Teach. Pass It On.

A verified peer-to-peer skill exchange and learning platform for college students.

## Phase 1 scope (Review 1)
- Registration restricted to official institutional email IDs
- Learner posts a requirement (skill, current level, goal, preferred slots)
- Reverse Matching: ranked mentor suggestions with an explainable score breakdown
- Learning Rooms: learner and mentor share a study plan and scheduled sessions, with progress tracking
- Doubt Corner: threaded doubts per room that stay open after sessions end

Planned for later phases: ratings and reputation, skill assessments, skill credits,
Teach-to-Learn prompts, React frontend.

## Backend

```
cd backend
npm install
cp .env.example .env      # set MONGO_URI, JWT_SECRET, ALLOWED_EMAIL_DOMAINS
npm test                  # unit tests (no database needed)
npm run dev
```

### API
| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/register | Register (institutional email only) |
| POST | /api/auth/login | Login, returns JWT |
| POST | /api/requests | Post a learning requirement |
| GET | /api/requests/mine | List my requirements |
| GET | /api/requests/:id/matches | Ranked mentor matches |
| POST | /api/rooms | Create a learning room from a request and chosen mentor |
| GET | /api/rooms/mine | List my rooms with progress summary |
| GET | /api/rooms/:id | Room details and progress |
| POST | /api/rooms/:id/plan | Add a plan item |
| PATCH | /api/rooms/:id/plan/:itemId | Mark a plan item done or not done |
| POST | /api/rooms/:id/sessions | Schedule a session |
| PATCH | /api/rooms/:id/sessions/:sessionId | Update session status or notes |
| GET | /api/rooms/:id/doubts | List doubts in a room |
| POST | /api/rooms/:id/doubts | Post a doubt |
| POST | /api/rooms/:id/doubts/:doubtId/replies | Reply to a doubt |
| PATCH | /api/rooms/:id/doubts/:doubtId/resolve | Resolve a doubt (asker only) |

All room routes require a JWT and are limited to the room's learner and mentor.

## Reverse Matching score

Score = 0.30 proficiency + 0.30 availability + 0.20 reputation + 0.20 goal fit

- **Proficiency**: mentor must be above the learner; a gap of 1-2 levels is ideal.
- **Availability**: overlap of preferred slots with the mentor's slots.
- **Reputation**: peer rating, damped for mentors with few sessions.
- **Goal fit**: keyword overlap between the learner's goal and the mentor's skill tags.

Mentors who do not teach the requested skill, or are not above the learner, are excluded.
