/**
 * Fetch real photos for restaurants from Yelp using Playwright browser.
 * Uses a real Chromium browser to bypass bot detection.
 *
 * Usage: npx tsx scripts/fetch-restaurant-photos.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';

const restaurants: Array<{ name: string; yelpUrl: string | null; location: string }> = [
  { name: 'Reunion', yelpUrl: 'https://www.yelp.com/biz/reunion-kitchen-drink-santa-barbara-3', location: 'Santa Barbara' },
  { name: 'Kanaloa Seafood', yelpUrl: null, location: 'Santa Barbara' },
  { name: 'Secret Bao', yelpUrl: null, location: 'Santa Barbara' },
  { name: 'Barbareno', yelpUrl: 'https://www.yelp.com/biz/barbare%C3%B1o-santa-barbara?osq=farm+to+table', location: 'Santa Barbara' },
  { name: 'The Lark', yelpUrl: 'https://www.yelp.com/biz/the-lark-santa-barbara-3?osq=cocktails', location: 'Santa Barbara' },
  { name: 'Santo Mezcal', yelpUrl: 'https://yelp.to/6O4Ye6Bo3pb', location: 'Santa Barbara' },
  { name: 'Lucky Penny', yelpUrl: 'https://yelp.to/H0JexdFo3pb', location: 'Santa Barbara' },
  { name: 'Sama Sama', yelpUrl: 'https://www.yelp.com/biz/sama-sama-kitchen-santa-barbara', location: 'Santa Barbara' },
  { name: 'The Good Lion', yelpUrl: null, location: 'Santa Barbara' },
  { name: 'Test Pilot', yelpUrl: null, location: 'Santa Barbara' },
  { name: 'Shaker Mill', yelpUrl: null, location: 'Santa Barbara' },
  { name: 'Lab Social', yelpUrl: null, location: 'Santa Barbara' },
  { name: 'Pearl Social', yelpUrl: null, location: 'Santa Barbara' },
  { name: 'Satellite', yelpUrl: 'https://yelp.to/TTRHKano3pb', location: 'Santa Barbara' },
  { name: 'Corazon Comedor', yelpUrl: 'https://www.yelp.com/biz/corazon-comedor-santa-barbara', location: 'Santa Barbara' },
  { name: "Jeannine's", yelpUrl: 'https://www.yelp.com/biz/jeannine-s-american-bakery-and-restaurant-santa-barbara?osq=breakfast', location: 'Santa Barbara' },
  { name: "Boathouse at Hendry's", yelpUrl: 'https://www.yelp.com/biz/boathouse-at-hendrys-beach-santa-barbara?osq=breakfast', location: 'Santa Barbara' },
  { name: "Renaud's", yelpUrl: null, location: 'Santa Barbara' },
  { name: 'Finch and Fork', yelpUrl: 'https://www.yelp.com/biz/finch-and-fork-santa-barbara?osq=farm+to+table', location: 'Santa Barbara' },
  { name: "D'Angelo's", yelpUrl: 'https://www.yelp.com/biz/d-angelos-bakery-santa-barbara?osq=d+angelo', location: 'Santa Barbara' },
  { name: 'Hook and Press', yelpUrl: 'https://www.yelp.com/biz/hook-and-press-donuts-santa-barbara?osq=hook+and+press', location: 'Santa Barbara' },
  { name: 'Oat Bakery', yelpUrl: 'https://www.yelp.com/biz/oat-bakery-santa-barbara?osq=breakfast', location: 'Santa Barbara' },
  { name: 'Broad Street Oyster Company', yelpUrl: 'https://yelp.to/ETuX1Mso3pb', location: 'Santa Barbara' },
  { name: 'La Super Rica', yelpUrl: 'https://www.yelp.com/biz/la-super-rica-taqueria-santa-barbara?osq=mexican', location: 'Santa Barbara' },
  { name: 'Los Agaves', yelpUrl: 'https://www.yelp.com/biz/los-agaves-santa-barbara?osq=mexican', location: 'Santa Barbara' },
  { name: 'Los Arroyos', yelpUrl: 'https://www.yelp.com/biz/los-arroyos-santa-barbara-2?osq=mexican', location: 'Santa Barbara' },
  { name: 'South Coast Deli', yelpUrl: 'https://www.yelp.com/biz/south-coast-deli-chapala-santa-barbara?osq=restaurants', location: 'Santa Barbara' },
  { name: 'Olio Crudo Bar & Pizzeria', yelpUrl: 'https://www.yelp.com/biz/olio-crudo-bar-and-pizzeria-santa-barbara?osq=pizza', location: 'Santa Barbara' },
  { name: 'Empty Bowl', yelpUrl: 'https://www.yelp.com/biz/empty-bowl-gourmet-noodle-bar-santa-barbara?osq=hippster', location: 'Santa Barbara' },
  { name: "Joe's", yelpUrl: 'https://yelp.to/zTWYYsTEK0', location: 'Santa Barbara' },
  { name: 'Blue Owl', yelpUrl: 'https://www.yelp.com/biz/the-blue-owl-santa-barbara?osq=breakfast', location: 'Santa Barbara' },
  { name: 'Saint Bibiana', yelpUrl: 'https://www.yelp.com/biz/saint-bibiana-santa-barbara', location: 'Santa Barbara' },
  { name: "Mony's Mexican Food", yelpUrl: null, location: 'Santa Barbara' },
  { name: 'Corazon Cocina', yelpUrl: 'https://yelp.to/g9tAn61n3pb', location: 'Santa Barbara' },
  { name: 'Shaloob', yelpUrl: null, location: 'Santa Barbara' },
  { name: "McConnell's Ice Cream", yelpUrl: null, location: 'Santa Barbara' },
  { name: 'Handlebar Coffee', yelpUrl: 'https://www.yelp.com/biz/handlebar-coffee-roasters-santa-barbara?osq=coffee', location: 'Santa Barbara' },
  { name: 'Dune Coffee', yelpUrl: 'https://www.yelp.com/biz/dune-coffee-roasters-state-street-santa-barbara?osq=coffee', location: 'Santa Barbara' },
  { name: 'Lilac Patisserie', yelpUrl: 'https://www.yelp.com/biz/lilac-p%C3%A2tisserie-santa-barbara?osq=gluten+free+bakery', location: 'Santa Barbara' },
  { name: 'Blenders in the Grass', yelpUrl: null, location: 'Santa Barbara' },
  { name: 'M Special Brewery', yelpUrl: 'https://www.yelp.com/biz/m-special-brew-co-goleta', location: 'Goleta' },
  { name: 'Hollister Brewing Company', yelpUrl: 'https://www.yelp.com/biz/hollister-brewing-company-goleta', location: 'Goleta' },
  { name: 'Draughtsman Aleworks', yelpUrl: null, location: 'Goleta' },
  { name: 'The Mercury Lounge', yelpUrl: 'https://www.yelp.com/biz/mercury-goleta', location: 'Goleta' },
  { name: 'The Imperial', yelpUrl: 'https://www.yelp.com/biz/the-imperial-goleta', location: 'Goleta' },
  { name: 'Cajun Kitchen Cafe', yelpUrl: 'https://www.yelp.com/biz/cajun-kitchen-cafe-goleta?osq=breakfast', location: 'Goleta' },
  { name: 'Sage and Onion Cafe', yelpUrl: 'https://www.yelp.com/biz/sage-and-onion-cafe-goleta?osq=breakfast', location: 'Goleta' },
  { name: 'Backyard Bowls', yelpUrl: 'https://www.yelp.com/biz/backyard-bowls-goleta?osq=breakfast', location: 'Goleta' },
  { name: 'The Shop Kitchen', yelpUrl: 'https://www.yelp.com/biz/the-shop-kitchen-santa-barbara', location: 'Santa Barbara' },
  { name: 'Pickles and Swiss', yelpUrl: 'https://www.yelp.com/biz/pickles-and-swiss-goleta', location: 'Goleta' },
  { name: 'Noodle City', yelpUrl: 'https://www.yelp.com/biz/noodle-city-goleta', location: 'Goleta' },
  { name: 'La Chapala Market', yelpUrl: 'https://www.yelp.com/biz/la-chapala-market-goleta', location: 'Goleta' },
  { name: 'Los Agaves (Goleta)', yelpUrl: 'https://www.yelp.com/biz/los-agaves-goleta-3?osq=los+agaves+goleta', location: 'Goleta' },
  { name: "Lily's Tacos", yelpUrl: 'https://www.yelp.com/biz/lillys-tacos-goleta?osq=los+agaves+goleta', location: 'Goleta' },
  { name: 'On the Alley', yelpUrl: 'https://www.yelp.com/biz/on-the-alley-goleta-2', location: 'Goleta' },
  { name: 'The Habit', yelpUrl: 'https://www.yelp.com/biz/the-habit-burger-grill-goleta', location: 'Goleta' },
  { name: "Kyle's Kitchen", yelpUrl: null, location: 'Goleta' },
  { name: 'Beachside Bar/Cafe', yelpUrl: 'https://www.yelp.com/biz/beachside-bar-cafe-goleta', location: 'Goleta' },
  { name: 'Jane at the Marketplace', yelpUrl: 'https://www.yelp.com/biz/jane-at-the-marketplace-goleta?osq=goleta+dinner', location: 'Goleta' },
  { name: 'Outpost', yelpUrl: 'https://www.yelp.com/biz/outpost-goleta', location: 'Goleta' },
];

const OUTPUT_FILE = path.join(__dirname, 'restaurant-photos.json');

function extractOgImage(html: string): string | null {
  // Try og:image
  const ogMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)
    || html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i);
  if (ogMatch) return ogMatch[1];

  // Try twitter:image
  const twMatch = html.match(/<meta\s+(?:property|name)="twitter:image"\s+content="([^"]+)"/i)
    || html.match(/content="([^"]+)"\s+(?:property|name)="twitter:image"/i);
  if (twMatch) return twMatch[1];

  // Try yelp CDN image in JSON-LD or img tags
  const yelpImg = html.match(/(https:\/\/s3-media[\d]+\.fl\.yelpcdn\.com\/bphoto\/[^"'\s]+)/);
  if (yelpImg) return yelpImg[1];

  return null;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractPhotoFromPage(page: import('playwright').Page): Promise<string | null> {
  // Method 1: Extract og:image from page source
  const content = await page.content();
  let photo = extractOgImage(content);
  if (photo) return photo;

  // Method 2: Try DOM query for og:image
  try {
    photo = await page.getAttribute('meta[property="og:image"]', 'content', { timeout: 3000 });
    if (photo) return photo;
  } catch { /* no tag */ }

  // Method 3: Grab first Yelp bphoto from any img src
  try {
    const imgSrcs = await page.locator('img[src*="bphoto"]').all();
    for (const img of imgSrcs) {
      const src = await img.getAttribute('src');
      if (src) return src;
    }
  } catch { /* no images */ }

  return null;
}

async function main() {
  // Load existing results to skip already-found restaurants
  let results: Record<string, string> = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`Loaded ${Object.keys(results).length} existing photos\n`);
  }

  const missing = restaurants.filter(r => !results[r.name]);
  console.log(`Fetching photos for ${missing.length} remaining restaurants...\n`);

  if (missing.length === 0) {
    console.log('All restaurants already have photos!');
    return;
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  let success = 0;
  let failed = 0;

  for (const r of missing) {
    const page = await context.newPage();
    try {
      let photo: string | null = null;

      // Determine URL to visit
      const url = r.yelpUrl
        ? r.yelpUrl
        : `https://www.yelp.com/search?find_desc=${encodeURIComponent(r.name)}&find_loc=${encodeURIComponent(r.location + ', CA')}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(2000); // let page hydrate

      // If this was a search page (no direct URL), click first result
      if (!r.yelpUrl) {
        try {
          const bizLink = page.locator('a[href*="/biz/"]').first();
          const href = await bizLink.getAttribute('href', { timeout: 5000 });
          if (href) {
            const bizPath = href.split('?')[0];
            await page.goto(`https://www.yelp.com${bizPath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await delay(2000);
          }
        } catch { /* no search results, continue with page content */ }
      }

      photo = await extractPhotoFromPage(page);

      if (photo && photo.startsWith('http')) {
        // Normalize to original size
        photo = photo.replace(/\/[a-z]+\.jpg$/, '/o.jpg');
        results[r.name] = photo;
        success++;
        console.log(`OK   ${r.name}`);
      } else {
        failed++;
        console.log(`MISS ${r.name}`);
      }
    } catch (err) {
      failed++;
      console.log(`ERR  ${r.name}: ${(err as Error).message.substring(0, 80)}`);
    } finally {
      await page.close();
    }

    // Save after each result in case of crash
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

    // Small delay between requests
    await delay(1000);
  }

  await browser.close();

  console.log(`\nDone: ${success} new photos found, ${failed} missed`);
  console.log(`Total: ${Object.keys(results).length}/${restaurants.length} restaurants have photos`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`Saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
