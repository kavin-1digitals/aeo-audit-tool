"""
FastAPI application for AEO (Answer Engine Optimization) audit tool
Exposes the audit functionality as a REST API
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from datetime import datetime, timedelta
import uuid
import asyncio
import logging
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

from src.signals import find_signals
from src.scorecard import create_aeo_scorecard, Score, RawScoreCard, ScoreCard, ProblemCard
from src.signals import Signals
from src.summary import generate_summary, Summary

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Simple in-memory cache with TTL
class AuditCache:
    def __init__(self, ttl_minutes: int = 30):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = timedelta(minutes=ttl_minutes)
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        if key in self.cache:
            entry = self.cache[key]
            if datetime.now() < entry['expires']:
                logger.info(f"Cache hit for key: {key}")
                return entry['data']
            else:
                # Remove expired entry
                del self.cache[key]
                logger.info(f"Cache expired for key: {key}")
        return None
    
    def set(self, key: str, data: Dict[str, Any]) -> None:
        self.cache[key] = {
            'data': data,
            'expires': datetime.now() + self.ttl,
            'created': datetime.now()
        }
        logger.info(f"Cached data for key: {key} (expires in {self.ttl.total_seconds()} seconds)")
    
    def clear(self) -> None:
        self.cache.clear()
        logger.info("Cache cleared")
    
    def size(self) -> int:
        return len(self.cache)

# Initialize cache
audit_cache = AuditCache(ttl_minutes=30)

# FastAPI app
app = FastAPI(
    title="AEO Audit API",
    description="Answer Engine Optimization audit tool for GenAI engines",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class AuditRequest(BaseModel):
    domain: HttpUrl
    brand: str
    geo: Optional[str] = "Not Specified"
    site_type: Optional[str] = "ecommerce"  # Added site type field


class AuditResponse(BaseModel):
    task_id: str
    domain: str
    brand: str
    geo: Optional[str] = "Not Specified"
    status: str
    message: str
    signals: Optional[Signals] = None
    scorecard: ScoreCard
    problemcard: Optional[ProblemCard] = None
    summary: Summary
    quick_remediations: Optional[Dict[str, Any]] = None

def create_cache_key(domain: str, brand: Optional[str], geo: Optional[str], site_type: Optional[str] = None) -> str:
    """Create a unique cache key based on audit parameters"""
    key_parts = [domain.lower()]
    if brand:
        key_parts.append(brand.lower())
    if geo:
        key_parts.append(geo.lower())
    if site_type:
        key_parts.append(site_type.lower())
    return "|".join(key_parts)

# API Endpoints
@app.get("/aeo-audit-tool/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/aeo-audit-tool/api/cache/stats")
async def cache_stats():
    """Get cache statistics"""
    return {
        "cache_size": audit_cache.size(),
        "ttl_minutes": audit_cache.ttl.total_seconds() / 60
    }

@app.post("/aeo-audit-tool/api/cache/clear")
async def clear_cache():
    """Clear the audit cache"""
    audit_cache.clear()
    return {"message": "Cache cleared successfully"}

@app.post("/aeo-audit-tool/api/audit", response_model=AuditResponse)
async def start_audit(request: AuditRequest):
    """Start and complete an AEO audit for a domain synchronously"""
    try:
        # Generate task ID
        task_id = str(uuid.uuid4())
        domain_str = str(request.domain).rstrip('/')
        
        logger.info(f"Starting audit task {task_id} for domain {domain_str}")
        
        # Create cache key
        cache_key = create_cache_key(domain_str, request.brand, request.geo, request.site_type)
        
        # Check cache first
        cached_result = audit_cache.get(cache_key)
        if cached_result:
            logger.info(f"Returning cached result for {cache_key}")
            return AuditResponse(**cached_result)
        
        try:
            # Process audit synchronously
            logger.info(f"Fetching signals for {domain_str}")
            if request.brand:
                logger.info(f"Running LLM signals analysis for brand: {request.brand}")
                try:
                    signals = await find_signals(domain_str, request.brand, request.geo, request.site_type)
                    logger.info("LLM signals analysis completed successfully")
                except Exception as llm_error:
                    logger.warning(f"LLM signals failed, falling back to basic signals: {str(llm_error)}")
                    signals = await find_signals(domain_str, site_type=request.site_type)
            else:
                logger.info("Skipping LLM signals - no brand provided")
                signals = await find_signals(domain_str, site_type=request.site_type)
            
            scorecard, problemcard = await create_aeo_scorecard(signals, request.brand, request.site_type)
            
            # Generate quick remediations
            from src.services.quick_remediations_service import generate_quick_remediations
            quick_remediations = generate_quick_remediations(scorecard.model_dump())
            
            # Generate summary
            summary = generate_summary(scorecard)
            
            result = AuditResponse(
                task_id=task_id,
                status="completed",
                message="Audit completed successfully",
                domain=domain_str,
                brand=request.brand,
                geo=request.geo,
                signals=signals,
                scorecard=scorecard,
                problemcard=problemcard,
                summary=summary,
                quick_remediations=quick_remediations.model_dump() if quick_remediations else None
            )
            
            # Cache the result
            audit_cache.set(cache_key, result.model_dump())
            
            return result
            
        except Exception as e:
            logger.error(f"Audit failed for task {task_id}: {str(e)}")
            
            return AuditResponse(
                task_id=task_id,
                status="failed",
                message=f"Audit failed: {str(e)}",
                domain=domain_str,
                brand=request.brand,
                geo=request.geo,
                signals=None,
                scorecard=ScoreCard(
                    raw_scorecard=RawScoreCard(scores=[]),
                    path_scorecard={},
                    total_checks=0,
                    total_score=0.0,
                    total_percentage=0.0
                ),
                problemcard=ProblemCard(problems=[]),
                summary=Summary(
                    performance_highlights=[],
                    improvement_areas=[f"Audit failed: {str(e)}"]
                )
            )
        
    except Exception as e:
        logger.error(f"Failed to start audit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start audit: {str(e)}")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3003)
