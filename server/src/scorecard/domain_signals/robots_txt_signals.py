from pydantic import BaseModel, computed_field
from src.signals.domain_signals.robots_txt_signals import RobotsTxtSignals
from src.scorecard import Score, RawScoreCard

from typing import Optional, List

async def calculate_robots_txt_score(robots_txt_signal: RobotsTxtSignals):
    robots = robots_txt_signal.robots
    sitemaps = robots_txt_signal.sitemaps
    ai_crawlers = robots_txt_signal.ai_crawlers
    search_crawlers = robots_txt_signal.search_crawlers
    
    scores = []
    
    # Rule 1: Robots txt existence
    if robots.exists:
        scores.append(Score(value=1.0, signal_name='robots_txt_exists', signal_path=['Domain Signals', 'Robots.txt File'], remediation_plan=None, success_state='Robots.txt file successfully found and accessible. This file helps search engines and AI crawlers understand which parts of your site to crawl and index.'))
    else:
        if robots.status is not None:
            scores.append(Score(value=-1.0, signal_name='robots_txt_exists', signal_path=['Domain Signals', 'Robots.txt File'], remediation_plan='Create and upload a robots.txt file to your website root directory. This file should specify which areas search engines and AI crawlers can access, helping improve crawl efficiency and SEO performance.', success_state=None))
        else:
            scores.append(Score(value=0.0, signal_name='robots_txt_exists', signal_path=['Domain Signals', 'Robots.txt File'], remediation_plan='Robots.txt file URL is not accessible or returning errors. Check the file exists at yourdomain.com/robots.txt and fix any server configuration issues.', success_state=None))
    
    # Rule 2: Sitemap existence
    if sitemaps.exists:
        scores.append(Score(value=1.0, signal_name='sitemap_exists', signal_path=['Domain Signals', 'Robots.txt File'], remediation_plan=None, success_state='Sitemap URL successfully found in robots.txt. This helps search engines discover and index all your important pages efficiently.'))
    else:
        scores.append(Score(value=-1.0, signal_name='sitemap_exists', signal_path=['Domain Signals', 'Robots.txt File'], remediation_plan='Add your sitemap URL to robots.txt using "Sitemap: https://yourdomain.com/sitemap.xml". This helps search engines automatically discover your sitemap and improve indexing efficiency.', success_state=None))
    
    # Rule 3: Agent crawlers vs category path
    if ai_crawlers:
        for agent_access in ai_crawlers.agents:
            for category_access in agent_access.category_access:
                if category_access.is_accessible:
                    scores.append(Score(value=1.0, signal_name='ai_crawler_access', signal_path=['Domain Signals', 'Robots.txt File'], remediation_plan=None, success_state=f'AI crawler {agent_access.agent} successfully allowed to access {category_access.category}. This enables proper AI model training and content discovery for this section.'))
                else:
                    scores.append(Score(value=-1.0, signal_name='ai_crawler_access', signal_path=['Domain Signals', 'Robots.txt File'], remediation_plan=f'Allow AI crawler {agent_access.agent} to access {category_access.category} by updating your robots.txt. Add "User-agent: {agent_access.agent}" followed by "Allow: /{category_access.category}/" to enable AI model access to this content area.', success_state=None))
    else:
        # If no ai_crawlers data, no score applied (NA)
        pass
    
    # Rule 4: Search crawlers vs category path
    if search_crawlers:
        for agent_access in search_crawlers.agents:
            for category_access in agent_access.category_access:
                if category_access.is_accessible:
                    scores.append(Score(value=1.0, signal_name='search_crawler_access', signal_path=['Domain Signals', 'Robots.txt File'], remediation_plan=None, success_state=f'Search crawler {agent_access.agent} successfully allowed to access {category_access.category}. This ensures proper indexing and visibility in search results for this content section.'))
                else:
                    scores.append(Score(value=-1.0, signal_name='search_crawler_access', signal_path=['Domain Signals', 'Robots.txt File'], remediation_plan=f'Allow search crawler {agent_access.agent} to access {category_access.category} by updating your robots.txt. Add "User-agent: {agent_access.agent}" followed by "Allow: /{category_access.category}/" to ensure proper search engine indexing of this content area.', success_state=None))
    else:
        # If no search_crawlers data, no score applied (NA)
        pass
    
    return RawScoreCard(scores=scores)