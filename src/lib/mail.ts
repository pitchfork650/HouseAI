import nodemailer from "nodemailer";

/**
 * Mail adapter. With SMTP_URL set, mail goes out over SMTP (e.g. a Gmail app
 * password: smtps://user%40gmail.com:app-password@smtp.gmail.com:465).
 * Without it, dev mail is only logged to the console.
 */
export type Mail = { to: string; subject: string; html: string; tag: string };

export interface Mailer {
  send(m: Mail): Promise<{ id: string; to: string; delivered: boolean }>;
}

export class ConsoleMailer implements Mailer {
  async send(m: Mail) {
    const id = `dev-${Date.now().toString(36)}`;
    console.log(`[mail] ${id} → ${m.to} · ${m.subject} · ${m.tag} · ${m.html.length} bytes (console only, SMTP_URL not set)`);
    return { id, to: m.to, delivered: false };
  }
}

export class SmtpMailer implements Mailer {
  private transport;
  constructor(url: string, private from: string) {
    this.transport = nodemailer.createTransport(url);
  }
  async send(m: Mail) {
    const info = await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, html: m.html, headers: { "X-HouseAI-Tag": m.tag } });
    console.log(`[mail] ${info.messageId} → ${m.to} · ${m.subject} · ${m.tag}`);
    return { id: info.messageId, to: m.to, delivered: true };
  }
}

function fromAddress(url: string) {
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
  const user = decodeURIComponent(new URL(url).username);
  return user.includes("@") ? user : "no-reply@localhost";
}

export const mailer: Mailer = process.env.SMTP_URL ? new SmtpMailer(process.env.SMTP_URL, fromAddress(process.env.SMTP_URL)) : new ConsoleMailer();
