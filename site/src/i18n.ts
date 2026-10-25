// All site text in Russian and English. The site picks the visitor's browser language
// and remembers the choice from the RU/EN switch.
import { createContext, useContext } from 'react'
import { SIZE_MB, VERSION } from './config'

const ru = {
  nav: { features: 'Возможности', shots: 'Скриншоты', safety: 'Безопасность', faq: 'Вопросы', download: 'Скачать' },
  hero: {
    badge: `Бесплатно · Windows 10/11 · v${VERSION}`,
    title1: 'Ускорь ПК для игр',
    title2: 'в 1 клик',
    text: 'IceBoost чистит мусор, настраивает Windows для игр и показывает, что тормозит компьютер. Каждое изменение можно вернуть одной кнопкой.',
    cta: 'Скачать для Windows',
    note: `Бесплатно · ~${SIZE_MB} МБ · установка за минуту`,
    portable: 'Портативная версия (без установки)',
    pcOnly: 'Это программа для ПК — открой сайт на компьютере, чтобы скачать.',
    look: 'Как это выглядит'
  },
  stats: [
    { n: '16', t: 'настроек для игр и Windows' },
    { n: '8', t: 'видов мусора' },
    { n: '18', t: 'достижений' },
    { n: '1', t: 'клик до оптимизации' }
  ],
  features: {
    title: 'Всё, что нужно геймеру',
    text: 'Без лишних кнопок и непонятных слов — каждая функция объяснена по-человечески.',
    list: {
      stand: { t: '3D-стенд твоего ПК', d: 'Твой комп в 3D: доставай любую деталь, меняй её и смотри, сколько станет FPS в играх, сколько это стоит и подойдёт ли. Есть советник «что купить на N ₽».' },
      oneClick: { t: 'Оптимизация в 1 клик', d: 'Создаёт точку восстановления, чистит мусор и включает рекомендованные настройки. Одной кнопкой.' },
      boost: { t: 'Ускорение игр', d: 'Игровой режим, без фоновой записи Xbox, максимальная производительность, ровный прицел — 16 настроек с понятным описанием.' },
      space: { t: 'Место для новой игры', d: 'Удобно удаляет программы и игры (даже несколько сразу), показывает, что давно не запускалось, и находит большие старые файлы и копии.' },
      cleaner: { t: 'Очистка мусора', d: 'Временные файлы, кэш браузеров, Discord, Steam и шейдеров. Пароли, вкладки и личные файлы не трогаем.' },
      gpu: { t: 'Видеокарта под присмотром', d: 'Температура, напряжение и вентилятор в реальном времени. Если станет опасно — уведомление прямо во время игры.' },
      gameTime: { t: '«Я сажусь играть»', d: 'Закрывает программы, которые едят память и видеокарту, пока ты играешь.' },
      startup: { t: 'Автозагрузка', d: 'Показывает, что запускается вместе с Windows, и подсказывает, что можно смело выключить.' }
    }
  },
  shots: {
    title: 'Посмотри сам',
    text: 'Тёмная тема, снег и никакой рекламы.',
    tabs: {
      dashboard: { t: 'Главная', d: 'Состояние ПК в баллах и список того, что можно улучшить.' },
      stand: { t: 'Стенд', d: 'Твой ПК в 3D: замени видеокарту — и сразу видно новый FPS в твоих играх и цену апгрейда.' },
      boost: { t: 'Ускорение игр', d: 'У каждой настройки подписано, что она делает и насколько она «сильная».' },
      cleaner: { t: 'Очистка', d: 'Видно, сколько мусора и где. Запущенные программы пропускаются.' },
      space: { t: 'Место на диске', d: 'Удаление программ и игр, большие старые файлы и копии. Видно, сколько места станет для новой игры.' },
      achievements: { t: 'Достижения', d: 'Опыт, уровни и 18 достижений — заботиться о ПК весело.' }
    }
  },
  mascot: {
    name: 'Айсик',
    title: 'Знакомься: Айсик',
    text: 'Кубик льда, который живёт в программе. Когда ПК в плохом состоянии — Айсик тает. Когда всё идеально — надевает очки.',
    click: 'Кликни по нему 👇',
    moods: { bad: 'Тает', ok: 'Так себе', good: 'Хорошо', great: 'Идеально' },
    ranksTitle: 'Ранги',
    ranks: ['Новичок', 'Чистильщик', 'Оптимизатор', 'Мастер FPS', 'Ледяной гуру', 'Легенда IceBoost'],
    secretHint: 'Говорят, если кликнуть по Айсику 7 раз подряд, начнётся метель…',
    lines: [
      'Привет! Я Айсик ❄️',
      'Я слежу за процессором 👀',
      'Перезагрузка — лучшее лекарство 🩹',
      'Ты знал, что я кубик льда? Теперь знаешь',
      'Тыкни меня ещё… или не надо',
      'Чем меньше автозагрузки — тем быстрее старт 🚀',
      'Скачай меня, я не кусаюсь 😎'
    ],
    secret: 'МЕТЕЛЬ!!! ❄️❄️❄️ Ты нашёл секрет!'
  },
  safety: {
    title: 'Честно и безопасно',
    text: 'IceBoost не делает ничего за твоей спиной.',
    list: [
      { t: 'Копия перед каждым изменением', d: 'Программа запоминает старые настройки, а кнопка «Вернуть всё как было» возвращает их.' },
      { t: 'Точка восстановления', d: 'Перед сильными настройками IceBoost предложит создать точку восстановления Windows — на всякий случай.' },
      { t: 'Без фейковых трюков', d: 'Никакой «очистки оперативки» и обещаний «+200 FPS». Только то, что реально работает.' },
      { t: 'Системное не трогаем', d: 'Важные процессы Windows нельзя закрыть даже случайно. Личные файлы и пароли очистка обходит стороной.' },
      { t: 'Без интернета и рекламы', d: 'Программа работает офлайн, ничего никуда не отправляет и не показывает рекламу.' }
    ]
  },
  faq: {
    title: 'Вопросы',
    list: [
      { q: 'Это правда бесплатно?', a: 'Да, полностью. Без подписок, рекламы и «PRO-версии».' },
      {
        q: 'Windows пишет «Система Windows защитила ваш компьютер». Это вирус?',
        a: 'Нет. Так Windows встречает новые программы без платной цифровой подписи. Нажми «Подробнее» → «Выполнить в любом случае».'
      },
      { q: 'Зачем программе права администратора?', a: 'Без них нельзя менять настройки Windows и чистить системные папки. Поэтому при запуске Windows спросит разрешение.' },
      { q: 'Можно вернуть всё как было?', a: 'Да. В разделе «Ускорение игр» есть кнопка «Вернуть всё как было», а перед сильными настройками создаётся точка восстановления.' },
      {
        q: 'Не удалит ли IceBoost что-то нужное?',
        a: 'Файлы сначала попадают в корзину — их можно вернуть. Windows, папки программ и системные папки защищены, а программы удаляются их собственным удалятором, как в параметрах Windows.'
      },
      { q: 'Какая нужна Windows?', a: 'Windows 10 или 11, 64-бит.' },
      { q: 'Как удалить?', a: 'Как любую программу: Параметры → Приложения → IceBoost → Удалить.' }
    ]
  },
  final: { title: 'Готов к игре?', text: 'Скачай IceBoost и проверь свой ПК за минуту.' },
  footer: { made: 'Сделал Айсинг', all: 'Все версии' }
}

const en: typeof ru = {
  nav: { features: 'Features', shots: 'Screenshots', safety: 'Safety', faq: 'FAQ', download: 'Download' },
  hero: {
    badge: `Free · Windows 10/11 · v${VERSION}`,
    title1: 'Boost your PC for gaming',
    title2: 'in 1 click',
    text: 'IceBoost cleans junk, tunes Windows for games and shows what slows your PC down. Every change can be undone with one button.',
    cta: 'Download for Windows',
    note: `Free · ~${SIZE_MB} MB · installs in a minute`,
    portable: 'Portable version (no install)',
    pcOnly: 'It’s a PC app — open this site on your computer to download it.',
    look: 'See it in action'
  },
  stats: [
    { n: '16', t: 'game & Windows tweaks' },
    { n: '8', t: 'kinds of junk' },
    { n: '18', t: 'achievements' },
    { n: '1', t: 'click to optimize' }
  ],
  features: {
    title: 'Everything a gamer needs',
    text: 'No clutter, no confusing jargon — every feature is explained in plain words.',
    list: {
      stand: { t: 'Your PC in 3D', d: 'Your own PC in 3D: pull out any part, swap it and see the FPS in games, the price and whether it fits. Plus an advisor: what to buy for your budget.' },
      oneClick: { t: 'Optimize in 1 click', d: 'Creates a restore point, cleans junk and turns on the recommended settings. One button.' },
      boost: { t: 'Game Boost', d: 'Game Mode, no background Xbox recording, max performance power plan, raw mouse aim — 16 tweaks explained simply.' },
      space: { t: 'Room for a new game', d: 'Removes apps and games the easy way (several at once), shows what you haven’t opened in ages and finds big old files and duplicates.' },
      cleaner: { t: 'Junk cleaner', d: 'Temp files, browser cache, Discord, Steam and shader cache. Passwords, tabs and personal files stay untouched.' },
      gpu: { t: 'GPU watch', d: 'Temperature, voltage and fan in real time. If it gets dangerous, you get an alert right in the middle of a game.' },
      gameTime: { t: '“I’m going to play”', d: 'Closes apps that eat your RAM and GPU while you play.' },
      startup: { t: 'Startup apps', d: 'Shows what starts with Windows and tells you what is safe to turn off.' }
    }
  },
  shots: {
    title: 'Take a look',
    text: 'Dark theme, falling snow and zero ads.',
    tabs: {
      dashboard: { t: 'Dashboard', d: 'Your PC health score and a list of what can be improved.' },
      stand: { t: 'PC Lab', d: 'Your PC in 3D: swap the video card and see the new FPS in your games and the upgrade price right away.' },
      boost: { t: 'Game Boost', d: 'Every tweak says what it does and how “strong” it is.' },
      cleaner: { t: 'Cleaner', d: 'See how much junk there is and where. Running apps are skipped.' },
      space: { t: 'Disk Space', d: 'Remove apps and games, big old files and duplicates. See how much room the new game will have.' },
      achievements: { t: 'Achievements', d: 'XP, levels and 18 achievements — PC care that is actually fun.' }
    }
  },
  mascot: {
    name: 'Icy',
    title: 'Meet Icy',
    text: 'An ice cube who lives in the app. When your PC is in bad shape, Icy melts. When everything is perfect, Icy puts on sunglasses.',
    click: 'Give Icy a click 👇',
    moods: { bad: 'Melting', ok: 'Meh', good: 'Good', great: 'Perfect' },
    ranksTitle: 'Ranks',
    ranks: ['Newbie', 'Cleaner', 'Optimizer', 'FPS Master', 'Ice Guru', 'IceBoost Legend'],
    secretHint: 'Rumor has it: click Icy 7 times in a row and a blizzard begins…',
    lines: [
      'Hi! I’m Icy ❄️',
      'I’m watching your CPU 👀',
      'A restart is the best medicine 🩹',
      'Did you know I’m an ice cube? Now you do',
      'Poke me again… or don’t',
      'Fewer startup apps — faster boot 🚀',
      'Download me, I don’t bite 😎'
    ],
    secret: 'BLIZZARD!!! ❄️❄️❄️ You found the secret!'
  },
  safety: {
    title: 'Honest and safe',
    text: 'IceBoost never does anything behind your back.',
    list: [
      { t: 'Backup before every change', d: 'The app remembers your old settings, and the “Undo everything” button puts them back.' },
      { t: 'Restore point', d: 'Before strong tweaks IceBoost offers to create a Windows restore point — just in case.' },
      { t: 'No fake tricks', d: 'No “RAM cleaning” and no “+200 FPS” promises. Only things that actually work.' },
      { t: 'Hands off the system', d: 'Important Windows processes can’t be closed, even by accident. Cleaning never touches personal files or passwords.' },
      { t: 'Offline, no ads', d: 'The app works offline, sends nothing anywhere and shows no ads.' }
    ]
  },
  faq: {
    title: 'FAQ',
    list: [
      { q: 'Is it really free?', a: 'Yes, completely. No subscriptions, no ads, no “PRO version”.' },
      {
        q: 'Windows says “Windows protected your PC”. Is it a virus?',
        a: 'No. Windows shows this for new apps without a paid digital signature. Click “More info” → “Run anyway”.'
      },
      { q: 'Why does it need admin rights?', a: 'Windows settings and system folders can’t be changed without them, so Windows asks for permission when the app starts.' },
      { q: 'Can I undo everything?', a: 'Yes. Game Boost has an “Undo everything” button, and a restore point is created before strong tweaks.' },
      {
        q: 'Can IceBoost delete something important?',
        a: 'Files go to the Recycle Bin first, so you can bring them back. Windows, app folders and system folders are protected, and apps are removed by their own uninstaller, just like in Windows Settings.'
      },
      { q: 'Which Windows do I need?', a: 'Windows 10 or 11, 64-bit.' },
      { q: 'How do I uninstall it?', a: 'Like any app: Settings → Apps → IceBoost → Uninstall.' }
    ]
  },
  final: { title: 'Ready to play?', text: 'Get IceBoost and check your PC in a minute.' },
  footer: { made: 'Made by Aising', all: 'All versions' }
}

export type Lang = 'ru' | 'en'
export type Texts = typeof ru
export const TEXTS: Record<Lang, Texts> = { ru, en }

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'ru' || saved === 'en') return saved
  } catch {
    // ignore
  }
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem('lang', lang)
  } catch {
    // ignore
  }
}

export const LangContext = createContext<{ lang: Lang; t: Texts; setLang: (l: Lang) => void }>({
  lang: 'ru',
  t: ru,
  setLang: () => {}
})

export const useLang = (): { lang: Lang; t: Texts; setLang: (l: Lang) => void } => useContext(LangContext)
