import React, { useState } from 'react';
import {
  Activity,
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Building2,
  Droplet,
  Wind,
  Truck,
  Stethoscope,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';

interface AuthPageProps {
  initialMode?: 'login' | 'signup' | 'forgot';
  onNavigateHome: () => void;
  onSuccessRedirect?: (role: UserRole) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onNavigateHome,
  onSuccessRedirect
}) => {
  const { login, signup, resetPassword, error: authError } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Exclude<UserRole, 'admin'>>('patient');
  const [hospitalAffiliation, setHospitalAffiliation] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Forgot password form state
  const [resetEmail, setResetEmail] = useState('');

  const publicRoles: Array<{
    role: Exclude<UserRole, 'admin'>;
    title: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      role: 'patient',
      title: 'Patient / Attendant',
      description: 'Request beds, blood, oxygen, or ambulances during an emergency',
      icon: <User className="w-5 h-5 text-teal-600" />
    },
    {
      role: 'hospital',
      title: 'Hospital Facility',
      description: 'Manage bed & ICU capacity, review patient admission requests',
      icon: <Building2 className="w-5 h-5 text-blue-600" />
    },
    {
      role: 'bloodBank',
      title: 'Blood Bank',
      description: 'Manage blood group inventory and fulfill emergency unit requests',
      icon: <Droplet className="w-5 h-5 text-rose-600" />
    },
    {
      role: 'oxygenProvider',
      title: 'Oxygen Depot',
      description: 'Manage cylinder & concentrator stock and emergency delivery',
      icon: <Wind className="w-5 h-5 text-sky-600" />
    },
    {
      role: 'ambulanceProvider',
      title: 'Ambulance Service',
      description: 'Manage emergency fleet and dispatch drivers with live tracking',
      icon: <Truck className="w-5 h-5 text-amber-600" />
    },
    {
      role: 'doctor',
      title: 'Physician / Medical Staff',
      description: 'Affiliated hospital staff viewing assigned cases & clinical notes',
      icon: <Stethoscope className="w-5 h-5 text-emerald-600" />
    }
  ];

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessNotice(null);

    if (!loginEmail.trim() || !loginPassword) {
      setFormError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    const success = await login(loginEmail.trim(), loginPassword, rememberMe);
    setIsSubmitting(false);

    if (success) {
      if (onSuccessRedirect) {
        // Handled automatically by AuthContext
      }
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessNotice(null);

    if (!fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (signupPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please verify.');
      return;
    }
    if (!agreeTerms) {
      setFormError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsSubmitting(true);
    const result = await signup({
      email: signupEmail.trim(),
      pass: signupPassword,
      displayName: fullName.trim(),
      role: selectedRole,
      phone: phone.trim(),
      hospitalAffiliation: hospitalAffiliation.trim()
    });
    setIsSubmitting(false);

    if (result.success) {
      setSuccessNotice(
        'Account created successfully! A verification email has been dispatched to your inbox.'
      );
    } else if (result.error) {
      setFormError(result.error);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessNotice(null);

    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    const res = await resetPassword(resetEmail.trim());
    setIsSubmitting(false);

    if (res.success) {
      setSuccessNotice(
        'Password reset link has been dispatched to your email address. Please check your inbox and spam folder.'
      );
    } else {
      setFormError(res.error || 'Failed to send password reset email.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onNavigateHome}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0D9488] to-[#0284C7] p-2 flex items-center justify-center shadow-xs">
            <Activity className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Care<span className="text-teal-600">Bridge</span>
            </span>
            <span className="text-xs text-slate-400 ml-2 hidden sm:inline">Healthcare Platform</span>
          </div>
        </div>

        <button
          onClick={onNavigateHome}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Public Website
        </button>
      </header>

      {/* Main Form Center Box */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-200">
          {/* Form Header Tabs */}
          <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-6 text-center">
            {mode === 'forgot' ? (
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Reset Your Password</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your registered email address to receive password recovery instructions.
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {mode === 'login' ? 'Sign In to CareBridge' : 'Register a New Account'}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {mode === 'login'
                    ? 'Access emergency coordination, capacity management, and live dispatches'
                    : 'Join the verified emergency healthcare coordination network'}
                </p>

                {/* Pill Switcher */}
                <div className="flex items-center justify-center max-w-xs mx-auto mt-4 bg-slate-200/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setFormError(null);
                      setSuccessNotice(null);
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      mode === 'login'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setFormError(null);
                      setSuccessNotice(null);
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      mode === 'signup'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            {/* Error Message */}
            {(formError || authError) && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <span className="leading-relaxed">{formError || authError}</span>
              </div>
            )}

            {/* Success Message */}
            {successNotice && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span className="leading-relaxed">{successNotice}</span>
              </div>
            )}

            {/* ===================== LOGIN FORM ===================== */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="name@organization.org"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setFormError(null);
                        setSuccessNotice(null);
                      }}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
                    />
                    <span>Keep me signed in on this device</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center text-xs text-slate-500 pt-2">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setFormError(null);
                    }}
                    className="font-bold text-teal-700 hover:underline"
                  >
                    Register here
                  </button>
                </div>
              </form>
            )}

            {/* ===================== SIGNUP FORM ===================== */}
            {mode === 'signup' && (
              <form onSubmit={handleSignupSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Full Name / Facility Title</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Dr. Priya Deshmukh or KIMS Super Specialty"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="contact@domain.org"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-500 text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        placeholder="+91 98450 12345"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-500 text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Account Type / Role Selection (Strictly No Admin) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Account Type (Select Role)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {publicRoles.map((r) => (
                      <div
                        key={r.role}
                        onClick={() => setSelectedRole(r.role)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          selectedRole === r.role
                            ? 'border-teal-600 bg-teal-50/70 shadow-xs ring-1 ring-teal-600'
                            : 'border-slate-200 bg-slate-50 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {r.icon}
                          <span className="text-xs font-bold text-slate-900 leading-tight">
                            {r.title}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                          {r.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedRole === 'doctor' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Hospital Affiliation</label>
                    <input
                      type="text"
                      placeholder="e.g. KIMS Super Specialty Hospital"
                      value={hospitalAffiliation}
                      onChange={(e) => setHospitalAffiliation(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                )}

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="At least 6 characters"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-500 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-500 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Terms Checkbox */}
                <div className="flex items-start gap-2.5 pt-1 text-xs">
                  <input
                    type="checkbox"
                    id="terms-check"
                    required
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
                  />
                  <label htmlFor="terms-check" className="text-slate-600 leading-relaxed cursor-pointer">
                    I acknowledge that CareBridge coordinates verified healthcare resources and agree to the{' '}
                    <span className="text-teal-700 font-semibold underline">Terms of Service</span> and{' '}
                    <span className="text-teal-700 font-semibold underline">Privacy Policy</span>.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center text-xs text-slate-500 pt-1">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setFormError(null);
                    }}
                    className="font-bold text-teal-700 hover:underline"
                  >
                    Sign in here
                  </button>
                </div>
              </form>
            )}

            {/* ===================== FORGOT PASSWORD ===================== */}
            {mode === 'forgot' && (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Your Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="account@hospital.org"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-500 text-slate-900"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Send Password Reset Email</span>
                  )}
                </button>

                <div className="text-center text-xs text-slate-500 pt-2">
                  Remembered your credentials?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setFormError(null);
                    }}
                    className="font-bold text-teal-700 hover:underline"
                  >
                    Return to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="text-center py-4 text-xs text-slate-400 border-t border-slate-200">
        CareBridge Healthcare Platform • Protected by Cloud Security • National Emergency Dial 108/112
      </footer>
    </div>
  );
};

