function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-text mb-2">{title}</h1>
        <p className="text-neutral-secondary">Скоро будет доступно</p>
      </div>
    </div>
  );
}

export function ProfilePage() {
  return <PlaceholderPage title="Профиль" />;
}

export function ExercisesPage() {
  return <PlaceholderPage title="Упражнения" />;
}
