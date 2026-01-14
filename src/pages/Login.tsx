import { useState, useEffect } from 'react';
import { getDiscordLoginUrl } from '../utils/fetch/auth';
import { fetchStatistics } from '../utils/fetch/data';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { useAuth } from '../hooks/auth/useAuth';
import Checkbox from '../components/common/Checkbox';
import Button from '../components/common/Button';

export default function Login() {
  const [agreed, setAgreed] = useState(false);
  const [stats, setStats] = useState({ registeredUsers: 0 });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuth();
  const callback = searchParams.get('callback');

  useEffect(() => {
    fetchStatistics().then((data) => {
      if (Array.isArray(data)) {
        setStats({ registeredUsers: Number(data[1]) || 0 });
      } else {
        setStats({
          registeredUsers:
            (data as { registeredUsers: number }).registeredUsers || 0,
        });
      }
    });
  }, []);

  const handleLogin = () => {
    if (agreed) {
      window.location.href = getDiscordLoginUrl(callback || undefined);
    }
  };

  if (user.user) {
    navigate('/');
    return null;
  }

  const buttonClass = agreed
    ? 'w-full py-4 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
    : 'w-full py-4 flex items-center justify-center gap-3 bg-gray-700 text-gray-400';

  return (
    <div className="min-h-screen bg-gray-950 text-white relative">
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-blue-400 hover:text-blue-200 transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
      </div>

      <div className="relative w-full h-80 md:h-110 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/assets/images/hero.webp"
            alt="Banner"
            className="object-cover w-full h-full scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/80 to-gray-950"></div>
        </div>

        <div className="relative h-full flex flex-col items-center justify-center px-6 md:px-10">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight text-center mb-6">
            SIGN IN
          </h1>
          <div className="flex items-center gap-1.5 px-6 py-2 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 rounded-full shadow-lg">
            <Users className="h-4 w-4 text-blue-400" />
            <span className="text-blue-400 text-sm font-semibold tracking-wider">
              {stats.registeredUsers.toLocaleString('de-DE')} REGISTERED USERS
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-md px-4 pb-8 relative z-10">
        <div className="bg-gray-900/70 backdrop-blur-md border border-gray-800 rounded-3xl p-8 space-y-6 shadow-2xl animate-fade-in">
          <Button
            onClick={handleLogin}
            disabled={!agreed}
            variant="primary"
            size="lg"
            className={buttonClass}
          >
            <FaDiscord className="w-6 h-6" />
            Sign In with Discord
          </Button>

          <hr className="w-full border-gray-700" />

          <div
            className={`w-full flex items-center border-2 border-blue-600 rounded-2xl px-5 py-4 gap-3 transition-all duration-200 shadow-sm
                      ${agreed ? 'bg-blue-600/30' : 'bg-blue-600/10'}
                      hover:shadow-blue-700/20 focus-within:shadow-blue-700/30`}
          >
            <Checkbox
              checked={agreed}
              onChange={setAgreed}
              label={
                <span className="text-sm">
                  I agree to the{' '}
                  <Link
                    to="https://terms.pfconnect.online"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline hover:text-blue-300 transition-colors"
                    tabIndex={0}
                  >
                    Terms of Use
                  </Link>
                  ,{' '}
                  <Link
                    to="https://privacy.pfconnect.online"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline hover:text-blue-300 transition-colors"
                    tabIndex={0}
                  >
                    Privacy Policy
                  </Link>
                  , and{' '}
                  <Link
                    to="https://cookies.pfconnect.online"
                    target="_blank"
                    rel="noreferrer"
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
    </div>
  );
}
