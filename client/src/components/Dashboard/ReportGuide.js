import React, { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  CpuChipIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  LinkIcon,
  CodeBracketIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────
// SUB-COMPONENTS  (must be defined before SECTIONS)
// ─────────────────────────────────────────────
const Row = ({ label, value, color, bg = 'bg-gray-50' }) => (
  <div className={`rounded-lg p-2.5 ${bg}`}>
    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
    <p className={`text-xs leading-relaxed ${color}`}>{value}</p>
  </div>
);

const SignalCard = ({ name, weight, icon: Icon, what, why, how }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${open ? 'border-blue-200 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
      <button
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-gray-100 p-1.5 rounded-lg">
            <Icon className="h-4 w-4 text-gray-600" />
          </div>
          <span className="text-sm font-semibold text-gray-800">{name}</span>
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">{weight}</span>
        </div>
        {open ? <ChevronUpIcon className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3 bg-white">
          <Row label="What it checks" value={what} color="text-gray-700" />
          <Row label="Why it matters" value={why} color="text-amber-700" bg="bg-amber-50" />
          <Row label="How to fix it" value={how} color="text-green-700" bg="bg-green-50" />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────
const SCORE_RANGES = [
  { label: 'Excellent', range: '90–100%', color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-200', desc: 'Outstanding AI readiness. Your site is highly optimised for answer engines.' },
  { label: 'Good', range: '75–89%', color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', desc: 'Strong optimisation. A few gaps remain but your site performs well in AI search.' },
  { label: 'Fair', range: '60–74%', color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', desc: 'Room for improvement. Key signals are missing that reduce your AI citation potential.' },
  { label: 'Poor', range: '40–59%', color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', desc: 'Needs attention. Multiple critical signals are failing, limiting AI discoverability.' },
  { label: 'Critical', range: '0–39%', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200', desc: 'Immediate action required. Your site is largely invisible to AI answer engines.' },
];

const SECTIONS = [
  {
    id: 'scoring',
    icon: ChartBarIcon,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    title: 'How Scoring Works',
    subtitle: 'Weighted multi-signal methodology',
    content: (
      <div className="space-y-4">
        <p className="text-gray-600 text-sm leading-relaxed">
          The AEO score is a weighted composite of three signal categories. Each category contributes a fixed percentage to the overall score.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'LLM Brand Signals', weight: '40%', color: 'bg-purple-500', desc: 'How visible your brand is in AI-generated answers' },
            { label: 'Domain Signals', weight: '30%', color: 'bg-blue-500', desc: 'Technical files that guide AI crawlers (robots.txt, llms.txt, sitemap)' },
            { label: 'Site Signals', weight: '30%', color: 'bg-green-500', desc: 'On-page quality: structured data, canonical URLs, social meta tags' },
          ].map(c => (
            <div key={c.label} className="border border-gray-200 rounded-xl p-4 text-center">
              <div className={`inline-block text-white text-xl font-black px-3 py-1 rounded-lg mb-2 ${c.color}`}>{c.weight}</div>
              <p className="text-xs font-bold text-gray-800 mb-1">{c.label}</p>
              <p className="text-xs text-gray-500">{c.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          Within each category, individual signals carry their own sub-weights. For example, within Domain Signals, <strong>AI Crawler Access</strong> is weighted at 4 points while <strong>Robots.txt Exists</strong> is 3 points.
        </p>
      </div>
    ),
  },
  {
    id: 'domain',
    icon: GlobeAltIcon,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Domain Signals',
    subtitle: '30% of total score — technical domain-level files',
    content: (
      <div className="space-y-3">
        <p className="text-gray-600 text-sm">Domain signals evaluate the configuration files at the root of your domain that tell AI crawlers and search engines how to interact with your site.</p>
        {[
          {
            name: 'LLM.txt Exists', weight: '4 pts', icon: DocumentTextIcon,
            what: 'A plain-text file at /llms.txt that provides a concise, AI-friendly summary of your site.',
            why: 'AI assistants like ChatGPT and Claude read this file to understand your brand before answering user queries about you.',
            how: 'Create /llms.txt with your brand name, key offerings, target audience, and unique value proposition in plain markdown.',
          },
          {
            name: 'LLM.txt Valid', weight: '3 pts', icon: DocumentTextIcon,
            what: 'The file exists as plain text (not HTML) and is accessible.',
            why: 'A malformed or HTML llms.txt cannot be parsed by language models.',
            how: 'Ensure the file returns Content-Type: text/plain and contains no HTML tags.',
          },
          {
            name: 'LLM.txt Enriched', weight: '3 pts', icon: DocumentTextIcon,
            what: 'The file uses markdown formatting: headings (H1/H2), bullet lists, bold text, and colons for structured information.',
            why: 'Richer markdown gives models more structured context, improving citation quality.',
            how: 'Use ## headings for sections like About, Products, Key Facts. Add bullet lists and bold key terms.',
          },
          {
            name: 'Robots.txt Exists', weight: '3 pts', icon: ShieldCheckIcon,
            what: 'A robots.txt file exists at the domain root.',
            why: 'Without it, crawlers have no guidance on what to index. AI crawlers may avoid or mis-index your site.',
            how: 'Create /robots.txt with explicit Allow/Disallow rules and a Sitemap declaration.',
          },
          {
            name: 'AI Crawler Access', weight: '4 pts', icon: CpuChipIcon,
            what: 'Critical paths (product, category, service pages) are accessible to AI crawlers: GPTBot, Google-Extended, ClaudeBot, PerplexityBot.',
            why: 'Blocking AI crawlers from important pages means they cannot learn your content and will not cite you.',
            how: 'Review robots.txt for User-agent rules that block GPTBot, ClaudeBot, etc. from key paths.',
          },
          {
            name: 'Search Crawler Access', weight: '4 pts', icon: MagnifyingGlassIcon,
            what: 'Critical paths are accessible to Googlebot and Bingbot.',
            why: 'AI answer engines frequently pull from indexed content. If search bots cannot crawl you, AI models see less of your content.',
            how: 'Ensure Googlebot and Bingbot are not blocked on product/service/category paths.',
          },
          {
            name: 'Sitemap Exists', weight: '3 pts', icon: LinkIcon,
            what: 'A sitemap (XML) is declared in robots.txt or found at a standard path.',
            why: 'Sitemaps help AI and search crawlers discover all your pages systematically.',
            how: 'Generate an XML sitemap and add Sitemap: https://yourdomain.com/sitemap.xml to robots.txt.',
          },
          {
            name: 'Sitemap Type Valid', weight: '3 pts', icon: LinkIcon,
            what: 'The sitemap is a valid XML urlset or sitemapindex format.',
            why: 'Malformed sitemaps are ignored by crawlers.',
            how: 'Validate your sitemap at https://www.xml-sitemaps.com/validate-xml-sitemap.html',
          },
          {
            name: 'Sitemap Freshness', weight: '3 pts', icon: LinkIcon,
            what: 'Sitemap URLs include <lastmod> dates indicating recent updates.',
            why: 'Fresh lastmod dates signal active, maintained content — prioritised by crawlers.',
            how: 'Configure your CMS to update lastmod on every page save/publish.',
          },
        ].map(sig => <SignalCard key={sig.name} {...sig} />)}
      </div>
    ),
  },
  {
    id: 'site',
    icon: CodeBracketIcon,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    title: 'Site Signals',
    subtitle: '30% of total score — on-page technical quality',
    content: (
      <div className="space-y-3">
        <p className="text-gray-600 text-sm">Site signals are collected by crawling your pages and evaluating on-page technical quality that affects how AI engines understand and extract your content.</p>
        {[
          {
            name: 'Site Scrapable', weight: '6 pts', icon: GlobeAltIcon,
            what: 'The crawler can successfully fetch and read page content.',
            why: 'If your site cannot be scraped, all other on-page signals score zero. JavaScript-heavy sites (React, Vue, Angular) require rendering.',
            how: 'Ensure server-side rendering or pre-rendering is available. Avoid blocking ScraperAPI/common user agents in robots.txt.',
          },
          {
            name: 'Canonical URL Exists', weight: '4 pts', icon: LinkIcon,
            what: 'Each crawled page has a <link rel="canonical"> tag.',
            why: 'Without canonicals, AI crawlers may index duplicate content and dilute your authority.',
            how: 'Add <link rel="canonical" href="https://yourdomain.com/page"> to every page\'s <head>.',
          },
          {
            name: 'Canonical Matches URL', weight: '3 pts', icon: LinkIcon,
            what: 'The canonical URL matches the actual page URL.',
            why: 'Mismatched canonicals confuse crawlers and can cause the wrong URL to be indexed.',
            how: 'Ensure canonical tags dynamically reflect the current page URL, not a hardcoded value.',
          },
          {
            name: 'Canonical Clean', weight: '3 pts', icon: LinkIcon,
            what: 'The canonical URL has no query parameters or tracking parameters.',
            why: 'Clean canonicals prevent parameter variants from being treated as separate pages.',
            how: 'Strip UTM params and session IDs from canonical URLs. Use parameter handling in Google Search Console.',
          },
          {
            name: 'JSON-LD Schema Exists', weight: '3 pts', icon: CodeBracketIcon,
            what: 'Site-type-specific JSON-LD structured data schemas are present (e.g., Product, Organization, FAQPage for ecommerce).',
            why: 'Structured data is how AI engines extract factual, structured information about your products, services, and brand.',
            how: 'Add JSON-LD scripts to relevant pages. Use Google\'s Rich Results Test to validate.',
          },
          {
            name: 'JSON-LD Schema Valid', weight: '3 pts', icon: CodeBracketIcon,
            what: 'The JSON-LD schemas contain all required fields (e.g., Product needs name, description, image, price).',
            why: 'Incomplete schemas are partially ignored. A Product without a price is not actionable for AI.',
            how: 'Audit each schema type against its required fields. See schema.org for specifications.',
          },
          {
            name: 'Open Graph Tags Exist', weight: '3 pts', icon: PhotoIcon,
            what: 'Pages include og:title, og:description, and og:image meta tags.',
            why: 'Open Graph tags are widely used by AI tools and LLMs as a quick source of page metadata when structured data is absent.',
            how: 'Add <meta property="og:title">, og:description, og:image, og:type, og:url to your <head>.',
          },
          {
            name: 'Open Graph Tags Complete', weight: '2 pts', icon: PhotoIcon,
            what: 'All five OG fields are present: og:title, og:description, og:image, og:type, og:url.',
            why: 'Complete OG data gives AI tools a full content snapshot without crawling the page.',
            how: 'Ensure your CMS or meta tag plugin populates all five OG properties on every page.',
          },
          {
            name: 'Twitter Card Exists', weight: '1 pt', icon: PhotoIcon,
            what: 'A twitter:card meta tag is present.',
            why: 'Twitter Card tags improve snippet extraction for AI tools and social platforms.',
            how: 'Add <meta name="twitter:card" content="summary_large_image"> plus twitter:title and twitter:image.',
          },
          {
            name: 'Page Indexable', weight: '2 pts', icon: ShieldCheckIcon,
            what: 'Pages do not have <meta name="robots" content="noindex"> set.',
            why: 'A noindex page is invisible to all search and AI crawlers — it cannot be cited.',
            how: 'Audit pages for noindex tags. Only set noindex on pages you intentionally want hidden (login, checkout, etc.).',
          },
        ].map(sig => <SignalCard key={sig.name} {...sig} />)}
      </div>
    ),
  },
  {
    id: 'llm',
    icon: CpuChipIcon,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    title: 'LLM Brand Signals',
    subtitle: '40% of total score — AI citation & brand visibility',
    content: (
      <div className="space-y-3">
        <p className="text-gray-600 text-sm">LLM signals measure how visible and prominent your brand is when AI answer engines (ChatGPT, Perplexity, Gemini) respond to queries in your category.</p>
        {[
          {
            name: 'Cluster Presence', weight: '12 pts', icon: UserGroupIcon,
            what: 'Whether your brand appears in at least one AI response across each topic cluster.',
            why: 'If AI models never mention you in a category of queries, you have zero presence in that topic cluster.',
            how: 'Create authoritative content targeting each cluster\'s intent. Build citations from high-authority sources in each topic.',
          },
          {
            name: 'Cluster Dominance', weight: '12 pts', icon: TrophyIcon,
            what: 'Whether your brand is mentioned more frequently than competitors within each cluster.',
            why: 'Being present is not enough — dominance (higher citation frequency) drives more AI-generated referrals.',
            how: 'Invest in thought leadership content, media coverage, and external citations for your key topic clusters.',
          },
          {
            name: 'Prompt Citation', weight: '16 pts', icon: ArrowTrendingUpIcon,
            what: 'How often your brand is cited across individual AI prompts vs. competitors (Share of Voice %).',
            why: 'This is the most direct measure of AI answer engine visibility — your brand\'s percentage share of all AI mentions in your category.',
            how: 'Monitor and improve brand mentions in industry publications, reviews, and Q&A sites that LLMs train on.',
          },
        ].map(sig => <SignalCard key={sig.name} {...sig} />)}

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mt-2">
          <p className="text-xs font-bold text-purple-800 mb-2 uppercase tracking-wide">Key Metrics Explained</p>
          <div className="space-y-2">
            {[
              { term: 'Share of Voice (SOV)', def: 'Your brand\'s citation count ÷ total citations across all brands × 100. Higher = more dominant in AI answers.' },
              { term: 'Citation Count', def: 'Raw number of AI prompts where your brand was mentioned at least once.' },
              { term: 'Cluster Coverage', def: 'Percentage of topic clusters where your brand appeared in at least one response. Measures breadth of AI visibility.' },
              { term: 'Intent Clusters', def: 'Groups of semantically related queries (e.g., "best running shoes under $100", "top athletic footwear brands"). Each cluster tests a different angle of brand awareness.' },
              { term: 'Competitor Benchmark', def: 'Side-by-side comparison of your SOV, citations, and cluster coverage vs. AI-identified competitors in your category.' },
            ].map(({ term, def }) => (
              <div key={term} className="flex gap-2">
                <span className="text-purple-700 font-semibold text-xs w-40 flex-shrink-0">{term}</span>
                <span className="text-purple-600 text-xs">{def}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'dashboard',
    icon: ChartBarIcon,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    title: 'Dashboard Sections',
    subtitle: 'What each part of the report shows',
    content: (
      <div className="space-y-3">
        {[
          { name: 'Score Overview', icon: StarIcon, desc: 'The headline AEO percentage — your weighted composite score across all three signal categories. Shows the raw score (positive checks / total checks) and the weighted score.' },
          { name: 'Executive Summary', icon: DocumentTextIcon, desc: 'High-level stats: total checks run, critical issues found, brand SOV, and a narrative overview of your site\'s AEO health.' },
          { name: 'Competitor Comparison', icon: TrophyIcon, desc: 'Bar chart and table comparing your brand\'s AI Share of Voice, citations, and cluster coverage against all AI-identified competitors. "YOU" badge marks your row.' },
          { name: 'LLM Analysis / Intent Clusters', icon: CpuChipIcon, desc: 'Breakdown of each intent cluster: the specific AI prompts tested, whether your brand was mentioned, and which competitors appeared alongside you.' },
          { name: 'Signal Type Performance', icon: ChartBarIcon, desc: 'A radar-style breakdown showing how each signal category performed, making it easy to spot your weakest area at a glance.' },
          { name: 'Domain / Site Panels', icon: GlobeAltIcon, desc: 'Card-level detail for each signal: pass/fail status, what was found, and the specific remediation action needed.' },
          { name: 'Quick Remediations', icon: CheckCircleIcon, desc: 'Prioritised action list sorted by impact. Each item shows the signal, the problem, and the exact step to fix it.' },
          { name: 'Top Issues', icon: XCircleIcon, desc: 'The signals with the most negative impact on your score, ranked. Fix these first for the biggest score improvement.' },
          { name: 'Audit History & Trends', icon: ArrowTrendingUpIcon, desc: 'Automatically saved to your browser. Shows score trend over time across multiple audits, with +/- delta vs. the previous run.' },
          { name: 'PDF Report', icon: DocumentTextIcon, desc: 'Exports a multi-section PDF with executive summary, score overview, competitor benchmark, market analysis, signal compliance, and remediation strategy. Toggle "Ungated" to include all sections.' },
        ].map(({ name, icon: Icon, desc }) => (
          <div key={name} className="flex gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="bg-indigo-50 p-2 rounded-lg flex-shrink-0 h-8 w-8 flex items-center justify-center">
              <Icon className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{name}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

// ─────────────────────────────────────────────
// SECTION ACCORDION
// ─────────────────────────────────────────────
const Section = ({ section }) => {
  const [open, setOpen] = useState(true);
  const Icon = section.icon;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${section.iconBg}`}>
            <Icon className={`h-5 w-5 ${section.iconColor}`} />
          </div>
          <div>
            <p className="font-bold text-gray-900">{section.title}</p>
            <p className="text-xs text-gray-500">{section.subtitle}</p>
          </div>
        </div>
        {open
          ? <ChevronUpIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
          : <ChevronDownIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          {section.content}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
const ReportGuide = () => (
  <div className="space-y-6 max-w-4xl mx-auto">
    {/* Hero */}
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
      <div className="flex items-start gap-4">
        <div className="bg-white/20 p-3 rounded-xl">
          <InformationCircleIcon className="h-8 w-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black mb-1">About This Report</h2>
          <p className="text-blue-100 text-sm leading-relaxed max-w-2xl">
            This AEO (Answer Engine Optimization) audit measures how well your website and brand are optimised to appear in AI-generated answers from ChatGPT, Perplexity, Google AI Overviews, Claude, and other LLM-powered search tools.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {['Domain Signals', 'Site Signals', 'LLM Brand Visibility', 'Competitor Benchmarking', 'Audit History'].map(t => (
              <span key={t} className="text-xs bg-white/20 px-3 py-1 rounded-full font-medium">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Score Ranges */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      <p className="font-bold text-gray-900 mb-3">Score Ranges</p>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {SCORE_RANGES.map(r => (
          <div key={r.label} className={`border rounded-xl p-3 text-center ${r.bg}`}>
            <div className={`inline-block w-3 h-3 rounded-full ${r.color} mb-1.5`} />
            <p className={`text-sm font-black ${r.text}`}>{r.label}</p>
            <p className={`text-xs font-bold ${r.text} opacity-80 mb-1`}>{r.range}</p>
            <p className="text-xs text-gray-500 leading-tight">{r.desc}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Sections */}
    {SECTIONS.map(s => <Section key={s.id} section={s} />)}

    {/* Footer note */}
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
      <p className="text-xs text-gray-500">
        Scores and signals are recalculated fresh on every audit run. Results may vary slightly as AI model behaviour changes over time.
        For best results, run audits monthly and track improvement using the <strong>Audit History</strong> section.
      </p>
    </div>
  </div>
);

export default ReportGuide;
