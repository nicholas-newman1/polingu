import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

export function SignIn() {
  const { signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async () => {
    await signInWithGoogle();
    navigate('/app');
  };

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 rounded-3xl blur opacity-40" />
        <div className="relative bg-slate-800 border border-slate-700 rounded-3xl p-12 w-[420px] text-center">
          <h1 className="text-4xl font-light text-white tracking-tight mb-3">
            Polish Declension
          </h1>
          <p className="text-slate-400 mb-10 text-lg">
            Master Polish noun and pronoun endings
          </p>

          <button
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white hover:bg-slate-100 text-slate-800 font-medium rounded-xl transition-colors mb-6 cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
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
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-slate-800 text-slate-500">or</span>
            </div>
          </div>

          <Link
            to="/app"
            className="block w-full py-4 px-6 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
          >
            Continue without signing in
          </Link>

          <p className="text-slate-500 text-sm mt-8">
            Without an account, your progress won't be saved between sessions
          </p>
        </div>
      </div>
    </div>
  );
}
