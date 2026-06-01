const GIST_ID = "64ba99affebb937a1534d8cb4b1c60ce";

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    fetchData();
    setInterval(fetchData, 30000);
});

async function fetchData() {
    try {
        const ts = new Date().getTime();
        
        let l1Data = null;
        let l3Data = null;

        const l1Res = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/layer1_snapshot.json?t=${ts}`);
        if (l1Res.ok) {
            l1Data = await l1Res.json();
            renderLayer1(l1Data);
        } else {
            document.getElementById('layer1-data').innerHTML = `<p style="color:var(--bear)">Failed to load L1 Data</p>`;
        }

        const l3Res = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/layer3_orders.json?t=${ts}`);
        if (l3Res.ok) {
            l3Data = await l3Res.json();
            renderLayer2(l3Data);
            renderLayer3(l3Data);
            renderLayer4(l3Data);
        } else {
            const errHtml = `<p style="color:var(--bear)">Failed to load Data</p>`;
            document.getElementById('layer2-data').innerHTML = errHtml;
            document.getElementById('layer3-data').innerHTML = errHtml;
            document.getElementById('layer4-data').innerHTML = errHtml;
        }

        const logRes = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/cron_output.log?t=${ts}`);
        if (logRes.ok) {
            const text = await logRes.text();
            const logEl = document.getElementById('cron-logs');
            logEl.textContent = text;
            logEl.scrollTop = logEl.scrollHeight;
        }

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

function renderLayer1(data) {
    const isBull = data.overall_bullish_score > data.overall_fear_score;
    const regimeClass = data.regime_hint === 'risk_on' ? 'bull' : (data.regime_hint === 'defensive' || data.regime_hint === 'crash_watch' ? 'bear' : 'neutral');
    const regimeIcon = data.regime_hint === 'risk_on' ? '🟢' : (data.regime_hint === 'neutral' ? '🟡' : '🔴');
    
    let topSector = "N/A";
    if (data.sector_sentiment) {
        const sorted = Object.values(data.sector_sentiment).sort((a,b) => b.score - a.score);
        if(sorted.length > 0) topSector = `${sorted[0].name} (${sorted[0].symbol})`;
    }

    const html = `
        <div class="metric-grid">
            <div class="metric-box">
                <span class="metric-label">Detected Regime</span>
                <div class="tag ${regimeClass}">${regimeIcon} ${data.regime_hint.replace('_', ' ').toUpperCase()}</div>
            </div>
            <div class="metric-box">
                <span class="metric-label">Macro Sentiment</span>
                <div class="score-bar">
                    <div class="score-fill bull" style="width: ${data.overall_bullish_score*100}%"></div>
                    <div class="score-fill bear" style="width: ${data.overall_fear_score*100}%"></div>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary); display:flex; justify-content:space-between;">
                    <span style="color:var(--bull)">${(data.overall_bullish_score*100).toFixed(0)}% Bull</span>
                    <span style="color:var(--bear)">${(data.overall_fear_score*100).toFixed(0)}% Bear</span>
                </div>
            </div>
            <div class="metric-box">
                <span class="metric-label">Top Catalyst Sector</span>
                <div class="metric-val" style="font-size: 1rem;">${topSector}</div>
            </div>
        </div>
    `;
    document.getElementById('layer1-data').innerHTML = html;
}

function renderLayer2(data) {
    const holds = data.filter(d => d.warnings && d.warnings.some(w => w.includes("hold with low confidence")));
    const buys = data.filter(d => d.warnings && !d.warnings.some(w => w.includes("hold with low confidence")));
    
    let html = `<div style="display:flex; flex-wrap:wrap;">`;
    buys.forEach(b => {
        html += `<div class="signal-pill"><span class="signal-sym">${b.symbol}</span> <span class="badge" style="background:var(--bull);color:#000;">BUY</span></div>`;
    });
    holds.forEach(h => {
        html += `<div class="signal-pill"><span class="signal-sym">${h.symbol}</span> <span class="badge" style="background:#3f3f46;color:#fff;">HOLD</span></div>`;
    });
    html += `</div>`;
    document.getElementById('layer2-data').innerHTML = html;
}

function renderLayer3(data) {
    const target = data.find(order => order.approved && order.target_position_size_usd > 0);
    const buys = data.filter(d => d.warnings && !d.warnings.some(w => w.includes("hold with low confidence")));
    const rejectedByRisk = buys.filter(b => b.symbol !== target?.symbol);
    
    let html = ``;
    if (target) {
        html += `
            <div class="risk-pass">
                <div style="font-size:0.8rem; text-transform:uppercase; color:var(--accent); margin-bottom:0.5rem; font-weight:700;">Target Passed Risk Gates</div>
                <div><strong>Symbol:</strong> ${target.symbol}</div>
                <div><strong>Calculated Size:</strong> $${target.target_position_size_usd.toFixed(2)}</div>
                ${target.stop_loss_price ? `<div><strong>Stop Loss:</strong> $${target.stop_loss_price.toFixed(2)}</div>` : ''}
            </div>
        `;
    } else {
        html += `
            <div class="risk-pass" style="border-left-color: var(--text-secondary); background: rgba(255,255,255,0.05);">
                <div style="color:var(--text-main);"><strong>No targets passed risk thresholds.</strong></div>
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.25rem;">System maintaining 100% CASH allocation to preserve capital.</div>
            </div>
        `;
    }
    
    if (rejectedByRisk.length > 0) {
        html += `
            <div class="risk-fail">
                <strong style="display:block; margin-bottom:0.25rem; color:#fff;">Filtered out due to allocation limits:</strong>
                ${rejectedByRisk.map(r => r.symbol).join(', ')}
            </div>
        `;
    }
    document.getElementById('layer3-data').innerHTML = html;
}

function renderLayer4(data) {
    const target = data.find(order => order.approved && order.target_position_size_usd > 0);
    let html = ``;
    if (target) {
        html += `
            <div class="final-target">
                <h4>Broker Routing Active</h4>
                <div class="big-sym">BUY ${target.symbol}</div>
                <div class="money">$${target.target_position_size_usd.toFixed(2)} USD</div>
                <div style="margin-top: 1.5rem; display:inline-block; padding:0.5rem 1rem; background:rgba(16,185,129,0.1); color:var(--bull); border:1px solid rgba(16,185,129,0.2); border-radius:30px; font-size:0.85rem; font-weight:600;">
                    <span class="pulse-text">Delegated to Codex via MCP Plugin</span>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="final-target" style="opacity: 0.7;">
                <h4>Status: Standby</h4>
                <div class="big-sym" style="background:var(--text-secondary); -webkit-background-clip:text; -webkit-text-fill-color:transparent; filter:none;">CASH</div>
                <div class="money">$0.00 Deployed</div>
            </div>
        `;
    }
    document.getElementById('layer4-data').innerHTML = html;
}
