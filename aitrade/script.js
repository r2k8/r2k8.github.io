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
        
        // 1. Fetch our newly generated Static Pre-compute data from Gist!
        const sankeyRes = await fetch(`data/sankey_data_${currentTimeframe}.json?t=${timestamp}`);
        if (sankeyRes.ok) {
            const sankeyData = await sankeyRes.json();
            renderEChartsSankey(sankeyData);
            if (sankeyData.last_updated) {
                document.getElementById('sankey-timestamp').innerHTML = `Live Engine Data &bull; Last Updated: ${sankeyData.last_updated}`;
            }
            
            // Hydrate dynamic regime
            if (sankeyData.regime_summary) {
                const rs = sankeyData.regime_summary;
                const titleEl = document.getElementById('regime-title');
                titleEl.textContent = rs.title;
                titleEl.className = `metric-large ${rs.title === 'Bull Market (Buying)' ? 'text-bull' : 'text-bear'}`;
                titleEl.style.color = rs.title === 'Bull Market (Buying)' ? '#10b981' : '#ef4444';
                
                const liqEl = document.getElementById('gl-status');
                liqEl.textContent = rs.liquidity;
                liqEl.style.color = rs.liquidity.includes('Positive') ? '#10b981' : '#ef4444';
                
                document.getElementById('gl-inflow').textContent = rs.inflow;
                document.getElementById('gl-outflow').textContent = rs.outflow;
                document.getElementById('gl-health').textContent = `Data Health: ${rs.health}`;
            }
        } else {
            document.getElementById('capital-flow-container').innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Awaiting GitHub Actions Data Pipeline...</div>';
        }

        // 2. Fetch legacy Site Data for Earnings Radar (until we move it to the python pipeline)
        const siteDataRes = await fetch(`data/site_data.json?t=${timestamp}`);
        if (siteDataRes.ok) {
            const data = await siteDataRes.json();
            updateLayer1(data);
        }

        // 3. Fetch Layer 3 Orders (which contain Layer 2 signals)
        const l3Res = await fetch(`data/layer3_orders.json?t=${timestamp}`);
        if (l3Res.ok) {
            const data = await l3Res.json();
            renderLayer2(data);
            updateLayer3(data);
        }

        // 4. Fetch Cron Logs
        const logRes = await fetch(`data/cron_output.log?t=${timestamp}`);
        if (logRes.ok) {
            const text = await logRes.text();
            const logEl = document.getElementById('cron-logs');
            logEl.textContent = text;
            logEl.scrollTop = logEl.scrollHeight;
        }
    } catch (e) {
        console.error("Dashboard Fetch Error:", e);
    }
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

    if (data.discovery_radar) {
        renderDiscoverySankey(data.discovery_radar);
    }
}

function renderDiscoverySankey(radarData) {
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

    const nodes = [{ name: "S&P 500 Screen", itemStyle: { color: "#f8fafc" } }];
    const links = [];
    
    radarData.forEach(bar => {
        const symbol = bar.symbol;
        const color = "#10b981"; // Breakouts are positive momentum
        const dollarVolume = bar.latest_volume * bar.close;
        const weight = dollarVolume / 1e7 > 1 ? dollarVolume / 1e7 : 1;
        
        nodes.push({ name: symbol, itemStyle: { color: color } });
        links.push({
            source: "S&P 500 Screen",
            target: symbol,
            value: weight,
            raw_volume: dollarVolume,
            price: bar.close,
            lineStyle: { color: color, opacity: 0.4 }
        });
    });
    
    const option = {
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            backgroundColor: 'rgba(20, 25, 40, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#f8fafc' },
            formatter: function (params) {
                if (params.dataType === 'node') {
                    return `<div style="font-weight:600;">${params.data.name}</div>`;
                } else {
                    const formatUSD = (v) => v ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(v) : 'N/A';
                    return `<div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">Breakout Flow</div>
                            <div style="font-weight:600;margin-bottom:4px;">${params.data.target}</div>
                            <span style="color:#10b981;font-size:14px;font-weight:700">$${params.data.price.toFixed(2)}</span>
                            <div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px;">
                                <div style="font-size:12px;color:#94a3b8;">Dollar Volume</div>
                                <span style="color:#f8fafc;font-size:13px;font-weight:600">${formatUSD(params.data.raw_volume)}</span>
                            </div>`;
                }
            }
        },
        series: [{
            type: 'sankey',
            nodeAlign: 'right',
            layoutIterations: 32,
            data: nodes,
            links: links,
            nodeWidth: 16,
            nodeGap: 16,
            top: '10%',
            bottom: '10%',
            left: '5%',
            right: '20%',
            itemStyle: { borderWidth: 0, borderRadius: 3 },
            label: {
                position: 'right',
                color: '#f8fafc',
                fontFamily: 'Outfit',
                fontSize: 13,
                fontWeight: 600
            },
            lineStyle: { curveness: 0.5 }
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
    
    const label = document.getElementById('earnings-week-label');
    if (label) {
        const d = new Date();
        const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
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
    
    earningsData.forEach(item => {
        if (!item.Date) return;
        const dateObj = new Date(item.Date);
        const dayIndex = dateObj.getUTCDay() - 1; // 0=Sunday, 1=Monday
        if (dayIndex >= 0 && dayIndex < 5) {
            const dayName = days[dayIndex];
            const dataObj = {
                t: item.Symbol,
                n: item.Company || item.Symbol,
                dom: item.Domain || (item.Symbol.toLowerCase() + '.com')
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
