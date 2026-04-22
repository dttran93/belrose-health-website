// functions/src/index.ts
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// ==================== ADMIN FUNCTIONS ====================
export { setPlatformAdmin } from './handlers/setAdminClaim';

// ==================== IMAGE ANALYSIS FUNCTIONS ====================
export { analyzeImageWithAI } from './handlers/image';

// ==================== MEDICAL DATA PROCESSING FUNCTIONS ====================
export { convertToFHIR } from './handlers/convertToFHIR';
export { createBelroseFields } from './handlers/belroseFields';

// ==================== WALLET FUNCTIONS ====================
export { createWallet, getEncryptedWallet } from './handlers/wallet';

// ==================== IDENTITY VERIFICATION FUNCTIONS ====================
export {
  createVerificationSession,
  checkVerificationStatus,
  personaWebhook,
} from './handlers/verification';

// ==================== EMAIL FUNCTIONS ====================
export { sendShareInvitationEmail } from './handlers/sendShareInvitationEmail';
export { sendAlphaApprovalEmail } from './handlers/sendAlphaApprovalEmail';
export { sendWaitlistConfirmationEmail } from './handlers/sendWaitlistConfirmationEmail';
export { sendPasswordChangeEmail } from './handlers/sendPasswordChangeEmail';

// ==================== GUEST INVITE ====================
export { createGuestInvite } from './handlers/createGuestInvite';
export { redeemGuestInvite } from './handlers/redeemGuestInvite';
export { createRecordRequest } from './handlers/createRecordRequest';

// ==================== HEALTH CHECK ====================
export { health, healthDetailed } from './handlers/healthCheck';

// ==================== MEMBER REGISTRY ====================
export {
  registerMemberOnChain,
  updateMemberStatus,
  deactivateWalletOnChain,
  reactivateWalletOnChain,
  initializeRoleOnChain,
  initializeRoleOnChainForRequester,
} from './handlers/memberRegistry';

// ==================== NOTIFICATIONS ====================
export {
  onSubjectConsentRequestCreated,
  onSubjectConsentRequestUpdated,
} from './notifications/triggers/subjectNotificationTrigger';

export {
  onRecordDeletionEventCreated,
  onRecordDeletionEventUpdated,
} from './notifications/triggers/deleteRecordNotificationTrigger';

export {
  onRecordRequestCreated,
  onRecordRequestUpdated,
} from './notifications/triggers/requestRecordNotificationTrigger';

// ==================== PAYMASTER ====================
export { signSponsorship, getSponsorshipStatus } from './handlers/paymaster';

// ==================== AI CHAT FUNCTIONS ====================
export { aiChat } from './handlers/aiChat';

// ==================== MESSAGING FUNCTIONS ====================
export { getKeyBundle } from './handlers/getKeyBundle';

// ==================== COLLECTION QUERY FUNCTIONS =====================
export { checkEmailRegistrationStatus } from './handlers/checkEmailRegistrationStatus';

// ==================== RECORD REFINEMENT FUNCTIONS ====================
export { refineRecord } from './handlers/refineRecord';
