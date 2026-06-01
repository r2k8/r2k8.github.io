import json
import urllib.request
from datetime import datetime

HIERARCHY = {
    "Stocks": {
        "etf": "SPY",
        "children": {
            "U.S. Equities": {
                "etf": "IVV",
                "children": {
                    "Technology": {"etf": "XLK", "stocks": ["AAPL","MSFT","NVDA","AVGO","ORCL"]},
                    "Healthcare": {"etf": "XLV", "stocks": ["LLY","UNH","JNJ","ABBV","MRK"]},
                    "Energy": {"etf": "XLE", "stocks": ["XOM","CVX","COP","SLB"]},
                }
            },
            "Asia": {"etf": "AAXJ", "stocks": ["TSM","TCEHY","BABA","HDB","SONY"]},
            "Europe": {"etf": "VGK", "stocks": ["NVO","ASML","MC.PA","OR.PA","SAP"]},
        }
    },
    "Bonds": {"etf": "AGG", "stocks": ["TLT","LQD","HYG","BND"]},
    "Crypto": {"etf": "IBIT", "children": {
        "Bitcoin": {"etf": "IBIT", "stocks": ["BTC-USD"]}, 
        "Ethereum": {"etf": "ETHA", "stocks": ["ETH-USD"]},
        "Alt-coins": {"etf": "BITQ", "stocks": ["SOL-USD","XRP-USD"]}
    }},
    "Gold": {"etf": "GLD", "stocks": ["NEM","GOLD","AEM"]},
}

def get_tickers(node):
    t = set()
    if "etf" in node: t.add(node["etf"])
    if "stocks" in node: t.update(node["stocks"])
    for child in node.get("children", {}).values():
        t.update(get_tickers(child))
    return t

def fetch_yahoo(tickers):
    prices = {}
    print(f"Fetching {len(tickers)} tickers from Yahoo API...")
    for t in tickers:
        try:
            req = urllib.request.Request(
                f"https://query2.finance.yahoo.com/v8/finance/chart/{t}?interval=1d&range=5d",
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode())
                closes = data['chart']['result'][0]['indicators']['quote'][0]['close']
                valid = [c for c in closes if c is not None]
                if len(valid) > 1:
                    prices[t] = (valid[-1] - valid[0]) / valid[0]
                else: prices[t] = 0.0
        except Exception as e:
            print(f"Failed {t}: {e}")
            prices[t] = 0.0
    return prices

def build_tree():
    all_t = set()
    for node in HIERARCHY.values(): all_t.update(get_tickers(node))
    prices = fetch_yahoo(all_t)
    
    # Mock scales since Github Actions won't have the local cache
    # In production, we can pull real market caps if we need to
    def walk(name, data):
        etf = data.get("etf")
        # Base flow off a mock 100B scale for now to keep it simple and reliable
        scale = 100.0 
        flow_val = prices.get(etf, 0.0) * scale if etf else 0.0

        children = {}
        for kname, kdata in data.get("children", {}).items():
            children[kname] = walk(kname, kdata)
            
        stock_flows = []
        if "stocks" in data:
            for s in data["stocks"]:
                s_flow = prices.get(s, 0.0) * scale
                stock_flows.append(s_flow)
                children[s] = {"name": s, "flow": round(s_flow, 2)}

        if abs(flow_val) < 0.005 and stock_flows:
            flow_val = sum(stock_flows)
        if abs(flow_val) < 0.005 and children:
            flow_val = sum(child.get("flow", 0.0) for child in children.values())

        res = {"name": name, "flow": round(flow_val, 2)}
        if children: res["children"] = list(children.values())
        return res

    return {
        "name": "Global Macro Flow",
        "flow": 0,
        "children": [walk(name, data) for name, data in HIERARCHY.items()],
        "last_updated": datetime.now().isoformat()
    }

if __name__ == "__main__":
    tree = build_tree()
    with open("aitrade2/data.json", "w") as f:
        json.dump(tree, f, indent=2)
    print("Successfully generated aitrade2/data.json")
