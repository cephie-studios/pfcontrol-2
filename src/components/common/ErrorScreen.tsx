import Button from './Button';

interface ErrorScreenProps {
  title: string;
  message: string;
  onRetry: () => void;
  className?: string;
}

export default function ErrorScreen({
  title,
  message,
  onRetry,
  className = '',
}: ErrorScreenProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="text-red-400 mb-2 text-lg font-semibold">{title}</div>
      <div className="text-zinc-400 text-sm mb-4">{message}</div>
      <Button onClick={onRetry} variant="outline" size="sm">
        Retry
      </Button>
    </div>
  );
}
