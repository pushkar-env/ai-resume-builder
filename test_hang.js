const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
    
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 15000 });
    
    console.log('Page loaded. Evaluating script to click the AI button of the last bullet point of the last experience...');
    
    await page.evaluate(async () => {
      // Wait for the app to render
      await new Promise(r => setTimeout(r, 2000));
      
      // Open Experience section if closed
      const sections = Array.from(document.querySelectorAll('button'));
      const expBtn = sections.find(b => b.textContent && b.textContent.includes('Experience'));
      if (expBtn) {
          expBtn.click();
          await new Promise(r => setTimeout(r, 500));
      }

      // Find all 'Improve with AI' buttons
      const buttons = Array.from(document.querySelectorAll('button[title=\"Improve with AI\"]'));
      console.log('Found AI buttons:', buttons.length);
      
      if (buttons.length > 0) {
        const lastButton = buttons[buttons.length - 1];
        console.log('Clicking the last AI button...');
        lastButton.click();
      } else {
        console.log('No AI buttons found.');
      }
    });
    
    console.log('Waiting 5 seconds to see if it hangs or errors...');
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('Done.');
    await browser.close();
  } catch (e) {
    console.error('Puppeteer error:', e);
    process.exit(1);
  }
})();
