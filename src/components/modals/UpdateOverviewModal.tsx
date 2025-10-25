import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Button from '../common/Button';
import { useEffect } from 'react';

interface UpdateOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  bannerUrl?: string | null;
}

export default function UpdateOverviewModal({
  isOpen,
  onClose,
  title,
  content,
  bannerUrl,
}: UpdateOverviewModalProps) {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="relative flex-shrink-0">
          {bannerUrl && (
            <div className="w-full h-48 overflow-hidden rounded-t-2xl">
              <img
                src={bannerUrl}
                alt="Update banner"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="absolute top-4 right-4">
            <button
              onClick={onClose}
              className="bg-zinc-800/80 hover:bg-zinc-700 p-2 rounded-full transition-colors backdrop-blur-sm"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-zinc-300" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {title}
          </h2>

          <div className="prose prose-invert prose-cyan max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-cyan-400 mt-6 mb-3">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-bold text-cyan-400 mt-5 mb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold text-cyan-300 mt-4 mb-2">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-zinc-300 mb-3 leading-relaxed">
                    {children}
                  </p>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    {children}
                  </a>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-zinc-300 mb-3 space-y-1">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-zinc-300 mb-3 space-y-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-zinc-300">{children}</li>
                ),
                code: ({ className, children }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-zinc-800 text-cyan-400 px-1.5 py-0.5 rounded text-sm">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className="block bg-zinc-800 text-cyan-400 p-3 rounded-lg overflow-x-auto text-sm">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="bg-zinc-800 rounded-lg overflow-x-auto mb-3">
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-cyan-500 pl-4 italic text-zinc-400 my-3">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="border-zinc-700 my-4" />,
                strong: ({ children }) => (
                  <strong className="font-bold text-white">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-zinc-300">{children}</em>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer - Always visible */}
        <div className="border-t border-zinc-700 p-6 bg-zinc-900/50 flex-shrink-0">
          <Button
            onClick={onClose}
            variant="primary"
            size="lg"
            className="w-full"
          >
            Cool!
          </Button>
        </div>
      </div>
    </div>
  );
}
