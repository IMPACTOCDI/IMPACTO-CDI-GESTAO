import React from 'react';

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ text, className = '' }) => {
  // Regex para identificar URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Função para verificar se uma string é uma URL válida
  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Função para renderizar o texto com links
  const renderText = () => {
    if (!text) return null;

    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (isValidUrl(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <p className={`whitespace-pre-line break-words ${className}`}>
      {renderText()}
    </p>
  );
}; 