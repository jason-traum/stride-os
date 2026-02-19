import { NextResponse } from 'next/server';

function sanitizeSingleLine(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/[\r\n\t]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeMultiLine(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = sanitizeSingleLine(body?.username, 64);
  const email = sanitizeSingleLine(body?.email, 120);
  const details = sanitizeMultiLine(body?.details, 1200);

  if (!username && !email) {
    return NextResponse.json(
      { error: 'Please include your username or email.' },
      { status: 400 }
    );
  }

  const resetContactEmail = (
    process.env.PASSWORD_RESET_CONTACT_EMAIL
    || process.env.SUPPORT_EMAIL
    || 'jason@getdreamy.run'
  ).trim();

  const submittedAt = new Date().toISOString();
  const subject = `Dreamy password reset request${username ? ` (${username})` : ''}`;
  const emailBody = [
    'Hi Jason,',
    '',
    'I need help resetting my password.',
    '',
    `Username: ${username || '(not provided)'}`,
    `Contact email: ${email || '(not provided)'}`,
    '',
    'Details:',
    details || '(none)',
    '',
    `Submitted: ${submittedAt}`,
  ].join('\n');

  const mailto = `mailto:${resetContactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

  console.info('[gate-forgot-password]', {
    username: username || null,
    email: email || null,
    submittedAt,
  });

  return NextResponse.json({
    ok: true,
    message: `We prepared an email request to ${resetContactEmail}.`,
    mailto,
  });
}
