// functions/src/notifications/emailUtils.ts

/**
 * Email notification utility. Basically, emails are just a parallel call along
 * side notifications. Can be enabled/disabled in settings.
 */

import * as admin from 'firebase-admin';
import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NotificationPrefs,
  NotificationType,
} from '../_shared/notifications';

export const resendKey = defineSecret('RESEND_API_KEY');

export const FROM_EMAIL = 'noreply@belrosehealth.com';
export const FROM_NAME = 'Belrose Health';
export const APP_URL = 'https://belrosehealth.com/app';
export const SUPPORT_EMAIL = 'support@belrosehealth.com';
export const MARKETING_URL = 'https://www.belrosehealth.com';

export interface EmailPayload {
  subject: string;
  html: string;
  text: string;
}

interface EmailRecipient {
  email: string;
  prefs: NotificationPrefs;
  isDependent: boolean;
  dependentDisplayName?: string; // present when routing to a guardian, used to label the email
}

const PLACEHOLDER_EMAIL_DOMAIN = '@placeholder.belrose.health';

/**
 * Resolve the set of email recipients for a given user.
 *
 * - Regular user          → [user]
 * - Dependent, placeholder email → [guardian]          (no real inbox for dependent)
 * - Dependent, real email        → [guardian, dependent] (both get a copy)
 *
 * Guardian-bound emails are tagged with isDependent + dependentDisplayName so
 * sendEmailIfEnabled can prepend a "re: [Name]'s account" context note.
 */
async function resolveEmailRecipients(userId: string): Promise<EmailRecipient[]> {
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  if (!userDoc.exists) return [];
  const data = userDoc.data()!;

  // Regular account — straightforward
  if (!data.isDependent || !data.dependentCreatedBy) {
    if (!data.email) return [];
    return [{
      email: data.email as string,
      prefs: (data.notificationPrefs ?? {}) as NotificationPrefs,
      isDependent: false,
    }];
  }

  // Dependent account
  const guardianDoc = await admin.firestore().collection('users').doc(data.dependentCreatedBy).get();
  if (!guardianDoc.exists) return [];
  const guardianData = guardianDoc.data()!;

  const dependentDisplayName = (data.displayName || data.firstName || 'your dependent') as string;
  const dependentEmail = data.email as string | undefined;
  const isPlaceholder = dependentEmail?.endsWith(PLACEHOLDER_EMAIL_DOMAIN) ?? true;

  const recipients: EmailRecipient[] = [];

  // Guardian always receives a copy
  if (guardianData.email) {
    recipients.push({
      email: guardianData.email as string,
      prefs: (guardianData.notificationPrefs ?? {}) as NotificationPrefs,
      isDependent: true,
      dependentDisplayName,
    });
  }

  // Real-email dependent also gets their own copy
  if (!isPlaceholder && dependentEmail) {
    recipients.push({
      email: dependentEmail,
      prefs: (data.notificationPrefs ?? {}) as NotificationPrefs,
      isDependent: true,
      dependentDisplayName,
    });
  }

  return recipients;
}

/**
 * Send an email only if the user has that category enabled.
 * Pass type = null for transactional emails that always send.
 *
 * Handles dependent account routing transparently — callers don't need to
 * know whether the target is a dependent.
 */
export async function sendEmailIfEnabled(
  userId: string,
  type: NotificationType | null,
  payload: EmailPayload,
  resend: Resend
): Promise<void> {
  const recipients = await resolveEmailRecipients(userId);

  if (recipients.length === 0) {
    console.warn(`⚠️ No email recipients resolved for user ${userId}, skipping email`);
    return;
  }

  for (const recipient of recipients) {
    if (type !== null) {
      const effective = recipient.prefs[type] ??
        DEFAULT_NOTIFICATION_PREFS[type] ?? { inApp: true, email: true };

      if (!effective.email) {
        console.log(`📭 ${recipient.email} has disabled email for '${type}', skipping`);
        continue;
      }
    }

    // Prepend a context note for guardian emails about a dependent's account
    const finalPayload = recipient.isDependent && recipient.dependentDisplayName
      ? {
          ...payload,
          html: `<p style="font-size:12px;color:#6b7280;background:#f3f4f6;padding:8px 12px;border-radius:6px;margin-bottom:16px;">This notification is about <strong>${recipient.dependentDisplayName}</strong>'s account, which you manage.</p>${payload.html}`,
          text: `[Re: ${recipient.dependentDisplayName}'s account]\n\n${payload.text}`,
        }
      : payload;

    await resend.emails.send({
      to: recipient.email,
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      subject: finalPayload.subject,
      html: finalPayload.html,
      text: finalPayload.text,
    });

    console.log(`✅ Email sent to ${recipient.email} [type: ${type ?? 'transactional'}, isDependent: ${recipient.isDependent}]`);
  }
}
