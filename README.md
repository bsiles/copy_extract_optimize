# Optimise Page CLI

## Overview
The Optimise Page CLI is a tool designed to fetch, render, and optimize web pages using Node.js and TypeScript. It converts HTML to Markdown, classifies pages, and optimizes content using OpenAI's GPT-4o.

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