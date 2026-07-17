export type TourPlacement = 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface AppTourStep {
  id: string;
  /** data-tour attribute value */
  target?: string;
  /** Navigate before showing this step */
  route?: string;
  title: string;
  description: string;
  placement?: TourPlacement;
}

export const APP_TOUR_STEPS: AppTourStep[] = [
  {
    id: 'welcome',
    route: '/dashboard',
    title: 'Добро пожаловать в WOWFIT!',
    description:
      'Короткий тур по приложению: покажем главное и куда нажимать. Можно листать кнопкой «Дальше».',
    placement: 'center',
  },
  {
    id: 'calendar',
    target: 'week-calendar',
    route: '/dashboard',
    title: 'Календарь недели',
    description:
      'Здесь видно, как прошла неделя: выполненные дни, пропуски и отдых.',
    placement: 'bottom',
  },
  {
    id: 'streak',
    target: 'streak-widget',
    route: '/dashboard',
    title: 'Дни в ударе — огонёк мотивации',
    description:
      'Считает дни подряд, когда вы выполняли план. Чем больше дней в ударе, тем круче результат!',
    placement: 'left',
  },
  {
    id: 'today-plan',
    target: 'today-plan',
    route: '/dashboard',
    title: 'План на сегодня',
    description:
      'Список челленджей на сегодня. Нажмите на карточку — откроются упражнения и можно начать выполнение.',
    placement: 'top',
  },
  {
    id: 'nav-challenges',
    target: 'nav-challenges',
    route: '/dashboard',
    title: 'Раздел Челленджи',
    description:
      'Здесь создают челленджи и управляют ими. Сейчас перейдём туда — нажмите «Дальше».',
    placement: 'auto',
  },
  {
    id: 'create-challenge',
    target: 'create-challenge',
    route: '/challenges?tab=individual',
    title: 'Создать челлендж',
    description:
      'Нажмите эту кнопку, чтобы создать индивидуальный челлендж: упражнения, расписание и сроки.',
    placement: 'bottom',
  },
  {
    id: 'challenge-tabs',
    target: 'challenge-tabs',
    route: '/challenges?tab=individual',
    title: 'Три типа челленджей',
    description:
      'Индивидуальные — ваши личные. Групповые — публичные и совместные. Архив — завершённые.',
    placement: 'bottom',
  },
  {
    id: 'nav-profile',
    target: 'nav-profile',
    title: 'Профиль',
    description: 'Статистика, рекорды и настройки аккаунта — всё в этом разделе.',
    placement: 'auto',
  },
  {
    id: 'profile-stats',
    target: 'profile-stats',
    route: '/settings',
    title: 'Ваша статистика',
    description:
      'Объём упражнений за всё время, дни в ударе, рекорд и график активности за 7 дней. Карандаш — редактирование профиля.',
    placement: 'auto',
  },
  {
    id: 'finish',
    route: '/dashboard',
    title: 'Готово!',
    description: 'Создайте первый челлендж или откройте план на сегодня. Удачных тренировок!',
    placement: 'center',
  },
];
