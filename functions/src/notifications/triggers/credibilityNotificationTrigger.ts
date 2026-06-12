/**
 * Credibility Notification Triggers
 *
 * Three triggers:
 * 1. onVerificationWritten   — verifications created/updated
 * 2. onDisputeWritten        — disputes created/updated
 *
 * Who gets notified:
 * - Verifications/Disputes: record owners + subjects (not the actor themselves)
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';
import { createNotificationForMultiple, getUserDisplayName } from '../notificationUtils';
import { sendEmailIfEnabled } from '../emailUtils';
import {
  buildVerificationAddedHtml,
  buildVerificationAddedText,
  buildVerificationModifiedHtml,
  buildVerificationModifiedText,
  buildVerificationRetractedHtml,
  buildVerificationRetractedText,
  buildDisputeAddedHtml,
  buildDisputeAddedText,
  buildDisputeModifiedHtml,
  buildDisputeModifiedText,
  buildDisputeRetractedHtml,
  buildDisputeRetractedText,
} from '../emails/credibilityEmailTemplates';
import {
  DisputeDoc,
  DisputeSeverityOptions,
  VerificationDoc,
  VerificationLevelOptions,
} from '../../_shared';

// ============================================================================
// TYPES
// ============================================================================

interface RecordDocument {
  owners?: string[];
  subjects?: string[];
  uploadedBy?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const resendKey = defineSecret('RESEND_API_KEY');

const VERIFICATION_LEVEL_NAMES: Record<VerificationLevelOptions, string> = {
  1: 'Provenance',
  2: 'Content',
  3: 'Full',
};

const DISPUTE_SEVERITY_NAMES: Record<DisputeSeverityOptions, string> = {
  1: 'Negligible',
  2: 'Moderate',
  3: 'Major',
};

// ============================================================================
// HELPERS
// ============================================================================

async function getRecordStakeholders(recordId: string, excludeUserId?: string): Promise<string[]> {
  const recordSnap = await getFirestore().collection('records').doc(recordId).get();

  if (!recordSnap.exists) return [];

  const record = recordSnap.data() as RecordDocument;
  const targets = [...(record.owners ?? []), ...(record.subjects ?? [])];

  return [...new Set(targets)].filter(uid => uid !== excludeUserId);
}

function stripUndefined<T extends object>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

// ============================================================================
// TRIGGER 1: VERIFICATION WRITTEN
// ============================================================================

export const onVerificationWritten = onDocumentCreated(
  { document: 'verifications/{verificationId}', secrets: [resendKey] },
  async event => {
    const data = event.data?.data() as VerificationDoc | undefined;
    if (!data) return;

    // Only notify for confirmed on-chain verifications
    if (data.chainStatus !== 'confirmed' || !data.isActive) return;

    const targets = await getRecordStakeholders(data.recordId, data.verifierId);
    if (targets.length === 0) return;

    const verifierName = await getUserDisplayName(data.verifierId);
    const levelName = VERIFICATION_LEVEL_NAMES[data.level];
    const recordFallback = `Record ${data.recordId.slice(0, 8)}...`;

    await createNotificationForMultiple(targets, {
      type: 'VERIFICATION_ADDED',
      message: `${verifierName} added a ${levelName} verification to ${recordFallback}.`,
      link: `/app/records/${data.recordId}?view=credibility`,
      payload: stripUndefined({
        recordId: data.recordId,
        recordHash: data.recordHash,
        verifierId: data.verifierId,
        level: data.level,
        encryptedRecordTitle: data.encryptedRecordTitle,
        encryptedRecordTitleIv: data.encryptedRecordTitleIv,
      }),
    });

    const resend = new Resend(resendKey.value());
    await Promise.all(
      targets.map(uid =>
        sendEmailIfEnabled(
          uid,
          'VERIFICATION_ADDED',
          {
            subject: `${verifierName} verified a record you're connected to`,
            html: buildVerificationAddedHtml(
              verifierName,
              recordFallback,
              data.recordId,
              levelName
            ),
            text: buildVerificationAddedText(
              verifierName,
              recordFallback,
              data.recordId,
              levelName
            ),
          },
          resend
        )
      )
    );

    console.log(`✅ Verification notifications sent to ${targets.length} stakeholder(s)`);
  }
);

// ============================================================================
// TRIGGER 2: VERIFICATION UPDATED - MODIFY OR RETRACT
// ============================================================================

export const onVerificationUpdated = onDocumentUpdated(
  { document: 'verifications/{verificationId}', secrets: [resendKey] },
  async event => {
    const before = event.data?.before.data() as VerificationDoc | undefined;
    const after = event.data?.after.data() as VerificationDoc | undefined;
    if (!before || !after) return;

    const targets = await getRecordStakeholders(after.recordId, after.verifierId);
    if (targets.length === 0) return;

    const verifierName = await getUserDisplayName(after.verifierId);
    const recordFallback = `Record ${after.recordId.slice(0, 8)}...`;
    const resend = new Resend(resendKey.value());

    // CASE 1: Retracted (isActive flipped to false)
    if (before.isActive && !after.isActive) {
      await createNotificationForMultiple(targets, {
        type: 'VERIFICATION_RETRACTED',
        message: `${verifierName} retracted their verification on ${recordFallback}.`,
        link: `/app/records/${after.recordId}?view=credibility`,
        payload: stripUndefined({
          recordId: after.recordId,
          recordHash: after.recordHash,
          verifierId: after.verifierId,
          encryptedRecordTitle: after.encryptedRecordTitle,
          encryptedRecordTitleIv: after.encryptedRecordTitleIv,
        }),
      });

      await Promise.all(
        targets.map(uid =>
          sendEmailIfEnabled(
            uid,
            'VERIFICATION_RETRACTED',
            {
              subject: `${verifierName} retracted their verification`,
              html: buildVerificationRetractedHtml(verifierName, recordFallback, after.recordId),
              text: buildVerificationRetractedText(verifierName, recordFallback, after.recordId),
            },
            resend
          )
        )
      );
      return;
    }

    // CASE 2: Level changed
    if (before.isActive && after.isActive && before.level !== after.level) {
      const prevLevelName = VERIFICATION_LEVEL_NAMES[before.level];
      const newLevelName = VERIFICATION_LEVEL_NAMES[after.level];

      await createNotificationForMultiple(targets, {
        type: 'VERIFICATION_MODIFIED',
        message: `${verifierName} updated their verification on ${recordFallback} from ${prevLevelName} to ${newLevelName}.`,
        link: `/app/records/${after.recordId}`,
        payload: stripUndefined({
          recordId: after.recordId,
          recordHash: after.recordHash,
          verifierId: after.verifierId,
          newLevel: after.level,
          oldLevel: before.level,
          encryptedRecordTitle: after.encryptedRecordTitle,
          encryptedRecordTitleIv: after.encryptedRecordTitleIv,
        }),
      });

      await Promise.all(
        targets.map(uid =>
          sendEmailIfEnabled(
            uid,
            'VERIFICATION_MODIFIED',
            {
              subject: `${verifierName} updated their verification`,
              html: buildVerificationModifiedHtml(
                verifierName,
                recordFallback,
                after.recordId,
                prevLevelName,
                newLevelName
              ),
              text: buildVerificationModifiedText(
                verifierName,
                recordFallback,
                after.recordId,
                prevLevelName,
                newLevelName
              ),
            },
            resend
          )
        )
      );
    }
  }
);

// ============================================================================
// TRIGGER 3: DISPUTES CREATED
// ============================================================================

export const onDisputeWritten = onDocumentCreated(
  { document: 'disputes/{disputeId}', secrets: [resendKey] },
  async event => {
    const data = event.data?.data() as DisputeDoc | undefined;
    if (!data) return;

    if (data.chainStatus !== 'confirmed' || !data.isActive) return;

    const targets = await getRecordStakeholders(data.recordId, data.disputerId);
    if (targets.length === 0) return;

    const disputerName = await getUserDisplayName(data.disputerId);
    const severityName = DISPUTE_SEVERITY_NAMES[data.severity];
    const recordFallback = `Record ${data.recordId.slice(0, 8)}...`;

    await createNotificationForMultiple(targets, {
      type: 'DISPUTE_ADDED',
      message: `${disputerName} raised a ${severityName} dispute on ${recordFallback}.`,
      link: `/app/records/${data.recordId}?view=credibility`,
      payload: stripUndefined({
        recordId: data.recordId,
        recordHash: data.recordHash,
        disputerId: data.disputerId,
        severity: data.severity,
        culpability: data.culpability,
        encryptedRecordTitle: data.encryptedRecordTitle,
        encryptedRecordTitleIv: data.encryptedRecordTitleIv,
      }),
    });

    const resend = new Resend(resendKey.value());
    await Promise.all(
      targets.map(uid =>
        sendEmailIfEnabled(
          uid,
          'DISPUTE_ADDED',
          {
            subject: `${disputerName} raised a dispute on a record you're connected to`,
            html: buildDisputeAddedHtml(disputerName, recordFallback, data.recordId, severityName),
            text: buildDisputeAddedText(disputerName, recordFallback, data.recordId, severityName),
          },
          resend
        )
      )
    );

    console.log(`✅ Dispute notifications sent to ${targets.length} stakeholder(s)`);
  }
);

// ============================================================================
// TRIGGER 4: DISPUTES UPDATED
// ============================================================================

export const onDisputeUpdated = onDocumentUpdated(
  { document: 'disputes/{disputeId}', secrets: [resendKey] },
  async event => {
    const before = event.data?.before.data() as DisputeDoc | undefined;
    const after = event.data?.after.data() as DisputeDoc | undefined;
    if (!before || !after) return;

    const targets = await getRecordStakeholders(after.recordId, after.disputerId);
    if (targets.length === 0) return;

    const disputerName = await getUserDisplayName(after.disputerId);
    const recordFallback = `Record ${after.recordId.slice(0, 8)}...`;
    const resend = new Resend(resendKey.value());

    // CASE 1: Retracted
    if (before.isActive && !after.isActive) {
      await createNotificationForMultiple(targets, {
        type: 'DISPUTE_RETRACTED',
        message: `${disputerName} retracted their dispute on ${recordFallback}.`,
        link: `/app/records/${after.recordId}?view=credibility`,
        payload: stripUndefined({
          recordId: after.recordId,
          recordHash: after.recordHash,
          disputerId: after.disputerId,
          encryptedRecordTitle: after.encryptedRecordTitle,
          encryptedRecordTitleIv: after.encryptedRecordTitleIv,
        }),
      });

      await Promise.all(
        targets.map(uid =>
          sendEmailIfEnabled(
            uid,
            'DISPUTE_RETRACTED',
            {
              subject: `${disputerName} retracted their dispute`,
              html: buildDisputeRetractedHtml(disputerName, recordFallback, after.recordId),
              text: buildDisputeRetractedText(disputerName, recordFallback, after.recordId),
            },
            resend
          )
        )
      );
      return;
    }

    // CASE 2: Severity or culpability changed
    if (
      before.isActive &&
      after.isActive &&
      (before.severity !== after.severity || before.culpability !== after.culpability)
    ) {
      const newSeverityName = DISPUTE_SEVERITY_NAMES[after.severity];

      await createNotificationForMultiple(targets, {
        type: 'DISPUTE_MODIFIED',
        message: `${disputerName} updated their dispute on ${recordFallback}.`,
        link: `/app/records/${after.recordId}?view=credibility`,
        payload: stripUndefined({
          recordId: after.recordId,
          recordHash: after.recordHash,
          disputerId: after.disputerId,
          newSeverity: after.severity,
          newCulpability: after.culpability,
          oldSeverity: before.severity,
          oldCulpability: before.culpability,
          encryptedRecordTitle: after.encryptedRecordTitle,
          encryptedRecordTitleIv: after.encryptedRecordTitleIv,
        }),
      });

      await Promise.all(
        targets.map(uid =>
          sendEmailIfEnabled(
            uid,
            'DISPUTE_MODIFIED',
            {
              subject: `${disputerName} updated their dispute`,
              html: buildDisputeModifiedHtml(
                disputerName,
                recordFallback,
                after.recordId,
                newSeverityName
              ),
              text: buildDisputeModifiedText(
                disputerName,
                recordFallback,
                after.recordId,
                newSeverityName
              ),
            },
            resend
          )
        )
      );
    }
  }
);
