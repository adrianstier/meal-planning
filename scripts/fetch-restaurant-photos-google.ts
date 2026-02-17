/**
 * Fetch restaurant photos via Google search + restaurant websites.
 * Fills in gaps left by Yelp scraping.
 *
 * Usage: npx tsx scripts/fetch-restaurant-photos-google.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';

const restaurants: Array<{ name: string; location: string }> = [
  { name: 'Reunion', location: 'Santa Barbara' },
  { name: 'Kanaloa Seafood', location: 'Santa Barbara' },
  { name: 'Secret Bao', location: 'Santa Barbara' },
  { name: 'Barbareno', location: 'Santa Barbara' },
  { name: 'The Lark', location: 'Santa Barbara' },
  { name: 'Santo Mezcal', location: 'Santa Barbara' },
  { name: 'Lucky Penny', location: 'Santa Barbara' },
  { name: 'Sama Sama', location: 'Santa Barbara' },
  { name: 'The Good Lion', location: 'Santa Barbara' },
  { name: 'Test Pilot', location: 'Santa Barbara' },
  { name: 'Shaker Mill', location: 'Santa Barbara' },
  { name: 'Lab Social', location: 'Santa Barbara' },
  { name: 'Pearl Social', location: 'Santa Barbara' },
  { name: 'Satellite', location: 'Santa Barbara' },
  { name: 'Corazon Comedor', location: 'Santa Barbara' },
  { name: "Jeannine's", location: 'Santa Barbara' },
  { name: "Boathouse at Hendry's", location: 'Santa Barbara' },
  { name: "Renaud's", location: 'Santa Barbara' },
  { name: 'Finch and Fork', location: 'Santa Barbara' },
  { name: "D'Angelo's", location: 'Santa Barbara' },
  { name: 'Hook and Press', location: 'Santa Barbara' },
  { name: 'Oat Bakery', location: 'Santa Barbara' },
  { name: 'Broad Street Oyster Company', location: 'Santa Barbara' },
  { name: 'La Super Rica', location: 'Santa Barbara' },
  { name: 'Los Agaves', location: 'Santa Barbara' },
  { name: 'Los Arroyos', location: 'Santa Barbara' },
  { name: 'South Coast Deli', location: 'Santa Barbara' },
  { name: 'Olio Crudo Bar & Pizzeria', location: 'Santa Barbara' },
  { name: 'Empty Bowl', location: 'Santa Barbara' },
  { name: "Joe's", location: 'Santa Barbara' },
  { name: 'Blue Owl', location: 'Santa Barbara' },
  { name: 'Saint Bibiana', location: 'Santa Barbara' },
  { name: "Mony's Mexican Food", location: 'Santa Barbara' },
  { name: 'Corazon Cocina', location: 'Santa Barbara' },
  { name: 'Shaloob', location: 'Santa Barbara' },
  { name: "McConnell's Ice Cream", location: 'Santa Barbara' },
  { name: 'Handlebar Coffee', location: 'Santa Barbara' },
  { name: 'Dune Coffee', location: 'Santa Barbara' },
  { name: 'Lilac Patisserie', location: 'Santa Barbara' },
  { name: 'Blenders in the Grass', location: 'Santa Barbara' },
  { name: 'M Special Brewery', location: 'Goleta' },
  { name: 'Hollister Brewing Company', location: 'Goleta' },
  { name: 'Draughtsman Aleworks', location: 'Goleta' },
  { name: 'The Mercury Lounge', location: 'Goleta' },
  { name: 'The Imperial', location: 'Goleta' },
  { name: 'Cajun Kitchen Cafe', location: 'Goleta' },
  { name: 'Sage and Onion Cafe', location: 'Goleta' },
  { name: 'Backyard Bowls', location: 'Goleta' },
  { name: 'The Shop Kitchen', location: 'Santa Barbara' },
  { name: 'Pickles and Swiss', location: 'Goleta' },
  { name: 'Noodle City', location: 'Goleta' },
  { name: 'La Chapala Market', location: 'Goleta' },
  { name: 'Los Agaves (Goleta)', location: 'Goleta' },
  { name: "Lily's Tacos", location: 'Goleta' },
  { name: 'On the Alley', location: 'Goleta' },
  { name: 'The Habit', location: 'Goleta' },
  { name: "Kyle's Kitchen", location: 'Goleta' },
  { name: 'Beachside Bar/Cafe', location: 'Goleta' },
  { name: 'Jane at the Marketplace', location: 'Goleta' },
  { name: 'Outpost', location: 'Goleta' },
];

const OUTPUT_FILE = path.join(__dirname, 'restaurant-photos.json');

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isGoodPhoto(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  // Skip generic logos, icons, social media avatars
  if (url.includes('logo') || url.includes('favicon') || url.includes('icon')) return false;
  if (url.includes('googleusercontent.com/maps')) return false; // Google Maps street view
  if (url.includes('avatar') || url.includes('profile')) return false;
  return true;
}

async function main() {
  let results: Record<string, string> = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`Loaded ${Object.keys(results).length} existing photos\n`);
  }

  const missing = restaurants.filter(r => !results[r.name]);
  console.log(`Fetching photos for ${missing.length} remaining restaurants via Google...\n`);

  if (missing.length === 0) {
    console.log('All restaurants already have photos!');
    return;
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  let success = 0;
  let failed = 0;

  for (const r of missing) {
    const page = await context.newPage();
    try {
      // Search Google for the restaurant
      const query = `${r.name} restaurant ${r.location} CA`;
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await delay(2000);

      let photo: string | null = null;

      // Try to find Yelp CDN images in Google Image results (these are restaurant photos)
      const html = await page.content();
      const yelpPhotos = [...html.matchAll(/(https:\/\/s3-media[\d]+\.fl\.yelpcdn\.com\/bphoto\/[^"'\s\\]+)/g)];
      for (const match of yelpPhotos) {
        const url = match[1].replace(/\\u002F/g, '/');
        if (isGoodPhoto(url)) {
          photo = url;
          break;
        }
      }

      // Also try other image URLs from search results
      if (!photo) {
        // Look for high-quality image URLs in the page source
        const imageUrls = [...html.matchAll(/"(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi)];
        for (const match of imageUrls) {
          const url = match[1];
          if (isGoodPhoto(url) && !url.includes('google') && !url.includes('gstatic') && url.length > 50) {
            photo = url;
            break;
          }
        }
      }

      if (photo) {
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

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    await delay(1500);
  }

  await browser.close();

  console.log(`\nDone: ${success} new photos found, ${failed} missed`);
  console.log(`Total: ${Object.keys(results).length}/${restaurants.length} restaurants have photos`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`Saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
