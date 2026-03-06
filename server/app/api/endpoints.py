from fastapi import APIRouter, HTTPException
from typing import List
from app.models.schemas import (
    DashboardResponse,
    Campaign,
    StrategyUpdate,
    ChatMessage,
    ChatResponse,
    ReportAnalysisResponse
)
from app.services.ai_simulation import (
    generate_dashboard_data,
    generate_campaigns,
    update_campaign_strategy
)
from app.services.ai_client import generate_chat_response
from app.core.config import settings

router = APIRouter(prefix=settings.API_V1_STR, tags=["grok-admaster"])


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard():
    """Get dashboard metrics, sales data, and AI actions"""
    return generate_dashboard_data()


@router.get("/campaigns", response_model=List[Campaign])
async def get_campaigns():
    """Get all campaigns"""
    return generate_campaigns()


@router.get("/campaigns/{campaign_id}", response_model=Campaign)
async def get_campaign(campaign_id: str):
    """Get specific campaign by ID"""
    campaigns = generate_campaigns()
    for campaign in campaigns:
        if campaign.id == campaign_id:
            return campaign
    raise HTTPException(status_code=404, detail="Campaign not found")


@router.post("/campaigns/{campaign_id}/strategy", response_model=Campaign)
async def update_strategy(campaign_id: str, strategy_update: StrategyUpdate):
    """Update campaign strategy"""
    try:
        return update_campaign_strategy(campaign_id, strategy_update.strategy)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


from fastapi import UploadFile, File

@router.post("/chat", response_model=ChatResponse)
async def chat(message: ChatMessage):
    """Send message to Grok AI and get response"""
    return await generate_chat_response(message.message, history=message.history)

@router.post("/reports/upload", response_model=ReportAnalysisResponse)
async def upload_report(file: UploadFile = File(...)):
    """Upload and analyze a CSV report"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
    content = await file.read()
    try:
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Could not read CSV file. Please ensure it is UTF-8 encoded.")
        
    from app.services.ai_client import analyze_csv_report
    analysis = await analyze_csv_report(text_content)
    return analysis

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "grok-admaster"}
