/**
 * Digital Shield - Генератор безопасных локальных отчётов
 * 
 * СТРОГОЕ ТРЕБОВАНИЕ БЕЗОПАСНОСТИ:
 * В отчёт НИКОГДА не попадают: пароль, псевдоним, город, учебное заведение,
 * телефон, email или любые другие сырые введённые значения.
 * Используются только обобщённые аналитические формулировки рисков и рекомендации.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReportGenerator = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Форматирование текущей даты и времени (локально)
   */
  function getFormattedTimestamp() {
    const now = new Date();
    return now.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Сборка обезличенных данных для отчёта
   */
  function sanitizeAuditData(auditResult) {
    const timestamp = getFormattedTimestamp();

    if (!auditResult || !auditResult.hasData) {
      return {
        timestamp: timestamp,
        hasData: false,
        totalRiskScore: 'Недостаточно данных',
        riskLevel: 'Недостаточно данных',
        summaryText: 'Аудит не был завершён: данные для расчёта не были предоставлены.',
        categories: [],
        scenarios: [],
        recommendations: ['Для получения персонального анализа введите тестовые демонстрационные данные.']
      };
    }

    const categories = [
      {
        name: 'Безопасность пароля',
        score: auditResult.components.password.hasData ? `${auditResult.components.password.score} / 100` : 'Недостаточно данных',
        level: auditResult.components.password.riskLevel,
        findings: auditResult.components.password.reasons || [],
        tips: auditResult.components.password.recommendations || []
      },
      {
        name: 'Раскрытие персональных данных',
        score: auditResult.components.profile.hasData ? `${auditResult.components.profile.score} / 100` : 'Недостаточно данных',
        level: auditResult.components.profile.riskLevel,
        findings: auditResult.components.profile.reasons || [],
        tips: auditResult.components.profile.recommendations || []
      },
      {
        name: 'Цифровой след',
        score: auditResult.components.footprint.hasData ? `${auditResult.components.footprint.score} / 100` : 'Недостаточно данных',
        level: auditResult.components.footprint.riskLevel,
        findings: auditResult.components.footprint.reasons || [],
        tips: auditResult.components.footprint.recommendations || []
      }
    ];

    // Все уникальные рекомендации
    const allTips = new Set();
    categories.forEach(cat => {
      cat.tips.forEach(t => allTips.add(t));
    });

    return {
      timestamp: timestamp,
      hasData: true,
      totalRiskScore: `${auditResult.totalRiskScore} из 100`,
      riskLevel: auditResult.riskLevel,
      summaryText: auditResult.summaryText,
      categories: categories,
      scenarios: auditResult.scenarios || [],
      recommendations: Array.from(allTips)
    };
  }

  /**
   * Генерация текстового отчёта (TXT)
   */
  function generateTextReport(auditResult) {
    const data = sanitizeAuditData(auditResult);

    const lines = [];
    lines.push('================================================================');
    lines.push('             DIGITAL SHIELD — АУДИТ БЕЗОПАСНОСТИ               ');
    lines.push('================================================================');
    lines.push(`Дата и время аудита: ${data.timestamp}`);
    lines.push('Режим работы: 100% автономный офлайн-анализ в браузере');
    lines.push('Политика конфиденциальности: в отчёте отсутствуют введённые');
    lines.push('пароли и конкретные персональные данные пользователя.');
    lines.push('----------------------------------------------------------------');
    lines.push('');
    lines.push('1. СВОДНЫЙ РЕЗУЛЬТАТ:');
    lines.push(`   Общий индекс риска: ${data.totalRiskScore}`);
    lines.push(`   Уровень риска:      ${data.riskLevel}`);
    lines.push(`   Пояснение:          ${data.summaryText}`);
    lines.push('   (Примечание: чем выше индекс, тем больше факторов требуют внимания)');
    lines.push('');
    lines.push('----------------------------------------------------------------');
    lines.push('2. ОЦЕНКА ПО НАПРАВЛЕНИЯМ:');
    lines.push('');

    data.categories.forEach((cat, idx) => {
      lines.push(`   2.${idx + 1}. ${cat.name.toUpperCase()}`);
      lines.push(`      Индекс риска: ${cat.score} [Уровень: ${cat.level}]`);
      lines.push('      Обнаруженные факторы:');
      if (cat.findings.length > 0) {
        cat.findings.forEach(f => lines.push(`        - ${f}`));
      } else {
        lines.push('        - Значимые факторы риска не зафиксированы.');
      }
      lines.push('');
    });

    if (data.scenarios.length > 0) {
      lines.push('----------------------------------------------------------------');
      lines.push('3. МОДЕЛИРОВАНИЕ СЦЕНАРИЕВ УГРОЗ:');
      lines.push('   (Возможные цепочки рисков на основе анализа открытых факторов)');
      lines.push('');

      data.scenarios.forEach((sc, i) => {
        lines.push(`   [Сценарий #${i + 1}] ${sc.title}`);
        lines.push(`     • Открытые сведения: ${sc.dataChain.exposed}`);
        lines.push(`     • Возможность связи: ${sc.dataChain.link}`);
        lines.push(`     • Возможный риск:    ${sc.dataChain.risk}`);
        lines.push(`     • Способ защиты:     ${sc.dataChain.action}`);
        lines.push('');
      });
    }

    lines.push('----------------------------------------------------------------');
    lines.push('4. СВОДНЫЙ ПЛАН РЕКОМЕНДАЦИЙ ПО ЗАЩИТЕ:');
    if (data.recommendations.length > 0) {
      data.recommendations.forEach((rec, idx) => {
        lines.push(`   ${idx + 1}. ${rec}`);
      });
    } else {
      lines.push('   - Специфических рекомендаций не сформировано.');
    }

    return lines.join('\r\n');
  }

  /**
   * Генерация автономного HTML-отчёта
   */
  function generateHtmlReport(auditResult) {
    const data = sanitizeAuditData(auditResult);

    const riskBadgeClass = data.riskLevel === 'Повышенный' ? 'badge-high' :
                           data.riskLevel === 'Умеренный' ? 'badge-moderate' :
                           data.riskLevel === 'Низкий' ? 'badge-low' : 'badge-neutral';

    let scenariosHtml = '';
    if (data.scenarios.length > 0) {
      scenariosHtml = `
      <section class="section">
        <h2>3. Моделирование сценариев угроз</h2>
        <p class="subtitle">Причинно-следственные связи возможных рисков на основе открытых факторов (не являются гарантированными последствиями):</p>
        <div class="scenarios-list">
          ${data.scenarios.map(sc => `
            <div class="scenario-card">
              <div class="scenario-title">${escapeHtml(sc.title)}</div>
              <div class="chain-step">
                <span class="chain-label">Открытые сведения:</span>
                <span class="chain-text">${escapeHtml(sc.dataChain.exposed)}</span>
              </div>
              <div class="chain-step">
                <span class="chain-label">Связка данных:</span>
                <span class="chain-text">${escapeHtml(sc.dataChain.link)}</span>
              </div>
              <div class="chain-step alert-step">
                <span class="chain-label">Возможный риск:</span>
                <span class="chain-text">${escapeHtml(sc.dataChain.risk)}</span>
              </div>
              <div class="chain-step action-step">
                <span class="chain-label">Способ защиты:</span>
                <span class="chain-text">${escapeHtml(sc.dataChain.action)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
      `;
    }

    const categoriesHtml = data.categories.map(cat => `
      <div class="cat-card">
        <div class="cat-header">
          <div class="cat-name">${escapeHtml(cat.name)}</div>
          <div class="cat-score">Индекс риска: <strong>${escapeHtml(cat.score)}</strong></div>
        </div>
        <div class="cat-body">
          <div class="cat-level-line">Уровень риска: <span class="badge ${getBadgeClassForLevel(cat.level)}">${escapeHtml(cat.level)}</span></div>
          <div class="cat-findings-title">Обнаруженные факторы:</div>
          <ul class="cat-findings-list">
            ${cat.findings.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `).join('');

    const recsHtml = data.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Отчёт аудита безопасности — Digital Shield</title>
  <style>
    :root {
      --color-scarlet: #D00000;
      --color-black: #000000;
      --color-dark: #1A1A1A;
      --color-gray-bg: #F8F9FA;
      --color-border: #E2E8F0;
      --color-muted: #555555;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: var(--color-dark);
      background-color: var(--color-gray-bg);
      padding: 32px 16px;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    }
    header {
      border-bottom: 2px solid var(--color-black);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 800;
      color: var(--color-black);
      letter-spacing: -0.5px;
    }
    .brand-badge {
      display: inline-block;
      background: #000000;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 10px;
      border-radius: 4px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 18px;
      font-size: 13px;
      color: var(--color-muted);
      background: var(--color-gray-bg);
      padding: 12px 16px;
      border-radius: 6px;
    }
    .section {
      margin-bottom: 36px;
    }
    h2 {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-black);
      margin-bottom: 12px;
      border-left: 4px solid var(--color-scarlet);
      padding-left: 10px;
    }
    .subtitle {
      font-size: 14px;
      color: var(--color-muted);
      margin-bottom: 16px;
    }
    .summary-card {
      background: #FFFFFF;
      border: 2px solid var(--color-black);
      border-radius: 6px;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
    }
    .summary-score-box {
      text-align: center;
      min-width: 140px;
    }
    .summary-score-value {
      font-size: 40px;
      font-weight: 900;
      color: var(--color-scarlet);
      line-height: 1;
    }
    .summary-score-label {
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--color-muted);
      margin-top: 6px;
    }
    .summary-desc {
      flex: 1;
      min-width: 250px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 4px;
      margin-left: 8px;
    }
    .badge-high { background: #FFEBEE; color: #D00000; border: 1px solid #D00000; }
    .badge-moderate { background: #FFF8E1; color: #8D6E63; border: 1px solid #BCAAA4; }
    .badge-low { background: #E8F5E9; color: #2E7D32; border: 1px solid #A5D6A7; }
    .badge-neutral { background: #EEEEEE; color: #616161; }

    .cat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    .cat-card {
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: #FFFFFF;
      padding: 16px;
    }
    .cat-header {
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .cat-name { font-weight: 700; font-size: 15px; color: var(--color-black); }
    .cat-score { font-size: 13px; color: var(--color-muted); margin-top: 4px; }
    .cat-level-line { font-size: 13px; margin-bottom: 10px; }
    .cat-findings-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--color-muted); margin-bottom: 6px; }
    .cat-findings-list { padding-left: 20px; font-size: 13px; color: var(--color-dark); }
    .cat-findings-list li { margin-bottom: 4px; }

    .scenarios-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .scenario-card {
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: #FAFAFA;
      padding: 16px 20px;
    }
    .scenario-title {
      font-weight: 700;
      font-size: 15px;
      color: var(--color-black);
      margin-bottom: 12px;
    }
    .chain-step {
      font-size: 13px;
      margin-bottom: 8px;
      display: flex;
      gap: 8px;
    }
    .chain-label {
      font-weight: 700;
      min-width: 140px;
      color: var(--color-muted);
      flex-shrink: 0;
    }
    .chain-text { flex: 1; }
    .alert-step {
      background: #FFF5F5;
      padding: 6px 10px;
      border-radius: 4px;
      border-left: 3px solid var(--color-scarlet);
    }
    .alert-step .chain-label { color: var(--color-scarlet); }
    .action-step {
      background: #F0FDF4;
      padding: 6px 10px;
      border-radius: 4px;
      border-left: 3px solid #22C55E;
    }
    .action-step .chain-label { color: #15803D; }

    .recs-list {
      padding-left: 22px;
      font-size: 14px;
    }
    .recs-list li {
      margin-bottom: 8px;
    }

    .disclaimer-box {
      margin-top: 40px;
      padding: 16px;
      background: #FFF8F8;
      border: 1px solid #FFCDD2;
      border-radius: 6px;
      font-size: 12px;
      color: #555555;
    }
    .disclaimer-box strong { color: var(--color-scarlet); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand-row">
        <div class="brand-title">DIGITAL SHIELD</div>
        <div class="brand-badge">Локальный аудит безопасности</div>
      </div>
      <div class="meta-grid">
        <div><strong>Дата формирования:</strong> ${escapeHtml(data.timestamp)}</div>
        <div><strong>Режим:</strong> 100% автономный офлайн</div>
        <div><strong>Приватность:</strong> Без сохранения сырых данных</div>
      </div>
    </header>

    <section class="section">
      <h2>1. Сводный результат</h2>
      <div class="summary-card">
        <div class="summary-score-box">
          <div class="summary-score-value">${escapeHtml(data.totalRiskScore.split(' ')[0])}</div>
          <div class="summary-score-label">Индекс риска (0–100)</div>
        </div>
        <div class="summary-desc">
          <p>Уровень риска: <span class="badge ${riskBadgeClass}">${escapeHtml(data.riskLevel)}</span></p>
          <p style="margin-top: 8px; font-size: 14px; color: var(--color-dark);">${escapeHtml(data.summaryText)}</p>
          <p style="margin-top: 6px; font-size: 12px; color: var(--color-muted);">Шкала: чем выше индекс, тем больше факторов требуют внимания.</p>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>2. Оценка по ключевым направлениям</h2>
      <div class="cat-grid">
        ${categoriesHtml}
      </div>
    </section>

    ${scenariosHtml}

    <section class="section">
      <h2>4. Рекомендации по снижению риска</h2>
      <ol class="recs-list">
        ${recsHtml}
      </ol>
    </section>
  </div>
</body>
</html>`;
  }

  function getBadgeClassForLevel(level) {
    if (level === 'Повышенный') return 'badge-high';
    if (level === 'Умеренный') return 'badge-moderate';
    if (level === 'Низкий') return 'badge-low';
    return 'badge-neutral';
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
   * Загрузка сгенерированного файла в браузере
   */
  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return {
    sanitizeAuditData: sanitizeAuditData,
    generateTextReport: generateTextReport,
    generateHtmlReport: generateHtmlReport,
    downloadBlob: downloadBlob
  };
}));
