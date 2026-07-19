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
        
        let sankeyData = null, siteData = null, l3Data = null, logText = null, dataQuality = null;

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

        // 4. Fetch explicit Layer 1 data-quality manifest.
        const qualityRes = await fetch(`data/data_quality.json?t=${timestamp}`);
        if (qualityRes.ok) {
            dataQuality = await qualityRes.json();
        }

        // 5. Fetch Cron Logs
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
        if (dataQuality) {
            if (dataQuality.status === "unsafe" || dataQuality.safe_for_layer2 === false) {
                dataHealth = "Unsafe";
                healthColor = "#ef4444";
            } else if (dataQuality.status === "degraded") {
                dataHealth = "Degraded";
                healthColor = "#f59e0b";
            } else {
                dataHealth = "Optimal";
                healthColor = "#10b981";
            }
        } else if (logText) {
            if (logText.includes("ERROR") || logText.includes("WARNING")) {
                dataHealth = "Degraded";
                healthColor = "#f59e0b";
            }
        }
        
        let primarySector = sankeyData && sankeyData.regime_summary ? sankeyData.regime_summary.inflow + " inflow" : "Mixed";
        
        let confidence = 50;
        if (tradeMode === "AGGRESSIVE") confidence += 30;
        if (dataHealth === "Degraded") confidence -= 15;
        if (dataHealth === "Unsafe") confidence = Math.min(confidence, 15);
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
        if (dataHealth === "Unsafe") riskFactors.push("unsafe data quality blocks new trades");
        
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
        const narrative = data.narrative || {};
        const forecast = narrative.forecast || {};
        const buyZone = forecast.buy_zone || 'wait';
        const zoneColor = buyZone === 're-entry' ? 'var(--bull)' : buyZone === 'starter' ? '#60a5fa' : buyZone === 'avoid' ? 'var(--bear)' : '#f59e0b';
        const pct = (value) => `${Math.round((value || 0) * 100)}%`;
        
        let eventsHtml = '';
        for (const [event, isActive] of Object.entries(s.events)) {
            if (isActive) {
                eventsHtml += `<span class="tag tag-stop" style="margin-right: 0.5rem; margin-bottom: 0.5rem; display: inline-block;">⚠️ ${event.toUpperCase()} DETECTED</span>`;
            } else {
                eventsHtml += `<span class="tag" style="background: rgba(255,255,255,0.05); color: #64748b; margin-right: 0.5rem; margin-bottom: 0.5rem; display: inline-block;">NO ${event.toUpperCase()}</span>`;
            }
        }

        sentimentBody.innerHTML = `
            <div class="narrative-card">
                <div class="narrative-topline">
                    <div>
                        <div class="narrative-label">Market Story</div>
                        <div class="narrative-state">${(narrative.state || 'calm').replaceAll('_', ' ')}</div>
                    </div>
                    <div class="narrative-zone" style="color:${zoneColor}; border-color:${zoneColor};">${buyZone.replaceAll('_', ' ')}</div>
                </div>
                <div class="forecast-grid">
                    <div>
                        <span>Next Day Bounce</span>
                        <strong>${pct(forecast.next_day_rebound_probability)}</strong>
                    </div>
                    <div>
                        <span>Next Week Rebound</span>
                        <strong>${pct(forecast.next_week_rebound_probability)}</strong>
                    </div>
                    <div>
                        <span>Next Month Base</span>
                        <strong>${pct(forecast.next_month_base_probability)}</strong>
                    </div>
                </div>
                <div class="narrative-interpretation">${forecast.interpretation || 'No major narrative stress detected.'}</div>
                ${(forecast.reasons || narrative.reasons || []).length ? `
                    <ul class="narrative-reasons">
                        ${(forecast.reasons || narrative.reasons || []).slice(0, 4).map(reason => `<li>${reason}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
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
    const summary = document.getElementById('discovery-summary');
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

    const cleanRows = radarData
        .map(item => {
            const fundamentalGrowth = ((item.rev_growth || 0) + (item.earn_growth || 0)) * 100;
            const momentum = (item.price_change || 0) * 100;
            const dollarVolume = item.dollar_volume || 0;
            return {
                ...item,
                fundamentalGrowth,
                momentum,
                dollarVolume,
                score: Math.max(0, fundamentalGrowth) * 0.55 + Math.max(0, momentum) * 2.5 + Math.log10(Math.max(dollarVolume, 1)) * 3
            };
        })
        .filter(item => Number.isFinite(item.fundamentalGrowth) && Number.isFinite(item.momentum))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);

    if (cleanRows.length === 0) {
        if (summary) summary.innerHTML = '';
        container.innerHTML = '<div style="color: var(--text-muted); padding: 2rem; text-align:center;">No high-conviction breakout candidates passed the current filters.</div>';
        return;
    }

    if (summary) {
        const formatUSD = (v) => new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(v || 0);
        summary.innerHTML = cleanRows.slice(0, 5).map((item, index) => {
            const color = sectorColors[item.sector] || sectorColors["Unknown"];
            const momentumTone = item.momentum >= 0 ? 'text-bull' : 'text-bear';
            return `
                <div class="discovery-pick">
                    <div class="discovery-rank" style="border-color:${color}; color:${color};">#${index + 1}</div>
                    <div class="discovery-main">
                        <div class="discovery-symbol">${item.symbol}</div>
                        <div class="discovery-sector">${item.sector || 'Unknown'}</div>
                    </div>
                    <div class="discovery-metrics">
                        <span>Growth ${item.fundamentalGrowth.toFixed(0)}%</span>
                        <span class="${momentumTone}">Mom ${item.momentum.toFixed(1)}%</span>
                        <span>${formatUSD(item.dollarVolume)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    const quantile = (values, q) => {
        const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (!sorted.length) return 0;
        const pos = (sorted.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    };

    const xValues = cleanRows.map(item => item.fundamentalGrowth);
    const yValues = cleanRows.map(item => item.momentum);
    const xMin = Math.floor(Math.min(-20, quantile(xValues, 0.05) - 10));
    const xMax = Math.ceil(Math.max(40, Math.min(180, quantile(xValues, 0.85) + 18)));
    const yMin = Math.floor(Math.min(-10, quantile(yValues, 0.05) - 2));
    const yMax = Math.ceil(Math.max(12, quantile(yValues, 0.90) + 4));

    const seriesData = cleanRows.map((item, index) => {
        // X = Fundamental Growth (Rev + Earn)
        const fundamentalGrowth = item.fundamentalGrowth;
        // Y = Price Momentum
        const momentum = item.momentum;
        
        return {
            name: item.symbol,
            companyName: item.name || item.symbol,
            rank: index + 1,
            clipped: item.fundamentalGrowth > xMax || item.fundamentalGrowth < xMin || item.momentum > yMax || item.momentum < yMin,
            value: [
                Math.max(xMin, Math.min(xMax, fundamentalGrowth)),
                Math.max(yMin, Math.min(yMax, momentum)),
                item.dollarVolume,
                item.sector,
                fundamentalGrowth,
                momentum
            ],
            itemStyle: {
                color: sectorColors[item.sector] || sectorColors["Unknown"]
            }
        };
    });

    const option = {
        title: {
            text: 'Breakout Quality Map',
            subtext: 'Top 12 only | X: Fundamental Growth | Y: Price Momentum | Size: Volume',
            left: 'center',
            textStyle: { color: '#f8fafc', fontSize: 14, fontFamily: 'Outfit' },
            subtextStyle: { color: '#94a3b8' }
        },
        grid: { left: '8%', right: '6%', bottom: '18%', top: '18%' },
        tooltip: {
            backgroundColor: 'rgba(20, 25, 40, 0.9)',
            borderColor: 'rgba(255,255,255,0.1)',
            textStyle: { color: '#f8fafc' },
            formatter: function (params) {
                const data = params.data;
                const formatUSD = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(v);
                return `<div style="font-weight:600; font-size:14px; margin-bottom:4px; color:${data.itemStyle.color}">#${data.rank} ${data.name} - ${data.companyName} <span style="font-size:11px; color:#94a3b8;">(${data.value[3]})</span></div>
                        <div style="font-size:12px; color:#94a3b8;">Fundamental Growth (Rev+EPS): <span style="color:#f8fafc; font-weight:600;">${data.value[4].toFixed(1)}%</span>${data.clipped ? ' <span style="color:#f59e0b;">clipped on chart</span>' : ''}</div>
                        <div style="font-size:12px; color:#94a3b8;">Price Momentum: <span style="color:#f8fafc; font-weight:600;">${data.value[5].toFixed(1)}%</span></div>
                        <div style="font-size:12px; color:#94a3b8;">Dollar Volume: <span style="color:#f8fafc; font-weight:600;">${formatUSD(data.value[2])}</span></div>`;
            }
        },
        xAxis: {
            type: 'value',
            min: xMin,
            max: xMax,
            name: 'Fundamental Growth %',
            nameLocation: 'middle',
            nameGap: 30,
            splitLine: { lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.1)' } },
            axisLabel: { color: '#94a3b8', formatter: '{value}%' }
        },
        yAxis: {
            type: 'value',
            min: yMin,
            max: yMax,
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
                formatter: function (params) {
                    return params.data.rank <= 6 ? `${params.data.rank}. ${params.name}` : '';
                },
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
    if (!container) return;
    
    const parseDate = (value) => {
        if (!value) return null;
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(Date.UTC(year, month - 1, day));
    };

    const validEarnings = (earningsData || [])
        .map(item => ({ ...item, _date: parseDate(item.Date) }))
        .filter(item => item._date);

    if (validEarnings.length === 0) {
        const label = document.getElementById('earnings-week-label');
        if (label) label.textContent = 'No qualified earnings passed the current filters';
        container.innerHTML = `
            <div style="grid-column: 1 / -1; min-height: 120px; display:flex; align-items:center; justify-content:center; color: var(--text-muted); border:1px dashed rgba(255,255,255,0.12); border-radius:12px;">
                No upcoming large-cap earnings candidates passed the revenue, earnings, and market-cap filters.
            </div>
        `;
        return;
    }

    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const upcomingEarnings = validEarnings
        .filter(item => item._date >= todayUtc)
        .sort((a, b) => a._date - b._date);

    if (upcomingEarnings.length === 0) {
        const newestDate = validEarnings
            .map(item => item._date)
            .sort((a, b) => b - a)[0];
        const label = document.getElementById('earnings-week-label');
        if (label) {
            label.textContent = `Earnings radar stale; newest candidate was ${newestDate.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric', timeZone: 'UTC' })}`;
        }
        container.innerHTML = `
            <div style="grid-column: 1 / -1; min-height: 120px; display:flex; align-items:center; justify-content:center; color: var(--text-muted); border:1px dashed rgba(255,255,255,0.12); border-radius:12px; text-align:center; padding:1.25rem;">
                Earnings data is stale. The next scheduled Layer 1 run should overwrite the CSV with the upcoming earnings week or an explicit empty result.
            </div>
        `;
        return;
    }

    const monday = new Date(upcomingEarnings[0]._date);
    const mondayOffset = (monday.getUTCDay() + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - mondayOffset);
    
    const label = document.getElementById('earnings-week-label');
    if (label) {
        label.innerHTML = `Upcoming qualified earnings week beginning ${monday.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric', timeZone: 'UTC' })}`;
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
    
    upcomingEarnings.forEach(item => {
        const dateObj = item._date;
        
        // Strictly ignore earnings that are not in this target week
        if (dateObj < monday || dateObj > targetWeekEnd) {
            return;
        }
        
        const dayIndex = dateObj.getUTCDay() - 1;
        if (dayIndex >= 0 && dayIndex < 5) {
            const dayName = days[dayIndex];
            const revGrowth = item.RevGrowth ? parseFloat(item.RevGrowth) : 0;
            const earnGrowth = item.EarnGrowth ? parseFloat(item.EarnGrowth) : 0;
            const signal = item.Signal || 'Neutral';
            const dataObj = {
                t: item.Symbol,
                n: item.Company || item.Symbol,
                dom: item.Domain || (item.Symbol.toLowerCase() + '.com'),
                p: item.Price ? parseFloat(item.Price).toFixed(2) : 'N/A',
                rg: `${(revGrowth * 100).toFixed(1)}%`,
                eg: `${(earnGrowth * 100).toFixed(1)}%`,
                sig: signal,
                score: (signal === 'Strong Buy' ? 3 : signal === 'Buy' ? 2 : signal === 'Avoid' ? 0 : 1) + Math.max(0, revGrowth) + Math.max(0, earnGrowth)
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

    const hasVisibleEarnings = schedule.some(day => day.before.length || day.after.length);
    if (!hasVisibleEarnings) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; min-height: 120px; display:flex; align-items:center; justify-content:center; color: var(--text-muted); border:1px dashed rgba(255,255,255,0.12); border-radius:12px;">
                Earnings data is available, but no candidates fall inside the displayed Monday-Friday window.
            </div>
        `;
        return;
    }

    const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const escapeAttr = escapeHtml;
    const renderTickerTile = (c) => {
        const signalClass = c.sig === 'Strong Buy' ? 'earnings-strong' : c.sig === 'Buy' ? 'earnings-buy' : c.sig === 'Avoid' ? 'earnings-avoid' : 'earnings-neutral';
        const title = `${c.t} - ${c.n}\nPrice: $${c.p}\nRevenue Growth: ${c.rg}\nEPS Growth: ${c.eg}\nSignal: ${c.sig}`;
        const company = c.n && c.n !== c.t ? c.n : c.sig;
        return `
            <div class="earnings-tile ${signalClass}" title="${escapeAttr(title)}">
                <div class="earnings-tile-main">
                    <span class="earnings-symbol">${escapeHtml(c.t)}</span>
                    <span class="earnings-signal">${escapeHtml(c.sig)}</span>
                </div>
                <div class="earnings-company">${escapeHtml(company)}</div>
            </div>
        `;
    };
    const renderLane = (items, emptyLabel) => {
        const sorted = [...items].sort((a, b) => b.score - a.score || a.t.localeCompare(b.t));
        if (!sorted.length) {
            return `<div class="earnings-empty">${emptyLabel}</div>`;
        }
        return `<div class="earnings-tile-grid">${sorted.map(renderTickerTile).join('')}</div>`;
    };

    container.innerHTML = schedule.map(day => `
        <div class="earnings-day">
            <div class="day-header">
                <span>${day.day}</span>
                <small>${day.before.length + day.after.length} reports</small>
            </div>
            <div class="earnings-lanes">
                <div class="earnings-lane">
                    <div class="half-header">Before Open</div>
                    ${renderLane(day.before, 'No reports')}
                </div>
                <div class="earnings-lane">
                    <div class="half-header">After Close</div>
                    ${renderLane(day.after, 'No reports')}
                </div>
            </div>
        </div>
    `).join('');
}

function updateLayer3(data) {
    const container = document.getElementById('target-body');
    if (!container) return;

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = `
            <div class="target-symbol" style="color: var(--text-muted); font-size: 2rem;">NO SIGNALS</div>
            <div class="target-row">
                <span class="tag" style="background: rgba(255,255,255,0.1);">Layer 3 has not produced risk evaluations.</span>
            </div>
        `;
        return;
    }

    const target = data.find(order => order.approved && order.target_position_size_usd > 0);
    const riskActions = data.filter(order => {
        const signalType = order.signal && order.signal.signal_type;
        return order.approved && ["sell", "liquidate", "trim", "avoid"].includes(signalType);
    });

    const riskHtml = riskActions.length
        ? `<div style="margin-top: 1rem; display:flex; flex-wrap:wrap; gap:0.5rem;">
            ${riskActions.slice(0, 6).map(order => {
                const signalType = order.signal.signal_type;
                const label = signalType === "liquidate" ? "LIQUIDATE" : signalType.toUpperCase();
                const badgeClass = signalType === "trim" ? "tag-trim" : signalType === "liquidate" ? "tag-liquidate" : "tag-stop";
                return `<span class="tag ${badgeClass}">${label} ${order.symbol}</span>`;
            }).join('')}
        </div>`
        : `<div style="margin-top: 1rem;"><span class="tag" style="background: rgba(255,255,255,0.1);">No active sell/trim/avoid actions.</span></div>`;
    
    if (target) {
        container.innerHTML = `
            <div class="target-symbol">${target.symbol}</div>
            <div class="target-row">
                <span class="tag tag-buy">Buy $${target.target_position_size_usd.toFixed(2)}</span>
                ${target.stop_loss_price ? `<span class="tag tag-stop">Stop-Loss $${target.stop_loss_price.toFixed(2)}</span>` : ''}
            </div>
            ${riskHtml}
        `;
    } else {
        container.innerHTML = `
            <div class="target-symbol" style="color: var(--text-muted); font-size: 2rem;">CASH</div>
            <div class="target-row">
                <span class="tag" style="background: rgba(255,255,255,0.1);">No actionable buys today.</span>
            </div>
            ${riskHtml}
        `;
    }
}

function renderLayer2(data) {
    const container = document.getElementById('layer2-body');
    if (!container) return;
    if (!data || data.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted);">No signals generated.</div>`;
        return;
    }
    
    // Render top 3 signals or avoid signals
    let html = '<div style="display:flex; flex-direction:column; gap:1rem;">';
    
    // Sort by confidence
    const sorted = [...data].sort((a, b) => ((b.signal && b.signal.confidence) || 0) - ((a.signal && a.signal.confidence) || 0)).slice(0, 5);
    
    sorted.forEach(item => {
        const sig = item.signal;
        if (!sig) return;
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
