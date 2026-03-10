import os
import json
import numpy as np
from sklearn.cluster import DBSCAN
from supabase import create_client, Client
from app.services.ai_client import generate_embeddings
from dotenv import load_dotenv

load_dotenv()

supabase: Client = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_KEY", "")
)

try:
    supabase.auth.sign_in_with_password({
        "email": os.getenv("SERVICE_EMAIL", ""),
        "password": os.getenv("SERVICE_PASSWORD", "")
    })
except Exception:
    pass

async def process_and_cluster_search_terms(campaign_id: str, seller_id: str) -> int:
    """
    1. Fetch all search terms for a campaign.
    2. Generate embeddings for any terms missing them.
    3. Run DBSCAN semantic clustering on the 1536-dim vectors.
    4. Save the new clusters to the database.
    """
    
    # 1. Fetch terms
    res = supabase.table('search_terms') \
        .select('*') \
        .eq('campaign_id', campaign_id) \
        .execute()
        
    terms = res.data
    if not terms:
        raise ValueError("No search terms found for this campaign")

    # 2. Embed missing terms
    terms_without_embeddings = [t for t in terms if not t.get('embedding')]
    
    if terms_without_embeddings:
        # Batch requests to OpenRouter (1536 dim vectors)
        texts_to_embed = [t['query_text'] for t in terms_without_embeddings]
        
        try:
            new_embeddings = await generate_embeddings(texts_to_embed)
            
            # Update missing terms in DB (batch upside)
            for t, emb in zip(terms_without_embeddings, new_embeddings):
                supabase.table('search_terms').update({"embedding": emb}).eq("id", t["id"]).execute()
                t['embedding'] = emb
                
        except Exception as e:
            print(f"Embedding generation failed: {e}")
            raise e

    # 3. Prepare vectors for DBSCAN
    parsed_embeddings = []
    for t in terms:
        emb = t['embedding']
        if isinstance(emb, str):
            emb = json.loads(emb)
        parsed_embeddings.append(emb)
    
    X = np.array(parsed_embeddings)
    
    # DBSCAN clustering — fast, un-supervised, density-based
    # eps = 0.4 (distance threshold for cosine similarity via euclidean mapping)
    # min_samples = 2
    clustering = DBSCAN(eps=0.4, min_samples=2, metric='cosine').fit(X)
    labels = clustering.labels_
    
    # Organize clusters
    clusters_dict = {}
    for i, label in enumerate(labels):
        if label == -1:
            cls_id = "uncategorized"
        else:
            cls_id = f"cluster_{label}"
            
        if cls_id not in clusters_dict:
            clusters_dict[cls_id] = []
        clusters_dict[cls_id].append(terms[i])
        
    # Delete old clusters for this campaign
    supabase.table('semantic_clusters').delete().eq('campaign_id', campaign_id).execute()

    cluster_count = 0
    # 4. Compute metrics and Save clusters
    for cls_id, cls_terms in clusters_dict.items():
        if cls_id == "uncategorized" and len(cls_terms) < 3:
            continue # Skip noise if too small
            
        # Extract top words for the cluster label
        import collections
        all_words = []
        for t in cls_terms:
            words = [w for w in t['query_text'].lower().split() if len(w) > 3]
            all_words.extend(words)
        
        top_words = [item[0] for item in collections.Counter(all_words).most_common(3)]
        label_text = " + ".join(top_words).title() if top_words else "Uncategorized"

        # Compute aggregate metrics
        total_impressions = sum(t.get('impressions', 0) for t in cls_terms)
        total_clicks = sum(t.get('clicks', 0) for t in cls_terms)
        total_orders = sum(t.get('orders', 0) for t in cls_terms)
        total_spend = sum(float(t.get('spend', 0)) for t in cls_terms)
        total_sales = sum(float(t.get('sales', 0)) for t in cls_terms)
        
        avg_acos = round((total_spend / total_sales * 100) if total_sales > 0 else 0, 2)
        avg_ctr = round((total_clicks / total_impressions * 100) if total_impressions > 0 else 0, 4)
        avg_cvr = round((total_orders / total_clicks * 100) if total_clicks > 0 else 0, 4)
        
        # Cosmo/Rufus mock score generation based on actual metrics
        cosmo_score = min(100, int(avg_cvr * 3 + (100 - avg_acos) * 0.5 + len(cls_terms) * 2))
        rufus_score = min(100, int(avg_ctr * 5 + total_clicks * 0.01 + len(cls_terms) * 3))

        cluster_payload = {
            "seller_id": seller_id,
            "campaign_id": campaign_id,
            "cluster_label": label_text,
            "description": f"{len(cls_terms)} search terms grouped by semantic similarity via DBSCAN",
            "term_count": len(cls_terms),
            "total_impressions": total_impressions,
            "total_clicks": total_clicks,
            "total_spend": round(total_spend, 2),
            "total_sales": round(total_sales, 2),
            "avg_acos": avg_acos,
            "avg_ctr": avg_ctr,
            "avg_cvr": avg_cvr,
            "cosmo_relevance_score": cosmo_score,
            "rufus_intent_score": rufus_score
        }

        inserted_cluster = supabase.table('semantic_clusters').insert(cluster_payload).execute()
        new_cluster_id = inserted_cluster.data[0]['id']
        
        # Link terms
        link_payloads = [
            {
                "cluster_id": new_cluster_id, 
                "search_term_id": t['id'],
                "similarity_score": 1.0 # Or distance from centroid if KMeans
            } 
            for t in cls_terms
        ]
        
        supabase.table('cluster_terms').insert(link_payloads).execute()
        cluster_count += 1
        
    return cluster_count

async def generate_campaign_expansions(cluster_id: str, campaign_id: str, seller_id: str) -> int:
    """
    Generate Exact and Broad match SKAG (Single Keyword Ad Group) proposals 
    for a specific semantic cluster.
    """
    
    # 1. Fetch cluster and its top terms
    cluster_res = supabase.table('semantic_clusters').select('*').eq('id', cluster_id).execute()
    if not cluster_res.data:
        raise ValueError("Cluster not found")
    cluster = cluster_res.data[0]
    
    terms_res = supabase.table('cluster_terms').select('search_terms(*)').eq('cluster_id', cluster_id).execute()
    terms = [item['search_terms'] for item in terms_res.data if item.get('search_terms')]
    
    # Sort terms by sales and take top 8
    terms = sorted(terms, key=lambda x: float(x.get('sales', 0)), reverse=True)
    top_terms = terms[:8]
    keywords = [t['query_text'] for t in top_terms]
    
    # Math: Average Cost Per Click
    if terms:
        valid_cw = [t for t in terms if t.get('clicks', 0) > 0]
        spends_div_clicks = [float(t['spend'])/t['clicks'] for t in valid_cw]
        avg_cpc = sum(spends_div_clicks) / len(spends_div_clicks) if spends_div_clicks else 0.75
    else:
        avg_cpc = 0.75
        
    cluster_label = cluster.get('cluster_label', 'Cluster')
    
    # 2. Exact Match SKAG
    exact_campaign = {
        "seller_id": seller_id,
        "campaign_id": campaign_id,
        "cluster_id": cluster_id,
        "proposed_campaign_name": f"SKAG Exact - {cluster_label}",
        "match_type": "exact",
        "keywords": keywords,
        "suggested_daily_budget": round(len(keywords) * avg_cpc * 5, 2),
        "suggested_bid": round(avg_cpc * 1.2, 2),
        "estimated_daily_impressions": round(cluster.get('total_impressions', 100) / 7),
        "estimated_daily_clicks": round(cluster.get('total_clicks', 10) / 7),
        "estimated_daily_spend": round((float(cluster.get('total_spend', 10)) / 7), 2)
    }
    
    # 3. Broad Match SKAG
    broad_campaign = {
        "seller_id": seller_id,
        "campaign_id": campaign_id,
        "cluster_id": cluster_id,
        "proposed_campaign_name": f"SKAG Broad - {cluster_label}",
        "match_type": "broad",
        "keywords": keywords[:5],
        "suggested_daily_budget": round(len(keywords) * avg_cpc * 3, 2),
        "suggested_bid": round(avg_cpc * 0.8, 2),
        "estimated_daily_impressions": round(cluster.get('total_impressions', 700) / 5),
        "estimated_daily_clicks": round(cluster.get('total_clicks', 50) / 5),
        "estimated_daily_spend": round((float(cluster.get('total_spend', 7)) / 5), 2)
    }
    
    # Save to DB
    supabase.table('campaign_expansions').insert([exact_campaign, broad_campaign]).execute()
    
    return 2
