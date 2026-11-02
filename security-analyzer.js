/**
 * Digital Shield - Локальный модуль анализа безопасности
 * 
 * ВНИМАНИЕ: Все вычисления производятся исключительно в памяти браузера.
 * Модуль не сохраняет данные, не отправляет запросы и не сохраняет пароль.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SecurityAnalyzer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Распространённые простые последовательности (клавиатурные и числовые)
  const KEYBOARD_PATTERNS = [
    '1234567890',
    '0987654321',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
    'йцукенгшщзхъ',
    'фывапролджэ',
    'ячсмитьбю',
    'abcdefghijklmnopqrstuvwxyz',
    'абвгдежзийклмнопрстуфхцчшщъыьэюя'
  ];

  // Распространённые словарные основы и шаблоны паролей
  const COMMON_WORDS = [
    'password', 'pass', 'admin', 'qwerty', 'root', 'user', 'guest', 'master',
    'welcome', 'login', 'access', 'default', 'пароль', 'админ', 'любовь',
    'secret', 'test', 'security', 'student', 'college', 'school',
    '123456', '12345678', '111111', '000000', '123123', 'qweqwe'
  ];

  /**
   * Проверка наличия повторяющихся символов подряд (3 и более)
   */
  function hasRepeatedChars(str) {
    return /(.)\1{2,}/i.test(str);
  }

  /**
   * Проверка простых клавиатурных последовательностей (длиной 3 и более)
   */
  function findSequentialPatterns(str) {
    const lower = str.toLowerCase();
    if (lower.length < 3) return false;

    for (const pattern of KEYBOARD_PATTERNS) {
      for (let i = 0; i <= pattern.length - 3; i++) {
        const sub = pattern.slice(i, i + 3);
        const subRev = sub.split('').reverse().join('');
        if (lower.includes(sub) || lower.includes(subRev)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Проверка на популярные шаблоны и словарные слова
   */
  function findCommonWords(str) {
    const lower = str.toLowerCase();
    for (const word of COMMON_WORDS) {
      if (lower.includes(word)) {
        return word;
      }
    }
    return null;
  }

  /**
   * Анализ тестового пароля
   * ВАЖНО: Ни при каких условиях не передает сам пароль во внешние структуры
   */
  function analyzePassword(password, profileData = {}) {
    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return {
        hasData: false,
        score: null,
        riskLevel: 'Недостаточно данных',
        riskLevelClass: 'insufficient',
        reasons: ['Пароль не введен для анализа.'],
        recommendations: ['Введите пароль для проверки надёжности.'],
        metrics: null
      };
    }

    const len = password.length;
    const hasLower = /[a-zа-яё]/.test(password);
    const hasUpper = /[A-ZА-ЯЁ]/.test(password);
    const hasDigits = /[0-9]/.test(password);
    const hasSymbols = /[^a-zA-Zа-яА-ЯёЁ0-9]/.test(password);

    const varietyCount = [hasLower, hasUpper, hasDigits, hasSymbols].filter(Boolean).length;
    const hasRepeats = hasRepeatedChars(password);
    const hasSequences = findSequentialPatterns(password);
    const detectedWord = findCommonWords(password);

    // Проверка пересечения с вымышленным профилем (без раскрытия символов пароля!)
    let profileOverlap = false;
    let overlapReasons = [];

    if (profileData.nickname && profileData.nickname.trim().length >= 3) {
      const nick = profileData.nickname.trim().toLowerCase();
      if (password.toLowerCase().includes(nick)) {
        profileOverlap = true;
        overlapReasons.push('Пароль содержит совпадение с псевдонимом из профиля.');
      }
    }

    if (profileData.birthYear && String(profileData.birthYear).trim().length === 4) {
      const year = String(profileData.birthYear).trim();
      const shortYear = year.slice(2);
      if (password.includes(year)) {
        profileOverlap = true;
        overlapReasons.push('Пароль содержит совпадение с указанным годом рождения.');
      } else if (password.includes(shortYear) && shortYear.length === 2 && len < 10) {
        profileOverlap = true;
        overlapReasons.push('Пароль содержит двухзначное окончание года рождения при короткой длине.');
      }
    }

    // Расчет индекса риска пароля (0 = минимальный риск/надежный, 100 = критический риск/слабый)
    let risk = 50;

    // Оценка по длине
    if (len < 6) {
      risk += 45;
    } else if (len < 8) {
      risk += 30;
    } else if (len < 10) {
      risk += 15;
    } else if (len < 12) {
      risk -= 5;
    } else if (len < 16) {
      risk -= 25;
    } else {
      risk -= 35;
    }

    // Оценка разнообразия типов
    if (varietyCount === 1) risk += 25;
    else if (varietyCount === 2) risk += 10;
    else if (varietyCount === 3) risk -= 10;
    else if (varietyCount === 4) risk -= 20;

    // Шаблоны и повторы
    if (hasRepeats) risk += 15;
    if (hasSequences) risk += 20;
    if (detectedWord) risk += 25;

    // Личные данные в пароле
    if (profileOverlap) risk += 30;

    // Нормализация 0..100
    risk = Math.max(5, Math.min(100, Math.round(risk)));

    const reasons = [];
    const recommendations = [];

    // Формулировка причин (без раскрытия значений)
    if (len < 8) {
      reasons.push(`Недостаточная длина: ${len} симв. (рекомендуется от 12).`);
      recommendations.push('Увеличьте длину минимум до 12–16 знаков. Длина — главный фактор устойчивости к перебору.');
    } else if (len >= 12) {
      reasons.push(`Хорошая длина: ${len} знаков.`);
    }

    if (varietyCount < 3) {
      reasons.push(`Низкое разнообразие символов (использовано типов: ${varietyCount} из 4).`);
      recommendations.push('Используйте комбинацию заглавных и строчных букв, цифр и специальных знаков.');
    }

    if (hasRepeats) {
      reasons.push('Обнаружены повторяющиеся одинаковые знаки подряд.');
      recommendations.push('Избегайте многократного повторения одних и тех же символов.');
    }

    if (hasSequences) {
      reasons.push('Обнаружена простая клавиатурная или числовая последовательность.');
      recommendations.push('Не используйте последовательности по типу «123», «abc», «йцукен» или «qwerty».');
    }

    if (detectedWord) {
      reasons.push('Обнаружено словарное слово или стандартный шаблон.');
      recommendations.push('Замените словарные слова и шаблоны на непредсказуемую парольную фразу или сгенерированный набор.');
    }

    if (profileOverlap) {
      reasons.push(...overlapReasons);
      recommendations.push('Никогда не включайте в пароль личные данные (имена, даты рождения, клички животных, названия учебных заведений).');
    }

    if (recommendations.length === 0) {
      recommendations.push('Пароль демонстрирует высокую стойкость к типовым методам подбора.');
    }

    let riskLevel = 'Низкий';
    let riskLevelClass = 'low';
    if (risk >= 67) {
      riskLevel = 'Повышенный';
      riskLevelClass = 'high';
    } else if (risk >= 34) {
      riskLevel = 'Умеренный';
      riskLevelClass = 'moderate';
    }

    return {
      hasData: true,
      score: risk, // риск 0-100
      riskLevel: riskLevel,
      riskLevelClass: riskLevelClass,
      metrics: {
        length: len,
        varietyCount: varietyCount,
        hasLower: hasLower,
        hasUpper: hasUpper,
        hasDigits: hasDigits,
        hasSymbols: hasSymbols,
        hasRepeats: hasRepeats,
        hasSequences: hasSequences,
        hasCommonWord: Boolean(detectedWord),
        hasProfileOverlap: profileOverlap
      },
      reasons: reasons,
      recommendations: recommendations
    };
  }

  /**
   * Анализ открытости персональных данных профиля
   */
  function analyzeProfile(profile) {
    const p = profile || {};
    const hasNickname = Boolean(p.nickname && p.nickname.trim().length > 0);
    const hasBirthYear = Boolean(p.birthYear && String(p.birthYear).trim().length > 0);
    const hasCity = Boolean(p.city && p.city.trim().length > 0);
    const hasPlace = Boolean(p.place && p.place.trim().length > 0);

    const isPhonePublic = Boolean(p.phonePublic);
    const isEmailPublic = Boolean(p.emailPublic);

    const hasAnyField = hasNickname || hasBirthYear || hasCity || hasPlace || isPhonePublic || isEmailPublic;

    if (!hasAnyField) {
      return {
        hasData: false,
        score: null,
        riskLevel: 'Недостаточно данных',
        riskLevelClass: 'insufficient',
        exposedFactors: [],
        reasons: ['Данные условного профиля не указаны.'],
        recommendations: ['Заполните демонстрационные поля профиля для моделирования рисков.']
      };
    }

    let risk = 10;
    const exposedFactors = [];
    const reasons = [];
    const recommendations = [];

    if (isPhonePublic) {
      risk += 40;
      exposedFactors.push('Открытый номер телефона');
      reasons.push('Публичный номер телефона в открытом доступе.');
      recommendations.push('Скройте телефон в настройках приватности; номер используется злоумышленниками для целевых атак и социальной инженерии.');
    }

    if (isEmailPublic) {
      risk += 25;
      exposedFactors.push('Открытый адрес электронной почты');
      reasons.push('Публичный email-адрес на странице профиля.');
      recommendations.push('Используйте для публичных страниц отдельный контактный адрес, отличный от основного логина к важным службам.');
    }

    if (hasCity && hasPlace) {
      risk += 25;
      exposedFactors.push('Связка «Город + Учебное заведение/работа»');
      reasons.push('Указаны одновременно населённый пункт и место учёбы или работы.');
      recommendations.push('Сократите детализацию места работы или учёбы в общедоступных аккаунтах для защиты от деанонимизации.');
    } else if (hasPlace) {
      risk += 15;
      exposedFactors.push('Место учёбы или работы');
      reasons.push('Указано конкретное учреждение.');
    } else if (hasCity) {
      risk += 5;
      exposedFactors.push('Город проживания');
    }

    if (hasBirthYear) {
      risk += 10;
      exposedFactors.push('Год рождения');
      reasons.push('Указан точный год рождения.');
      recommendations.push('Скройте точный год рождения: возрастные маркеры часто используются для подбора ответов на контрольные вопросы.');
    }

    risk = Math.max(5, Math.min(100, Math.round(risk)));

    let riskLevel = 'Низкий';
    let riskLevelClass = 'low';
    if (risk >= 67) {
      riskLevel = 'Повышенный';
      riskLevelClass = 'high';
    } else if (risk >= 34) {
      riskLevel = 'Умеренный';
      riskLevelClass = 'moderate';
    }

    return {
      hasData: true,
      score: risk,
      riskLevel: riskLevel,
      riskLevelClass: riskLevelClass,
      exposedFactors: exposedFactors,
      reasons: reasons,
      recommendations: recommendations
    };
  }

  /**
   * Анализ цифрового следа и поведенческих настроек
   */
  function analyzeFootprint(profile) {
    const p = profile || {};
    const photoLocation = Boolean(p.photoLocation);
    const habitsLocation = Boolean(p.habitsLocation);
    const passwordReuse = Boolean(p.passwordReuse);

    const hasAnyToggle = photoLocation || habitsLocation || passwordReuse;

    // Если ни один переключатель не включен и профиль пуст
    if (!hasAnyToggle && !p.hasUserInteracted) {
      return {
        hasData: false,
        score: null,
        riskLevel: 'Недостаточно данных',
        riskLevelClass: 'insufficient',
        reasons: ['Поведенческие переключатели не настроены.'],
        recommendations: ['Отметьте актуальные для демонстрации пункты цифрового следа.']
      };
    }

    let risk = 10;
    const reasons = [];
    const recommendations = [];

    if (passwordReuse) {
      risk += 40;
      reasons.push('Повторное использование одного пароля на нескольких платформах.');
      recommendations.push('Создайте уникальные пароли для каждого аккаунта. При утечке с одного сайта другие останутся в безопасности.');
    }

    if (habitsLocation) {
      risk += 30;
      reasons.push('Публикация сведений о регулярных привычках, маршрутах и местоположении.');
      recommendations.push('Избегайте публикации регулярных маршрутов и информации о времени физического отсутствия по месту жительства.');
    }

    if (photoLocation) {
      risk += 25;
      reasons.push('Публикация фотографий с узнаваемыми ориентирами или геолокацией.');
      recommendations.push('Отключите геометки в камере и не выкладывайте снимки с табличками улиц, номерами домов или узнаваемым окружением.');
    }

    if (!passwordReuse && !habitsLocation && !photoLocation) {
      reasons.push('Рискованные поведенческие факторы не отмечены.');
      recommendations.push('Продолжайте соблюдать цифровую гигиену публикаций.');
      risk = 10;
    }

    risk = Math.max(5, Math.min(100, Math.round(risk)));

    let riskLevel = 'Низкий';
    let riskLevelClass = 'low';
    if (risk >= 67) {
      riskLevel = 'Повышенный';
      riskLevelClass = 'high';
    } else if (risk >= 34) {
      riskLevel = 'Умеренный';
      riskLevelClass = 'moderate';
    }

    return {
      hasData: true,
      score: risk,
      riskLevel: riskLevel,
      riskLevelClass: riskLevelClass,
      reasons: reasons,
      recommendations: recommendations
    };
  }

  /**
   * Построение релевантных сценариев угроз («Открытые сведения → Связка → Риск → Защита»)
   */
  function buildScenarios(passwordAnalysis, profileAnalysis, footprintAnalysis) {
    const scenarios = [];

    // 1. Пароль содержит персональные маркеры
    if (passwordAnalysis.hasData && passwordAnalysis.metrics && passwordAnalysis.metrics.hasProfileOverlap) {
      scenarios.push({
        id: 'scenario-pwd-profile',
        title: 'Персональные маркеры в пароле',
        dataChain: {
          exposed: 'Псевдоним или дата рождения открыто указаны в профиле',
          link: 'Сопоставление открытых данных профиля с логином при анализе аккаунта',
          risk: 'Целенаправленный перебор пароля по маске с использованием личных данных пользователя',
          action: 'Исключите любые персональные данные из паролей. Сформируйте независимую кодовую фразу.'
        }
      });
    }

    // 2. Повторное использование пароля
    if (footprintAnalysis.hasData && footprintAnalysis.reasons.some(r => r.includes('Повторное использование'))) {
      scenarios.push({
        id: 'scenario-pwd-reuse',
        title: 'Эффект домино при компрометации пароля',
        dataChain: {
          exposed: 'Один и тот же пароль применяется на нескольких веб-ресурсах',
          link: 'Утечка базы данных стороннего сервиса связывается с общим логином или почтой',
          risk: 'Каскадный взлом (Credential Stuffing): компрометация одного сервиса ведёт к потере доступа к почте и соцсетям',
          action: 'Используйте уникальный пароль для каждого сервиса и сохраняйте их в надёжном менеджере паролей.'
        }
      });
    }

    // 3. Открытый телефон
    if (profileAnalysis.hasData && profileAnalysis.exposedFactors.includes('Открытый номер телефона')) {
      scenarios.push({
        id: 'scenario-phone',
        title: 'Уязвимость к социальной инженерии по номеру телефона',
        dataChain: {
          exposed: 'Номер мобильного телефона открыт для всех посетителей страницы',
          link: 'Поиск привязанных банковских приложений, мессенджеров и объявлений по номеру',
          risk: 'Целевые мошеннические звонки с психологическим давлением, попытки перевыпуска SIM или фишинг',
          action: 'Скройте номер телефона в настройках конфиденциальности и перейдите на двухфакторную защиту через приложение (TOTP).'
        }
      });
    }

    // 4. Фотографии с узнаваемыми ориентирами
    if (footprintAnalysis.hasData && footprintAnalysis.reasons.some(r => r.includes('фотографий с узнаваемыми ориентирами'))) {
      scenarios.push({
        id: 'scenario-geo-photo',
        title: 'Непреднамеренная деанонимизация по фотоматериалам',
        dataChain: {
          exposed: 'Публичные снимки с фрагментами двора, вида из окна или архитектурных деталей',
          link: 'Сравнение с открытыми спутниковыми картами и панорамами улиц (OSINT-методы)',
          risk: 'Определение точного адреса проживания или постоянного нахождения без прямого указания адреса',
          action: 'Отключите сохранение геотегов в приложении камеры и публикуйте фото без адресных ориентиров.'
        }
      });
    }

    // 5. Публикация привычек и перемещений
    if (footprintAnalysis.hasData && footprintAnalysis.reasons.some(r => r.includes('привычках, маршрутах'))) {
      scenarios.push({
        id: 'scenario-habits',
        title: 'Прогнозирование физического присутствия по открытому графику',
        dataChain: {
          exposed: 'Посты о регулярных тренировках, расписании пар или датах поездок',
          link: 'Анализ времени публикации и систематизация ежедневного расписания активности',
          risk: 'Раскрытие графика отсутствия дома и предсказуемость маршрутов передвижения',
          action: 'Публикуйте впечатления о поездках и мероприятиях постфактум, ограничьте видимость постов кругом близких друзей.'
        }
      });
    }

    // 6. Открытый email
    if (profileAnalysis.hasData && profileAnalysis.exposedFactors.includes('Открытый адрес электронной почты')) {
      scenarios.push({
        id: 'scenario-email',
        title: 'Таргетированный фишинг через открытый контактный адрес',
        dataChain: {
          exposed: 'Основной адрес электронной почты указан в общедоступном профиле',
          link: 'Включение адреса в спам-базы и сопоставление с утечками учетных записей',
          risk: 'Получение персонализированных вредоносных писем с поддельными ссылками на сброс паролей',
          action: 'Заведите отдельный почтовый ящик для публичных контактов и никогда не используйте его в качестве логина к критичным сервисам.'
        }
      });
    }

    // 7. Город + Учебное заведение/работа
    if (profileAnalysis.hasData && profileAnalysis.exposedFactors.includes('Связка «Город + Учебное заведение/работа»')) {
      scenarios.push({
        id: 'scenario-cross-profile',
        title: 'Кросс-сервисная деанонимизация профиля',
        dataChain: {
          exposed: 'Комбинация города, места учёбы/работы и сетевого псевдонима',
          link: 'Сквозной поиск по студенческим сообществам, спискам зачисления и социальным сетям',
          risk: 'Связывание псевдонимного аккаунта с реальными персональными данными человека',
          action: 'Не указывайте точное название группы или факультета в открытом доступе; разделяйте учебные и личные сетевые псевдонимы.'
        }
      });
    }

    return scenarios;
  }

  /**
   * Сводный расчет общего индекса риска и статуса
   */
  function calculateTotalIndex(pwdAnalysis, profAnalysis, footAnalysis) {
    const modulesWithData = [pwdAnalysis, profAnalysis, footAnalysis].filter(m => m.hasData);

    if (modulesWithData.length === 0) {
      return {
        hasData: false,
        totalRiskScore: null,
        riskLevel: 'Недостаточно данных',
        riskLevelClass: 'insufficient',
        summaryText: 'Для расчёта индекса введите тестовый пароль или заполните параметры условного профиля.',
        components: {
          password: pwdAnalysis,
          profile: profAnalysis,
          footprint: footAnalysis
        },
        scenarios: []
      };
    }

    // Взвешенный расчет с учетом доступных данных
    let totalRisk = 0;
    if (pwdAnalysis.hasData && profAnalysis.hasData && footAnalysis.hasData) {
      totalRisk = (pwdAnalysis.score * 0.40) + (profAnalysis.score * 0.30) + (footAnalysis.score * 0.30);
    } else if (pwdAnalysis.hasData && (profAnalysis.hasData || footAnalysis.hasData)) {
      const other = profAnalysis.hasData ? profAnalysis : footAnalysis;
      totalRisk = (pwdAnalysis.score * 0.55) + (other.score * 0.45);
    } else if (pwdAnalysis.hasData) {
      totalRisk = pwdAnalysis.score;
    } else {
      // Только профиль или след
      const active = modulesWithData.map(m => m.score);
      totalRisk = active.reduce((a, b) => a + b, 0) / active.length;
    }

    totalRisk = Math.max(5, Math.min(100, Math.round(totalRisk)));

    let riskLevel = 'Низкий';
    let riskLevelClass = 'low';
    let summaryText = 'Обнаружено минимальное количество факторов риска. Цифровая гигиена на хорошем уровне.';

    if (totalRisk >= 67) {
      riskLevel = 'Повышенный';
      riskLevelClass = 'high';
      summaryText = 'Обнаружено несколько существенных факторов риска. Рекомендуется выполнить первоочередные шаги защиты.';
    } else if (totalRisk >= 34) {
      riskLevel = 'Умеренный';
      riskLevelClass = 'moderate';
      summaryText = 'Выявлен ряд факторов, требующих внимания для снижения вероятности угроз.';
    }

    const scenarios = buildScenarios(pwdAnalysis, profAnalysis, footAnalysis);

    return {
      hasData: true,
      totalRiskScore: totalRisk,
      riskLevel: riskLevel,
      riskLevelClass: riskLevelClass,
      summaryText: summaryText,
      components: {
        password: pwdAnalysis,
        profile: profAnalysis,
        footprint: footAnalysis
      },
      scenarios: scenarios
    };
  }

  return {
    analyzePassword: analyzePassword,
    analyzeProfile: analyzeProfile,
    analyzeFootprint: analyzeFootprint,
    buildScenarios: buildScenarios,
    calculateTotalIndex: calculateTotalIndex
  };
}));
