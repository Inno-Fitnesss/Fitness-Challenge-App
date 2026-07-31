import { X } from 'lucide-react';

/** Ключ в users.ui_flags: инструкцию после подключения показываем один раз.
 * Отсутствие ключа = не показывали, поэтому у всех существующих пользователей
 * он сейчас не выставлен и никакой миграции не требуется. */
export const WITHINGS_SETUP_FLAG = 'withings_setup_seen';

/** Подключение по OAuth даёт нам доступ к аккаунту Withings, но шаги в него
 * попадают только из мобильного приложения — без установленного и настроенного
 * Withings на телефоне подключение остаётся пустым. Поэтому инструкция живёт
 * отдельным компонентом: её открывает и виджет шагов (кнопкой «?»), и профиль
 * сразу после возврата с OAuth. */
const SETUP_STEPS: { title: string; text: string }[] = [
  {
    title: 'Установи приложение Withings',
    text: 'Найди приложение «Withings» (раньше называлось Health Mate) в App Store на iPhone или в Google Play на Android и установи его — оно бесплатное.',
  },
  {
    title: 'Войди в тот же аккаунт',
    text: 'Авторизуйся в приложении под тем же аккаунтом Withings, который ты подключил здесь. Если аккаунта ещё нет — зарегистрируйся, а потом заново нажми «Подключить Withings».',
  },
  {
    title: 'Включи подсчёт шагов телефоном',
    text: 'При первом запуске выбери отслеживание активности телефоном (отдельное устройство не нужно) и разреши доступ к движению: «Движение и фитнес» на iPhone, «Физическая активность» на Android.',
  },
  {
    title: 'Носи телефон с собой',
    text: 'Приложение считает шаги в фоне через сенсоры телефона и отправляет их в Withings. Держи приложение установленным и не запрещай ему работу в фоне.',
  },
  {
    title: 'Готово',
    text: 'Шаги появятся здесь автоматически. Небольшая задержка синхронизации — это нормально; можно нажать «Обновить», чтобы подтянуть свежие данные вручную.',
  },
];

interface WithingsSetupModalProps {
  onClose: () => void;
  /** Заголовок меняется, когда шторку открывают сразу после подключения —
   * там это не справка «как настроить», а следующий обязательный шаг. */
  variant?: 'help' | 'just-connected';
}

export function WithingsSetupModal({ onClose, variant = 'help' }: WithingsSetupModalProps) {
  const justConnected = variant === 'just-connected';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 top-0 h-[100dvh] flex items-center justify-center modal-safe-x py-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg max-h-[92dvh] overflow-y-auto overflow-x-hidden bg-white rounded-3xl shadow-modal p-6 sm:p-8"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h2 className="text-lg font-bold text-neutral-text">
                {justConnected
                  ? 'Withings подключён — остался один шаг'
                  : 'Как настроить приложение Withings'}
              </h2>
              <p className="text-xs text-neutral-muted mt-1">
                {justConnected
                  ? 'Аккаунт привязан, но шаги пойдут только после того, как приложение на телефоне начнёт их отправлять.'
                  : 'Подключение выше даёт нам доступ к твоим шагам. Чтобы они начали считаться, установи и настрой само приложение на телефоне.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="shrink-0 p-2 rounded-xl text-neutral-muted hover:text-neutral-secondary hover:bg-neutral-card transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <ol className="mt-5 space-y-4">
            {SETUP_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-brand/10 text-brand text-sm font-bold">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-text">{step.title}</p>
                  <p className="text-sm text-neutral-muted mt-0.5">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          {justConnected && (
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors"
            >
              Понятно
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
