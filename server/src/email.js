// Account emails (verification, password reset, account deletion) sent through Resend.
// Without RESEND_API_KEY (local dev) the message is logged instead of sent.

export async function sendEmail(env, { to, subject, text, html }) {
  if (!env.RESEND_API_KEY) {
    console.log(`[email] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text, html }),
  });
  if (!res.ok) console.error(`[email] Resend ${res.status}: ${await res.text()}`);
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// One plain layout for every account email: a line of copy, a button, and the raw link.
function layout(lead, action, url, footnote) {
  const text = `${lead}\n\n${action}: ${url}\n\n${footnote}\n\nFreeCell Worlds · freecellworlds.com`;
  const html = `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;color:#2a1d14">
  <h1 style="font-size:20px;margin:0 0 16px">FreeCell Worlds</h1>
  <p style="font-size:16px;line-height:1.5">${escape(lead)}</p>
  <p style="margin:24px 0"><a href="${escape(url)}" style="background:#8a5a1f;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-family:sans-serif">${escape(action)}</a></p>
  <p style="font-size:13px;color:#6b5a4c;line-height:1.5">${escape(footnote)}</p>
  <p style="font-size:12px;color:#8b7b6d;word-break:break-all">${escape(url)}</p>
</div>`;
  return { text, html };
}

export const emails = {
  verify: (url) => ({
    subject: 'Confirm your FreeCell Worlds email',
    ...layout('Confirm this address to finish creating your account and start saving your progress.', 'Confirm email', url, "If you didn't create an account, you can ignore this email."),
  }),
  reset: (url) => ({
    subject: 'Reset your FreeCell Worlds password',
    ...layout('Someone asked to reset the password for this account.', 'Choose a new password', url, "This link expires in one hour. If it wasn't you, ignore this email and your password stays the same."),
  }),
  deleteAccount: (url) => ({
    subject: 'Confirm deleting your FreeCell Worlds account',
    ...layout('Open this link to permanently delete your account, progress and custom themes.', 'Delete my account', url, "If you didn't ask for this, ignore this email and nothing will change."),
  }),
};
