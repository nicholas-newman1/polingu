import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function getServiceAccount() {
  const possiblePaths = [
    resolve(process.cwd(), 'service-account.json'),
    resolve(process.cwd(), 'serviceAccountKey.json'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'));
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf-8'));
  }

  console.error(
    '❌ No service account found. Please either:\n' +
      '   1. Place service-account.json in the project root, or\n' +
      '   2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable'
  );
  process.exit(1);
}

if (getApps().length === 0) {
  const serviceAccount = getServiceAccount();
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const auth = getAuth();

async function setAdminClaim(uid: string) {
  try {
    await auth.setCustomUserClaims(uid, { admin: true });
    console.log(`✅ Admin claim set for user ${uid}`);

    const user = await auth.getUser(uid);
    console.log(`   Email: ${user.email}`);
    console.log(`   Claims: ${JSON.stringify(user.customClaims)}`);
  } catch (error) {
    console.error('❌ Failed to set admin claim:', error);
    process.exit(1);
  }
}

async function removeAdminClaim(uid: string) {
  try {
    await auth.setCustomUserClaims(uid, { admin: false });
    console.log(`✅ Admin claim removed for user ${uid}`);
  } catch (error) {
    console.error('❌ Failed to remove admin claim:', error);
    process.exit(1);
  }
}

async function listAdmins() {
  console.log('🔍 Listing users with admin claims...\n');

  const listUsersResult = await auth.listUsers(1000);
  const admins = listUsersResult.users.filter((user) => user.customClaims?.admin === true);

  if (admins.length === 0) {
    console.log('No admin users found.');
  } else {
    admins.forEach((user) => {
      console.log(`  UID: ${user.uid}`);
      console.log(`  Email: ${user.email}`);
      console.log('');
    });
    console.log(`Total: ${admins.length} admin(s)`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const uid = args[1];

  switch (command) {
    case 'add':
      if (!uid) {
        console.error('Usage: npx tsx scripts/set-admin.ts add <uid>');
        process.exit(1);
      }
      await setAdminClaim(uid);
      break;

    case 'remove':
      if (!uid) {
        console.error('Usage: npx tsx scripts/set-admin.ts remove <uid>');
        process.exit(1);
      }
      await removeAdminClaim(uid);
      break;

    case 'list':
      await listAdmins();
      break;

    default:
      console.log('Admin Claim Management\n');
      console.log('Usage:');
      console.log('  npx tsx scripts/set-admin.ts add <uid>     - Grant admin access');
      console.log('  npx tsx scripts/set-admin.ts remove <uid>  - Remove admin access');
      console.log('  npx tsx scripts/set-admin.ts list          - List all admins');
      process.exit(1);
  }
}

main();
