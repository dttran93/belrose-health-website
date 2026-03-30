/**
 * SignalDevPanel.tsx
 *
 * DEV-ONLY floating overlay for debugging Signal Protocol key state.
 * Only renders when import.meta.env.DEV === true — zero production impact.
 *
 * Shows:
 *   - Current user UID
 *   - AES master key session status (from sessionStorage)
 *   - Signal setup status (from useSignalSetup)
 *   - Identity key fingerprint (from IndexedDB)
 *   - Local pre-key count (from IndexedDB)
 *   - Session state for the active recipient (from IndexedDB via SessionManager)
 *   - Last 3 message type/regId pairs from the active conversation
 *
 * Usage in MessagingView.tsx — add inside the root <div>, after all other children:
 *
 *   {import.meta.env.DEV && (
 *     <SignalDevPanel
 *       currentUserId={user?.uid ?? null}
 *       recipientUserId={recipientUserId || null}
 *       signalStatus={signalStatus}
 *       messages={activeMessages}   // optional — pass messages from useMessaging
 *     />
 *   )}
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SessionManager } from '../lib/sessionManager';
import { BelroseSignalStore } from '../lib/BelroseSignalStore';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import type { SignalSetupStatus } from '../hooks/useSignalSetup';
import type { DecryptedMessage } from '../hooks/useMessaging';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignalDevPanelProps {
  currentUserId: string | null;
  recipientUserId: string | null;
  signalStatus: SignalSetupStatus;
  /** Optional — pass messages from useMessaging to show last message metadata */
  messages?: DecryptedMessage[];
}

interface KeyState {
  hasIdentityKey: boolean;
  identityKeyFingerprint: string | null; // first 12 chars of base64 pubkey
  localPreKeyCount: number;
  sessionCount: number;
  hasSessionWithRecipient: boolean | null; // null = not checked yet
  aesSessionActive: boolean;
  aesSessionMinsLeft: number;
}

// ---------------------------------------------------------------------------
// Helpers — read directly from IndexedDB
// ---------------------------------------------------------------------------

/**
 * Opens the belrose-signal IndexedDB and counts keys prefixed with userId.
 * Returns { preKeyCount, sessionCount } without touching the Signal library.
 */
async function readIndexedDBCounts(
  userId: string
): Promise<{ preKeyCount: number; sessionCount: number }> {
  return new Promise(resolve => {
    const req = indexedDB.open('belrose-signal');
    req.onsuccess = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      const storeNames = Array.from(db.objectStoreNames);

      let preKeyCount = 0;
      let sessionCount = 0;
      let done = 0;
      const total = 2;

      const finish = () => {
        done++;
        if (done === total) resolve({ preKeyCount, sessionCount });
      };

      // Count preKeys
      if (storeNames.includes('preKeys')) {
        const tx = db.transaction('preKeys', 'readonly');
        tx.objectStore('preKeys').getAllKeys().onsuccess = ke => {
          const keys = (ke.target as IDBRequest).result as string[];
          preKeyCount = keys.filter(k => String(k).startsWith(`${userId}_`)).length;
          finish();
        };
      } else {
        finish();
      }

      // Count sessions
      if (storeNames.includes('sessions')) {
        const tx = db.transaction('sessions', 'readonly');
        tx.objectStore('sessions').getAllKeys().onsuccess = ke => {
          const keys = (ke.target as IDBRequest).result as string[];
          sessionCount = keys.filter(k => String(k).startsWith(`${userId}_`)).length;
          finish();
        };
      } else {
        finish();
      }
    };
    req.onerror = () => resolve({ preKeyCount: 0, sessionCount: 0 });
  });
}

/**
 * Gets a short fingerprint of the identity key public key.
 * Useful to compare between two browser tabs — if they differ, sessions will fail.
 */
async function getIdentityFingerprint(userId: string): Promise<string | null> {
  try {
    const store = new BelroseSignalStore(userId);
    const keyPair = await store.getIdentityKeyPair();
    if (!keyPair?.pubKey) return null;
    // Convert ArrayBuffer to base64 and take first 16 chars as fingerprint
    const bytes = new Uint8Array(keyPair.pubKey);
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.slice(0, 16);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SignalDevPanel: React.FC<SignalDevPanelProps> = ({
  currentUserId,
  recipientUserId,
  signalStatus,
  messages = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [keyState, setKeyState] = useState<KeyState>({
    hasIdentityKey: false,
    identityKeyFingerprint: null,
    localPreKeyCount: 0,
    sessionCount: 0,
    hasSessionWithRecipient: null,
    aesSessionActive: false,
    aesSessionMinsLeft: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentUserId) return;
    setIsRefreshing(true);

    try {
      const [fingerprint, counts, sessionKey] = await Promise.all([
        getIdentityFingerprint(currentUserId),
        readIndexedDBCounts(currentUserId),
        EncryptionKeyManager.getSessionKey(),
      ]);

      let hasSessionWithRecipient: boolean | null = null;
      if (recipientUserId) {
        try {
          hasSessionWithRecipient = await SessionManager.hasSession(recipientUserId);
        } catch {
          hasSessionWithRecipient = false;
        }
      }

      const minsLeft = sessionKey
        ? Math.round(EncryptionKeyManager.getRemainingSessionTime() / 60000)
        : 0;

      setKeyState({
        hasIdentityKey: !!fingerprint,
        identityKeyFingerprint: fingerprint,
        localPreKeyCount: counts.preKeyCount,
        sessionCount: counts.sessionCount,
        hasSessionWithRecipient,
        aesSessionActive: !!sessionKey,
        aesSessionMinsLeft: minsLeft,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUserId, recipientUserId]);

  // Auto-refresh whenever panel opens or recipient changes
  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, recipientUserId, refresh]);

  // Auto-refresh every 5s while open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [isOpen, refresh]);

  const copyState = async () => {
    const state = {
      currentUserId,
      recipientUserId,
      signalStatus,
      keyState,
      lastMessages: messages.slice(-3).map(m => ({
        id: m.id.slice(0, 8),
        isOwn: m.isOwn,
        text: m.text.slice(0, 30),
      })),
      timestamp: new Date().toISOString(),
    };
    await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Last 3 messages metadata for display
  const recentMessages = messages.slice(-3);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        fontFamily: '"Berkeley Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize: '11px',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          background: isOpen ? '#0f0f0f' : '#1a1a2e',
          color: '#7fdbca',
          border: '1px solid #7fdbca44',
          borderRadius: isOpen ? '8px 8px 0 0' : '8px',
          cursor: 'pointer',
          fontSize: '11px',
          fontFamily: 'inherit',
          letterSpacing: '0.05em',
        }}
      >
        <span style={{ fontSize: '14px' }}>{isOpen ? '▼' : '▲'}</span>
        <span>🔐 SIGNAL DEV</span>
        {/* Status dot */}
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background:
              signalStatus === 'ready'
                ? '#4ade80'
                : signalStatus === 'error'
                  ? '#f87171'
                  : '#facc15',
            display: 'inline-block',
          }}
        />
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          style={{
            background: '#0f0f0f',
            border: '1px solid #7fdbca44',
            borderTop: 'none',
            borderRadius: '8px 0 8px 8px',
            padding: '12px',
            width: '320px',
            color: '#c8d8e8',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#7fdbca', letterSpacing: '0.1em', fontWeight: 700 }}>
              SIGNAL KEY STATE
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={refresh} style={btnStyle} disabled={isRefreshing}>
                {isRefreshing ? '⟳' : '↺'} refresh
              </button>
              <button onClick={copyState} style={btnStyle}>
                {copied ? '✓ copied' : '⎘ copy'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* User IDs */}
            <Row label="YOU" value={currentUserId ?? '—'} mono truncate />
            <Row label="RECIPIENT" value={recipientUserId ?? '(none selected)'} mono truncate />

            <Divider />

            {/* Signal setup */}
            <Row
              label="SIGNAL SETUP"
              value={signalStatus.toUpperCase()}
              color={
                signalStatus === 'ready'
                  ? '#4ade80'
                  : signalStatus === 'error'
                    ? '#f87171'
                    : '#facc15'
              }
            />

            {/* Identity key */}
            <Row
              label="IDENTITY KEY"
              value={
                keyState.hasIdentityKey ? `✓ ${keyState.identityKeyFingerprint}…` : '✗ NOT FOUND'
              }
              color={keyState.hasIdentityKey ? '#4ade80' : '#f87171'}
            />

            {/* Pre-key count */}
            <Row
              label="LOCAL PRE-KEYS"
              value={`${keyState.localPreKeyCount} in IndexedDB`}
              color={keyState.localPreKeyCount > 0 ? '#4ade80' : '#f87171'}
            />

            {/* Session count */}
            <Row
              label="SESSIONS (total)"
              value={`${keyState.sessionCount} stored`}
              color={keyState.sessionCount > 0 ? '#4ade80' : '#94a3b8'}
            />

            {/* Session with recipient */}
            {recipientUserId && (
              <Row
                label="SESSION W/ RECIPIENT"
                value={
                  keyState.hasSessionWithRecipient === null
                    ? 'checking…'
                    : keyState.hasSessionWithRecipient
                      ? '✓ ACTIVE'
                      : '✗ NONE (will X3DH on send)'
                }
                color={
                  keyState.hasSessionWithRecipient === null
                    ? '#facc15'
                    : keyState.hasSessionWithRecipient
                      ? '#4ade80'
                      : '#fb923c'
                }
              />
            )}

            <Divider />

            {/* AES master key session */}
            <Row
              label="AES SESSION"
              value={
                keyState.aesSessionActive
                  ? `✓ ACTIVE — ${keyState.aesSessionMinsLeft}m left`
                  : '✗ EXPIRED / NONE'
              }
              color={keyState.aesSessionActive ? '#4ade80' : '#f87171'}
            />

            {/* Recent messages */}
            {recentMessages.length > 0 && (
              <>
                <Divider />
                <div
                  style={{
                    color: '#7fdbca',
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    marginBottom: '2px',
                  }}
                >
                  RECENT MESSAGES
                </div>
                {recentMessages.map((m, i) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '3px 0',
                      color: '#94a3b8',
                      fontSize: '10px',
                    }}
                  >
                    <span style={{ color: m.isOwn ? '#7fdbca' : '#c084fc' }}>
                      {m.isOwn ? 'YOU' : 'THEM'}
                    </span>
                    <span
                      style={{
                        maxWidth: '220px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color:
                          m.text === '[Unable to decrypt message]'
                            ? '#f87171'
                            : m.text === '[Sent message]'
                              ? '#facc15'
                              : '#c8d8e8',
                      }}
                    >
                      {m.text.slice(0, 35)}
                      {m.text.length > 35 ? '…' : ''}
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Actions */}
            <Divider />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <ActionButton
                label="Clear IndexedDB Sessions"
                color="#f87171"
                onClick={async () => {
                  if (!currentUserId) return;
                  if (
                    !confirm(
                      'Clear all Signal sessions for this user from IndexedDB? You will need to re-establish sessions.'
                    )
                  )
                    return;
                  const req = indexedDB.open('belrose-signal');
                  req.onsuccess = e => {
                    const db = (e.target as IDBOpenDBRequest).result;
                    ['sessions', 'preKeys'].forEach(storeName => {
                      if (!Array.from(db.objectStoreNames).includes(storeName)) return;
                      const tx = db.transaction(storeName, 'readwrite');
                      const store = tx.objectStore(storeName);
                      store.getAllKeys().onsuccess = ke => {
                        const keys = (ke.target as IDBRequest).result as string[];
                        keys
                          .filter(k => String(k).startsWith(`${currentUserId}_`))
                          .forEach(k => store.delete(k));
                      };
                    });
                  };
                  await refresh();
                }}
              />
              <ActionButton
                label="Log Full Store to Console"
                color="#7fdbca"
                onClick={async () => {
                  if (!currentUserId) return;
                  const store = new BelroseSignalStore(currentUserId);
                  const keyPair = await store.getIdentityKeyPair();
                  const counts = await readIndexedDBCounts(currentUserId);
                  console.group('🔐 Signal Dev Panel — Full State');
                  console.log('User ID:', currentUserId);
                  console.log('Identity key pair:', keyPair);
                  console.log('IndexedDB counts:', counts);
                  console.log('Key state:', keyState);
                  console.groupEnd();
                }}
              />
            </div>

            {/* Hint */}
            <div style={{ color: '#475569', fontSize: '10px', marginTop: '4px', lineHeight: 1.5 }}>
              Identity fingerprint should match across tabs for the same user. Mismatch = Bad MAC on
              decrypt. Auto-refreshes every 5s.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const Row: React.FC<{
  label: string;
  value: string;
  color?: string;
  mono?: boolean;
  truncate?: boolean;
}> = ({ label, value, color, mono, truncate }) => (
  <div
    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
  >
    <span style={{ color: '#475569', fontSize: '10px', letterSpacing: '0.08em', flexShrink: 0 }}>
      {label}
    </span>
    <span
      style={{
        color: color ?? '#c8d8e8',
        fontFamily: mono ? 'inherit' : undefined,
        overflow: truncate ? 'hidden' : undefined,
        textOverflow: truncate ? 'ellipsis' : undefined,
        whiteSpace: truncate ? 'nowrap' : undefined,
        maxWidth: truncate ? '160px' : undefined,
        fontSize: '10px',
        textAlign: 'right',
      }}
      title={truncate ? value : undefined}
    >
      {value}
    </span>
  </div>
);

const Divider: React.FC = () => (
  <div style={{ height: '1px', background: '#1e293b', margin: '4px 0' }} />
);

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #334155',
  color: '#7fdbca',
  padding: '2px 6px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '10px',
  fontFamily: 'inherit',
};

const ActionButton: React.FC<{ label: string; color: string; onClick: () => void }> = ({
  label,
  color,
  onClick,
}) => (
  <button
    onClick={onClick}
    style={{
      ...btnStyle,
      color,
      borderColor: `${color}44`,
      padding: '3px 8px',
    }}
  >
    {label}
  </button>
);

export default SignalDevPanel;
