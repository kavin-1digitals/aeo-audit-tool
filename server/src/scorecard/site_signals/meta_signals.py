from typing import List
from src.signals.site_signals import SiteSignal
from src.scorecard import Score, RawScoreCard


async def calculate_meta_score(site_signals: List[SiteSignal]) -> RawScoreCard:
    scores = []

    og_checked = False
    twitter_checked = False

    for signal in site_signals:
        meta = signal.meta_signal
        if not meta:
            continue

        # Score OG tags once (homepage / first page that has any)
        if not og_checked:
            if meta.og_exists:
                og_checked = True
                scores.append(Score(
                    value=1.0,
                    signal_name='og_tags_exists',
                    signal_path=['Site Signals', 'Social & Meta'],
                    success_state='Open Graph tags found'
                ))
                scores.append(Score(
                    value=1.0 if meta.og_complete else -1.0,
                    signal_name='og_tags_complete',
                    signal_path=['Site Signals', 'Social & Meta'],
                    success_state='Open Graph tags are complete (title, description, image, type, url)' if meta.og_complete else None,
                    remediation_plan='Complete Open Graph tags: add og:title, og:description, og:image, og:type, og:url' if not meta.og_complete else None
                ))
            else:
                og_checked = True
                scores.append(Score(
                    value=-1.0,
                    signal_name='og_tags_exists',
                    signal_path=['Site Signals', 'Social & Meta'],
                    remediation_plan='Add Open Graph meta tags (og:title, og:description, og:image) for better AI and social sharing visibility'
                ))
                scores.append(Score(
                    value=-1.0,
                    signal_name='og_tags_complete',
                    signal_path=['Site Signals', 'Social & Meta'],
                    remediation_plan='Add complete Open Graph meta tags including og:title, og:description, og:image, og:type, og:url'
                ))

        # Score Twitter Card once
        if not twitter_checked:
            twitter_checked = True
            if meta.twitter_card_exists:
                scores.append(Score(
                    value=1.0,
                    signal_name='twitter_card_exists',
                    signal_path=['Site Signals', 'Social & Meta'],
                    success_state=f'Twitter Card tag found: {meta.twitter_card}'
                ))
            else:
                scores.append(Score(
                    value=-1.0,
                    signal_name='twitter_card_exists',
                    signal_path=['Site Signals', 'Social & Meta'],
                    remediation_plan='Add twitter:card meta tag to improve sharing on X/Twitter and AI snippet extraction'
                ))

        # Score indexability per page
        if meta.is_noindex:
            scores.append(Score(
                value=-1.0,
                signal_name='page_indexable',
                signal_path=['Site Signals', 'Indexability'],
                remediation_plan=f'Page {signal.url} has noindex — AI crawlers may skip it. Remove noindex unless intentional'
            ))
        else:
            scores.append(Score(
                value=1.0,
                signal_name='page_indexable',
                signal_path=['Site Signals', 'Indexability'],
                success_state=f'Page {signal.url} is indexable'
            ))

        if og_checked and twitter_checked:
            # Only check indexability for remaining pages — OG/Twitter only once
            pass

    return RawScoreCard(scores=scores)
