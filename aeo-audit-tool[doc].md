# How the AEO Audit Works

## At a Glance

- Assistants such as ChatGPT now answer "what should I buy?" directly, and they name only a few brands. The tool measures how likely a brand is to be one of them.
- The audit asks three questions: **Can AI get into the website? Can AI understand it? Does AI say the brand's name?**
- Each question is tested with small checks. The final score runs from 0 to 100%, and each question carries a fixed share of it: **30% for getting in, 30% for understanding, 40% for being named.**
- A check that cannot be run, for example because the site blocks the tool, is **left out and not counted as a failure**. The result then shows how much of the 100% could be checked.
- A finished audit can be compared with up to five competitors, on the same checks and the same AI questions.

## Context

Search engines return a list of pages. An AI assistant returns one answer that names a handful of brands. Whether a brand is in that answer depends on two things: whether AI systems can read its website, and whether AI already associates the brand with the topic. The audit measures both. Making a brand visible in AI answers is called **AEO, Answer Engine Optimization**.

## Sample Input

All numbers in this document come from one invented business, **Maple Yoga**, an online shop that sells yoga clothing in the United States. Its owner runs an audit with these inputs:

| Input | Value |
|---|---|
| Website | `https://mapleyoga.com` |
| Brand name | `Maple Yoga` |
| Region | `United States` |
| Site type | `ecommerce` |

---

## The audit asks three questions

Every audit answers the same three questions about a website. Each question is a group of tests, and each group carries a fixed share of the final score.

```
 mapleyoga.com
      |
      |-- 1. Can AI get in? ............. files at the domain root ........ 30% of the score
      |-- 2. Can AI understand it? ...... a sample of the pages ............ 30% of the score
      '-- 3. Does AI say the name? ...... questions put to an AI model ..... 40% of the score
```

1. **Can AI get in?** The official name is **Domain Signals**. It looks at files at the root of the website, and carries **30%** of the score.
2. **Can AI understand it?** The official name is **Site Signals**. It reads a sample of the website's pages, and carries **30%** of the score.
3. **Does AI say the name?** The official name is **LLM Brand Analysis**. It puts customer questions to an AI model, and carries **40%** of the score.

The three shares add up to 100%, which is the whole score. A share of the score is called a **weight**. The third group has the largest weight because it is the outcome the first two are meant to produce.

Each group contains **signals** (22 in total), and each signal is tested by one or more **checks**, for example one check per page. The groups are collected at the same time, so the audit takes about as long as its slowest group, and a group that fails does not stop the other two.

---

## How the score is divided

The final score is a percentage out of 100%. It is divided in two levels, and each level has a fixed recipe.

```
 100% of the score
  |
  |-- Domain Signals ............................ weight 30%
  |     |-- AI crawlers allowed ................. weight 4%    16 checks
  |     |-- llms.txt file present ............... weight 4%    1 check
  |     '-- ... nine signals; their weights add up to 30%
  |
  |-- Site Signals .............................. weight 30%
  '-- LLM Brand Analysis ........................ weight 40%
```

**Level 1: the groups.** The score is split 30% / 30% / 40% between the three groups, as above.

**Level 2: the signals.** Inside a group, the group's share is split again between its signals. That share is the signal's **weight**. In the diagram, "AI crawlers allowed" has a weight of 4%. The weights of all 22 signals add up to 100%. Section R2 lists every one.

**Points belong to checks.** A signal is tested by one or more checks. Each check earns **1 point if it passes and 0 if it does not**.

**From points to weight earned.** A signal's **pass rate** is the points its checks earned divided by the number of checks. "AI crawlers allowed" has 16 checks. If 12 pass, the pass rate is 12 ÷ 16 = 75%. The signal then **earns that share of its weight**: 75% × 4% = **3.0%**.

**The score** is the weight earned across the signals, as a share of the weight that could be checked. When every signal can be checked, that is simply the total weight earned, a number between 0% and 100%. When a signal cannot be checked, it is left out of both sides of that fraction. "From many checks to one number" later in this document shows the full calculation.

---

## 1. Can AI get in? (Domain Signals, weight 30%)

Before reading any page, the tool asks the site for three standard files. Each file is a source of signals, and the 30% weight of this group is shared between the three files: 11% + 10% + 9% = 30%.

```
 Domain Signals ............................ weight 30%
  |
  |-- robots.txt ............................ 11%   the site's rules for automated visitors
  |     |-- robots.txt file present ......... 3%
  |     |-- AI crawlers allowed ............. 4%
  |     '-- Search crawlers allowed ......... 4%
  |
  |-- llms.txt .............................. 10%   a short guide written for AI systems
  |     |-- llms.txt file present ........... 4%
  |     |-- llms.txt readable as text ....... 3%
  |     '-- llms.txt well structured ........ 3%
  |
  '-- Sitemap ............................... 9%    the list of pages worth reading
        |-- Sitemap available ............... 3%
        |-- Sitemap structure valid ......... 3%
        '-- Sitemap updated within 7 days ... 3%
```

### robots.txt · weight 11%

The site's rules for automated visitors. It decides whether AI crawlers are allowed in.

| Signal | Weight | What is checked | Passes when | Fails or is left out when |
|---|---|---|---|---|
| robots.txt file present | 3% | A readable `/robots.txt` exists. | The file is found. | **Fails:** no file. **Left out:** the site blocks the request. |
| AI crawlers allowed | 4% | robots.txt lets in the AI crawlers GPTBot, Google-Extended, ClaudeBot and PerplexityBot. | A crawler can reach a page group (see below). | **Fails:** a crawler is shut out of a group. **Left out:** the site blocks the request. |
| Search crawlers allowed | 4% | robots.txt lets in the search crawlers Googlebot and Bingbot. | A crawler can reach a page group. | As above. |

**How the crawler checks are counted** (example: an online shop)

| Part | Detail |
|---|---|
| Page groups | Four: product, category, brand and info (about, contact, shipping, returns). |
| Paths tested per page name | `/name`, `/name/` and `/name/test`. |
| A group passes when | At least one of its paths is allowed. |
| One check | One crawler for one page group. |
| Number of checks | AI crawlers: 4 × 4 = **16**. Search crawlers: 2 × 4 = **8**. |
| Weight earned | The signal's weight × the share of checks that pass. |
| No robots.txt at all | Nothing is restricted, so every check passes. |

### llms.txt · weight 10%

A newer file: a short guide written for AI systems about what the site contains. If the site blocks the request, all three signals are left out of the score.

| Signal                    | Weight | What is checked                                            | Passes when                                                                                                   | Fails when                                                                                                      |
| ------------------------- | ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| llms.txt file present     | 4%     | A file named `/llms.txt` exists at the root of the site.   | The file is found.                                                                                            | No file.                                                                                                        |
| llms.txt readable as text | 3%     | The file is text, not a web page.                          | It is plain text or Markdown.                                                                                 | The file is missing, or it is a web page: it contains `<html` or `<!doctype html`, or is served as `text/html`. |
| llms.txt well structured  | 3%     | The text has the structure that helps AI systems parse it. | It contains at least **4 of 5 markers**: heading `#`, sub-heading `##`, list item `-` , bold `*`*, colon `:`. | Fewer than 4 markers.                                                                                           |

### Sitemap · weight 9%

The list of pages worth reading. It also shows that the content is maintained.

| Signal | Weight | What is checked | Passes when | Fails or is left out when |
|---|---|---|---|---|
| Sitemap available | 3% | **Two checks:** a sitemap address is declared in robots.txt, and a sitemap file can be fetched. | Each check is found. | **Fails:** nothing declared, or no valid sitemap file. |
| Sitemap structure valid | 3% | The top element of the file. | It is a URL list (`urlset`) or an index of sitemaps (`sitemapindex`). | **Fails:** any other type. **Left out:** no sitemap found. |
| Sitemap updated within 7 days | 3% | The newest "last modified" date, taken from the first 20 entries. For an index, from the first of its first 5 sitemaps that has dates. | The date is 7 days old or less. | **Fails:** older, or the sitemap has no dates. **Left out:** no sitemap found. |

**How the sitemap is found**

| Case | What the tool tries |
|---|---|
| robots.txt names a sitemap | Only that address. |
| robots.txt names none | `/sitemap.xml`, then `/sitemap_index.xml`, then `/siteindex.xml`. |
| A file counts when | It is valid XML. |

### How Maple Yoga scored

Maple Yoga has a robots.txt and a valid sitemap. The sitemap was last updated 12 days ago. It has no llms.txt. Its robots.txt shuts out one AI crawler, ClaudeBot, completely.

```
 ✓ all checks passed     ◐ some passed     ✗ none passed

 robots.txt     10.0% of 11%    █████████░
   ✓ robots.txt file present ........... 3.0% of 3%
   ◐ AI crawlers allowed ............... 3.0% of 4%    ClaudeBot fails 4 of the 16 checks
   ✓ Search crawlers allowed ........... 4.0% of 4%

 llms.txt        0.0% of 10%    ░░░░░░░░░░
   ✗ llms.txt file present ............. 0.0% of 4%    there is no such file
   ✗ llms.txt readable as text ......... 0.0% of 3%
   ✗ llms.txt well structured .......... 0.0% of 3%

 Sitemap         6.0% of 9%     ███████░░░
   ✓ Sitemap available ................. 3.0% of 3%
   ✓ Sitemap structure valid ........... 3.0% of 3%
   ✗ Sitemap updated within 7 days ..... 0.0% of 3%    last updated 12 days ago

 Domain Signals total     16.0% of 30%     category score 53.3%
```

The category score is the weight earned divided by the weight checked: 16.0 ÷ 30 = 53.3%. The 14% of the final score that Maple Yoga lost in this group shows what to fix, biggest first: the missing llms.txt (10%), the out-of-date sitemap (3%) and the blocked crawler (1%).

---

## 2. Can AI understand it? (Site Signals, weight 30%)

The tool opens a sample of the website's pages and reads the tags and data that tell AI systems what each page is. The 30% weight of this group is shared between four sources: 8% + 10% + 6% + 6% = 30%.

```
 Site Signals ................................ weight 30%
  |
  |-- Page access ............................ 8%    can the pages be fetched and read?
  |     |-- Pages can be crawled ............. 6%
  |     '-- Page allowed in search ........... 2%
  |
  |-- Canonical tag .......................... 10%   which address is the "real" one for a page
  |     |-- Canonical tag present ............ 4%
  |     |-- Canonical points to the page itself  3%
  |     '-- Canonical URL has no query parameters 3%
  |
  |-- Structured data (JSON-LD) .............. 6%    facts such as products and prices, in machine form
  |     |-- Expected structured data present . 3%
  |     '-- Structured data valid ............ 3%
  |
  '-- Sharing tags ........................... 6%    title, description and image for shared links
        |-- Open Graph tags present .......... 3%
        |-- Open Graph tags complete ......... 2%
        '-- Twitter/X card tag present ....... 1%
```

Ten signals in total. Each is described below under its source.

**How the pages are collected**

| Case | What the tool does |
|---|---|
| Normal site | Reads the homepage and up to **50** links from it, picked at random. |
| Script-driven site (content appears only through scripts) | Reads the homepage and up to **5** links, loaded through a rendering service so the scripts run. |
| How the kind is decided | Signs of React, Next.js, Vue, Angular or Svelte, very few links on the homepage, or more scripts than links. |
| Nothing can be fetched | The site is "not scrapable". "Pages can be crawled" fails and every other Site signal is left out. |

Everything in this group describes this sample of pages, not the whole site.

### Page access · weight 8%

Whether the pages can be fetched, and whether they are open to search.

| Signal | Weight | What is checked | Passes when | Fails when |
|---|---|---|---|---|
| Pages can be crawled | 6% | At least one page can be fetched and read. | A page is fetched and analysed. | No page could be fetched. This signal is never left out. |
| Page allowed in search | 2% | The robots meta tag of each page (one check per page). | It does not contain `noindex`. | It contains `noindex`. |

### Canonical tag · weight 10%

A canonical tag tells search and AI systems which address is the "real" one for a page, so duplicates are not treated as separate pages. One check per page for each signal.

| Signal | Weight | What is checked | Passes when | Fails when |
|---|---|---|---|---|
| Canonical tag present | 4% | The page has a canonical tag with an address. | The tag is found. | No tag. |
| Canonical points to the page itself | 3% | The canonical address against the page's own final address after redirects. Both are reduced to `scheme://host/path` without a trailing slash. | They are equal. | They differ, or there is no tag. |
| Canonical URL has no query parameters | 3% | The canonical address, for tracking parameters such as `?utm_source=`. | It contains no `?`. | It contains `?`, or there is no tag. |

### Structured data (JSON-LD) · weight 6%

Facts such as products, prices and ratings, written in a form machines read reliably. The tool reads every JSON-LD block on a page, including those inside `@graph`, and matches them on their type.

| Signal | Weight | What is checked | Passes when | Fails when |
|---|---|---|---|---|
| Expected structured data present | 3% | One check per type expected for the site type. | The type is found (see R5, item 1). | The type is not found. |
| Structured data valid | 3% | One check per expected type, for each page it was looked for. | At least one object of the type has all of its required fields filled in. | No object has them, or the type is absent. |

**Expected types and required fields** (examples for an online shop)

| Type | Required fields |
|---|---|
| Organization, Brand | `name` |
| WebSite | `name`, `url` |
| Product | `name`, `image`, `offers` |
| Offer | `price`, `priceCurrency`, `availability` |
| Review | `itemReviewed`, `reviewRating`, `author` |

An online shop expects 11 types: Organization, Brand, WebSite, Product, Offer, AggregateRating, Review, BreadcrumbList, SearchAction, FAQPage and ItemList. The tool stops looking for a type once it has found it.

### Sharing tags · weight 6%

The title, description and image used when a page is shared or summarised. These three signals are judged on the **first page analysed**, not on every page.

| Signal | Weight | What is checked | Passes when | Fails when |
|---|---|---|---|---|
| Open Graph tags present | 3% | Open Graph tags on the first page. | At least one of `og:title`, `og:description`, `og:image` exists. | None of them. |
| Open Graph tags complete | 2% | The same tags, for completeness. | All five exist: `og:title`, `og:description`, `og:image`, `og:type`, `og:url`. | Any of the five is missing. |
| Twitter/X card tag present | 1% | A `twitter:card` tag on the first page. | The tag exists. | No tag. |

### How Maple Yoga scored

The tool read 10 pages. Eight have a canonical tag, and each of those points at the page itself and has no tracking parameters. The other two have no canonical tag at all. All 11 expected structured data types are present, but one (an Offer without `availability`) is incomplete. The homepage has sharing tags but no `og:type`. All pages are open to search.

```
 ✓ all checks passed     ◐ some passed     ✗ none passed

 Page access        8.0% of 8%     ██████████
   ✓ Pages can be crawled ...................... 6.0% of 6%
   ✓ Page allowed in search .................... 2.0% of 2%    all 10 pages

 Canonical tag      8.0% of 10%    ████████░░
   ◐ Canonical tag present ..................... 3.2% of 4%    2 of 10 pages have no tag
   ◐ Canonical points to the page itself ....... 2.4% of 3%    8 of 10 pages
   ◐ Canonical URL has no query parameters ..... 2.4% of 3%    8 of 10 pages

 Structured data    5.7% of 6%     █████████░
   ✓ Expected structured data present .......... 3.0% of 3%    11 of 11 types
   ◐ Structured data valid ..................... 2.7% of 3%    10 of 11 valid; the Offer lacks availability

 Sharing tags       4.0% of 6%     ███████░░░
   ✓ Open Graph tags present ................... 3.0% of 3%
   ✗ Open Graph tags complete .................. 0.0% of 2%    og:type is missing
   ✓ Twitter/X card tag present ................ 1.0% of 1%

 Site Signals total       25.7% of 30%     category score 85.8%
```

The category score is the weight earned divided by the weight checked: 25.7 ÷ 30 = 85.8%. The 4.3% of the final score that Maple Yoga lost in this group shows what to fix, biggest first: the incomplete Open Graph tags (2.0%), the two pages without a canonical tag (2.0% across the three canonical signals) and the Offer without `availability` (0.3%).

---

## 3. Does AI say the name? (LLM Brand Analysis, weight 40%)

This group measures the outcome the first two are meant to produce: does an AI assistant name the brand when a customer asks? It has the largest weight, 40%. The data here is not files or pages but **AI answers**, so the tool first has to collect them (see "How the answers are collected" below).

Its 40% is shared between two kinds of check, depending on what is counted: questions or topics. 16% + 24% = 40%.

```
 LLM Brand Analysis .......................... weight 40%
  |
  |-- Question checks ......................... 16%   one check per question (18 to 21 questions)
  |     '-- Cited for the question ............ 16%   technical name: Prompt Citation
  |
  '-- Topic checks ............................ 24%   one check per topic (6 to 7 topics)
        |-- Cited in the topic ................ 12%   technical name: Cluster Presence
        '-- Not outnumbered in the topic ...... 12%   technical name: Cluster Dominance
```

Three signals in total. Each has a **plain name**, used in this document, and a **technical name**, the name in the score card data. The two are shown side by side from here on. Each signal is described below under its source.

If any step of the collection fails (each topic is tried up to 4 times), the whole group is left out. Partial data is never scored. The audit is then scored on the two website groups alone.

**How the answers are collected**

| Step | What happens |
|---|---|
| 1. Profile the brand | An AI model with web search studies the brand in the chosen region: what it sells, to whom, at what price level. It names the brand's **3 to 5 main competitors** (the AI-identified competitors). |
| 2. Write the questions | A second model writes **6 to 7 topics with 3 questions each**, 18 to 21 questions. They are phrased the way a customer compares brands, for example "best yoga pants for beginners". |
| 3. Collect two answers per question | GPT-4o answers every question twice: the **web answer** uses web search, the **model answer** uses only the model's own knowledge. Each answer is asked to list 4 to 7 brands. |
| 4. Look for the names | The brand and each competitor are searched for in every answer, ignoring capitals and punctuation, as whole words. |
| 5. Count citations | A question is a citation for a brand when the brand appears in at least one of its two answers. |

> **Citation**
> A brand is **cited** in a question when its name appears in at least one of the question's two answers, the web answer or the model answer. Appearing in both still counts once.
>
> *Example.* For "best yoga pants for beginners", the web answer lists Lumen, Sage and Maple Yoga. The model answer lists Lumen, Sage and Birch. Maple Yoga appears in one of the two answers, so the question is **one citation** for Maple Yoga. If neither answer listed it, the question would not be a citation for it.
>
> A brand's **citations** are the number of questions in which it is cited.

### Question checks · weight 16%

Whether the brand shows up for each single question.

| Signal                                   | Weight | What is checked                    | Passes when                               | Fails when |
| ---------------------------------------- | ------ | ---------------------------------- | ----------------------------------------- | ---------- |
| Cited for the question *Prompt Citation* | 16%    | One check per question (18 to 21). | The question is a citation for the brand. | It is not. |

### Topic checks · weight 24%

Whether the brand shows up in a topic at all, and whether it holds its own against the competitors there.

| Signal                                           | Weight | What is checked                                                                                  | Passes when                                                    | Fails when                                      |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------- |
| Cited in the topic *Cluster Presence*            | 12%    | One check per topic.                                                                             | The brand has at least one citation in the topic.              | No citation in the topic.                       |
| Not outnumbered in the topic *Cluster Dominance* | 12%    | One check per topic. The brand's citations in the topic against each AI-identified competitor's. | No competitor has more citations than the brand. A tie passes. | A competitor has more citations than the brand. |

A topic where nobody is cited passes "Not outnumbered in the topic" (see R5, item 6).

### Figures reported next to the score

Two more figures come from the same citations. They are shown in reports and in the competitor comparison, but they are **not** part of the 100% score.

| Figure | How it is calculated | Maple Yoga |
|---|---|---|
| **Citations** (per brand) | Questions in which the brand is cited | Maple Yoga 9. Lumen 14, Sage 11, Birch 6, Fern 3. |
| **Share of voice** | Brand citations ÷ citations of all brands (the brand and its AI-identified competitors) | 9 ÷ (9+14+11+6+3) = 9 ÷ 43 = **20.9%** |
| **Topic coverage** | Topics with at least one citation ÷ all topics | 4 ÷ 7 = **57.1%** |

**Where each figure is used**

| Figure | Counts in the 100% score? | How |
|---|---|---|
| Citation of a question | **Yes** | "Cited for the question" (Prompt Citation) |
| Topic with a citation | **Yes** | "Cited in the topic" (Cluster Presence). Topic coverage is the same fact as a percentage. |
| Citations in a topic, brand against competitors | **Yes** | "Not outnumbered in the topic" (Cluster Dominance) |
| Share of voice | No | Reports only. The competitor comparison uses a variant, the share among compared brands. |

### How Maple Yoga scored

Maple Yoga was tested on 7 topics and 21 questions. It is cited in 9 questions, and those fall in 4 of the 7 topics. In 2 topics, no competitor has more citations than Maple Yoga.

```
 ✓ all checks passed     ◐ some passed     ✗ none passed

 Question checks     6.9% of 16%    ████░░░░░░
   ◐ Cited for the question ................ 6.9% of 16%    9 of 21 questions (Prompt Citation)

 Topic checks       10.3% of 24%    ████░░░░░░
   ◐ Cited in the topic .................... 6.9% of 12%    4 of 7 topics (Cluster Presence)
   ◐ Not outnumbered in the topic .......... 3.4% of 12%    2 of 7 topics (Cluster Dominance)

 LLM Brand Analysis total     17.1% of 40%     category score 42.9%
```

The category score is the weight earned divided by the weight checked: 17.1 ÷ 40 = 42.9%. The 22.9% of the final score that Maple Yoga lost in this group shows what to fix, biggest first: the 12 questions that do not cite it (9.1%), the 5 topics where a competitor has more citations (8.6%) and the 3 topics with no citation (5.1%).

---

## From many checks to one number

Four steps produce every score.

```
1. each check          earns 1 point if it passes, 0 if it does not
2. signal pass rate    = points earned by its checks ÷ number of checks run
3. weight earned       = signal weight × pass rate
4. score               = weight earned ÷ weight of the signals that were checked × 100%
```

When every signal can be checked, the weights add up to 100%, so the score is simply the total weight earned.

Maple Yoga's three results combine like this:

| Group | Weight earned | Weight checked | Score |
|---|---|---|---|
| Can AI get in? | 16.0% | 30% | 53.3% |
| Can AI understand it? | 25.7% | 30% | 85.8% |
| Does AI say the name? | 17.1% | 40% | 42.9% |
| **Whole audit** | **58.9%** | **100%** | **58.9%** |

*Figures are rounded, so the three rows add up to 58.8% on the page and 58.87% exactly.*

### What if something cannot be checked?

Suppose the site had answered the llms.txt request with a block (HTTP 403) instead of a plain "not found". The tool then does not know whether the file exists, so the three llms.txt signals (10% of the weight) are left out:

```
weight earned  = 58.9%   (the three llms.txt signals earned 0 anyway)
weight checked = 90%
score          = 58.9 ÷ 90 = 65.4%
checked share  = the weight that could be checked = 90%
```

The score went up from 58.9% to 65.4%, and the **checked share** went down from 100% to 90%. This is intended. Counting an unseen file as missing would punish the site for something the tool could not observe. The checked share is the reminder that the score rests on less. Always read the two together:

| Score | Checked share | Meaning |
|---|---|---|
| 80% | 100% | A solid, complete result. |
| 80% | 40% | Good on what was seen, but 60% could not be examined. |
| 0% | 15% | Almost nothing could be checked. This is not a verdict on the site. |

---

## What an audit returns

- **A score card:** every check and its result, the signals, the three group scores and the overall score.
- **A problem list:** what could not be collected and why.
- **A summary:** plain sentences on what is going well and what needs work.
- **A remediation plan:** the failed signals in up to three stages (Quick Fix, Secondary Fix, Complete Fix), with an estimated score after each. The next section explains how it is built.
- **The AI evidence:** the questions, both answers to each, who was named, citations, share of voice and topic coverage.

---

## Remediation Plan

After scoring, the tool turns every failed check into a **remediation plan**. The plan answers two questions: which signals to fix first, and how much the score would rise.

```
 Failed checks
   |
   |-- 1. Find the failing signals ......... and count their failed checks
   |-- 2. Rate each signal's difficulty .... Easy, Medium or Hard
   |-- 3. Put them in order ................ easiest first
   |-- 4. Split into stages ................ Quick Fix, Secondary Fix, Complete Fix
   '-- 5. Estimate the gain ................. the score after each stage
```

### How the plan is built

| Step | What happens |
|---|---|
| 1. Find the failing signals | A signal is **failing** when any of its checks did not pass. Signals that could not be checked are not included. |
| 2. Rate the difficulty | **Calculated for each audit, not pre-assigned to a signal.** Difficulty is the number of failed checks in the signal: **1 to 2 is Easy, 3 to 5 is Medium, 6 or more is Hard**. It counts the places to fix, not how hard the work really is. The same signal can be Easy in one audit and Hard in another. |
| 3. Put them in order | Easy first, then Medium, then Hard. Signals of the same difficulty keep the audit's order: Domain, Site, then LLM Brand Analysis. |
| 4. Split into stages | By the number of failing signals, see the table below. |
| 5. Estimate the gain | See "How the gain is estimated" below. |

**How the stages are formed**

| Failing signals | Stages |
|---|---|
| None | No plan. |
| 1 or 2 | One stage: **Complete Fix**. |
| 3 | **Quick Fix** (the first signal) and **Complete Fix** (the other two). |
| 4 | **Quick Fix** (the first 2) and **Complete Fix** (the other 2). |
| 5 or more | **Quick Fix**: the first third, rounded down, at least 1. **Secondary Fix**: half of what remains, at least 1. **Complete Fix**: the rest. |

### How the gain is estimated

- **Weight recovered by a signal** = its weight × (failed checks ÷ checks run). This is the share of the final score the signal would add if all its checks passed.
- **Weight recovered by a stage** = the sum for its signals.
- **Estimated score gain** = weight recovered by the stage ÷ 72 × 100, never more than what is left up to 100%. The estimates run one after the other: Secondary Fix starts where Quick Fix ends, and Complete Fix where Secondary Fix ends.
- **Impact** of a stage: High above 15, Medium above 7, otherwise Low (by the estimated gain).
- **Difficulty** of a stage: the same bands as for a signal, applied to the failed checks in the whole stage.

### Maple Yoga's remediation plan

Maple Yoga scored 58.9%. Thirteen signals are failing. Here they are in plan order:

| # | Failing signal | Failed checks | Difficulty | Weight recovered | Stage |
|---|---|---|---|---|---|
| 1 | llms.txt file present | 1 of 1 | Easy | 4.0% | Quick Fix |
| 2 | llms.txt readable as text | 1 of 1 | Easy | 3.0% | Quick Fix |
| 3 | llms.txt well structured | 1 of 1 | Easy | 3.0% | Quick Fix |
| 4 | Sitemap updated within 7 days | 1 of 1 | Easy | 3.0% | Quick Fix |
| 5 | Canonical tag present | 2 of 10 | Easy | 0.8% | Secondary Fix |
| 6 | Canonical points to the page itself | 2 of 10 | Easy | 0.6% | Secondary Fix |
| 7 | Canonical URL has no query parameters | 2 of 10 | Easy | 0.6% | Secondary Fix |
| 8 | Structured data valid | 1 of 11 | Easy | 0.3% | Secondary Fix |
| 9 | Open Graph tags complete | 1 of 1 | Easy | 2.0% | Complete Fix |
| 10 | AI crawlers allowed | 4 of 16 | Medium | 1.0% | Complete Fix |
| 11 | Cited in the topic | 3 of 7 | Medium | 5.1% | Complete Fix |
| 12 | Not outnumbered in the topic | 5 of 7 | Medium | 8.6% | Complete Fix |
| 13 | Cited for the question | 12 of 21 | Hard | 9.1% | Complete Fix |

With 13 failing signals, the first third is 4 (Quick Fix), half of the remaining 9 is 4 (Secondary Fix), and the last 5 form Complete Fix.

| Stage | Signals | Failed checks | Difficulty | Weight recovered | Estimated score | Impact |
|---|---|---|---|---|---|---|
| Quick Fix | 4 | 4 | Medium | 13.0% | 58.9% to 76.9% (+18.1) | High |
| Secondary Fix | 4 | 7 | Hard | 2.3% | 76.9% to 80.1% (+3.2) | Low |
| Complete Fix | 5 | 25 | Hard | 25.9% | 80.1% to 100% (+19.9) | High |

Two things in this table need a careful reading:

- **The estimates run high.** Fixing the Quick Fix signals really adds the 13.0% of weight recovered, so Maple Yoga would reach 71.9%, but the plan says 76.9%. The divisor is a fixed 72, not the 100 the weights add up to (see R5, item 8). After the last stage both end at 100%.
- **A stage's difficulty counts failed checks, not signals.** Secondary Fix holds four Easy signals but 7 failed checks, so it is labelled Hard (see R5, item 11).

---

## Competitors Analysis

A competitor is added to a finished audit with its **name** and its **website**, up to **5** per audit. It is measured the same way as the brand, on the brand's own questions, so a difference in result comes from the brand and not from the method.

### How a competitor is measured

| Group | Method |
|---|---|
| **Domain Signals** and **Site Signals** | The same checks as the brand's audit, run on the competitor's website. No AI calls. The result is stored per website and reused for **7 days**, also for other brands. |
| **LLM Brand Analysis** | No separate AI audit. The competitor's name is searched in the answers already collected for the brand. A question is a citation for the competitor when the name appears in at least one of its two answers. The three signals are then calculated as in section 3. |

The groups are shown separately. A competitor gets no combined score.

**One rule changes.** For "Not outnumbered in the topic", a brand is compared with the other **compared brands**: the brand and the competitors that were added. The 3 to 5 competitors the AI found take part only if they were added.

### Blocked websites

Some sites refuse automated visitors. The **website checked share** says how much of a competitor's website could be checked: the weight checked in Domain Signals and Site Signals, divided by their combined 60%.

| Website checked share | Treatment |
|---|---|
| 80% or more | **Fully assessed.** Scored. |
| 40% to under 80% | **Partly assessed.** Scored, with the checked share shown. |
| Under 40% | **Not rated.** No score, because a score from so few checks means little. The result is reused for **1 hour** only, so a retry can succeed. |

Example, with three competitors of Maple Yoga:

| Competitor | Blocked | Weight checked | Checked share | Treatment |
|---|---|---|---|---|
| Lumen | Nothing | 60% of 60% | 100% | Fully assessed |
| Sage | The pages | 36% of 60% | 60% | Partly assessed |
| Birch | robots.txt, llms.txt and the pages | 15% of 60% | 25% | Not rated |

Sage keeps all of Domain Signals (30%) plus "Pages can be crawled" (6%). Birch keeps only the sitemap signals (9%) plus "Pages can be crawled" (6%).

### Share among compared brands

In a comparison, share of voice is calculated among the compared brands only, and it is called the **share among compared brands**. It shows how these brands split the citations between them. It is not the brand's share of the whole market. It changes whenever a competitor is added or removed.

The brand's own audit keeps the name **share of voice**, calculated against its AI-identified competitors. Citations and topic coverage are the same in both.

| Brands in the comparison | Maple Yoga's figure |
|---|---|
| Its own audit: Maple Yoga and its 4 AI-identified competitors | Share of voice: 9 ÷ 43 = **20.9%** |
| Maple Yoga and Lumen | Share among compared brands: 9 ÷ (9 + 14) = **39.1%** |
| Maple Yoga, Lumen and Sage | Share among compared brands: 9 ÷ (9 + 14 + 11) = **26.5%** |

Maple Yoga has 9 citations and is cited in 4 of 7 topics in every row. Only the total it is divided by changes. "Not outnumbered in the topic" follows the same rule: in a comparison it is judged against the compared brands only.

## Reference

Use this part to look things up. You do not need it to understand the tool.

## R1. Inputs and allowed values

| Input | Rule |
|---|---|
| **Website** | A full address starting with `http://` or `https://`. The crawl starts here. Domain files are read at the root of its host. |
| **Brand name** | Required. Any text. Only leading and trailing spaces are removed; capitals, inner spaces and punctuation are kept. It is used in the AI questions and to search the answers. |
| **Region** | Optional free text, for example `United States` or `India`. Default `Not Specified`. |
| **Site type(s)** | One or more of 200 types, for example `ecommerce`, `saas`, `brand`, `marketplace`, `restaurant`, `hospital`. With several, their lists are combined. At least one should be chosen. It decides which page groups are tested for crawler access and which structured data is expected. |

## R2. Every signal in full

A check earns its 1 point only with the value `+1`. Every other value earns 0 points: `-1` is a fail, and `-0.5` is a weaker fail (a canonical address with a query string, or a sitemap without dates). A negative value is recorded but never subtracts from the score.

**Can AI get in? (Domain Signals, weight 30%)**

| Signal (weight) | Checks | Left out when |
|---|---|---|
| llms.txt file present (4%) | 1. Fails on HTTP 404. | The request fails or answers anything but 200 or 404, for example 403. All three llms.txt signals are then left out. |
| llms.txt readable as text (3%) | 1. Fails if the file is missing or is HTML (contains `<html` or `<!doctype html`, or content type `text/html`). | As above. |
| llms.txt well structured (3%) | 1. Fails with fewer than 4 of the 5 markers. | As above. |
| robots.txt file present (3%) | 1. Fails on HTTP 404. | The request fails or answers anything but 200 or 404. The four robots-based signals are then left out. |
| Sitemap available (3%) | 2: declared in robots.txt; file found. | The "declared" check is skipped when robots.txt is left out. |
| Sitemap structure valid (3%) | 1. Fails if the XML root is not a URL set or a sitemap index. | No sitemap found. |
| Sitemap updated within 7 days (3%) | 1. Fails if the newest date is older; `-0.5` if there are no dates. | No sitemap found. |
| AI crawlers allowed (4%) | 1 per AI crawler and page group. | robots.txt left out. |
| Search crawlers allowed (4%) | 1 per search crawler and page group. | robots.txt left out. |

**Can AI understand it? (Site Signals, weight 30%)**

| Signal (weight) | Checks | Left out when |
|---|---|---|
| Pages can be crawled (6%) | 1. Fails if no page could be fetched. | Never. |
| Canonical tag present (4%) | 1 per page. | Site not scrapable. |
| Canonical points to the page itself (3%) | 1 per page. Both addresses are reduced to `scheme://host/path` without a trailing slash and compared. | Site not scrapable. |
| Canonical URL has no query parameters (3%) | 1 per page. Fails (`-0.5`) if the address contains `?`. | Site not scrapable. |
| Expected structured data present (3%) | 1 per expected type. | Site not scrapable. |
| Structured data valid (3%) | 1 per expected type, per page it was looked for. A type that is absent counts as not valid. | Site not scrapable. |
| Open Graph tags present (3%) | 1, on the first page. Passes if any of `og:title`, `og:description`, `og:image` exists. | Site not scrapable. |
| Open Graph tags complete (2%) | 1, on the first page. Needs all of title, description, image, type, URL. | Site not scrapable. |
| Twitter/X card tag present (1%) | 1, on the first page. | Site not scrapable. |
| Page allowed in search (2%) | 1 per page. Fails if the robots meta tag contains `noindex`. | Site not scrapable. |

**Does AI say the name? (LLM Brand Analysis, weight 40%)**

| Signal (weight) | Checks | Left out when |
|---|---|---|
| Cited for the question (16%), Prompt Citation | 1 per question (18 to 21). | The group is unavailable. |
| Cited in the topic (12%), Cluster Presence | 1 per topic (6 to 7). | The group is unavailable. |
| Not outnumbered in the topic (12%), Cluster Dominance | 1 per topic. | The group is unavailable. |

## R3. Details of the methods

- **Finding the sitemap.** If robots.txt declares one, only the first declared address is fetched. Otherwise `/sitemap.xml`, `/sitemap_index.xml` and `/siteindex.xml` are tried in that order. A file counts only if it is valid XML. For freshness the newest of the first 20 dates is used. For an index, it is the first of its first 5 child sitemaps that has dates.
- **robots.txt missing (HTTP 404).** There are no restrictions, so every crawler check passes. "robots.txt file present" and the "declared" check fail.
- **Matching names in answers.** Lower-case the text and the name. Turn `&` into " and ", `+` into " plus ", `@` into " at " and `#` into " number ". Delete all other punctuation and collapse spaces. The name matches as a whole word: plain, with an added `s`, or with a trailing `s` removed.
- **Failed topic.** Each topic is tried up to 4 times. If one still fails, the whole LLM group is unavailable. Partial data is never scored.
- **Pass share, used for the summary.** All checks passed ÷ all checks run, every check counted equally. The summary gives a highlight at 90%, 80% or 70% and above. Below 70% it gives an improvement note in three bands: 50 to 69%, 30 to 49%, under 30%.
- **Remediation plan.** The rules for difficulty, stages and estimated gain are in the section "Remediation Plan".
- **Website checked share, in comparisons.** Of the 60% website weight, 80% or more checked is fully assessed, 40% to under 80% partly assessed, under 40% not rated.

## R4. Fixed values

| Item | Value |
|---|---|
| Signals / groups | 22 / 3 |
| Group weights | 30% / 30% / 40% (total 100%) |
| Request wait | 10 s (robots.txt, llms.txt), 5 s (sitemap) |
| AI crawlers | GPTBot, Google-Extended, ClaudeBot, PerplexityBot |
| Search crawlers | Googlebot, Bingbot |
| llms.txt markers needed | 4 of 5 |
| Sitemap freshness limit | 7 days |
| Pages sampled | Homepage + up to 50 (normal), homepage + up to 5 (script-driven) |
| AI-identified competitors | 3 to 5 |
| Topics × questions | 6 to 7 × 3 = 18 to 21 |
| Brands requested per answer | 4 to 7 |
| Answers per question | 2 |
| Added competitors per audit | 5 |
| Competitor result reuse | 7 days; 1 hour when under 40% of the website weight was checked |

## R5. Terms

| Term | Meaning |
|---|---|
| **Signal** | One named area that is tested. There are 22. |
| **Plain name / technical name** | A signal's name in this document, and its name in the score card data. For the three LLM Brand Analysis signals the technical names are Cluster Presence, Cluster Dominance and Prompt Citation. |
| **Check** | One test of a signal: one page, one crawler, one question. |
| **Point** | What a check earns: 1 if it passes, 0 if it does not. |
| **Pass** | A check that succeeded, and so earned its point. |
| **Weight** | The share of the final score that a signal or group is worth, as a percentage. All weights add up to 100%. |
| **Pass rate** | The points earned by a signal's checks ÷ the number of checks run. |
| **Weight earned** | A signal's weight × its pass rate. |
| **Score** | Weight earned ÷ weight checked, as a percentage. |
| **Checked share** | The weight that belongs to signals that were checked, out of 100%. |
| **Question** | A customer question put to the AI model. Reports call it a "prompt". |
| **Topic** | A group of questions on one aspect of the market. Reports call it a "cluster". |
| **Citation** | A question in which the brand appears in at least one of its two answers. A brand's citations are the number of such questions. |
| **Share of voice** | Brand citations ÷ citations of all brands, in the brand's own audit. |
| **Share among compared brands** | The same calculation in a comparison, among the brand and the added competitors only. |
| **Topic coverage** | Topics with a citation ÷ all topics. |
| **AI-identified competitor** | One of the 3 to 5 competitors the tool finds for the brand. |
| **Added competitor** | A competitor the user chose for the comparison. |
| **Remediation plan** | The failing signals, ordered by difficulty and split into up to three stages (Quick Fix, Secondary Fix, Complete Fix), each with an estimated score. |
| **Compared brands** | The brand and the competitors added to the comparison. |
| **Website checked share** | In a comparison: the weight checked in Domain Signals and Site Signals ÷ their combined weight of 60%. |
