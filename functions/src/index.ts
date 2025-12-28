// functions/src/index.ts
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// ==================== IMAGE ANALYSIS FUNCTIONS ====================
export { analyzeImageWithAI } from './handlers/image';

// ==================== MEDICAL DATA PROCESSING FUNCTIONS ====================
export { convertToFHIR } from './handlers/convertToFHIR';
export { createBelroseFields } from './handlers/belroseFields';
export { createDetailedNarrative } from './handlers/belroseNarrative';

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

// ==================== HEALTH CHECK ====================
export { health, healthDetailed } from './handlers/healthCheck';

// ==================== MEMBER REGISTRY ====================
export {
  registerMemberOnChain,
  updateMemberStatus,
  deactivateWalletOnChain,
  reactivateWalletOnChain,
  initializeRoleOnChain,
} from './handlers/memberRegistry';

// ==================== NOTIFICATIONS ====================
export {
  onSubjectConsentRequestCreated,
  onSubjectConsentRequestUpdated,
  onRecordSubjectChange,
} from './notifications/triggers/subjectNotificationTrigger';

// ==================== PAYMASTER ====================
export { signSponsorship, getSponsorshipStatus } from './handlers/paymaster';
