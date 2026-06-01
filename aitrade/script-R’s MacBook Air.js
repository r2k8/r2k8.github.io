const GIST_ID = "64ba99affebb937a1534d8cb4b1c60ce";

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setInterval(fetchData, 30000);
});

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
    const regimeMap = {
        'risk_on': 'Risk On',
        'neutral': 'Neutral',
        'defensive': 'Defensive',
        'crash_watch': 'Crash Watch'
    };
    
    document.getElementById('regime-text').textContent = regimeMap[data.regime_hint] || data.regime_hint;
    
    const bullPct = (data.overall_bullish_score * 100).toFixed(0);
    const bearPct = (data.overall_fear_score * 100).toFixed(0);
    
    document.getElementById('bull-bar').style.width = `${bullPct}%`;
    document.getElementById('bear-bar').style.width = `${bearPct}%`;
    
    document.getElementById('score-text').textContent = `Bullish: ${bullPct}%  •  Bearish: ${bearPct}%`;
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
