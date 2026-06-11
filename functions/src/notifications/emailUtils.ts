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

/**
 * Fetch a user's email address and their notification preferences.
 */
async function getUserEmailAndPrefs(userId: string) {
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  if (!userDoc.exists) return null;

  const data = userDoc.data()!;

  // Dependent accounts: route emails to the guardian instead
  if (data.isDependent && data.dependentCreatedBy) {
    const guardianDoc = await admin.firestore().collection('users').doc(data.dependentCreatedBy).get();
    if (!guardianDoc.exists) return null;
    const guardianData = guardianDoc.data()!;
    return {
      email: guardianData.email as string | undefined,
      prefs: (guardianData.notificationPrefs ?? {}) as NotificationPrefs,
    };
  }

  return {
    email: data.email as string | undefined,
    prefs: (data.notificationPrefs ?? {}) as NotificationPrefs,
  };
}

/**
 * Send an email only if the user has that category enabled.
 * Pass category = null for transactional emails that always send.
 */
export async function sendEmailIfEnabled(
  userId: string,
  type: NotificationType | null,
  payload: EmailPayload,
  resend: Resend
): Promise<void> {
  const result = await getUserEmailAndPrefs(userId);

  if (!result?.email) {
    console.warn(`⚠️ No email found for user ${userId}, skipping email`);
    return;
  }

  if (type !== null) {
    const prefs = result.prefs as NotificationPrefs;

    // Notification look up by Type - falls back to default (true) if not set
    const effective = prefs[type] ??
      DEFAULT_NOTIFICATION_PREFS[type] ?? { inApp: true, email: true };

    if (!effective.email) {
      console.log(`📭 User ${userId} has disabled email for '${type}', skipping`);
      return;
    }
  }

  await resend.emails.send({
    to: result.email,
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  console.log(`✅ Email sent to ${result.email} [type: ${type ?? 'transactional'}]`);
}
