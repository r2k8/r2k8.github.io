// ==========================================
// CONFIGURATION
// Add your public GitHub Gist ID here!
const GIST_ID = "64ba99affebb937a1534d8cb4b1c60ce";
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    // Refresh every 30 seconds
    setInterval(fetchData, 30000);
});

async function fetchData() {
    if (GIST_ID === "YOUR_GIST_ID_HERE") {
        document.getElementById('cron-logs').textContent = "Please configure your GIST_ID in script.js!";
        return;
    }

    try {
        const timestamp = new Date().getTime();
        
        let l1Data = null;
        let l3Data = null;

        // Fetch Layer 1 Snapshot
        const l1Res = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/layer1_snapshot.json?t=${timestamp}`);
        if (l1Res.ok) {
            l1Data = await l1Res.json();
            updateLayer1(l1Data);
        }

        // Fetch Layer 3 Orders
        const l3Res = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/layer3_orders.json?t=${timestamp}`);
        if (l3Res.ok) {
            l3Data = await l3Res.json();
            updateLayers234(l3Data);
        }

        // Fetch Cron Logs
        const logRes = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/cron_output.log?t=${timestamp}`);
        if (logRes.ok) {
            const text = await logRes.text();
            document.getElementById('cron-logs').textContent = text;
            const logEl = document.getElementById('cron-logs');
            logEl.scrollTop = logEl.scrollHeight;
        }

    } catch (e) {
        console.error("Dashboard Fetch Error:", e);
    }
}

function updateLayer1(data) {
    const regimeMap = {
        'risk_on': '<span class="tag bull-tag">🟢 Risk On</span>',
        'neutral': '<span class="tag neutral-tag">🟡 Neutral</span>',
        'defensive': '<span class="tag warning-tag">🟠 Defensive</span>',
        'crash_watch': '<span class="tag bear-tag">🔴 Crash Watch</span>'
    };
    
    const regime = regimeMap[data.regime_hint] || `<span class="tag neutral-tag">${data.regime_hint}</span>`;
    const bullPct = (data.overall_bullish_score * 100).toFixed(0);
    const bearPct = (data.overall_fear_score * 100).toFixed(0);
    
    let topSector = "N/A";
    if (data.sector_sentiment && Object.keys(data.sector_sentiment).length > 0) {
        const sorted = Object.values(data.sector_sentiment).sort((a,b) => b.score - a.score);
        topSector = `${sorted[0].name} (${sorted[0].symbol}) - Score: ${sorted[0].score.toFixed(2)}`;
    }

    document.getElementById('layer1-content').innerHTML = `
        <div class="metric-row">
            <span>Regime:</span> ${regime}
        </div>
        <div class="metric-row">
            <span>Sentiment:</span> 
            <div class="mini-score-bar">
                <div class="fill bull" style="width: ${bullPct}%"></div>
                <div class="fill bear" style="width: ${bearPct}%"></div>
            </div>
            <span class="score-text">${bullPct}% B / ${bearPct}% B</span>
        </div>
        <div class="metric-row">
            <span>Top Sector:</span> <span class="highlight">${topSector}</span>
        </div>
    `;
}

function updateLayers234(data) {
    // ------------------------------------
    // Layer 2: Strategy Signals
    // ------------------------------------
    const holds = data.filter(d => d.warnings.some(w => w.includes("hold with low confidence")));
    const buys = data.filter(d => !d.warnings.some(w => w.includes("hold with low confidence")));
    
    let l2Html = `<div class="signals-list">`;
    buys.forEach(b => {
        l2Html += `<div class="signal-item buy-signal"><span class="sym">${b.symbol}</span> <span class="badge">STRONG BUY</span></div>`;
    });
    holds.forEach(h => {
        l2Html += `<div class="signal-item hold-signal"><span class="sym">${h.symbol}</span> <span class="badge">HOLD</span></div>`;
    });
    l2Html += `</div>`;
    document.getElementById('layer2-content').innerHTML = l2Html;

    // ------------------------------------
    // Layer 3: Risk Management
    // ------------------------------------
    const target = data.find(order => order.approved && order.target_position_size_usd > 0);
    const rejectedByRisk = buys.filter(b => b.symbol !== target?.symbol);
    
    let l3Html = `<div class="risk-eval">`;
    if (target) {
        l3Html += `
            <div class="risk-approved">
                <strong>Approved Target:</strong> ${target.symbol}<br/>
                <strong>Position Size:</strong> $${target.target_position_size_usd.toFixed(2)}<br/>
                ${target.stop_loss_price ? `<strong>Static Stop Loss:</strong> $${target.stop_loss_price.toFixed(2)}` : ''}
            </div>
        `;
    } else {
        l3Html += `<div class="risk-approved" style="border-left-color: var(--text-muted);">No targets passed risk checks. Cash position maintained.</div>`;
    }
    
    if (rejectedByRisk.length > 0) {
        l3Html += `<div class="risk-rejected"><strong>Filtered Out (Concentration/Position Limits):</strong> ${rejectedByRisk.map(r => r.symbol).join(', ')}</div>`;
    }
    l3Html += `</div>`;
    document.getElementById('layer3-content').innerHTML = l3Html;

    // ------------------------------------
    // Layer 4: Execution
    // ------------------------------------
    let l4Html = ``;
    if (target) {
        l4Html += `
            <div class="execution-card">
                <div class="exec-icon">⚡</div>
                <div class="exec-details">
                    <h4>Submitting to Broker</h4>
                    <p>Action: <strong style="color:var(--bull);">BUY ${target.symbol}</strong></p>
                    <p>Amount: <strong>$${target.target_position_size_usd.toFixed(2)}</strong></p>
                    <div class="exec-status pulse-text">Delegated to Codex via Robinhood MCP</div>
                </div>
            </div>
        `;
    } else {
        l4Html += `
            <div class="execution-card">
                <div class="exec-icon" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">⏸</div>
                <div class="exec-details">
                    <h4>No Action Required</h4>
                    <p>System maintaining CASH position today.</p>
                </div>
            </div>
        `;
    }
    document.getElementById('layer4-content').innerHTML = l4Html;
}
