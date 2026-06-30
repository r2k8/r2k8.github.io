let currentTimeframe = '1d';

document.addEventListener('DOMContentLoaded', initDashboard);

function initDashboard() {
    fetchData();
    // Refresh data every 30 seconds
    setInterval(fetchData, 30000); 
    
    // Setup timeframe toggles
    document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTimeframe = e.target.dataset.tf;
            fetchData();
        });
    });
}

async function fetchData() {
    try {
        const timestamp = new Date().getTime();
        
        let sankeyData = null, siteData = null, l3Data = null, logText = null;

        // 1. Fetch our newly generated static pre-compute data.
        const sankeyRes = await fetch(`data/sankey_data_${currentTimeframe}.json?t=${timestamp}`);
        if (sankeyRes.ok) {
            sankeyData = await sankeyRes.json();
            renderEChartsSankey(sankeyData);
            if (sankeyData.last_updated) renderDataFreshness(sankeyData.last_updated);
            if (sankeyData.discovery_radar) renderDiscoveryQuadrant(sankeyData.discovery_radar);
        } else {
            document.getElementById('capital-flow-container').innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Awaiting GitHub Actions Data Pipeline...</div>';
        }

        // 2. Fetch legacy Site Data for Earnings Radar
        const siteDataRes = await fetch(`data/site_data.json?t=${timestamp}`);
        if (siteDataRes.ok) {
            siteData = await siteDataRes.json();
            updateLayer1(siteData);
        }

        // 3. Fetch Layer 3 Orders
        const l3Res = await fetch(`data/layer3_orders.json?t=${timestamp}`);
        if (l3Res.ok) {
            l3Data = await l3Res.json();
            renderLayer2(l3Data);
            updateLayer3(l3Data);
        }

        // 4. Fetch Cron Logs
        const logRes = await fetch(`data/cron_output.log?t=${timestamp}`);
        if (logRes.ok) {
            logText = await logRes.text();
            const logEl = document.getElementById('cron-logs');
            logEl.textContent = logText;
            logEl.scrollTop = logEl.scrollHeight;
        }

        // --- Build Decision Strip ---
        let tradeMode = "NEUTRAL";
        let modeColor = "#f59e0b";
        let buyCount = 0, sellCount = 0, holdCount = 0;
        
        if (l3Data && Array.isArray(l3Data)) {
            l3Data.forEach(order => {
                if (order.signal && order.signal.signal_type === "buy") buyCount++;
                else if (order.signal && order.signal.signal_type === "sell") sellCount++;
                else holdCount++;
            });
            if (sellCount > buyCount) { tradeMode = "CAUTION"; modeColor = "#ef4444"; }
            else if (buyCount > sellCount + holdCount) { tradeMode = "AGGRESSIVE"; modeColor = "#10b981"; }
            else { tradeMode = "SELECTIVE"; modeColor = "#3b82f6"; }
        }
        
        let dataHealth = "Optimal";
        let healthColor = "#10b981";
        if (logText) {
            if (logText.includes("ERROR") || logText.includes("WARNING")) {
                dataHealth = "Degraded";
                healthColor = "#f59e0b";
            }
        }
        
        let primarySector = sankeyData && sankeyData.regime_summary ? sankeyData.regime_summary.inflow + " inflow" : "Mixed";
        
        let confidence = 50;
        if (tradeMode === "AGGRESSIVE") confidence += 30;
        if (dataHealth === "Degraded") confidence -= 15;
        if (sellCount > 0) confidence -= (sellCount * 5);
        confidence = Math.max(0, Math.min(100, Math.round(confidence)));
        
        let spyAction = "mixed", qqqAction = "mixed", smhAction = "watch", tltAction = null, iwmAction = null;
        if (l3Data && Array.isArray(l3Data)) {
            l3Data.forEach(order => {
                if (order.signal && order.signal.symbol === "SPY") spyAction = order.signal.signal_type;
                if (order.signal && order.signal.symbol === "QQQ") qqqAction = order.signal.signal_type;
                if (order.signal && order.signal.symbol === "SMH") smhAction = order.signal.signal_type;
                if (order.signal && order.signal.symbol === "TLT") tltAction = order.signal.signal_type;
                if (order.signal && order.signal.symbol === "IWM") iwmAction = order.signal.signal_type;
            });
        }
        const mapAction = (a) => a === "sell" ? "avoid" : (a === "buy" ? "buy" : "watch");
        let etfBias = `SMH ${mapAction(smhAction)}, QQQ ${mapAction(qqqAction)}, SPY ${mapAction(spyAction)}`;
        
        let extensions = [];
        if (tltAction) extensions.push(`TLT ${mapAction(tltAction)}`);
        if (iwmAction) extensions.push(`IWM ${mapAction(iwmAction)}`);
        if (extensions.length > 0) {
            etfBias += `; ${extensions.join(", ")}`;
        }
        
        let mainRisk = "Standard market volatility";
        let riskFactors = [];
        if (sellCount > buyCount) riskFactors.push("Layer 3 sell pressure");
        if (sankeyData && sankeyData.regime_summary && sankeyData.regime_summary.title.includes("Bear")) riskFactors.push("elevated global fear");
        if (dataHealth === "Degraded") riskFactors.push("degraded pipeline feeds");
        
        if (riskFactors.length > 0) {
            mainRisk = riskFactors.join(" + ");
        }

        const modeEl = document.getElementById('ds-mode');
        if (modeEl) {
            modeEl.textContent = tradeMode;
            modeEl.style.color = modeColor;
            document.getElementById('ds-confidence').textContent = `${confidence}%`;
            document.getElementById('ds-flow').textContent = primarySector;
            document.getElementById('ds-risk').textContent = mainRisk;
            document.getElementById('ds-etf').textContent = etfBias;
            document.getElementById('ds-health').textContent = dataHealth;
            document.getElementById('ds-health').style.color = healthColor;
        }
    } catch (e) {
        console.error("Dashboard Fetch Error:", e);
    }
}

function parseEngineTimestamp(value) {
    if (!value) return null;
    const normalized = value.includes('T') ? value : value.replace(' UTC', 'Z').replace(' ', 'T');
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function renderDataFreshness(lastUpdated) {
    const tsEl = document.getElementById('sankey-timestamp');
    if (!tsEl) return;

    const parsed = parseEngineTimestamp(lastUpdated);
    if (!parsed) {
        tsEl.innerHTML = `<span style="color:#f59e0b;">Data timestamp unavailable</span>`;
        return;
    }

    const ageMinutes = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 60000));
    const ageLabel = ageMinutes < 60 ? `${ageMinutes}m ago` : `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m ago`;
    const now = new Date();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    const stale = !isWeekend && ageMinutes > 90;
    const color = stale ? '#ef4444' : '#10b981';
    const status = stale ? 'STALE DATA' : (isWeekend ? 'Market Closed' : 'Live Engine Data');

    tsEl.innerHTML = `<div class="pulse-dot"></div><span style="color:${color}; font-weight:700;">${status}</span> &bull; Last Updated: ${lastUpdated} &bull; ${ageLabel}`;
}

function updateLayer1(data) {
    if (data.earnings_radar) {
        renderEarningsRadar(data.earnings_radar);
    }
    
    // Render Regime Metrics
    const regimeBody = document.getElementById('regime-metrics-body');
    if (regimeBody && data.regime_metrics) {
        const rm = data.regime_metrics;
        regimeBody.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.4); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">Breadth Ratio (RSP/SPY)</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: ${rm.breadth_ratio < 0.95 ? 'var(--bear)' : 'var(--bull)'}">${rm.breadth_ratio.toFixed(2)}</div>
            </div>
            <div style="background: rgba(15, 23, 42, 0.4); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">Risk Ratio (SPHB/SPLV)</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: ${rm.risk_ratio > 1.0 ? 'var(--bull)' : 'var(--bear)'}">${rm.risk_ratio.toFixed(2)}</div>
            </div>
            <div style="background: rgba(15, 23, 42, 0.4); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">Growth vs Defensive (XLY/XLP)</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: ${rm.growth_defensive_ratio > 1.0 ? 'var(--bull)' : 'var(--bear)'}">${rm.growth_defensive_ratio.toFixed(2)}</div>
            </div>
            <div style="background: rgba(15, 23, 42, 0.4); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">VIX Term Structure (^VIX/^VIX3M)</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: ${rm.vix_term_structure > 1.0 ? 'var(--bear)' : 'var(--bull)'}">${rm.vix_term_structure.toFixed(2)}</div>
            </div>
        `;
    }

    // Render Sentiment
    const sentimentBody = document.getElementById('sentiment-body');
    if (sentimentBody && data.sentiment) {
        const s = data.sentiment;
        
        let eventsHtml = '';
        for (const [event, isActive] of Object.entries(s.events)) {
            if (isActive) {
                eventsHtml += `<span class="tag tag-stop" style="margin-right: 0.5rem; margin-bottom: 0.5rem; display: inline-block;">⚠️ ${event.toUpperCase()} DETECTED</span>`;
            } else {
                eventsHtml += `<span class="tag" style="background: rgba(255,255,255,0.05); color: #64748b; margin-right: 0.5rem; margin-bottom: 0.5rem; display: inline-block;">NO ${event.toUpperCase()}</span>`;
            }
        }

        sentimentBody.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: rgba(15, 23, 42, 0.4); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.5rem;">Global Panic / Fear Score</div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: ${s.fear_score > 0.6 ? 'var(--bear)' : 'var(--text-muted)'}">${(s.fear_score * 100).toFixed(1)}%</div>
                        <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                            <div style="width: ${s.fear_score * 100}%; height: 100%; background: ${s.fear_score > 0.6 ? 'var(--bear)' : 'var(--text-muted)'};"></div>
                        </div>
                    </div>
                </div>
                <div style="background: rgba(15, 23, 42, 0.4); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.5rem;">Global Euphoria / Bullish Score</div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: ${s.bullish_score > 0.6 ? 'var(--bull)' : 'var(--text-muted)'}">${(s.bullish_score * 100).toFixed(1)}%</div>
                        <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                            <div style="width: ${s.bullish_score * 100}%; height: 100%; background: ${s.bullish_score > 0.6 ? 'var(--bull)' : 'var(--text-muted)'};"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="margin-bottom: 1rem;">
                <div style="font-size: 0.9rem; color: #f8fafc; margin-bottom: 0.5rem;">Active Event Monitors</div>
                <div>${eventsHtml}</div>
            </div>
        `;
    }

}

function renderDiscoveryQuadrant(radarData) {
    const container = document.getElementById('discovery-flow-container');
    if (!container || !radarData || radarData.length === 0) return;
    
    let myChart = echarts.getInstanceByDom(container);
    if (!myChart) {
        container.innerHTML = '';
        myChart = echarts.init(container);
        window.addEventListener('resize', () => {
            if (myChart) myChart.resize();
        });
    }

    // Color map for sectors
    const sectorColors = {
        "Technology": "#3b82f6",
        "Healthcare": "#ec4899",
        "Financial Services": "#eab308",
        "Consumer Cyclical": "#8b5cf6",
        "Industrials": "#f97316",
        "Energy": "#14b8a6",
        "Unknown": "#94a3b8"
    };

    const seriesData = radarData.map(item => {
        // X = Fundamental Growth (Rev + Earn)
        const fundamentalGrowth = ((item.rev_growth || 0) + (item.earn_growth || 0)) * 100;
        // Y = Price Momentum
        const momentum = (item.price_change || 0) * 100;
        
        return {
            name: item.symbol,
            companyName: item.name || item.symbol,
            value: [fundamentalGrowth, momentum, item.dollar_volume, item.sector],
            itemStyle: {
                color: sectorColors[item.sector] || sectorColors["Unknown"]
            }
        };
    });

    const option = {
        title: {
            text: 'Super Gainer Quadrant',
            subtext: 'X: Fundamental Growth | Y: Price Momentum | Size: Volume',
            left: 'center',
            textStyle: { color: '#f8fafc', fontSize: 14, fontFamily: 'Outfit' },
            subtextStyle: { color: '#94a3b8' }
        },
        grid: { left: '10%', right: '10%', bottom: '15%', top: '15%' },
        tooltip: {
            backgroundColor: 'rgba(20, 25, 40, 0.9)',
            borderColor: 'rgba(255,255,255,0.1)',
            textStyle: { color: '#f8fafc' },
            formatter: function (params) {
                const data = params.data;
                const formatUSD = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(v);
                return `<div style="font-weight:600; font-size:14px; margin-bottom:4px; color:${data.itemStyle.color}">${data.name} - ${data.companyName} <span style="font-size:11px; color:#94a3b8;">(${data.value[3]})</span></div>
                        <div style="font-size:12px; color:#94a3b8;">Fundamental Growth (Rev+EPS): <span style="color:#f8fafc; font-weight:600;">${data.value[0].toFixed(1)}%</span></div>
                        <div style="font-size:12px; color:#94a3b8;">Price Momentum: <span style="color:#f8fafc; font-weight:600;">${data.value[1].toFixed(1)}%</span></div>
                        <div style="font-size:12px; color:#94a3b8;">Dollar Volume: <span style="color:#f8fafc; font-weight:600;">${formatUSD(data.value[2])}</span></div>`;
            }
        },
        xAxis: {
            type: 'value',
            name: 'Fundamental Growth %',
            nameLocation: 'middle',
            nameGap: 30,
            splitLine: { lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.1)' } },
            axisLabel: { color: '#94a3b8', formatter: '{value}%' }
        },
        yAxis: {
            type: 'value',
            name: 'Price Momentum %',
            nameLocation: 'middle',
            nameGap: 40,
            splitLine: { lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.1)' } },
            axisLabel: { color: '#94a3b8', formatter: '{value}%' }
        },
        series: [{
            type: 'scatter',
            data: seriesData,
            symbolSize: function (data) {
                return Math.max(Math.min(data[2] / 1e7, 40), 10);
            },
            label: {
                show: true,
                formatter: '{b}',
                position: 'top',
                color: '#f8fafc',
                fontSize: 11
            },
            itemStyle: { opacity: 0.8, shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
            markLine: {
                lineStyle: { type: 'solid', color: 'rgba(255,255,255,0.2)' },
                symbol: ['none', 'none'],
                data: [
                    { xAxis: 0 },
                    { yAxis: 0 }
                ]
            }
        }]
    };
    
    myChart.setOption(option);
}

function renderEChartsSankey(sankeyData) {
    const container = document.getElementById('capital-flow-container');
    
    let myChart = echarts.getInstanceByDom(container);
    if (!myChart) {
        container.innerHTML = ''; // clear loader
        myChart = echarts.init(container);
        
        window.addEventListener('resize', () => {
            if (myChart) myChart.resize();
        });
    }
    
    const option = {
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            backgroundColor: 'rgba(20, 25, 40, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#f8fafc' },
            formatter: function (params) {
                if (params.dataType === 'node') {
                    return `<div style="font-weight:600;margin-bottom:4px;">${params.data.name}</div>`;
                } else {
                    const val = params.data.net_flow_dollars;
                    const mcDelta = params.data.market_cap_delta;
                    const sign = val > 0 ? '+' : '';
                    const color = val >= 0 ? '#10b981' : '#ef4444';
                    const formatUSD = (v) => v ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 }).format(v) : 'N/A';
                    const dollars = formatUSD(val);
                        
                    return `<div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">Trading Flow Velocity</div>
                            <div style="font-weight:600;margin-bottom:4px;">${params.data.source} → ${params.data.target}</div>
                            <span style="color:${color};font-size:14px;font-weight:700">${sign}${dollars}</span>
                            <div style="font-size:10px;color:#64748b;margin-top:4px;">(Price %Δ × Traded Volume)</div>
                            <div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px;">
                                <div style="font-size:12px;color:#94a3b8;">Valuation Growth (Market Cap)</div>
                                <span style="color:${mcDelta >= 0 ? '#10b981' : '#ef4444'};font-size:13px;font-weight:600">${mcDelta > 0 ? '+' : ''}${formatUSD(mcDelta)}</span>
                            </div>`;
                }
            }
        },
        series: [
            {
                type: 'sankey',
                roam: true, // Enables zoom and pan functionality
                nodeAlign: 'left', // Packs the funnel naturally instead of stretching it to the edges
                layoutIterations: 32, // Allows ECharts to automatically untangle overlapping lines
                data: sankeyData.nodes,
                links: sankeyData.links,
                emphasis: { focus: 'adjacency' },
                nodeWidth: 16, // Thicker, premium-looking nodes
                nodeGap: 12, // Increases vertical spacing so labels don't overlap
                top: '5%',
                bottom: '5%',
                left: '2%',
                right: '15%', // Leave more room on the right for the final leaf labels
                itemStyle: {
                    borderWidth: 0,
                    borderRadius: 3,
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                },
                label: {
                    position: 'right',
                    color: '#f8fafc',
                    fontFamily: 'Outfit',
                    fontSize: 10,
                    fontWeight: 500,
                    padding: [0, 0, 0, 5]
                },
                lineStyle: { 
                    color: 'gradient', // Creates a beautiful smooth color fade from source node to target node
                    curveness: 0.6,
                    opacity: 0.45
                }
            }
        ]
    };
    
    myChart.setOption(option);
    

}

function renderEarningsRadar(earningsData) {
    const container = document.getElementById('earnings-calendar');
    
    // Calculate the target Monday for this week (or next if weekend)
    const d = new Date();
    const day = d.getDay();
    const daysToAdd = day === 0 ? 1 : (day === 6 ? 2 : 1 - day);
    const monday = new Date(d.setDate(d.getDate() + daysToAdd));
    
    const label = document.getElementById('earnings-week-label');
    if (label) {
        label.innerHTML = `For the week beginning ${monday.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}`;
    }
    
    // Group by day of the week
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const scheduleMap = {
        'Monday': {before: [], after: []},
        'Tuesday': {before: [], after: []},
        'Wednesday': {before: [], after: []},
        'Thursday': {before: [], after: []},
        'Friday': {before: [], after: []}
    };
    
    // Calculate the end of the target week (Sunday)
    const targetWeekEnd = new Date(monday);
    targetWeekEnd.setDate(monday.getDate() + 6);
    
    earningsData.forEach(item => {
        if (!item.Date) return;
        const dateObj = new Date(item.Date);
        
        // Strictly ignore earnings that are not in this target week
        if (dateObj < monday || dateObj > targetWeekEnd) {
            return;
        }
        
        const dayIndex = dateObj.getUTCDay() - 1; // 0=Sunday, 1=Monday
        if (dayIndex >= 0 && dayIndex < 5) {
            const dayName = days[dayIndex];
            const dataObj = {
                t: item.Symbol,
                n: item.Company || item.Symbol,
                dom: item.Domain || (item.Symbol.toLowerCase() + '.com'),
                p: item.Price ? parseFloat(item.Price).toFixed(2) : 'N/A',
                rg: item.RevGrowth ? (parseFloat(item.RevGrowth) * 100).toFixed(1) + '%' : '0%',
                eg: item.EarnGrowth ? (parseFloat(item.EarnGrowth) * 100).toFixed(1) + '%' : '0%',
                sig: item.Signal || 'Neutral'
            };
            if (item.Timing === 'After Close') {
                scheduleMap[dayName].after.push(dataObj);
            } else {
                scheduleMap[dayName].before.push(dataObj);
            }
        }
    });

    const schedule = days.map(day => ({
        day: day,
        before: scheduleMap[day].before,
        after: scheduleMap[day].after
    }));

    container.innerHTML = schedule.map(day => `
        <div class="earnings-day">
            <div class="day-header">${day.day}</div>
            <div class="day-body">
                <div class="day-half">
                    <div class="half-header">Before Open ☀️</div>
                    ${day.before.map(c => `
                        <div class="company-card">
                            <img class="company-logo" src="https://logo.clearbit.com/${c.dom}" onerror="this.style.display='none'">
                            <div class="company-ticker" style="color: #60a5fa">${c.t}</div>
                            <div class="company-name">${c.n}</div>
                            <div style="font-size: 0.8rem; margin-top: 0.5rem; color: #cbd5e1;">Price: $${c.p}</div>
                            <div style="font-size: 0.75rem; color: #94a3b8;">Rev: ${c.rg} | EPS: ${c.eg}</div>
                            <div style="margin-top: 0.4rem;">
                                <span class="tag" style="background: ${c.sig === 'Strong Buy' ? 'rgba(34,197,94,0.2)' : c.sig === 'Buy' ? 'rgba(59,130,246,0.2)' : c.sig === 'Avoid' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)'}; color: ${c.sig === 'Strong Buy' ? '#4ade80' : c.sig === 'Buy' ? '#60a5fa' : c.sig === 'Avoid' ? '#f87171' : '#94a3b8'}; padding: 2px 6px; font-size: 0.7rem; border-radius: 4px;">${c.sig}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="day-half">
                    <div class="half-header">After Close 🌙</div>
                    ${day.after.map(c => `
                        <div class="company-card">
                            <img class="company-logo" src="https://logo.clearbit.com/${c.dom}" onerror="this.style.display='none'">
                            <div class="company-ticker" style="color: #f472b6">${c.t}</div>
                            <div class="company-name">${c.n}</div>
                            <div style="font-size: 0.8rem; margin-top: 0.5rem; color: #cbd5e1;">Price: $${c.p}</div>
                            <div style="font-size: 0.75rem; color: #94a3b8;">Rev: ${c.rg} | EPS: ${c.eg}</div>
                            <div style="margin-top: 0.4rem;">
                                <span class="tag" style="background: ${c.sig === 'Strong Buy' ? 'rgba(34,197,94,0.2)' : c.sig === 'Buy' ? 'rgba(59,130,246,0.2)' : c.sig === 'Avoid' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)'}; color: ${c.sig === 'Strong Buy' ? '#4ade80' : c.sig === 'Buy' ? '#60a5fa' : c.sig === 'Avoid' ? '#f87171' : '#94a3b8'}; padding: 2px 6px; font-size: 0.7rem; border-radius: 4px;">${c.sig}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

function updateLayer3(data) {
    const container = document.getElementById('target-body');
    const target = data.find(order => order.approved && order.target_position_size_usd > 0);
    
    if (target) {
        container.innerHTML = `
            <div class="target-symbol">${target.symbol}</div>
            <div class="target-row">
                <span class="tag tag-buy">Buy $${target.target_position_size_usd.toFixed(2)}</span>
                ${target.stop_loss_price ? `<span class="tag tag-stop">Stop-Loss $${target.stop_loss_price.toFixed(2)}</span>` : ''}
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="target-symbol" style="color: var(--text-muted); font-size: 2rem;">CASH</div>
            <div class="target-row">
                <span class="tag" style="background: rgba(255,255,255,0.1);">No actionable buys today.</span>
            </div>
        `;
    }
}

function renderLayer2(data) {
    const container = document.getElementById('layer2-body');
    if (!data || data.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted);">No signals generated.</div>`;
        return;
    }
    
    // Render top 3 signals or avoid signals
    let html = '<div style="display:flex; flex-direction:column; gap:1rem;">';
    
    // Sort by confidence
    const sorted = data.sort((a, b) => (b.signal.confidence || 0) - (a.signal.confidence || 0)).slice(0, 5);
    
    sorted.forEach(item => {
        const sig = item.signal;
        let badgeClass = 'tag-stop';
        if (sig.signal_type === 'buy') badgeClass = 'tag-buy';
        else if (sig.signal_type === 'hold') badgeClass = '';
        else if (sig.signal_type === 'trim') badgeClass = 'tag-trim';
        else if (sig.signal_type === 'liquidate') badgeClass = 'tag-liquidate';
        
        let reasonsHtml = sig.reasons ? sig.reasons.map(r => `<li style="font-size:0.85rem; color:#94a3b8; margin-top:0.25rem;">${r}</li>`).join('') : '';
        
        html += `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
                    <strong style="font-size:1.1rem; color:#f8fafc;">${sig.symbol}</strong>
                    <span class="tag ${badgeClass}">${sig.signal_type.toUpperCase()} (Conf: ${(sig.confidence * 100).toFixed(0)}%)</span>
                </div>
                <ul style="margin:0; padding-left:1.2rem;">${reasonsHtml}</ul>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Auto-refresh the dashboard data every 15 minutes without reloading the page
setInterval(fetchData, 15 * 60 * 1000);
