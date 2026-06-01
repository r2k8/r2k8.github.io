google.charts.load('current', {'packages':['sankey']});
google.charts.setOnLoadCallback(initPrototype);

let currentPath = []; 
let chart;
let rawTree = null;

function initPrototype() {
    chart = new google.visualization.Sankey(document.getElementById('sankey-prototype'));
    
    google.visualization.events.addListener(chart, 'select', () => {
        const selection = chart.getSelection();
        if (selection.length > 0 && selection[0].name) {
            handleNodeClick(selection[0].name);
        }
    });

    fetchData();
}

async function fetchData() {
    try {
        const timestamp = new Date().getTime();
        const res = await fetch(`data.json?t=${timestamp}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.name) {
                rawTree = data;
                currentPath = [rawTree];
                renderCurrentLevel();
            } else {
                document.getElementById('sankey-prototype').innerHTML = '<div style="color:red; text-align:center;">Invalid Tree Data format.</div>';
            }
        } else {
            document.getElementById('sankey-prototype').innerHTML = `<div style="color:red; text-align:center;">HTTP Error: ${res.status}</div>`;
        }
    } catch (e) {
        console.error("Fetch Error:", e);
        document.getElementById('sankey-prototype').innerHTML = `<div style="color:red; text-align:center;">Fetch Error: ${e.message}</div>`;
    }
}

function handleNodeClick(nodeName) {
    const currentNode = currentPath[currentPath.length - 1];
    const clickedChild = currentNode.children?.find(c => c.name === nodeName);
    
    if (clickedChild && clickedChild.children && clickedChild.children.length > 0) {
        currentPath.push(clickedChild);
        renderCurrentLevel();
    }
}

function navigateToPathIndex(index) {
    currentPath = currentPath.slice(0, index + 1);
    renderCurrentLevel();
}

function renderCurrentLevel() {
    const currentNode = currentPath[currentPath.length - 1];
    document.getElementById('breadcrumbs').innerHTML = currentPath.map((node, index) => {
        if (index === currentPath.length - 1) return `<span>${node.name}</span>`;
        return `<span class="crumb-link" onclick="navigateToPathIndex(${index})">${node.name}</span><span>&gt;</span>`;
    }).join('');

    const data = new google.visualization.DataTable();
    data.addColumn('string', 'From');
    data.addColumn('string', 'To');
    data.addColumn('number', 'Flow ($ Billions)');

    const rows = [];
    if (currentNode.children) {
        currentNode.children.forEach(child => {
            let flowVal = Math.abs(child.flow);
            if (flowVal === 0) flowVal = 0.01; // Prevent fatal crash in Google Charts
            if (child.flow >= 0) rows.push([currentNode.name, child.name, flowVal]);
            else rows.push([child.name, currentNode.name, flowVal]);
        });
    }

    if (rows.length === 0) {
        document.getElementById('sankey-prototype').innerHTML = '<div style="text-align:center; padding: 2rem;">No further data.</div>';
        return;
    }

    data.addRows(rows);
    const colors = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#0ea5e9', '#ec4899', '#14b8a6'];
    const options = {
        width: '100%', height: 500, backgroundColor: 'transparent',
        sankey: { node: { colors: colors, nodePadding: 20, width: 15, label: { fontName: 'Outfit', fontSize: 15, color: '#f8fafc', bold: true } }, link: { colorMode: 'gradient', colors: colors } }
    };
    try {
        chart.draw(data, options);
    } catch(err) {
        document.getElementById('sankey-prototype').innerHTML = `<div style="color:red; text-align:center; padding: 2rem;">Chart Render Error: ${err.message}</div>`;
    }
}
