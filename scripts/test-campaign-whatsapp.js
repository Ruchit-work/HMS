/**
 * Local Testing Script for Campaign WhatsApp Notifications
 * 
 * This script allows you to test campaign generation and WhatsApp sending locally
 * without having to deploy to Vercel.
 * 
 * Usage:
 *   node scripts/test-campaign-whatsapp.js
 *   node scripts/test-campaign-whatsapp.js --send-whatsapp
 *   node scripts/test-campaign-whatsapp.js --check=tomorrow
 * 
 * Environment Variables Required:
 *   - FIREBASE_PROJECT_ID
 *   - FIREBASE_CLIENT_EMAIL
 *   - FIREBASE_PRIVATE_KEY
 *   - TWILIO_ACCOUNT_SID (for WhatsApp)
 *   - TWILIO_AUTH_TOKEN (for WhatsApp)
 *   - TWILIO_WHATSAPP_FROM (for WhatsApp)
 *   - NEXT_PUBLIC_BASE_URL (optional, defaults to http://localhost:3000)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Parse command line arguments
const args = process.argv.slice(2);
const sendWhatsApp = args.includes('--send-whatsapp');
const checkArg = args.find(arg => arg.startsWith('--check='));
const check = checkArg ? checkArg.split('=')[1] : 'today';
const publish = !args.includes('--no-publish');
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testCampaignGeneration() {
  log('\n🚀 Testing Campaign Generation Locally', 'bright');
  log('='.repeat(50), 'cyan');
  
  // Check if server is running
  log('\n📡 Checking if Next.js server is running...', 'blue');
  try {
    const healthCheck = await makeRequest(`${baseUrl}/api/auto-campaigns/test?date=${check}`);
    if (healthCheck.status === 200) {
      log('✅ Server is running!', 'green');
    } else {
      log('⚠️  Server responded with status: ' + healthCheck.status, 'yellow');
    }
  } catch (error) {
    log('❌ Server is not running! Please start the Next.js dev server first:', 'red');
    log('   npm run dev', 'yellow');
    log('   or', 'yellow');
    log('   yarn dev', 'yellow');
    process.exit(1);
  }

  // Check health awareness days
  log(`\n📅 Checking health awareness days for ${check}...`, 'blue');
  try {
    const testResponse = await makeRequest(`${baseUrl}/api/auto-campaigns/test?date=${check}`);
    if (testResponse.status === 200 && testResponse.data.healthDaysFound > 0) {
      log(`✅ Found ${testResponse.data.healthDaysFound} health awareness day(s):`, 'green');
      testResponse.data.healthDays.forEach((day, index) => {
        log(`   ${index + 1}. ${day.name} (${day.date})`, 'cyan');
      });
    } else {
      log(`⚠️  No health awareness days found for ${check}`, 'yellow');
      log(`   Date: ${testResponse.data.dateFormatted || check}`, 'yellow');
      log('   You may need to check healthAwarenessDays.ts for available dates', 'yellow');
      if (!args.includes('--force')) {
        log('\n💡 Tip: Use --force to generate campaigns anyway', 'cyan');
        process.exit(0);
      }
    }
  } catch (error) {
    log('❌ Error checking health awareness days:', 'red');
    log('   ' + error.message, 'red');
    process.exit(1);
  }

  // Generate campaigns
  log(`\n🎯 Generating campaigns for ${check}...`, 'blue');
  log(`   Publish: ${publish ? 'Yes' : 'No'}`, 'cyan');
  log(`   Send WhatsApp: ${sendWhatsApp ? 'Yes' : 'No'}`, 'cyan');
  
  try {
    const generateUrl = `${baseUrl}/api/auto-campaigns/generate?check=${check}&publish=${publish}&sendWhatsApp=${sendWhatsApp}`;
    log(`   URL: ${generateUrl}`, 'cyan');
    
    const generateResponse = await makeRequest(generateUrl);
    
    if (generateResponse.status === 200 && generateResponse.data.success) {
      log('\n✅ Campaign generation successful!', 'green');
      log(`   Campaigns generated: ${generateResponse.data.campaignsGenerated}`, 'green');
      
      if (generateResponse.data.campaignsCreated && generateResponse.data.campaignsCreated.length > 0) {
        log('\n📋 Generated Campaigns:', 'blue');
        generateResponse.data.campaignsCreated.forEach((campaign, index) => {
          log(`   ${index + 1}. ${campaign.title}`, 'cyan');
          log(`      Health Day: ${campaign.healthDay}`, 'cyan');
          log(`      Status: ${campaign.status}`, 'cyan');
          log(`      ID: ${campaign.id}`, 'cyan');
        });
      }
      
      if (sendWhatsApp) {
        log('\n📱 WhatsApp notifications:', 'blue');
        log('   Check your Twilio console for delivery status', 'cyan');
        log('   Or check the server logs for WhatsApp sending details', 'cyan');
      }
      
      log('\n🎉 Test completed successfully!', 'green');
      log('='.repeat(50), 'cyan');
    } else {
      log('\n❌ Campaign generation failed:', 'red');
      log('   ' + JSON.stringify(generateResponse.data, null, 2), 'red');
      process.exit(1);
    }
  } catch (error) {
    log('\n❌ Error generating campaigns:', 'red');
    log('   ' + error.message, 'red');
    process.exit(1);
  }
}

// Run the test
testCampaignGeneration().catch((error) => {
  log('\n❌ Unexpected error:', 'red');
  log('   ' + error.message, 'red');
  console.error(error);
  process.exit(1);
});

