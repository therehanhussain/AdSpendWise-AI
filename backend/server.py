from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import pandas as pd
import io
import json

# AI Integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize AI Chat
def get_ai_chat():
    return LlmChat(
        api_key=os.environ.get('EMERGENT_LLM_KEY'),
        session_id=str(uuid.uuid4()),
        system_message="""You are AdSpendWise AI, an expert ad campaign optimizer for startups. 
        
        Analyze ad campaign data and provide actionable insights including:
        1. Performance analysis with key metrics
        2. Budget allocation recommendations
        3. Audience targeting suggestions
        4. Ad copy optimization recommendations
        5. ROI improvement strategies
        
        Be specific, data-driven, and focus on practical advice for startup founders."""
    ).with_model("openai", "gpt-4o")

# Define Models
class CampaignData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    campaign_name: str
    platform: str  # Google Ads, Facebook, etc.
    impressions: int
    clicks: int
    conversions: int
    spend: float
    revenue: float
    target_audience: str
    ad_copy: str
    keywords: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CampaignCreate(BaseModel):
    campaign_name: str
    platform: str
    impressions: int
    clicks: int
    conversions: int
    spend: float
    revenue: float
    target_audience: str
    ad_copy: str
    keywords: Optional[str] = None

class AIAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    campaign_id: str
    performance_analysis: str
    budget_recommendations: str
    targeting_suggestions: str
    copy_optimization: str
    roi_strategies: str
    overall_score: int  # 1-100
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BulkAnalysisRequest(BaseModel):
    campaigns: List[CampaignCreate]

# Helper functions
def prepare_for_mongo(data):
    """Convert datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    """Parse datetime strings back from MongoDB"""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and 'created_at' in key:
                try:
                    item[key] = datetime.fromisoformat(value)
                except:
                    pass
    return item

# API Routes
@api_router.get("/")
async def root():
    return {"message": "AdSpendWise AI - Ad Campaign Optimizer for Startups"}

@api_router.post("/campaigns", response_model=CampaignData)
async def create_campaign(campaign: CampaignCreate):
    """Create a new campaign entry"""
    campaign_dict = campaign.dict()
    campaign_obj = CampaignData(**campaign_dict)
    
    # Prepare for MongoDB storage
    mongo_data = prepare_for_mongo(campaign_obj.dict())
    await db.campaigns.insert_one(mongo_data)
    
    return campaign_obj

@api_router.get("/campaigns", response_model=List[CampaignData])
async def get_campaigns():
    """Get all campaigns"""
    campaigns = await db.campaigns.find().to_list(1000)
    return [CampaignData(**parse_from_mongo(campaign)) for campaign in campaigns]

@api_router.get("/campaigns/{campaign_id}", response_model=CampaignData)
async def get_campaign(campaign_id: str):
    """Get a specific campaign"""
    campaign = await db.campaigns.find_one({"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignData(**parse_from_mongo(campaign))

@api_router.post("/campaigns/{campaign_id}/analyze", response_model=AIAnalysis)
async def analyze_campaign(campaign_id: str):
    """Analyze a specific campaign using AI"""
    # Get campaign data
    campaign = await db.campaigns.find_one({"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    campaign_obj = CampaignData(**parse_from_mongo(campaign))
    
    # Calculate key metrics
    ctr = (campaign_obj.clicks / campaign_obj.impressions * 100) if campaign_obj.impressions > 0 else 0
    conversion_rate = (campaign_obj.conversions / campaign_obj.clicks * 100) if campaign_obj.clicks > 0 else 0
    cpa = campaign_obj.spend / campaign_obj.conversions if campaign_obj.conversions > 0 else campaign_obj.spend
    roas = campaign_obj.revenue / campaign_obj.spend if campaign_obj.spend > 0 else 0
    roi = ((campaign_obj.revenue - campaign_obj.spend) / campaign_obj.spend * 100) if campaign_obj.spend > 0 else 0
    
    # Prepare AI analysis prompt
    analysis_prompt = f"""
    Analyze this ad campaign data for {campaign_obj.campaign_name} on {campaign_obj.platform}:
    
    CAMPAIGN METRICS:
    - Impressions: {campaign_obj.impressions:,}
    - Clicks: {campaign_obj.clicks:,}
    - Conversions: {campaign_obj.conversions:,}
    - Spend: ${campaign_obj.spend:,.2f}
    - Revenue: ${campaign_obj.revenue:,.2f}
    - CTR: {ctr:.2f}%
    - Conversion Rate: {conversion_rate:.2f}%
    - CPA: ${cpa:.2f}
    - ROAS: {roas:.2f}x
    - ROI: {roi:.2f}%
    
    CAMPAIGN DETAILS:
    - Target Audience: {campaign_obj.target_audience}
    - Ad Copy: {campaign_obj.ad_copy}
    - Keywords: {campaign_obj.keywords or 'Not provided'}
    
    Please provide analysis in exactly this JSON format:
    {{
        "performance_analysis": "Detailed analysis of current performance with key insights",
        "budget_recommendations": "Specific budget allocation and spending recommendations",
        "targeting_suggestions": "Audience targeting improvements and new segments to try", 
        "copy_optimization": "Ad copy improvements and A/B testing suggestions",
        "roi_strategies": "Specific strategies to improve ROI and overall performance",
        "overall_score": score_from_1_to_100
    }}
    """
    
    try:
        # Get AI analysis
        chat = get_ai_chat()
        user_message = UserMessage(text=analysis_prompt)
        ai_response = await chat.send_message(user_message)
        
        # Parse AI response
        try:
            analysis_data = json.loads(ai_response)
        except json.JSONDecodeError:
            # Fallback parsing if JSON is not perfect
            analysis_data = {
                "performance_analysis": f"Campaign shows {ctr:.1f}% CTR and {roi:.1f}% ROI. " + ai_response[:200],
                "budget_recommendations": "Increase budget on high-performing segments based on current data.",
                "targeting_suggestions": "Refine audience targeting based on conversion data.",
                "copy_optimization": "Test new ad variations with stronger calls-to-action.",
                "roi_strategies": "Focus on conversion optimization and cost reduction.",
                "overall_score": min(max(int(roi + 50), 1), 100)
            }
        
        # Create analysis object
        analysis = AIAnalysis(
            campaign_id=campaign_id,
            **analysis_data
        )
        
        # Save to database
        mongo_data = prepare_for_mongo(analysis.dict())
        await db.analyses.insert_one(mongo_data)
        
        return analysis
        
    except Exception as e:
        logging.error(f"AI analysis failed: {str(e)}")
        # Fallback analysis
        fallback_analysis = AIAnalysis(
            campaign_id=campaign_id,
            performance_analysis=f"Campaign performance: {ctr:.1f}% CTR, {conversion_rate:.1f}% conversion rate, {roi:.1f}% ROI",
            budget_recommendations="Optimize budget allocation based on performance data",
            targeting_suggestions="Refine targeting for better audience reach",
            copy_optimization="Test new ad copy variations",
            roi_strategies="Focus on high-converting segments",
            overall_score=min(max(int(roi + 50), 1), 100)
        )
        
        mongo_data = prepare_for_mongo(fallback_analysis.dict())
        await db.analyses.insert_one(mongo_data)
        return fallback_analysis

@api_router.get("/campaigns/{campaign_id}/analysis", response_model=List[AIAnalysis])
async def get_campaign_analyses(campaign_id: str):
    """Get all AI analyses for a campaign"""
    analyses = await db.analyses.find({"campaign_id": campaign_id}).to_list(100)
    return [AIAnalysis(**parse_from_mongo(analysis)) for analysis in analyses]

@api_router.post("/campaigns/bulk-upload")
async def bulk_upload_campaigns(file: UploadFile = File(...)):
    """Upload campaigns from CSV file"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    try:
        # Read CSV file
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))
        
        # Expected columns
        required_columns = ['campaign_name', 'platform', 'impressions', 'clicks', 'conversions', 'spend', 'revenue', 'target_audience', 'ad_copy']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(status_code=400, detail=f"Missing required columns: {missing_columns}")
        
        # Create campaigns
        campaigns_created = []
        for _, row in df.iterrows():
            campaign_data = {
                'campaign_name': str(row['campaign_name']),
                'platform': str(row['platform']),
                'impressions': int(row['impressions']),
                'clicks': int(row['clicks']),
                'conversions': int(row['conversions']),
                'spend': float(row['spend']),
                'revenue': float(row['revenue']),
                'target_audience': str(row['target_audience']),
                'ad_copy': str(row['ad_copy']),
                'keywords': str(row.get('keywords', '')) if pd.notna(row.get('keywords')) else None
            }
            
            campaign_obj = CampaignData(**campaign_data)
            mongo_data = prepare_for_mongo(campaign_obj.dict())
            await db.campaigns.insert_one(mongo_data)
            campaigns_created.append(campaign_obj)
        
        return {"message": f"Successfully uploaded {len(campaigns_created)} campaigns", "campaigns": campaigns_created}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

@api_router.post("/campaigns/bulk-analyze")
async def bulk_analyze_campaigns():
    """Analyze all campaigns that don't have recent analysis"""
    campaigns = await db.campaigns.find().to_list(1000)
    analyses_created = []
    
    for campaign in campaigns:
        campaign_obj = CampaignData(**parse_from_mongo(campaign))
        
        # Check if campaign already has recent analysis (within last hour)
        recent_analysis = await db.analyses.find_one({
            "campaign_id": campaign_obj.id,
            "created_at": {"$gte": (datetime.now(timezone.utc) - pd.Timedelta(hours=1)).isoformat()}
        })
        
        if not recent_analysis:
            try:
                # Trigger analysis
                analysis = await analyze_campaign(campaign_obj.id)
                analyses_created.append(analysis)
            except Exception as e:
                logging.error(f"Failed to analyze campaign {campaign_obj.id}: {str(e)}")
                continue
    
    return {"message": f"Created {len(analyses_created)} new analyses", "analyses": analyses_created}

@api_router.get("/dashboard/summary")
async def get_dashboard_summary():
    """Get dashboard summary statistics"""
    campaigns = await db.campaigns.find().to_list(1000)
    analyses = await db.analyses.find().to_list(1000)
    
    if not campaigns:
        return {
            "total_campaigns": 0,
            "total_spend": 0,
            "total_revenue": 0,
            "avg_roi": 0,
            "total_analyses": 0,
            "avg_score": 0
        }
    
    total_spend = sum(c.get('spend', 0) for c in campaigns)
    total_revenue = sum(c.get('revenue', 0) for c in campaigns)
    avg_roi = ((total_revenue - total_spend) / total_spend * 100) if total_spend > 0 else 0
    avg_score = sum(a.get('overall_score', 0) for a in analyses) / len(analyses) if analyses else 0
    
    return {
        "total_campaigns": len(campaigns),
        "total_spend": total_spend,
        "total_revenue": total_revenue,
        "avg_roi": avg_roi,
        "total_analyses": len(analyses),
        "avg_score": avg_score
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()