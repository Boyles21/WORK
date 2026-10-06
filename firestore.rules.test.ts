import { describe, test, beforeEach, beforeAll, afterAll } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { setDoc, doc, serverTimestamp, getDoc, getDocs, collection, query, where, addDoc } from 'firebase/firestore';
import fs from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'test-project',
    firestore: {
      rules: fs.readFileSync('DRAFT_firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore Security Rules', () => {
  const USER_ID = 'yessica-private';

  test('should allow public read of daily messages', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(unauthedDb, 'daily_messages/2026-05-04')));
  });

  test('should deny unauthenticated write to polaroids', async () => {
    // Note: In our rules, we don't strictly check for authentication yet since the app doesn't sign in.
    // However, our rules DO check for isValidPolaroid which includes userId == 'yessica-private'.
    // If we want to simulate "Shadow Update" or "Identity Spoofing":
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(unauthedDb, 'polaroids/123'), {
      id: '123',
      url: 'base64...',
      compliment: 'sweet',
      date: '2026-05-04',
      userId: 'wrong-user', // Spoof attempt
      createdAt: serverTimestamp()
    }));
  });

  test('should deny shadow update (extra fields)', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(addDoc(collection(unauthedDb, 'thoughts'), {
      text: 'hello',
      userId: USER_ID,
      createdAt: serverTimestamp(),
      isAdmin: true // Ghost field
    }));
  });

  test('should deny ID poisoning', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const longId = 'a'.repeat(200);
    await assertFails(setDoc(doc(unauthedDb, `daily_messages/${longId}`), {
      message: 'test',
      dateString: longId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });
});
