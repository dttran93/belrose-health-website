/**
 * Trustee Notification Trigger
 *
 * Watches trusteeRelationships for creates and updates.
 *
 * One trigger covers all cases — the relationship doc is the source of truth.
 *
 * Who gets notified:
 * - Invite created (pending)    → trustee
 * - Accepted (active)           → trustor
 * - Declined                    → trustor
 * - Revoked by trustor          → trustee
 * - Resigned by trustee         → trustor
 * - Trust level edited          → trustee
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';
import { createNotification, getUserDisplayName } from '../notificationUtils';
import { sendEmailIfEnabled } from '../emailUtils';
import {
  buildTrusteeInvitedHtml,
  buildTrusteeInvitedText,
  buildTrusteeAcceptedHtml,
  buildTrusteeAcceptedText,
  buildTrusteeDeclinedHtml,
  buildTrusteeDeclinedText,
  buildTrusteeRevokedHtml,
  buildTrusteeRevokedText,
  buildTrusteeResignedHtml,
  buildTrusteeResignedText,
  buildTrusteeLevelChangedHtml,
  buildTrusteeLevelChangedText,
} from '../emails/trusteeEmailTemplates';

// ============================================================================
// TYPES
// ============================================================================

type TrustLevel = 'observer' | 'custodian' | 'controller';
type TrusteeStatus = 'pending' | 'active' | 'revoked' | 'declined';

interface TrusteeRelationship {
  trustorId: string;
  trusteeId: string;
  trustLevel: TrustLevel;
  isActive: boolean;
  status: TrusteeStatus;
  createdAt: Timestamp;
  respondedAt: Timestamp | null;
  revokedAt: Timestamp | null;
  revokedBy: string | null;
  statusUpdateReason: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const resendKey = defineSecret('RESEND_API_KEY');

const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  observer: 'Observer',
  custodian: 'Custodian',
  controller: 'Controller',
};

const TRUST_LEVEL_DESCRIPTIONS: Record<TrustLevel, string> = {
  observer: "You have read-only access to the trustor's records",
  custodian: "You have management access to the trustor's records",
  controller:
    'You have full account-level permissions including accepting, deleting records on their behalf',
};

// ============================================================================
// TRIGGER 1: INVITE CREATED
// ============================================================================

export const onTrusteeRelationshipCreated = onDocumentCreated(
  { document: 'trusteeRelationships/{relationshipId}', secrets: [resendKey] },
  async event => {
    const data = event.data?.data() as TrusteeRelationship | undefined;
    if (!data) return;

    // Only fire on new pending invites
    if (data.status !== 'pending') return;

    const trustorName = await getUserDisplayName(data.trustorId);
    const levelLabel = TRUST_LEVEL_LABELS[data.trustLevel];
    const levelDescription = TRUST_LEVEL_DESCRIPTIONS[data.trustLevel];

    // Notify the trustee
    await createNotification(data.trusteeId, {
      type: 'TRUSTEE_INVITE_RECEIVED',
      message: `${trustorName} has invited you to be their ${levelLabel} trustee.`,
      link: '/app/settings/trustees?tab=my-trustors',
      payload: {
        trustorId: data.trustorId,
        trusteeId: data.trusteeId,
        trustLevel: data.trustLevel,
      },
    });

    const resend = new Resend(resendKey.value());
    await sendEmailIfEnabled(
      data.trusteeId,
      'TRUSTEE_INVITE_RECEIVED',
      {
        subject: `${trustorName} has invited you to be their trustee`,
        html: buildTrusteeInvitedHtml(trustorName, levelLabel, levelDescription),
        text: buildTrusteeInvitedText(trustorName, levelLabel, levelDescription),
      },
      resend
    );

    console.log(`✅ Trustee invite notification sent to ${data.trusteeId}`);
  }
);

// ============================================================================
// TRIGGER 2: RELATIONSHIP UPDATED
// ============================================================================

export const onTrusteeRelationshipUpdated = onDocumentUpdated(
  { document: 'trusteeRelationships/{relationshipId}', secrets: [resendKey] },
  async event => {
    const before = event.data?.before.data() as TrusteeRelationship | undefined;
    const after = event.data?.after.data() as TrusteeRelationship | undefined;
    if (!before || !after) return;

    const resend = new Resend(resendKey.value());

    // CASE 1: Accepted — pending → active
    if (before.status === 'pending' && after.status === 'active') {
      const trusteeName = await getUserDisplayName(after.trusteeId);
      const levelLabel = TRUST_LEVEL_LABELS[after.trustLevel];

      await createNotification(after.trustorId, {
        type: 'TRUSTEE_INVITE_ACCEPTED',
        message: `${trusteeName} accepted your trustee invite as ${levelLabel}.`,
        link: '/app/settings/trustees?tab=my-trustees',
        payload: {
          trustorId: after.trustorId,
          trusteeId: after.trusteeId,
          trustLevel: after.trustLevel,
        },
      });

      await sendEmailIfEnabled(
        after.trustorId,
        'TRUSTEE_INVITE_ACCEPTED',
        {
          subject: `${trusteeName} accepted your trustee invite`,
          html: buildTrusteeAcceptedHtml(trusteeName, levelLabel),
          text: buildTrusteeAcceptedText(trusteeName, levelLabel),
        },
        resend
      );

      console.log(`✅ Trustee accepted notification sent to trustor ${after.trustorId}`);
      return;
    }

    // CASE 2: Declined — pending → declined
    if (before.status === 'pending' && after.status === 'declined') {
      const trusteeName = await getUserDisplayName(after.trusteeId);
      const levelLabel = TRUST_LEVEL_LABELS[after.trustLevel];

      await createNotification(after.trustorId, {
        type: 'TRUSTEE_INVITE_DECLINED',
        message: `${trusteeName} declined your trustee invite.`,
        link: '/app/settings/trustees?tab=my-trustees',
        payload: {
          trustorId: after.trustorId,
          trusteeId: after.trusteeId,
          trustLevel: after.trustLevel,
        },
      });

      await sendEmailIfEnabled(
        after.trustorId,
        'TRUSTEE_INVITE_DECLINED',
        {
          subject: `${trusteeName} declined your trustee invite`,
          html: buildTrusteeDeclinedHtml(trusteeName, levelLabel),
          text: buildTrusteeDeclinedText(trusteeName, levelLabel),
        },
        resend
      );

      console.log(`✅ Trustee declined notification sent to trustor ${after.trustorId}`);
      return;
    }

    // CASE 3: Revoked or resigned — active/pending → revoked
    if (before.status !== 'revoked' && after.status === 'revoked') {
      const levelLabel = TRUST_LEVEL_LABELS[after.trustLevel];
      const isTrusteeResigned = after.statusUpdateReason === 'trustee_resigned';

      if (isTrusteeResigned) {
        // Notify trustor that their trustee resigned
        const trusteeName = await getUserDisplayName(after.trusteeId);

        await createNotification(after.trustorId, {
          type: 'TRUSTEE_RESIGNED',
          message: `${trusteeName} has resigned as your ${levelLabel} trustee.`,
          link: '/app/settings/trustees?tab=my-trustees',
          payload: {
            trustorId: after.trustorId,
            trusteeId: after.trusteeId,
            trustLevel: after.trustLevel,
          },
        });

        await sendEmailIfEnabled(
          after.trustorId,
          'TRUSTEE_RESIGNED',
          {
            subject: `${trusteeName} has resigned as your trustee`,
            html: buildTrusteeResignedHtml(trusteeName, levelLabel),
            text: buildTrusteeResignedText(trusteeName, levelLabel),
          },
          resend
        );

        console.log(`✅ Trustee resigned notification sent to trustor ${after.trustorId}`);
      } else {
        // Notify trustee that they were revoked
        const trustorName = await getUserDisplayName(after.trustorId);

        await createNotification(after.trusteeId, {
          type: 'TRUSTEE_REVOKED',
          message: `${trustorName} has revoked your ${levelLabel} trustee access.`,
          link: '/app/settings/trustees?tab=my-trustors',
          payload: {
            trustorId: after.trustorId,
            trusteeId: after.trusteeId,
            trustLevel: after.trustLevel,
          },
        });

        await sendEmailIfEnabled(
          after.trusteeId,
          'TRUSTEE_REVOKED',
          {
            subject: `Your trustee access has been revoked`,
            html: buildTrusteeRevokedHtml(trustorName, levelLabel),
            text: buildTrusteeRevokedText(trustorName, levelLabel),
          },
          resend
        );

        console.log(`✅ Trustee revoked notification sent to trustee ${after.trusteeId}`);
      }
      return;
    }

    // CASE 4: Trust level changed — active → active, different trustLevel
    if (
      before.status === 'active' &&
      after.status === 'active' &&
      before.trustLevel !== after.trustLevel
    ) {
      const trustorName = await getUserDisplayName(after.trustorId);
      const prevLabel = TRUST_LEVEL_LABELS[before.trustLevel];
      const newLabel = TRUST_LEVEL_LABELS[after.trustLevel];
      const newDescription = TRUST_LEVEL_DESCRIPTIONS[after.trustLevel];
      const isUpgrade = after.statusUpdateReason === 'trust_level_upgrade';

      await createNotification(after.trusteeId, {
        type: 'TRUSTEE_LEVEL_CHANGED',
        message: `${trustorName} ${isUpgrade ? 'upgraded' : 'changed'} your trustee level from ${prevLabel} to ${newLabel}.`,
        link: '/app/settings/trustees?tab=my-trustors',
        payload: {
          trustorId: after.trustorId,
          trusteeId: after.trusteeId,
          trustLevel: after.trustLevel,
          previousTrustLevel: before.trustLevel,
        },
      });

      await sendEmailIfEnabled(
        after.trusteeId,
        'TRUSTEE_LEVEL_CHANGED',
        {
          subject: `Your trustee level has been ${isUpgrade ? 'upgraded' : 'changed'}`,
          html: buildTrusteeLevelChangedHtml(
            trustorName,
            prevLabel,
            newLabel,
            newDescription,
            isUpgrade
          ),
          text: buildTrusteeLevelChangedText(trustorName, prevLabel, newLabel, isUpgrade),
        },
        resend
      );

      console.log(`✅ Trustee level change notification sent to trustee ${after.trusteeId}`);
    }
  }
);
