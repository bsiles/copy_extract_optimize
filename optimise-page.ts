import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import process from 'process';
import fetch from 'node-fetch';
import { chromium } from 'playwright-core';
import TurndownService from 'turndown';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import 'dotenv/config';
import { JSDOM } from 'jsdom';

// CLI setup
const argv = yargs(hideBin(process.argv))
  .option('tone', {
    type: 'string',
    description: 'Override tone',
  })
  .option('browser-path', {
    type: 'string',
    description: 'Path to Chrome browser',
  })
  .option('list', {
    type: 'string',
    description: 'Path to file with list of URLs',
  })
  .demandCommand(1, 'You need to provide at least one URL or use --list')
  .help()
  .argv;

// Initialize Turndown service
const turndownService = new TurndownService();

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function fetchPage(url: string, browserPath?: string): Promise<string> {
  // Try fetching with node-fetch first
  const response = await fetch(url);
  let html = await response.text();

  // If HTML body length is less than 1500 chars, use Playwright
  if (html.length < 1500) {
    const browser = await chromium.launch({
      executablePath: browserPath,
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    html = await page.content();
    await browser.close();
  }

  return html;
}

async function convertHtmlToMarkdown(html: string): Promise<string> {
  return turndownService.turndown(html);
}

export function classifyPageType(url: string): string | null {
  const patterns = [
    { regex: /about|team|management|leadership|company/, label: 'about', mandatory: true },
    { regex: /contact|support|help|inquiries/, label: 'contact', mandatory: true },
    { regex: /service|solution|what-we-do/, label: 'services', mandatory: false },
    { regex: /faq|questions|help-center/, label: 'faq', mandatory: false },
    { regex: /portfolio|work|projects|case-studies/, label: 'portfolio', mandatory: false },
    { regex: /blog|news|articles|posts/, label: 'blog', mandatory: false },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(url)) {
      return pattern.label;
    }
  }

  // Default to 'home' for the first URL passed in
  return url === argv._[0] ? 'home' : null;
}

function detectCommonHeaderFooter(markdowns: string[]): { header: string | null, footer: string | null } {
  const headerFooterLength = 250;
  const headers = markdowns.map(md => md.slice(0, headerFooterLength));
  const footers = markdowns.map(md => md.slice(-headerFooterLength));

  const commonHeader = findCommonSection(headers);
  const commonFooter = findCommonSection(footers);

  return { header: commonHeader, footer: commonFooter };
}

function findCommonSection(sections: string[]): string | null {
  const threshold = 0.8;
  const sectionCount = sections.length;
  const sectionMap: { [key: string]: number } = {};

  sections.forEach(section => {
    sectionMap[section] = (sectionMap[section] || 0) + 1;
  });

  for (const [section, count] of Object.entries(sectionMap)) {
    if (count / sectionCount >= threshold) {
      return section;
    }
  }

  return null;
}

function extractEmailAddresses(text: string): string[] {
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  return [...new Set(text.match(emailRegex) || [])];
}

function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits, assume it's a US number
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it has 10 digits, assume it's a US number and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Otherwise, just add + and return
  return `+${digits}`;
}

function extractPhoneNumbers(text: string): string[] {
  const phoneRegex = /\+?\d[\d\s().-]{7,}/g;
  const matches = text.match(phoneRegex) || [];
  return [...new Set(matches.map(normalizePhoneNumber))];
}

function extractAddress(text: string): string | null {
  const addressRegex = /\d+\s+([A-Za-z0-9\s,.-]+(?:St|Rd|Ave|Blvd|Dr|Ln|Way)[A-Za-z0-9\s,.-]+(?:[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?))/i;
  const match = text.match(addressRegex);
  return match ? match[1].trim() : null;
}

function generateFormFrontMatter(): any {
  return {
    action: "/api/contact",
    method: "POST",
    submitText: "Send Message",
    fields: [
      { name: "name", label: "Your Name", type: "text", required: true },
      { name: "email", label: "Email Address", type: "email", required: true },
      { name: "phone", label: "Phone Number", type: "tel", required: false },
      { name: "message", label: "Message", type: "textarea", required: true }
    ]
  };
}

function kebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 60);
}

function parseDate(text: string): string | null {
  const dateRegex = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
  const match = text.match(dateRegex);
  if (!match) return null;
  
  try {
    return new Date(match[0]).toISOString().split('T')[0];
  } catch {
    return null;
  }
}

interface BlogPost {
  title: string;
  excerpt: string;
  slug: string;
  date: string | null;
  heroImage: string | null;
}

function extractBlogPosts(markdown: string): { posts: BlogPost[], cleanBody: string } {
  const lines = markdown.split('\n');
  const posts: BlogPost[] = [];
  let currentPost: BlogPost | null = null;
  let cleanBody: string[] = [];
  let usedSlugs = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for H2 heading
    if (line.startsWith('## ')) {
      if (currentPost) {
        // Finalize previous post
        currentPost.excerpt = currentPost.excerpt.trim();
        if (currentPost.excerpt.length > 300) {
          currentPost.excerpt = currentPost.excerpt.substring(0, 297) + '...';
        }
        posts.push(currentPost);
      }

      // Start new post
      const title = line.substring(3).trim();
      let slug = kebabCase(title);
      
      // Ensure unique slug
      let counter = 1;
      let originalSlug = slug;
      while (usedSlugs.has(slug)) {
        slug = `${originalSlug}-${++counter}`;
      }
      usedSlugs.add(slug);

      // Look for date in surrounding lines
      let date = null;
      for (let j = Math.max(0, i - 1); j <= Math.min(lines.length - 1, i + 1); j++) {
        const dateMatch = parseDate(lines[j]);
        if (dateMatch) {
          date = dateMatch;
          break;
        }
      }

      currentPost = {
        title,
        excerpt: '',
        slug,
        date,
        heroImage: null as string | null
      };
    } else if (currentPost) {
      // Check if this line starts a new post
      if (line.startsWith('## ')) {
        continue;
      }
      
      // Skip "Read more" links
      if (line.includes('Read more') || line.includes('Read More')) {
        continue;
      }

      // Add to excerpt
      currentPost.excerpt += line + '\n';
    } else {
      // Add to clean body
      cleanBody.push(line);
    }
  }

  // Add final post if exists
  if (currentPost) {
    currentPost.excerpt = currentPost.excerpt.trim();
    if (currentPost.excerpt.length > 300) {
      currentPost.excerpt = currentPost.excerpt.substring(0, 297) + '...';
    }
    posts.push(currentPost);
  }

  return {
    posts,
    cleanBody: cleanBody.join('\n')
  };
}

async function optimizeCopy(markdown: string, pageType: string, url: string): Promise<string> {
  // Extract slug from URL path
  const urlObj = new URL(url);
  let slug = urlObj.pathname.replace(/^\/|\/$/g, '');
  slug = slug || 'home';

  // Extract contact information
  const emails = extractEmailAddresses(markdown);
  const phones = extractPhoneNumbers(markdown);
  const address = extractAddress(markdown);

  // Generate CTAs from contact info
  const contactCTAs = [
    ...emails.map(email => ({ text: "Email", href: `mailto:${email}` })),
    ...phones.map(phone => ({ text: "Call", href: `tel:${phone}` }))
  ];

  // Remove contact information from markdown
  let cleanMarkdown = markdown;
  emails.forEach(email => {
    cleanMarkdown = cleanMarkdown.replace(new RegExp(email, 'g'), '');
  });
  phones.forEach(phone => {
    cleanMarkdown = cleanMarkdown.replace(new RegExp(phone.replace(/[+()]/g, '\\$&'), 'g'), '');
  });
  if (address) {
    cleanMarkdown = cleanMarkdown.replace(new RegExp(address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  }

  const prompt = `You are an expert web copy editor. Please optimize the following Markdown content for a ${pageType} page:

${cleanMarkdown}

Focus ONLY on the text content. Ignore all images, image URLs, and alt text.

Specific requirements:
1. Generate a 1-sentence description (≤ 155 chars, no quotes)
2. Extract ALL calls-to-action (CTAs) from the text and move them to the front-matter
   - This includes any text with phone numbers, email addresses, or links
   - Remove ALL Markdown links from the body text
   - Convert phone numbers to proper tel: links
3. Ensure exactly one H1 (#) at the start (taken from <title> or first <h1>)
4. Demote any extra H1s to H2 (##)
5. Keep bullet lists in Markdown format
6. Do NOT move lists into structured arrays
7. Improve grammar, clarity, concision, engagement; keep facts accurate
8. Remove redundancy:
   - Eliminate repeated phrases or concepts
   - Consolidate similar ideas into single, clear statements
   - Ensure each section adds unique value
   - Remove duplicate information across sections
   - Keep only the strongest version of any repeated message

Return ONLY valid Markdown prefixed with YAML front-matter:

---
pageType: "${pageType}"
slug: "${slug}"
metaTitle: "<best-fit title ≤ 60 chars>"
description: "<1-sentence summary ≤ 155 chars>"
${address ? `address: "${address}"` : ''}
cta:
  ${contactCTAs.map(cta => `  - { text: "${cta.text}", href: "${cta.href}" }`).join('\n  ')}
${pageType === 'contact' ? `form:
  action: "/api/contact"
  method: "POST"
  submitText: "Send Message"
  fields:
    - { name: "name",    label: "Your Name",        type: "text",     required: true  }
    - { name: "email",   label: "Email Address",    type: "email",    required: true  }
    - { name: "phone",   label: "Phone Number",     type: "tel",      required: false }
    - { name: "message", label: "Message",          type: "textarea", required: true  }` : ''}
wordCount: <integer>
---

(The rest of the Markdown body follows, starting with the single H1. NO LINKS should remain in the body text.)`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500,
  });

  const choice = response.choices[0];
  return choice && choice.message && choice.message.content ? choice.message.content.trim() : '';
}

function writeToFile(directory: string, filename: string, content: string) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(path.join(directory, filename), content);
}

async function extractLinks(html: string, baseUrl: string): Promise<string[]> {
  const dom = new JSDOM(html);
  const links = Array.from(dom.window.document.querySelectorAll('a'))
    .map(a => (a as HTMLAnchorElement).href)
    .filter(href => {
      try {
        const url = new URL(href, baseUrl);
        return url.origin === baseUrl;
      } catch {
        return false;
      }
    })
    .map(href => {
      try {
        return new URL(href, baseUrl).href;
      } catch {
        return '';
      }
    })
    .filter(href => href !== '');
  
  console.log(`Found ${links.length} links on the page`);
  console.log('Links:', links);
  return [...new Set(links)]; // Remove duplicates
}

async function crawlPages(startUrl: string, maxDepth: number = 2): Promise<Map<string, string>> {
  const baseUrl = new URL(startUrl).origin;
  const visited = new Set<string>();
  const pagesByUrl = new Map<string, string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

  console.log(`Starting crawl at ${startUrl} with max depth ${maxDepth}`);

  while (queue.length > 0) {
    const { url, depth } = queue.shift()!;
    
    if (visited.has(url) || depth > maxDepth) {
      continue;
    }

    // Check if this is a blog page and adjust depth accordingly
    const pageType = classifyPageType(url);
    const effectiveMaxDepth = pageType === 'blog' ? 1 : maxDepth;
    
    if (depth > effectiveMaxDepth) {
      continue;
    }

    console.log(`Crawling ${url} at depth ${depth} (type: ${pageType || 'unknown'})`);
    visited.add(url);

    try {
      const html = await fetchPage(url);
      pagesByUrl.set(url, html);
      console.log(`Successfully fetched ${url}`);

      if (depth < effectiveMaxDepth) {
        const links = await extractLinks(html, baseUrl);
        console.log(`Adding ${links.length} links to queue at depth ${depth + 1}`);
        queue.push(...links.map(link => ({ url: link, depth: depth + 1 })));
      }
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
    }
  }

  console.log(`Crawl complete. Found ${pagesByUrl.size} pages`);
  return pagesByUrl;
}

function getPageFilename(pageUrl: string): string {
  const url = new URL(pageUrl);
  // Get the pathname and remove leading/trailing slashes
  let path = url.pathname.replace(/^\/|\/$/g, '');
  // If it's the homepage (empty path), use 'index'
  path = path || 'index';
  // Replace remaining slashes with underscores
  path = path.replace(/\//g, '_');
  return `${path}.md`;
}

function clearOutputDirectory(domain: string) {
  const outputDir = path.join('output', domain);
  if (fs.existsSync(outputDir)) {
    console.log(`Clearing output directory: ${outputDir}`);
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

// Update main function to clear output directory before starting
async function main() {
  const url = argv._[0] as string;
  const tone = argv.tone;
  const browserPath = argv['browser-path'];
  const listPath = argv.list;

  console.log('URL:', url);
  console.log('Tone:', tone);
  console.log('Browser Path:', browserPath);
  console.log('List Path:', listPath);

  try {
    // Clear output directory before starting
    const domain = new URL(url).hostname.replace(/[^a-z0-9]/gi, '_');
    clearOutputDirectory(domain);

    const pagesByUrl = await crawlPages(url);
    console.log(`Fetched ${pagesByUrl.size} pages.`);

    for (const [pageUrl, html] of pagesByUrl) {
      console.log(`\nProcessing page: ${pageUrl}`);
      console.log('HTML preview:', html.slice(0, 100));

      // Convert HTML to Markdown
      const markdown = await convertHtmlToMarkdown(html);
      console.log('Converted Markdown preview:', markdown.slice(0, 100));

      // Classify page type
      const pageType = classifyPageType(pageUrl);
      console.log('Page Type:', pageType);

      // Detect common header and footer
      const { header, footer } = detectCommonHeaderFooter([markdown]);

      // Get filename based on URL path
      const filename = getPageFilename(pageUrl);
      console.log('Writing to file:', filename);

      // Write to files
      const outputDir = path.join('output', domain);
      
      // Write raw content with URL-based filename
      writeToFile(path.join(outputDir, 'raw'), filename, markdown);

      // Write optimized content with type-based filename if classified
      if (pageType) {
        const optimizedMarkdown = await optimizeCopy(markdown, pageType, pageUrl);
        console.log('Optimized Markdown preview:', optimizedMarkdown.slice(0, 100));
        writeToFile(path.join(outputDir, 'optimised'), `${pageType}.md`, optimizedMarkdown);
      }

      if (header || footer) {
        writeToFile(outputDir, 'header-footer.md', `${header || ''}\n\n${footer || ''}`);
      }
    }
  } catch (error) {
    console.error('Error during crawl:', error);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
}); 