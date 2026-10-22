import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const ru = {
  nav: {
    dashboard: 'Главная',
    boost: 'Ускорение игр',
    cleaner: 'Очистка',
    startup: 'Автозагрузка',
    processes: 'Процессы',
    achievements: 'Достижения',
    settings: 'Настройки'
  },
  mascot: {
    name: 'Айсик',
    bad: [
      'Я таю… помоги ПК, нажми «Оптимизировать» 🥲',
      'Тут столько мусора, что я в нём потерялся',
      'Мне жарко. ПК тоже жарко. Давай чистить!'
    ],
    ok: ['Неплохо, но можно лучше 😏', 'Ещё пара кликов — и будет огонь… то есть лёд', 'Чуть-чуть подкрутим — и FPS скажет спасибо'],
    good: ['Хорошо идём! Почти идеал ✨', 'ПК бодрый, я бодрый — красота', 'Осталось совсем немного до 90+'],
    great: ['Я в очках, потому что ПК — топ 😎', 'Идеально. Иди играй!', 'Холоднее только в Антарктиде ❄️'],
    any: [
      'Перезагрузка — лучшее лекарство 🩹',
      'Я слежу за процессором 👀',
      'Ты знал, что я кубик льда? Теперь знаешь',
      'Тыкни меня ещё… или не надо',
      'Чем меньше автозагрузки — тем быстрее старт 🚀'
    ],
    secret: 'МЕТЕЛЬ!!! ❄️❄️❄️ Ты нашёл секрет!'
  },
  ach: {
    pageTitle: 'Достижения',
    subtitle: 'Оптимизируй ПК, получай опыт и повышай уровень. Чем больше заботишься о ПК — тем выше ранг.',
    level: 'Уровень {{n}}',
    xp: '{{a}} / {{b}} XP',
    toNext: 'До следующего уровня: {{n}} XP',
    unlocked: 'Достижение получено!',
    levelUp: 'Новый уровень!',
    locked: 'Секретное достижение',
    lockedHint: 'Найди сам 😉',
    done: 'Получено',
    count: '{{a}} из {{b}}',
    stats: {
      freed: 'Освобождено всего',
      cleans: 'Очисток',
      tweaks: 'Включено настроек',
      streak: 'Дней подряд'
    },
    howTo: 'Как получать опыт',
    howList: ['Очистка — от 10 XP (больше мусора — больше опыта)', 'Каждая настройка — 15 XP', 'Оптимизация в 1 клик — 50 XP', 'Заходи каждый день — бонус растёт'],
    titleLabel: 'Ранг',
    title: {
      newbie: 'Новичок',
      cleaner: 'Чистильщик',
      optimizer: 'Оптимизатор',
      master: 'Мастер FPS',
      guru: 'Ледяной гуру',
      legend: 'Легенда IceBoost'
    },
    list: {
      firstClean: { t: 'Первая уборка', d: 'Почисти мусор первый раз' },
      gb1: { t: 'Гигабайт свободы', d: 'Освободи 1 ГБ' },
      gb10: { t: 'Снежная лавина', d: 'Освободи 10 ГБ за всё время' },
      firstTweak: { t: 'Первая настройка', d: 'Включи любую настройку для игр' },
      allRec: { t: 'Полный разгон', d: 'Включи все рекомендованные настройки' },
      oneClick: { t: 'Один клик', d: 'Используй «Оптимизировать в 1 клик»' },
      startup3: { t: 'Укротитель автозагрузки', d: 'Выключи 3 программы в автозагрузке' },
      gamer: { t: 'Готов к игре', d: 'Закрой лишние программы перед игрой' },
      score90: { t: 'Идеальный ПК', d: 'Доведи состояние ПК до 90+' },
      streak3: { t: 'Три дня подряд', d: 'Заходи в IceBoost 3 дня подряд' },
      streak7: { t: 'Неделя заботы', d: 'Заходи 7 дней подряд' },
      nightOwl: { t: 'Ночная сова', d: 'Открой IceBoost после полуночи' },
      secret: { t: 'Секретная метель', d: 'Ты нашёл пасхалку!' }
    }
  },
  common: {
    admin: 'Права админа',
    adminOn: 'Режим администратора',
    adminOff: 'Обычный режим',
    loading: 'Загрузка…',
    refresh: 'Обновить',
    cancel: 'Отмена',
    done: 'Готово',
    close: 'Закрыть',
    uacDenied: 'Ты нажал «Нет» в окне Windows — без прав администратора это не сделать.',
    error: 'Ошибка',
    restart: { none: '', relogin: 'После перезахода', reboot: 'После перезагрузки' }
  },
  dash: {
    score: 'Состояние ПК',
    grade: { great: 'Отлично', good: 'Хорошо', ok: 'Можно лучше', bad: 'Нужна оптимизация' },
    oneClick: 'Оптимизировать в 1 клик',
    oneClickHint: 'Очистит мусор и включит рекомендованные настройки. Всё можно вернуть.',
    gameTime: 'Я сажусь играть',
    gameTimeDone: 'Закрыто программ: {{n}}. Удачной игры! 🎮',
    gameTimeNothing: 'Лишнего ничего не запущено — можно играть! 🎮',
    live: 'Нагрузка сейчас',
    issues: 'Что можно улучшить',
    noIssues: 'Всё отлично! Твой ПК в лучшей форме.',
    fix: 'Исправить',
    cpu: 'Процессор',
    ram: 'Память',
    gpu: 'Видеокарта',
    disk: 'Диск {{drive}}',
    free: 'свободно {{v}}',
    of: '{{a}} из {{b}}',
    yourPc: 'Твой ПК',
    board: 'Мат. плата',
    monitor: 'Монитор',
    windows: 'Windows',
    uptime: 'Работает без перезагрузки',
    disks: 'Диски',
    sticks: '{{n}} планки · {{speed}} МГц',
    vram: '{{v}} видеопамяти',
    issue: {
      diskLow: 'На диске {{drive}} мало места: свободно {{free}}',
      junk: 'Найдено {{size}} мусора',
      startup: '{{n}} лишних программ в автозагрузке',
      tweaks: '{{n}} настроек для игр не включены',
      ram: 'Память почти заполнена ({{p}}%)',
      uptime: 'ПК не перезагружался {{d}} дн. — перезагрузка освежит систему'
    },
    run: {
      title: 'Оптимизация',
      restore: 'Точка восстановления Windows',
      clean: 'Очистка мусора',
      tweaks: 'Настройки для игр и системы',
      result: 'Готово!',
      freed: 'Освобождено',
      applied: 'Включено настроек',
      needReboot: 'Некоторые настройки заработают после перезагрузки ПК.',
      skippedStrong: 'Сильные настройки пропущены: не получилось создать точку восстановления.'
    }
  },
  boost: {
    title: 'Ускорение игр',
    subtitle: 'Настройки Windows для FPS и отклика. Каждую можно вернуть как было.',
    applyRec: 'Включить рекомендованные',
    revertAll: 'Вернуть всё как было',
    restorePoint: 'Создать точку восстановления',
    restoreCreated: 'Точка восстановления создана',
    restoreLimit: 'Windows разрешает одну точку в сутки — сегодня она уже есть',
    restoreError: 'Не получилось создать точку восстановления',
    confirmStrong: 'Это системная настройка. Сначала создать точку восстановления Windows (на всякий случай)?',
    createAndApply: 'Создать и включить',
    applyWithout: 'Включить без неё',
    level: { safe: 'Безопасно', strong: 'Сильно' },
    recommended: 'Рекомендуем',
    group: {
      game: 'Игры',
      system: 'Система и запуск',
      visual: 'Внешний вид',
      privacy: 'Фоновые процессы и слежка'
    },
    before: 'Перед игрой',
    beforeHint: 'Закрой программы, которые едят память и видеокарту, пока играешь.',
    closeSelected: 'Закрыть выбранные',
    nothingToClose: 'Сейчас не запущено ничего лишнего 👍',
    closed: 'Программы закрыты',
    tips: 'Советы для твоих игр',
    tip: {
      steam: 'Steam: в Настройки → В игре можно включить счётчик FPS и выключить оверлей, если он не нужен.',
      discord: 'Discord: Настройки → Расширенные → выключи «Аппаратное ускорение», а в «Оверлей игры» — оверлей. Discord будет меньше мешать игре.',
      gpu: 'AMD Adrenalin: включи Radeon Anti-Lag (меньше задержка) и выключи Radeon Chill, если хочешь максимум FPS.',
      monitor: 'Монитор работает на {{hz}} Гц. Проверь: Параметры → Дисплей → Расширенные параметры → Частота обновления. Если есть больше — выбери максимум.',
      reboot: 'Перезагружай ПК хотя бы раз в пару дней — это лучше любой «очистки памяти».'
    },
    tweak: {
      gameMode: { t: 'Игровой режим Windows', d: 'Windows отдаёт игре больше ресурсов и не ставит обновления во время игры.' },
      gameDvr: { t: 'Выключить фоновую запись игр', d: 'Xbox Game Bar всё время пишет видео в фоне — это отнимает FPS.' },
      powerPlan: { t: 'Схема питания «Максимальная производительность»', d: 'Процессор не сбрасывает частоту и быстрее реагирует. Для ноутбука на батарее не советуем.' },
      mouseAccel: { t: 'Выключить ускорение мыши', d: 'Прицел двигается ровно, как ты двигаешь мышь. Любят все, кто играет в шутеры.' },
      gamePriority: { t: 'Высокий приоритет для игр', d: 'Windows даёт играм больше времени процессора и видеокарты, а фоновым задачам — меньше.' },
      networkThrottling: { t: 'Убрать ограничение сети', d: 'Windows перестаёт притормаживать сеть, когда играет звук или видео. Может снизить пинг-скачки.' },
      startupDelay: { t: 'Без задержки при запуске', d: 'Программы автозагрузки стартуют сразу, а не через 10 секунд после входа.' },
      backgroundApps: { t: 'Запретить приложениям работать в фоне', d: 'Приложения из Microsoft Store не будут работать, когда они закрыты.' },
      webSearch: { t: 'Поиск в «Пуске» без интернета', d: 'Поиск ищет только на ПК, без Bing — открывается быстрее.' },
      widgets: { t: 'Выключить виджеты Windows', d: 'Новости и погода на панели задач едят память в фоне.' },
      hibernate: { t: 'Выключить гибернацию', d: 'Освобождает на диске C: место размером ~40% от памяти (у 16 ГБ — около 6 ГБ). Но выключает «быстрый запуск».' },
      transparency: { t: 'Выключить прозрачность окон', d: 'Меньше нагрузки на видеокарту, интерфейс отзывчивее.' },
      animations: { t: 'Быстрые меню и окна', d: 'Меньше анимаций — меню открываются почти мгновенно.' },
      tipsAds: { t: 'Выключить рекламу и советы Windows', d: 'Windows не будет сама ставить «рекомендованные» приложения и показывать советы.' },
      adId: { t: 'Выключить рекламный ID', d: 'Приложения не получат твой рекламный идентификатор.' },
      telemetry: { t: 'Выключить телеметрию', d: 'Меньше данных уходит в Microsoft, служба сбора данных не грузит диск и сеть.' }
    }
  },
  cleaner: {
    title: 'Очистка',
    subtitle: 'Удаляем только мусор: временные файлы и кэш. Личные файлы, пароли и история браузеров не трогаем.',
    willClean: 'Будет очищено',
    found: 'Всего найдено: {{size}}',
    scanning: 'Ищу мусор…',
    rescan: 'Проверить снова',
    clean: 'Очистить',
    cleaning: 'Чищу…',
    files: '{{n}} файлов',
    needsAdmin: 'Узнаем при очистке',
    running: 'запущен — пропустим',
    resultTitle: 'Освобождено {{size}}',
    resultFiles: 'Удалено файлов: {{n}}. Занятые файлы пропущены: {{f}}.',
    resultSkipped: 'Пропущено, потому что открыто: {{list}}. Закрой их и почисти ещё раз.',
    adminDenied: 'Системные папки не очищены — нужны права администратора.',
    cat: {
      userTemp: { t: 'Временные файлы', d: 'Файлы, которые программы оставили после себя (старше суток).' },
      winTemp: { t: 'Временные файлы Windows', d: 'Мусор самой Windows (старше суток).' },
      browsers: { t: 'Кэш браузеров', d: 'Сохранённые картинки сайтов. Пароли, вкладки и история останутся.' },
      apps: { t: 'Кэш программ', d: 'Discord, Steam, Spotify, Epic Games — временные файлы.' },
      crashDumps: { t: 'Отчёты об ошибках', d: 'Файлы, которые остаются после вылетов программ.' },
      winUpdate: { t: 'Файлы обновлений Windows', d: 'Уже установленные обновления, которые больше не нужны.' },
      shaders: { t: 'Кэш шейдеров', d: 'Если игры начали подтормаживать или есть графические баги. После очистки первый запуск игры может слегка лагать.' },
      recycle: { t: 'Корзина', d: 'Файлы удалятся навсегда.' }
    }
  },
  startup: {
    title: 'Автозагрузка',
    subtitle: 'Программы, которые запускаются вместе с Windows. Чем меньше — тем быстрее включается ПК.',
    enabled: 'Включено при запуске: {{n}} из {{total}}',
    empty: 'Нет программ в автозагрузке',
    hint: {
      keep: 'Лучше оставить',
      optional: 'По желанию',
      disable: 'Можно выключить'
    },
    why: {
      security: 'Защитник Windows — не выключай.',
      audio: 'Нужно для звука.',
      driver: 'Драйвер видеокарты или устройства.',
      amdNoise: 'Шумоподавление микрофона AMD. Выключай, если не пользуешься.',
      onedrive: 'Синхронизация файлов. Оставь, если хранишь файлы в OneDrive.',
      launcher: 'Лаунчер игр — запустишь сам, когда захочешь поиграть.',
      messenger: 'Мессенджер — можно открыть вручную.',
      browser: 'Браузер не нужен при включении ПК.',
      updater: 'Проверка обновлений. Работает и без автозагрузки.',
      printer: 'Принтер. Выключай, если печатаешь редко.',
      extra: 'Не нужно для работы Windows.'
    }
  },
  procs: {
    title: 'Процессы',
    subtitle: 'Что сейчас ест процессор и память. Обновляется каждые 3 секунды.',
    name: 'Программа',
    count: 'Процессов',
    cpu: 'ЦП',
    ram: 'Память',
    end: 'Завершить',
    sure: 'Точно?',
    ended: '{{name}} завершён',
    protected: 'Это системный процесс — его нельзя закрывать.'
  },
  settings: {
    title: 'Настройки',
    language: 'Язык',
    fx: 'Эффекты',
    fxText: 'Падающий снег и конфетти. Почти не нагружают ПК, но их можно выключить.',
    about: 'О программе',
    aboutText: 'IceBoost — оптимизатор ПК для геймеров. Чистит мусор, настраивает Windows для игр и показывает, что тормозит компьютер.',
    honest: 'Честно: мы не делаем «очистку оперативки» и другие трюки, которые только выглядят полезными. Только то, что реально работает.',
    backups: 'Резервные копии',
    backupsText: 'Перед каждым изменением IceBoost сохраняет старые настройки и может вернуть их кнопкой «Вернуть всё как было».',
    adminText: 'Некоторые функции требуют прав администратора — тогда Windows спросит разрешение.',
    author: 'Автор: Айсинг'
  }
}

const en: typeof ru = {
  nav: {
    dashboard: 'Dashboard',
    boost: 'Game Boost',
    cleaner: 'Cleaner',
    startup: 'Startup',
    processes: 'Processes',
    achievements: 'Achievements',
    settings: 'Settings'
  },
  mascot: {
    name: 'Icy',
    bad: ['I’m melting… help your PC, hit “Optimize” 🥲', 'So much junk in here, I got lost', 'It’s hot. Your PC is hot too. Let’s clean!'],
    ok: ['Not bad, could be better 😏', 'A couple more clicks and it’s fire… I mean ice', 'A little tuning and your FPS will thank you'],
    good: ['Looking good! Almost perfect ✨', 'PC is fresh, I’m fresh — nice', 'Just a bit more to 90+'],
    great: ['Sunglasses on, because your PC is top 😎', 'Perfect. Go play!', 'Only Antarctica is cooler ❄️'],
    any: [
      'A restart is the best medicine 🩹',
      'I’m watching your CPU 👀',
      'Did you know I’m an ice cube? Now you do',
      'Poke me again… or don’t',
      'Fewer startup apps — faster boot 🚀'
    ],
    secret: 'BLIZZARD!!! ❄️❄️❄️ You found the secret!'
  },
  ach: {
    pageTitle: 'Achievements',
    subtitle: 'Optimize your PC, earn XP and level up. The more you care for your PC, the higher your rank.',
    level: 'Level {{n}}',
    xp: '{{a}} / {{b}} XP',
    toNext: 'To next level: {{n}} XP',
    unlocked: 'Achievement unlocked!',
    levelUp: 'Level up!',
    locked: 'Secret achievement',
    lockedHint: 'Find it yourself 😉',
    done: 'Unlocked',
    count: '{{a}} of {{b}}',
    stats: {
      freed: 'Freed in total',
      cleans: 'Cleanups',
      tweaks: 'Settings turned on',
      streak: 'Day streak'
    },
    howTo: 'How to earn XP',
    howList: ['Cleaning — 10+ XP (more junk, more XP)', 'Every setting — 15 XP', 'Optimize in 1 click — 50 XP', 'Come back every day — the bonus grows'],
    titleLabel: 'Rank',
    title: {
      newbie: 'Newbie',
      cleaner: 'Cleaner',
      optimizer: 'Optimizer',
      master: 'FPS Master',
      guru: 'Ice Guru',
      legend: 'IceBoost Legend'
    },
    list: {
      firstClean: { t: 'First cleanup', d: 'Clean junk for the first time' },
      gb1: { t: 'A gigabyte of freedom', d: 'Free up 1 GB' },
      gb10: { t: 'Avalanche', d: 'Free up 10 GB in total' },
      firstTweak: { t: 'First tweak', d: 'Turn on any gaming setting' },
      allRec: { t: 'Full throttle', d: 'Turn on all recommended settings' },
      oneClick: { t: 'One click', d: 'Use “Optimize in 1 click”' },
      startup3: { t: 'Startup tamer', d: 'Turn off 3 startup apps' },
      gamer: { t: 'Ready to play', d: 'Close unneeded apps before a game' },
      score90: { t: 'Perfect PC', d: 'Get PC health to 90+' },
      streak3: { t: 'Three days in a row', d: 'Open IceBoost 3 days in a row' },
      streak7: { t: 'A week of care', d: 'Open it 7 days in a row' },
      nightOwl: { t: 'Night owl', d: 'Open IceBoost after midnight' },
      secret: { t: 'Secret blizzard', d: 'You found the easter egg!' }
    }
  },
  common: {
    admin: 'Admin',
    adminOn: 'Administrator mode',
    adminOff: 'Standard mode',
    loading: 'Loading…',
    refresh: 'Refresh',
    cancel: 'Cancel',
    done: 'Done',
    close: 'Close',
    uacDenied: 'You clicked “No” in the Windows prompt — this needs administrator rights.',
    error: 'Error',
    restart: { none: '', relogin: 'After sign-out', reboot: 'After restart' }
  },
  dash: {
    score: 'PC health',
    grade: { great: 'Excellent', good: 'Good', ok: 'Could be better', bad: 'Needs a boost' },
    oneClick: 'Optimize in 1 click',
    oneClickHint: 'Cleans junk and turns on recommended settings. Everything can be undone.',
    gameTime: 'I’m going to play',
    gameTimeDone: 'Apps closed: {{n}}. Have a good game! 🎮',
    gameTimeNothing: 'Nothing unneeded is running — go play! 🎮',
    live: 'Live load',
    issues: 'What can be improved',
    noIssues: 'All good! Your PC is in top shape.',
    fix: 'Fix',
    cpu: 'CPU',
    ram: 'Memory',
    gpu: 'Graphics',
    disk: 'Drive {{drive}}',
    free: '{{v}} free',
    of: '{{a}} of {{b}}',
    yourPc: 'Your PC',
    board: 'Motherboard',
    monitor: 'Display',
    windows: 'Windows',
    uptime: 'Up since last restart',
    disks: 'Drives',
    sticks: '{{n}} sticks · {{speed}} MHz',
    vram: '{{v}} VRAM',
    issue: {
      diskLow: 'Drive {{drive}} is low on space: {{free}} free',
      junk: '{{size}} of junk found',
      startup: '{{n}} unneeded apps start with Windows',
      tweaks: '{{n}} gaming settings are off',
      ram: 'Memory is almost full ({{p}}%)',
      uptime: 'PC hasn’t restarted in {{d}} days — a restart will refresh it'
    },
    run: {
      title: 'Optimizing',
      restore: 'Windows restore point',
      clean: 'Cleaning junk',
      tweaks: 'Gaming & system settings',
      result: 'Done!',
      freed: 'Freed',
      applied: 'Settings turned on',
      needReboot: 'Some settings will work after you restart your PC.',
      skippedStrong: 'System-wide settings skipped: could not create a restore point.'
    }
  },
  boost: {
    title: 'Game Boost',
    subtitle: 'Windows settings for higher FPS and lower input lag. Each one can be undone.',
    applyRec: 'Turn on recommended',
    revertAll: 'Undo everything',
    restorePoint: 'Create restore point',
    restoreCreated: 'Restore point created',
    restoreLimit: 'Windows allows one restore point per day — there is one already today',
    restoreError: 'Could not create a restore point',
    confirmStrong: 'This is a system-wide setting. Create a Windows restore point first, just in case?',
    createAndApply: 'Create & turn on',
    applyWithout: 'Turn on without it',
    level: { safe: 'Safe', strong: 'Strong' },
    recommended: 'Recommended',
    group: {
      game: 'Games',
      system: 'System & boot',
      visual: 'Visual effects',
      privacy: 'Background tasks & tracking'
    },
    before: 'Before you play',
    beforeHint: 'Close apps that eat memory and GPU while you play.',
    closeSelected: 'Close selected',
    nothingToClose: 'Nothing unneeded is running right now 👍',
    closed: 'Apps closed',
    tips: 'Tips for your games',
    tip: {
      steam: 'Steam: Settings → In Game — turn on the FPS counter, and turn the overlay off if you don’t use it.',
      discord: 'Discord: Settings → Advanced → turn off “Hardware Acceleration”, and turn off the in-game overlay. Discord will get in the way less.',
      gpu: 'AMD Adrenalin: turn on Radeon Anti-Lag (less input lag) and turn off Radeon Chill for maximum FPS.',
      monitor: 'Your display runs at {{hz}} Hz. Check Settings → Display → Advanced display → Refresh rate and pick the highest one.',
      reboot: 'Restart your PC every couple of days — it beats any “RAM cleaner”.'
    },
    tweak: {
      gameMode: { t: 'Windows Game Mode', d: 'Windows gives games more resources and won’t install updates while you play.' },
      gameDvr: { t: 'Turn off background game recording', d: 'Xbox Game Bar keeps recording video in the background — that costs FPS.' },
      powerPlan: { t: 'Ultimate Performance power plan', d: 'The CPU keeps its clock speed up and reacts faster. Not for laptops on battery.' },
      mouseAccel: { t: 'Turn off mouse acceleration', d: 'Your aim moves exactly as far as your hand. Shooter players love it.' },
      gamePriority: { t: 'High priority for games', d: 'Windows gives games more CPU and GPU time, and background tasks less.' },
      networkThrottling: { t: 'Remove network throttling', d: 'Windows stops slowing the network while audio or video plays. Can reduce ping spikes.' },
      startupDelay: { t: 'No startup delay', d: 'Startup apps launch right away instead of 10 seconds after sign-in.' },
      backgroundApps: { t: 'Stop apps running in the background', d: 'Microsoft Store apps won’t run when they are closed.' },
      webSearch: { t: 'Offline Start menu search', d: 'Search looks only on your PC, without Bing — it opens faster.' },
      widgets: { t: 'Turn off Windows widgets', d: 'News and weather on the taskbar use memory in the background.' },
      hibernate: { t: 'Turn off hibernation', d: 'Frees space on drive C: equal to ~40% of your RAM (about 6 GB with 16 GB). Also turns off Fast Startup.' },
      transparency: { t: 'Turn off window transparency', d: 'Less GPU load and a snappier interface.' },
      animations: { t: 'Fast menus and windows', d: 'Fewer animations — menus open almost instantly.' },
      tipsAds: { t: 'Turn off Windows ads and tips', d: 'Windows won’t install “suggested” apps on its own or show tips.' },
      adId: { t: 'Turn off advertising ID', d: 'Apps won’t get your advertising identifier.' },
      telemetry: { t: 'Turn off telemetry', d: 'Less data sent to Microsoft; the data collection service stops loading disk and network.' }
    }
  },
  cleaner: {
    title: 'Cleaner',
    subtitle: 'Only junk gets removed: temporary files and caches. Personal files, passwords and browser history stay.',
    willClean: 'Will be cleaned',
    found: 'Found in total: {{size}}',
    scanning: 'Looking for junk…',
    rescan: 'Scan again',
    clean: 'Clean',
    cleaning: 'Cleaning…',
    files: '{{n}} files',
    needsAdmin: 'Measured while cleaning',
    running: 'running — will skip',
    resultTitle: '{{size}} freed',
    resultFiles: 'Files deleted: {{n}}. Files in use skipped: {{f}}.',
    resultSkipped: 'Skipped because they are open: {{list}}. Close them and clean again.',
    adminDenied: 'System folders were not cleaned — administrator rights are needed.',
    cat: {
      userTemp: { t: 'Temporary files', d: 'Files apps left behind (older than one day).' },
      winTemp: { t: 'Windows temporary files', d: 'Junk left by Windows itself (older than one day).' },
      browsers: { t: 'Browser cache', d: 'Saved website images. Passwords, tabs and history stay.' },
      apps: { t: 'App cache', d: 'Discord, Steam, Spotify, Epic Games — temporary files.' },
      crashDumps: { t: 'Error reports', d: 'Files left after apps crash.' },
      winUpdate: { t: 'Windows Update files', d: 'Already installed updates that aren’t needed anymore.' },
      shaders: { t: 'Shader cache', d: 'Use it if games started stuttering or show graphics glitches. The first launch of a game after cleaning may stutter a little.' },
      recycle: { t: 'Recycle Bin', d: 'Files will be deleted for good.' }
    }
  },
  startup: {
    title: 'Startup',
    subtitle: 'Apps that start with Windows. Fewer apps — faster boot.',
    enabled: 'Starting with Windows: {{n}} of {{total}}',
    empty: 'No startup apps',
    hint: {
      keep: 'Keep it',
      optional: 'Your choice',
      disable: 'Can be turned off'
    },
    why: {
      security: 'Windows Security — don’t turn it off.',
      audio: 'Needed for sound.',
      driver: 'Graphics or device driver.',
      amdNoise: 'AMD microphone noise suppression. Turn it off if you don’t use it.',
      onedrive: 'File sync. Keep it if you store files in OneDrive.',
      launcher: 'Game launcher — open it yourself when you want to play.',
      messenger: 'Messenger — you can open it manually.',
      browser: 'You don’t need a browser at boot.',
      updater: 'Update checker. Works without startup too.',
      printer: 'Printer. Turn it off if you rarely print.',
      extra: 'Not needed for Windows to work.'
    }
  },
  procs: {
    title: 'Processes',
    subtitle: 'What is using your CPU and memory right now. Updates every 3 seconds.',
    name: 'App',
    count: 'Processes',
    cpu: 'CPU',
    ram: 'Memory',
    end: 'End',
    sure: 'Sure?',
    ended: '{{name}} ended',
    protected: 'This is a system process — it can’t be closed.'
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    fx: 'Effects',
    fxText: 'Falling snow and confetti. They barely load your PC, but you can turn them off.',
    about: 'About',
    aboutText: 'IceBoost is a PC optimizer for gamers. It cleans junk, tunes Windows for games and shows what slows your PC down.',
    honest: 'Honestly: no “RAM cleaning” or other tricks that only look useful. Only things that really work.',
    backups: 'Backups',
    backupsText: 'Before every change IceBoost saves your old settings and can put them back with “Undo everything”.',
    adminText: 'Some features need administrator rights — Windows will ask for permission.',
    author: 'Made by Aising'
  }
}

function initialLang(): string {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'ru' || saved === 'en') return saved
  } catch {
    // ignore
  }
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, en: { translation: en } },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

export function setLang(lang: 'ru' | 'en'): void {
  void i18n.changeLanguage(lang)
  try {
    localStorage.setItem('lang', lang)
  } catch {
    // ignore
  }
}

export default i18n
