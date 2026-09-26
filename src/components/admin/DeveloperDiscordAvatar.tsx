import { User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type Props = {
  userId: string;
  username: string;
  avatar?: string | null;
  className?: string;
};

export default function DeveloperDiscordAvatar({
  userId,
  username,
  avatar,
  className = 'size-8',
}: Props) {
  return (
    <Avatar className={cn('border', className)}>
      {avatar ? (
        <AvatarImage
          src={`https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`}
          alt={username}
          className="object-cover"
        />
      ) : null}
      <AvatarFallback aria-hidden>
        <User className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}
