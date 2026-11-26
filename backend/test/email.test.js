const test = require('node:test');
const assert = require('node:assert');
const { validateInstitutionalEmail, parseAllowedDomains } = require('../src/utils/institutionalEmail');

const domains = parseAllowedDomains('loyolacollege.edu, Example.ac.in');

test('accepts an email on an allowed domain and normalises it', () => {
  const r = validateInstitutionalEmail('  Student@LoyolaCollege.edu ', domains);
  assert.deepStrictEqual(r, { valid: true, email: 'student@loyolacollege.edu' });
});

test('accepts subdomains of an allowed domain', () => {
  assert.ok(validateInstitutionalEmail('a@cs.loyolacollege.edu', domains).valid);
});

test('rejects personal email providers', () => {
  const r = validateInstitutionalEmail('a@gmail.com', domains);
  assert.strictEqual(r.valid, false);
});

test('rejects look-alike domains', () => {
  assert.strictEqual(validateInstitutionalEmail('a@evilloyolacollege.edu', domains).valid, false);
  assert.strictEqual(validateInstitutionalEmail('a@loyolacollege.edu.evil.com', domains).valid, false);
});

test('rejects malformed input and missing config', () => {
  assert.strictEqual(validateInstitutionalEmail('not-an-email', domains).valid, false);
  assert.strictEqual(validateInstitutionalEmail(undefined, domains).valid, false);
  assert.strictEqual(validateInstitutionalEmail('a@loyolacollege.edu', []).valid, false);
});
