import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "dummy",
  projectId: "soltheory-9b1e9", // This is the project ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function purge() {
  console.log("Fetching all grant suggestions...");
  const snapshot = await getDocs(collection(db, "grant_suggestions"));
  console.log(`Found ${snapshot.size} grants to delete.`);
  
  let count = 0;
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, "grant_suggestions", document.id));
    count++;
  }
  console.log(`Deleted ${count} grants.`);
}

purge().catch(console.error);
