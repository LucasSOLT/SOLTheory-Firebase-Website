import { NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  projectId: "studio-5711990008-7ac2c",
  appId: "1:873103118314:web:a3329a68328d07aee56c93",
  apiKey: "AIzaSyCAJWBLJ1GTXtELpKFubBlENBq0eroUyCM",
  authDomain: "studio-5711990008-7ac2c.firebaseapp.com",
  storageBucket: "studio-5711990008-7ac2c.firebasestorage.app",
};

function getDb() {
  const app = getApps().length > 0 
    ? getApps()[0] 
    : initializeApp(firebaseConfig, "purge-app");
  return getFirestore(app);
}

/**
 * DELETE /api/grants/purge-all
 * 
 * Deletes EVERY document in the grant_suggestions collection.
 * No auth required — this is an emergency cleanup endpoint.
 */
export async function DELETE() {
  try {
    const db = getDb();
    const grantsRef = collection(db, "grant_suggestions");
    const snapshot = await getDocs(grantsRef);

    if (snapshot.empty) {
      return NextResponse.json({ deleted: 0, message: "No grants to delete" });
    }

    let deleted = 0;
    const deletePromises: Promise<void>[] = [];

    snapshot.docs.forEach((document) => {
      deletePromises.push(
        deleteDoc(doc(db, "grant_suggestions", document.id))
          .then(() => { deleted++; })
      );
    });

    await Promise.all(deletePromises);

    return NextResponse.json({ 
      deleted, 
      message: `Successfully deleted ${deleted} grants` 
    });
  } catch (err: any) {
    console.error("Purge all grants error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
