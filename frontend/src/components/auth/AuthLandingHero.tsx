import { useState } from 'react';
import { AuthBrandMark } from './AuthBrandMark.tsx';

const FEATURES = [
  'создавайте соревнования или участвуйте в чужих',
  'отслеживайте приседания, отжимания и планку',
];

export function AuthLandingHero() {
  const [gifReady, setGifReady] = useState(false);

  return (
    <div className="flex flex-col items-center text-center w-full max-w-md mx-auto">
      <AuthBrandMark className="mb-8 sm:mb-10" />

      <p className="text-base sm:text-lg text-neutral-text leading-relaxed mb-8 sm:mb-10 px-2">
        Поддерживайте форму даже вне занятий с тренером
      </p>

      <div className="w-full aspect-[4/3] rounded-3xl overflow-hidden bg-gradient-to-br from-violet-300 via-fuchsia-200 to-purple-300 shadow-card mb-8 sm:mb-10 relative">
        {!gifReady && (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-400/40 via-fuchsia-300/30 to-purple-400/40" />
        )}
        <img
          src="/auth/hero.gif"
          alt=""
          className={`w-full h-full object-cover ${gifReady ? 'block' : 'hidden'}`}
          onLoad={() => setGifReady(true)}
          onError={() => setGifReady(false)}
        />
      </div>

      <ul className="w-full space-y-3 text-left text-sm sm:text-base text-neutral-text">
        {FEATURES.map((text) => (
          <li key={text} className="flex gap-3 leading-snug">
            <span className="text-brand font-bold mt-0.5">•</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
