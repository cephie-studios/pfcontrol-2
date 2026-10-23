import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { cn } from '@/lib/utils';

export const CHAT_PANEL_BG = 'bg-[#131316]';
export const CHAT_PANEL_FADE = 'from-[#131316]';

export const COMPOSER_BAR_CLASS =
  'flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/90 p-1 pl-4 shadow-2xl shadow-black/60 backdrop-blur transition-colors focus-within:border-blue-600';

export const COMPOSER_BOX_CLASS =
  'flex flex-col gap-1 rounded-[20px] border-2 border-zinc-800 bg-zinc-950/90 p-1.5 shadow-2xl shadow-black/60 backdrop-blur transition-colors focus-within:border-blue-600';

export const COMPOSER_TEXTAREA_CLASS =
  'w-full resize-none bg-transparent px-2 pt-1 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50';

export const COMPOSER_INPUT_CLASS =
  'h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-transparent';

export function ComposerSendButton({
  sending = false,
  disabled,
  onClick,
  className,
}: {
  sending?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Button
      type={onClick ? 'button' : 'submit'}
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled || sending}
      className={cn('shrink-0 rounded-full', SIGNATURE_TONES.blue, className)}
    >
      {sending ? <Loader2 className="animate-spin" /> : <Send />}
      Send
    </Button>
  );
}
