import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCnAr2-k5n9oC3f0tjnkru_coYA5UeeWh0",
  authDomain: "knight-f47a3.firebaseapp.com",
  projectId: "knight-f47a3",
  storageBucket: "knight-f47a3.firebasestorage.app",
  messagingSenderId: "778089053668",
  appId: "1:778089053668:web:baadc9d80ee476b66f1bf1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateUserGold(targetUsername, newGold) {
  console.log(`Finding user: ${targetUsername}...`);

  // Find user by username
  const usersSnapshot = await getDocs(collection(db, 'users'));
  let targetUid = null;

  usersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.username === targetUsername) {
      targetUid = data.uid;
      console.log(`Found user: ${data.username} (UID: ${targetUid})`);
    }
  });

  if (!targetUid) {
    console.log(`User "${targetUsername}" not found!`);
    process.exit(1);
  }

  // Update gameData
  const gameDataRef = doc(db, 'gameData', targetUid);
  await updateDoc(gameDataRef, {
    'stats.gold': newGold
  });

  console.log(`Updated ${targetUsername}'s gold to ${newGold.toLocaleString()}G`);
  process.exit(0);
}

updateUserGold('나이트', 100000000);
