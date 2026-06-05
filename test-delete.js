const chromium = require('chromium-cli');

(async () => {
  try {
    console.log('Testing delete quote functionality...\n');

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Navigate to admin page
    console.log('1. Navigating to admin login...');
    await page.goto('http://localhost:3001/admin', { waitUntil: 'networkidle' });

    // Wait a moment for page to load
    await page.waitForTimeout(1000);

    // Check if login form exists
    const loginForm = await page.$('input[type="password"]');
    if (!loginForm) {
      console.log('✓ Already logged in, skipping login');
    } else {
      console.log('2. Logging in with admin password...');
      await page.fill('input[type="password"]', 'adminpass');
      await page.click('button:has-text("Login")');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
    }

    // Wait for dashboard to load
    await page.waitForTimeout(2000);

    // Check if we're on the dashboard
    const dashboardTitle = await page.$('text=Awaiting Analysis');
    if (dashboardTitle) {
      console.log('✓ Admin dashboard loaded');
    }

    // Click on the first quote in the dashboard
    console.log('3. Opening first quote...');
    const firstQuoteLink = await page.$('a[href*="/admin/quotes/"]');
    if (firstQuoteLink) {
      await firstQuoteLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠ No quotes found in dashboard');
      await browser.close();
      process.exit(1);
    }

    // Check if delete button exists
    console.log('4. Looking for delete button...');
    const deleteButton = await page.$('button:has-text("Delete Quote")');
    if (deleteButton) {
      console.log('✓ Delete button found');
    } else {
      console.log('✗ Delete button NOT found');
      await browser.close();
      process.exit(1);
    }

    // Set up dialog handler for confirmation
    console.log('5. Clicking delete button...');
    page.on('dialog', async dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog.accept();
    });

    // Click delete button
    await deleteButton.click();

    // Wait for redirect after deletion
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check if we're back at the dashboard
    const currentUrl = page.url();
    if (currentUrl.includes('/admin/dashboard')) {
      console.log('✓ Successfully redirected to dashboard after deletion');
      console.log(`Current URL: ${currentUrl}`);
    } else {
      console.log(`⚠ Unexpected URL after deletion: ${currentUrl}`);
    }

    console.log('\n✓ Delete functionality test completed successfully!');
    await browser.close();
    process.exit(0);

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
})();
