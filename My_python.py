from opensearchpy import OpenSearch
from datetime import datetime, timedelta
import csv

# --- connection ---
client = OpenSearch(
    hosts=[{"host": "your-opensearch-host", "port": 9200}],
    http_auth=("user", "password"),  # or use AWS4Auth for managed OpenSearch
    use_ssl=True,
    verify_certs=True,
)

INDEX = "mindrepo-emea-prd-regref-firds-esma-*"

ISIN_FIELD = "FinInstrmGnlAttrbts.Id.keyword"
CFI_FIELD = "FinInstrmGnlAttrbts.ClssfctnTp.keyword"
MIC_FIELD = "TechAttrbts.RlvntTradgVn.keyword"
DATE_FIELD = "instance-info.publication_date"
OUTPUT_CSV = "firds_current_securities.csv"

WINDOW_DAYS = 182
six_months_ago = datetime.utcnow() - timedelta(days=WINDOW_DAYS)

FIELDNAMES = [
    "isin",
    "mic",
    "full_name",
    "short_name",
    "classification_type",
    "currency",
    "competent_authority",
    "publication_date",
    "termination_date",
    "is_active",
    "is_stale",  # publication_date older than 6 months, informational only
]


def is_still_relevant(termntn_dt_str: str) -> bool:
    """Keep unless terminated before the 6-month window start."""
    if not termntn_dt_str:
        return True
    try:
        termntn_dt = datetime.strptime(termntn_dt_str[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return True  # unparseable -> don't silently drop, keep for review
    return termntn_dt >= six_months_ago


def flatten_record(isin: str, mic: str, rec: dict) -> dict:
    fin_attrs = rec.get("FinInstrmGnlAttrbts", {})
    tech_attrs = rec.get("TechAttrbts", {})
    tradg_attrs = rec.get("TradgVnRltdAttrbts", {})
    termntn_dt = tradg_attrs.get("TermntnDt")
    pub_date_str = rec.get("instance-info", {}).get("publication_date", "")

    is_stale = False
    if pub_date_str:
        try:
            pub_date = datetime.strptime(pub_date_str[:10], "%Y-%m-%d")
            is_stale = pub_date < six_months_ago
        except ValueError:
            pass

    return {
        "isin": isin,
        "mic": mic,
        "full_name": fin_attrs.get("FullNm", ""),
        "short_name": fin_attrs.get("ShrtNm", ""),
        "classification_type": fin_attrs.get("ClssfctnTp", ""),
        "currency": fin_attrs.get("NtnlCcy", ""),
        "competent_authority": tech_attrs.get("RlvntCmptntAuthrty", ""),
        "publication_date": pub_date_str,
        "termination_date": termntn_dt or "",
        "is_active": termntn_dt is None,
        "is_stale": is_stale,
    }


def stream_current_securities_to_csv(filepath: str):
    after_key = None
    total_written = 0
    total_skipped_terminated = 0

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()

        while True:
            composite_sources = [
                {"isin": {"terms": {"field": ISIN_FIELD}}},
                {"mic": {"terms": {"field": MIC_FIELD}}},
            ]
            composite_agg = {"size": 1000, "sources": composite_sources}
            if after_key:
                composite_agg["after"] = after_key

            body = {
                "size": 0,
                "query": {
                    "bool": {
                        "filter": [
                            {
                                "bool": {
                                    "should": [
                                        {"prefix": {CFI_FIELD: "EP"}},
                                        {"prefix": {CFI_FIELD: "ES"}},
                                    ],
                                    "minimum_should_match": 1,
                                }
                            }
                            # NOTE: no date range here — we want the full history
                            # so "still active, no recent update" securities aren't lost
                        ]
                    }
                },
                "aggs": {
                    "by_isin_mic": {
                        "composite": composite_agg,
                        "aggs": {
                            "latest": {
                                "top_hits": {
                                    "size": 1,
                                    "sort": [{DATE_FIELD: "desc"}],
                                    "_source": [
                                        "FinInstrmGnlAttrbts.Id",
                                        "FinInstrmGnlAttrbts.FullNm",
                                        "FinInstrmGnlAttrbts.ShrtNm",
                                        "FinInstrmGnlAttrbts.ClssfctnTp",
                                        "FinInstrmGnlAttrbts.NtnlCcy",
                                        "TechAttrbts.RlvntTradgVn",
                                        "TechAttrbts.RlvntCmptntAuthrty",
                                        "instance-info.publication_date",
                                        "TradgVnRltdAttrbts.TermntnDt",
                                    ],
                                }
                            }
                        },
                    }
                },
            }

            response = client.search(index=INDEX, body=body)
            buckets = response["aggregations"]["by_isin_mic"]["buckets"]

            if not buckets:
                break

            for bucket in buckets:
                isin = bucket["key"]["isin"]
                mic = bucket["key"]["mic"]
                hit = bucket["latest"]["hits"]["hits"][0]["_source"]

                termntn_dt = hit.get("TradgVnRltdAttrbts", {}).get("TermntnDt")
                if not is_still_relevant(termntn_dt):
                    total_skipped_terminated += 1
                    continue

                writer.writerow(flatten_record(isin, mic, hit))
                total_written += 1

            f.flush()
            after_key = response["aggregations"]["by_isin_mic"].get("after_key")
            print(f"Written {total_written} rows so far "
                  f"(skipped {total_skipped_terminated} terminated)...")

            if not after_key:
                break

    print(f"Done. Total rows written: {total_written}")
    print(f"Total skipped (terminated before window): {total_skipped_terminated}")


if __name__ == "__main__":
    stream_current_securities_to_csv(OUTPUT_CSV)
