import { describe, it, expect } from 'vitest';
import { classifyPageType } from '../optimise-page';

// Test cases for classifyPageType
const testCases = [
  { url: 'https://example.com/about', expected: 'about' },
  { url: 'https://example.com/team', expected: 'about' },
  { url: 'https://example.com/contact', expected: 'contact' },
  { url: 'https://example.com/support', expected: 'contact' },
  { url: 'https://example.com/service', expected: 'services' },
  { url: 'https://example.com/faq', expected: 'faq' },
  { url: 'https://example.com/portfolio', expected: 'portfolio' },
  { url: 'https://example.com/', expected: 'home' }, // Assuming this is the first URL
  { url: 'https://example.com/unknown', expected: null },
];

describe('classifyPageType', () => {
  testCases.forEach(({ url, expected }) => {
    it(`should classify ${url} as ${expected}`, () => {
      const result = classifyPageType(url);
      expect(result).toBe(expected);
    });
  });
}); 