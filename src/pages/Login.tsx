import { useState } from 'react';
import { getDiscordLoginUrl } from '../utils/fetch/auth';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { useAuth } from '../hooks/auth/useAuth';
import Checkbox from '../components/common/Checkbox';

export default function Login() {
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();
  const user = useAuth();

  const handleLogin = () => {
    if (agreed) {
      window.location.href = getDiscordLoginUrl();
    }
  };

  if (user.user) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-t from-black via-zinc-900 to-blue-950 px-4">
      <div className="absolute top-6 left-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-blue-400 hover:text-blue-200 transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
      </div>
      <div className="bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 border-2 border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col items-center animate-fade-in">
        <div className="w-16 h-16 flex items-center justify-center shadow-lg mb-2">
          <img src="/favicon.svg" alt="PFControl Logo" className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-extrabold text-blue-400 mb-10 text-center tracking-tight">
          Sign In
        </h1>

        <button
          onClick={handleLogin}
          disabled={!agreed}
          className={`w-full py-3 rounded-full font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg
                    ${
                      agreed
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
          style={{
            boxShadow: agreed
              ? '0 4px 24px 0 rgba(37, 99, 235, 0.15)'
              : undefined,
            cursor: agreed ? 'pointer' : 'not-allowed',
          }}
        >
          <FaDiscord className="w-6 h-6" />
          Sign In with Discord
        </button>
        <hr className="w-full border-zinc-700 mb-6 mt-6" />
        <div
          className={`w-full flex items-center mb-6 border-2 border-blue-600 rounded-2xl px-5 py-4 gap-3 transition-all duration-200 shadow-sm
                    ${agreed ? 'bg-blue-600/30' : 'bg-blue-600/10'}
                    hover:shadow-blue-700/20 focus-within:shadow-blue-700/30`}
        >
          <Checkbox
            checked={agreed}
            onChange={setAgreed}
            label={
              <span>
                I agree to the{' '}
                <Link
                  to="/terms"
                  className="text-blue-400 underline hover:text-blue-300 transition-colors"
                  tabIndex={0}
                >
                  Terms of Use
                </Link>
                ,{' '}
                <Link
                  to="/privacy"
                  className="text-blue-400 underline hover:text-blue-300 transition-colors"
                  tabIndex={0}
                >
                  Privacy Policy
                </Link>
                , and{' '}
                <Link
                  to="/cookies"
                  className="text-blue-400 underline hover:text-blue-300 transition-colors"
                  tabIndex={0}
                >
                  Cookies Policy
                </Link>
              </span>
            }
            className="flex-1"
          />
        </div>
        <p className="text-xs text-gray-500 text-center max-w-xs">
          PFConnect Studios is an independent service and is not in any way
          affiliated with Project Flight.
        </p>
      </div>
    </div>
  );
}
