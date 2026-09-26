import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";

export type InvitationMailer = { send: (email: string, url: string) => Promise<void> };

const invitationText = (url: string) => `You have been invited to administer pixelpushr. Open this link to accept the invitation:\n\n${url}\n\nThis link expires in seven days.`;

/** Sends local development invitations to an SMTP sink such as Mailpit. */
export const createSmtpMailer = (smtpUrl: string, from: string): InvitationMailer => {
  const transport = nodemailer.createTransport(smtpUrl);
  return { send: async (email, url) => { await transport.sendMail({ from, to: email, subject: "You're invited to pixelpushr", text: invitationText(url) }); } };
};

/** Sends production invitations through Amazon SES. */
export const createSesMailer = (region: string, from: string): InvitationMailer => {
  const client = new SESv2Client({ region });
  return { send: async (email, url) => { await client.send(new SendEmailCommand({ FromEmailAddress: from, Destination: { ToAddresses: [email] }, Content: { Simple: { Subject: { Data: "You're invited to pixelpushr" }, Body: { Text: { Data: invitationText(url) } } } } })); } };
};
