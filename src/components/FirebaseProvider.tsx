/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Firebase Auth & Firestore Workspace Provider
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  enableNetwork,
  Timestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { toSafeFirestoreId, GroundingSourceLink } from '../logic/diagnostics_log';
import type { VirtualDevice, LiveDeviceDiagnosticsResult } from '../types';

export interface CloudDiagnosticRecord {
  id: string;
  ownerId: string;
  deviceId: string;
  adbSerial: string;
  adbDevicesPassed: boolean;
  getpropPassed: boolean;
  playStoreInstalled: boolean;
  youtubeInstalled: boolean;
  summary: string;
  createdAt?: Timestamp | string;
}

export interface CloudAiThread {
  id: string;
  ownerId: string;
  title: string;
  model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
  useSearchGrounding: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface CloudAiMessage {
  id: string;
  ownerId: string;
  threadId: string;
  role: 'user' | 'model';
  text: string;
  sourceUrls: string[];
  sourceTitles: string[];
  createdAt?: Timestamp | string;
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  profileReady: boolean;
  authError: string | null;
  cloudDiagnostics: CloudDiagnosticRecord[];
  cloudThreads: CloudAiThread[];
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  retryProfileSync: () => Promise<void>;
  saveDiagnosticSnapshot: (
    diag: LiveDeviceDiagnosticsResult,
    summary: string
  ) => Promise<string | null>;
  syncDeviceProfileToCloud: (device: VirtualDevice) => Promise<void>;
  createAiThread: (
    title: string,
    model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite',
    useSearchGrounding: boolean
  ) => Promise<string | null>;
  updateAiThread: (
    threadId: string,
    updates: Partial<Pick<CloudAiThread, 'title' | 'model' | 'useSearchGrounding'>>
  ) => Promise<void>;
  deleteAiThread: (threadId: string) => Promise<void>;
  appendAiMessage: (
    threadId: string,
    role: 'user' | 'model',
    text: string,
    sources?: GroundingSourceLink[]
  ) => Promise<string | null>;
  subscribeThreadMessages: (
    threadId: string,
    onData: (messages: CloudAiMessage[]) => void
  ) => () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudDiagnostics, setCloudDiagnostics] = useState<CloudDiagnosticRecord[]>([]);
  const [cloudThreads, setCloudThreads] = useState<CloudAiThread[]>([]);

  const toEpochMs = (val: unknown): number => {
    if (!val) return 0;
    if (typeof val === 'object' && val !== null && 'toMillis' in val && typeof (val as any).toMillis === 'function') {
      return (val as Timestamp).toMillis();
    }
    if (typeof val === 'string') {
      const parsed = Date.parse(val);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const isOfflineError = (err: unknown): boolean => {
    const code = (err as any)?.code;
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    return code === 'unavailable' || msg.includes('client is offline') || msg.includes('offline');
  };

  // Bootstrap /users/{uid} root profile for Master Gate invariant
  const ensureUserProfile = useCallback(async (u: User) => {
    const safeUid = toSafeFirestoreId(u.uid, 'user');
    const path = `users/${safeUid}`;
    const ref = doc(db, 'users', safeUid);
    const delays = [0, 500, 1200, 2200];

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
      if (auth.currentUser?.uid !== u.uid) return;
      try {
        await enableNetwork(db).catch(() => {});
        const snap = await getDoc(ref);
        if (auth.currentUser?.uid !== u.uid) return;
        const displayName = (u.displayName || u.email?.split('@')[0] || 'Lab Operator').slice(0, 120);
        if (!snap.exists()) {
          await setDoc(ref, {
            uid: safeUid,
            displayName,
            role: 'operator',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        setAuthError(null);
        setProfileReady(true);
        return;
      } catch (error) {
        if (auth.currentUser?.uid !== u.uid) return;
        if (isOfflineError(error) && attempt < delays.length - 1) {
          continue;
        }
        setProfileReady(false);
        if (isOfflineError(error)) {
          setAuthError('Cloud Firestore is currently offline. Check network connectivity and click Refresh.');
          return;
        }
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        try {
          await ensureUserProfile(u);
        } catch (err: any) {
          setAuthError(err?.message || 'Failed to verify user workspace profile.');
        }
      } else {
        setProfileReady(false);
        setAuthError(null);
        setCloudDiagnostics([]);
        setCloudThreads([]);
      }
    });
    return () => unsub();
  }, [ensureUserProfile]);

  // Real-time Firestore listeners once auth & profile are ready
  useEffect(() => {
    if (!authReady || !user || !profileReady) return;
    const uid = toSafeFirestoreId(user.uid, 'user');

    const diagPath = `users/${uid}/diagnostics`;
    const diagQuery = query(collection(db, diagPath), where('ownerId', '==', uid));

    const unsubDiag = onSnapshot(
      diagQuery,
      (snap) => {
        const items = snap.docs.map((d) => d.data() as CloudDiagnosticRecord);
        items.sort((a, b) => toEpochMs(b.createdAt) - toEpochMs(a.createdAt));
        setCloudDiagnostics(items);
      },
      (error) => {
        if (isOfflineError(error)) return;
        handleFirestoreError(error, OperationType.LIST, diagPath);
      }
    );

    const threadsPath = `users/${uid}/aiThreads`;
    const threadsQuery = query(collection(db, threadsPath), where('ownerId', '==', uid));

    const unsubThreads = onSnapshot(
      threadsQuery,
      (snap) => {
        const items = snap.docs.map((d) => d.data() as CloudAiThread);
        items.sort((a, b) => toEpochMs(b.updatedAt) - toEpochMs(a.updatedAt));
        setCloudThreads(items);
      },
      (error) => {
        if (isOfflineError(error)) return;
        handleFirestoreError(error, OperationType.LIST, threadsPath);
      }
    );

    return () => {
      unsubDiag();
      unsubThreads();
    };
  }, [authReady, user, profileReady]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setAuthError(err?.message || 'Google sign-in failed.');
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await firebaseSignOut(auth);
  }, []);

  const retryProfileSync = useCallback(async () => {
    if (!auth.currentUser) return;
    setAuthError(null);
    await ensureUserProfile(auth.currentUser);
  }, [ensureUserProfile]);

  const saveDiagnosticSnapshot = useCallback(
    async (diag: LiveDeviceDiagnosticsResult, summary: string): Promise<string | null> => {
      if (!user || !profileReady) return null;
      const uid = toSafeFirestoreId(user.uid, 'user');
      const snapshotId = toSafeFirestoreId(`diag_${Date.now().toString(36)}`);
      const path = `users/${uid}/diagnostics/${snapshotId}`;
      try {
        await setDoc(doc(db, path), {
          id: snapshotId,
          ownerId: uid,
          deviceId: (diag.deviceId || 'host_probe').slice(0, 128),
          adbSerial: (diag.adbSerial || 'none').slice(0, 128),
          adbDevicesPassed: Boolean(diag.adbDevices.passed),
          getpropPassed: Boolean(diag.getprop.passed),
          playStoreInstalled: Boolean(diag.packages.playStore.installed),
          youtubeInstalled: Boolean(diag.packages.youtube.installed),
          summary: summary.slice(0, 4000) || 'Diagnostic run completed.',
          createdAt: serverTimestamp(),
        });
        return snapshotId;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, profileReady]
  );

  const syncDeviceProfileToCloud = useCallback(
    async (device: VirtualDevice): Promise<void> => {
      if (!user || !profileReady) return;
      const uid = toSafeFirestoreId(user.uid, 'user');
      const devId = toSafeFirestoreId(device.id, 'dev');
      const path = `users/${uid}/devices/${devId}`;
      try {
        const ref = doc(db, path);
        const existing = await getDoc(ref);
        const payload = {
          id: devId,
          ownerId: uid,
          name: (device.name || 'Android Device').slice(0, 140),
          model: (device.model || 'Unknown').slice(0, 120),
          manufacturer: (device.manufacturer || 'Android').slice(0, 80),
          androidVersion: (device.androidVersion || 'Unknown').slice(0, 64),
          apiLevel: Math.max(0, Math.min(100, Math.round(Number(device.apiLevel) || 0))),
          deviceCategory: device.deviceCategory,
          adbSerial: (device.adbSerial || '').slice(0, 128),
          avdName: (device.avdName || '').slice(0, 128),
          status: device.status,
          updatedAt: serverTimestamp(),
        };
        if (existing.exists()) {
          await updateDoc(ref, {
            name: payload.name,
            model: payload.model,
            manufacturer: payload.manufacturer,
            androidVersion: payload.androidVersion,
            apiLevel: payload.apiLevel,
            deviceCategory: payload.deviceCategory,
            adbSerial: payload.adbSerial,
            avdName: payload.avdName,
            status: payload.status,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(ref, {
            ...payload,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [user, profileReady]
  );

  const createAiThread = useCallback(
    async (
      title: string,
      model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite',
      useSearchGrounding: boolean
    ): Promise<string | null> => {
      if (!user || !profileReady) return null;
      const uid = toSafeFirestoreId(user.uid, 'user');
      const threadId = toSafeFirestoreId(`thr_${Date.now().toString(36)}`);
      const path = `users/${uid}/aiThreads/${threadId}`;
      try {
        await setDoc(doc(db, path), {
          id: threadId,
          ownerId: uid,
          title: (title || 'Lab Session').slice(0, 160),
          model,
          useSearchGrounding,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return threadId;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, profileReady]
  );

  const updateAiThread = useCallback(
    async (
      threadId: string,
      updates: Partial<Pick<CloudAiThread, 'title' | 'model' | 'useSearchGrounding'>>
    ) => {
      if (!user || !profileReady) return;
      const uid = toSafeFirestoreId(user.uid, 'user');
      const safeTid = toSafeFirestoreId(threadId, 'thr');
      const path = `users/${uid}/aiThreads/${safeTid}`;
      try {
        const cleanUpdates: Record<string, any> = { updatedAt: serverTimestamp() };
        if (updates.title !== undefined) cleanUpdates.title = updates.title.slice(0, 160) || 'Lab Session';
        if (updates.model !== undefined) cleanUpdates.model = updates.model;
        if (updates.useSearchGrounding !== undefined)
          cleanUpdates.useSearchGrounding = Boolean(updates.useSearchGrounding);
        await updateDoc(doc(db, path), cleanUpdates);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, profileReady]
  );

  const deleteAiThread = useCallback(
    async (threadId: string) => {
      if (!user || !profileReady) return;
      const uid = toSafeFirestoreId(user.uid, 'user');
      const safeTid = toSafeFirestoreId(threadId, 'thr');
      const path = `users/${uid}/aiThreads/${safeTid}`;
      try {
        await deleteDoc(doc(db, path));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, profileReady]
  );

  const appendAiMessage = useCallback(
    async (
      threadId: string,
      role: 'user' | 'model',
      text: string,
      sources: GroundingSourceLink[] = []
    ): Promise<string | null> => {
      if (!user || !profileReady) return null;
      const uid = toSafeFirestoreId(user.uid, 'user');
      const safeTid = toSafeFirestoreId(threadId, 'thr');
      const msgId = toSafeFirestoreId(`msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`);
      const path = `users/${uid}/aiThreads/${safeTid}/messages/${msgId}`;
      const boundedSources = sources.slice(0, 10);
      try {
        await setDoc(doc(db, path), {
          id: msgId,
          ownerId: uid,
          threadId: safeTid,
          role,
          text: (text || '(empty)').slice(0, 32000),
          sourceUrls: boundedSources.map((s) => s.uri.slice(0, 1024)),
          sourceTitles: boundedSources.map((s) => s.title.slice(0, 300)),
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, `users/${uid}/aiThreads/${safeTid}`), {
          updatedAt: serverTimestamp(),
        });
        return msgId;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, profileReady]
  );

  const subscribeThreadMessages = useCallback(
    (threadId: string, onData: (messages: CloudAiMessage[]) => void) => {
      if (!authReady || !user || !profileReady) return () => {};
      const uid = toSafeFirestoreId(user.uid, 'user');
      const safeTid = toSafeFirestoreId(threadId, 'thr');
      const path = `users/${uid}/aiThreads/${safeTid}/messages`;
      const q = query(collection(db, path), where('ownerId', '==', uid));
      return onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => d.data() as CloudAiMessage);
          items.sort((a, b) => toEpochMs(a.createdAt) - toEpochMs(b.createdAt));
          onData(items);
        },
        (error) => {
          if (isOfflineError(error)) return;
          handleFirestoreError(error, OperationType.LIST, path);
        }
      );
    },
    [authReady, user, profileReady]
  );

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        profileReady,
        authError,
        cloudDiagnostics,
        cloudThreads,
        signInWithGoogle,
        signOut,
        retryProfileSync,
        saveDiagnosticSnapshot,
        syncDeviceProfileToCloud,
        createAiThread,
        updateAiThread,
        deleteAiThread,
        appendAiMessage,
        subscribeThreadMessages,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside a FirebaseProvider');
  }
  return ctx;
}
