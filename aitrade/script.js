const GIST_ID = "64ba99affebb937a1534d8cb4b1c60ce";

// Load Google Charts Sankey module
google.charts.load('current', {'packages':['sankey']});
google.charts.setOnLoadCallback(initDashboard);

function initDashboard() {
    fetchData();
    setInterval(fetchData, 30000);
}

async function fetchData() {
    try {
        const timestamp = new Date().getTime();
        
        // Fetch Site Data (Layer 1 + Visuals)
        const siteDataRes = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/site_data.json?t=${timestamp}`);
        if (siteDataRes.ok) updateLayer1(await siteDataRes.json());

        // Fetch Layer 3 Orders
        const l3Res = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/layer3_orders.json?t=${timestamp}`);
        if (l3Res.ok) updateLayer3(await l3Res.json());

        // Fetch Cron Logs
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

    if (data.sankey && data.sankey.links) {
        renderSankey(data.sankey.links);
    }
    
    if (data.earnings_radar) {
        renderEarningsRadar(data.earnings_radar);
    }
}

function renderSankey(links) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'From');
    data.addColumn('string', 'To');
    data.addColumn('number', 'Capital Flow ($ Billions)');

    const rows = links.map(l => [l.source, l.target, l.value]);
    data.addRows(rows);

    const colors = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#0ea5e9', '#ec4899', '#14b8a6', '#64748b'];

    const options = {
        width: '100%',
        height: 400,
        sankey: {
            node: {
                colors: colors,
                nodePadding: 15,
                width: 10,
                label: { 
                    fontName: 'Outfit',
                    fontSize: 14,
                    color: '#f8fafc',
                    bold: true
                }
            },
            link: {
                colorMode: 'gradient',
                colors: colors
            }
        },
        backgroundColor: 'transparent'
    };

    const container = document.getElementById('capital-flow-container');
    const chart = new google.visualization.Sankey(container);
    chart.draw(data, options);
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
        if (row.Label === 'High-priority review') labelColor = '#10b981'; // Green
        else if (row.Label === 'Watchlist') labelColor = '#f59e0b'; // Orange
        else if (row.Label === 'Avoid') labelColor = '#ef4444'; // Red
        
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
