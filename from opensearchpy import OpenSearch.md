from opensearchpy import OpenSearch
from datetime import datetime, timedelta
import csv

# --- connection ---
client = OpenSearch(
    hosts=[{"host": "your-opensearch-host", "port": 9200}],
    http_auth=("user", "password"),
    use_ssl=True,
    verify_certs=True,
)

INDEX = "firds-esma-ref"
ISIN_FIELD = "FinInstrmGnlAttrbts.Id.keyword"
DATE_FIELD = "instance-info.publication_date"
CFI_FIELD = "FinInstrmGnlAttrbts.ClssfctnTp"  # adjust to .keyword if needed
OUTPUT_CSV = "firds_latest_per_isin.csv"

six_months_ago = (datetime.utcnow() - timedelta(days=182)).strftime("%Y-%m-%dT%H:%M:%S")

FIELDNAMES = [
    "isin",
    "full_name",
    "short_name",
    "classification_type",
    "mic",
    "currency",
    "competent_authority",
    "publication_date",
    "termination_date",
    "is_active",
]


def flatten_record(isin: str, rec: dict) -> dict:
    fin_attrs = rec.get("FinInstrmGnlAttrbts", {})
    tech_attrs = rec.get("TechAttrbts", {})
    tradg_attrs = rec.get("TradgVnRltdAttrbts", {})
    termntn_dt = tradg_attrs.get("TermntnDt")

    return {
        "isin": isin,
        "full_name": fin_attrs.get("FullNm", ""),
        "short_name": fin_attrs.get("ShrtNm", ""),
        "classification_type": fin_attrs.get("ClssfctnTp", ""),
        "mic": tech_attrs.get("RlvntTradgVn", ""),
        "currency": fin_attrs.get("NtnlCcy", ""),
        "competent_authority": tech_attrs.get("RlvntCmptntAuthrty", ""),
        "publication_date": rec.get("instance-info", {}).get("publication_date", ""),
        "termination_date": termntn_dt or "",
        "is_active": termntn_dt is None,
    }


def stream_latest_per_isin_to_csv(filepath: str):
    after_key = None
    total_written = 0

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()

        while True:
            composite_agg = {
                "size": 1000,
                "sources": [{"isin": {"terms": {"field": ISIN_FIELD}}}],
            }
            if after_key:
                composite_agg["after"] = after_key

            body = {
                "size": 0,
                "query": {
                    "bool": {
                        "must": [
                            {"range": {DATE_FIELD: {"gte": six_months_ago, "lte": "now"}}}
                        ],
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
                        ],
                    }
                },
                "aggs": {
                    "by_isin": {
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
            buckets = response["aggregations"]["by_isin"]["buckets"]

            if not buckets:
                break

            for bucket in buckets:
                isin = bucket["key"]["isin"]
                hit = bucket["latest"]["hits"]["hits"][0]["_source"]
                writer.writerow(flatten_record(isin, hit))
                total_written += 1

            f.flush()
            after_key = response["aggregations"]["by_isin"].get("after_key")
            print(f"Written {total_written} rows so far...")

            if not after_key:
                break

    print(f"Done. Total rows written: {total_written}")


if __name__ == "__main__":
    stream_latest_per_isin_to_csv(OUTPUT_CSV)
