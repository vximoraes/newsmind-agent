import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export async function fetchArticleContent(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);
        $('script, style, noscript').remove();
        return $('body').text().replace(/\s+/g, ' ').trim();
    } catch (error) {
        console.error("Error fetching content from URL:", url, error);
        return "";
    }
}  