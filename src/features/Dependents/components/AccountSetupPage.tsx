import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/Button';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { UserSettingsService } from '@/features/Settings/services/userSettingsService';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import type { BelroseUserProfile } from '@/types/core';

const PLACEHOLDER_DOMAIN = '@placeholder.belrose.health';

interface TrusteeEntry {
  uid: string;
  trustLevel: string;
  profile: BelroseUserProfile | null;
}

// ── Email section ──────────────────────────────────────────────────────────────

function EmailSection({ user }: { user: BelroseUserProfile }) {
  const { refreshUser } = useAuthContext();
  const isPlaceholder = user.email?.endsWith(PLACEHOLDER_DOMAIN) ?? false;
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckVerification = async () => {
    setIsChecking(true);
    try {
      await refreshUser();
      const authUser = getAuth().currentUser;
      if (authUser?.emailVerified) {
        await updateDoc(doc(getFirestore(), 'users', user.uid), {
          emailVerified: true,
          emailVerifiedAt: new Date().toISOString(),
        });
        toast.success('Email verified!');
      } else {
        toast.error('Not verified yet — check your inbox and click the link.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  if (!isPlaceholder && user.emailVerified) {
    return (
      <SectionCard
        icon={<Mail className="w-4 h-4" />}
        title="Email"
        status="ok"
        statusLabel="Verified"
      >
        <p className="text-sm text-slate-600">{user.email}</p>
      </SectionCard>
    );
  }

  if (!isPlaceholder && !user.emailVerified) {
    return (
      <SectionCard
        icon={<Mail className="w-4 h-4" />}
        title="Email"
        status="warn"
        statusLabel="Unverified"
      >
        <p className="text-sm text-slate-600 mb-4">
          A verification link was sent to <strong>{user.email}</strong>. Click it, then confirm
          below.
        </p>
        <Button
          onClick={handleCheckVerification}
          disabled={isChecking}
          className="w-full flex items-center justify-center gap-2"
        >
          {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isChecking ? 'Checking…' : "I've verified my email"}
        </Button>
      </SectionCard>
    );
  }

  // Placeholder email — prompt to set a real one
  if (sent) {
    return (
      <SectionCard
        icon={<Mail className="w-4 h-4" />}
        title="Email"
        status="warn"
        statusLabel="Verify email"
      >
        <p className="text-sm text-slate-600 mb-4">
          Verification link sent to <strong>{newEmail}</strong>. Click it in your inbox, then
          confirm below.
        </p>
        <Button
          onClick={handleCheckVerification}
          disabled={isChecking}
          className="w-full flex items-center justify-center gap-2"
        >
          {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isChecking ? 'Checking…' : "I've verified my email"}
        </Button>
      </SectionCard>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !password || !user.uid) return;
    setIsSaving(true);
    try {
      await UserSettingsService.updateEmail(user.uid, newEmail, password);
      setSent(true);
      toast.success('Verification email sent. Click the link to confirm.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update email.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionCard
      icon={<Mail className="w-4 h-4" />}
      title="Email"
      status="warn"
      statusLabel="Add email"
    >
      <p className="text-sm text-slate-500 mb-4">
        Your account currently has a placeholder email. Add a real one so you can receive
        notifications and reset your password independently.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          placeholder="Your email address"
          required
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Current password (to confirm)"
          required
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        />
        <Button
          type="submit"
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isSaving ? 'Sending…' : 'Send verification email'}
        </Button>
      </form>
    </SectionCard>
  );
}

// ── Password section ───────────────────────────────────────────────────────────

function PasswordSection({ user }: { user: BelroseUserProfile }) {
  if (user.passwordSelfSetAt) {
    return (
      <SectionCard
        icon={<Lock className="w-4 h-4" />}
        title="Password"
        status="ok"
        statusLabel="Set by you"
      >
        <p className="text-sm text-slate-600">
          You set your own password using your recovery phrase.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon={<Lock className="w-4 h-4" />}
      title="Password"
      status="warn"
      statusLabel="Recommended"
    >
      <p className="text-sm text-slate-500 mb-4">
        Your initial password was set by your guardian. We recommend changing it to one only you
        know.
      </p>
      <Link
        to="/app/settings/account"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        Change password in Settings
        <ExternalLink className="w-3.5 h-3.5" />
      </Link>
    </SectionCard>
  );
}

// ── Trustee section ────────────────────────────────────────────────────────────

function TrusteeSection({ trustees }: { trustees: TrusteeEntry[] }) {
  return (
    <SectionCard icon={<Users className="w-4 h-4" />} title="Who has access">
      <p className="text-sm text-slate-500 mb-4">
        These people currently have trustee access to your health records.
      </p>
      {trustees.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No active trustees.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {trustees.map(({ uid, trustLevel, profile }) => {
            const initials =
              `${profile?.firstName?.[0] ?? ''}${profile?.lastName?.[0] ?? ''}`.toUpperCase() ||
              '?';
            const name = profile?.displayName || profile?.firstName || uid.slice(0, 8) + '…';
            return (
              <div key={uid} className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                  {profile?.photoURL ? (
                    <img
                      src={profile.photoURL}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800 flex-1 truncate">{name}</p>
                <span className="text-xs font-semibold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full capitalize">
                  {trustLevel}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <Link
        to="/app/settings/trustees"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        Manage trustee access in Settings
        <ExternalLink className="w-3.5 h-3.5" />
      </Link>
    </SectionCard>
  );
}

// ── Section card shell ─────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  status,
  statusLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  status?: 'ok' | 'warn';
  statusLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-slate-400">{icon}</span>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {statusLabel && (
          <span
            className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
              status === 'ok' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

const AccountSetupPage: React.FC = () => {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [trustees, setTrustees] = useState<TrusteeEntry[]>([]);
  const [loadingTrustees, setLoadingTrustees] = useState(true);
  const isEmailPlaceholder = user?.email?.endsWith(PLACEHOLDER_DOMAIN) ?? true;
  const canContinue = !isEmailPlaceholder && (user?.emailVerified ?? false);

  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirestore();
    getDocs(
      query(
        collection(db, 'trusteeRelationships'),
        where('trustorId', '==', user.uid),
        where('isActive', '==', true)
      )
    )
      .then(async snap => {
        const entries = await Promise.all(
          snap.docs.map(async d => {
            const data = d.data();
            const profile = await getUserProfile(data.trusteeId).catch(() => null);
            return { uid: data.trusteeId, trustLevel: data.trustLevel ?? 'viewer', profile };
          })
        );
        setTrustees(entries);
      })
      .catch(() => {})
      .finally(() => setLoadingTrustees(false));
  }, [user?.uid]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Account claimed!</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review these settings before heading to your dashboard.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-4 mb-8">
          <EmailSection user={user} />
          <PasswordSection user={user} />
          {loadingTrustees ? (
            <div className="border border-slate-200 rounded-xl p-5 flex items-center gap-3 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading trustees…</span>
            </div>
          ) : trustees.length > 0 ? (
            <TrusteeSection trustees={trustees} />
          ) : null}
        </div>

        {/* Continue */}
        {!canContinue && (
          <p className="text-xs text-center text-amber-600 mb-3 flex items-center justify-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Set a real email above before continuing.
          </p>
        )}
        <Button
          onClick={() => navigate('/app', { replace: true })}
          disabled={!canContinue}
          className="w-full flex items-center justify-center gap-2"
        >
          Continue to Belrose
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default AccountSetupPage;
