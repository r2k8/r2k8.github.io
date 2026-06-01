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
        
        // Fetch Layer 1 Snapshot
        const l1Res = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/layer1_snapshot.json?t=${timestamp}`);
        if (l1Res.ok) updateLayer1(await l1Res.json());

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
    document.getElementById('regime-text').textContent = regimeMap[data.regime_hint] || data.regime_hint;

    // Process Capital Flows into Sankey
    if (data.capital_flows && data.capital_flows.length > 0) {
        renderSankey(data.capital_flows);
    }
}

function renderSankey(flows) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'From');
    data.addColumn('string', 'To');
    data.addColumn('number', 'Capital Flow ($ Billions)');

    const rows = [];
    flows.forEach(f => {
        // Convert to billions for readability
        const bVol = parseFloat((f.dollar_volume / 1000000000).toFixed(2));
        
        // A Sankey flows from Source -> Target
        if (f.direction === 'inflow') {
            rows.push(['Global Liquidity', f.symbol, bVol]);
        } else {
            rows.push([f.symbol, 'Global Liquidity', bVol]);
        }
    });

    data.addRows(rows);

    const colors = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#0ea5e9', '#ec4899', '#14b8a6'];

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
