/**
 * Institutional email check for the login form. The database enforces the same
 * rule on sign-up (public.is_college_email), so this only gives a quick, clear
 * message before any code is sent.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailCheck = { valid: true; email: string } | { valid: false; reason: string };

export function parseAllowedDomains(raw: string | string[] | undefined | null): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
  return list.map((d) => d.trim().toLowerCase()).filter(Boolean);
}

export function validateInstitutionalEmail(email: unknown, allowedDomains: string[]): EmailCheck {
  if (typeof email !== 'string') return { valid: false, reason: 'Email is required' };

  const normalized = email.trim().toLowerCase();
  if (!EMAIL_SHAPE.test(normalized)) return { valid: false, reason: 'Invalid email format' };

  if (!allowedDomains || allowedDomains.length === 0) {
    return { valid: false, reason: 'No institutional domains configured' };
  }

  const domain = normalized.split('@')[1];
  // Accept the exact domain or a subdomain of it (e.g. student.loyolacollege.edu).
  const ok = allowedDomains.some((d) => domain === d || domain.endsWith('.' + d));
  if (!ok) return { valid: false, reason: 'Please use your official institutional email ID' };

  return { valid: true, email: normalized };
}
