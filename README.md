# Optimise Page CLI

**Purpose**
A Node.js + TypeScript CLI tool (optimise-page.ts) that fetches, renders, and optimizes web pages, converting them to Markdown, classifying them, and optimizing copy using OpenAI GPT-4o. It is designed for content extraction, deduplication, and structured output for various types of website pages.

**Key Features**
**1. CLI Interface**
Uses yargs for command-line parsing.
Accepts a single URL or a list of URLs (from a file or stdin).
Supports options for output directory, OpenAI API key, and other settings.
**2. Page Fetching & Rendering**
Uses node-fetch for HTTP requests.
Uses Playwright to render pages (for dynamic content and JS-heavy sites).
Handles timeouts, retries, and error reporting.
**3. HTML to Markdown Conversion**
Uses Turndown to convert rendered HTML to clean Markdown.
Strips out navigation, footers, and non-content elements where possible.
**4. Page Classification**
Classifies each page as one of:
home, about, contact, services, faq, portfolio, blog, or unknown.
Uses heuristics and/or OpenAI GPT-4o for robust classification.
**5. Content Extraction & Aggregation**
Deduplication: Merges and deduplicates similar content across pages.
Chunking: Splits large content into manageable chunks for processing.
Blog Index: For blog pages, extracts only the main index/teasers, not individual posts.
Portfolio: Aggregates and deduplicates real portfolio items from the site.
Team Members: Extracts structured team lists for about pages.
Contact: Extracts and cleans up contact forms and info.
**6. Copy Optimization**
Uses OpenAI GPT-4o to optimize and rewrite copy for clarity, conciseness, and engagement.
Extracts and highlights Calls to Action (CTAs).
**7. Output Generation**
Outputs a Markdown file for each page, with:
YAML front-matter: Contains metadata (title, type, date, etc.).
Clean Markdown content: The main body, optimized and deduplicated.
Ensures correct YAML/Markdown separation and formatting.
Skips unknown/media pages and blog subpages.
**8. Environment & Testing**
ESM-only setup (no CommonJS).
.env.example for environment variables (e.g., OpenAI API key).
Unit tests for core logic.
**9. Error Handling & Robustness**
Handles stack overflows, token limit errors, and fetch/render failures gracefully.
Logs errors and skips problematic pages without crashing.


## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   - Copy `.env.example` to `.env` and add your OpenAI API key.

## Usage

Run the CLI with a single URL:
```bash
npm run dev -- <url>
```

Run the CLI with a list of URLs:
```bash
npm run dev -- --list <path/to/urls.txt>
```

### CLI Options
- `--tone "<override tone>"`: Optional, specify a tone to override.
- `--browser-path "<path>"`: Optional, specify a path to the Chrome browser.
- `--list "<file.txt>"`: Optional, specify a file with a list of URLs.

## Testing

Run unit tests using Vitest:
```bash
npm test
```

## Requirements
- Node.js 20 or higher

## License
This project is licensed under the MIT License. 
