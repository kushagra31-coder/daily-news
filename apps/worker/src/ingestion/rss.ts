import { XMLParser } from 'fast-xml-parser';

export async function fetchRSS(url: string, sourceId: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  
  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(text);
  
  const items = doc.rss?.channel?.item || doc.feed?.entry || [];
  const normalized = (Array.isArray(items) ? items : [items]).map((item: any) => {
    return {
      title: item.title,
      link: item.link?.href || item.link || '',
      summary: item.description || item.summary || '',
      publishedAt: new Date(item.pubDate || item.published || new Date()),
    };
  });
  
  return normalized;
}
