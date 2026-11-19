import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail, RefreshCw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthViewProps {
  onSuccess: () => void;
  onClose?: () => void;
  embedded?: boolean;
  subtitle?: string;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onSuccess,
  onClose,
  embedded = false,
  subtitle,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const rawId = identifier.trim();
    if (!rawId || !password) {
      setError('Enter your username or email and password.');
      return;
    }

    setLoading(true);
    try {
      let loginEmail = rawId;

      if (!rawId.includes('@')) {
        const { data: rpcEmail, error: rpcErr } = await supabase.rpc(
          'get_email_by_username',
          { p_username: rawId }
        );

        if (rpcErr) {
          const { data: profileRow, error: profErr } = await supabase
            .from('profiles')
            .select('email')
            .ilike('username', rawId)
            .maybeSingle();

          if (profErr || !profileRow?.email) {
            setError('No account found for that username.');
            setLoading(false);
            return;
          }
          loginEmail = profileRow.email;
        } else if (!rpcEmail) {
          setError('No account found for that username.');
          setLoading(false);
          return;
        } else {
          loginEmail = rpcEmail;
        }
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (signInErr) {
        if (signInErr.message.toLowerCase().includes('email not confirmed')) {
          setPendingVerifyEmail(loginEmail);
          setMode('verify');
          setInfoMessage('Please verify your email address before signing in.');
        } else {
          setError(signInErr.message);
        }
        return;
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedUsername || !trimmedEmail || !password) {
      setError('All fields are required.');
      return;
    }

    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(trimmedUsername)) {
      setError(
        'Username must be 3–24 characters using letters, numbers, underscores, dots, or hyphens.'
      );
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data: available, error: availErr } = await supabase.rpc(
        'check_username_available',
        { p_username: trimmedUsername }
      );

      if (!availErr && available === false) {
        setError('That username is already taken (usernames are case-insensitive).');
        setLoading(false);
        return;
      }

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            name: trimmedName,
            username: trimmedUsername,
          },
        },
      });

      if (signUpErr) {
        if (signUpErr.message.toLowerCase().includes('duplicate')) {
          setError('Username or email is already registered.');
        } else {
          setError(signUpErr.message);
        }
        return;
      }

      if (data.session) {
        onSuccess();
      } else {
        setPendingVerifyEmail(trimmedEmail);
        setMode('verify');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerifyEmail) return;
    setResending(true);
    setError(null);
    setInfoMessage(null);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: pendingVerifyEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (resendErr) {
        setError(resendErr.message);
      } else {
        setInfoMessage('Verification email sent again. Check your inbox and spam folder.');
      }
    } finally {
      setResending(false);
    }
  };

  const card = (
    <div className="w-full max-w-md bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">
            {mode === 'verify'
              ? 'Verify your email'
              : mode === 'signin'
              ? 'Sign in to StartOrigin'
              : 'Create your account'}
          </h1>
          <p className="text-xs text-[#737373] mt-1.5">
            {subtitle ||
              (mode === 'verify'
                ? 'One final step to activate your account.'
                : 'Store your archive and share public frames.')}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication"
            className="min-h-[40px] min-w-[40px] -mt-1 -mr-1 flex items-center justify-center rounded-full hover:bg-[#F5F5F7] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {mode !== 'verify' && (
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F5F5F7] rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
              setInfoMessage(null);
            }}
            className={`min-h-[38px] rounded-lg text-xs font-medium transition-all ${
              mode === 'signin'
                ? 'bg-white text-[#0A0A0A] shadow-xs'
                : 'text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
              setInfoMessage(null);
            }}
            className={`min-h-[38px] rounded-lg text-xs font-medium transition-all ${
              mode === 'signup'
                ? 'bg-white text-[#0A0A0A] shadow-xs'
                : 'text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            Sign Up
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.08] text-xs text-[#0A0A0A] flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{infoMessage}</span>
        </div>
      )}

      {mode === 'verify' ? (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-[#F5F5F7] border border-black/[0.06] text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-white border border-black/[0.08] flex items-center justify-center mx-auto">
              <Mail className="w-5 h-5 text-[#0A0A0A]" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#0A0A0A]">
                Verification link sent
              </p>
              <p className="text-xs text-[#525252] break-all">
                {pendingVerifyEmail}
              </p>
            </div>
            <p className="text-xs text-[#737373] leading-relaxed">
              Open your inbox and click the confirmation link. Once verified, you can sign in with either your username or email.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-xs font-medium text-[#0A0A0A] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>{resending ? 'Sending...' : 'Resend verification email'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium flex items-center justify-center gap-2 hover:bg-black/85 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Continue to Sign In</span>
          </button>
        </div>
      ) : mode === 'signin' ? (
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
              Username or Email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="alex or alex@example.com"
              autoComplete="username"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] mt-2 px-4 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-black/85 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Mercer"
              autoComplete="name"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alexmercer"
              autoComplete="username"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm transition-colors"
            />
            <p className="text-[11px] text-[#737373] mt-1">
              Case-insensitive (e.g. Alex and alex refer to the same handle).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              autoComplete="email"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] mt-2 px-4 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-black/85 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="flex items-center justify-center py-12 px-4">{card}</div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {card}
    </div>
  );
};
