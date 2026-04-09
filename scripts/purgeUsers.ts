import * as admin from 'firebase-admin';

// Attempt initialization. We rely on the local gcloud/firebase environment having ADC.
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "studio-5711990008-7ac2c"
  });
} catch (e) {
  console.log("Initialization info:", e);
}

async function run() {
  const auth = admin.auth();
  
  // 1. Fetch all users
  let allUsers: admin.auth.UserRecord[] = [];
  let pageToken: string | undefined;

  do {
    const result = await auth.listUsers(1000, pageToken);
    allUsers = allUsers.concat(result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`Found ${allUsers.length} total users in Firebase Auth.`);

  const retainEmails = ['team@soltheory.com', 'lucas@soltheory.com'];
  const usersToDelete = allUsers.filter(u => !u.email || !retainEmails.includes(u.email));

  // 2. Delete unwanted users
  if (usersToDelete.length > 0) {
    const uidsToDelete = usersToDelete.map(u => u.uid);
    console.log(`Purging ${uidsToDelete.length} unauthorized accounts...`);
    const deleteResult = await auth.deleteUsers(uidsToDelete);
    console.log(`Successfully deleted ${deleteResult.successCount} users. Failed: ${deleteResult.failureCount}`);
  } else {
    console.log("No unauthorized users found to delete.");
  }

  // 3. Upsert team@soltheory.com
  const teamEmail = 'team@soltheory.com';
  const teamPass = 'Team%42Jovial8998!';
  try {
    const teamUser = await auth.getUserByEmail(teamEmail);
    await auth.updateUser(teamUser.uid, { password: teamPass });
    console.log(`[SUCCESS] Updated password and secured: ${teamEmail}`);
  } catch (e: any) {
    if (e.code === 'auth/user-not-found') {
      await auth.createUser({ email: teamEmail, password: teamPass, displayName: "SOL Theory Administrator" });
      console.log(`[SUCCESS] Created new secure account: ${teamEmail}`);
    } else {
      console.error(`Error with ${teamEmail}:`, e);
    }
  }

  // 4. Upsert lucas@soltheory.com
  const lucasEmail = 'lucas@soltheory.com';
  const lucasPass = 'Jovial%42Croc!?8';
  try {
    const lucasUser = await auth.getUserByEmail(lucasEmail);
    await auth.updateUser(lucasUser.uid, { password: lucasPass });
    console.log(`[SUCCESS] Updated password and secured: ${lucasEmail}`);
  } catch (e: any) {
    if (e.code === 'auth/user-not-found') {
      await auth.createUser({ email: lucasEmail, password: lucasPass, displayName: "Lucas" });
      console.log(`[SUCCESS] Created new secure account: ${lucasEmail}`);
    } else {
      console.error(`Error with ${lucasEmail}:`, e);
    }
  }
}

run().then(() => {
  console.log("Account management completed safely.");
  process.exit(0);
}).catch(e => {
  console.error("Critical failure during account management:", e);
  process.exit(1);
});
