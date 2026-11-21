/** The public inquiry has one description field, so reference links are appended to it. */
export const INQUIRY_DETAILS_MAX_LENGTH = 5000;
export const INQUIRY_LINKS_MAX_LENGTH = 900;

export function composeInquiryDescription(details: string, links: string): string {
  const text = details.trim();
  const reference = links.trim();
  return reference ? `${text}\n\nReference links:\n${reference}` : text;
}
