import { useState, useEffect, useRef } from 'react';
import { getDiscordLoginUrl } from '../utils/fetch/auth';
import { fetchStatistics } from '../utils/fetch/data';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Loader2, TowerControl, Users } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { toast } from 'sonner';
import { useAuth } from '../hooks/auth/useAuth';
import PageHero from '../components/common/PageHero';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { cn } from '@/lib/utils';

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Discord sign-in was cancelled.',
  missing_code:
    'Discord did not return an authorization code. Please try again.',
  auth_failed: 'Sign-in failed. Please try again.',
  discord_error: 'Discord rejected the sign-in request. Please try again.',
  rate_limited: 'Too many sign-in attempts. Please try again in a few minutes.',
};

const LEGAL_LINK_CLASS =
  'cursor-pointer text-blue-400 underline underline-offset-2 transition-colors hover:text-blue-300';

export default function Login() {
  const [agreed, setAgreed] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [stats, setStats] = useState({ registeredUsers: 0 });
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuth();
  const callback = searchParams.get('callback');
  const handledErrorParam = useRef(false);

  useEffect(() => {
    if (handledErrorParam.current) return;
    const error = searchParams.get('error');
    if (!error) return;
    handledErrorParam.current = true;

    toast.error(
      LOGIN_ERROR_MESSAGES[error] ?? LOGIN_ERROR_MESSAGES.auth_failed
    );

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('error');
        return next;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);

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

  useEffect(() => {
    const reset = () => setRedirecting(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  const handleLogin = () => {
    if (!agreed) return;
    setRedirecting(true);
    window.location.href = getDiscordLoginUrl(callback || undefined);
  };

  if (user.user) {
    navigate('/');
    return null;
  }

  return (
    <div className="shadcn-scope relative min-h-screen bg-background text-foreground">
      <div className="absolute top-5 left-4 z-20 md:left-60">
        <a href="/" className="flex cursor-pointer items-center gap-2">
          <TowerControl className="size-8 text-blue-400" />
          <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-2xl font-bold text-transparent">
            PFControl
            {window.location.hostname === 'canary.pfcontrol.com' && (
              <span className="bg-gradient-to-r from-blue-300 to-blue-500 bg-clip-text text-md text-transparent italic">
                {' '}
                Canary
              </span>
            )}
            {window.location.hostname === 'localhost' && (
              <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-md text-transparent italic">
                {' '}
                Developers
              </span>
            )}
          </span>
        </a>
      </div>

      <PageHero
        title="SIGN IN"
        className="h-svh min-h-[36rem] md:h-svh"
        overlayClassName="from-background/75 via-background/90 via-55% to-background to-85%"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-200 tabular-nums">
          <Users className="size-4 text-blue-400" />
          {stats.registeredUsers.toLocaleString()} registered users
        </div>

        <div className="mt-4 flex w-full max-w-sm flex-col gap-6">
          <Button
            variant="ghost"
            size="lg"
            onClick={handleLogin}
            disabled={!agreed || redirecting}
            className={cn(
              'h-12 w-full text-base',
              SIGNATURE_TONES.blue,
              '[&_svg]:size-5'
            )}
          >
            {redirecting ? <Loader2 className="animate-spin" /> : <FaDiscord />}
            Sign in with Discord
          </Button>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
            <Checkbox
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5 cursor-pointer"
            />
            <span className="select-none">
              I agree to the{' '}
              <Link
                to="https://cephie.app/legal/terms"
                target="_blank"
                rel="noreferrer"
                className={LEGAL_LINK_CLASS}
              >
                Terms of Use
              </Link>
              ,{' '}
              <Link
                to="https://cephie.app/legal/privacy"
                target="_blank"
                rel="noreferrer"
                className={LEGAL_LINK_CLASS}
              >
                Privacy Policy
              </Link>
              , and{' '}
              <Link
                to="https://cephie.app/legal/cookies"
                target="_blank"
                rel="noreferrer"
                className={LEGAL_LINK_CLASS}
              >
                Cookies Policy
              </Link>
            </span>
          </label>

          <p className="text-center text-xs text-zinc-500">
            PFControl is an independent service created by Cephie Studios and is
            not in any way affiliated with Project Flight.
          </p>
        </div>
      </PageHero>
    </div>
  );
}
