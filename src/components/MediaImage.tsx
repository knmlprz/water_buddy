import { useState } from 'react';
import { Sprout } from 'lucide-react';

interface MediaImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function MediaImage({ src, alt, className = '', fallbackLabel }: MediaImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#E4EFE8] via-[#F2F6F3] to-[#DCE8E0] text-[#1B5E4A] p-6 text-center ${className}`}
      >
        <Sprout className="w-8 h-8 opacity-75" aria-hidden="true" />
        {fallbackLabel && <span className="text-xs font-medium">{fallbackLabel}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
