class ProductDetailExtractor {
    constructor() {
        this.strategies = {
            title: [
                '.MainTitle--PiA4nmJz .mainTitle--R75fTcZL',
                '[class*="MainTitle"] [class*="mainTitle"]',
                '.tb-detail-hd h1',
                'h1[class*="title"]',
                '.item-title',
                '[class*="ItemTitle"]',
                'meta[property="og:title"]',
            ],
            price: [
                '.highlightPrice--LlVWiXXs .text--LP7Wf49z',
                '[class*="highlightPrice"] [class*="text"]',
                '.tb-rmb-num',
                '[class*="price"] [class*="num"]',
                'em[class*="price"]',
                '.price strong',
            ],
            originalPrice: [
                '.subPrice--KfQ0yn4v .text--LP7Wf49z',
                '[class*="subPrice"] [class*="text"]',
                '.tb-price del',
            ],
            salesVolume: [
                '.salesDesc--Z35wP98o',
                '[class*="salesDesc"]',
                '[class*="sold"]',
                '.tb-sold-out',
                '.tb-detail-sellCount',
                '[class*="sold-count"]',
                '[class*="sales"]',
                '[class*="salesVolume"]',
            ],
            rating: [
                '.starNum--v3iriltd',
                '[class*="starNum"]',
                '[class*="rating"] [class*="num"]',
                '.tb-rate-star',
                '[class*="rate-star"]',
            ],
            shopName: [
                '.shopName--cSjM9uKk',
                '[class*="shopName"]',
                '.tb-shop-name',
                '[class*="shop-name"]',
                '[class*="seller-name"]',
            ],
            description: [
                '#imageTextInfo-content',
                '.desc-root',
                '[class*="tabDetailItem"]',
                '#description',
                '.tb-detail-hd',
                '.item-desc',
                '[class*="description"]',
            ],
            images: {
                gallery: [
                    '.thumbnailPic--QasTmWDm',
                    '[class*="thumbnail"] img',
                    '.tb-thumb img',
                    '#J_UlThumb img',
                ],
                detail: [
                    '.descV8-singleImage img',
                    '#imageTextInfo-container img',
                ]
            },
            sku: {
                container: [
                    '.skuItem--Z2AJB9Ew',
                    '[class*="skuItem"]',
                    '.tb-sku',
                    '[class*="sku-item"]',
                    '[class*="property-item"]'
                ],
                label: [
                    '.ItemLabel--psS1SOyC span',
                    '[class*="ItemLabel"] span',
                    'dt',
                    '[class*="label"]',
                    '.tb-property-type',
                    '[class*="title"]'
                ],
                values: [
                    '.valueItem--smR4pNt4',
                    '[class*="valueItem"]',
                    'li[class*="sku"]',
                    'dd',
                    'li',
                    '[class*="skuValue"]'
                ]
            },
            sizeSelectors: [
                '[class*="size"] li',
                '[class*="Size"] li',
                '[data-property*="size"]',
                '[data-attr*="size"]',
                'ul[class*="size"] a',
                'div[class*="size-list"] span'
            ],
            colorSelectors: [
                '[class*="color"] li',
                '[class*="Color"] li',
                '[data-property*="color"]',
                '[data-attr*="color"]',
                'ul[class*="color"] a',
                'div[class*="color-list"] span'
            ],
            specs: {
                emphasis: [
                    '.emphasisParamsInfoItem--H5Qt3iog',
                    '[class*="emphasisParams"]'
                ],
                general: [
                    '.generalParamsInfoItem--qLqLDVWp',
                    '[class*="generalParams"]',
                    '.attributes-list li',
                    '.tb-property-type',
                    '[class*="property"]'
                ]
            },
            reviewCount: [
                '[class*="tabDetailItemTitle"]',
                '[class*="comment"] [class*="count"]',
                '[class*="rate-count"]',
                '.tb-rate-counter'
            ],
            stockStatus: [
                '.tb-amount',
                '[class*="stock"]',
                '[class*="inventory"]'
            ],
            shipping: [
                '[class*="shipping"]',
                '[class*="delivery"]',
                '.tb-shipping'
            ],
            brand: [
                '.tb-brand',
                '[class*="brand"]',
                '[class*="Brand"]'
            ]
        };
    }

    async extractProductDetails(page, platform) {
        const strategies = this.strategies;

        return await page.evaluate((strategies, platform) => {
            const result = {
                platform,
                extractedAt: new Date().toISOString(),
                extractionStrategies: {}
            };

            // Helper function to try multiple selectors
            const trySelectors = (selectors, extractFn = null) => {
                for (const selector of selectors) {
                    try {
                        const elem = document.querySelector(selector);
                        if (elem) {
                            if (extractFn) {
                                const res = extractFn(elem);
                                if (res) return { value: res, selector };
                            } else {
                                const text = elem.textContent?.trim();
                                if (text && text.length > 0) return { value: text, selector };
                            }
                        }
                    } catch (e) { continue; }
                }
                return null;
            };

            // ============ BASIC INFORMATION ============

            // TITLE
            const titleResult = trySelectors(strategies.title);
            if (titleResult) {
                result.fullTitle = titleResult.value;
                result.extractionStrategies.title = titleResult.selector;
            } else {
                const metaTitle = document.querySelector('meta[property="og:title"]');
                if (metaTitle) result.fullTitle = metaTitle.getAttribute('content');
            }

            // PRICE
            const priceResult = trySelectors(strategies.price, (elem) => {
                const match = elem.textContent.match(/[\d,.]+/);
                return match ? match[0].replace(/,/g, '') : null;
            });
            if (priceResult) {
                result.price = priceResult.value;
                result.extractionStrategies.price = priceResult.selector;
            }

            // ORIGINAL PRICE
            const origPriceResult = trySelectors(strategies.originalPrice, (elem) => {
                const match = elem.textContent.match(/[\d,.]+/);
                return match ? match[0].replace(/,/g, '') : null;
            });
            if (origPriceResult) result.originalPrice = origPriceResult.value;

            // SALES VOLUME - FIXED: Better extraction
            const salesResult = trySelectors(strategies.salesVolume, (elem) => {
                const text = elem.textContent;
                const match = text.match(/(\d+[\d,]*)/);
                return match ? match[1].replace(/,/g, '') : null;
            });
            if (salesResult) {
                result.salesVolume = salesResult.value;
                result.extractionStrategies.salesVolume = salesResult.selector;
            }

            // RATING
            const ratingResult = trySelectors(strategies.rating, (elem) => {
                const match = elem.textContent.match(/([\d.]+)/);
                return match ? match[1] : elem.textContent.trim();
            });
            if (ratingResult) result.rating = ratingResult.value;

            // SHOP NAME - FIXED: Better extraction
            const shopResult = trySelectors(strategies.shopName);
            if (shopResult) {
                result.shopName = shopResult.value;
                result.extractionStrategies.shopName = shopResult.selector;
            }

            // DESCRIPTION
            const descResult = trySelectors(strategies.description, (elem) => {
                const text = elem.textContent?.trim();
                return text && text.length > 50 ? text.substring(0, 2000) : null;
            });
            if (descResult) {
                result.fullDescription = descResult.value;
                result.extractionStrategies.description = descResult.selector;
            }

            // BRAND
            const brandResult = trySelectors(strategies.brand);
            if (brandResult) result.brand = brandResult.value;

            // ============ IMAGES ============

            const images = new Set();

            // Gallery images
            for (const selector of strategies.images.gallery) {
                const imgs = document.querySelectorAll(selector);
                imgs.forEach(img => {
                    let src = img.src || img.dataset.src || img.getAttribute('data-src');
                    if (src && src !== '//g.alicdn.com/s.gif') {
                        if (src.startsWith('//')) src = 'https:' + src;
                        src = src.split('_')[0].replace(/\.webp$/, '');
                        images.add(src);
                    }
                });
                if (images.size > 0) {
                    result.extractionStrategies.galleryImages = selector;
                    break;
                }
            }

            // Detail images
            for (const selector of strategies.images.detail) {
                const imgs = document.querySelectorAll(selector);
                imgs.forEach(img => {
                    let src = img.dataset.src || img.src;
                    if (src && src !== '//g.alicdn.com/s.gif') {
                        if (src.startsWith('//')) src = 'https:' + src;
                        images.add(src);
                    }
                });
                if (images.size > 5) break;
            }

            result.additionalImages = Array.from(images).slice(0, 30);

            // ============ VARIANTS EXTRACTION (ENHANCED) ============

            const variants = {};
            let skuStrategy = null;

            // METHOD 1: Standard SKU Container Approach
            for (const containerSelector of strategies.sku.container) {
                const skuItems = document.querySelectorAll(containerSelector);
                if (skuItems.length === 0) continue;

                skuItems.forEach(skuGroup => {
                    let label = null;
                    for (const labelSelector of strategies.sku.label) {
                        const labelElem = skuGroup.querySelector(labelSelector);
                        if (labelElem) {
                            label = labelElem.textContent.trim();
                            break;
                        }
                    }
                    if (!label) return;

                    const options = [];
                    for (const valueSelector of strategies.sku.values) {
                        const valueItems = skuGroup.querySelectorAll(valueSelector);
                        if (valueItems.length === 0) continue;

                        valueItems.forEach(item => {
                            const isDisabled = item.getAttribute('data-disabled') === 'true' ||
                                item.classList.contains('disabled');
                            if (isDisabled) return;

                            const text = item.textContent.trim();
                            if (text && text.length > 0 && text.length < 100) {
                                const option = { value: text };

                                // Check for image
                                const img = item.querySelector('img');
                                if (img) {
                                    let imgSrc = img.src || img.dataset.src;
                                    if (imgSrc && imgSrc.startsWith('//')) imgSrc = 'https:' + imgSrc;
                                    if (imgSrc) option.image = imgSrc;
                                }

                                // Check for variant ID
                                const vid = item.getAttribute('data-vid') || item.getAttribute('data-value');
                                if (vid) option.vid = vid;

                                options.push(option);
                            }
                        });
                        if (options.length > 0) break;
                    }
                    if (options.length > 0) variants[label] = options;
                });

                if (Object.keys(variants).length > 0) {
                    skuStrategy = containerSelector;
                    break;
                }
            }

            // METHOD 2: Size-Specific Extraction
            const sizeKeys = ['Size', '尺寸', '尺码', 'size'];
            const hasSizeVariant = sizeKeys.some(key => variants[key]);

            if (!hasSizeVariant) {
                for (const selector of strategies.sizeSelectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        const sizes = Array.from(elements)
                            .map(el => {
                                const text = el.textContent.trim();
                                const title = el.title || el.getAttribute('data-value');
                                return { value: title || text };
                            })
                            .filter(s => s.value && s.value.length < 20 && /[SMLX\d]/.test(s.value));

                        if (sizes.length > 0) {
                            const uniqueSizes = sizes.reduce((acc, curr) => {
                                if (!acc.find(item => item.value === curr.value)) {
                                    acc.push(curr);
                                }
                                return acc;
                            }, []).slice(0, 30);

                            variants['Size'] = uniqueSizes;
                            result.extractionStrategies.sizes = selector;
                            break;
                        }
                    }
                }
            }

            // METHOD 3: Color-Specific Extraction - FIXED: Better structure
            const colorKeys = ['Color', '颜色', '颜色分类', 'color'];
            const hasColorVariant = colorKeys.some(key => variants[key]);

            if (!hasColorVariant) {
                for (const selector of strategies.colorSelectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        const colors = Array.from(elements)
                            .map(el => {
                                const text = el.textContent.trim();
                                const title = el.title || el.getAttribute('data-value');

                                // Check for image (color swatch)
                                const img = el.querySelector('img');
                                let imgSrc = null;
                                if (img) {
                                    imgSrc = img.src || img.dataset.src;
                                    if (imgSrc && imgSrc.startsWith('//')) imgSrc = 'https:' + imgSrc;
                                }

                                return {
                                    value: title || text,
                                    image: imgSrc || undefined
                                };
                            })
                            .filter(c => c.value && c.value.length < 50);

                        if (colors.length > 0) {
                            const uniqueColors = colors.reduce((acc, curr) => {
                                if (!acc.find(item => item.value === curr.value)) {
                                    acc.push(curr);
                                }
                                return acc;
                            }, []).slice(0, 30);

                            variants['Color'] = uniqueColors;
                            result.extractionStrategies.colors = selector;
                            break;
                        }
                    }
                }
            }

            // METHOD 4: JSON Data Extraction - FIXED: Include images
            if (Object.keys(variants).length === 0 || (!hasSizeVariant && !hasColorVariant)) {
                const scripts = document.querySelectorAll('script');
                for (const script of scripts) {
                    const text = script.textContent;
                    if (text.includes('skuMap') || text.includes('valItemInfo') || text.includes('propertyMemoMap')) {
                        try {
                            // Extract size info (property ID 20509 is common for sizes on Taobao)
                            if (!hasSizeVariant) {
                                const sizeMatch = text.match(/"20509[^"]*":\s*\{[^}]*"value":"([^"]+)"/g);
                                if (sizeMatch) {
                                    const sizes = sizeMatch
                                        .map(m => {
                                            const valueMatch = m.match(/"value":"([^"]+)"/);
                                            return valueMatch ? { value: valueMatch[1] } : null;
                                        })
                                        .filter(Boolean);

                                    if (sizes.length > 0) {
                                        const uniqueSizes = sizes.reduce((acc, curr) => {
                                            if (!acc.find(item => item.value === curr.value)) {
                                                acc.push(curr);
                                            }
                                            return acc;
                                        }, []);
                                        variants['Size'] = uniqueSizes;
                                        result.extractionStrategies.sizes = 'JSON-script';
                                    }
                                }
                            }

                            // FIXED: Extract color info WITH IMAGES (property ID 1627207)
                            if (!hasColorVariant) {
                                const colorMatch = text.match(/"1627207[^"]*":\s*\{[^}]*"value":"([^"]+)"[^}]*"image":"([^"]+)"/g);
                                if (colorMatch) {
                                    const colors = colorMatch
                                        .map(m => {
                                            const valueMatch = m.match(/"value":"([^"]+)"/);
                                            const imageMatch = m.match(/"image":"([^"]+)"/);
                                            return {
                                                value: valueMatch ? valueMatch[1] : null,
                                                image: imageMatch ? imageMatch[1] : undefined
                                            };
                                        })
                                        .filter(c => c.value);

                                    if (colors.length > 0) {
                                        const uniqueColors = colors.reduce((acc, curr) => {
                                            if (!acc.find(item => item.value === curr.value)) {
                                                acc.push(curr);
                                            }
                                            return acc;
                                        }, []);
                                        variants['Color'] = uniqueColors;
                                        result.extractionStrategies.colors = 'JSON-script-with-images';
                                    }
                                }
                            }

                            // General property extraction
                            const propMatch = text.match(/"propertyMemoMap":\s*\{([^}]+)\}/);
                            if (propMatch) {
                                const propsText = propMatch[1];
                                const propPairs = propsText.match(/"(\d+)":\s*"([^"]+)"/g);
                                if (propPairs) {
                                    propPairs.forEach(pair => {
                                        const [, propId, propName] = pair.match(/"(\d+)":\s*"([^"]+)"/) || [];
                                        if (propName && !variants[propName]) {
                                            // Extract with images if available
                                            const regex = new RegExp(`"${propId}[^"]*":\\s*\\{[^}]*"value":"([^"]+)"(?:[^}]*"image":"([^"]+)")?`, 'g');
                                            const values = [];
                                            let match;
                                            while ((match = regex.exec(text)) !== null) {
                                                if (match[1]) {
                                                    const option = { value: match[1] };
                                                    if (match[2]) option.image = match[2];
                                                    values.push(option);
                                                }
                                            }
                                            if (values.length > 0) {
                                                const uniqueValues = values.reduce((acc, curr) => {
                                                    if (!acc.find(item => item.value === curr.value)) {
                                                        acc.push(curr);
                                                    }
                                                    return acc;
                                                }, []);
                                                variants[propName] = uniqueValues;
                                            }
                                        }
                                    });
                                }
                            }
                        } catch (e) {
                            console.error('JSON extraction error:', e);
                        }
                        break;
                    }
                }
            }

            result.variants = variants;
            if (skuStrategy) result.extractionStrategies.sku = skuStrategy;

            // ============ SPECIFICATIONS ============

            const specs = {};

            // Emphasis specs
            for (const selector of strategies.specs.emphasis) {
                const items = document.querySelectorAll(selector);
                items.forEach(item => {
                    const children = item.querySelectorAll('[class*="title"], [class*="Title"]');
                    if (children.length >= 2) {
                        const key = children[1].textContent.trim();
                        const value = children[0].textContent.trim();
                        if (key && value) specs[key] = value;
                    }
                });
                if (Object.keys(specs).length > 0) break;
            }

            // General specs
            for (const selector of strategies.specs.general) {
                const items = document.querySelectorAll(selector);
                items.forEach(item => {
                    const key = item.querySelector('[class*="title"], [class*="Title"], dt');
                    const value = item.querySelector('[class*="subtitle"], [class*="SubTitle"], dd');

                    if (key && value) {
                        specs[key.textContent.trim()] = value.textContent.trim().substring(0, 200);
                    } else {
                        // Try colon-separated format
                        const text = item.textContent.trim();
                        const [k, v] = text.split(/[:：]/);
                        if (k && v) specs[k.trim()] = v.trim().substring(0, 200);
                    }
                });
                if (Object.keys(specs).length > 5) break;
            }

            result.specifications = specs;

            // ============ ADDITIONAL INFO ============

            // GUARANTEES / SERVICE PROMISES
            const guarantees = [];
            const guaranteeSelectors = ['[class*="guarantee"]', '.service-promise', '[class*="service"]'];
            for (const selector of guaranteeSelectors) {
                const elems = document.querySelectorAll(selector);
                elems.forEach(elem => {
                    const text = elem.textContent.trim();
                    if (text && text.length > 3 && text.length < 100) guarantees.push(text);
                });
                if (guarantees.length > 0) break;
            }
            result.guarantees = guarantees.slice(0, 10);

            // SHIPPING INFO
            const shippingResult = trySelectors(strategies.shipping, (elem) => {
                return elem.textContent.trim().substring(0, 200);
            });
            if (shippingResult) result.shippingInfo = shippingResult.value;

            // REVIEW COUNT
            const reviewResult = trySelectors(strategies.reviewCount, (elem) => {
                const match = elem.textContent.match(/(\d+[\d,]*)/);
                return match ? match[1].replace(/,/g, '') : null;
            });
            if (reviewResult) result.reviewCount = reviewResult.value;

            // STOCK STATUS
            const stockResult = trySelectors(strategies.stockStatus, (elem) => {
                const text = elem.textContent.toLowerCase();
                return text.includes('in stock') || text.includes('available') ||
                    text.includes('有货') || !text.includes('out of stock');
            });
            if (stockResult !== null) result.inStock = stockResult.value;

            // ============ DATA QUALITY CHECK ============

            result.dataQuality = {
                hasTitle: !!result.fullTitle,
                hasPrice: !!result.price,
                hasImages: result.additionalImages.length > 0,
                hasVariants: Object.keys(result.variants).length > 0,
                hasSpecs: Object.keys(result.specifications).length > 0,
                hasBrand: !!result.brand,
                hasReviews: !!result.reviewCount,
                hasDescription: !!result.fullDescription,
                hasSalesVolume: !!result.salesVolume,
                hasShopName: !!result.shopName,
                completeness: 0
            };

            const checks = [
                result.fullTitle,
                result.price,
                result.additionalImages.length > 0,
                Object.keys(result.variants).length > 0,
                Object.keys(result.specifications).length > 0,
                result.salesVolume,
                result.shopName,
                result.brand,
                result.reviewCount,
                result.fullDescription
            ];

            result.dataQuality.completeness = Math.round(
                (checks.filter(Boolean).length / checks.length) * 100
            );

            return result;
        }, strategies, platform);
    }
}

module.exports = { ProductDetailExtractor };