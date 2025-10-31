import React from 'react';

export function linkify(text: string): React.ReactNode {
  // Regex to match URLs starting with http:// or https:// and containing at least one dot
  const urlRegex = /(https?:\/\/[^\s]+\.[^\s]+?)(?=[.,;:!?)}\]]*(?:\s|$))/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-70 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
