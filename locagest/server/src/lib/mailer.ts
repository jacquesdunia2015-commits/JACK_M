import nodemailer from 'nodemailer';
import { config } from './config.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}
export type MailResult = { status: 'envoye' | 'simule' | 'echec'; error?: string };

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
/** Emails simulés (tests, ou SMTP non configuré) : consultables ici. */
export const outbox: Mail[] = [];

export async function sendMail(mail: Mail): Promise<MailResult> {
  if (!config.smtp.host || config.isTest) {
    outbox.push(mail);
    if (!config.isTest) console.log(`[email simulé] à ${mail.to} — ${mail.subject}`);
    return { status: 'simule' };
  }
  transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  try {
    await transport.sendMail({ from: config.smtp.from, ...mail });
    return { status: 'envoye' };
  } catch (e) {
    return { status: 'echec', error: e instanceof Error ? e.message : String(e) };
  }
}
