// src/features/Sharing/services/emailInvitationService.ts

import { getFunctions, httpsCallable } from 'firebase/functions';

interface ShareInvitationData {
  senderName: string;
  senderEmail: string;
  receiverEmail: string;
  recordName: string;
}

interface ShareInvitationResult {
  success: boolean;
  message: string;
  action: 'signup_required' | 'verification_required' | 'already_verified';
}

export class EmailInvitationService {
  /**
   * Send an invitation email to an unverified or non-existent user
   */
  static async sendShareInvitation(data: ShareInvitationData): Promise<ShareInvitationResult> {
    try {
      const functions = getFunctions();
      const sendInvitation = httpsCallable<ShareInvitationData, ShareInvitationResult>(
        functions,
        'sendShareInvitationEmail'
      );

      const result = await sendInvitation(data);
      return result.data;
    } catch (error) {
      console.error('Error calling invitation function:', error);
      throw new Error('Failed to send invitation email');
    }
  }
}
