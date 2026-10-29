import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Database,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import { Member, BackendInfo, AuthView } from '../types';
import {
  getSupabaseConfig,
  isSupabaseConfigured,
  getCurrentBackendInfo,
  subscribeToBackendInfo,
  refreshBackendStatus,
  signUpWithAccount,
  signInWithIdentifier,
  signInWithGoogle,
  resetPasswordForEmail,
  checkUsernameAvailability,
  setExplicitLocalMode
} from '../lib/supabaseClient';
import {
  validateUsername,
  validateEmail,
  validatePassword,
  validatePasswordMatch
} from '../utils/authValidation';

interface AuthScreenProps {
  onAuthenticated: (member: Member) => void;
  onOpenConfigModal: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  onOpenConfigModal
}) => {
  const [view, setView] = useState<AuthView>('signin');

  // Sign In state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up state
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Validation & Form feedback
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSuccess, setGeneralSuccess] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available?: boolean; error?: string }>({
    checking: false
  });

  const [backendInfo, setBackendInfo] = useState<BackendInfo>(getCurrentBackendInfo());
  const isCloudConfigured = isSupabaseConfigured();

  useEffect(() => {
    refreshBackendStatus();
    const unsub = subscribeToBackendInfo((info) => {
      setBackendInfo(info);
    });
    return () => unsub();
  }, []);

  // Debounced username availability checker
  useEffect(() => {
    if (view !== 'signup') return;
    const clean = signupUsername.trim().toLowerCase();
    if (!clean) {
      setUsernameStatus({ checking: false });
      return;
    }

    const val = validateUsername(clean);
    if (!val.valid) {
      setUsernameStatus({ checking: false, available: false, error: val.error });
      return;
    }

    setUsernameStatus({ checking: true });
    const timer = setTimeout(async () => {
      const res = await checkUsernameAvailability(clean);
      if (res.available) {
        setUsernameStatus({ checking: false, available: true });
      } else {
        setUsernameStatus({ checking: false, available: false, error: 'Username already taken' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [signupUsername, view]);

  // Handle Login submission
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setGeneralSuccess(null);

    const idClean = loginIdentifier.trim();
    if (!idClean) {
      setGeneralError('Please enter your username or email.');
      return;
    }
    if (!loginPassword) {
      setGeneralError('Please enter your password.');
      return;
    }

    setLoading(true);
    const res = await signInWithIdentifier(idClean, loginPassword);
    setLoading(false);

    if (res.success && res.user) {
      const member: Member = {
        id: res.user.id,
        display_name: res.user.user_metadata?.display_name || idClean,
        username: res.user.user_metadata?.username,
        email: res.user.email,
        auth_provider: 'email',
        avatar_color: res.user.user_metadata?.avatar_color || '#8B7CF6',
        last_seen_at: new Date().toISOString(),
        created_at: res.user.created_at || new Date().toISOString(),
        is_online: true
      };
      onAuthenticated(member);
    } else {
      setGeneralError(res.error || 'Failed to sign in. Please check your credentials.');
    }
  };

  // Handle Sign Up submission
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setGeneralSuccess(null);

    const uVal = validateUsername(signupUsername);
    if (!uVal.valid) {
      setGeneralError(uVal.error || 'Invalid username');
      return;
    }

    const eVal = validateEmail(signupEmail);
    if (!eVal.valid) {
      setGeneralError(eVal.error || 'Invalid email');
      return;
    }

    const pVal = validatePassword(signupPassword);
    if (!pVal.valid) {
      setGeneralError(pVal.error || 'Invalid password');
      return;
    }

    const mVal = validatePasswordMatch(signupPassword, signupConfirmPassword);
    if (!mVal.valid) {
      setGeneralError(mVal.error || 'Passwords do not match');
      return;
    }

    if (usernameStatus.available === false) {
      setGeneralError('Please choose an available username.');
      return;
    }

    setLoading(true);
    const res = await signUpWithAccount({
      username: signupUsername.trim().toLowerCase(),
      email: signupEmail.trim().toLowerCase(),
      password: signupPassword,
      displayName: signupDisplayName.trim() || signupUsername.trim()
    });
    setLoading(false);

    if (res.success && res.user) {
      // If auto-confirm is enabled or session is returned immediately
      if (res.session) {
        const member: Member = {
          id: res.user.id,
          display_name: signupDisplayName.trim() || signupUsername.trim(),
          username: signupUsername.trim().toLowerCase(),
          email: signupEmail.trim().toLowerCase(),
          auth_provider: 'email',
          avatar_color: '#8B7CF6',
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          is_online: true
        };
        onAuthenticated(member);
      } else {
        setGeneralSuccess('Account created! If confirmation is required, please check your inbox, or sign in now.');
        setView('signin');
        setLoginIdentifier(signupUsername.trim());
      }
    } else {
      setGeneralError(res.error || 'Registration failed. Please try again.');
    }
  };

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setGeneralError(null);
    const res = await signInWithGoogle();
    if (!res.success) {
      setLoading(false);
      setGeneralError(res.error || 'Google sign-in could not be initiated.');
    }
  };

  // Handle Password Reset Request
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    const eVal = validateEmail(forgotEmail);
    if (!eVal.valid) {
      setGeneralError(eVal.error || 'Please enter a valid email.');
      return;
    }

    setLoading(true);
    const res = await resetPasswordForEmail(forgotEmail);
    setLoading(false);

    if (res.success) {
      setForgotSuccess(true);
    } else {
      setGeneralError(res.error || 'Failed to send reset link.');
    }
  };

  // Guest / Demo entry fallback
  const handleGuestDemo = () => {
    setExplicitLocalMode(true);
    const guestMember: Member = {
      id: crypto.randomUUID(),
      display_name: 'Guest Friend',
      avatar_color: '#8B7CF6',
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_online: true
    };
    localStorage.setItem('kith_current_member', JSON.stringify(guestMember));
    onAuthenticated(guestMember);
  };

  const passwordEval = validatePassword(signupPassword);

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-center items-center px-4 py-8 select-none">
      <div className="w-full max-w-[440px] bg-white border border-[#EAE5E0] p-7 md:p-9 shadow-[0_8px_30px_rgba(36,33,43,0.04)] rounded-3xl space-y-6 relative transition-all">
        {/* Header / Brand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F0ECFF] border border-[#DDD6FE] flex items-center justify-center text-[#8B7CF6] shadow-xs">
              <Sparkles className="w-5 h-5 fill-[#8B7CF6]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#24212B]">Kith</h1>
              <p className="text-xs text-[#827D8B]">Permanent friend-group messaging</p>
            </div>
          </div>

          {/* Backend Status indicator */}
          <button
            type="button"
            onClick={onOpenConfigModal}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
              backendInfo.status === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
            title="Click to check or configure Supabase connection"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendInfo.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {backendInfo.status === 'connected' ? 'Cloud Connected' : 'Setup Cloud'}
          </button>
        </div>

        {/* Global Alerts */}
        {generalError && (
          <div
            role="alert"
            className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{generalError}</div>
          </div>
        )}

        {generalSuccess && (
          <div
            role="status"
            className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in"
          >
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{generalSuccess}</div>
          </div>
        )}

        {/* Tab Switcher (Sign In vs Create Account) */}
        {view !== 'forgot_password' && (
          <div className="grid grid-cols-2 p-1 bg-[#F5F2EB] rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setView('signin');
                setGeneralError(null);
              }}
              className={`py-2 rounded-xl transition-all ${
                view === 'signin'
                  ? 'bg-white text-[#24212B] shadow-xs'
                  : 'text-[#827D8B] hover:text-[#24212B]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setView('signup');
                setGeneralError(null);
              }}
              className={`py-2 rounded-xl transition-all ${
                view === 'signup'
                  ? 'bg-white text-[#24212B] shadow-xs'
                  : 'text-[#827D8B] hover:text-[#24212B]'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* VIEW 1: SIGN IN */}
        {view === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#4A4553] mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A39EAA]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. jordan or jordan@example.com"
                    autoComplete="username"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-[#FAF8F5] border border-[#EAE5E0] focus:border-[#8B7CF6] focus:bg-white rounded-xl text-sm text-[#24212B] outline-none transition-all placeholder:text-[#A39EAA]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#4A4553]">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setView('forgot_password');
                      setForgotEmail(loginIdentifier.includes('@') ? loginIdentifier : '');
                      setGeneralError(null);
                    }}
                    className="text-[11px] font-medium text-[#8B7CF6] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A39EAA]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-[#FAF8F5] border border-[#EAE5E0] focus:border-[#8B7CF6] focus:bg-white rounded-xl text-sm text-[#24212B] outline-none transition-all placeholder:text-[#A39EAA]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#A39EAA] hover:text-[#4A4553]"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#8B7CF6] hover:bg-[#7C6BF5] disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* OAuth Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-[#EAE5E0] w-full" />
              <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-[#A39EAA] absolute">
                or
              </span>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 bg-white hover:bg-[#FAF8F5] border border-[#EAE5E0] text-[#24212B] font-medium text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>
        )}

        {/* VIEW 2: CREATE ACCOUNT */}
        {view === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            {/* Username */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[#4A4553]">Username</label>
                {usernameStatus.checking && (
                  <span className="text-[10px] text-[#827D8B] flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> checking...
                  </span>
                )}
                {!usernameStatus.checking && usernameStatus.available && (
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Available
                  </span>
                )}
                {!usernameStatus.checking && usernameStatus.error && (
                  <span className="text-[10px] text-rose-500">{usernameStatus.error}</span>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#A39EAA] text-xs font-mono">
                  @
                </span>
                <input
                  type="text"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value.toLowerCase())}
                  placeholder="unique_handle"
                  autoComplete="username"
                  required
                  className="w-full pl-8 pr-3 py-2 bg-[#FAF8F5] border border-[#EAE5E0] focus:border-[#8B7CF6] focus:bg-white rounded-xl text-sm text-[#24212B] outline-none transition-all placeholder:text-[#A39EAA]"
                />
              </div>
              <p className="text-[10px] text-[#A39EAA] mt-1">3–24 characters: lowercase, numbers, underscores</p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-[#4A4553] mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A39EAA]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  autoComplete="email"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#EAE5E0] focus:border-[#8B7CF6] focus:bg-white rounded-xl text-sm text-[#24212B] outline-none transition-all placeholder:text-[#A39EAA]"
                />
              </div>
              <p className="text-[10px] text-[#A39EAA] mt-1">Used for secure authentication and account recovery</p>
            </div>

            {/* Display Name (Optional) */}
            <div>
              <label className="block text-xs font-medium text-[#4A4553] mb-1">
                Display Name <span className="text-[#A39EAA] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={signupDisplayName}
                onChange={(e) => setSignupDisplayName(e.target.value)}
                placeholder="How friends call you (defaults to username)"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#EAE5E0] focus:border-[#8B7CF6] focus:bg-white rounded-xl text-sm text-[#24212B] outline-none transition-all placeholder:text-[#A39EAA]"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-[#4A4553] mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A39EAA]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  required
                  className="w-full pl-9 pr-10 py-2 bg-[#FAF8F5] border border-[#EAE5E0] focus:border-[#8B7CF6] focus:bg-white rounded-xl text-sm text-[#24212B] outline-none transition-all placeholder:text-[#A39EAA]"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#A39EAA] hover:text-[#4A4553]"
                >
                  {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength bar */}
              {signupPassword && (
                <div className="mt-1.5 space-y-1">
                  <div className="h-1 w-full bg-[#EAE5E0] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordEval.strength === 'strong'
                          ? 'w-full bg-emerald-500'
                          : passwordEval.strength === 'medium'
                          ? 'w-2/3 bg-amber-500'
                          : 'w-1/3 bg-rose-400'
                      }`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#827D8B]">Strength: {passwordEval.strength}</span>
                    <span className="text-[#A39EAA]">8+ chars, letters & numbers</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium text-[#4A4553] mb-1">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A39EAA]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#EAE5E0] focus:border-[#8B7CF6] focus:bg-white rounded-xl text-sm text-[#24212B] outline-none transition-all placeholder:text-[#A39EAA]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-[#8B7CF6] hover:bg-[#7C6BF5] disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Create Permanent Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* VIEW 3: FORGOT PASSWORD */}
        {view === 'forgot_password' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setView('signin');
                setForgotSuccess(false);
                setGeneralError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#827D8B] hover:text-[#24212B]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </button>

            <div>
              <h2 className="text-base font-bold text-[#24212B]">Reset your password</h2>
              <p className="text-xs text-[#827D8B] mt-1">
                Enter your account email and we'll send you a link to reset your password.
              </p>
            </div>

            {forgotSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Reset link dispatched</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  If an account exists for <strong>{forgotEmail}</strong>, instructions to reset your password have been sent.
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#4A4553] mb-1.5">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A39EAA]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      required
                      className="w-full pl-9 pr-3 py-2.5 bg-[#FAF8F5] border border-[#EAE5E0] focus:border-[#8B7CF6] focus:bg-white rounded-xl text-sm text-[#24212B] outline-none transition-all placeholder:text-[#A39EAA]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#8B7CF6] hover:bg-[#7C6BF5] disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send Reset Link</span>}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer / Offline Guest fallback & Backend Settings */}
        <div className="pt-2 border-t border-[#F0ECE6] flex items-center justify-between text-[11px] text-[#A39EAA]">
          <button
            type="button"
            onClick={handleGuestDemo}
            className="hover:text-[#24212B] hover:underline transition-colors"
          >
            Explore as Offline Guest
          </button>
          <button
            type="button"
            onClick={onOpenConfigModal}
            className="flex items-center gap-1 hover:text-[#8B7CF6] transition-colors"
          >
            <Database className="w-3 h-3" />
            <span>Supabase Config</span>
          </button>
        </div>
      </div>
    </div>
  );
};
