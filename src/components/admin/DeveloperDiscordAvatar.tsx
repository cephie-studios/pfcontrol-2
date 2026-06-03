import { MdPeople } from 'react-icons/md';

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
  className = 'h-8 w-8',
}: Props) {
  if (avatar) {
    return (
      <img
        src={`https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`}
        alt={username}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${className} shrink-0 rounded-full bg-zinc-600 flex items-center justify-center`}
      aria-hidden
    >
      <MdPeople className="w-4 h-4 text-zinc-400" />
    </div>
  );
}
