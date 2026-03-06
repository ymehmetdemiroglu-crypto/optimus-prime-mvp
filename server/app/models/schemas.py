from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class StrategyType(str, Enum):
    AUTO_PILOT = "auto_pilot"
    AGGRESSIVE = "aggressive"
    PROFIT_GUARD = "profit_guard"


class CampaignStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class DashboardMetrics(BaseModel):
    acos: float = Field(..., description="Advertising Cost of Sales (%)")
    roas: float = Field(..., description="Return on Ad Spend")
    ctr: float = Field(..., description="Click-Through Rate (%)")
    cvr: float = Field(..., description="Conversion Rate (%)")
    total_sales: float = Field(..., description="Total sales in USD")
    total_spend: float = Field(..., description="Total ad spend in USD")
    impressions: int = Field(..., description="Total impressions")
    clicks: int = Field(..., description="Total clicks")


class SalesDataPoint(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    sales: float = Field(..., description="Sales amount in USD")
    orders: int = Field(..., description="Number of orders")


class AIAction(BaseModel):
    id: str
    timestamp: str
    action: str
    impact: str
    status: str = Field(..., description="success, pending, or failed")


class Campaign(BaseModel):
    id: str
    name: str
    status: CampaignStatus
    strategy: StrategyType
    budget: float = Field(..., description="Daily budget in USD")
    spend: float = Field(..., description="Current spend in USD")
    sales: float = Field(..., description="Sales generated in USD")
    acos: float = Field(..., description="Campaign ACOS (%)")
    impressions: int
    clicks: int
    orders: int


class StrategyUpdate(BaseModel):
    strategy: StrategyType


class MessageHistory(BaseModel):
    role: str
    content: str

class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: Optional[List[MessageHistory]] = Field(default_factory=list)

class ChatResponse(BaseModel):
    response: str
    timestamp: str
    suggestions: Optional[List[str]] = None


class DashboardResponse(BaseModel):
    metrics: DashboardMetrics
    sales_data: List[SalesDataPoint]
    ai_actions: List[AIAction]

class ReportInsight(BaseModel):
    title: str
    description: str
    impact: str
    actionable_step: str

class ReportAnalysisResponse(BaseModel):
    summary: str
    insights: List[ReportInsight]
