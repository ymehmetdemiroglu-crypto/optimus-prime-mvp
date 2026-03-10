import os
import httpx
from openai import AsyncOpenAI
from dotenv import load_dotenv
from supabase import create_client, Client

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

# Force HTTP/1.1 and increase timeouts to prevent ConnectionTerminated errors with OpenRouter
http_client = httpx.AsyncClient(http2=False, timeout=120.0)

# We use the OpenAI SDK, but point it to OpenRouter's URL
openrouter_client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    http_client=http_client
)

# You can change the models based on OpenRouter availability and cost constraints.
# text-embedding-3-small is actually an OpenAI model. If OpenRouter supports it via routing, we use it. 
# Alternatively, we could use a free/cheap semantic model from OpenRouter if available.
EMBEDDING_MODEL = "qwen/qwen3-embedding-8b"
LISTING_MODEL = "inception/mercury-2" # Strong reasoning and formatting for Amazon SEO
CHAT_MODEL = "inception/mercury-2" # High quality conversational reasoning for Optimus

async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate dense vector embeddings for a list of strings."""
    if not texts:
        return []
    
    # OpenRouter fully supports OpenAI's embeddings endpoint
    response = await openrouter_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts
    )
    
    # The response object has the 'data' array containing the embeddings
    embeddings = [item.embedding for item in response.data]
    return embeddings

async def generate_listing_suggestion(cluster_terms: list[str]) -> dict:
    """Generate a Cosmo/Rufus optimized listing from a semantic term cluster."""
    
    top_keywords = cluster_terms[:10]
    primary_kw = top_keywords[0] if top_keywords else "Product"
    remaining_kws = ", ".join(top_keywords[1:])
    
    system_prompt = f"""You are an elite Amazon Listing Copywriter and SEO Specialist with deep expertise in Amazon's Cosmo semantic relevance engine and Rufus AI shopping assistant.

## Your Role
Your job is to transform a cluster of high-performing search terms into a conversion-optimized Amazon product listing. Every word you write must serve a dual purpose: satisfying Amazon's ranking algorithms AND resonating with real human shoppers who are ready to buy.

## Amazon Algorithm Context
- **Cosmo Engine**: Amazon's semantic AI that maps search queries to product concepts. It rewards listings that use natural, topic-coherent language across a semantic field — not just keyword stuffing. Write with thematic depth.
- **Rufus AI**: Amazon's conversational shopping assistant. It reads your bullets and title to answer shopper questions like "Is this good for running?" or "Does it work with iOS?". Write bullets as clear, question-answering statements in a conversational tone.

## Strict Output Rules
1. **Title**: Must be under 200 characters. Lead with the primary keyword "{primary_kw}". Include the most important secondary keywords naturally. Use proper capitalization (Title Case). Do not use all caps.
2. **Bullet Points**: Write EXACTLY 5 bullets. Each bullet must:
   - Start with a short, bold-style benefit phrase in ALL CAPS (e.g. "LONG BATTERY LIFE –"), followed by a conversational explanation
   - Answer a likely Rufus shopper question (e.g. compatibility, use case, comfort, value, tech specs)
   - Be between 150–250 characters
   - Be benefit-driven, not just feature-listing
3. **Backend Search Terms**: A single comma-separated string, max 250 bytes total. Include relevant synonyms, long-tail phrases, and complementary terms NOT already used in the title or bullets. No repetition of words.
4. **A+ Keywords**: Up to 8 high-intent keywords appropriate for A+ Content module headers and image alt-text.
5. **Prohibited Language**: Do NOT use superlatives or unverifiable claims: "best", "top", "#1", "greatest", "guaranteed", "perfect", "amazing", "world-class". These violate Amazon's style guidelines.
6. **Tone**: Professional yet approachable. Confident but not boastful. Write for a shopper who is comparison-shopping and needs clear reasons to choose this product.

## Output Format
Return ONLY a valid JSON object. No markdown, no explanation, no extra text:
{{
  "title": "<Amazon-optimized product title under 200 chars>",
  "bullets": [
    "<Bullet 1: benefit phrase – conversational explanation>",
    "<Bullet 2: benefit phrase – conversational explanation>",
    "<Bullet 3: benefit phrase – conversational explanation>",
    "<Bullet 4: benefit phrase – conversational explanation>",
    "<Bullet 5: benefit phrase – conversational explanation>"
  ],
  "backend_terms": "<comma-separated, max 250 bytes, no word repetition>",
  "aplus_keywords": ["<kw1>", "<kw2>", "<kw3>", "<kw4>", "<kw5>", "<kw6>", "<kw7>", "<kw8>"]
}}"""
    
    user_prompt = f"Here are the top keywords for this cluster:\n{remaining_kws}\n\nPlease generate the listing JSON."
    
    response = await openrouter_client.chat.completions.create(
        model=LISTING_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.7
    )
    
    import json
    try:
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"Failed to parse LLM Response: {e}")
        # Return graceful fallback
        return {
            "title": f"{primary_kw.title()} - Premium {remaining_kws.split(',')[0] if remaining_kws else 'Equipment'} | Advanced Technology",
            "bullets": [f"Optimized for {primary_kw}"] * 5,
            "backend_terms": remaining_kws[:250],
            "aplus_keywords": top_keywords[:8]
        }

async def generate_chat_response(message: str, history: list = None) -> dict:
    """Generate response for the Optimus AI Assistant using RAG (Retrieval-Augmented Generation)."""
    from datetime import datetime
    
    system_prompt = """You are Optimus — an elite Amazon Advertising AI built into NexOptimus Prime, an advanced PPC management platform. You are the seller's most trusted strategic advisor for all things Amazon advertising.

## Your Identity & Persona
- You are calm, precise, and data-driven. You speak like a senior Amazon PPC strategist who has managed millions in ad spend.
- You are not a generic chatbot. You have deep, specialized knowledge of the Amazon advertising ecosystem.
- You address the user as a business partner. Be direct, actionable, and confident — but never arrogant.
- You may use light professional language. Avoid fluff, padding, or unnecessary disclaimers.

## Your Expertise Domains
You are an expert in all of the following, and you should draw on this expertise to give specific, non-generic advice:

### Amazon PPC Fundamentals
- Sponsored Products, Sponsored Brands, Sponsored Display ad types and when to use each
- Keyword match types: Exact, Phrase, Broad — their tradeoffs, best practices, and harvest workflows
- ACoS (Advertising Cost of Sales), TACoS (Total ACoS), ROAS, CTR, CVR — how to interpret and act on them
- Bid strategies: Dynamic bids (down only, up and down), Fixed bids — contexts and tradeoffs
- Campaign structure: SKAGs (Single Keyword Ad Groups), STR (Search Term Reports), negation strategy

### Advanced Optimization
- Thompson Sampling for bid optimization (multi-armed bandit exploration vs. exploitation)
- Q-Learning reinforcement learning for adaptive bid management
- EWMA (Exponentially Weighted Moving Average) forecasting for spend/sales prediction
- Dayparting, budget pacing, and bid multipliers for time-of-day and device optimization
- Negative keyword harvesting: when and how to move from broad to exact, when to negate

### Amazon Algorithms (Cosmo & Rufus)
- **Cosmo**: Amazon's semantic relevance engine. Understand how thematic keyword coherence affects organic rank and ad quality score.
- **Rufus**: Amazon's AI shopping assistant. Know how it uses listing content (bullets, title, description) to answer shopper queries and affect conversion.
- How listing quality (title, bullets, A+ content, backend terms) interacts with ad performance

### Business Strategy
- Budget allocation across campaigns and portfolios
- Lifecycle strategy: launch (aggressive), growth (ACoS target), mature (efficiency), clearance (liquidate)
- Competitor analysis, Share of Voice, and defensive/offensive campaign structures
- Profitability analysis accounting for COGS, FBA fees, referral fees, and ad spend

## Response Style Guidelines
1. **Be specific**: Give concrete numbers, thresholds, and examples when possible (e.g., "If your ACoS is above 40% on a keyword with fewer than 20 clicks, consider pausing it.")
2. **Be actionable**: Every response should end with at least one clear next step the user can take.
3. **Be concise but complete**: Don't pad. Don't repeat the question back. Get to the insight.
4. **Use structure**: For complex answers, use bullet points or numbered steps. For simple questions, a paragraph is fine.
5. **Acknowledge data context**: If the user references specific metrics, engage with them directly. If no data is provided, give general strategic guidance and ask for more context if needed.
6. **Stay in scope**: You are an Amazon PPC expert. If asked something outside your domain (e.g., general coding, personal questions), politely redirect to your expertise.

## Tone Examples
- NOT: "Great question! There are many ways to think about ACoS..."
- YES: "Your target ACoS depends on your margin. If your product has a 40% margin and you want to break even on ads, you should target ≤40% ACoS. For growth, accept higher; for profitability, aim lower."

- NOT: "I'd recommend looking into your keyword strategy."
- YES: "Run a Search Term Report filtered to the last 30 days. Sort by spend descending. Any keyword above $5 spend with 0 orders is a candidate for bid reduction or negation."
"""
    
    # ——— RAG: Retrieve relevant context via vector similarity search ———
    live_data_context = ""
    try:
        # 1. Always grab high-level account summary (lightweight — just aggregates)
        camp_res = supabase.table('campaigns').select(
            'name, status, strategy, daily_budget, spend, sales, acos, impressions, clicks, orders'
        ).execute()
        campaigns = camp_res.data if hasattr(camp_res, 'data') and camp_res.data else []

        if campaigns:
            total_spend = sum(float(c.get('spend') or 0) for c in campaigns)
            total_sales = sum(float(c.get('sales') or 0) for c in campaigns)
            overall_acos = (total_spend / total_sales * 100) if total_sales > 0 else 0
            
            live_data_context = f"""
## Account Summary
- **Total Spend**: ${total_spend:.2f}
- **Total Sales**: ${total_sales:.2f}
- **Overall ACoS**: {overall_acos:.2f}%
- **Active Campaigns**: {len([c for c in campaigns if c.get('status') == 'active'])} / {len(campaigns)} total
"""

        # 2. RAG: Embed the user query and retrieve the most relevant search terms
        try:
            query_embedding = await generate_embeddings([message])
            if query_embedding and len(query_embedding) > 0:
                rag_res = supabase.rpc('match_search_terms', {
                    'query_embedding': query_embedding[0],
                    'match_threshold': 0.3,
                    'match_count': 5
                }).execute()

                relevant_terms = rag_res.data or []
                if relevant_terms:
                    term_lines = []
                    for t in relevant_terms:
                        term_lines.append(
                            f"- \"{t.get('query_text', '')}\" — "
                            f"Impressions: {t.get('impressions', 0)}, "
                            f"Clicks: {t.get('clicks', 0)}, "
                            f"Orders: {t.get('orders', 0)}, "
                            f"Spend: ${float(t.get('spend', 0)):.2f}, "
                            f"Sales: ${float(t.get('sales', 0)):.2f}"
                        )
                    live_data_context += f"""
## Relevant Search Terms (via RAG)
{chr(10).join(term_lines)}
"""
        except Exception as rag_err:
            # RAG is best-effort; fall back gracefully
            print(f"RAG retrieval skipped: {rag_err}")

        # 3. Fallback: If RAG returned nothing, include top 5 campaigns by spend
        if "Relevant Search Terms" not in live_data_context and campaigns:
            top_campaigns = sorted(campaigns, key=lambda x: float(x.get('spend') or 0), reverse=True)[:5]
            camp_strs = [
                f"- {c.get('name')} ({c.get('status')}): Spend ${c.get('spend', 0)}, "
                f"Sales ${c.get('sales', 0)}, ACoS {c.get('acos', 0)}% (Strategy: {c.get('strategy')})"
                for c in top_campaigns
            ]
            live_data_context += f"""
### Top Spending Campaigns
{chr(10).join(camp_strs)}
"""

        # 4. Autonomous Activity Context (recent actions + pending approvals)
        try:
            # Recent autonomous actions (last 10)
            log_res = supabase.table('autonomous_logs').select(
                'action_type, reason, previous_value, new_value, approval_tier, created_at'
            ).order('created_at', desc=True).limit(10).execute()
            auto_logs = log_res.data if hasattr(log_res, 'data') and log_res.data else []
            if auto_logs:
                log_lines = []
                for log in auto_logs[:5]:  # Top 5 most recent
                    log_lines.append(
                        f"- [{log.get('created_at', '')[:16]}] {log.get('action_type')}: "
                        f"{log.get('reason', 'N/A')} (Tier: {log.get('approval_tier', 'N/A')})"
                    )
                live_data_context += f"""
## Recent Autonomous Actions
{chr(10).join(log_lines)}
"""

            # Pending approvals count
            pending_res = supabase.table('pending_approvals').select(
                'id', count='exact'
            ).eq('status', 'pending').execute()
            pending_count = pending_res.count or 0
            if pending_count > 0:
                live_data_context += f"""
## Pending Approvals
- **{pending_count} items** are waiting for human review in the approval queue.
"""

            # Active experiments
            exp_res = supabase.table('bid_experiments').select(
                'name, status, model_a, model_b, started_at'
            ).eq('status', 'running').limit(5).execute()
            experiments = exp_res.data if hasattr(exp_res, 'data') and exp_res.data else []
            if experiments:
                exp_lines = [
                    f"- \"{e.get('name')}\": {e.get('model_a')} vs {e.get('model_b')} (started {e.get('started_at', '')[:10]})"
                    for e in experiments
                ]
                live_data_context += f"""
## Active Experiments
{chr(10).join(exp_lines)}
"""

        except Exception as ctx_err:
            print(f"Autonomous context skipped: {ctx_err}")

    except Exception as e:
        print(f"Failed to build context: {e}")

    final_system_prompt = system_prompt + "\n\n" + live_data_context
    messages = [{"role": "system", "content": final_system_prompt}]
    
    if history:
        for m in history:
            role = m.role if hasattr(m, 'role') else m.get('role', 'user')
            content = m.content if hasattr(m, 'content') else m.get('content', '')
            if role in ['user', 'assistant'] and content:
                messages.append({"role": role, "content": content})
                
    messages.append({"role": "user", "content": message})
    
    try:
        response = await openrouter_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            temperature=0.7
        )
        content = response.choices[0].message.content
        return {
            "response": content,
            "timestamp": datetime.utcnow().isoformat(),
            "suggestions": [
                "How can I lower my ACoS?",
                "Show me top performing keywords",
                "What bid strategy should I use?"
            ]
        }
    except Exception as e:
        print(f"Failed to generate chat: {e}")
        return {
            "response": "My circuits are currently experiencing communication issues. Please ensure my connection is stable.",
            "timestamp": datetime.utcnow().isoformat(),
            "suggestions": ["Try again", "Check API connection"]
        }



async def analyze_csv_report(csv_content: str) -> dict:
    """Analyze a raw CSV report using the LLM and return structured insights."""
    
    # We truncate the CSV content if it's too long to prevent massive context costs
    max_chars = 15000 
    truncated_content = csv_content[:max_chars]
    if len(csv_content) > max_chars:
        truncated_content += "\n...[TRUNCATED due to length]"
        
    system_prompt = """You are Optimus — an elite Amazon Advertising AI built into NexOptimus Prime.
Your task is to analyze raw performance report CSV data and return actionable, high-ROI insights.

## Your Framework:
1. Identify high-spend, low-return campaigns/keywords.
2. Find highly profitable, low-spend campaigns/keywords with room to scale.
3. Call out any major anomalies (e.g. 0% CTR, 100% ACoS).

## Output Rules
Return EXACTLY a JSON object matching this schema. Write your insights clearly, confidently, and concisely. Use formatting like $ and %.
{
    "summary": "<2-3 sentences summarizing the overall health of the report data>",
    "insights": [
        {
            "title": "<Short, punchy title like 'Wasteful Spend on Broad Match'>",
            "description": "<What you found in the data>",
            "impact": "<Why this matters (e.g. 'Bleeding $150/week')>",
            "actionable_step": "<Exactly what the user should do right now>"
        }
    ]
}"""
    
    user_prompt = f"Please analyze the following report data:\n\n{truncated_content}"
    
    try:
        response = await openrouter_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.4
        )
        
        import json
        content = response.choices[0].message.content
        return json.loads(content)
        
    except Exception as e:
        print(f"Failed to analyze report: {e}")
        return {
            "summary": "The system encountered an error while processing the report data.",
            "insights": [
                {
                    "title": "Analysis Failed",
                    "description": str(e),
                    "impact": "Cannot provide optimizations at this time.",
                    "actionable_step": "Try uploading a smaller CSV or checking the API connection."
                }
            ]
        }

