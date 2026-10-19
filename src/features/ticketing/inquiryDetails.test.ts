import { describe, expect, it } from 'vitest';
import { composeInquiryDescription, INQUIRY_DETAILS_MAX_LENGTH, INQUIRY_LINKS_MAX_LENGTH } from './inquiryDetails';

describe('public inquiry details', () => {
  it('keeps the description unchanged when there are no reference links', () => {
    expect(composeInquiryDescription('  A booking page for my salon.  ', '   ')).toBe('A booking page for my salon.');
  });
  it('appends reference links as a labelled block', () => {
    expect(composeInquiryDescription('A booking page.', 'https://example.test/current\nhttps://example.test/inspiration'))
      .toBe('A booking page.\n\nReference links:\nhttps://example.test/current\nhttps://example.test/inspiration');
  });
  it('always fits the 6000 character server limit', () => {
    const longest = composeInquiryDescription('d'.repeat(INQUIRY_DETAILS_MAX_LENGTH), 'l'.repeat(INQUIRY_LINKS_MAX_LENGTH));
    expect(longest.length).toBeLessThanOrEqual(6000);
  });
});
