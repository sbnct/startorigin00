import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SwipeCaptcha } from './SwipeCaptcha';

interface AuthViewProps {
  onSuccess: () => void;
  onClose?: () => void;
  embedded?: boolean;
  initialMode?: 'signin' | 'signup';
  subtitle?: string;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onSuccess,
  onClose,
  embedded = false,
  initialMode = 'signin',
  subtitle,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaAttention, setCaptchaAttention] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const resetCaptcha = () => {
    setCaptchaVerified(false);
    setCaptchaAttention(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const rawId = identifier.trim();
    if (!rawId || !password) {
      setError('Enter your username or email and password.');
      return;
    }

    if (!captchaVerified) {
      setCaptchaAttention(true);
      setError('Please swipe to verify you are not a robot.');
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
            resetCaptcha();
            return;
          }
          loginEmail = profileRow.email;
        } else if (!rpcEmail) {
          setError('No account found for that username.');
          resetCaptcha();
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
        setError(signInErr.message);
        resetCaptcha();
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

    if (!captchaVerified) {
      setCaptchaAttention(true);
      setError('Please swipe to verify you are not a robot.');
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
        resetCaptcha();
        return;
      }

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
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
        resetCaptcha();
        return;
      }

      if (data.session) {
        onSuccess();
        return;
      }

      // Attempt immediate sign-in without requiring an email confirmation step
      const { error: immediateSignInErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (!immediateSignInErr) {
        onSuccess();
        return;
      }

      setInfoMessage('Account created. Sign in to continue.');
      setMode('signin');
      setIdentifier(trimmedUsername);
      resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const card = (
    <div className="w-full max-w-md bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">
            {mode === 'signin' ? 'Sign in to StartOrigin' : 'Create your account'}
          </h1>
          <p className="text-xs text-[#737373] mt-1.5">
            {subtitle || 'Store your archive and share public frames.'}
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

      <div className="grid grid-cols-2 gap-1 p-1 bg-[#F5F5F7] rounded-xl mb-6">
        <button
          type="button"
          onClick={() => {
            setMode('signin');
            setError(null);
            setInfoMessage(null);
            resetCaptcha();
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
            resetCaptcha();
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

      {mode === 'signin' ? (
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

          <SwipeCaptcha
            verified={captchaVerified}
            attention={captchaAttention}
            onChange={(ok) => {
              setCaptchaVerified(ok);
              if (ok) {
                setCaptchaAttention(false);
                if (error === 'Please swipe to verify you are not a robot.') {
                  setError(null);
                }
              }
            }}
          />

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

          <SwipeCaptcha
            verified={captchaVerified}
            attention={captchaAttention}
            onChange={(ok) => {
              setCaptchaVerified(ok);
              if (ok) {
                setCaptchaAttention(false);
                if (error === 'Please swipe to verify you are not a robot.') {
                  setError(null);
                }
              }
            }}
          />

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
