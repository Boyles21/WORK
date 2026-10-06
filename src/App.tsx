/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Camera, 
  Smile, 
  Moon, 
  Sun, 
  Coffee, 
  Music,
  Image as ImageIcon,
  MessageSquareHeart,
  Calendar,
  Layers,
  Sparkles,
  Brain,
  ShieldCheck,
  LogOut,
  Lock,
  PenBox,
  Trash2,
  RefreshCcw,
  Download,
  CheckCircle2
} from 'lucide-react';
import { COLORS, GREETINGS, INTRO_TEXT, MOOD_RESPONSES, OPEN_WHEN, MOOD_SONGS, REASONS } from './constants';
import { getCompliment, getDailyMessage } from './services/geminiService';
import { db, auth, USER_ID } from './lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  deleteDoc
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  // Only throw the structured error if it's a permission issue per the Firebase skill specification
  if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('denied')) {
    const errInfo: FirestoreErrorInfo = {
      error: errMsg,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Permission Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    console.warn(`Firestore operation '${operationType}' notice on '${path}':`, errMsg);
  }
}

type View = 'landing' | 'transition' | 'main';

interface Polaroid {
  id: string;
  url: string;
  compliment: string;
  date: string;
}

interface Thought {
  id: string;
  text: string;
  createdAt: any;
}

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [dailyMsg, setDailyMsg] = useState('');
  const [isRefreshingMsg, setIsRefreshingMsg] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  const [moodSongId, setMoodSongId] = useState<string | null>(null);
  const [showOpenWhen, setShowOpenWhen] = useState<string | null>(null);
  const [polaroids, setPolaroids] = useState<Polaroid[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [newThought, setNewThought] = useState('');
  const [isSavingThought, setIsSavingThought] = useState(false);
  const [gratitudeInputs, setGratitudeInputs] = useState<[string, string, string]>(['', '', '']);
  const [isSavingGratitude, setIsSavingGratitude] = useState(false);
  const [gratitudeFeedback, setGratitudeFeedback] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentReason, setCurrentReason] = useState<string | null>(null);
  const [isJarPopping, setIsJarPopping] = useState(false);
  const [startDate] = useState(() => {
    // 4 days ago from October 6, 2026 is October 2, 2026
    const forceStartDate = new Date(2026, 9, 2, 0, 0, 0);
    localStorage.setItem('victoria_start_date', forceStartDate.toISOString());
    localStorage.removeItem('yessica_start_date');
    localStorage.removeItem('ammie_start_date');
    return forceStartDate;
  });

  const [timeLeft, setTimeLeft] = useState(() => {
    const start = new Date(2026, 9, 2, 0, 0, 0);
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();
    let hours = now.getHours() - start.getHours();
    let minutes = now.getMinutes() - start.getMinutes();
    let seconds = now.getSeconds() - start.getSeconds();

    if (seconds < 0) {
      minutes--;
      seconds += 60;
    }
    if (minutes < 0) {
      hours--;
      minutes += 60;
    }
    if (hours < 0) {
      days--;
      hours += 60;
    }
    if (days < 0) {
      months--;
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    return {
      years: Math.max(0, years),
      months: Math.max(0, months),
      days: Math.max(0, days),
      hours: Math.max(0, hours),
      minutes: Math.max(0, minutes),
      seconds: Math.max(0, seconds)
    };
  });
  const audioRef = useState<HTMLAudioElement | null>(null)[0];

  useEffect(() => {
    const timer = setInterval(() => {
      const start = startDate;
      const now = new Date();
      
      let years = now.getFullYear() - start.getFullYear();
      let months = now.getMonth() - start.getMonth();
      let days = now.getDate() - start.getDate();
      let hours = now.getHours() - start.getHours();
      let minutes = now.getMinutes() - start.getMinutes();
      let seconds = now.getSeconds() - start.getSeconds();

      if (seconds < 0) {
        minutes--;
        seconds += 60;
      }
      if (minutes < 0) {
        hours--;
        minutes += 60;
      }
      if (hours < 0) {
        days--;
        hours += 60;
      }
      if (days < 0) {
        months--;
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += prevMonth.getDate();
      }
      if (months < 0) {
        years--;
        months += 12;
      }

      setTimeLeft({
        years: Math.max(0, years),
        months: Math.max(0, months),
        days: Math.max(0, days),
        hours: Math.max(0, hours),
        minutes: Math.max(0, minutes),
        seconds: Math.max(0, seconds)
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [startDate]);

  useEffect(() => {
    // Check initial authorization (or ?autostart=1 for direct main view access)
    const params = new URLSearchParams(window.location.search);
    const isAutostart = params.get('autostart') === '1';
    if (isAutostart) {
      localStorage.setItem('victoria_access', 'true');
      setView('main');
    }
    const access = isAutostart ? 'true' : (localStorage.getItem('victoria_access') || localStorage.getItem('yessica_access') || localStorage.getItem('ammie_access'));
    setIsAuthorized(access === 'true');

    const now = new Date();
    const hour = now.getHours();
    if (hour >= 5 && hour < 12) setGreeting(GREETINGS.morning);
    else if (hour >= 12 && hour < 17) setGreeting(GREETINGS.afternoon);
    else setGreeting(GREETINGS.evening);

        // Synchronize daily message
    const savedNameMatch = localStorage.getItem('victoria_app_name') || localStorage.getItem('yessica_app_name') || localStorage.getItem('ammie_app_name');
    if (savedNameMatch !== 'Ayoola') {
      localStorage.removeItem('victoria_daily_msg');
      localStorage.removeItem('yessica_daily_msg');
      localStorage.removeItem('ammie_daily_msg');
      localStorage.setItem('victoria_app_name', 'Ayoola');
    }

    const savedDate = localStorage.getItem('victoria_daily_date') || localStorage.getItem('yessica_daily_date') || localStorage.getItem('ammie_daily_date');
    const todayStr = now.toDateString();

    // If day changed locally, clear old stale message immediately to prevent showing yesterday's
    if (savedNameMatch !== 'Ayoola' || (savedDate && savedDate !== todayStr)) {
      console.log("Day change or Name change detected. Clearing stale state.");
      localStorage.removeItem('victoria_daily_msg');
      localStorage.removeItem('victoria_daily_date');
      localStorage.removeItem('yessica_daily_msg');
      localStorage.removeItem('yessica_daily_date');
      localStorage.removeItem('ammie_daily_msg');
      localStorage.removeItem('ammie_daily_date');
      setDailyMsg('');
    } else {
      let savedDaily = localStorage.getItem('victoria_daily_msg') || localStorage.getItem('yessica_daily_msg') || localStorage.getItem('ammie_daily_msg');
      if (savedDaily) {
        if (
          savedDaily.includes('Aunty Mercy') || savedDaily.includes('aunty mercy') || savedDaily.includes('AUNTY MERCY') ||
          savedDaily.includes('Rhoda') || savedDaily.includes('rhoda') || savedDaily.includes('RHODA') ||
          savedDaily.includes('Yessica') || savedDaily.includes('yessica') || savedDaily.includes('YESSICA') ||
          savedDaily.includes('Ammie') || savedDaily.includes('ammie') || savedDaily.includes('AMMIE') ||
          savedDaily.includes('Victoria') || savedDaily.includes('victoria') || savedDaily.includes('VICTORIA')
        ) {
          savedDaily = savedDaily.replace(/Aunty Mercy/gi, 'Ayoola')
                                  .replace(/Rhoda/gi, 'Ayoola')
                                  .replace(/Yessica/gi, 'Ayoola')
                                  .replace(/Ammie/gi, 'Ayoola')
                                  .replace(/Victoria/gi, 'Ayoola');
          localStorage.setItem('victoria_daily_msg', savedDaily);
        }
        setDailyMsg(savedDaily);
      }
    }
    
    // Fetch/Sync with Firestore (Source of Truth)
    refreshDailyMessage();

    const savedPolaroids = localStorage.getItem('ayoola_polaroids') || localStorage.getItem('victoria_polaroids') || localStorage.getItem('yessica_polaroids') || localStorage.getItem('ammie_polaroids');
    if (savedPolaroids) {
      try {
        setPolaroids(JSON.parse(savedPolaroids));
      } catch (e) {
        console.warn("Could not parse cached polaroids:", e);
      }
    }

    const savedThoughts = localStorage.getItem('ayoola_thoughts');
    if (savedThoughts) {
      try {
        setThoughts(JSON.parse(savedThoughts));
      } catch (e) {
        console.warn("Could not parse cached thoughts:", e);
      }
    }
    
    if (access === 'true') {
      fetchPolaroids();
      fetchThoughts();
    }

    const dayCheckInterval = setInterval(() => {
      const checkNow = new Date();
      const checkToday = checkNow.toDateString();
      const currentSavedDate = localStorage.getItem('victoria_daily_date') || localStorage.getItem('yessica_daily_date') || localStorage.getItem('ammie_daily_date');
      if (currentSavedDate && currentSavedDate !== checkToday) {
        refreshDailyMessage();
      }
    }, 60000); // Check every minute

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDailyMessage();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(dayCheckInterval);
    };
  }, []);

  const refreshDailyMessage = async (force = false) => {
    try {
      setIsRefreshingMsg(true);
      const now = new Date();
      const todayStr = now.toDateString();
      
      // Use local date (YYYY-MM-DD) for the ID instead of ISO (UTC) 
      // to ensure "today" means today for the user's timezone.
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateId = `${year}-${month}-${day}`;

      // 1. Try to get from Firestore first (unless forced)
      const docRef = doc(db, 'daily_messages', dateId);
      
      if (!force) {
        let docSnap;
        try {
          docSnap = await getDoc(docRef);
        } catch (error) {
          console.warn("Firestore get daily message notice:", error);
          try {
            handleFirestoreError(error, OperationType.GET, `daily_messages/${dateId}`);
          } catch (e) {
            console.warn("Firestore permission notice:", e);
          }
        }

        if (docSnap && docSnap.exists()) {
          const data = docSnap.data();
          let msg = data.message || '';
          if (msg && (
            msg.includes('Aunty Mercy') || msg.includes('aunty mercy') || msg.includes('AUNTY MERCY') ||
            msg.includes('Rhoda') || msg.includes('rhoda') || msg.includes('RHODA') ||
            msg.includes('Ammie') || msg.includes('ammie') || msg.includes('AMMIE') ||
            msg.includes('Yessica') || msg.includes('yessica') || msg.includes('YESSICA') ||
            msg.includes('Victoria') || msg.includes('victoria') || msg.includes('VICTORIA')
          )) {
            msg = msg.replace(/Aunty Mercy/gi, 'Ayoola')
                      .replace(/Rhoda/gi, 'Ayoola')
                      .replace(/Ammie/gi, 'Ayoola')
                      .replace(/Yessica/gi, 'Ayoola')
                      .replace(/Victoria/gi, 'Ayoola');
            try {
              await setDoc(docRef, {
                message: msg.slice(0, 5000),
                dateString: data.dateString || dateId,
                createdAt: data.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            } catch (err) {
              console.warn("Failed to update corrected message in Firestore:", err);
            }
          }
          setDailyMsg(msg);
          localStorage.setItem('victoria_daily_msg', msg);
          localStorage.setItem('victoria_daily_date', todayStr);
          setIsRefreshingMsg(false);
          return;
        }
      }

      // 2. Generate new one (if not in Firestore or if forced)
      const generatedMsg = await getDailyMessage();
      const msg = (generatedMsg || "I hope today is kind to you, Ayoola. You deserve that kind of ease. 💛").slice(0, 5000);
      setDailyMsg(msg);
      localStorage.setItem('victoria_daily_msg', msg);
      localStorage.setItem('victoria_daily_date', todayStr);
      
      // 3. Save to Firestore for shared access
      const path = `daily_messages/${dateId}`;
      try {
        await setDoc(docRef, {
          message: msg,
          dateString: dateId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp() // Track when it was last changed/regenerated
        });
      } catch (err) {
        console.warn("Failed to save daily message:", err);
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    } catch (error) {
      console.warn("Error refreshing daily message:", error);
    } finally {
      setIsRefreshingMsg(false);
    }
  };

  const popJar = () => {
    setIsJarPopping(true);
    const randomReason = REASONS[Math.floor(Math.random() * REASONS.length)];
    setCurrentReason(randomReason);
    setTimeout(() => setIsJarPopping(false), 500);
  };

  const fetchPolaroids = async () => {
    const path = 'polaroids';
    try {
      const q = query(
        collection(db, path), 
        where('userId', '==', USER_ID)
      );
      const snapshot = await getDocs(q);
      const loaded = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }) as Polaroid & { createdAt?: any })
        .sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
      setPolaroids(loaded);
      localStorage.setItem('ayoola_polaroids', JSON.stringify(loaded));
    } catch (error) {
      console.warn("Notice fetching polaroids:", error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  const fetchThoughts = async () => {
    const path = 'thoughts';
    try {
      const q = query(
        collection(db, path),
        where('userId', '==', USER_ID)
      );
      const snapshot = await getDocs(q);
      const loaded = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }) as Thought)
        .sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
      setThoughts(loaded);
      localStorage.setItem('ayoola_thoughts', JSON.stringify(loaded));
    } catch (error) {
      console.warn("Notice fetching thoughts:", error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  const saveThought = async () => {
    if (!newThought.trim() || isSavingThought) return;
    
    setIsSavingThought(true);
    const path = 'thoughts';
    const cleanText = newThought.trim().slice(0, 10000);
    const fallbackId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    try {
      const thoughtData = {
        text: cleanText,
        userId: USER_ID,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, path), thoughtData);
      setThoughts(prev => {
        const updated = [{ id: docRef.id, text: cleanText, createdAt: new Date() }, ...prev];
        localStorage.setItem('ayoola_thoughts', JSON.stringify(updated));
        return updated;
      });
      setNewThought('');
    } catch (error) {
      console.warn("Notice saving thought (using local fallback):", error);
      setThoughts(prev => {
        const updated = [{ id: fallbackId, text: cleanText, createdAt: new Date() }, ...prev];
        localStorage.setItem('ayoola_thoughts', JSON.stringify(updated));
        return updated;
      });
      setNewThought('');
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSavingThought(false);
    }
  };

  const saveGratitudes = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const items = [
      gratitudeInputs[0].trim(),
      gratitudeInputs[1].trim(),
      gratitudeInputs[2].trim()
    ].filter(Boolean);

    if (items.length === 0 || isSavingGratitude) return;

    setIsSavingGratitude(true);
    const path = 'thoughts';
    const todayFormatted = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const newItems: Thought[] = [];
    try {
      for (let i = 0; i < items.length; i++) {
        const text = `🌿 Ayoola is grateful for (${todayFormatted}) #${i + 1}: ${items[i]}`.slice(0, 10000);
        const docRef = await addDoc(collection(db, path), {
          text,
          userId: USER_ID,
          createdAt: serverTimestamp()
        });
        newItems.push({
          id: docRef.id,
          text,
          createdAt: new Date()
        });
      }
      setThoughts(prev => {
        const updated = [...newItems, ...prev];
        localStorage.setItem('ayoola_thoughts', JSON.stringify(updated));
        return updated;
      });
      setGratitudeInputs(['', '', '']);
      setGratitudeFeedback(`Recorded ${items.length} gratitude moment${items.length > 1 ? 's' : ''} for today 💛`);
      setTimeout(() => setGratitudeFeedback(null), 3500);
    } catch (error) {
      console.warn("Notice saving gratitude thoughts (using local fallback):", error);
      const localItems: Thought[] = items.map((item, i) => ({
        id: `${Date.now()}-${i}`,
        text: `🌿 Ayoola is grateful for (${todayFormatted}) #${i + 1}: ${item}`.slice(0, 10000),
        createdAt: new Date()
      }));
      setThoughts(prev => {
        const updated = [...localItems, ...prev];
        localStorage.setItem('ayoola_thoughts', JSON.stringify(updated));
        return updated;
      });
      setGratitudeInputs(['', '', '']);
      setGratitudeFeedback(`Recorded ${items.length} gratitude moment${items.length > 1 ? 's' : ''} for today 💛`);
      setTimeout(() => setGratitudeFeedback(null), 3500);
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSavingGratitude(false);
    }
  };

  const deleteThought = async (id: string) => {
    const path = `thoughts/${id}`;
    setThoughts(prev => {
      const updated = prev.filter(t => t.id !== id);
      localStorage.setItem('ayoola_thoughts', JSON.stringify(updated));
      return updated;
    });
    try {
      await deleteDoc(doc(db, 'thoughts', id));
    } catch (error) {
      console.warn("Notice deleting thought:", error);
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const deletePolaroid = async (id: string) => {
    const path = `polaroids/${id}`;
    setPolaroids(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem('ayoola_polaroids', JSON.stringify(updated));
      return updated;
    });
    try {
      await deleteDoc(doc(db, 'polaroids', id));
    } catch (error) {
      console.warn("Notice deleting polaroid:", error);
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'memory.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback: open in new tab if blob download fails (e.g. CORS)
      window.open(url, '_blank');
    }
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPasscode = passcode.trim().toLowerCase();
    if (cleanPasscode === 'naomi') {
      localStorage.setItem('victoria_access', 'true');
      setIsAuthorized(true);
      setPasscodeError(false);
      fetchPolaroids();
      fetchThoughts();
      
      // Force refresh daily message if it's stale upon login
      const today = new Date().toDateString();
      const savedDate = localStorage.getItem('victoria_daily_date') || localStorage.getItem('yessica_daily_date') || localStorage.getItem('ammie_daily_date');
      if (savedDate !== today) {
        refreshDailyMessage();
      }
    } else {
      setPasscodeError(true);
      setPasscode('');
    }
  };

  const handleResetAccess = () => {
    localStorage.removeItem('victoria_access');
    localStorage.removeItem('yessica_access');
    localStorage.removeItem('ammie_access');
    setIsAuthorized(false);
    setView('landing');
    window.location.reload();
  };

  const handleEnter = () => {
    setView('transition');
    setTimeout(() => {
      setView('main');
    }, 2500);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    const reader = new FileReader();

    reader.onerror = () => {
      setUploadError("Could not read the file. Please try again.");
      setIsUploading(false);
    };

    reader.onload = async (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onerror = () => {
        setUploadError("Selected file is not a valid image.");
        setIsUploading(false);
      };

      img.onload = async () => {
        try {
          // Compress image using canvas
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

          const base64 = canvas.toDataURL('image/jpeg', 0.7); // Compress to 70% quality
          
          let compliment;
          try {
            compliment = await getCompliment(base64);
          } catch (err) {
            console.warn("Gemini notice:", err);
            compliment = "You look absolutely glowing here, Ayoola. 💛";
          }
          
          const newPolaroid: Polaroid = {
            id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
            url: base64,
            compliment,
            date: new Date().toLocaleDateString(),
          };

          setPolaroids(prev => {
            const updated = [newPolaroid, ...prev];
            try {
              localStorage.setItem('ayoola_polaroids', JSON.stringify(updated));
            } catch (e) {
              console.warn("Local storage quota notice:", e);
            }
            return updated;
          });

          // Save to Firestore
          const path = 'polaroids';
          try {
            await setDoc(doc(db, path, newPolaroid.id), {
              ...newPolaroid,
              userId: USER_ID,
              createdAt: serverTimestamp()
            });
          } catch (error) {
            console.warn("Notice saving polaroid to cloud (kept locally):", error);
            handleFirestoreError(error, OperationType.CREATE, path);
          }
        } catch (err) {
          console.warn("Upload process notice:", err);
          setUploadError("Something went wrong while uploading your memory.");
        } finally {
          setIsUploading(false);
        }
      };
    };
    reader.readAsDataURL(file);
  };


  if (isAuthorized === null) return null; // Still checking status

  if (!isAuthorized) {
    return (
      <div className={`min-h-screen bg-[#FFF9F5] text-[#5E503F] flex items-center justify-center p-6`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/60 p-8 md:p-12 rounded-[3rem] border border-white shadow-2xl backdrop-blur-md w-full max-w-md text-center space-y-8"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-[#D4A373]/10 rounded-full text-[#D4A373]">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl md:text-3xl font-serif">This space is just for you 💛</h2>
          </div>
          
          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode..."
              autoFocus
              className="w-full px-6 py-4 rounded-2xl bg-white border border-[#D4A373]/20 focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] outline-none text-center transition-all"
            />
            <AnimatePresence>
              {passcodeError && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-red-400 font-medium"
                >
                  That’s not the right code 🙂
                </motion.p>
              )}
            </AnimatePresence>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full py-4 bg-[#D4A373] text-white rounded-2xl font-display font-medium shadow-lg shadow-[#D4A373]/20 hover:bg-[#c39262] transition-all uppercase tracking-widest text-sm"
            >
              Enter
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#FFF9F5] text-[#5E503F] font-sans selection:bg-[#D4A373]/20 overflow-x-hidden`}>
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden"
          >
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="text-4xl md:text-6xl font-serif tracking-tight mb-8"
            >
               Welcome to your corner of the world, Ayoola <span className="text-[#D4A373]">💛</span>
            </motion.h1>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 1 }}
              onClick={handleEnter}
              className="px-10 py-3 rounded-full border border-[#D4A373] text-[#D4A373] hover:bg-[#D4A373] hover:text-white transition-all duration-500 tracking-widest text-sm uppercase"
            >
              Enter
            </motion.button>
          </motion.div>
        )}

        {view === 'transition' && (
          <motion.div
            key="transition"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen flex items-center justify-center"
          >
            <motion.p 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl italic font-serif opacity-70"
            >
              Just for you…
            </motion.p>
          </motion.div>
        )}

        {view === 'main' && (
          <motion.main
            key="main"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-16 md:space-y-24"
          >
            {/* Header / Intro */}
            <header className="space-y-4 md:space-y-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-[10px] md:text-sm uppercase tracking-widest opacity-50 mb-2 md:mb-4"
              >
                <Calendar size={14} /> {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </motion.div>
              <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tight leading-tight">
                {greeting}
              </h2>
              <p className="text-base md:text-lg opacity-80 max-w-2xl leading-relaxed">
                {INTRO_TEXT}
              </p>
            </header>

            {/* Daily Message */}
            <motion.section 
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-[#FEFAE0] rounded-2xl md:rounded-3xl p-6 md:p-12 border border-[#E9EDC6]/30 shadow-sm relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity hidden md:block">
                <MessageSquareHeart size={120} />
              </div>
              <h3 className="text-[10px] md:text-xs uppercase tracking-[0.2em] opacity-40 mb-3 md:mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">Message for today 💌</span>
                {isAuthorized && (
                  <button 
                    onClick={() => refreshDailyMessage(true)}
                    disabled={isRefreshingMsg}
                    className="p-2 hover:bg-[#D4A373]/10 rounded-full transition-colors disabled:opacity-30"
                    title="Change message"
                  >
                    <RefreshCcw size={14} className={isRefreshingMsg ? 'animate-spin' : ''} />
                  </button>
                )}
              </h3>
              <p className="text-xl md:text-3xl font-serif italic leading-snug relative z-10">
                {dailyMsg || "Thinking of something sweet to say..."}
              </p>
            </motion.section>

            {/* Stats Check */}
            <section className="flex flex-col items-center gap-12">
              {/* Days Counter */}
              <div className="bg-white/60 rounded-3xl p-8 md:p-10 border border-white shadow-xl shadow-[#D4A373]/5 backdrop-blur-md w-full md:max-w-xl">
                <span className="text-[10px] md:text-xs font-display font-semibold uppercase tracking-[0.3em] text-[#D4A373] mb-6 block text-center">Journey with you</span>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 md:gap-6 text-center">
                  {[
                    { label: 'Years', value: timeLeft.years },
                    { label: 'Months', value: timeLeft.months },
                    { label: 'Days', value: timeLeft.days },
                    { label: 'Hours', value: timeLeft.hours },
                    { label: 'Mins', value: timeLeft.minutes },
                    { label: 'Secs', value: timeLeft.seconds },
                  ].map((unit, idx) => (
                    <motion.div 
                      key={unit.label} 
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + idx * 0.1, type: 'spring' }}
                      className="flex flex-col items-center"
                    >
                      <div className="text-3xl md:text-4xl font-display font-bold text-[#5E503F]">{String(unit.value).padStart(2, '0')}</div>
                      <div className="text-[9px] md:text-[10px] font-medium uppercase tracking-widest opacity-50 mt-1">{unit.label}</div>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-8 text-[10px] md:text-xs italic opacity-40 text-center font-serif">...and making every second count</div>
              </div>

              {/* Million Reasons Jar */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="w-full md:max-w-xl text-center space-y-8"
              >
                <div className="relative group cursor-pointer" onClick={popJar}>
                  <motion.div
                    animate={isJarPopping ? { 
                      scale: [1, 1.2, 0.95, 1],
                      rotate: [0, 5, -5, 0]
                    } : {}}
                    transition={{ duration: 0.5 }}
                    className="relative z-10"
                  >
                    <div className="w-48 h-56 mx-auto relative">
                      {/* Jar Lid */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#D4A373] rounded-full z-20 shadow-md border-b border-black/10" />
                      {/* Jar Body */}
                      <div className="absolute top-4 left-0 w-full h-52 bg-white/40 border-4 border-white backdrop-blur-md rounded-[3rem] shadow-2xl flex items-center justify-center overflow-hidden">
                        <div className="p-6 text-center">
                          <Heart className={`text-[#D4A373] transition-all duration-300 ${isJarPopping ? 'scale-150 fill-[#D4A373]' : 'scale-100 opacity-30'}`} size={48} />
                        </div>
                        {/* Decorative sparkles inside */}
                        <Sparkles className="absolute top-10 right-10 text-yellow-400 opacity-20" size={20} />
                        <Sparkles className="absolute bottom-10 left-10 text-yellow-400 opacity-20" size={16} />
                      </div>
                    </div>
                  </motion.div>
                  
                  {/* Floating instructions */}
                  <motion.div 
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute -top-4 -right-4 bg-white px-4 py-2 rounded-full shadow-lg border border-[#D4A373]/20 text-[10px] font-display font-medium text-[#D4A373] uppercase tracking-widest z-30"
                  >
                    Tap me! 🍯
                  </motion.div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-display font-medium text-2xl tracking-tight">The "Million Reasons" Jar</h3>
                  <div className="min-h-[80px] flex items-center justify-center px-4">
                    <AnimatePresence mode="wait">
                      {currentReason ? (
                        <motion.p
                          key={currentReason}
                          initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                          className="font-serif italic text-lg md:text-xl text-[#5E503F] leading-relaxed"
                        >
                          "{currentReason}"
                        </motion.p>
                      ) : (
                        <p className="font-serif italic text-sm md:text-base opacity-40">
                          Whenever you feel low or just need a reminder,<br/>tap the jar to see why you're amazing.
                        </p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            </section>

            {/* Mood Check */}
            <section className="space-y-10">
              <h3 className="text-center font-display text-2xl md:text-3xl font-medium tracking-tight">How is your heart today?</h3>
              <div className="flex flex-wrap justify-center gap-4 md:gap-6">
                {[
                  { label: "Happy", emoji: "😊", key: 'happy', color: 'hover:bg-yellow-50' },
                  { label: "Okay", emoji: "😐", key: 'okay', color: 'hover:bg-blue-50' },
                  { label: "Sad", emoji: "😔", key: 'sad', color: 'hover:bg-slate-50' },
                  { label: "Stressed", emoji: "😤", key: 'stressed', color: 'hover:bg-orange-50' },
                  { label: "Loved", emoji: "❤️", key: 'loved', color: 'hover:bg-red-50' },
                ].map((item) => (
                  <motion.button
                    key={item.key}
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setMood(item.key);
                      setMoodSongId(MOOD_SONGS[item.key as keyof typeof MOOD_SONGS]);
                    }}
                    className={`px-6 md:px-8 py-4 md:py-5 rounded-[2rem] border-2 transition-all duration-300 flex flex-col items-center gap-2 shadow-sm ${
                      mood === item.key 
                        ? "bg-[#D4A373] text-white border-[#D4A373] shadow-lg shadow-[#D4A373]/20" 
                        : `bg-white border-white ${item.color} hover:border-[#D4A373]/20`
                    }`}
                  >
                    <span className="text-2xl md:text-3xl">{item.emoji}</span>
                    <span className="font-display font-medium text-xs md:text-sm uppercase tracking-widest">{item.label}</span>
                  </motion.button>
                ))}
              </div>
              <AnimatePresence>
                {mood && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    key={mood}
                    className="w-full max-w-2xl mx-auto space-y-6"
                  >
                    <div className="text-center space-y-3">
                      <p className="text-xl md:text-2xl italic font-serif opacity-90 px-4 leading-relaxed">
                        {MOOD_RESPONSES[mood as keyof typeof MOOD_RESPONSES]}
                      </p>
                      <div className="flex items-center justify-center gap-2 opacity-50">
                        <div className="h-[1px] w-8 bg-[#D4A373]" />
                        <p className="text-xs md:text-sm font-display uppercase tracking-widest">
                          A melody for this moment
                        </p>
                        <div className="h-[1px] w-8 bg-[#D4A373]" />
                      </div>
                    </div>

                    {moodSongId && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/60 rounded-[2.5rem] p-4 border border-white shadow-xl shadow-[#D4A373]/5 backdrop-blur-md overflow-hidden relative"
                      >
                        <div className="absolute inset-0 flex items-center justify-center -z-10 bg-white/20">
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="w-12 h-12 rounded-full border-2 border-[#D4A373]/20 border-t-[#D4A373] animate-spin"
                          />
                        </div>
                        <iframe 
                          className="rounded-[2rem] shadow-sm"
                          src={`https://open.spotify.com/embed/track/${moodSongId}?utm_source=generator&theme=0`} 
                          width="100%" 
                          height="152" 
                          frameBorder="0" 
                          allowFullScreen 
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                          loading="lazy"
                        ></iframe>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Open When */}
            <section className="space-y-8 md:space-y-12">
              <div className="flex items-center gap-6">
                <div className="h-[1px] flex-1 bg-[#D4A373]/20" />
                <h3 className="font-display font-medium text-2xl md:text-3xl tracking-tight text-center">Open when…</h3>
                <div className="h-[1px] flex-1 bg-[#D4A373]/20" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {[
                  { label: "Sad", key: 'sad', icon: Moon, color: 'hover:bg-blue-50' },
                  { label: "Can't sleep", key: 'cantSleep', icon: Coffee, color: 'hover:bg-amber-50' },
                  { label: "Miss me", key: 'missMe', icon: Heart, color: 'hover:bg-pink-50' },
                  { label: "Insecure", key: 'insecure', icon: Smile, color: 'hover:bg-green-50' },
                  { label: "Need a smile", key: 'smile', icon: Sparkles, color: 'hover:bg-yellow-50' },
                  { label: "Overthinking", key: 'overthinking', icon: Brain, color: 'hover:bg-purple-50' },
                  { label: "Doubt", key: 'doubt', icon: ShieldCheck, color: 'hover:bg-indigo-50' },
                  { label: "Lonely", key: 'lonely', icon: Moon, color: 'hover:bg-gray-50' },
                  { label: "Accomplished", key: 'accomplished', icon: Sparkles, color: 'hover:bg-yellow-50' },
                  { label: "Motivation", key: 'needMotivation', icon: Sun, color: 'hover:bg-orange-50' },
                  { label: "Tired", key: 'tired', icon: Coffee, color: 'hover:bg-slate-50' },
                  { label: "Anxious", key: 'anxious', icon: Brain, color: 'hover:bg-indigo-50' },
                  { label: "Home", key: 'missingHome', icon: Heart, color: 'hover:bg-red-50' },
                  { label: "Life is good", key: 'lifeIsGood', icon: Smile, color: 'hover:bg-emerald-50' },
                ].map((item) => (
                  <motion.button
                    key={item.key}
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowOpenWhen(showOpenWhen === item.key ? null : item.key)}
                    className={`aspect-square bg-white border border-white rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all group shadow-sm hover:shadow-xl hover:shadow-[#D4A373]/10 ${item.color}`}
                  >
                    <div className="p-4 rounded-2xl bg-white group-hover:scale-110 transition-transform shadow-sm">
                      <item.icon size={28} className="opacity-40 group-hover:opacity-100 group-hover:text-[#D4A373] transition-all" />
                    </div>
                    <span className="text-[10px] md:text-xs font-display font-semibold tracking-[0.2em] uppercase opacity-40 group-hover:opacity-100 text-center px-4">{item.label}</span>
                  </motion.button>
                ))}
              </div>
              <AnimatePresence>
                {showOpenWhen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-[#FEFAE0] rounded-2xl md:rounded-3xl p-6 md:p-8 border border-[#E9EDC6]/40 text-center">
                      <p className="text-lg md:text-xl font-serif italic leading-relaxed">
                        {OPEN_WHEN[showOpenWhen as keyof typeof OPEN_WHEN]}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Private Thoughts Section */}
            <section className="space-y-10">
              <div className="flex items-center gap-6">
                <div className="h-[1px] flex-1 bg-[#D4A373]/20" />
                <h3 className="font-display font-medium text-2xl md:text-3xl tracking-tight text-center">Private Space 🍯</h3>
                <div className="h-[1px] flex-1 bg-[#D4A373]/20" />
              </div>
              
              <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] p-6 md:p-10 border border-white shadow-xl shadow-[#D4A373]/5">
                <div className="space-y-6">
                  <div className="relative">
                    <textarea
                      value={newThought}
                      onChange={(e) => setNewThought(e.target.value)}
                      placeholder="Write your private thoughts here..."
                      className="w-full h-32 px-6 pr-12 py-6 rounded-[2rem] bg-white border border-[#D4A373]/20 focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] outline-none transition-all resize-none font-serif text-lg leading-relaxed placeholder:opacity-30"
                    />
                    <div className="absolute right-6 bottom-6 flex items-center gap-3">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={saveThought}
                        disabled={!newThought.trim() || isSavingThought}
                        className={`p-3 rounded-full ${newThought.trim() ? 'bg-[#D4A373] text-white' : 'bg-[#D4A373]/20 text-[#D4A373]/50 cursor-not-allowed'} transition-all shadow-lg`}
                      >
                        <PenBox size={20} />
                      </motion.button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <AnimatePresence initial={false}>
                      {thoughts.filter(t => !t.text.includes("grateful for")).map((thought) => (
                        <motion.div
                          key={thought.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="bg-white/40 p-6 rounded-3xl border border-white/50 group flex justify-between items-start gap-4"
                        >
                          <p className="font-serif italic opacity-80 leading-relaxed">
                            {thought.text}
                          </p>
                          <button
                            onClick={() => deleteThought(thought.id)}
                            className="opacity-100 md:opacity-0 md:group-hover:opacity-30 md:hover:opacity-100 transition-all p-2 text-red-400 hover:text-red-600"
                            title="Delete thought"
                            aria-label="Delete thought"
                          >
                            <Trash2 size={16} />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {thoughts.filter(t => !t.text.includes("grateful for")).length === 0 && (
                      <p className="text-center italic opacity-30 text-sm py-4">Your private wall is empty... Write something special.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Ayoola's Daily Gratitude List Section */}
            <section className="space-y-10">
              <div className="flex items-center gap-6">
                <div className="h-[1px] flex-1 bg-[#D4A373]/20" />
                <div className="text-center space-y-1">
                  <h3 className="font-display font-medium text-2xl md:text-3xl tracking-tight">Ayoola's Daily Gratitude 🌿</h3>
                  <p className="text-xs md:text-sm font-serif italic opacity-60">Three things Ayoola is grateful for each day</p>
                </div>
                <div className="h-[1px] flex-1 bg-[#D4A373]/20" />
              </div>

              <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] p-6 md:p-10 border border-white shadow-xl shadow-[#D4A373]/5 space-y-8">
                {/* Header with Today's Date */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D4A373]/10">
                  <div className="flex items-center gap-2 text-xs font-display uppercase tracking-widest text-[#D4A373] font-semibold">
                    <Sparkles size={14} />
                    <span>Three Good Things Today</span>
                  </div>
                  <span className="text-xs font-serif italic text-[#5E503F]/70">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                {/* 3-Item Gratitude List Input Form */}
                <form onSubmit={saveGratitudes} className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { idx: 0, placeholder: "1. What brought peace, warmth, or joy to Ayoola today?" },
                      { idx: 1, placeholder: "2. A person, kind gesture, or conversation Ayoola appreciates..." },
                      { idx: 2, placeholder: "3. A simple blessing or moment of comfort in Ayoola's day..." }
                    ].map((item) => (
                      <div
                        key={item.idx}
                        className="flex items-center gap-4 bg-white rounded-2xl px-5 py-4 border border-[#D4A373]/20 focus-within:border-[#D4A373] focus-within:ring-2 focus-within:ring-[#D4A373]/20 transition-all shadow-sm"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#D4A373]/15 text-[#D4A373] text-sm font-semibold flex items-center justify-center flex-shrink-0">
                          {item.idx + 1}
                        </div>
                        <input
                          type="text"
                          value={gratitudeInputs[item.idx]}
                          onChange={(e) => {
                            const next = [...gratitudeInputs] as [string, string, string];
                            next[item.idx] = e.target.value;
                            setGratitudeInputs(next);
                          }}
                          placeholder={item.placeholder}
                          className="w-full bg-transparent outline-none font-serif text-base text-[#5E503F] placeholder:opacity-35"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isSavingGratitude || !gratitudeInputs.some(t => t.trim().length > 0)}
                        className={`px-8 py-3.5 rounded-2xl font-display font-medium text-sm transition-all flex items-center gap-2.5 ${
                          gratitudeInputs.some(t => t.trim().length > 0) && !isSavingGratitude
                            ? 'bg-[#D4A373] text-white shadow-lg shadow-[#D4A373]/25 hover:bg-[#c39262] cursor-pointer'
                            : 'bg-[#D4A373]/20 text-[#D4A373]/50 cursor-not-allowed'
                        }`}
                      >
                        <Heart size={16} className={isSavingGratitude ? 'animate-ping' : ''} />
                        <span>{isSavingGratitude ? "Saving to thoughts..." : "Record 3 Things"}</span>
                      </motion.button>
                      {gratitudeInputs.some(t => t.length > 0) && (
                        <button
                          type="button"
                          onClick={() => setGratitudeInputs(['', '', ''])}
                          className="text-xs text-[#5E503F]/50 hover:text-[#5E503F] underline underline-offset-4"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {gratitudeFeedback && (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200"
                        >
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>{gratitudeFeedback}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </form>

                {/* Recorded Gratitude List */}
                <div className="pt-6 border-t border-[#D4A373]/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-xs uppercase tracking-widest text-[#5E503F]/60 font-semibold">
                      Recorded Gratitude List ({thoughts.filter(t => t.text.includes("grateful for")).length})
                    </h4>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {thoughts
                        .filter(t => t.text.includes("grateful for"))
                        .map((thought) => (
                          <motion.div
                            key={thought.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white/70 p-4 md:p-5 rounded-2xl border border-white/80 group flex items-start justify-between gap-4 shadow-sm hover:shadow-md transition-all"
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <span className="p-1.5 rounded-lg bg-[#FEFAE0] text-[#D4A373] mt-0.5 flex-shrink-0">
                                <Sparkles size={14} />
                              </span>
                              <div className="space-y-1">
                                <p className="font-serif text-base text-[#5E503F] leading-relaxed">
                                  {thought.text.replace(/^🌿 (?:Ayoola|Aunty Mercy|Elizabeth) is grateful for( \([^)]+\))?( #[0-9]+)?:\s*/, '')}
                                </p>
                                <div className="text-[11px] font-sans text-[#5E503F]/40 flex items-center gap-2">
                                  <span>{(thought.text.match(/^🌿 (?:Ayoola|Aunty Mercy|Elizabeth) is grateful for( \([^)]+\))?( #[0-9]+)?/)?.[0] || "Ayoola's Gratitude").replace(/Aunty Mercy|Elizabeth/g, 'Ayoola')}</span>
                                  {thought.createdAt && (
                                    <span>• {thought.createdAt?.toDate ? thought.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Saved'}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteThought(thought.id)}
                              className="opacity-100 md:opacity-0 md:group-hover:opacity-40 md:hover:opacity-100 transition-all p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                              title="Delete gratitude entry"
                              aria-label="Delete gratitude entry"
                            >
                              <Trash2 size={16} />
                            </button>
                          </motion.div>
                        ))}
                    </AnimatePresence>

                    {thoughts.filter(t => t.text.includes("grateful for")).length === 0 && (
                      <div className="py-8 text-center bg-white/30 rounded-2xl border border-dashed border-[#D4A373]/20">
                        <p className="font-serif italic text-sm text-[#5E503F]/50">
                          No gratitude entries recorded yet. List three things Ayoola is grateful for today 💛
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Polaroid Wall */}
            <section className="space-y-8 md:space-y-12">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#D4A373]/10 pb-8">
                <div className="space-y-2">
                  <h3 className="font-display font-medium text-3xl md:text-4xl tracking-tight">Polaroid Wall 📸</h3>
                  <p className="text-sm opacity-50 font-serif italic">Capturing moments, one click at a time...</p>
                </div>
                <div className="w-full md:w-auto space-y-2">
                  <motion.label 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`cursor-pointer bg-[#D4A373] text-white w-full md:w-auto px-8 py-4 rounded-full text-sm font-display font-medium shadow-lg shadow-[#D4A373]/20 hover:bg-[#c39262] transition-all flex items-center justify-center gap-3 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Camera size={18} />
                    <span>{isUploading ? "Uploading..." : "Share a memory"}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload} 
                      disabled={isUploading}
                    />
                  </motion.label>
                  {uploadError && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] text-red-500 font-medium text-center italic"
                    >
                      {uploadError}
                    </motion.p>
                  )}
                </div>
              </div>

              {isUploading && (
                <div className="text-center py-8 md:py-12 opacity-50 italic text-sm">
                  Looking at your picture... just a moment...
                </div>
              )}

              {polaroids.length === 0 && !isUploading && (
                <div className="bg-white/30 rounded-2xl md:rounded-3xl py-12 md:py-20 text-center border border-dashed border-[#D4A373]/20 px-6">
                  <ImageIcon className="mx-auto opacity-10 mb-4" size={48} />
                  <p className="opacity-40 italic text-sm md:text-base">Nothing here yet. Why not add your first photo?</p>
                </div>
              )}

              <div className="columns-1 sm:columns-2 gap-6 md:gap-8 space-y-6 md:space-y-8 pb-8 md:pb-12">
                <AnimatePresence>
                  {polaroids.map((p, idx) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileHover={{ y: -8, rotate: idx % 2 === 0 ? '2deg' : '-2deg', scale: 1.02 }}
                      layout
                      className="break-inside-avoid relative group"
                    >
                      <div className="bg-white p-3 md:p-4 pb-10 md:pb-12 shadow-xl shadow-[#D4A373]/10 border border-white transition-shadow duration-500 group-hover:shadow-2xl group-hover:shadow-[#D4A373]/20 relative">
                        <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
                          {/* Download Button */}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImage(p.url, `memory-${p.id}.jpg`);
                            }}
                            className="bg-white/95 backdrop-blur-md p-2.5 rounded-full shadow-xl text-[#D4A373] hover:text-[#5E503F] border border-[#D4A373]/10"
                            title="Download memory"
                          >
                            <Download size={18} />
                          </motion.button>

                          {/* Delete Button */}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePolaroid(p.id);
                            }}
                            className="bg-white/95 backdrop-blur-md p-2.5 rounded-full shadow-xl text-red-400 hover:text-red-600 border border-red-100"
                            title="Delete memory"
                            aria-label="Delete memory"
                          >
                            <Trash2 size={18} />
                          </motion.button>
                        </div>

                        <div className="aspect-[4/5] overflow-hidden bg-gray-50 mb-4 md:mb-6">
                          <img src={p.url} alt="Polaroid" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                        </div>
                        <div className="space-y-2">
                          <p className="font-serif text-base md:text-lg leading-relaxed text-[#5E503F]">
                            {p.url.startsWith('blob') ? "Analyzing..." : p.compliment}
                          </p>
                          <span className="text-[10px] uppercase tracking-widest opacity-30 block mt-3 md:mt-4">
                            {p.date}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>

            <footer className="text-center pt-24 pb-12 opacity-30 text-xs tracking-[0.3em] uppercase space-y-4">
              <div>Ayoola's Corner — Made for you with ❤️</div>
              <button 
                onClick={handleResetAccess}
                className="hover:opacity-100 transition-opacity flex items-center gap-2 mx-auto scale-75"
              >
                <LogOut size={12} />
                <span>Reset Access</span>
              </button>
            </footer>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
