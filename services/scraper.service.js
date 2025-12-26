const puppeteer = require('puppeteer');
const Product = require('../models/Product.model');
const ScrapingJob = require('../models/ScrapingJob.model');
const { v4: uuidv4 } = require('uuid');
const { ProductDetailExtractor } = require("./product_detail_extractor.service");

class ScraperService {
    constructor() {
        this.browser = null;
        this.activeJobs = new Map();
        this.detailExtractor = new ProductDetailExtractor();

        this.platformConfig = {
            taobao: {
                searchUrl: 'https://s.taobao.com/search',
                baseUrl: 'https://www.taobao.com',
                loginUrl: 'https://login.taobao.com/member/login.jhtml',
                itemSelector: 'a[href*="item.taobao.com"][href*="id="]',
                nextButtonSelector: '.next:not(.disabled), .next-next:not(.disabled)',
                paginationType: 'button'
            },
            tmall: {
                searchUrl: 'https://list.tmall.com/search_product.htm',
                baseUrl: 'https://www.tmall.com',
                loginUrl: 'https://login.tmall.com',
                itemSelector: 'a[href*="detail.tmall.com"][href*="id="]',
                nextButtonSelector: '.ui-page-next:not(.ui-page-disabled)',
                paginationType: 'button'
            },
            '1688': {
                searchUrl: 'https://s.1688.com/selloffer/offer_search.htm',
                baseUrl: 'https://www.1688.com',
                loginUrl: 'https://login.1688.com',
                itemSelector: 'a[href*="detail.1688.com"][href*="offer"]',
                nextButtonSelector: '.fui-next:not(.disabled)',
                paginationType: 'url'
            }
        };

        this.config = {
            headless: false,
            scrollDelay: 2000,
            pageLoadDelay: 3000,
            detailPageDelay: 2000,
            maxRetries: 2,
            timeout: 30000,
            scrollStepDelay: 500,
            // Detail scraping configuration
            autoScrapeDetails: true,      // Enable automatic detail scraping
            detailsPerBatch: 10,          // Scrape details in batches
            detailsBatchDelay: 5000,      // Delay between batches
            minExtractionQuality: 50      // Minimum quality threshold (0-100)
        };
    }

    log(jobId, message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = jobId ? `[Job: ${jobId.substring(0, 8)}]` : '[Scraper]';
        console.log(`${timestamp} ${prefix} [${level.toUpperCase()}] ${message}`);
    }

    async initialize() {
        try {
            if (!this.browser) {
                this.log(null, 'Launching browser...');

                const fs = require('fs');
                const { execSync } = require('child_process');

                let launchOptions = {
                    headless: this.config.headless,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-blink-features=AutomationControlled',
                        '--window-size=1920,1080',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process'
                    ],
                    ignoreDefaultArgs: ['--enable-automation'],
                    ignoreHTTPSErrors: true,
                    protocolTimeout: 180000
                };

                const possiblePaths = [
                    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                    '/Applications/Chromium.app/Contents/MacOS/Chromium',
                    '/usr/local/bin/chromium-browser',
                    '/opt/homebrew/bin/chromium'
                ];

                let executablePath = null;
                for (const path of possiblePaths) {
                    if (fs.existsSync(path)) {
                        executablePath = path;
                        this.log(null, `Found browser at: ${path}`);
                        break;
                    }
                }

                if (!executablePath) {
                    try {
                        const chromiumPath = execSync('which chromium-browser 2>/dev/null || which chromium', {
                            encoding: 'utf-8',
                            stdio: 'pipe'
                        }).trim();
                        if (chromiumPath) {
                            executablePath = chromiumPath;
                            this.log(null, `Found browser at: ${chromiumPath}`);
                        }
                    } catch (e) {
                        // ignore
                    }
                }

                if (executablePath) {
                    launchOptions.executablePath = executablePath;
                }

                this.browser = await puppeteer.launch(launchOptions);
                this.log(null, 'Browser launched successfully');
            }
            return this.browser;
        } catch (error) {
            this.log(null, `Failed to launch browser: ${error.message}`, 'error');
            throw error;
        }
    }

    async createPage() {
        try {
            const browser = await this.initialize();
            const page = await browser.newPage();

            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                window.chrome = { runtime: {} };
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            });

            this.log(null, 'Page created successfully');
            return page;
        } catch (error) {
            this.log(null, `Failed to create page: ${error.message}`, 'error');
            throw error;
        }
    }

    async startJob(params) {
        const jobId = uuidv4();
        this.log(jobId, `Creating new job with params: ${JSON.stringify(params)}`);

        try {
            const job = new ScrapingJob({
                jobId,
                platform: params.platform,
                searchType: params.searchType,
                searchParams: params,
                status: 'pending'
            });
            await job.save();
            this.log(jobId, 'Job created in database');

            this.executeJob(jobId, params).catch(err => {
                this.log(jobId, `Job execution error: ${err.message}`, 'error');
                console.error(`Full error for job ${jobId}:`, err);
            });

            return { jobId, status: 'started' };
        } catch (error) {
            this.log(jobId, `Failed to start job: ${error.message}`, 'error');
            throw error;
        }
    }

    async executeJob(jobId, params) {
        this.log(jobId, 'Starting job execution');
        const job = await ScrapingJob.findOne({ jobId });
        if (!job) {
            this.log(jobId, 'Job not found in database', 'error');
            return;
        }

        job.status = 'running';
        job.startedAt = new Date();
        await job.save();
        this.log(jobId, 'Job status updated to running');

        this.activeJobs.set(jobId, { status: 'running', cancelRequested: false });

        let page;
        try {
            page = await this.createPage();
            this.log(jobId, 'Browser page created');

            // PHASE 1: Search and collect basic product info
            this.log(jobId, `=== PHASE 1: SEARCH & COLLECT ===`);
            this.log(jobId, `Starting search: ${params.searchType}`);
            let products = await this.scrapeProducts(page, params, job);
            this.log(jobId, `Search completed. Found ${products.length} products`);

            // PHASE 2: Scrape detailed product information
            if (this.config.autoScrapeDetails && products.length > 0 && params.includeDetails !== false) {
                this.log(jobId, `=== PHASE 2: DETAIL EXTRACTION ===`);
                this.log(jobId, `Starting detail extraction for ${products.length} products`);
                products = await this.scrapeAllProductDetails(page, products, job);
            } else {
                this.log(jobId, 'Skipping detail extraction (disabled or no products)');
            }

            // PHASE 3: Save products
            this.log(jobId, `=== PHASE 3: SAVING TO DATABASE ===`);
            let newCount = 0;
            let updatedCount = 0;
            for (const productData of products) {
                try {
                    const result = await this.saveProduct(productData, params.platform);
                    if (result.isNew) {
                        newCount++;
                    } else {
                        updatedCount++;
                    }
                } catch (saveError) {
                    this.log(jobId, `Failed to save product ${productData.itemId}: ${saveError.message}`, 'error');
                }
            }

            this.log(jobId, `Save Summary: ${newCount} new, ${updatedCount} updated | Total: ${newCount + updatedCount}/${products.length} products`);

            job.status = 'completed';
            job.results.totalProducts = newCount;
            job.results.updatedProducts = updatedCount;
            job.results.detailsScraped = products.filter(p => p.detailsScraped).length;
            job.completedAt = new Date();

        } catch (error) {
            this.log(jobId, `Job failed: ${error.message}`, 'error');
            console.error(`Full error stack for job ${jobId}:`, error);

            job.status = 'failed';
            job.error = `${error.message}\n\nStack: ${error.stack}`;

            if (page) {
                try {
                    const screenshotPath = `./error_${jobId}.png`;
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                    this.log(jobId, `Error screenshot saved: ${screenshotPath}`);
                } catch (screenshotError) {
                    this.log(jobId, `Failed to capture screenshot: ${screenshotError.message}`, 'error');
                }
            }
        } finally {
            if (page) {
                await page.close().catch(err => this.log(jobId, `Failed to close page: ${err.message}`, 'error'));
            }
            await job.save();
            this.activeJobs.delete(jobId);
            this.log(jobId, `Job finished with status: ${job.status}`);
        }
    }

    async scrapeProducts(page, params, job) {
        const { platform, maxProducts = 100, maxPages = 10 } = params;
        const config = this.platformConfig[platform];

        const searchUrl = this.buildSearchUrl(platform, config, params);
        this.log(job.jobId, `Navigating to: ${searchUrl}`);

        try {
            await page.goto(searchUrl, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });
            this.log(job.jobId, 'Page loaded successfully');

            await this.delay(this.config.pageLoadDelay);

            const url = page.url();
            if (url.includes('login') || url.includes('verify') || url.includes('sec.taobao.com')) {
                throw new Error('Hit verification/login page. Please handle captcha or login manually.');
            }

            await page.screenshot({ path: `./debug_${job.jobId}_page1.png` });
            this.log(job.jobId, 'Debug screenshot saved');

        } catch (error) {
            this.log(job.jobId, `Navigation failed: ${error.message}`, 'error');
            throw new Error(`Failed to load search page: ${error.message}`);
        }

        const allProducts = [];
        const globalSeenIds = new Set();
        let currentPage = 1;
        let consecutiveEmptyPages = 0;

        while (currentPage <= maxPages && allProducts.length < maxProducts) {
            this.log(job.jobId, `Scraping page ${currentPage}`);

            try {
                // Scroll FIRST to load lazy-loaded content
                await this.smartScroll(page, platform, config.itemSelector);

                // Wait a bit after scrolling for content to render
                await this.delay(1000);

                const pageProducts = await this.extractProducts(page, platform, params, currentPage);

                if (pageProducts.length === 0) {
                    consecutiveEmptyPages++;
                    this.log(job.jobId, `Page ${currentPage}: No products found (${consecutiveEmptyPages} consecutive empty pages)`);

                    if (consecutiveEmptyPages >= 2) {
                        this.log(job.jobId, 'Too many consecutive empty pages, stopping');
                        break;
                    }
                } else {
                    consecutiveEmptyPages = 0;
                }

                const newProducts = pageProducts.filter(product => {
                    if (globalSeenIds.has(product.itemId)) {
                        return false;
                    }
                    globalSeenIds.add(product.itemId);
                    return true;
                });

                this.log(job.jobId, `Page ${currentPage}: Extracted ${pageProducts.length} products (${newProducts.length} new, ${pageProducts.length - newProducts.length} duplicates)`);
                allProducts.push(...newProducts);

                job.progress.currentPage = currentPage;
                job.progress.productsScraped = allProducts.length;
                await job.save();

                if (allProducts.length >= maxProducts) {
                    this.log(job.jobId, `Reached max products limit (${maxProducts})`);
                    break;
                }

                const hasNext = await this.hasNextPage(page, platform, config);
                if (!hasNext) {
                    this.log(job.jobId, 'No more pages available');
                    break;
                }

                const navigated = await this.goToNextPage(page, platform, config, currentPage);
                if (!navigated) {
                    this.log(job.jobId, 'Failed to navigate to next page');
                    break;
                }

                currentPage++;
                await this.delay(this.config.pageLoadDelay);

            } catch (pageError) {
                this.log(job.jobId, `Error on page ${currentPage}: ${pageError.message}`, 'error');
                await page.screenshot({ path: `./error_page_${currentPage}_${job.jobId}.png` }).catch(() => {});
                break;
            }
        }

        this.log(job.jobId, `Total unique products collected: ${allProducts.length}`);
        return allProducts.slice(0, maxProducts);
    }

    buildSearchUrl(platform, config, params) {
        if (params.searchType === 'keyword') {
            const keyword = params.keyword;
            return platform === '1688'
                ? `${config.searchUrl}?keywords=${encodeURIComponent(keyword)}`
                : `${config.searchUrl}?q=${encodeURIComponent(keyword)}`;
        } else if (params.searchType === 'category') {
            const categoryId = params.categoryId;
            if (platform === 'taobao') {
                return `https://s.taobao.com/search?catId=${categoryId}`;
            } else if (platform === 'tmall') {
                return `https://list.tmall.com/search_product.htm?cat=${categoryId}`;
            } else if (platform === '1688') {
                return `https://s.1688.com/selloffer/offer_search.htm?categoryId=${categoryId}`;
            }
        }
        throw new Error('Invalid search type or missing parameters');
    }

    async smartScroll(page, platform, itemSelector, maxScrolls = 15) {
        this.log(null, `Starting smart scroll with selector: ${itemSelector}`);

        let previousHeight = 0;
        let stableCount = 0;
        let previousCount = 0;

        for (let i = 0; i < maxScrolls; i++) {
            const metrics = await page.evaluate((selector) => {
                const items = document.querySelectorAll(selector);
                return {
                    scrollHeight: document.documentElement.scrollHeight,
                    itemCount: items.length,
                    scrollY: window.scrollY
                };
            }, itemSelector);

            this.log(null, `Scroll ${i + 1}: Found ${metrics.itemCount} items, height: ${metrics.scrollHeight}px`);

            if (metrics.scrollHeight === previousHeight && metrics.itemCount === previousCount) {
                stableCount++;
                if (stableCount >= 3) {
                    this.log(null, 'Page content stable, stopping scroll');
                    break;
                }
            } else {
                stableCount = 0;
            }

            previousHeight = metrics.scrollHeight;
            previousCount = metrics.itemCount;

            await page.evaluate(() => {
                window.scrollBy({
                    top: Math.floor(Math.random() * 600) + 600,
                    behavior: 'smooth'
                });
            });

            const randomDelay = Math.floor(Math.random() * 1000) + this.config.scrollStepDelay + 500;
            await this.delay(randomDelay);

            if (i % 5 === 0) {
                await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
                await this.delay(1000);
            }
        }

        await page.evaluate(() => window.scrollTo(0, 0));
        await this.delay(500);
    }

    async extractProducts(page, platform, params, pageNumber) {
        try {
            const config = this.platformConfig[platform];
            const keyword = params.keyword || null;
            const categoryId = params.categoryId || null;
            const categoryName = params.categoryName || null;
            const PRODUCTS_PER_PAGE = 50;

            return await page.evaluate((platform, keyword, pageNum, catId, catName, selector, productsPerPage) => {
                const results = [];
                const seen = new Set();

                let links;
                if (platform === 'taobao') {
                    links = document.querySelectorAll('a[href*="item.taobao.com"][href*="id="], div[data-atp] a');
                } else if (platform === 'tmall') {
                    links = document.querySelectorAll('a[href*="detail.tmall.com"][href*="id="]');
                } else if (platform === '1688') {
                    links = document.querySelectorAll('a[href*="detail.1688.com"][href*="offer"]');
                }

                if (!links || links.length === 0) {
                    console.log('No product links found on page');
                    return results;
                }

                for (const item of links) {
                    if (results.length >= productsPerPage) break;

                    try {
                        let itemId;
                        if (platform === '1688') {
                            itemId = item.href.match(/offer\/(\d+)\.html/)?.[1];
                        } else {
                            itemId = item.href.match(/[?&]id=(\d+)/)?.[1];
                        }

                        if (!itemId || seen.has(itemId)) continue;
                        seen.add(itemId);

                        const container = item.closest('[class*="item"]') ||
                            item.closest('[class*="Card"]') ||
                            item.closest('[data-atp]') ||
                            item.parentElement;

                        const priceEl = container?.querySelector('[class*="price"], [class*="Price"], .price, strong');
                        const priceText = priceEl?.textContent || '';
                        const price = priceText.match(/[\d.]+/)?.[0];

                        if (!price) continue;

                        const title = item.textContent?.trim() || item.title || item.getAttribute('title');
                        if (!title || title.length < 3) continue;

                        const img = container?.querySelector('img');
                        let image = img?.src || img?.dataset?.src || img?.getAttribute('data-src') || '';
                        if (image.startsWith('//')) image = 'https:' + image;

                        results.push({
                            itemId,
                            title: title.substring(0, 200),
                            price,
                            image,
                            link: item.href,
                            searchKeyword: keyword,
                            categoryId: catId,
                            categoryName: catName,
                            pageNumber: pageNum,
                            extractedAt: new Date().toISOString()
                        });
                    } catch (itemError) {
                        console.error('Error extracting item:', itemError);
                    }
                }

                return results;
            }, platform, keyword, pageNumber, categoryId, categoryName, config.itemSelector, PRODUCTS_PER_PAGE);
        } catch (error) {
            this.log(null, `Error extracting products: ${error.message}`, 'error');
            return [];
        }
    }

    async hasNextPage(page, platform, config) {
        try {
            return await page.evaluate((selector) => {
                const nextButton = document.querySelector(selector);
                if (!nextButton) return false;

                const isDisabled = nextButton.classList.contains('disabled') ||
                    nextButton.classList.contains('ui-page-disabled') ||
                    nextButton.hasAttribute('disabled') ||
                    nextButton.getAttribute('aria-disabled') === 'true';

                const style = window.getComputedStyle(nextButton);
                const isVisible = style.display !== 'none' && style.visibility !== 'hidden';

                return !isDisabled && isVisible;
            }, config.nextButtonSelector);
        } catch (error) {
            this.log(null, `Error checking next page: ${error.message}`, 'error');
            return false;
        }
    }

    async goToNextPage(page, platform, config, currentPage) {
        try {
            this.log(null, `Attempting to go to page ${currentPage + 1}`);

            if (config.paginationType === 'button') {
                const clicked = await page.evaluate((selector) => {
                    const nextButton = document.querySelector(selector);
                    if (nextButton) {
                        nextButton.click();
                        return true;
                    }
                    return false;
                }, config.nextButtonSelector);

                if (!clicked) {
                    this.log(null, 'Next button not found or not clickable', 'warn');
                    return false;
                }

                await Promise.race([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
                    this.delay(3000)
                ]);

            } else {
                const currentUrl = page.url();
                const nextPageNum = currentPage + 1;

                let nextUrl;
                if (currentUrl.includes('page=')) {
                    nextUrl = currentUrl.replace(/([?&])page=\d+/, `$1page=${nextPageNum}`);
                } else {
                    const separator = currentUrl.includes('?') ? '&' : '?';
                    nextUrl = currentUrl + `${separator}page=${nextPageNum}`;
                }

                this.log(null, `Navigating to: ${nextUrl}`);

                await page.goto(nextUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 60000
                });
            }

            await this.delay(this.config.pageLoadDelay);
            return true;

        } catch (error) {
            this.log(null, `Navigation to next page failed: ${error.message}`, 'error');
            return false;
        }
    }

    // ============ DETAIL SCRAPING METHODS ============

    async scrapeAllProductDetails(page, products, job) {
        const productsWithDetails = [];
        let successCount = 0;
        let failCount = 0;
        const totalProducts = products.length;

        for (let i = 0; i < products.length; i++) {
            const product = products[i];

            // Check if job was cancelled
            const jobInfo = this.activeJobs.get(job.jobId);
            if (jobInfo?.cancelRequested) {
                this.log(job.jobId, 'Detail scraping cancelled by user');
                break;
            }

            this.log(job.jobId, `[${i + 1}/${totalProducts}] ${product.itemId} - ${product.title.substring(0, 40)}...`);

            try {
                const details = await this.scrapeProductDetailsInternal(page, product);

                if (details && details.dataQuality.completeness >= this.config.minExtractionQuality) {
                    product.detailedInfo = details;
                    product.detailsScraped = true;
                    product.detailsScrapedAt = new Date();
                    product.extractionQuality = details.dataQuality.completeness;
                    successCount++;

                    this.log(job.jobId, `  ✅ Quality: ${details.dataQuality.completeness}%`);

                    if (details.variants && Object.keys(details.variants).length > 0) {
                        const variantTypes = Object.keys(details.variants).join(', ');
                        const variantCounts = Object.values(details.variants).map(v => v.length).join(', ');
                        this.log(job.jobId, `  📦 Variants: ${variantTypes} (${variantCounts} options)`);
                    }
                } else {
                    product.detailsScraped = false;
                    failCount++;
                    const quality = details?.dataQuality?.completeness || 0;
                    this.log(job.jobId, `  ⚠️  Low quality (${quality}%) or no data`);
                }
            } catch (error) {
                product.detailsScraped = false;
                failCount++;
                this.log(job.jobId, `  ❌ Error: ${error.message}`, 'warn');
            }

            productsWithDetails.push(product);

            // Update job progress
            job.progress.detailsScraped = successCount;
            job.progress.detailsFailed = failCount;
            await job.save();

            // Batch delay
            if ((i + 1) % this.config.detailsPerBatch === 0 && i < products.length - 1) {
                this.log(job.jobId, `Batch complete (${i + 1}/${totalProducts}). Resting...`);
                await this.delay(this.config.detailsBatchDelay);
            } else if (i < products.length - 1) {
                const delay = 2000 + Math.random() * 2000;
                await this.delay(delay);
            }
        }

        this.log(job.jobId, `\nDetail Extraction Summary:`);
        this.log(job.jobId, `  ✅ Success: ${successCount}/${totalProducts} (${((successCount/totalProducts)*100).toFixed(1)}%)`);
        this.log(job.jobId, `  ❌ Failed: ${failCount}`);

        return productsWithDetails;
    }

    async scrapeProductDetailsInternal(page, product, retryCount = 0) {
        try {
            await page.goto(product.link, {
                waitUntil: 'domcontentloaded',
                timeout: this.config.timeout
            });

            await page.waitForSelector('body', { timeout: 5000 });
            await this.delay(this.config.detailPageDelay);

            const currentUrl = page.url();
            if (currentUrl.includes('login') || currentUrl.includes('verify') || currentUrl.includes('sec.taobao.com')) {
                this.log(null, 'Hit verification/login page on detail page', 'warn');
                return null;
            }

            // Scroll to load lazy content
            await this.smartScroll(page, product.platform, 'img', 10);
            await this.delay(1000);

            // Extract details using the enhanced extractor
            const details = await this.detailExtractor.extractProductDetails(page, product.platform);

            return details;

        } catch (error) {
            if (retryCount < this.config.maxRetries) {
                this.log(null, `  🔄 Retry ${retryCount + 1}/${this.config.maxRetries}`, 'info');
                await this.delay(2000);
                return await this.scrapeProductDetailsInternal(page, product, retryCount + 1);
            }

            try {
                await page.screenshot({
                    path: `./error_detail_${product.itemId}.png`,
                    fullPage: false
                });
            } catch (screenshotError) {
                // Ignore screenshot errors
            }

            throw error;
        }
    }

    // Public method for scraping single product details (backward compatibility)
    async scrapeProductDetails(productId, retryCount = 0) {
        const product = await Product.findOne({ itemId: productId });
        if (!product || product.detailsScraped) return product;

        const page = await this.createPage();

        try {
            const details = await this.scrapeProductDetailsInternal(page, product);

            if (details && details.dataQuality.completeness >= this.config.minExtractionQuality) {
                product.detailedInfo = details;
                product.detailsScraped = true;
                product.detailsScrapedAt = new Date();
                product.extractionQuality = details.dataQuality.completeness;
                await product.save();
                await page.close();

                this.log(null, `Product ${productId} details scraped successfully (${details.dataQuality.completeness}%)`);
                return product;
            } else {
                throw new Error(`Low extraction quality: ${details?.dataQuality?.completeness || 0}%`);
            }

        } catch (error) {
            this.log(null, `Error scraping details for ${productId}: ${error.message}`, 'warn');
            await page.close();

            if (retryCount < this.config.maxRetries) {
                await this.delay(2000);
                return await this.scrapeProductDetails(productId, retryCount + 1);
            }

            return null;
        }
    }

    // ============ SAVE & UTILITY METHODS ============

    async saveProduct(productData, platform) {
        const existingProduct = await Product.findOne({ itemId: productData.itemId });

        if (existingProduct) {
            // Update existing product
            Object.assign(existingProduct, productData);
            existingProduct.updatedAt = new Date();

            // Preserve detail scraping status if already scraped
            if (existingProduct.detailsScraped && !productData.detailsScraped) {
                existingProduct.detailsScraped = true;
            }

            await existingProduct.save();
            return { product: existingProduct, isNew: false };
        } else {
            // Create new product
            const product = new Product({
                ...productData,
                platform,
                detailsScraped: productData.detailsScraped || false
            });
            await product.save();
            return { product, isNew: true };
        }
    }

    async getJobStatus(jobId) {
        const job = await ScrapingJob.findOne({ jobId });
        return job;
    }

    async cancelJob(jobId) {
        const jobInfo = this.activeJobs.get(jobId);
        if (jobInfo) {
            jobInfo.cancelRequested = true;
        }

        const job = await ScrapingJob.findOne({ jobId });
        if (job && job.status === 'running') {
            job.status = 'cancelled';
            await job.save();
        }

        return { success: true };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.log(null, 'Browser closed and cleaned up');
        }
    }
}

module.exports = new ScraperService();