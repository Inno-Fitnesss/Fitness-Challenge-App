export const WITHINGS_GUIDE_TITLE = 'Как подключить шаги к Withings?';

export const WITHINGS_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.withings.wiscale2';
export const WITHINGS_APP_STORE_URL = 'https://apps.apple.com/us/app/withings/id542701020';

export interface WithingsGuideStep {
  description: string;
  /** Дополнительная строка акцентного цвета (например "Готово!"), если нужна. */
  highlight?: string;
  /** Путь к скриншоту-иллюстрации шага. Отсутствует у шага со скачиванием приложения. */
  image?: string;
  /** Первый шаг вместо картинки показывает иконку Withings + кнопки скачивания. */
  showDownloadButtons?: boolean;
}

export const WITHINGS_GUIDE_STEPS: WithingsGuideStep[] = [
  {
    description: 'Скачайте приложение Withings',
    showDownloadButtons: true,
  },
  {
    description: 'Войдите в свой аккаунт',
    image: '/images/withings-guide/step-2-login.png',
  },
  {
    description:
      'Во вкладке «Поделиться» выберите приложение «Здоровье», которое считает шаги на вашем телефоне',
    image: '/images/withings-guide/step-3-connect.png',
  },
  {
    description: 'Следуя инструкциям, свяжите приложения.',
    highlight: 'Готово! Теперь шаги будут видны в WowFit',
    image: '/images/withings-guide/step-4-done.png',
  },
];
