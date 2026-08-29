import { useState, useEffect } from "react";
import { getDiscordLoginUrl } from "../utils/fetch/auth";
import { fetchStatistics } from "../utils/fetch/data";
import { Link, useNavigate, useSearchParams } from "react-router";
import { TowerControl, Users } from "lucide-react";
import { FaDiscord } from "react-icons/fa";
import { useAuth } from "../hooks/auth/useAuth";
import Checkbox from "../components/common/Checkbox";
import Button from "../components/common/Button";

export default function Login() {
  const [agreed, setAgreed] = useState(false);
  const [stats, setStats] = useState({ registeredUsers: 0 });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuth();
  const callback = searchParams.get("callback");

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
    navigate("/");
    return null;
  }

  const buttonClass = agreed
    ? "w-full py-4 flex items-center justify-center gap-3"
    : "w-full py-4 flex items-center justify-center gap-3 pointer-events-none";

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative">
      <div className="absolute top-5 left-4 md:left-60 z-20">
        <div className="flex items-center space-x-4">
          <a href="/" className="flex items-center space-x-2">
            <TowerControl className="h-8 w-8 text-blue-400" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              PFControl
              {window.location.hostname === "canary.pfcontrol.com" && (
                <span className="bg-gradient-to-r from-blue-300 to-blue-500 bg-clip-text text-transparent italic text-md">
                  {" "}
                  Canary
                </span>
              )}
              {window.location.hostname === "localhost" && (
                <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent italic text-md">
                  {" "}
                  Developers
                </span>
              )}
            </span>
          </a>
        </div>
      </div>

      <div className="relative w-full h-80 md:h-110 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/assets/images/hero.webp"
            alt="Banner"
            className="object-cover w-full h-full scale-110"
          />
          <div className="absolute inset-0 bg-linear-to-b from-zinc-950/40 via-zinc-950/80 to-zinc-950"></div>
        </div>

        <div className="relative h-full flex flex-col items-center justify-center px-6 md:px-10">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight text-center mb-6">
            SIGN IN
          </h1>
          <div className="flex items-center gap-1.5 px-6 py-2 bg-blue-900 backdrop-blur-md border border-blue-900 rounded-full shadow-lg">
            <Users className="h-4 w-4 text-blue-200" />
            <span className="text-blue-200 text-sm font-semibold tracking-wider">
              {stats.registeredUsers.toLocaleString()} REGISTERED USERS
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-md px-4 pb-8 relative z-10">
        <div className="bg-zinc-900/70 backdrop-blur-md border border-zinc-800 rounded-[3rem] p-6 space-y-6 animate-fade-in">
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

          <hr className="w-full border-zinc-700" />

          <div
            className={`w-full flex items-center border-2 rounded-3xl px-5 py-4 gap-3 transition-all duration-200 shadow-sm
                      ${agreed ? "bg-blue-600/30 border-blue-600" : "bg-blue-600/10 border-blue-800"}
                      hover:shadow-blue-700/20 focus-within:shadow-blue-700/30`}
          >
            <Checkbox
              checked={agreed}
              onChange={setAgreed}
              label={
                <span className="text-sm">
                  I agree to the{" "}
                  <Link
                    to="https://cephie.app/legal/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline hover:text-blue-300 transition-colors"
                    tabIndex={0}
                  >
                    Terms of Use
                  </Link>
                  ,{" "}
                  <Link
                    to="https://cephie.app/legal/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline hover:text-blue-300 transition-colors"
                    tabIndex={0}
                  >
                    Privacy Policy
                  </Link>
                  , and{" "}
                  <Link
                    to="https://cephie.app/legal/cookies"
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

          <div className="flex w-full justify-center">
            <p className="text-xs text-zinc-500 text-center max-w-xs">
              PFControl is an independent service created by Cephie Studios and
              is not in any way affiliated with Project Flight.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
