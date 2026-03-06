import random
from datetime import datetime, timedelta
from typing import List
from app.models.schemas import (
    DashboardMetrics,
    SalesDataPoint,
    AIAction,
    Campaign,
    CampaignStatus,
    StrategyType,
    ChatResponse
)


def generate_dashboard_data():
    """Generate mock dashboard metrics and data"""
    metrics = DashboardMetrics(
        acos=round(random.uniform(15, 35), 2),
        roas=round(random.uniform(2.5, 5.0), 2),
        ctr=round(random.uniform(0.3, 1.2), 2),
        cvr=round(random.uniform(8, 15), 2),
        total_sales=round(random.uniform(50000, 150000), 2),
        total_spend=round(random.uniform(10000, 30000), 2),
        impressions=random.randint(500000, 1500000),
        clicks=random.randint(5000, 15000)
    )
    
    # Generate 30 days of sales data
    sales_data = []
    base_date = datetime.now() - timedelta(days=30)
    for i in range(30):
        date = base_date + timedelta(days=i)
        sales_data.append(SalesDataPoint(
            date=date.strftime("%Y-%m-%d"),
            sales=round(random.uniform(1500, 5000), 2),
            orders=random.randint(20, 80)
        ))
    
    # Generate AI actions
    ai_actions = [
        AIAction(
            id="1",
            timestamp=datetime.now().isoformat(),
            action="Increased bid on 'wireless earbuds' by 15%",
            impact="+$1,240 projected revenue",
            status="success"
        ),
        AIAction(
            id="2",
            timestamp=(datetime.now() - timedelta(hours=2)).isoformat(),
            action="Paused underperforming keyword 'cheap headphones'",
            impact="-$85 wasted spend",
            status="success"
        ),
        AIAction(
            id="3",
            timestamp=(datetime.now() - timedelta(hours=5)).isoformat(),
            action="Optimizing product targeting for ASIN B08XYZ123",
            impact="Testing in progress",
            status="pending"
        )
    ]
    
    return {
        "metrics": metrics,
        "sales_data": sales_data,
        "ai_actions": ai_actions
    }


def generate_campaigns() -> List[Campaign]:
    """Generate mock campaign data"""
    campaign_names = [
        "Premium Wireless Earbuds - Sponsored Products",
        "Bluetooth Headphones - Brand Defense",
        "Audio Accessories - Category Targeting",
        "Noise Cancelling - Competitor Targeting",
        "Holiday Sale - Lightning Deals"
    ]
    
    campaigns = []
    for i, name in enumerate(campaign_names, 1):
        budget = round(random.uniform(50, 500), 2)
        spend = round(random.uniform(30, budget * 0.9), 2)
        sales = round(spend * random.uniform(2, 6), 2)
        acos = round((spend / sales * 100) if sales > 0 else 0, 2)
        
        campaigns.append(Campaign(
            id=str(i),
            name=name,
            status=random.choice([CampaignStatus.ACTIVE, CampaignStatus.PAUSED]),
            strategy=random.choice(list(StrategyType)),
            budget=budget,
            spend=spend,
            sales=sales,
            acos=acos,
            impressions=random.randint(10000, 100000),
            clicks=random.randint(100, 2000),
            orders=random.randint(10, 150)
        ))
    
    return campaigns


def generate_ai_response(message: str) -> ChatResponse:
    """Generate mock AI chat response"""
    responses = {
        "acos": "Your current ACOS is trending well. I recommend maintaining your current bid strategy for top-performing keywords while gradually reducing bids on keywords with ACOS > 40%.",
        "sales": "Sales velocity is strong this week. Consider increasing budgets on your top 3 campaigns by 20% to capitalize on momentum. Watch for inventory levels.",
        "keywords": "I've identified 12 high-potential keywords with low competition. Would you like me to create a new campaign targeting these opportunities?",
        "default": "I'm analyzing your account data. Based on current performance, I suggest focusing on improving your product detail pages and running A/B tests on your main images to boost conversion rates."
    }
    
    message_lower = message.lower()
    response_text = responses.get("default")
    
    for key in responses:
        if key in message_lower:
            response_text = responses[key]
            break
    
    suggestions = [
        "Show me top performing keywords",
        "Analyze competitor strategies",
        "Optimize my budget allocation"
    ]
    
    return ChatResponse(
        response=response_text,
        timestamp=datetime.now().isoformat(),
        suggestions=random.sample(suggestions, 2)
    )


def update_campaign_strategy(campaign_id: str, strategy: StrategyType) -> Campaign:
    """Update campaign strategy (mock)"""
    campaigns = generate_campaigns()
    
    for campaign in campaigns:
        if campaign.id == campaign_id:
            campaign.strategy = strategy
            return campaign
    
    raise ValueError(f"Campaign {campaign_id} not found")
