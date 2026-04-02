from src.signals.domain_signals.llms_txt_signals import LlmsTxtSignals
from src.scorecard import Score, RawScoreCard, ProblemCard, Problem

async def calculate_llms_txt_score(llms_txt_signal: LlmsTxtSignals):
    if not llms_txt_signal.status:
        return RawScoreCard(scores=[]), ProblemCard(problems=[Problem(
            signal_names=['llms_txt_exists', 'llms_txt_valid','llms_txt_enriched'],
            signal_path=['Domain Signals', 'LLMs.txt'],
            issue_found=llms_txt_signal.issue_found,
            cause_of_issue=llms_txt_signal.cause_of_issue
        )])


    scores = []
    llms_signal = llms_txt_signal.llm_txts

    # -------------------------
    # Rule 1: llms.txt exists
    # -------------------------
    if llms_signal.exists:
        scores.append(
            Score(
                value=1.0,
                signal_name='llms_txt_exists',
                signal_path=['Domain Signals', 'LLMs.txt'],
                remediation_plan=None,
                success_state='llms.txt file successfully found and accessible at your domain root. This file provides structured guidance to AI crawlers and LLM systems about your content priorities, brand information, and AI interaction guidelines, significantly improving your AI visibility and representation.'
            )
        )
    else:
        scores.append(
            Score(
                value=-1.0,
                signal_name='llms_txt_exists',
                signal_path=['Domain Signals', 'LLMs.txt'],
                remediation_plan='Create a /llms.txt file at your root domain (e.g., https://yourdomain.com/llms.txt). This file should contain structured information about your brand, content priorities, AI interaction guidelines, and key business information. Use plain text or markdown format with clear sections like "Brand Information", "Content Priorities", and "AI Guidelines". This file is essential for proper AI crawler understanding and representation.',
                success_state=None
            )
        )

    # -------------------------
    # Rule 2: llms.txt is valid (non-HTML text)
    # -------------------------
    # if llms_signal.exists: commented for now
    if llms_signal.is_valid:
        scores.append(
            Score(
                value=1.0,
                signal_name='llms_txt_valid',
                signal_path=['Domain Signals', 'LLMs.txt'],
                remediation_plan=None,
                success_state='llms.txt returns valid text-based content (plain text or markdown) rather than an HTML fallback page. This ensures AI crawlers can properly parse and understand your structured guidance without HTML markup interference, enabling accurate content interpretation and brand representation.'
            )
        )
    else:
        scores.append(
            Score(
                value=-1.0,
                signal_name='llms_txt_valid',
                signal_path=['Domain Signals', 'LLMs.txt'],
                remediation_plan='Fix your /llms.txt file to return plain text or markdown content instead of HTML. Check your web server configuration to ensure the file is served with correct MIME type (text/plain or text/markdown) and not redirected to an HTML error page. Remove any HTML markup and ensure the file contains only structured text content that AI crawlers can easily parse.',
                success_state=None
            )
        )

    # -------------------------
    # Rule 3: llms.txt enrichment (Markdown quality)
    # -------------------------
    # if llms_signal.exists and llms_signal.is_valid:   commented for now
    enriched = llms_signal.enriched

    enrichment_score = sum([
        enriched.has_h1,
        enriched.has_h2,
        enriched.has_list,
        enriched.has_bold,
        enriched.has_colon
    ])

    if enrichment_score > 3:
        scores.append(
            Score(
                value=1.0,
                signal_name='llms_txt_enriched',
                signal_path=['Domain Signals', 'LLMs.txt'],
                remediation_plan=None,
                success_state='llms.txt demonstrates excellent structure with rich Markdown formatting including headings, lists, and proper formatting. This high-quality structure significantly enhances AI crawler comprehension, enabling better content prioritization, accurate brand representation, and improved AI search visibility across multiple AI platforms and search engines.'
            )
        )

    else:
        scores.append(
            Score(
                value=-1.0,
                signal_name='llms_txt_enriched',
                signal_path=['Domain Signals', 'LLMs.txt'],
                remediation_plan='Restructure your llms.txt file with proper Markdown formatting to make it more useful for AI systems. Add hierarchical headings (# Main Title, ## Section Title), bullet points (- item) for lists, bold text (**key term**) for emphasis, and use colons for structured information (Brand: Company Name). This structured approach helps AI crawlers better understand your content priorities, brand information, and AI interaction guidelines, leading to improved AI representation and search visibility.',
                success_state=None
            )
        )

    return RawScoreCard(scores=scores), ProblemCard(problems=[])