/**
 * Unit Tests for Digital Shield
 */

const assert = require('assert');
const SecurityAnalyzer = require('../security-analyzer.js');
const ReportGenerator = require('../report-generator.js');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(err);
  }
}

console.log('Запуск модульных тестов Digital Shield...\n');

// 1. Тесты анализа паролей
console.log('1. Тестирование анализатора паролей (analyzePassword):');

it('Пустой пароль должен возвращать hasData: false и score: null', () => {
  const res = SecurityAnalyzer.analyzePassword('');
  assert.strictEqual(res.hasData, false);
  assert.strictEqual(res.score, null);
  assert.strictEqual(res.riskLevel, 'Недостаточно данных');
});

it('Слабый короткий пароль "12345" должен давать Повышенный риск (>= 67)', () => {
  const res = SecurityAnalyzer.analyzePassword('12345');
  assert.strictEqual(res.hasData, true);
  assert.ok(res.score >= 67, `Expected score >= 67, got ${res.score}`);
  assert.strictEqual(res.riskLevel, 'Повышенный');
});

it('Пароль со словарным словом "password" должен определяться как шаблон', () => {
  const res = SecurityAnalyzer.analyzePassword('password');
  assert.strictEqual(res.metrics.hasCommonWord, true);
  assert.ok(res.reasons.some(r => r.includes('словарное слово') || r.includes('стандартный шаблон')));
});

it('Пароль с клавиатурной последовательностью "qwerty" должен выявлять паттерн', () => {
  const res = SecurityAnalyzer.analyzePassword('qwerty1234');
  assert.strictEqual(res.metrics.hasSequences, true);
});

it('Пароль с повторяющимися символами "aaa111" должен выявлять повторы', () => {
  const res = SecurityAnalyzer.analyzePassword('aaaBBB111');
  assert.strictEqual(res.metrics.hasRepeats, true);
});

it('Сложный длинный пароль "K#9xP$mQ!2vL&7zT" должен давать Низкий риск (<= 33)', () => {
  const res = SecurityAnalyzer.analyzePassword('K#9xP$mQ!2vL&7zT');
  assert.strictEqual(res.hasData, true);
  assert.ok(res.score <= 33, `Expected score <= 33, got ${res.score}`);
  assert.strictEqual(res.riskLevel, 'Низкий');
  assert.strictEqual(res.metrics.varietyCount, 4);
});

it('Пароль с данными профиля ("Alex2008") должен выявлять совпадения', () => {
  const profile = { nickname: 'Alex', birthYear: '2008' };
  const res = SecurityAnalyzer.analyzePassword('Alex2008', profile);
  assert.strictEqual(res.metrics.hasProfileOverlap, true);
  assert.ok(res.reasons.some(r => r.includes('псевдонимом')));
  assert.ok(res.reasons.some(r => r.includes('годом рождения')));
  // Проверяем, что в пояснениях нет раскрытия символов
  assert.ok(!res.reasons.some(r => r.includes('Alex2008')));
});

// 2. Тесты профиля
console.log('\n2. Тестирование анализатора профиля (analyzeProfile):');

it('Пустой профиль должен возвращать hasData: false', () => {
  const res = SecurityAnalyzer.analyzeProfile({});
  assert.strictEqual(res.hasData, false);
  assert.strictEqual(res.score, null);
});

it('Профиль с открытым телефоном и email должен давать высокий риск', () => {
  const res = SecurityAnalyzer.analyzeProfile({
    phonePublic: true,
    emailPublic: true
  });
  assert.strictEqual(res.hasData, true);
  assert.ok(res.score >= 60);
  assert.ok(res.exposedFactors.includes('Открытый номер телефона'));
  assert.ok(res.exposedFactors.includes('Открытый адрес электронной почты'));
});

it('Связка "Город + Учебное заведение" должна давать фактор связки', () => {
  const res = SecurityAnalyzer.analyzeProfile({
    city: 'Энск',
    place: 'Колледж'
  });
  assert.ok(res.exposedFactors.includes('Связка «Город + Учебное заведение/работа»'));
});

// 3. Тесты цифрового следа
console.log('\n3. Тестирование анализатора следа (analyzeFootprint):');

it('Неинициализированный след должен возвращать hasData: false', () => {
  const res = SecurityAnalyzer.analyzeFootprint({ hasUserInteracted: false });
  assert.strictEqual(res.hasData, false);
});

it('Флаг повторного использования пароля должен давать повышенный риск', () => {
  const res = SecurityAnalyzer.analyzeFootprint({
    hasUserInteracted: true,
    passwordReuse: true
  });
  assert.strictEqual(res.hasData, true);
  assert.ok(res.reasons.some(r => r.includes('Повторное использование одного пароля')));
});

// 4. Тесты построения сценариев
console.log('\n4. Тестирование построения цепочек сценариев:');

it('Должен генерировать 4-звенную цепочку (Открытые сведения -> Связка -> Риск -> Защита)', () => {
  const profile = { nickname: 'Alex', birthYear: '2008', phonePublic: true };
  const pwdRes = SecurityAnalyzer.analyzePassword('Alex2008', profile);
  const profRes = SecurityAnalyzer.analyzeProfile(profile);
  const footRes = SecurityAnalyzer.analyzeFootprint({ hasUserInteracted: true, passwordReuse: true });

  const scenarios = SecurityAnalyzer.buildScenarios(pwdRes, profRes, footRes);
  assert.ok(scenarios.length >= 3, `Expected at least 3 scenarios, got ${scenarios.length}`);

  for (const sc of scenarios) {
    assert.ok(sc.title, 'Scenario must have title');
    assert.ok(sc.dataChain.exposed, 'Must have exposed');
    assert.ok(sc.dataChain.link, 'Must have link');
    assert.ok(sc.dataChain.risk, 'Must have risk');
    assert.ok(sc.dataChain.action, 'Must have action');
  }
});

// 5. Тесты сводного индекса
console.log('\n5. Тестирование сводного индекса:');

it('Пустые данные должны возвращать "Недостаточно данных"', () => {
  const pEmpty = SecurityAnalyzer.analyzePassword('');
  const prEmpty = SecurityAnalyzer.analyzeProfile({});
  const fEmpty = SecurityAnalyzer.analyzeFootprint({});

  const total = SecurityAnalyzer.calculateTotalIndex(pEmpty, prEmpty, fEmpty);
  assert.strictEqual(total.hasData, false);
  assert.strictEqual(total.totalRiskScore, null);
  assert.strictEqual(total.riskLevel, 'Недостаточно данных');
});

it('Взвешенный индекс для демонстрационного сценария Alex2008', () => {
  const profile = {
    nickname: 'Alex',
    birthYear: '2008',
    city: 'Энск',
    place: 'Колледж связи',
    hasUserInteracted: true,
    passwordReuse: true,
    habitsLocation: true
  };
  const pwdRes = SecurityAnalyzer.analyzePassword('Alex2008', profile);
  const profRes = SecurityAnalyzer.analyzeProfile(profile);
  const footRes = SecurityAnalyzer.analyzeFootprint(profile);

  const total = SecurityAnalyzer.calculateTotalIndex(pwdRes, profRes, footRes);
  assert.strictEqual(total.hasData, true);
  assert.ok(typeof total.totalRiskScore === 'number');
  assert.ok(total.totalRiskScore >= 60, `Demo scenario should have high risk score, got ${total.totalRiskScore}`);
  assert.strictEqual(total.riskLevel, 'Повышенный');
});

// 6. Тестирование генератора отчетов и конфиденциальности
console.log('\n6. Тестирование генератора отчетов и приватности:');

it('В отчетах TXT и HTML НИКОГДА не должно быть введенного пароля и реальных значений', () => {
  const SECRET_PASS = 'Alex2008';
  const SECRET_NICK = 'Alex';
  const SECRET_CITY = 'Энск';

  const profile = {
    nickname: SECRET_NICK,
    birthYear: '2008',
    city: SECRET_CITY,
    place: 'Колледж связи',
    hasUserInteracted: true,
    passwordReuse: true,
    habitsLocation: true
  };
  const pwdRes = SecurityAnalyzer.analyzePassword(SECRET_PASS, profile);
  const profRes = SecurityAnalyzer.analyzeProfile(profile);
  const footRes = SecurityAnalyzer.analyzeFootprint(profile);
  const total = SecurityAnalyzer.calculateTotalIndex(pwdRes, profRes, footRes);

  const txtReport = ReportGenerator.generateTextReport(total);
  const htmlReport = ReportGenerator.generateHtmlReport(total);

  // Проверка отсутствия пароля
  assert.strictEqual(txtReport.includes(SECRET_PASS), false, 'TXT report must not contain password!');
  assert.strictEqual(htmlReport.includes(SECRET_PASS), false, 'HTML report must not contain password!');

  // Проверка обобщенности (не должны содержаться сырые данные псевдонима/города в отчете)
  assert.strictEqual(txtReport.includes(`"${SECRET_NICK}"`), false);
  assert.strictEqual(txtReport.includes(`"${SECRET_CITY}"`), false);
  assert.strictEqual(htmlReport.includes(`"${SECRET_NICK}"`), false);
  assert.strictEqual(htmlReport.includes(`"${SECRET_CITY}"`), false);

  // Проверка наличия обязательных блоков
  assert.ok(txtReport.includes('DIGITAL SHIELD'));
  assert.ok(txtReport.includes('Общий индекс риска:'));
  assert.ok(htmlReport.includes('<!DOCTYPE html>'));
  assert.ok(htmlReport.includes('DIGITAL SHIELD'));
  assert.ok(htmlReport.includes('Рекомендации по снижению риска'));
});

console.log(`\n========================================`);
console.log(`ИТОГ ТЕСТОВ: Пройдено ${passedTests} из ${totalTests}`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
