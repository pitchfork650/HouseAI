/**
 * Mail adapter. Dev: logs to the console. A real provider plugs in here
 * (ask before adding a paid email service).
 */
export type Mail = { to: string; subject: string; html: string; tag: string };

export interface Mailer {
  send(m: Mail): Promise<{ id: string }>;
}

export class ConsoleMailer implements Mailer {
  async send(m: Mail) {
    const id = `dev-${Date.now().toString(36)}`;
    console.log(`[mail] ${id} → ${m.to} · ${m.subject} · ${m.tag} · ${m.html.length} bytes`);
    return { id };
  }
}

export const mailer: Mailer = new ConsoleMailer();
