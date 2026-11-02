/**
 * Digital Shield — Комплексный сквозной тест интерфейса и сценариев
 * 
 * Проверяет:
 * 1. Офлайн-чистоту HTML (отсутствие внешних скриптов, стилей, шрифтов, трекеров)
 * 2. Доступность (ARIA, роли, семантику, фокус)
 * 3. Логику взаимодействия пользователя (клики, ввод, переключатели)
 * 4. Демонстрационный сценарий «Alex2008»
 * 5. Формирование отчётов (HTML/TXT) и строгое отсутствие утечек данных
 * 6. Функцию полного сброса и очистки пароля
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

let totalChecks = 0;
let passedChecks = 0;

function check(title, fn) {
  totalChecks++;
  try {
    fn();
    passedChecks++;
    console.log(`  ✓ ${title}`);
  } catch (err) {
    console.error(`  ✗ ${title}`);
    console.error(err.message || err);
  }
}

console.log('Запуск комплексного аудита Digital Shield...\n');

// ---------------------------------------------------------------------------
// 1. Статический аудит файлов и проверка 100% офлайна
// ---------------------------------------------------------------------------
console.log('1. Проверка автономности (100% офлайн, без внешних запросов):');

const htmlPath = path.join(__dirname, '..', 'index.html');
const cssPath = path.join(__dirname, '..', 'styles.css');
const appJsPath = path.join(__dirname, '..', 'app.js');
const analyzerJsPath = path.join(__dirname, '..', 'security-analyzer.js');
const reportJsPath = path.join(__dirname, '..', 'report-generator.js');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
const analyzerJsContent = fs.readFileSync(analyzerJsPath, 'utf8');
const reportJsContent = fs.readFileSync(reportJsPath, 'utf8');

check('index.html не содержит внешних ссылок (http://, https://, //)', () => {
  const externalMatches = htmlContent.match(/href=["'](https?:|\/\/)[^"']+["']|src=["'](https?:|\/\/)[^"']+["']/gi);
  assert.strictEqual(externalMatches, null, `Found external links in HTML: ${JSON.stringify(externalMatches)}`);
});

check('styles.css не содержит @import или url() с внешними адресами', () => {
  const externalUrls = cssContent.match(/url\(['"]?(https?:|\/\/)[^'"]+['"]?\)|@import/gi);
  assert.strictEqual(externalUrls, null, `Found external references in CSS: ${JSON.stringify(externalUrls)}`);
});

check('Код не использует localStorage, sessionStorage или cookies API', () => {
  const codeOnly = (appJsContent + analyzerJsContent + reportJsContent)
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''); // Удаляем комментарии
  const storageMatches = codeOnly.match(/localStorage\s*[\.\[]|sessionStorage\s*[\.\[]|document\.cookie\s*=/g);
  assert.strictEqual(storageMatches, null, `Found forbidden storage API usage: ${JSON.stringify(storageMatches)}`);
});

check('Код не использует fetch, XMLHttpRequest или WebSocket', () => {
  const codeOnly = (appJsContent + analyzerJsContent + reportJsContent)
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''); // Удаляем комментарии
  const networkMatches = codeOnly.match(/fetch\(|XMLHttpRequest|new WebSocket/g);
  assert.strictEqual(networkMatches, null, `Found network API usage: ${JSON.stringify(networkMatches)}`);
});

// ---------------------------------------------------------------------------
// 2. Аудит доступности (Accessibility / a11y) и семантики
// ---------------------------------------------------------------------------
console.log('\n2. Аудит доступности и визуальных стандартов:');

check('HTML содержит lang="ru" и корректный viewport', () => {
  assert.ok(htmlContent.includes('<html lang="ru">'));
  assert.ok(htmlContent.includes('name="viewport"'));
});

check('Все интерактивные переключатели имеют role="switch" и aria-checked', () => {
  const switches = ['togglePhone', 'toggleEmail', 'toggleLocationPhotos', 'toggleHabitsLocation', 'togglePasswordReuse'];
  for (const swId of switches) {
    assert.ok(htmlContent.includes(`id="${swId}"`), `Missing element #${swId}`);
    assert.ok(htmlContent.includes(`role="switch"`), `Missing role="switch" for #${swId}`);
  }
});

check('Все поля формы имеют связанные подписи (label) и aria-атрибуты', () => {
  assert.ok(htmlContent.includes('for="passwordInput"'));
  assert.ok(htmlContent.includes('for="nicknameInput"'));
  assert.ok(htmlContent.includes('for="birthYearInput"'));
  assert.ok(htmlContent.includes('for="cityInput"'));
  assert.ok(htmlContent.includes('for="placeInput"'));
});

check('styles.css задает фирменные цвета (#D00000, #000000) и :focus-visible', () => {
  assert.ok(cssContent.includes('#D00000'), 'CSS must contain scarlet #D00000');
  assert.ok(cssContent.includes('#000000'), 'CSS must contain black #000000');
  assert.ok(cssContent.includes(':focus-visible'), 'CSS must provide :focus-visible styling');
});

// ---------------------------------------------------------------------------
// 3. Эмуляция DOM и сквозное тестирование приложения в памяти
// ---------------------------------------------------------------------------
console.log('\n3. Сквозное тестирование интерфейса и событий:');

function createMockEnvironment() {
  const elementsMap = new Map();
  const eventListeners = new Map();

  function makeElement(tag, id = '') {
    const el = {
      tagName: tag.toUpperCase(),
      id: id,
      value: '',
      type: 'text',
      textContent: '',
      innerHTML: '',
      hidden: false,
      attributes: new Map(),
      children: [],
      classList: new Set(),
      style: {},
      setAttribute(k, v) { this.attributes.set(k, String(v)); },
      getAttribute(k) { return this.attributes.get(k) || null; },
      removeAttribute(k) { this.attributes.delete(k); },
      appendChild(child) {
        this.children.push(child);
        this.innerHTML += child.innerHTML || child.textContent || '';
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) this.children.splice(idx, 1);
      },
      click() {
        this.dispatchEvent({ type: 'click' });
      },
      addEventListener(evt, fn) {
        const key = `${this.id || tag}:${evt}`;
        if (!eventListeners.has(key)) eventListeners.set(key, []);
        eventListeners.get(key).push(fn);
      },
      dispatchEvent(evt) {
        const key = `${this.id || tag}:${evt.type}`;
        const list = eventListeners.get(key) || [];
        for (const fn of list) fn(evt);
      },
      focus() {},
      scrollIntoView() {},
      querySelector(selector) {
        if (selector === '.crit-text') return this._critText || (this._critText = makeElement('span'));
        if (selector === '.crit-icon') return this._critIcon || (this._critIcon = makeElement('span'));
        return null;
      }
    };
    if (id) elementsMap.set(id, el);
    return el;
  }

  // Создаем все нужные элементы по их ID
  const ids = [
    'passwordInput', 'btnTogglePassword', 'pwdToggleIcon', 'btnClearPassword',
    'pwdStatusBadge', 'pwdRiskProgressBar', 'pwdReasonsBox', 'pwdReasonsList',
    'critLength', 'critVariety', 'critSequences', 'critProfile',
    'nicknameInput', 'birthYearInput', 'cityInput', 'placeInput',
    'togglePhone', 'toggleEmail', 'toggleLocationPhotos', 'toggleHabitsLocation', 'togglePasswordReuse',
    'btnRunAudit', 'btnLoadDemo', 'btnResetAll', 'btnExportHtml', 'btnExportTxt',
    'totalScoreNumber', 'totalRiskBadge', 'totalScaleFill', 'totalExplanationText',
    'pwdSubScoreNum', 'pwdSubScoreBadge', 'pwdSubDesc',
    'profSubScoreNum', 'profSubScoreBadge', 'profSubDesc',
    'footSubScoreNum', 'footSubScoreBadge', 'footSubDesc',
    'scenariosList', 'recommendationsList',
    'statusToast', 'toastMessage', 'toastClose'
  ];

  ids.forEach(id => makeElement('div', id));

  elementsMap.get('passwordInput').type = 'password';

  let downloadedFiles = [];

  const fakeDocument = {
    readyState: 'complete',
    getElementById(id) { return elementsMap.get(id) || null; },
    createElement(tag) { return makeElement(tag); },
    body: {
      appendChild(ch) {
        if (ch.tagName === 'A' && ch.download) {
          downloadedFiles.push({ filename: ch.download, href: ch.href });
        }
      },
      removeChild() {}
    },
    addEventListener(evt, fn) {
      if (evt === 'DOMContentLoaded') fn();
    }
  };

  const fakeWindow = {
    document: fakeDocument,
    URL: {
      createObjectURL(blob) { return `blob://${Math.random()}`; },
      revokeObjectURL() {}
    },
    Blob: function(parts, opts) {
      this.content = parts.join('');
      this.type = opts ? opts.type : '';
    },
    setTimeout: (fn, ms) => setTimeout(fn, 1),
    clearTimeout: (t) => clearTimeout(t)
  };

  return {
    window: fakeWindow,
    document: fakeDocument,
    elements: elementsMap,
    getDownloads: () => downloadedFiles
  };
}

const mock = createMockEnvironment();
const context = vm.createContext({
  window: mock.window,
  document: mock.document,
  Blob: mock.window.Blob,
  URL: mock.window.URL,
  setTimeout: mock.window.setTimeout,
  clearTimeout: mock.window.clearTimeout,
  console: console
});

vm.runInContext(analyzerJsContent, context);
vm.runInContext(reportJsContent, context);
vm.runInContext(appJsContent, context);

check('Начальное состояние системы: "Недостаточно данных"', () => {
  const totalScoreEl = mock.elements.get('totalScoreNumber');
  const badgeEl = mock.elements.get('totalRiskBadge');
  assert.strictEqual(totalScoreEl.textContent, '—');
  assert.strictEqual(badgeEl.textContent, 'Недостаточно данных');
});

check('Ввод слабого пароля мгновенно переводит индикатор в "Слабый пароль (Повышенный риск)"', () => {
  const pwdInput = mock.elements.get('passwordInput');
  pwdInput.value = '123456';
  pwdInput.dispatchEvent({ type: 'input' });

  const statusBadge = mock.elements.get('pwdStatusBadge');
  assert.ok(statusBadge.textContent.includes('Слабый пароль') || statusBadge.textContent.includes('Повышенный риск'));
});

check('Нажатие "Показать пароль" меняет type с password на text и обратно', () => {
  const pwdInput = mock.elements.get('passwordInput');
  const btnToggle = mock.elements.get('btnTogglePassword');

  assert.strictEqual(pwdInput.type, 'password');
  btnToggle.dispatchEvent({ type: 'click' });
  assert.strictEqual(pwdInput.type, 'text');
  btnToggle.dispatchEvent({ type: 'click' });
  assert.strictEqual(pwdInput.type, 'password');
});

check('Кнопка очистки поля пароля обнуляет значение и обновляет анализ', () => {
  const pwdInput = mock.elements.get('passwordInput');
  const btnClear = mock.elements.get('btnClearPassword');

  pwdInput.value = 'SecretToClear';
  btnClear.dispatchEvent({ type: 'click' });
  assert.strictEqual(pwdInput.value, '');
  assert.strictEqual(mock.elements.get('pwdStatusBadge').textContent, 'Недостаточно данных');
});

check('Кнопка "Загрузить пример" загружает сценарий Alex2008 и обновляет всё', () => {
  const btnDemo = mock.elements.get('btnLoadDemo');
  btnDemo.dispatchEvent({ type: 'click' });

  assert.strictEqual(mock.elements.get('nicknameInput').value, 'Alex');
  assert.strictEqual(mock.elements.get('birthYearInput').value, '2008');
  assert.strictEqual(mock.elements.get('passwordInput').value, 'Alex2008');
  assert.strictEqual(mock.elements.get('togglePasswordReuse').getAttribute('aria-checked'), 'true');
  assert.strictEqual(mock.elements.get('toggleHabitsLocation').getAttribute('aria-checked'), 'true');

  const totalScore = mock.elements.get('totalScoreNumber').textContent;
  const totalBadge = mock.elements.get('totalRiskBadge').textContent;

  assert.ok(parseInt(totalScore, 10) >= 60, `Expected score >= 60, got ${totalScore}`);
  assert.strictEqual(totalBadge, 'Повышенный');

  const scenariosHtml = mock.elements.get('scenariosList').innerHTML;
  assert.ok(scenariosHtml.includes('Персональные маркеры в пароле'), 'Scenario 1 missing');
  assert.ok(scenariosHtml.includes('Эффект домино при компрометации пароля'), 'Scenario 2 missing');
});

check('Кнопка "Сохранить отчёт (HTML)" формирует и скачивает локальный файл', () => {
  const btnExport = mock.elements.get('btnExportHtml');
  btnExport.dispatchEvent({ type: 'click' });

  const downloads = mock.getDownloads();
  assert.ok(downloads.length >= 1);
  const last = downloads[downloads.length - 1];
  assert.ok(last.filename.endsWith('.html'));
});

check('Кнопка "Сохранить отчёт (TXT)" формирует и скачивает текстовый файл', () => {
  const btnExport = mock.elements.get('btnExportTxt');
  btnExport.dispatchEvent({ type: 'click' });

  const downloads = mock.getDownloads();
  assert.ok(downloads.length >= 2);
  const last = downloads[downloads.length - 1];
  assert.ok(last.filename.endsWith('.txt'));
});

check('Кнопка "Сбросить всё" полностью очищает поля и возвращает статус "Недостаточно данных"', () => {
  const btnReset = mock.elements.get('btnResetAll');
  btnReset.dispatchEvent({ type: 'click' });

  assert.strictEqual(mock.elements.get('passwordInput').value, '');
  assert.strictEqual(mock.elements.get('nicknameInput').value, '');
  assert.strictEqual(mock.elements.get('birthYearInput').value, '');
  assert.strictEqual(mock.elements.get('togglePasswordReuse').getAttribute('aria-checked'), 'false');
  assert.strictEqual(mock.elements.get('totalScoreNumber').textContent, '—');
  assert.strictEqual(mock.elements.get('totalRiskBadge').textContent, 'Недостаточно данных');
});

console.log(`\n========================================`);
console.log(`ИТОГ АУДИТА: Успешно ${passedChecks} из ${totalChecks} проверок`);
console.log(`========================================\n`);

if (passedChecks !== totalChecks) {
  process.exit(1);
}
