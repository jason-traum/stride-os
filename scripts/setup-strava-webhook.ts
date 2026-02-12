/**
 * Script to register Strava webhook subscription
 * Run this once after deploying your webhook endpoint
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const envPath = join(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex !== -1) {
          let value = trimmed.substring(eqIndex + 1);
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[trimmed.substring(0, eqIndex)] = value;
        }
      }
    });
  }
}

async function createWebhookSubscription() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'stride-os-webhook-2024';

  if (!clientId || !clientSecret) {
    console.error('❌ Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET');
    process.exit(1);
  }

  // Your production URL
  const callbackUrl = 'https://stride-os.vercel.app/api/strava/webhook';

  console.log('Creating Strava webhook subscription...');
  console.log('Callback URL:', callbackUrl);
  console.log('Verify Token:', verifyToken);

  try {
    // First, check existing subscriptions
    const checkResponse = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`
    );

    if (checkResponse.ok) {
      const existingSubs = await checkResponse.json();
      console.log('\nExisting subscriptions:', existingSubs);

      // Delete existing subscriptions if any
      for (const sub of existingSubs) {
        console.log(`\nDeleting subscription ${sub.id}...`);
        const deleteResponse = await fetch(
          `https://www.strava.com/api/v3/push_subscriptions/${sub.id}?client_id=${clientId}&client_secret=${clientSecret}`,
          { method: 'DELETE' }
        );
        console.log('Delete response:', deleteResponse.status);
      }
    }

    // Create new subscription
    console.log('\nCreating new subscription...');
    const createResponse = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        callback_url: callbackUrl,
        verify_token: verifyToken,
      }),
    });

    const result = await createResponse.json();

    if (createResponse.ok) {
      console.log('\n✅ Webhook subscription created successfully!');
      console.log('Subscription ID:', result.id);
      console.log('\n⚠️  IMPORTANT: Add this to your .env.local and Vercel environment variables:');
      console.log(`STRAVA_WEBHOOK_VERIFY_TOKEN=${verifyToken}`);
    } else {
      console.error('\n❌ Failed to create subscription:', result);
      if (result.errors) {
        result.errors.forEach((error: any) => {
          console.error(`  - ${error.resource}: ${error.field} ${error.code}`);
        });
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// Load environment and run
loadEnv();
createWebhookSubscription();