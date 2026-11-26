/**
 * Institutional email verification.
 * Only addresses on an allowed college domain may register, so the
 * community stays limited to verified students.
 */

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseAllowedDomains(raw) {
  return String(raw || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {string} email
 * @param {string[]} allowedDomains e.g. ['loyolacollege.edu']
 * @returns {{ valid: boolean, reason?: string, email?: string }}
 */
function validateInstitutionalEmail(email, allowedDomains) {
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

module.exports = { validateInstitutionalEmail, parseAllowedDomains };
