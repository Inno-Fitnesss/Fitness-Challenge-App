import { AuthBrandMark } from './AuthBrandMark.tsx';
import { AuthExerciseShowcase } from './AuthExerciseShowcase.tsx';
import { AuthStaggeredFeatures } from './AuthStaggeredFeatures.tsx';

const FEATURES = [
  'создавайте челленджи или участвуйте в чужих',
  'отслеживайте приседания, отжимания и планку',
];

export function AuthLandingHero() {
  return (
    <div className="flex flex-col items-center text-center w-full max-w-lg mx-auto">
      <AuthBrandMark className="mb-8 sm:mb-10" />

      <p className="text-base sm:text-lg text-neutral-text leading-relaxed mb-8 sm:mb-10 px-2">
        Поддерживайте форму даже вне занятий с тренером
      </p>

      <AuthExerciseShowcase className="w-full max-w-xl mb-8 sm:mb-10" />

      <AuthStaggeredFeatures features={FEATURES} animationKey={0} className="w-full" />
    </div>
  );
}
