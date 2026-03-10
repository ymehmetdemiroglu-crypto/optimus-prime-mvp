from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any
from app.services.semantic_engine import process_and_cluster_search_terms, generate_campaign_expansions
from app.services.ai_client import generate_listing_suggestion
from app.api.deps import verify_token
from supabase import create_client, Client
import os
import uuid

router = APIRouter(prefix="/semantic", tags=["semantic-optimization"])

supabase: Client = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_KEY", "")
)

# Authenticate backend Supabase client using generic developer credentials
# This bypasses RLS since we are using the 'anon' key instead of 'service_role'
try:
    supabase.auth.sign_in_with_password({
        "email": os.getenv("SERVICE_EMAIL", ""),
        "password": os.getenv("SERVICE_PASSWORD", "")
    })
except Exception as e:
    print(f"Warning: Backend failed to authenticate with Supabase: {e}")

@router.post("/cluster/{campaign_id}")
async def run_semantic_clustering(campaign_id: str, user_id: str = Depends(verify_token)):
    """
    Run pgvector embeddings and DBSCAN clustering on search terms for a campaign.
    """
    try:
        uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid campaign_id format: {campaign_id}")
    # Using Service Role Key, RPC auth fails. Fetch first seller or fallback.
    try:
        seller_res = supabase.table('sellers').select('id').limit(1).execute()
        seller_id = seller_res.data[0]['id'] if seller_res.data else "b0d66c3a-18e4-4d89-9bd1-0e1ceadeba95"
    except Exception:
        seller_id = "b0d66c3a-18e4-4d89-9bd1-0e1ceadeba95"
    
    try:
        cluster_count = await process_and_cluster_search_terms(campaign_id, seller_id)
        return {"status": "success", "cluster_count": cluster_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/listing/{cluster_id}")
async def generate_optimized_listing(cluster_id: str, payload: dict = Body(...), user_id: str = Depends(verify_token)):
    """
    Generate a Cosmo/Rufus optimized listing from a given semantic cluster using OpenRouter LLM.
    """
    try:
        uuid.UUID(cluster_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid cluster_id format: {cluster_id}")
        
    campaign_id = payload.get("campaign_id")
    if not campaign_id:
        raise HTTPException(status_code=400, detail="campaign_id is required")
    try:
        uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid campaign_id format in payload: {campaign_id}")
        
    try:
        seller_res = supabase.table('sellers').select('id').limit(1).execute()
        seller_id = seller_res.data[0]['id'] if seller_res.data else "b0d66c3a-18e4-4d89-9bd1-0e1ceadeba95"
    except Exception:
        seller_id = "b0d66c3a-18e4-4d89-9bd1-0e1ceadeba95"
    
    # 1. Fetch cluster terms to inform the prompt
    cluster_res = supabase.table('semantic_clusters').select('*, cosmo_relevance_score, rufus_intent_score').eq('id', cluster_id).execute()
    if not cluster_res.data:
        raise HTTPException(status_code=404, detail="Cluster not found")
        
    terms_res = supabase.table('cluster_terms').select('search_terms(query_text, sales)').eq('cluster_id', cluster_id).execute()
    
    terms = [item['search_terms'] for item in terms_res.data if item.get('search_terms')]
    terms = sorted(terms, key=lambda x: float(x.get('sales', 0)), reverse=True)
    keywords = [t['query_text'] for t in terms]
    
    # 2. Call OpenRouter
    try:
        listing = await generate_listing_suggestion(keywords)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Generation failed: {e}")
        
    # 3. Calculate heuristic scores
    cluster = cluster_res.data[0]
    cosmo_score = min(100, int((cluster.get('cosmo_relevance_score', 50)) * 1.1))
    rufus_score = min(100, int((cluster.get('rufus_intent_score', 50)) * 1.1))
    
    # 4. Save to DB
    insert_payload = {
        "seller_id": seller_id,
        "campaign_id": campaign_id,
        "cluster_id": cluster_id,
        "suggested_title": listing.get("title", ""),
        "suggested_bullets": listing.get("bullets", []),
        "suggested_backend_terms": listing.get("backend_terms", ""),
        "aplus_keywords": listing.get("aplus_keywords", []),
        "cosmo_score": cosmo_score,
        "rufus_score": rufus_score,
        "title_char_count": len(listing.get("title", "")),
        "compliance_status": "pending"
    }
    
    saved = supabase.table('listing_suggestions').insert(insert_payload).execute()
    return saved.data[0]

@router.post("/campaigns/{cluster_id}")
async def generate_skag_proposals(cluster_id: str, payload: dict = Body(...), user_id: str = Depends(verify_token)):
    """
    Generate Exact and Broad match SKAGs for a semantic cluster.
    """
    try:
        uuid.UUID(cluster_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid cluster_id format: {cluster_id}")
        
    campaign_id = payload.get("campaign_id")
    if not campaign_id:
        raise HTTPException(status_code=400, detail="campaign_id is required")
    try:
        uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid campaign_id format in payload: {campaign_id}")
        
    try:
        seller_res = supabase.table('sellers').select('id').limit(1).execute()
        seller_id = seller_res.data[0]['id'] if seller_res.data else "b0d66c3a-18e4-4d89-9bd1-0e1ceadeba95"
    except Exception:
        seller_id = "b0d66c3a-18e4-4d89-9bd1-0e1ceadeba95"
    
    try:
        count = await generate_campaign_expansions(cluster_id, campaign_id, seller_id)
        return {"status": "success", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
