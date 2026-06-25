// functions/src/scripts/bootstrapAdmin.ts
import * as admin from 'firebase-admin';
import * as serviceAccount from '../../.firebaseServiceAccountKey.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const UID_TO_MAKE_ADMIN = 'GslflWMb4xUnlQC1qjyGSWlltBH2';

async function bootstrap() {
  await Promise.all([
    admin.auth().setCustomUserClaims(UID_TO_MAKE_ADMIN, { platformAdmin: true }),
    admin.firestore().collection('users').doc(UID_TO_MAKE_ADMIN).update({ isPlatformAdmin: true }),
  ]);
  console.log(`✅ platformAdmin claim + Firestore field set for ${UID_TO_MAKE_ADMIN}`);
  process.exit(0);
}

bootstrap().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
