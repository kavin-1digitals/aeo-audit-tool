from pydantic import BaseModel, computed_field
from src.signals.domain_signals.sitemap_signals import SiteMapSignals
from src.scorecard import Score, RawScoreCard
from src.config import SITEMAP_CATEGORY_COUNTS
from typing import Optional, List
from datetime import datetime, timedelta

async def calculate_sitemap_score(sitemap_signal: SiteMapSignals):
    sitemap = sitemap_signal.sitemap
    category_urls = sitemap_signal.category_urls
    last_updated = sitemap_signal.last_updated
    
    scores = []
    
    # Rule 1: Sitemap existence
    if sitemap.exists:
        scores.append(Score(value=1.0, signal_name='sitemap_exists', signal_path=['Domain Signals', 'Sitemap'], remediation_plan=None, success_state='Sitemap file successfully found and accessible. This helps search engines discover all your important pages and understand your website structure for better indexing.'))
    else:
        scores.append(Score(value=-1.0, signal_name='sitemap_exists', signal_path=['Domain Signals', 'Sitemap'], remediation_plan='Create and upload an XML sitemap file to your website root directory. This file should list all important pages of your website to help search engines discover and index your content efficiently. Use tools like Screaming Frog or online sitemap generators to create a comprehensive sitemap.', success_state=None))
    
    # Rule 2: Sitemap type validation
    if sitemap.exists and sitemap.type_:
        if sitemap.type_ in ['unknown', 'invalid']:
            scores.append(Score(value=-1.0, signal_name='sitemap_type_valid', signal_path=['Domain Signals', 'Sitemap'], remediation_plan=f'Fix sitemap structure - current type: {sitemap.type_}. Ensure your sitemap follows XML sitemap protocol with proper namespace, URL tags, and required elements. Use sitemap validation tools to identify and fix structural issues.', success_state=None))
        else:
            scores.append(Score(value=1.0, signal_name='sitemap_type_valid', signal_path=['Domain Signals', 'Sitemap'], remediation_plan=None, success_state=f'Sitemap has valid structure with type: {sitemap.type_}. This ensures search engines can properly parse and process your sitemap for efficient indexing.'))
    else:
        # If sitemap doesn't exist, no type validation needed
        pass
    
    # Rule 3: Category wise mark for requested numbers
    if category_urls:
        for category_url in category_urls:
            category = category_url.category
            if category != 'homepage':
                url_count = len(category_url.urls)
                
                scores.append(Score(value=url_count/SITEMAP_CATEGORY_COUNTS.get(category, 10), signal_name='category_url_count', signal_path=['Domain Signals', 'Sitemap'], remediation_plan=None, success_state=f'Category {category}: {url_count} URLs found'))
    else:
        # If no categories found, it's a negative score
        if sitemap.exists:
            scores.append(Score(value=-1.0, signal_name='category_url_count', signal_path=['Domain Signals', 'Sitemap'], remediation_plan='Add categorized URLs to sitemap', success_state=None))
    
    # Rule 4: Last updated in less than a week +1, else -1 if found else -0.5
    if last_updated:
        # Ensure both datetimes are timezone-aware or timezone-naive
        from datetime import timezone
        now = datetime.now(timezone.utc) if last_updated.tzinfo else datetime.now()
        week_ago = now - timedelta(days=7)
        
        if last_updated >= week_ago:
            scores.append(Score(value=1.0, signal_name='sitemap_freshness', signal_path=['Domain Signals', 'Sitemap'], remediation_plan=None, success_state=f'Sitemap updated recently: {last_updated.date()}'))
        else:
            scores.append(Score(value=-1.0, signal_name='sitemap_freshness', signal_path=['Domain Signals', 'Sitemap'], remediation_plan=f'Update sitemap - last updated: {last_updated.date()}', success_state=None))
    else:
        # If no last_updated found, score -0.5
        if sitemap.exists:
            scores.append(Score(value=-0.5, signal_name='sitemap_freshness', signal_path=['Domain Signals', 'Sitemap'], remediation_plan='Add lastmod dates to sitemap URLs', success_state=None))
    
    return RawScoreCard(scores=scores)