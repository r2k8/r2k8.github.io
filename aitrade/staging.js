google.charts.load('current', {'packages':['sankey']});
google.charts.setOnLoadCallback(initPrototype);

// Our mocked global liquidity tree
const mockDataTree = {
    id: "global",
    name: "Global Macro Flow",
    children: [
        {
            id: "us_equities",
            name: "US Equities",
            flow: 120, // Billions
            children: [
                {
                    id: "tech",
                    name: "Tech Sector (XLK)",
                    flow: 65,
                    children: [
                        { id: "aapl", name: "Apple (AAPL)", flow: 25 },
                        { id: "msft", name: "Microsoft (MSFT)", flow: 20 },
                        { id: "nvda", name: "Nvidia (NVDA)", flow: 20 }
                    ]
                },
                {
                    id: "financials",
                    name: "Financials (XLF)",
                    flow: 35,
                    children: [
                        { id: "jpm", name: "JPMorgan (JPM)", flow: 15 },
                        { id: "v", name: "Visa (V)", flow: 10 },
                        { id: "ma", name: "Mastercard (MA)", flow: 10 }
                    ]
                },
                {
                    id: "energy",
                    name: "Energy (XLE)",
                    flow: 20,
                    children: [
                        { id: "xom", name: "Exxon (XOM)", flow: 12 },
                        { id: "cvx", name: "Chevron (CVX)", flow: 8 }
                    ]
                }
            ]
        },
        {
            id: "crypto",
            name: "Cryptocurrency",
            flow: 45,
            children: [
                { id: "btc", name: "Bitcoin (IBIT)", flow: 35 },
                { id: "eth", name: "Ethereum (ETHE)", flow: 10 }
            ]
        },
        {
            id: "eu_equities",
            name: "EU Equities (VGK)",
            flow: 30,
            children: [
                { id: "uk", name: "United Kingdom", flow: 15 },
                { id: "france", name: "France", flow: 10 },
                { id: "germany", name: "Germany", flow: 5 }
            ]
        },
        {
            id: "bonds",
            name: "US Bonds (TLT)",
            flow: -50, // Outflow (Money leaving bonds, entering global liquidity)
            children: [] 
        }
    ]
};

let currentPath = [mockDataTree]; // Breadcrumb stack
let chart;

function initPrototype() {
    chart = new google.visualization.Sankey(document.getElementById('sankey-prototype'));
    
    // Add click listener
    google.visualization.events.addListener(chart, 'select', () => {
        const selection = chart.getSelection();
        if (selection.length > 0 && selection[0].name) {
            const clickedNodeName = selection[0].name;
            handleNodeClick(clickedNodeName);
        }
    });

    renderCurrentLevel();
}

function handleNodeClick(nodeName) {
    const currentNode = currentPath[currentPath.length - 1];
    
    // Find if the clicked node exists as a child of the current level
    const clickedChild = currentNode.children?.find(c => c.name === nodeName);
    
    // If it exists and has its own children, drill down!
    if (clickedChild && clickedChild.children && clickedChild.children.length > 0) {
        currentPath.push(clickedChild);
        renderCurrentLevel();
    }
}

function navigateToPathIndex(index) {
    // Cut the path down to the clicked breadcrumb
    currentPath = currentPath.slice(0, index + 1);
    renderCurrentLevel();
}

function renderCurrentLevel() {
    const currentNode = currentPath[currentPath.length - 1];
    
    // 1. Update Breadcrumbs
    const bcContainer = document.getElementById('breadcrumbs');
    bcContainer.innerHTML = currentPath.map((node, index) => {
        if (index === currentPath.length - 1) {
            return `<span>${node.name}</span>`;
        }
        return `
            <span class="crumb-link" onclick="navigateToPathIndex(${index})">${node.name}</span>
            <span>&gt;</span>
        `;
    }).join('');

    // 2. Prepare Data for Sankey
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'From');
    data.addColumn('string', 'To');
    data.addColumn('number', 'Flow ($ Billions)');

    const rows = [];
    
    if (currentNode.children) {
        currentNode.children.forEach(child => {
            const flowVal = Math.abs(child.flow);
            if (child.flow > 0) {
                // Inflow: From Current Node to Child Node
                rows.push([currentNode.name, child.name, flowVal]);
            } else {
                // Outflow: From Child Node back to Current Node
                rows.push([child.name, currentNode.name, flowVal]);
            }
        });
    }

    if (rows.length === 0) {
        document.getElementById('sankey-prototype').innerHTML = '<div style="text-align:center; padding: 2rem;">No further data.</div>';
        return;
    }

    data.addRows(rows);

    const colors = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#0ea5e9', '#ec4899', '#14b8a6'];
    const options = {
        width: '100%',
        height: 500,
        sankey: {
            node: {
                colors: colors,
                nodePadding: 20,
                width: 15,
                label: { fontName: 'Outfit', fontSize: 15, color: '#f8fafc', bold: true }
            },
            link: { colorMode: 'gradient', colors: colors }
        },
        backgroundColor: 'transparent'
    };

    chart.draw(data, options);
}
