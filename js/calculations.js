    function beginningBalanceAt(rows, month){
      return month <= 1 ? loanInputs().principal : rows[month - 2]?.endingBalance || 0;
    }

    function computeScenario({includeExtras, rules} = {}){
      const { principal, annualRate, years, startDate, paymentDay } = loanInputs();
      const months = Math.max(1, Math.round(years * 12));
      const payment = monthlyPayment(principal, annualRate, months);
      const r = annualRate / 12 / 100;
      const rows = [];
      let balance = principal;
      let month = 1;
      let paymentDate = new Date(startDate.getFullYear(), startDate.getMonth(), paymentDay);
      if(paymentDate < startDate) paymentDate = addMonths(paymentDate, 1);
      let cumulativeInterest = 0;
      let cumulativePrincipal = 0;
      const maxMonths = Math.max(months + 120, 1200);
      while(balance > 0.009 && month <= maxMonths){
        const interest = balance * r;
        let scheduled = Math.min(payment, balance + interest);
        let extra = 0;
        if(includeExtras){
          for(const rule of (rules || activePlan().rules)){
            extra += extraForRule(rule, paymentDate);
          }
        }
        const maxPay = balance + interest;
        const totalPay = Math.min(maxPay, scheduled + extra);
        const interestPaid = Math.min(interest, totalPay);
        const principalPaid = totalPay - interestPaid;
        const ending = Math.max(0, balance - principalPaid);
        cumulativeInterest += interestPaid;
        cumulativePrincipal += principalPaid;
        rows.push({
          month,
          date: new Date(paymentDate.getTime()),
          scheduledPayment: scheduled,
          extraPayment: Math.max(0, totalPay - scheduled),
          interest: interestPaid,
          principal: principalPaid,
          endingBalance: ending,
          cumulativeInterest,
          cumulativePrincipal
        });
        balance = ending;
        paymentDate = addMonths(paymentDate, 1);
        month += 1;
        if(interest === 0 && scheduled + extra <= 0) break;
      }
      return {
        payment,
        rows,
        payoffDate: rows.length ? rows[rows.length - 1].date : startDate,
        totalInterest: cumulativeInterest
      };
    }

    function extraForRule(rule, paymentDate){
      const amount = Number(rule.amount) || 0;
      if(amount <= 0) return 0;
      const start = parseDate(rule.start);
      const end = parseDate(rule.end);
      const date = parseDate(rule.date);
      const loanEnd = scheduledLoanEndDate();
      if(rule.type === 'oneTime'){
        if(!date) return 0;
        const hit = paymentDate >= date && isSameMonth(paymentDate, firstPaymentOnOrAfter(date));
        return hit ? amount : 0;
      }
      if(rule.type === 'monthly'){
        if(start && paymentDate < start) return 0;
        if(paymentDate > (end || loanEnd)) return 0;
        return amount;
      }
      if(rule.type === 'annual'){
        if(!start || paymentDate < start || paymentDate > (end || loanEnd)) return 0;
        return paymentDate.getMonth() === start.getMonth() ? amount : 0;
      }
      return 0;
    }
