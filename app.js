/**
 * Digital Shield — Главный скрипт веб-приложения
 * 
 * ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ:
 * - Все расчёты выполняются локально в браузере.
 * - Введённые данные и пароль НИКОГДА не сохраняются в localStorage, cookies,
 *   sessionStorage, URL или сообщения консоли.
 * - Никаких внешних сетевых запросов.
 */

(function () {
  'use strict';

  // Состояние в памяти (только оперативная память текущего сеанса)
  const state = {
    password: '',
    profile: {
      nickname: '',
      birthYear: '',
      city: '',
      place: '',
      phonePublic: false,
      emailPublic: false,
      locationPhotos: false,
      habitsLocation: false,
      passwordReuse: false,
      hasUserInteracted: false
    },
    lastAuditResult: null
  };

  // Ссылки на элементы DOM
  const elements = {
    // Пароль
    passwordInput: document.getElementById('passwordInput'),
    btnTogglePassword: document.getElementById('btnTogglePassword'),
    pwdToggleIcon: document.getElementById('pwdToggleIcon'),
    btnClearPassword: document.getElementById('btnClearPassword'),
    pwdStatusBadge: document.getElementById('pwdStatusBadge'),
    pwdRiskProgressBar: document.getElementById('pwdRiskProgressBar'),
    pwdReasonsBox: document.getElementById('pwdReasonsBox'),
    pwdReasonsList: document.getElementById('pwdReasonsList'),

    // Критерии пароля
    critLength: document.getElementById('critLength'),
    critVariety: document.getElementById('critVariety'),
    critSequences: document.getElementById('critSequences'),
    critProfile: document.getElementById('critProfile'),

    // Профиль
    nicknameInput: document.getElementById('nicknameInput'),
    birthYearInput: document.getElementById('birthYearInput'),
    cityInput: document.getElementById('cityInput'),
    placeInput: document.getElementById('placeInput'),

    // Переключатели
    togglePhone: document.getElementById('togglePhone'),
    toggleEmail: document.getElementById('toggleEmail'),
    toggleLocationPhotos: document.getElementById('toggleLocationPhotos'),
    toggleHabitsLocation: document.getElementById('toggleHabitsLocation'),
    togglePasswordReuse: document.getElementById('togglePasswordReuse'),

    // Действия
    btnRunAudit: document.getElementById('btnRunAudit'),
    btnLoadDemo: document.getElementById('btnLoadDemo'),
    btnResetAll: document.getElementById('btnResetAll'),
    btnExportHtml: document.getElementById('btnExportHtml'),
    btnExportTxt: document.getElementById('btnExportTxt'),

    // Результаты и шкала
    totalScoreNumber: document.getElementById('totalScoreNumber'),
    totalRiskBadge: document.getElementById('totalRiskBadge'),
    totalScaleFill: document.getElementById('totalScaleFill'),
    totalExplanationText: document.getElementById('totalExplanationText'),

    // Суб-индексы
    pwdSubScoreNum: document.getElementById('pwdSubScoreNum'),
    pwdSubScoreBadge: document.getElementById('pwdSubScoreBadge'),
    pwdSubDesc: document.getElementById('pwdSubDesc'),

    profSubScoreNum: document.getElementById('profSubScoreNum'),
    profSubScoreBadge: document.getElementById('profSubScoreBadge'),
    profSubDesc: document.getElementById('profSubDesc'),

    footSubScoreNum: document.getElementById('footSubScoreNum'),
    footSubScoreBadge: document.getElementById('footSubScoreBadge'),
    footSubDesc: document.getElementById('footSubDesc'),

    // Сценарии и рекомендации
    scenariosList: document.getElementById('scenariosList'),
    recommendationsList: document.getElementById('recommendationsList'),

    // Тост
    statusToast: document.getElementById('statusToast'),
    toastMessage: document.getElementById('toastMessage'),
    toastClose: document.getElementById('toastClose')
  };

  let toastTimeout = null;

  /**
   * Отображение временного уведомления (тоста)
   */
  function showToast(message, duration = 4000) {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    elements.toastMessage.textContent = message;
    elements.statusToast.hidden = false;
    toastTimeout = setTimeout(() => {
      elements.statusToast.hidden = true;
    }, duration);
  }

  /**
   * Инициализация событий переключателей (с поддержкой доступности)
   */
  function setupToggle(buttonElement, stateKey) {
    function toggle() {
      const isChecked = buttonElement.getAttribute('aria-checked') === 'true';
      const newState = !isChecked;
      buttonElement.setAttribute('aria-checked', String(newState));
      state.profile[stateKey] = newState;
      state.profile.hasUserInteracted = true;
      runAudit();
    }

    buttonElement.addEventListener('click', toggle);
    buttonElement.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    });
  }

  /**
   * Обновление состояния из полей ввода
   */
  function syncInputsToState() {
    state.password = elements.passwordInput.value;
    state.profile.nickname = elements.nicknameInput.value.trim();
    state.profile.birthYear = elements.birthYearInput.value.trim();
    state.profile.city = elements.cityInput.value.trim();
    state.profile.place = elements.placeInput.value.trim();

    if (state.profile.nickname || state.profile.birthYear || state.profile.city || state.profile.place) {
      state.profile.hasUserInteracted = true;
    }
  }

  /**
   * Обновление отображения пароля в реальном времени
   */
  function updatePasswordLiveView(pwdAnalysis) {
    if (!pwdAnalysis.hasData) {
      elements.pwdStatusBadge.textContent = 'Недостаточно данных';
      elements.pwdStatusBadge.className = 'badge badge-neutral';
      elements.pwdRiskProgressBar.style.width = '0%';
      elements.pwdRiskProgressBar.className = 'progress-bar';

      resetCriterion(elements.critLength, 'Длина (от 12 знаков)');
      resetCriterion(elements.critVariety, 'Наборы символов (a-z, A-Z, 0-9, спецзнаки)');
      resetCriterion(elements.critSequences, 'Без простых последовательностей');
      resetCriterion(elements.critProfile, 'Без личных данных профиля');

      elements.pwdReasonsBox.hidden = true;
      elements.pwdReasonsList.innerHTML = '';
      return;
    }

    // Бейдж статуса
    let badgeClass = 'badge badge-low';
    let barClass = 'progress-bar risk-low';
    let statusText = 'Надёжный';

    if (pwdAnalysis.riskLevel === 'Повышенный') {
      badgeClass = 'badge badge-high';
      barClass = 'progress-bar risk-high';
      statusText = 'Слабый пароль (Повышенный риск)';
    } else if (pwdAnalysis.riskLevel === 'Умеренный') {
      badgeClass = 'badge badge-moderate';
      barClass = 'progress-bar risk-moderate';
      statusText = 'Средний пароль (Умеренный риск)';
    } else {
      statusText = 'Надёжный пароль (Низкий риск)';
    }

    elements.pwdStatusBadge.textContent = statusText;
    elements.pwdStatusBadge.className = badgeClass;
    elements.pwdRiskProgressBar.style.width = `${pwdAnalysis.score}%`;
    elements.pwdRiskProgressBar.className = barClass;

    // Проверка критериев
    const m = pwdAnalysis.metrics;

    // 1. Длина
    if (m.length >= 12) {
      setCriterion(elements.critLength, `Длина: ${m.length} знаков (отлично)`, true);
    } else if (m.length >= 8) {
      setCriterion(elements.critLength, `Длина: ${m.length} знаков (желательно 12+)`, false, 'warn');
    } else {
      setCriterion(elements.critLength, `Длина: ${m.length} знаков (критически мало)`, false, 'fail');
    }

    // 2. Разнообразие
    if (m.varietyCount >= 3) {
      setCriterion(elements.critVariety, `Разнообразие: ${m.varietyCount} из 4 типов`, true);
    } else {
      setCriterion(elements.critVariety, `Разнообразие: всего ${m.varietyCount} из 4 типов`, false, 'fail');
    }

    // 3. Последовательности и повторы
    if (!m.hasSequences && !m.hasRepeats && !m.hasCommonWord) {
      setCriterion(elements.critSequences, 'Шаблоны и повторы не обнаружены', true);
    } else {
      const found = [];
      if (m.hasSequences) found.push('последовательность');
      if (m.hasRepeats) found.push('повторы');
      if (m.hasCommonWord) found.push('словарное слово');
      setCriterion(elements.critSequences, `Обнаружено: ${found.join(', ')}`, false, 'fail');
    }

    // 4. Личные данные
    if (!m.hasProfileOverlap) {
      setCriterion(elements.critProfile, 'Личные маркеры профиля не найдены', true);
    } else {
      setCriterion(elements.critProfile, 'Обнаружены совпадения с профилем', false, 'fail');
    }

    // Список причин
    elements.pwdReasonsBox.hidden = false;
    elements.pwdReasonsList.innerHTML = '';
    pwdAnalysis.reasons.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      elements.pwdReasonsList.appendChild(li);
    });
  }

  function setCriterion(el, text, isSuccess, type = 'success') {
    el.querySelector('.crit-text').textContent = text;
    const icon = el.querySelector('.crit-icon');
    if (isSuccess) {
      el.className = 'criteria-item met';
      icon.textContent = '✓';
    } else {
      el.className = type === 'warn' ? 'criteria-item' : 'criteria-item fail';
      icon.textContent = type === 'warn' ? '!' : '✗';
    }
  }

  function resetCriterion(el, defaultText) {
    el.className = 'criteria-item';
    el.querySelector('.crit-icon').textContent = '•';
    el.querySelector('.crit-text').textContent = defaultText;
  }

  /**
   * Отображение результатов полного аудита
   */
  function renderAuditResults(auditResult) {
    state.lastAuditResult = auditResult;

    if (!auditResult.hasData) {
      // Пустое состояние
      elements.totalScoreNumber.textContent = '—';
      elements.totalRiskBadge.textContent = 'Недостаточно данных';
      elements.totalRiskBadge.className = 'badge badge-neutral';
      elements.totalScaleFill.style.width = '0%';
      elements.totalScaleFill.className = 'scale-bar-fill';
      elements.totalExplanationText.textContent = 'Заполните параметры в разделах выше или нажмите «Загрузить пример», чтобы система рассчитала аналитический индекс риска.';

      // Суб-индексы
      resetSubCard(elements.pwdSubScoreNum, elements.pwdSubScoreBadge, elements.pwdSubDesc, 'Оценка устойчивости пароля к типовым методам подбора.');
      resetSubCard(elements.profSubScoreNum, elements.profSubScoreBadge, elements.profSubDesc, 'Объём сведений, доступных посторонним в открытом профиле.');
      resetSubCard(elements.footSubScoreNum, elements.footSubScoreBadge, elements.footSubDesc, 'Поведенческие риски, повторное использование и геометки.');

      // Сценарии
      elements.scenariosList.innerHTML = `
        <div class="empty-state-notice">
          <p>Сценарии будут сформированы после ввода тестовых параметров профиля и пароля.</p>
        </div>
      `;

      // Рекомендации
      elements.recommendationsList.innerHTML = '<p class="recs-placeholder">Рекомендации появятся после расчёта индексов.</p>';
      return;
    }

    // Общий счет
    const score = auditResult.totalRiskScore;
    elements.totalScoreNumber.textContent = String(score);
    elements.totalScaleFill.style.width = `${score}%`;

    let totalBadgeClass = 'badge badge-low';
    if (auditResult.riskLevel === 'Повышенный') {
      totalBadgeClass = 'badge badge-high';
    } else if (auditResult.riskLevel === 'Умеренный') {
      totalBadgeClass = 'badge badge-moderate';
    }
    elements.totalRiskBadge.textContent = auditResult.riskLevel;
    elements.totalRiskBadge.className = totalBadgeClass;
    elements.totalExplanationText.textContent = auditResult.summaryText;

    // Суб-индексы
    const comp = auditResult.components;
    updateSubCard(
      elements.pwdSubScoreNum,
      elements.pwdSubScoreBadge,
      elements.pwdSubDesc,
      comp.password,
      'Индекс риска пароля на основе длины, энтропии и структуры.'
    );
    updateSubCard(
      elements.profSubScoreNum,
      elements.profSubScoreBadge,
      elements.profSubDesc,
      comp.profile,
      'Индекс открытости контактных данных и идентификаторов.'
    );
    updateSubCard(
      elements.footSubScoreNum,
      elements.footSubScoreBadge,
      elements.footSubDesc,
      comp.footprint,
      'Индекс рисков цифрового следа и поведенческих факторов.'
    );

    // Сценарии
    renderScenarios(auditResult.scenarios);

    // Рекомендации
    renderRecommendations(auditResult);
  }

  function resetSubCard(numEl, badgeEl, descEl, defaultDesc) {
    numEl.textContent = '—';
    badgeEl.textContent = '—';
    badgeEl.className = 'badge badge-neutral';
    descEl.textContent = defaultDesc;
  }

  function updateSubCard(numEl, badgeEl, descEl, componentAnalysis, defaultDesc) {
    if (!componentAnalysis || !componentAnalysis.hasData) {
      resetSubCard(numEl, badgeEl, descEl, defaultDesc);
      return;
    }

    numEl.textContent = String(componentAnalysis.score);
    badgeEl.textContent = componentAnalysis.riskLevel;

    let bClass = 'badge badge-low';
    if (componentAnalysis.riskLevel === 'Повышенный') bClass = 'badge badge-high';
    else if (componentAnalysis.riskLevel === 'Умеренный') bClass = 'badge badge-moderate';
    badgeEl.className = bClass;

    if (componentAnalysis.reasons && componentAnalysis.reasons.length > 0) {
      descEl.textContent = componentAnalysis.reasons[0];
    } else {
      descEl.textContent = defaultDesc;
    }
  }

  /**
   * Отрисовка сценариев угроз в виде 4-звенных цепочек
   */
  function renderScenarios(scenarios) {
    if (!scenarios || scenarios.length === 0) {
      elements.scenariosList.innerHTML = `
        <div class="empty-state-notice">
          <p>В текущих введённых данных критических связок для моделирования сценариев не обнаружено.</p>
        </div>
      `;
      return;
    }

    elements.scenariosList.innerHTML = '';
    scenarios.forEach((sc, idx) => {
      const card = document.createElement('div');
      card.className = 'scenario-card-item';
      card.innerHTML = `
        <div class="scenario-card-header">
          <div class="scenario-title-text">${idx + 1}. ${escapeHtml(sc.title)}</div>
          <span class="scenario-badge-type">Возможный сценарий</span>
        </div>
        <div class="chain-steps-flow">
          <div class="chain-node node-exposed">
            <span class="node-tag">Открытые сведения:</span>
            <span class="node-text">${escapeHtml(sc.dataChain.exposed)}</span>
          </div>
          <div class="chain-node node-link">
            <span class="node-tag">Связка данных:</span>
            <span class="node-text">${escapeHtml(sc.dataChain.link)}</span>
          </div>
          <div class="chain-node node-risk">
            <span class="node-tag">Возможный риск:</span>
            <span class="node-text">${escapeHtml(sc.dataChain.risk)}</span>
          </div>
          <div class="chain-node node-action">
            <span class="node-tag">Способ защиты:</span>
            <span class="node-text">${escapeHtml(sc.dataChain.action)}</span>
          </div>
        </div>
      `;
      elements.scenariosList.appendChild(card);
    });
  }

  /**
   * Отрисовка объединённого плана рекомендаций
   */
  function renderRecommendations(auditResult) {
    const allRecs = new Set();

    if (auditResult.components.password.hasData) {
      auditResult.components.password.recommendations.forEach(r => allRecs.add(r));
    }
    if (auditResult.components.profile.hasData) {
      auditResult.components.profile.recommendations.forEach(r => allRecs.add(r));
    }
    if (auditResult.components.footprint.hasData) {
      auditResult.components.footprint.recommendations.forEach(r => allRecs.add(r));
    }

    const recsArray = Array.from(allRecs);

    if (recsArray.length === 0) {
      elements.recommendationsList.innerHTML = '<p class="recs-placeholder">Существенных замечаний нет. Продолжайте поддерживать цифровую гигиену.</p>';
      return;
    }

    const ol = document.createElement('ol');
    ol.className = 'recs-ordered-list';
    recsArray.forEach(rec => {
      const li = document.createElement('li');
      li.textContent = rec;
      ol.appendChild(li);
    });

    elements.recommendationsList.innerHTML = '';
    elements.recommendationsList.appendChild(ol);
  }

  /**
   * Главная функция запуска локального аудита
   */
  function runAudit() {
    syncInputsToState();

    const pwdAnalysis = SecurityAnalyzer.analyzePassword(state.password, state.profile);
    const profAnalysis = SecurityAnalyzer.analyzeProfile(state.profile);
    const footAnalysis = SecurityAnalyzer.analyzeFootprint(state.profile);

    updatePasswordLiveView(pwdAnalysis);

    const total = SecurityAnalyzer.calculateTotalIndex(pwdAnalysis, profAnalysis, footAnalysis);
    renderAuditResults(total);
  }

  /**
   * Загрузка демонстрационного примера (Alex2008)
   */
  function loadDemoScenario() {
    elements.passwordInput.value = 'Alex2008';
    elements.nicknameInput.value = 'Alex';
    elements.birthYearInput.value = '2008';
    elements.cityInput.value = 'Энск';
    elements.placeInput.value = 'Колледж связи';

    // Переключатели
    setToggleValue(elements.togglePhone, false, 'phonePublic');
    setToggleValue(elements.toggleEmail, false, 'emailPublic');
    setToggleValue(elements.toggleLocationPhotos, false, 'locationPhotos');
    setToggleValue(elements.toggleHabitsLocation, true, 'habitsLocation');
    setToggleValue(elements.togglePasswordReuse, true, 'passwordReuse');

    state.profile.hasUserInteracted = true;

    runAudit();

    showToast('Загружен демонстрационный пример (Alex, 2008, Alex2008).');
  }

  function setToggleValue(btn, val, key) {
    btn.setAttribute('aria-checked', String(val));
    state.profile[key] = val;
  }

  /**
   * Полный сброс всех данных
   */
  function resetAll() {
    elements.passwordInput.value = '';
    elements.nicknameInput.value = '';
    elements.birthYearInput.value = '';
    elements.cityInput.value = '';
    elements.placeInput.value = '';

    setToggleValue(elements.togglePhone, false, 'phonePublic');
    setToggleValue(elements.toggleEmail, false, 'emailPublic');
    setToggleValue(elements.toggleLocationPhotos, false, 'locationPhotos');
    setToggleValue(elements.toggleHabitsLocation, false, 'habitsLocation');
    setToggleValue(elements.togglePasswordReuse, false, 'passwordReuse');

    state.password = '';
    state.profile = {
      nickname: '',
      birthYear: '',
      city: '',
      place: '',
      phonePublic: false,
      emailPublic: false,
      locationPhotos: false,
      habitsLocation: false,
      passwordReuse: false,
      hasUserInteracted: false
    };
    state.lastAuditResult = null;

    runAudit();
    showToast('Все поля и расчёты сброшены.');
  }

  /**
   * Очистка только поля пароля
   */
  function clearPassword() {
    elements.passwordInput.value = '';
    state.password = '';
    runAudit();
    showToast('Поле пароля очищено.');
    elements.passwordInput.focus();
  }

  /**
   * Переключение видимости пароля
   */
  function togglePasswordVisibility() {
    const isPass = elements.passwordInput.type === 'password';
    elements.passwordInput.type = isPass ? 'text' : 'password';
    elements.pwdToggleIcon.textContent = isPass ? '🔒' : '👁️';
    elements.btnTogglePassword.setAttribute('aria-label', isPass ? 'Скрыть пароль' : 'Показать пароль');
  }

  /**
   * Экспорт отчёта HTML
   */
  function exportHtmlReport() {
    syncInputsToState();
    const result = state.lastAuditResult || SecurityAnalyzer.calculateTotalIndex(
      SecurityAnalyzer.analyzePassword(state.password, state.profile),
      SecurityAnalyzer.analyzeProfile(state.profile),
      SecurityAnalyzer.analyzeFootprint(state.profile)
    );

    const htmlContent = ReportGenerator.generateHtmlReport(result);
    const dateStr = new Date().toISOString().slice(0, 10);
    ReportGenerator.downloadBlob(htmlContent, `DigitalShield_Report_${dateStr}.html`, 'text/html');

    showToast('Отчёт HTML сохранён на ваш компьютер. Персональные данные исключены.');
  }

  /**
   * Экспорт отчёта TXT
   */
  function exportTxtReport() {
    syncInputsToState();
    const result = state.lastAuditResult || SecurityAnalyzer.calculateTotalIndex(
      SecurityAnalyzer.analyzePassword(state.password, state.profile),
      SecurityAnalyzer.analyzeProfile(state.profile),
      SecurityAnalyzer.analyzeFootprint(state.profile)
    );

    const txtContent = ReportGenerator.generateTextReport(result);
    const dateStr = new Date().toISOString().slice(0, 10);
    ReportGenerator.downloadBlob(txtContent, `DigitalShield_Report_${dateStr}.txt`, 'text/plain');

    showToast('Отчёт TXT сохранён на ваш компьютер. Персональные данные исключены.');
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Подключение обработчиков событий
   */
  function initEvents() {
    // Ввод пароля
    elements.passwordInput.addEventListener('input', runAudit);
    elements.btnTogglePassword.addEventListener('click', togglePasswordVisibility);
    elements.btnClearPassword.addEventListener('click', clearPassword);

    // Ввод профиля
    elements.nicknameInput.addEventListener('input', runAudit);
    elements.birthYearInput.addEventListener('input', runAudit);
    elements.cityInput.addEventListener('input', runAudit);
    elements.placeInput.addEventListener('input', runAudit);

    // Переключатели
    setupToggle(elements.togglePhone, 'phonePublic');
    setupToggle(elements.toggleEmail, 'emailPublic');
    setupToggle(elements.toggleLocationPhotos, 'locationPhotos');
    setupToggle(elements.toggleHabitsLocation, 'habitsLocation');
    setupToggle(elements.togglePasswordReuse, 'passwordReuse');

    // Кнопки действий
    elements.btnRunAudit.addEventListener('click', () => {
      runAudit();
      showToast('Аудит обновлён.');
      elements.totalScoreNumber.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    elements.btnLoadDemo.addEventListener('click', loadDemoScenario);
    elements.btnResetAll.addEventListener('click', resetAll);
    elements.btnExportHtml.addEventListener('click', exportHtmlReport);
    elements.btnExportTxt.addEventListener('click', exportTxtReport);

    elements.toastClose.addEventListener('click', () => {
      elements.statusToast.hidden = true;
    });

    // Инициализация пустого состояния
    runAudit();
  }

  // Запуск после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEvents);
  } else {
    initEvents();
  }
})();
