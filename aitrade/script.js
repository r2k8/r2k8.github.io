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
        
        // Fetch Layer 1 Snapshot
        const l1Res = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/layer1_snapshot.json?t=${timestamp}`);
        if (l1Res.ok) {
            const l1 = await l1Res.json();
            updateLayer1(l1);
        }

        // Fetch Layer 3 Orders
        const l3Res = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/layer3_orders.json?t=${timestamp}`);
        if (l3Res.ok) {
            const l3 = await l3Res.json();
            updateLayer3(l3);
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
        'risk_on': '🟢 Risk On',
        'neutral': '🟡 Neutral',
        'defensive': '🟠 Defensive',
        'crash_watch': '🔴 Crash Watch'
    };
    
    document.getElementById('regime-display').textContent = regimeMap[data.regime_hint] || data.regime_hint;
    
    const bullPct = (data.overall_bullish_score * 100).toFixed(0);
    const bearPct = (data.overall_fear_score * 100).toFixed(0);
    
    document.getElementById('bull-fill').style.width = `${bullPct}%`;
    document.getElementById('bear-fill').style.width = `${bearPct}%`;
    
    document.getElementById('score-text').textContent = `Bullish: ${bullPct}% | Bearish: ${bearPct}%`;
}

function updateLayer3(data) {
    const container = document.getElementById('target-container');
    
    // Find the approved target
    const target = data.find(order => order.approved && order.target_position_size_usd > 0);
    
    if (target) {
        container.innerHTML = `
            <div class="target-card">
                <div class="target-symbol">${target.symbol}</div>
                <div class="target-amount">Buy $${target.target_position_size_usd.toFixed(2)}</div>
                ${target.stop_loss_price ? `<div class="target-stop">Static Stop-Loss at $${target.stop_loss_price.toFixed(2)}</div>` : ''}
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="target-card" style="border-color: var(--text-muted);">
                <div class="target-symbol" style="color: var(--text-muted);">CASH</div>
                <div class="target-amount">No actionable buys today.</div>
            </div>
        `;
    }
}
