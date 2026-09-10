    const firstPlanId = crypto.randomUUID();
    function createDefaultRules(){
      return [{ id: crypto.randomUUID(), type: 'monthly', amount: 1000, start: '', end: '' }];
    }

    const state = {
      plans: [{
        id: firstPlanId,
        name: 'Plan 1',
        color: '#5E3A73',
        rules: createDefaultRules()
      }],
      activePlanId: firstPlanId,
      schedulePlanId: firstPlanId,
      scheduleExpanded: false
    };

    const els = {
      loanAmount: document.getElementById('loanAmount'),
      rate: document.getElementById('rate'),
      termYears: document.getElementById('termYears'),
      startDate: document.getElementById('startDate'),
      paymentDay: document.getElementById('paymentDay'),
      rules: document.getElementById('rules'),
      planTabs: document.getElementById('planTabs'),
      rulesPanel: document.getElementById('rulesPanel'),
      addPlan: document.getElementById('addPlan'),
      renamePlan: document.getElementById('renamePlan'),
      duplicatePlan: document.getElementById('duplicatePlan'),
      deletePlan: document.getElementById('deletePlan'),
      addRule: document.getElementById('addRule'),
      resetRules: document.getElementById('resetRules'),
      exportReport: document.getElementById('exportReport'),
      summary: document.getElementById('summary'),
      scheduleBody: document.getElementById('scheduleBody'),
      schedulePlanTabs: document.getElementById('schedulePlanTabs'),
      balanceChart: document.getElementById('balanceChart'),
      cumChart: document.getElementById('cumChart'),
      principalChart: document.getElementById('principalChart'),
      interestChart: document.getElementById('interestChart'),
      balanceLegend: document.getElementById('balanceLegend'),
      cumLegend: document.getElementById('cumLegend'),
      principalLegend: document.getElementById('principalLegend'),
      interestLegend: document.getElementById('interestLegend'),
      planColorSwatch: document.getElementById('planColorSwatch'),
      planColorPicker: document.getElementById('planColorPicker'),
      planColorOptions: document.getElementById('planColorOptions'),
      breakdownPayment: document.getElementById('breakdownPayment'),
      breakdownInterest: document.getElementById('breakdownInterest'),
      breakdownPrincipal: document.getElementById('breakdownPrincipal'),
      breakdownTotalInterest: document.getElementById('breakdownTotalInterest'),
      paymentCalculationDetails: document.getElementById('paymentCalculationDetails'),
      paymentInfoModal: document.getElementById('paymentInfoModal'),
      paymentInfoTitle: document.getElementById('paymentInfoTitle'),
      closePaymentInfo: document.getElementById('closePaymentInfo'),
      expandAllYears: document.getElementById('expandAllYears'),
      collapseAllYears: document.getElementById('collapseAllYears'),
    };

    const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    const money2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 });
    const dtf = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const planColors = ['#ECA400','#F95738','#5E3A73','#52796F','#9A031E'];
    function parseDate(v){
      if(!v) return null;
      const d = new Date(v + 'T00:00:00');
      return Number.isNaN(d.getTime()) ? null : d;
    }
    function formatDate(d){ return dtf.format(d); }
    function escapeHtml(value){
      return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
    }
    function availablePlanColor(){
      const used = new Set(state.plans.map(plan => plan.color).filter(Boolean));
      return planColors.find(color => !used.has(color)) || planColors[0];
    }
    function lightenColor(hex, amount=.45){
      const value = hex.replace('#','');
      const channels = [0,2,4].map(index => parseInt(value.slice(index,index + 2), 16));
      return `rgb(${channels.map(channel => Math.round(channel + (255 - channel) * amount)).join(', ')})`;
    }
    function toInputDate(d){
      const z = new Date(d.getTime() - d.getTimezoneOffset()*60000);
      return z.toISOString().slice(0,10);
    }
    function addMonths(date, months){
      const d = new Date(date.getTime());
      const targetDay = d.getDate();
      d.setMonth(d.getMonth() + months, 1);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(targetDay, lastDay));
      return d;
    }
    function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }

    function loanInputs(){
      return {
        principal: Number(els.loanAmount.value) || 0,
        annualRate: Number(els.rate.value) || 0,
        years: Number(els.termYears.value) || 0,
        startDate: parseDate(els.startDate.value) || new Date(),
        paymentDay: clamp(Number(els.paymentDay.value) || 1, 1, 28)
      };
    }

    function monthlyPayment(principal, annualRate, months){
      if(months <= 0) return principal;
      const r = annualRate / 12 / 100;
      if(r === 0) return principal / months;
      return principal * (r / (1 - Math.pow(1 + r, -months)));
    }

    function firstPaymentOnOrAfter(target){
      const { startDate:start, paymentDay } = loanInputs();
      let current = new Date(start.getFullYear(), start.getMonth(), paymentDay);
      if(current < start) current = addMonths(current, 1);
      for(let i=0;i<1200;i++){
        if(current >= target) return current;
        current = addMonths(current, 1);
      }
      return current;
    }

    function isSameMonth(a,b){
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
    }

    function scheduledLoanEndDate(){
      const { startDate:start, paymentDay, years } = loanInputs();
      const months = Math.max(1, Math.round(years * 12));
      let first = new Date(start.getFullYear(), start.getMonth(), paymentDay);
      if(first < start) first = addMonths(first, 1);
      return addMonths(first, months - 1);
    }

    function activePlan(){
      return state.plans.find(plan => plan.id === state.activePlanId) || state.plans[0];
    }

    function groupRowsByYear(rows){
      const groups = new Map();
      rows.forEach(row => {
        const year = row.date.getFullYear();
        if(!groups.has(year)) groups.set(year, []);
        groups.get(year).push(row);
      });
      return [...groups.entries()];
    }
