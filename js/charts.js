      }
      return 0;
    }

    function drawChart(svg, series, opts){
      const width = 1000, height = 320;
      const pad = {l:88,r:24,t:18,b:46};
      const plotW = width - pad.l - pad.r;
      const plotH = height - pad.t - pad.b;
      const maxX = Math.max(1, ...series.map(s => s.x[s.x.length - 1] || 1));
      const maxY = Math.max(1, ...series.flatMap(s => s.y).filter(v => Number.isFinite(v)));
      const minY = 0;
      const yLabel = opts.formatAxisY || opts.formatY;
      const xTickCount = maxX <= 24 ? 6 : maxX <= 60 ? 7 : 9;
      const xSpan = Math.max(1, maxX - 1);
      const lines = [];
      for(let i=0;i<5;i++){
        const y = pad.t + plotH * (i / 4);
        const val = maxY - (maxY - minY) * (i / 4);
        lines.push(`<line x1="${pad.l}" y1="${y}" x2="${width-pad.r}" y2="${y}" stroke="rgba(82,94,167,.16)"/><text x="${pad.l-12}" y="${y+4}" text-anchor="end" fill="#66738f" font-size="12">${yLabel(val)}</text>`);
      }
      for(let i=0;i<xTickCount;i++){
        const fraction = i / (xTickCount - 1);
        const x = pad.l + plotW * fraction;
        const val = 1 + Math.round(xSpan * fraction);
        lines.push(`<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${height-pad.b}" stroke="rgba(82,94,167,.10)"/><text x="${x}" y="${height-20}" text-anchor="middle" fill="#66738f" font-size="12">${val}</text>`);
      }
      lines.push(`<text x="${pad.l + plotW / 2}" y="${height-4}" text-anchor="middle" fill="#27345d" font-size="12" font-weight="700">${opts.xLabel || 'Months'}</text>`);
      lines.push(`<text x="18" y="${pad.t + plotH / 2}" text-anchor="middle" fill="#27345d" font-size="12" font-weight="700" transform="rotate(-90 18 ${pad.t + plotH / 2})">${opts.yLabel || 'Amount'}</text>`);
      const paths = series.map(s => {
        const points = s.x.map((x, i) => {
          const px = pad.l + plotW * ((x - 1) / xSpan);
          const py = pad.t + plotH * (1 - (s.y[i] - minY) / (maxY - minY || 1));
          return `${px},${py}`;
        }).join(' ');
        const d = s.x.map((x,i) => {
          const px = pad.l + plotW * ((x - 1) / xSpan);
          const py = pad.t + plotH * (1 - (s.y[i] - minY) / (maxY - minY || 1));
          return `${i===0?'M':'L'} ${px} ${py}`;
        }).join(' ');
        return `
          <path d="${d}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="${points}" fill="none" stroke="${s.color}" opacity=".08" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
        `;
      }).join('');
      svg.innerHTML = `
        <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="transparent"></rect>
        ${lines.join('')}
