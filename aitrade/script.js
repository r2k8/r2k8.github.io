const GIST_ID = "64ba99affebb937a1534d8cb4b1c60ce";
let currentTimeframe = '5d';

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
        const sankeyRes = await fetch(`https://gist.githubusercontent.com/r2k8/${GIST_ID}/raw/sankey_data_${currentTimeframe}.json?t=${timestamp}`);
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
                titleEl.className = `metric-large ${rs.title === 'Risk On' ? 'text-bull' : 'text-bear'}`;
                titleEl.style.color = rs.title === 'Risk On' ? '#10b981' : '#ef4444';
                
                const liqEl = document.getElementById('gl-status');
                liqEl.textContent = rs.liquidity;
                liqEl.style.color = rs.liquidity === 'Positive' ? '#10b981' : '#ef4444';
                
                document.getElementById('gl-inflow').textContent = rs.inflow;
                document.getElementById('gl-outflow').textContent = rs.outflow;
                document.getElementById('gl-health').textContent = `Data Health: ${rs.health}`;
            }
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
    if (data.earnings_radar) {
        renderEarningsRadar(data.earnings_radar);
    }
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
                    return `<div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">Flow Proxy</div>
                            <div style="font-weight:600;">${params.data.source} → ${params.data.target}</div>
                            <span style="color:#10b981">Weight:</span> ${params.value}`;
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
            scheduleMap[dayName].before.push({
                t: item.Symbol,
                n: item.Company || item.Symbol,
                dom: item.Domain || (item.Symbol.toLowerCase() + '.com')
            });
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
