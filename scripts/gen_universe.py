"""
Genera src/data/universe.json: lista completa azioni Borsa Italiana (Euronext Milan).

Fonte: Yahoo Finance screener (exchange=MIL, region=it, quoteType=EQUITY).
Filtra via: niente prefisso-cifra (esclude azioni estere segmento GEM tipo 1NVDA.MI),
valuta EUR, nome presente, market cap > 0 (esclude certificati/warrant).

Uso:  python scripts/gen_universe.py
Rigenera quando vuoi aggiornare la lista (nuove quotazioni / delisting).
"""
import json, re, time, urllib.request, urllib.parse, http.cookiejar
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "universe.json"

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def http(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("User-Agent", UA)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        return opener.open(req, timeout=30).read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.read().decode("utf-8", "replace")


def main():
    http("https://fc.yahoo.com")  # set cookie (404 ok)
    crumb = http("https://query1.finance.yahoo.com/v1/test/getcrumb").strip()
    print("crumb:", crumb)

    url = ("https://query2.finance.yahoo.com/v1/finance/screener?crumb="
           + urllib.parse.quote(crumb) + "&count=250")
    rows, offset, total = {}, 0, None
    while True:
        body = json.dumps({
            "size": 250, "offset": offset, "quoteType": "EQUITY",
            "sortField": "intradaymarketcap", "sortType": "desc",
            "query": {"operator": "and", "operands": [
                {"operator": "eq", "operands": ["exchange", "MIL"]},
                {"operator": "eq", "operands": ["region", "it"]}]},
        }).encode()
        try:
            res = json.loads(http(url, data=body, headers={"Content-Type": "application/json"}))
            r = res["finance"]["result"][0]
        except Exception as e:
            print("retry", offset, e); time.sleep(2); continue
        if total is None:
            total = r["total"]; print("total instruments on MIL:", total)
        quotes = r.get("quotes", [])
        if not quotes:
            break
        for q in quotes:
            sym = q.get("symbol", "")
            rows[sym] = {
                "symbol": sym,
                "name": (q.get("longName") or q.get("shortName") or "").strip(),
                "cur": q.get("currency", ""),
                "mcap": q.get("marketCap", 0) or 0,
            }
        offset += 250
        if offset >= total or offset > 10000:  # Yahoo screener caps offset ~10000
            break

    italian = [
        v for v in rows.values()
        if v["cur"] == "EUR"
        and not re.match(r"^\d", v["symbol"])   # drop foreign GEM (1XXXX.MI)
        and v["name"]                            # real company name
        and v["mcap"] > 0                        # drop certificates/warrants
    ]
    italian.sort(key=lambda x: x["symbol"])
    out = [{"symbol": v["symbol"], "name": v["name"]} for v in italian]
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"wrote {OUT} : {len(out)} Italian equities")


if __name__ == "__main__":
    main()
