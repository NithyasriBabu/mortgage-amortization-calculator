    function renderLegend(element, items){
      element.innerHTML = items.map(item => `<span><i class="swatch" style="background:${item.color}"></i>${escapeHtml(item.name)}</span>`).join('');
    }

    function extraPaymentSummary(plan){
      const labels = { oneTime:'One-time', monthly:'Monthly', annual:'Annual' };
      return plan.rules.map(rule => {
        const amount = money2.format(Number(rule.amount) || 0);
        if(rule.type === 'oneTime') return `${labels[rule.type]}: ${amount} (${rule.date ? formatDate(parseDate(rule.date)) : '-'})`;
        const dateRange = rule.start || rule.end ? ` (${rule.start ? formatDate(parseDate(rule.start)) : '-'} to ${rule.end ? formatDate(parseDate(rule.end)) : '-'})` : '';
        return `${labels[rule.type] || 'Extra'}: ${amount}${dateRange}`;
      }).join('<br>') || '-';
    }

    function render(){
      const baseline = computeScenario({includeExtras:false});
      const scenarios = state.plans.map(plan => ({ plan, result: computeScenario({includeExtras:true, rules:plan.rules}) }));
      const activeScenario = scenarios.find(item => item.plan.id === state.activePlanId) || scenarios[0];
      const extra = activeScenario.result;
      const basePayoff = baseline.rows.length ? baseline.rows[baseline.rows.length - 1].date : parseDate(els.startDate.value);
      const planLines = scenarios.map(({plan,result}) => {
        const payoff = result.rows.length ? result.rows[result.rows.length - 1].date : parseDate(els.startDate.value);
        const saved = Math.max(0, baseline.totalInterest - result.totalInterest);
        const savedMonths = Math.max(0, baseline.rows.length - result.rows.length);
        return { plan, name:plan.name, payoff, interest:result.totalInterest, saved, savedMonths, savedYears:(savedMonths / 12).toFixed(1) };
      }).sort((a, b) => a.payoff - b.payoff);
      const firstRow = baseline.rows[0];
      els.breakdownPayment.textContent = money2.format(baseline.payment);
      els.breakdownInterest.textContent = money2.format(firstRow?.interest || 0);
      els.breakdownPrincipal.textContent = money2.format(firstRow?.principal || 0);
      els.breakdownTotalInterest.textContent = money.format(baseline.totalInterest);

      const comparisonRows = [{ name:'Baseline', plan:null, payoff:basePayoff, timeSaved:'-', interest:baseline.totalInterest, moneySaved:'-' }, ...planLines.map(line => ({ name:line.name, plan:line.plan, payoff:line.payoff, timeSaved:`${line.savedMonths} mo / ${line.savedYears} yr`, interest:line.interest, moneySaved:line.saved }))].sort((a, b) => a.payoff - b.payoff);
      els.summary.innerHTML = `<div class="summary-table-wrap"><h2>Comparison snapshot</h2><table class="summary-table"><thead><tr><th>Plan</th><th>Extra-payment rules</th><th>Payoff date</th><th>Time saved</th><th>Interest paid</th><th>Money saved</th></tr></thead><tbody>${comparisonRows.map(row => `<tr><th scope="row">${escapeHtml(row.name)}</th><td>${row.plan ? extraPaymentSummary(row.plan) : 'None'}</td><td>${formatDate(row.payoff)}</td><td>${row.timeSaved}</td><td>${money.format(row.interest)}</td><td>${row.moneySaved === '-' ? '-' : money.format(row.moneySaved)}</td></tr>`).join('')}</tbody></table></div>`;

      drawChart(els.balanceChart, [
        { x: baseline.rows.map((_, i) => i + 1), y: baseline.rows.map(r => r.endingBalance), color: '#5FACD3' },
        ...scenarios.map(({plan,result}) => ({ x:result.rows.map((_, n) => n + 1), y:result.rows.map(r => r.endingBalance), color:plan.color }))
      ], { formatY: v => money.format(v), formatAxisY: v => compactMoney.format(v), xLabel: 'Months from start', yLabel: 'Remaining balance ($)' });

      const activeColor = activePlan().color;
      drawChart(els.cumChart, [
        { x:extra.rows.map((_, n) => n + 1), y:extra.rows.map(r => r.cumulativePrincipal), color:activeColor },
        { x:extra.rows.map((_, n) => n + 1), y:extra.rows.map(r => r.cumulativeInterest), color:lightenColor(activeColor) }
      ], { formatY: v => money.format(v), formatAxisY: v => compactMoney.format(v), xLabel: 'Months from start', yLabel: 'Cumulative amount ($)' });

      const principalSeries = scenarios.map(({plan,result}) => ({ x:result.rows.map((_, n) => n + 1), y:result.rows.map(r => r.principal), color:plan.color }));
      const interestSeries = scenarios.map(({plan,result}) => ({ x:result.rows.map((_, n) => n + 1), y:result.rows.map(r => r.interest), color:lightenColor(plan.color) }));
      drawChart(els.principalChart, principalSeries, { formatY: v => money.format(v), formatAxisY: v => compactMoney.format(v), xLabel: 'Months from start', yLabel: 'Principal payment ($)' });
      drawChart(els.interestChart, interestSeries, { formatY: v => money.format(v), formatAxisY: v => compactMoney.format(v), xLabel: 'Months from start', yLabel: 'Interest payment ($)' });
      renderLegend(els.balanceLegend, [{name:'Baseline',color:'#5FACD3'}, ...scenarios.map(({plan}) => ({name:plan.name,color:plan.color}))]);
      renderLegend(els.cumLegend, [{name:`${activePlan().name} principal`,color:activeColor},{name:`${activePlan().name} interest`,color:lightenColor(activeColor)}]);
      renderLegend(els.principalLegend, scenarios.map(({plan}) => ({name:plan.name,color:plan.color})));
      renderLegend(els.interestLegend, scenarios.map(({plan}) => ({name:plan.name,color:lightenColor(plan.color)})));

      const schedulePlan = state.plans.find(plan => plan.id === state.schedulePlanId) || state.plans[0];
      state.schedulePlanId = schedulePlan.id;
      const scheduleResult = computeScenario({includeExtras:true, rules:schedulePlan.rules});
      els.schedulePlanTabs.innerHTML = state.plans.map(plan => `<button type="button" class="plan-tab${plan.id === schedulePlan.id ? ' active' : ''}" style="--plan-color:${plan.color};--plan-color-soft:${lightenColor(plan.color, .86)}" data-schedule-plan-id="${plan.id}" role="tab" aria-selected="${plan.id === schedulePlan.id}">${escapeHtml(plan.name)}</button>`).join('');
      els.schedulePlanTabs.querySelectorAll('[data-schedule-plan-id]').forEach(tab => tab.addEventListener('click', () => {
        state.schedulePlanId = tab.dataset.schedulePlanId;
        render();
      }));
      const yearGroups = groupRowsByYear(scheduleResult.rows);
      els.scheduleBody.innerHTML = yearGroups.map(([year, rows]) => {
        const yearInterest = rows.reduce((sum, row) => sum + row.interest, 0);
        const yearScheduled = rows.reduce((sum, row) => sum + row.scheduledPayment, 0);
        const yearExtra = rows.reduce((sum, row) => sum + row.extraPayment, 0);
        const yearPrincipal = rows.reduce((sum, row) => sum + row.principal, 0);
        const lastRow = rows[rows.length - 1];
        const hidden = state.scheduleExpanded ? '' : ' is-hidden';
        const arrow = state.scheduleExpanded ? '▾' : '▸';
        return `<tr class="year-row"><td><button class="year-toggle" data-year="${year}" data-period="${rows.length}" aria-expanded="${state.scheduleExpanded}"><span>${arrow} ${rows.length} months</span><small>${year}</small></button></td><td>${formatDate(rows[0].date)} - ${formatDate(lastRow.date)}</td><td>${money2.format(yearScheduled)}</td><td>${money2.format(yearExtra)}</td><td>${money2.format(yearInterest)}</td><td>${money2.format(yearPrincipal)}</td><td>${money2.format(lastRow.endingBalance)}</td><td>${money2.format(lastRow.cumulativeInterest)}</td><td>${money2.format(lastRow.cumulativePrincipal)}</td><td><button type="button" class="info-button" data-year-detail="${year}" aria-label="Show calculation for ${year}" title="Show yearly calculation">i</button></td></tr>` + rows.map(r => `
          <tr class="month-row${hidden}" data-year="${year}">
            <td>Month ${r.month}</td>
            <td>${formatDate(r.date)}</td>
            <td>${money2.format(r.scheduledPayment)}</td>
            <td>${money2.format(r.extraPayment)}</td>
            <td>${money2.format(r.interest)}</td>
            <td>${money2.format(r.principal)}</td>
            <td>${money2.format(r.endingBalance)}</td>
            <td>${money2.format(r.cumulativeInterest)}</td>
            <td>${money2.format(r.cumulativePrincipal)}</td>
            <td><button type="button" class="info-button" data-payment-month="${r.month}" aria-label="Show payment calculation for month ${r.month}" title="Show payment calculation">i</button></td>
          </tr>
        `).join('');
      }).join('');
      els.scheduleBody.querySelectorAll('.year-toggle').forEach(toggle => toggle.addEventListener('click', () => {
        const year = toggle.dataset.year;
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!isExpanded));
        toggle.querySelector('span').textContent = `${isExpanded ? '▸' : '▾'} ${toggle.dataset.period} months`;
        els.scheduleBody.querySelectorAll(`.month-row[data-year="${year}"]`).forEach(row => row.classList.toggle('is-hidden', isExpanded));
      }));
      els.scheduleBody.querySelectorAll('[data-payment-month]').forEach(button => button.addEventListener('click', () => showPaymentCalculation(Number(button.dataset.paymentMonth))));
      els.scheduleBody.querySelectorAll('[data-year-detail]').forEach(button => button.addEventListener('click', () => showYearCalculation(Number(button.dataset.yearDetail))));
      els.expandAllYears.classList.toggle('active', state.scheduleExpanded);
      els.collapseAllYears.classList.toggle('active', !state.scheduleExpanded);
      if(!scheduleResult.rows.length){
        els.scheduleBody.innerHTML = '<tr><td colspan="10" class="empty">No amortization rows to show.</td></tr>';
      }
    }

    function showYearCalculation(year){
      const baseline = computeScenario({includeExtras:false});
      const extra = computeScenario({includeExtras:true, rules:activePlan().rules});
      const baselineRows = baseline.rows.filter(row => row.date.getFullYear() === year);
      const planRows = extra.rows.filter(row => row.date.getFullYear() === year);
      const renderYear = (label, rows) => {
        if(!rows.length) return `<div class="calculation-block"><h3>${label}</h3><p class="small">No payments in ${year}.</p></div>`;
        const scheduled = rows.reduce((sum, row) => sum + row.scheduledPayment, 0);
        const extraPaid = rows.reduce((sum, row) => sum + row.extraPayment, 0);
        const interest = rows.reduce((sum, row) => sum + row.interest, 0);
        const principal = rows.reduce((sum, row) => sum + row.principal, 0);
        const sourceRows = label === 'Baseline payment' ? baseline.rows : extra.rows;
        const beginningBalance = beginningBalanceAt(sourceRows, rows[0].month);
        return `<div class="calculation-block"><h3>${label}</h3><div class="calculation-list"><div class="calculation-line"><span>Payments</span><span>${rows.length}</span></div><div class="calculation-line"><span>Beginning balance</span><span>${money2.format(beginningBalance)}</span></div><div class="calculation-line"><span>Scheduled payments</span><span>${money2.format(scheduled)}</span></div><div class="calculation-line"><span>Extra payments</span><span>${money2.format(extraPaid)}</span></div><div class="calculation-line"><span>Interest</span><span>${money2.format(interest)}</span></div><div class="calculation-line"><span>Principal</span><span>${money2.format(principal)}</span></div><div class="calculation-line"><span>Ending balance</span><span>${money2.format(rows[rows.length - 1].endingBalance)}</span></div></div></div>`;
      };
      els.paymentInfoTitle.textContent = `${year} payment calculation`;
      els.paymentCalculationDetails.innerHTML = `<div class="calculation-grid">${renderYear('Baseline payment', baselineRows)}${renderYear(`${escapeHtml(activePlan().name)} payments`, planRows)}</div>`;
      els.paymentInfoModal.hidden = false;
    }

    function showPaymentCalculation(month){
      const baseline = computeScenario({includeExtras:false});
      const extra = computeScenario({includeExtras:true, rules:activePlan().rules});
      const selectedMonth = Math.max(1, Number(month) || 1);
      const baselineRow = baseline.rows[selectedMonth - 1];
      els.paymentInfoTitle.textContent = baselineRow ? `Payment ${selectedMonth} · ${formatDate(baselineRow.date)}` : `Payment ${selectedMonth}`;
      renderPaymentCalculation(baseline, extra, selectedMonth);
      els.paymentInfoModal.hidden = false;
    }

    function renderPaymentCalculation(baseline, extra, selectedMonth){
      const baselineRow = baseline.rows[selectedMonth - 1];
      const planRow = extra.rows[selectedMonth - 1];
      const beginningBaseline = beginningBalanceAt(baseline.rows, selectedMonth);
      const beginningPlan = beginningBalanceAt(extra.rows, selectedMonth);
      const annualRate = Number(els.rate.value) || 0;
      const monthlyRate = annualRate / 12;
      const renderRow = (label, row, beginning) => row ? `<div class="calculation-block"><h3>${label}</h3><div class="calculation-list"><div class="calculation-line"><span>Beginning balance</span><span>${money2.format(beginning)}</span></div><div class="calculation-line"><span>Interest (${annualRate.toFixed(2)}% annual / ${monthlyRate.toFixed(4)}% monthly)</span><span>${money2.format(row.interest)}</span></div><div class="calculation-line"><span>Scheduled payment</span><span>${money2.format(row.scheduledPayment)}</span></div><div class="calculation-line"><span>Extra payment</span><span>${money2.format(row.extraPayment)}</span></div><div class="calculation-line"><span>Principal paid</span><span>${money2.format(row.principal)}</span></div><div class="calculation-line"><span>Ending balance</span><span>${money2.format(row.endingBalance)}</span></div></div></div>` : `<div class="calculation-block"><h3>${label}</h3><p class="small">This plan is already paid off by payment ${selectedMonth}.</p></div>`;
      els.paymentCalculationDetails.innerHTML = `<div class="calculation-grid">${renderRow('Baseline payment', baselineRow, beginningBaseline)}${renderRow(`${escapeHtml(activePlan().name)} payment`, planRow, beginningPlan)}</div>`;
    }

    function renderRules(){
      const plan = activePlan();
      plan.color ||= availablePlanColor();
      els.rulesPanel.style.setProperty('--plan-color', plan.color);
      els.rulesPanel.style.setProperty('--plan-color-soft', lightenColor(plan.color, .86));
      els.planTabs.innerHTML = state.plans.map(plan => `<button class="plan-tab${plan.id === state.activePlanId ? ' active' : ''}" style="--plan-color:${plan.color};--plan-color-soft:${lightenColor(plan.color, .86)}" data-plan-id="${plan.id}" role="tab" aria-selected="${plan.id === state.activePlanId}">${escapeHtml(plan.name)}</button>`).join('');
      els.planColorSwatch.style.setProperty('--plan-color', plan.color);
      els.planColorOptions.querySelectorAll('.color-option').forEach(option => {
        const selected = option.dataset.planColor === plan.color;
        const taken = state.plans.some(item => item.id !== plan.id && item.color === option.dataset.planColor);
        option.hidden = taken;
        option.disabled = false;
        option.setAttribute('aria-pressed', String(selected));
      });
      const planLimitReached = state.plans.length >= 5;
      const onlyPlan = state.plans.length <= 1;
      els.addPlan.disabled = planLimitReached;
      els.addPlan.title = planLimitReached ? 'Delete a plan before adding another' : 'Add payment plan';
      els.duplicatePlan.disabled = planLimitReached;
      els.duplicatePlan.title = planLimitReached ? 'Delete a plan before duplicating another' : 'Duplicate active plan';
      els.deletePlan.disabled = onlyPlan;
      els.deletePlan.title = onlyPlan ? 'The last plan cannot be deleted' : 'Delete active plan';
      els.planTabs.querySelectorAll('.plan-tab').forEach(tab => tab.addEventListener('click', () => {
        state.activePlanId = tab.dataset.planId;
        state.schedulePlanId = tab.dataset.planId;
        refreshRules();
      }));
      els.rules.innerHTML = activePlan().rules.map((rule, idx) => {
        const typeLabel = {
          oneTime: 'One-time extra',
          monthly: 'Monthly extra',
          annual: 'Annual extra'
        }[rule.type] || 'Rule';
        return `
          <div class="rule" data-id="${rule.id}">
            <div class="rule-head">
              <div>
                <div class="rule-title">${typeLabel} ${idx + 1}</div>
                <div class="small">Edit or remove this rule. It will be combined with every other rule.</div>
              </div>
              <div class="rule-actions">
                <button class="btn ghost mini icon-btn" data-action="duplicate" aria-label="Duplicate rule" title="Duplicate rule"><span class="duplicate-icon" aria-hidden="true"></span><span class="sr-only">Duplicate</span></button>
                <button class="btn secondary mini icon-btn" data-action="remove" aria-label="Remove rule" title="Remove rule"><span aria-hidden="true">&times;</span><span class="sr-only">Remove</span></button>
              </div>
            </div>
            <div class="inputs">
              <div class="field">
                <label>Type</label>
                <select data-field="type">
                  <option value="oneTime"${rule.type==='oneTime'?' selected':''}>One-time extra</option>
                  <option value="monthly"${rule.type==='monthly'?' selected':''}>Monthly extra</option>
                  <option value="annual"${rule.type==='annual'?' selected':''}>Annual extra</option>
                </select>
              </div>
              <div class="field">
                <label>Amount</label>
                <input data-field="amount" type="number" min="0" step="50" value="${rule.amount ?? ''}">
              </div>
              ${rule.type === 'oneTime' ? `
                <div class="field full">
                  <label>Extra date</label>
                  <input data-field="date" type="date" value="${rule.date || ''}">
                </div>` : ''}
              ${rule.type === 'monthly' || rule.type === 'annual' ? `
                <div class="field">
                  <label>Start date</label>
                  <input data-field="start" type="date" value="${rule.start || ''}">
                </div>
                <div class="field">
                  <label>End date <span class="small">(optional)</span></label>
                  <input data-field="end" type="date" value="${rule.end || ''}">
                </div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    function refreshRules(){
      renderRules();
      wireRuleEvents();
      render();
    }

    function addRule(type='monthly'){
      activePlan().rules.push({
        id: crypto.randomUUID(),
        type,
        amount: 1000,
        date: '',
        start: '',
        end: '',
        note: ''
      });
      refreshRules();
    }

    function addPlan(){
      const suggestedName = `Plan ${state.plans.length + 1}`;
      const name = window.prompt('Name this payment plan', suggestedName);
      if(!name || !name.trim()) return;
      const plan = { id:crypto.randomUUID(), name:name.trim(), color:availablePlanColor(), rules:[] };
      state.plans.push(plan);
      state.activePlanId = plan.id;
      state.schedulePlanId = plan.id;
      refreshRules();
    }

    function duplicatePlan(){
      const source = activePlan();
      const copy = structuredClone(source);
      copy.id = crypto.randomUUID();
      copy.name = `${source.name} copy`;
      copy.color = availablePlanColor();
      copy.rules = copy.rules.map(rule => ({ ...rule, id: crypto.randomUUID() }));
      state.plans.splice(state.plans.indexOf(source) + 1, 0, copy);
      state.activePlanId = copy.id;
      state.schedulePlanId = copy.id;
      refreshRules();
    }

    function renamePlan(){
      const plan = activePlan();
      const name = window.prompt('Rename this payment plan', plan.name);
      if(!name || !name.trim()) return;
      plan.name = name.trim();
      refreshRules();
    }

    function deletePlan(){
      if(state.plans.length <= 1) return;
      const plan = activePlan();
      const index = state.plans.indexOf(plan);
      state.plans = state.plans.filter(item => item.id !== plan.id);
      state.activePlanId = state.plans[Math.min(index, state.plans.length - 1)].id;
      if(!state.plans.some(item => item.id === state.schedulePlanId)) state.schedulePlanId = state.activePlanId;
      refreshRules();
    }

    function wireRuleEvents(){
      els.rules.querySelectorAll('.rule').forEach(ruleEl => {
        const id = ruleEl.dataset.id;
        const rule = activePlan().rules.find(r => r.id === id);
        if(!rule) return;
        ruleEl.querySelectorAll('input[data-field], textarea[data-field]').forEach(input => {
          input.addEventListener('input', () => {
            rule[input.dataset.field] = input.type === 'number' ? Number(input.value) : input.value;
            render();
          });
        });
        ruleEl.querySelectorAll('select[data-field]').forEach(select => {
          select.addEventListener('change', () => {
            const nextType = select.value;
            const fresh = { id: rule.id, type: nextType, amount: rule.amount || 0, date:'', start:'', end:'', note: rule.note || '' };
            Object.assign(rule, fresh);
        refreshRules();
          });
        });
        ruleEl.querySelector('[data-action="remove"]').addEventListener('click', () => {
          activePlan().rules = activePlan().rules.filter(r => r.id !== id);
          refreshRules();
        });
        ruleEl.querySelector('[data-action="duplicate"]').addEventListener('click', () => {
          const copy = structuredClone(rule);
          copy.id = crypto.randomUUID();
          const rules = activePlan().rules;
          rules.splice(rules.indexOf(rule) + 1, 0, copy);
          refreshRules();
        });
      });
    }

    els.loanAmount.addEventListener('input', render);
    els.rate.addEventListener('input', render);
    els.termYears.addEventListener('input', render);
    els.startDate.addEventListener('change', render);
    els.paymentDay.addEventListener('input', render);
    els.planColorOptions.addEventListener('click', event => {
      const option = event.target.closest('.color-option');
      if(!option || option.disabled) return;
      activePlan().color = option.dataset.planColor;
      els.planColorPicker.open = false;
      renderRules();
      render();
    });
    document.addEventListener('click', event => {
      if(!event.target.closest('.plan-color-picker')) els.planColorPicker.open = false;
    });
    els.closePaymentInfo.addEventListener('click', () => { els.paymentInfoModal.hidden = true; });
    els.paymentInfoModal.addEventListener('click', event => { if(event.target === els.paymentInfoModal) els.paymentInfoModal.hidden = true; });
    function setAllYearsExpanded(expand){
      state.scheduleExpanded = expand;
      els.scheduleBody.querySelectorAll('.month-row').forEach(row => row.classList.toggle('is-hidden', !expand));
      els.scheduleBody.querySelectorAll('.year-toggle').forEach(toggle => {
        const year = toggle.dataset.year;
        toggle.setAttribute('aria-expanded', String(expand));
        toggle.querySelector('span').textContent = `${expand ? '▾' : '▸'} ${toggle.dataset.period} months`;
      });
      els.expandAllYears.classList.toggle('active', expand);
      els.collapseAllYears.classList.toggle('active', !expand);
    }
    els.expandAllYears.addEventListener('click', () => setAllYearsExpanded(true));
    els.collapseAllYears.addEventListener('click', () => setAllYearsExpanded(false));
    els.addRule.addEventListener('click', () => addRule('monthly'));
    els.addPlan.addEventListener('click', addPlan);
    els.renamePlan.addEventListener('click', renamePlan);
    els.duplicatePlan.addEventListener('click', duplicatePlan);
    els.deletePlan.addEventListener('click', deletePlan);
    els.exportReport.addEventListener('click', showExportOptions);
    document.getElementById('cancelExport').addEventListener('click', hideExportOptions);
    document.getElementById('exportModal').addEventListener('click', event => { if(event.target.id === 'exportModal') hideExportOptions(); });
    document.getElementById('exportForm').addEventListener('submit', event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const options = { overview:true, comparison:true, rules:true, schedule:true, charts:form.has('charts'), scheduleDetail:form.get('scheduleDetail') || 'yearly' };
      hideExportOptions();
      exportReport(options);
    });
    els.resetRules.addEventListener('click', () => {
      activePlan().rules = createDefaultRules();
      refreshRules();
    });

    function init(){
      const today = new Date();
      els.startDate.value = toInputDate(today);
      refreshRules();
      window.addEventListener('resize', render);
    }

    function showExportOptions(){
      document.getElementById('exportModal').hidden = false;
      document.getElementById('exportModal').querySelector('input').focus();
    }

    function hideExportOptions(){
      document.getElementById('exportModal').hidden = true;
    }

    function reportScheduleMarkup(plan, detail){
      const result = computeScenario({includeExtras:true, rules:plan.rules});
      const headers = '<tr><th>Period</th><th>Date</th><th>Scheduled payment</th><th>Extra payment</th><th>Interest</th><th>Principal</th><th>Ending balance</th><th>Cumulative interest</th><th>Cumulative principal</th></tr>';
      if(detail === 'yearly'){
        const rows = groupRowsByYear(result.rows).map(([year, yearRows]) => {
          const scheduled = yearRows.reduce((sum, row) => sum + row.scheduledPayment, 0);
          const extra = yearRows.reduce((sum, row) => sum + row.extraPayment, 0);
          const interest = yearRows.reduce((sum, row) => sum + row.interest, 0);
          const principal = yearRows.reduce((sum, row) => sum + row.principal, 0);
          const last = yearRows[yearRows.length - 1];
          return `<tr><td>${year}</td><td>${formatDate(yearRows[0].date)} - ${formatDate(last.date)}</td><td>${money2.format(scheduled)}</td><td>${money2.format(extra)}</td><td>${money2.format(interest)}</td><td>${money2.format(principal)}</td><td>${money2.format(last.endingBalance)}</td><td>${money2.format(last.cumulativeInterest)}</td><td>${money2.format(last.cumulativePrincipal)}</td></tr>`;
        }).join('');
        return `<div class="report-plan-schedule"><h3>${escapeHtml(plan.name)}</h3><table>${headers}<tbody>${rows}</tbody></table></div>`;
      }
      const rows = groupRowsByYear(result.rows).map(([year, yearRows]) => {
        const scheduled = yearRows.reduce((sum, row) => sum + row.scheduledPayment, 0);
        const extra = yearRows.reduce((sum, row) => sum + row.extraPayment, 0);
        const interest = yearRows.reduce((sum, row) => sum + row.interest, 0);
        const principal = yearRows.reduce((sum, row) => sum + row.principal, 0);
        const last = yearRows[yearRows.length - 1];
        const yearRow = `<tr class="year-row"><td>${year}</td><td>${formatDate(yearRows[0].date)} - ${formatDate(last.date)}</td><td>${money2.format(scheduled)}</td><td>${money2.format(extra)}</td><td>${money2.format(interest)}</td><td>${money2.format(principal)}</td><td>${money2.format(last.endingBalance)}</td><td>${money2.format(last.cumulativeInterest)}</td><td>${money2.format(last.cumulativePrincipal)}</td></tr>`;
        const monthRows = yearRows.map(row => `<tr><td>Month ${row.month}</td><td>${formatDate(row.date)}</td><td>${money2.format(row.scheduledPayment)}</td><td>${money2.format(row.extraPayment)}</td><td>${money2.format(row.interest)}</td><td>${money2.format(row.principal)}</td><td>${money2.format(row.endingBalance)}</td><td>${money2.format(row.cumulativeInterest)}</td><td>${money2.format(row.cumulativePrincipal)}</td></tr>`).join('');
        return yearRow + monthRows;
      }).join('');
      return `<div class="report-plan-schedule"><h3>${escapeHtml(plan.name)}</h3><table>${headers}<tbody>${rows}</tbody></table></div>`;
    }

    function reportRulesMarkup(plan){
      const labels = { oneTime:'One-time extra', monthly:'Monthly extra', annual:'Annual extra' };
      const date = value => value ? formatDate(parseDate(value)) : '-';
      return plan.rules.map(rule => {
        const dateText = rule.type === 'oneTime' ? `Date: ${date(rule.date)}` : (rule.start || rule.end ? `Dates: ${date(rule.start)} to ${date(rule.end)}` : '');
        return `<p class="report-line"><span>${labels[rule.type] || 'Extra payment'}:</span> <strong>${money2.format(Number(rule.amount) || 0)}</strong>${dateText ? ` <span>${dateText}</span>` : ''}</p>`;
      }).join('') || '<p class="report-line">None</p>';
    }

    function reportChartsMarkup(plan, baseline, result){
      const svgMarkup = (series, opts) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 1000 320');
        svg.setAttribute('preserveAspectRatio', 'none');
        drawChart(svg, series, opts);
        return svg.outerHTML;
      };
      const legendMarkup = items => items.map(item => `<span><i class="swatch" style="background:${item.color}"></i>${escapeHtml(item.name)}</span>`).join('');
      const series = rows => rows.map((_, index) => index + 1);
      const chart = (title, subtitle, svg, legend) => `<div class="chart-card"><div class="chart-head"><div><h2>${title}</h2><p>${subtitle}</p></div></div>${svg}<div class="legend">${legend}</div></div>`;
      const color = plan.color;
      return `<div class="report-chart-grid">
        ${chart('Remaining balance', 'Baseline vs this plan', svgMarkup([
          {x:series(baseline.rows), y:baseline.rows.map(row => row.endingBalance), color:'#5FACD3'},
          {x:series(result.rows), y:result.rows.map(row => row.endingBalance), color}
        ], {formatY:v => money.format(v), formatAxisY:v => compactMoney.format(v), xLabel:'Months from start', yLabel:'Remaining balance ($)'}), legendMarkup([{name:'Baseline',color:'#5FACD3'},{name:plan.name,color}]))}
        ${chart('Cumulative paid', 'Principal and interest for this plan', svgMarkup([
          {x:series(result.rows), y:result.rows.map(row => row.cumulativePrincipal), color},
          {x:series(result.rows), y:result.rows.map(row => row.cumulativeInterest), color:lightenColor(color)}
        ], {formatY:v => money.format(v), formatAxisY:v => compactMoney.format(v), xLabel:'Months from start', yLabel:'Cumulative amount ($)'}), legendMarkup([{name:`${plan.name} principal`,color},{name:`${plan.name} interest`,color:lightenColor(color)}]))}
        ${chart('Principal payments', 'Principal paid by this plan', svgMarkup([{x:series(result.rows), y:result.rows.map(row => row.principal), color}], {formatY:v => money.format(v), formatAxisY:v => compactMoney.format(v), xLabel:'Months from start', yLabel:'Principal payment ($)'}), legendMarkup([{name:plan.name,color}]))}
        ${chart('Interest payments', 'Interest paid by this plan', svgMarkup([{x:series(result.rows), y:result.rows.map(row => row.interest), color:lightenColor(color)}], {formatY:v => money.format(v), formatAxisY:v => compactMoney.format(v), xLabel:'Months from start', yLabel:'Interest payment ($)'}), legendMarkup([{name:plan.name,color:lightenColor(color)}]))}
      </div>`;
    }

    function reportPlanComparison(plan, baseline, result){
      const payoff = result.rows.length ? result.rows[result.rows.length - 1].date : parseDate(els.startDate.value);
      const saved = Math.max(0, baseline.totalInterest - result.totalInterest);
      const savedMonths = Math.max(0, baseline.rows.length - result.rows.length);
      const baselinePayoff = baseline.rows.length ? baseline.rows[baseline.rows.length - 1].date : parseDate(els.startDate.value);
      return `<div class="report-plan-comparison-lines"><p class="report-line"><span>Payoff date:</span> <strong>Baseline ${formatDate(baselinePayoff)}; ${escapeHtml(plan.name)} ${formatDate(payoff)}</strong></p><p class="report-line"><span>Time saved:</span> <strong>${savedMonths} mo / ${(savedMonths / 12).toFixed(1)} yr</strong></p><p class="report-line"><span>Interest paid:</span> <strong>Baseline ${money.format(baseline.totalInterest)}; ${escapeHtml(plan.name)} ${money.format(result.totalInterest)}</strong></p><p class="report-line"><span>Money saved:</span> <strong>${money.format(saved)}</strong></p></div>`;
    }

    function reportComparisonSnapshot(baseline){
      const baselinePayoff = baseline.rows.length ? baseline.rows[baseline.rows.length - 1].date : parseDate(els.startDate.value);
      const rows = [{name:'Baseline', payoff:baselinePayoff, markup:`<tr><th scope="row">Baseline</th><td>None</td><td>${formatDate(baselinePayoff)}</td><td>-</td><td>${money.format(baseline.totalInterest)}</td><td>-</td></tr>`}, ...state.plans.map(plan => {
        const result = computeScenario({includeExtras:true, rules:plan.rules});
        const payoff = result.rows.length ? result.rows[result.rows.length - 1].date : parseDate(els.startDate.value);
        const savedMonths = Math.max(0, baseline.rows.length - result.rows.length);
        const saved = Math.max(0, baseline.totalInterest - result.totalInterest);
        return { plan, payoff, markup:`<tr><th scope="row">${escapeHtml(plan.name)}</th><td>${extraPaymentSummary(plan)}</td><td>${formatDate(payoff)}</td><td>${savedMonths} mo / ${(savedMonths / 12).toFixed(1)} yr</td><td>${money.format(result.totalInterest)}</td><td>${money.format(saved)}</td></tr>` };
      })].sort((a, b) => a.payoff - b.payoff).map(row => row.markup).join('');
      return `<section class="report-section report-snapshot"><h2>Comparison snapshot</h2><table class="report-comparison-table"><thead><tr><th>Plan</th><th>Extra-payment rules</th><th>Payoff date</th><th>Time saved</th><th>Interest paid</th><th>Money saved</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }

    function exportReport(options){
      const reportWindow = window.open('', '_blank');
      const inputValue = id => document.getElementById(id).value || 'Not provided';
      const loanOverview = [
        ['Loan amount', money2.format(Number(inputValue('loanAmount')) || 0)],
        ['Interest rate', `${inputValue('rate')}%`],
        ['Loan term', `${inputValue('termYears')} years`],
        ['Start date', formatDate(parseDate(inputValue('startDate')) || new Date())],
        ['Payment day', inputValue('paymentDay')]
      ].map(([label, value]) => `<p class="report-line"><span>${label}:</span> <strong>${value}</strong></p>`).join('');
      const baseline = computeScenario({includeExtras:false});
      const snapshot = reportComparisonSnapshot(baseline);
      const planReports = state.plans.map(plan => {
        const result = computeScenario({includeExtras:true, rules:plan.rules});
        return `<article class="report-plan"><header class="report-plan-header"><h2>${escapeHtml(plan.name)}</h2></header>
          ${options.rules ? `<section class="report-section report-rules"><h3>Extra-payment rules</h3>${reportRulesMarkup(plan)}</section>` : ''}
          ${options.comparison ? `<section class="report-section report-plan-comparison"><h3>Baseline vs extra payments</h3>${reportPlanComparison(plan, baseline, result)}</section>` : ''}
          ${options.charts ? `<section class="report-section report-charts"><h3>Scenario charts</h3>${reportChartsMarkup(plan, baseline, result)}</section>` : ''}
          ${options.schedule ? `<section class="report-section report-schedule"><h3>Amortization schedule</h3><p class="report-muted">${options.scheduleDetail === 'monthly' ? 'Monthly detail' : 'Yearly summary'} through this plan’s payoff date.</p><div class="report-table-wrap">${reportScheduleMarkup(plan, options.scheduleDetail)}</div></section>` : ''}
        </article>`;
      }).join('');
      const reportBody = `<main class="pdf-report">
        <header class="report-header"><div><p class="report-kicker">Mortgage planning report</p><h1>Amortization summary</h1><p>Baseline mortgage compared with each extra-payment plan.</p></div><div class="report-date">Prepared ${formatDate(new Date())}</div></header>
        ${options.overview ? `<section class="report-section report-overview"><h2>Loan overview</h2><div class="report-fields">${loanOverview}</div></section>` : ''}
        ${options.comparison ? snapshot : ''}
        ${planReports}
      </main>`;
      const reportStyles = `
        :root{--ink:#27345d;--muted:#66738f;--line:#d3e5ec;--accent:#525ea7;--accent2:#ffc349;--accent3:#5facd3;--card:#fff}
        *{box-sizing:border-box}html,body{margin:0;background:#f3fbfd;color:var(--ink);font-family:"Sora","Avenir Next",Avenir,"Segoe UI",sans-serif;font-size:12px;line-height:1.5}
        .pdf-report{max-width:1120px;margin:0 auto;padding:38px;background:#fff;min-height:100vh}
        .report-header{display:flex;justify-content:space-between;gap:28px;align-items:flex-start;border-bottom:4px solid var(--accent);padding-bottom:24px}
        .report-kicker{margin:0 0 8px;color:var(--accent2);font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
        h1{margin:0;font-size:34px;line-height:1.08;letter-spacing:-.045em;font-weight:800}h2{margin:0 0 14px;font-size:19px;line-height:1.2;font-weight:700}.report-header p:not(.report-kicker){margin:9px 0 0;color:var(--muted)}.report-date{color:var(--muted);font-size:11px;white-space:nowrap}
        .report-section{margin-top:26px}.report-fields{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.report-field,.report-summary .metric{border:1px solid var(--line);border-radius:12px;padding:12px;background:#eff8f7}.report-field span,.report-summary .metric>span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.report-field strong{display:block;margin-top:7px;font-size:15px}
        .report-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.report-summary .metric{min-height:100px}.report-summary .compare-line{display:flex;justify-content:space-between;gap:12px;margin-top:9px;font-size:11px}.report-summary .compare-line span:last-child{font-weight:700;text-align:right}.report-summary .delta{color:var(--accent)}
        .report-rules .rules{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.report-rules .rule{padding:12px;break-inside:avoid}.report-rules .rule-head{margin-bottom:8px}.report-rules .rule .inputs{gap:8px}.report-rules .report-value{display:block;padding:8px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:12px}.report-rules .small,.report-rules .footer-note{display:none}
        .report-chart-grid{display:grid;grid-template-columns:1fr;gap:22px}.report-charts .chart-card{padding:0;border:0;box-shadow:none}.report-charts .chart-head{margin-bottom:8px}.report-charts .chart-head h2{font-size:15px}.report-charts .chart-head p,.report-charts .legend{font-size:11px}.report-charts .legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}.report-charts .swatch{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px;print-color-adjust:exact;-webkit-print-color-adjust:exact}.report-charts svg{height:auto;aspect-ratio:1000 / 320;border:1px solid var(--line)}
        .report-muted{margin:-7px 0 12px;color:var(--muted);font-size:11px}.report-table-wrap{overflow:visible}.report-schedule table{width:100%;border-collapse:collapse;font-size:9px}.report-schedule th{background:#edf4fb;text-align:left;padding:6px 4px;border-bottom:1px solid var(--line);white-space:nowrap}.report-schedule td{padding:5px 4px;border-bottom:1px solid #e6f0f4;white-space:nowrap}.report-schedule .year-row td{padding:0;background:#eaf7fb}.report-year-label{display:block;padding:7px 4px;font-weight:700}.report-schedule .month-row.is-hidden{display:none}.report-plan{margin-top:34px;padding-top:20px;border-top:1px solid #111827;break-inside:auto}.report-plan-header h2{margin:0;font-size:22px}.report-plan .report-section{margin-top:18px}.report-plan h3{margin:0 0 10px;font-size:15px}.report-plan-schedule{margin-top:18px;break-inside:avoid}.report-plan-schedule h3{margin:0 0 8px;font-size:14px}
        @page{size:portrait;margin:.45in}
        /* Keep the report understated for printing; chart colors remain intact. */
        .pdf-report{color:#111827;background:#fff;padding:32px}
        .report-header{border-bottom:1px solid #111827;padding-bottom:16px}
        .report-kicker{color:#374151;font-size:10px}
        h1{font-size:28px;letter-spacing:-.025em}h2{font-size:17px}
        .report-section{margin-top:22px}
        .report-field,.report-summary .metric{border:1px solid #cbd5e1;border-radius:4px;background:#fff;padding:10px}
        .report-field span,.report-summary .metric>span,.report-header p:not(.report-kicker),.report-date,.report-muted{color:#4b5563}
        .report-summary .delta{color:#111827}
        .report-rules .report-value{border-color:#cbd5e1;border-radius:4px}
        .report-top-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:42px}
        .report-comparison-table{width:100%;border-collapse:collapse;font-size:11px}
        .report-comparison-table th,.report-comparison-table td{text-align:left;padding:6px 8px 6px 0;border-bottom:1px solid #d1d5db;white-space:nowrap}
        .report-comparison-table thead th{font-weight:700;border-bottom:1px solid #111827}
        .report-comparison-table tbody th{font-weight:700}
        .report-snapshot .report-comparison-table{font-size:9px}
        .report-top-left{min-width:0}
        .report-rules .report-value{display:inline;padding:0;border:0;border-radius:0;background:transparent;font-size:12px}
        .report-rules .rule-head{display:none}
        .report-rules-table{width:100%;border-collapse:collapse;font-size:11px}
        .report-rules-table th{text-align:left;font-weight:700;border-bottom:1px solid #111827;padding:5px 8px 5px 0}
        .report-rules-table td{border-bottom:1px solid #d1d5db;padding:6px 8px 6px 0}
        .report-top-grid .report-section{margin-top:22px}
        .report-fields{display:block}
        .report-line{margin:0 0 8px;font-size:12px}
        .report-line span{color:#4b5563}
        .report-line strong{font-weight:700}
        .report-summary{display:block}
        .report-summary .metric{min-height:0;margin:0 0 11px;padding:0 0 10px;border:0;border-bottom:1px solid #d1d5db;border-radius:0}
        .report-summary .metric:last-child{margin-bottom:0}
        .report-summary .metric>span{font-size:11px;font-weight:700;color:#111827;text-transform:none;letter-spacing:0}
        .report-summary .compare-line{font-size:12px;margin-top:5px}
        @media print{body{background:#fff}.pdf-report{max-width:none;padding:0}.report-top-grid,.report-chart-grid{grid-template-columns:1fr}.report-header,.report-section{break-inside:avoid}.report-schedule{break-before:page}.report-charts svg{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
        @media(max-width:760px){.pdf-report{padding:20px}.report-header{display:block}.report-date{margin-top:12px}.report-top-grid{display:block}.report-fields,.report-summary,.report-rules .rules,.report-chart-grid{grid-template-columns:1fr 1fr}}
      `;
      if(!reportWindow){
        const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>Mortgage amortization report</title><style>${reportStyles}</style></head><body>${reportBody}</body></html>`], {type:'text/html'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'mortgage-amortization-report.html';
        link.click();
        URL.revokeObjectURL(link.href);
        return;
      }
      reportWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Mortgage amortization report</title><style>${reportStyles}</style></head><body>${reportBody}</body></html>`);
      reportWindow.document.close();
      reportWindow.focus();
      reportWindow.print();
    }

    init();
