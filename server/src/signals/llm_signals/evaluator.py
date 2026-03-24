import re
from typing import List, Dict
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

from src.config import LLM_PROVIDERS
from src.signals.llm_signals.llm_client import get_llm_client

# -----------------------------
# LLM
# -----------------------------

llm = get_llm_client(list(LLM_PROVIDERS.keys())[0])


# -----------------------------
# Regex Helpers
# -----------------------------

def build_pattern(name: str):
    name = re.escape(name.lower())
    return re.compile(rf"\b{name}(?:['’]s)?\b", re.IGNORECASE)


def detect_mentions(text: str, brands: List[str]) -> List[str]:
    found = []
    for brand in brands:
        pattern = build_pattern(brand)
        if pattern.search(text):
            found.append(brand)
    return found


# -----------------------------
# Cluster Summary
# -----------------------------

def compute_cluster_summary(cluster_coverage, target_brand, competitors):
    summary = {}

    for cluster, brands_map in cluster_coverage.items():

        brand_present = brands_map.get(target_brand, False)

        competitor_present = any(
            brands_map.get(c, False) for c in competitors
        )

        summary[cluster] = {
            "brand_present": brand_present,
            "competitor_present": competitor_present,
            "gap": (not brand_present and competitor_present)
        }

    return summary


# -----------------------------
# Worker Function (Parallel)
# -----------------------------

def process_prompt(prompt, cluster_name, all_brands):
    try:
        response = llm.invoke(prompt).content
        found_brands = detect_mentions(response, all_brands)

        return {
            "cluster": cluster_name,
            "prompt": prompt,
            "response": response,
            "brands_found": found_brands
        }

    except Exception as e:
        return {
            "cluster": cluster_name,
            "prompt": prompt,
            "response": "",
            "brands_found": [],
            "error": str(e)
        }


# -----------------------------
# Core Evaluator
# -----------------------------

def evaluate(
    clusters,
    target_brand: str,
    competitors: List[str],
    max_workers: int = 5   # 🔥 tunable
) -> Dict:

    all_brands = [target_brand] + competitors

    brand_counts = Counter()
    cluster_coverage = defaultdict(lambda: defaultdict(bool))
    total_mentions = 0
    results = []

    # -----------------------------
    # Prepare tasks
    # -----------------------------

    tasks = []
    for cluster in clusters.root:
        for prompt in cluster.prompts:
            tasks.append((cluster.cluster, prompt))

    # -----------------------------
    # Parallel execution
    # -----------------------------

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(process_prompt, prompt, cluster_name, all_brands)
            for cluster_name, prompt in tasks
        ]

        for future in as_completed(futures):
            result = future.result()
            results.append(result)

            # ---- Aggregate safely ----
            for b in result["brands_found"]:
                brand_counts[b] += 1
                total_mentions += 1
                cluster_coverage[result["cluster"]][b] = True

    # -----------------------------
    # Add brands with 0 mentions to brand_counts
    # -----------------------------
    
    for brand in all_brands:
        if brand not in brand_counts:
            brand_counts[brand] = 0
    
    # -----------------------------
    # SOV Calculation (Include zeros)
    # -----------------------------
    
    sov = {}
    if total_mentions > 0:
        for brand, count in brand_counts.items():
            sov[brand] = round((count / total_mentions) * 100, 2)
    else:
        # If no mentions at all, all brands get 0%
        for brand in all_brands:
            sov[brand] = 0.0

    # -----------------------------
    # Cluster Summary
    # -----------------------------

    cluster_summary = compute_cluster_summary(
        cluster_coverage,
        target_brand,
        competitors
    )

    # -----------------------------
    # Final Output
    # -----------------------------

    return {
        "brand_counts": dict(brand_counts),
        "sov": sov,
        "cluster_summary": cluster_summary,
        "total_mentions": total_mentions,
        "results": results
    }


# -----------------------------
# Example Run
# -----------------------------

if __name__ == "__main__":
    from src.signals.llm_signals.citation_prompts_chain import citation_prompts_chain
    from src.signals.llm_signals.competitors_chain import competitors_chain

    BRAND = "Aloyoga"

    clusters = citation_prompts_chain.invoke({
        "brand": BRAND,
        "industry": "Sportwear",
        "geo": "United States",
        "num_prompts": 14
    })

    competitors = competitors_chain.invoke({
        "brand": BRAND,
        "industry": "Sportwear",
        "geo": "United States",
        "num_competitors": 8
    }).competitors

    output = evaluate(
        clusters=clusters,
        target_brand=BRAND,
        competitors=competitors,
        max_workers=5
    )

    print("\n=== BRAND COUNTS ===")
    print(output["brand_counts"])

    print("\n=== SHARE OF VOICE ===")
    print(output["sov"])

    print("\n=== CLUSTER SUMMARY ===")
    for cluster, data in output["cluster_summary"].items():
        print(cluster, "->", data)