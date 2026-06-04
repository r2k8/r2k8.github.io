const GIST_ID = "64ba99affebb937a1534d8cb4b1c60ce";

document.addEventListener('DOMContentLoaded', initDashboard);

function initDashboard() {
    fetchData();
    // Refresh data every 5 minutes
    setInterval(fetchData, 300000); 
}

async function fetchData() {
    try {
        const timestamp = new Date().getTime();
        
        // 1. Fetch our newly generated Static Pre-compute data!
        const sankeyRes = await fetch(`data/sankey_data.json?t=${timestamp}`);
        if (sankeyRes.ok) {
            const sankeyData = await sankeyRes.json();
            renderEChartsSankey(sankeyData);
        } else {
            document.getElementById('capital-flow-container').innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Awaiting GitHub Actions Data Pipeline...</div>';
        }

        // 2. Fetch legacy Site Data for Earnings Radar (until we move it to the python pipeline)
        const siteDataRes = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/site_data.json?t=${timestamp}`);
        if (siteDataRes.ok) {
            const data = await siteDataRes.json();
            updateLayer1(data);
        }

        // 3. Fetch Layer 3 Orders
        const l3Res = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/layer3_orders.json?t=${timestamp}`);
        if (l3Res.ok) updateLayer3(await l3Res.json());

        // 4. Fetch Cron Logs
        const logRes = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/cron_output.log?t=${timestamp}`);
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
    const regimeMap = { 'risk_on': 'Risk On', 'neutral': 'Neutral', 'defensive': 'Defensive', 'crash_watch': 'Crash Watch' };
    document.getElementById('regime-title').textContent = regimeMap[data.regime] || data.regime;

    // Populate Top Inflows and Outflows
    const topIn = data.top_inflows.map(f => f.symbol).join(' / ') || 'None';
    const topOut = data.top_outflows.map(f => f.symbol).join(' / ') || 'None';
    
    document.getElementById('gl-status').textContent = data.top_inflows.length >= data.top_outflows.length ? 'Positive' : 'Negative';
    document.getElementById('gl-inflow').textContent = topIn;
    document.getElementById('gl-outflow').textContent = topOut;
    
    if (data.warnings && data.warnings.length > 0) {
        document.getElementById('gl-health').textContent = "Data Health: " + data.warnings[0];
    } else {
        document.getElementById('gl-health').textContent = "Data Health: Optimal";
    }
    
    if (data.earnings_radar) {
        renderEarningsRadar(data.earnings_radar);
    }
}

function renderEChartsSankey(sankeyData) {
    const container = document.getElementById('capital-flow-container');
    container.innerHTML = ''; // clear loader
    
    const myChart = echarts.init(container);
    
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
                    return `<div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">Flow Proxy</div>
                            <div style="font-weight:600;">${params.data.source} → ${params.data.target}</div>
                            <span style="color:#10b981">Weight:</span> ${params.value}`;
                }
            }
        },
        series: [
            {
                type: 'sankey',
                layout: 'none',
                layoutIterations: 0,
                nodeAlign: 'justify',
                data: sankeyData.nodes,
                links: sankeyData.links,
                emphasis: { focus: 'adjacency' },
                nodeWidth: 20,
                nodeGap: 15,
                label: {
                    position: 'right',
                    color: '#f8fafc',
                    fontFamily: 'Outfit',
                    fontSize: 13,
                    fontWeight: 500
                },
                lineStyle: { curveness: 0.5 }
            }
        ]
    };
    
    myChart.setOption(option);
    
    window.addEventListener('resize', () => {
        myChart.resize();
    });
}

function renderEarningsRadar(earningsData) {
    const tbody = document.getElementById('earnings-body');
    if (!earningsData || earningsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding: 1rem; text-align: center;">No earnings data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    earningsData.forEach(row => {
        let labelColor = 'var(--text-muted)';
        if (row.Label === 'High-priority review') labelColor = '#10b981';
        else if (row.Label === 'Watchlist') labelColor = '#f59e0b';
        else if (row.Label === 'Avoid') labelColor = '#ef4444';
        
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        tr.innerHTML = `
            <td style="padding: 0.8rem 0.5rem;">${row.Date || '-'}</td>
            <td style="padding: 0.8rem 0.5rem; font-weight: bold;">${row.Symbol || '-'}</td>
            <td style="padding: 0.8rem 0.5rem;">${row.Company || '-'}</td>
            <td style="padding: 0.8rem 0.5rem;">${row['Sector ETF'] || '-'}</td>
            <td style="padding: 0.8rem 0.5rem;">${row['Sector Flow'] || '-'}</td>
            <td style="padding: 0.8rem 0.5rem;">${row['Company Sentiment'] || '-'}</td>
            <td style="padding: 0.8rem 0.5rem;">${row.Trend || '-'}</td>
            <td style="padding: 0.8rem 0.5rem;"><span style="color: ${labelColor}; font-weight: 500;">${row.Label || '-'}</span></td>
        `;
        tbody.appendChild(tr);
    });
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
