/**
 * Webflow CMS Client Script - Mini Reports Version
 * Works with the new mini-report HTML structure
 */

(function() {
    'use strict';

    console.log('[CMS Client] Mini Reports script loading...');

    // Configuration
    const CONFIG = {
        WORKER_URL: 'https://cms-reports-api.occupation-crimes.workers.dev',
        REPORTS_LIMIT: 15,
        REPORTS_PER_PAGE: 10,
        DEBUG: false
    };

    // Pagination state
    let currentOffset = 0;
    let totalReports = 0;
    let isLoading = false;
    let hasMoreReports = true;
    let currentFilters = {};

    // Helper function for safe console logging
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log('[CMS Client]', ...args);
        }
    }

    // Helper function to wait for element
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    // Helper function to format dates
    function formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            log('Date format error:', e);
            return '';
        }
    }

    // Helper function to safely set text content
    function setText(element, text) {
        if (element) {
            element.textContent = text || '';
            return true;
        }
        return false;
    }

    // Helper function to safely set image source
    function setImage(element, src, alt = '') {
        if (element) {
            if (src) {
                element.src = src;
                element.alt = alt;
                if (element.classList.contains('lazy')) {
                    element.classList.remove('lazy');
                    element.loading = 'eager';
                }
                element.removeAttribute('data-ll-status');
                element.classList.remove('loading');
                return true;
            } else {
                element.src = 'https://cdn.prod.website-files.com/plugins/Basic/assets/placeholder.60f9b1840c.svg';
                element.alt = 'No image available';
                return false;
            }
        }
        return false;
    }

    // Helper function to set rich text content
    function setRichText(element, htmlContent) {
        if (element && htmlContent) {
            element.innerHTML = htmlContent;
            return true;
        }
        return false;
    }

    // Helper function to safely set link href and visibility
    function setLink(element, url) {
        if (!element) return false;
        if (url) {
            element.href = url;
            element.style.display = '';
            return true;
        } else {
            element.style.display = 'none';
            return false;
        }
    }

    // Helper function to set multiple links with the same URL
    function setLinks(selector, parentElement, url) {
        const elements = parentElement.querySelectorAll(selector);
        elements.forEach(el => setLink(el, url));
        return elements.length > 0;
    }

    // Configuration for location fields - data-driven approach
    const LOCATION_FIELDS = [
        {
            dataKey: 'locality',
            fieldSelector: '[cms-field="locality"]',
            linkSelector: '[cms-link="locality"]',
            slashAttr: 'locality',
            urlPrefix: '/locality/'
        },
        {
            dataKey: 'subRegion',
            fieldSelector: '[cms-field="region"]',
            linkSelector: '[cms-link="region"]',
            slashAttr: 'region',
            urlPrefix: '/region/'
        },
        {
            dataKey: 'region',
            fieldSelector: '[cms-field="governorate"]',
            linkSelector: '[cms-link="governorate"]',
            slashAttr: 'governorate',
            urlPrefix: '/region/'
        },
        {
            dataKey: 'territory',
            fieldSelector: '[cms-field="territory"]',
            linkSelector: '[cms-link="territory"]',
            slashAttr: null,
            urlPrefix: '/territory/'
        }
    ];

    // Helper to format reporter names for display
    function formatReporterNames(reporters) {
        if (!reporters || reporters.length === 0) return 'Unknown source';

        const names = reporters.map(r => r.name);
        if (names.length === 1) return names[0];
        if (names.length === 2) return names.join(' & ');

        const lastReporter = names.pop();
        return names.join(', ') + ' & ' + lastReporter;
    }

    // Modal utility functions
    function openModal(reporterListWrap) {
        if (!reporterListWrap) return;

        reporterListWrap.classList.add('modal-click');
        reporterListWrap.style.display = 'flex';

        const modalPreWrap = reporterListWrap.querySelector('.modal-pre-wrap');
        if (modalPreWrap) {
            modalPreWrap.classList.add('modal-click');
            const modalElements = modalPreWrap.querySelector('[modal-elements="true"]');
            if (modalElements) modalElements.classList.add('modal-click');
        }
    }

    function closeModal(reporterListWrap) {
        if (!reporterListWrap) return;

        const modalPreWrap = reporterListWrap.querySelector('.modal-pre-wrap');
        if (modalPreWrap) {
            modalPreWrap.classList.remove('modal-click');
            const modalElements = modalPreWrap.querySelector('[modal-elements="true"]');
            if (modalElements) modalElements.classList.remove('modal-click');
        }

        reporterListWrap.classList.remove('modal-click');
        reporterListWrap.style.display = 'none';
    }

    function setupModalTrigger(multiReporterWrap, reportersWrap) {
        if (!multiReporterWrap || multiReporterWrap.hasAttribute('data-modal-initialized')) return;

        multiReporterWrap.setAttribute('data-modal-initialized', 'true');
        multiReporterWrap.style.cursor = 'pointer';

        multiReporterWrap.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const reporterListWrap = reportersWrap.querySelector('[reporter-list-wrap="true"]');
            openModal(reporterListWrap);
        });
    }

    function setupModalClose(reporterListWrap) {
        if (!reporterListWrap) return;

        if (!reporterListWrap.hasAttribute('data-modal-bg-initialized')) {
            reporterListWrap.setAttribute('data-modal-bg-initialized', 'true');
            reporterListWrap.addEventListener('click', function(e) {
                if (e.target === this) {
                    e.preventDefault();
                    closeModal(this);
                }
            });
        }

        const modalPreWrap = reporterListWrap.querySelector('.modal-pre-wrap');
        if (modalPreWrap) {
            const closeBtn = modalPreWrap.querySelector('[modal-close-btn="true"]');
            if (closeBtn && !closeBtn.hasAttribute('data-modal-close-initialized')) {
                closeBtn.setAttribute('data-modal-close-initialized', 'true');
                closeBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeModal(this.closest('[reporter-list-wrap="true"]'));
                });
            }
        }
    }

    // Populate basic report fields (title, image, date, byline, topic)
    function populateBasicFields(itemElement, reportData) {
        let successCount = 0;

        const titleElement = itemElement.querySelector('.text-block-829806-1');
        if (setText(titleElement, reportData.name)) successCount++;

        const mainImage = itemElement.querySelector('.image-63-1-copy');
        if (setImage(mainImage, reportData.photo?.url || '', reportData.name)) successCount++;

        const dateValue = reportData.date || reportData.createdOn;
        const dateElement = itemElement.querySelector('.mini-report-info-wrap .text-block-829818:first-child');
        if (setText(dateElement, formatDate(dateValue))) successCount++;

        const bylineElement = itemElement.querySelector('.mini-report-info-wrap .text-block-829818:last-child');
        setText(bylineElement, formatReporterNames(reportData.reporters));

        const topicElement = itemElement.querySelector('[cms-field="topic"]');
        const topicLinkElement = itemElement.querySelector('[cms-link="topic"]');
        if (reportData.topic && reportData.topic.slug) {
            setText(topicElement, reportData.topic.name);
            setLink(topicLinkElement, `/topic/${reportData.topic.slug}`);
            successCount++;
        } else {
            if (topicLinkElement) topicLinkElement.style.display = 'none';
        }

        return successCount;
    }

    // Populate location fields using config-driven approach
    function populateLocationFields(itemElement, reportData) {
        const slashes = {};
        itemElement.querySelectorAll('[slash-for]').forEach(slash => {
            slashes[slash.getAttribute('slash-for')] = slash;
        });

        LOCATION_FIELDS.forEach(config => {
            const data = reportData[config.dataKey];
            const fieldElement = itemElement.querySelector(config.fieldSelector);
            const linkElement = itemElement.querySelector(config.linkSelector);
            const slash = config.slashAttr ? slashes[config.slashAttr] : null;

            if (data && data.slug) {
                setText(fieldElement, data.name);
                setLink(linkElement, config.urlPrefix + data.slug);
                if (slash) slash.style.display = '';
            } else if (data && data.name && !data.slug) {
                setText(fieldElement, data.name);
                if (linkElement) linkElement.style.display = 'none';
                if (slash) slash.style.display = '';
            } else {
                if (linkElement) linkElement.style.display = 'none';
                if (slash) slash.style.display = 'none';
            }
        });
    }

    // Set reporter action links (support and join)
    function setReporterActionLinks(parentElement, reporter) {
        setLinks('[cms-link="reporter-support"]', parentElement, reporter.donationLink);
        setLinks('[cms-link="reporter-join"]', parentElement, reporter.joinLink);
    }

    // Populate a single reporter item (for modal list)
    function populateReporterItem(reporterItem, reporter) {
        setText(reporterItem.querySelector('[cms-field="reporter"]'), reporter.name);
        setText(reporterItem.querySelector('[fs-list-field="Reporter"]'), reporter.name);

        const reporterImageField = reporterItem.querySelector('[cms-field="reporter-image"]');
        const imgEl = reporterItem.querySelector('[reporter-image="true"]');
        if (reporter.photo) {
            const photoUrl = reporter.photo.url || reporter.photo;
            if (reporterImageField) {
                reporterImageField.src = photoUrl;
                reporterImageField.alt = reporter.name;
            }
            if (imgEl) {
                imgEl.src = photoUrl;
                imgEl.alt = reporter.name;
            }
        }

        setLink(reporterItem.querySelector('[cms-link="reporter"]'), reporter.slug ? `/reporter/${reporter.slug}` : null);
        setReporterActionLinks(reporterItem, reporter);
    }

    // Populate reporter information section
    function populateReporterInfo(itemElement, reporters) {
        const reportersWrap = itemElement.querySelector('[reporters-wrap="true"]');
        const reporterElement = itemElement.querySelector('[fs-list-field="Reporter"]');
        const reporterNameElement = itemElement.querySelector('[reporter]');
        const reporterLinkElement = itemElement.querySelector('[cms-link="reporter"]');
        const multiReporterNameElement = itemElement.querySelector('.multi-reporter-name');
        const multiReporterWrap = itemElement.querySelector('[multi-reporter-wrap="true"]');
        const reporterListWrap = itemElement.querySelector('[reporter-list-wrap="true"]');
        const singleReporterNameElement = itemElement.querySelector('[cms-field="reporter"]');
        const singleReporterImageElement = itemElement.querySelector('[cms-field="reporter-image"]');

        if (!reporters || reporters.length === 0 || !reporters[0].slug) {
            if (reporterLinkElement) reporterLinkElement.style.display = 'none';
            if (multiReporterWrap) multiReporterWrap.style.display = 'none';
            if (reporterListWrap) reporterListWrap.style.display = 'none';
            return;
        }

        const firstReporter = reporters[0];
        setText(reporterElement, firstReporter.name);
        setText(reporterNameElement, firstReporter.name);
        setLink(reporterLinkElement, `/reporter/${firstReporter.slug}`);

        // Single reporter case
        if (reporters.length === 1) {
            setText(singleReporterNameElement, firstReporter.name);
            if (singleReporterImageElement && firstReporter.photo) {
                singleReporterImageElement.src = firstReporter.photo.url || firstReporter.photo;
                singleReporterImageElement.alt = firstReporter.name;
            }
            setLinks('a[cms-link="reporter"]', itemElement, `/reporter/${firstReporter.slug}`);
            setReporterActionLinks(itemElement, firstReporter);

            if (multiReporterWrap) multiReporterWrap.style.display = 'none';
            setText(multiReporterNameElement, firstReporter.name);
        }
        // Multiple reporters case
        else if (multiReporterWrap && reporterListWrap && reportersWrap) {
            multiReporterWrap.style.display = 'flex';
            reporterListWrap.style.display = 'none';

            const displayName = reporters.length === 2
                ? reporters.map(r => r.name).join(' & ')
                : `${firstReporter.name} + ${reporters.length - 1} more`;
            setText(multiReporterNameElement, displayName);

            const firstReporterImage = multiReporterWrap.querySelector('[first-reporter-image="true"]');
            const secondReporterImage = multiReporterWrap.querySelector('[second-reporter-image="true"]');
            if (firstReporterImage && reporters[0].photo) {
                firstReporterImage.src = reporters[0].photo.url || reporters[0].photo;
                firstReporterImage.alt = reporters[0].name;
            }
            if (secondReporterImage && reporters[1]?.photo) {
                secondReporterImage.src = reporters[1].photo.url || reporters[1].photo;
                secondReporterImage.alt = reporters[1].name;
            }

            const modalPreWrap = reporterListWrap.querySelector('.modal-pre-wrap');
            if (modalPreWrap) {
                const templateReporterItem = modalPreWrap.querySelector('.collection-item-2');
                if (templateReporterItem) {
                    const itemsContainer = templateReporterItem.parentElement;
                    itemsContainer.querySelectorAll('.collection-item-2').forEach((item, idx) => {
                        if (idx > 0) item.remove();
                    });
                    templateReporterItem.style.display = 'none';

                    reporters.forEach(reporter => {
                        const reporterItem = templateReporterItem.cloneNode(true);
                        reporterItem.style.display = '';
                        populateReporterItem(reporterItem, reporter);
                        itemsContainer.appendChild(reporterItem);
                    });
                }
            }

            setupModalTrigger(multiReporterWrap, reportersWrap);
            setupModalClose(reporterListWrap);
        }

        const supportButton = itemElement.querySelector('.support-button-2');
        const joinButton = itemElement.querySelector('.join-button-2');
        setLink(supportButton, firstReporter.donationLink);
        setLink(joinButton, firstReporter.joinLink);
    }

    // Populate content tabs (info, description, videos)
    function populateContent(itemElement, reportData) {
        const infoContent = itemElement.querySelector('[cms-content="info"]');
        const descriptionContent = itemElement.querySelector('[cms-content="description"]');
        if (reportData.description) {
            setRichText(infoContent, reportData.description);
            setRichText(descriptionContent, reportData.description);
        }

        // Populate videos
        populateVideos(itemElement, reportData.videos);

        // Populate report images gallery with unique gallery ID
        populateImagesGallery(itemElement, reportData.reportImages, reportData.id);

        // Hide images tab if no report images
        const imagesTab = itemElement.querySelector('[data-tab="2"]');
        if (imagesTab) {
            if (!reportData.reportImages || reportData.reportImages.length === 0) {
                imagesTab.style.display = 'none';
            } else {
                imagesTab.style.display = '';
            }
        }

        // Hide videos tab if no videos
        const videosTab = itemElement.querySelector('[data-tab="3"]');
        if (videosTab) {
            if (!reportData.videos || reportData.videos.length === 0) {
                videosTab.style.display = 'none';
            } else {
                videosTab.style.display = '';
            }
        }
    }

    // Populate videos in videos-wrap
    function populateVideos(itemElement, videos) {
        const videosWrap = itemElement.querySelector('[cms-deliver="videos-wrap"]');
        if (!videosWrap || !videos || videos.length === 0) {
            if (videosWrap) videosWrap.style.display = 'none';
            return;
        }

        // Find the template video-wrap element
        const templateVideoWrap = videosWrap.querySelector('[cms-deliver="video-wrap"]');
        if (!templateVideoWrap) {
            console.warn('[CMS Client] No [cms-deliver="video-wrap"] template found in videos-wrap');
            return;
        }

        // Clear existing video-wrap elements except the template
        const existingVideoWraps = videosWrap.querySelectorAll('[cms-deliver="video-wrap"]');
        existingVideoWraps.forEach((vw, index) => {
            if (index > 0) vw.remove();
        });

        // Clone and populate for each video
        videos.forEach((video, index) => {
            const videoWrap = templateVideoWrap.cloneNode(true);

            const richTextElement = videoWrap.querySelector('[cms-field="video-rich-text"]');
            const videoLinkElement = videoWrap.querySelector('[cms-field="video-link"]');
            const iframe = videoLinkElement?.querySelector('iframe');

            // Set rich text content
            if (richTextElement && video.text) {
                setRichText(richTextElement, video.text);
            }

            // Set video iframe src
            if (iframe && video.url) {
                let embedUrl = video.url;

                // Convert YouTube watch URLs to embed URLs
                if (embedUrl.includes('youtube.com/watch?v=')) {
                    const videoId = embedUrl.split('v=')[1].split('&')[0];
                    embedUrl = `https://www.youtube.com/embed/${videoId}`;
                } else if (embedUrl.includes('youtu.be/')) {
                    const videoId = embedUrl.split('youtu.be/')[1].split('?')[0];
                    embedUrl = `https://www.youtube.com/embed/${videoId}`;
                }

                iframe.setAttribute('data-src', embedUrl);
                iframe.src = embedUrl;

                // Remove lazy loading status classes if present
                iframe.classList.remove('loading', 'exited');
                if (!iframe.classList.contains('entered')) {
                    iframe.classList.add('entered');
                }
            }

            // Show the video-wrap
            videoWrap.style.display = '';

            // Append to videos-wrap
            if (index === 0) {
                // Replace the first template
                templateVideoWrap.replaceWith(videoWrap);
            } else {
                videosWrap.appendChild(videoWrap);
            }
        });

        // Show the videos-wrap
        videosWrap.style.display = '';
    }

    // Populate images gallery in images-wrap
    function populateImagesGallery(itemElement, reportImages, reportId) {
        const imagesWrap = itemElement.querySelector('[cms-deliver="images-wrap"]');
        if (!imagesWrap || !reportImages || reportImages.length === 0) {
            if (imagesWrap) imagesWrap.style.display = 'none';
            return;
        }

        // Find the template .picturelightbox element
        const templateLightbox = imagesWrap.querySelector('.picturelightbox');
        if (!templateLightbox) {
            console.warn('[CMS Client] No .picturelightbox template found in images-wrap');
            return;
        }

        // Clear existing lightboxes except the template
        const existingLightboxes = imagesWrap.querySelectorAll('.picturelightbox');
        existingLightboxes.forEach((lb, index) => {
            if (index > 0) lb.remove();
        });

        // Create unique gallery ID for this report
        const galleryId = 'gallery-' + reportId;

        // Clone and populate for each image
        reportImages.forEach((image, index) => {
            const lightbox = templateLightbox.cloneNode(true);

            const anchor = lightbox.querySelector('a[lightbox-image]');
            const img = lightbox.querySelector('img');

            if (anchor && img && image.url) {
                // Set anchor attributes for Fancybox with unique gallery ID
                anchor.href = image.url;
                anchor.setAttribute('data-fancybox', galleryId);
                anchor.setAttribute('data-thumb', image.url);
                anchor.setAttribute('data-caption', image.alt || '');

                // Set image attributes
                img.src = image.url;
                img.alt = image.alt || '';

                // Remove lazy loading classes
                img.classList.remove('lazy', 'loading');
                img.removeAttribute('data-ll-status');
                img.loading = 'lazy';

                // Show the lightbox
                lightbox.style.display = '';

                // Append to images-wrap
                if (index === 0) {
                    // Replace the first template
                    templateLightbox.replaceWith(lightbox);
                } else {
                    imagesWrap.appendChild(lightbox);
                }
            }
        });

        // Show the images-wrap
        imagesWrap.style.display = '';

        // Initialize Fancybox for this gallery
        if (typeof Fancybox !== 'undefined') {
            Fancybox.bind(`[data-fancybox="${galleryId}"]`, {
                // Optional Fancybox configuration
                Thumbs: {
                    autoStart: true,
                },
            });
        }
    }

    // Main function to populate a report item
    function populateReportItem(itemElement, reportData) {
        const successCount = populateBasicFields(itemElement, reportData);
        populateLocationFields(itemElement, reportData);
        populateReporterInfo(itemElement, reportData.reporters || []);
        populateContent(itemElement, reportData);

        itemElement.setAttribute('data-report-id', reportData.id);
        itemElement.setAttribute('data-report-slug', reportData.slug || '');
        itemElement.classList.remove('is--loading');
        itemElement.classList.add('is--loaded');

        return successCount > 0;
    }

    // Populate reports in the DOM (used by both initial load and search)
    async function populateReports(items, listContainer, templateItem, appendMode = false) {
        if (!items || items.length === 0) {
            if (!appendMode) {
                listContainer.innerHTML = '<div style="padding: 20px; text-align: center;">No reports available</div>';
            }
            return 0;
        }

        if (!appendMode) {
            const existingClones = listContainer.querySelectorAll('[cms-deliver="item"]:not(:first-child)');
            existingClones.forEach(item => item.remove());

            const existingMsg = listContainer.querySelector('.no-search-results, .search-error');
            if (existingMsg) existingMsg.remove();
        }

        if (templateItem.parentNode !== listContainer) {
            console.error('[CMS Client] Template not in list container!');
            return 0;
        }

        const sentinel = listContainer.querySelector('[scroll-sentinel="true"]');
        const fragment = document.createDocumentFragment();

        let successCount = 0;
        items.forEach((report, index) => {
            const newItem = templateItem.cloneNode(true);
            newItem.classList.remove('cms-template', 'is--loading', 'cms-template-original');
            newItem.style.display = '';

            const populated = populateReportItem(newItem, report);

            if (populated) {
                fragment.appendChild(newItem);
                successCount++;
            } else {
                console.warn(`[CMS Client] Failed to populate report ${index + 1}:`, report.name || 'Unknown', 'ID:', report.id);
            }
        });

        if (sentinel) {
            listContainer.insertBefore(fragment, sentinel);
        } else {
            listContainer.appendChild(fragment);
        }

        templateItem.style.display = 'none';
        templateItem.classList.add('cms-template-original');

        console.log(`[CMS Client] Populated ${successCount} items in DOM`);

        return successCount;
    }

    // Show loading indicator
    function showLoadingIndicator(listContainer) {
        hideLoadingIndicator();

        const loader = document.createElement('div');
        loader.id = 'infinite-scroll-loader';
        loader.style.cssText = 'text-align: center; padding: 20px; color: #666;';
        loader.innerHTML = '<div style="font-size: 14px;">Loading more reports...</div>';
        listContainer.appendChild(loader);
    }

    // Hide loading indicator
    function hideLoadingIndicator() {
        const loader = document.getElementById('infinite-scroll-loader');
        if (loader) loader.remove();
    }

    // Show "no more reports" message
    function showNoMoreMessage(listContainer) {
        const existing = document.getElementById('no-more-reports');
        if (existing) return;

        const message = document.createElement('div');
        message.id = 'no-more-reports';
        message.style.cssText = 'text-align: center; padding: 20px; color: #999; font-size: 14px;';
        message.innerHTML = 'No more reports to load';
        listContainer.appendChild(message);
    }

    // Load more reports (infinite scroll)
    async function loadMoreReports() {
        if (isLoading || !hasMoreReports) {
            log('Skipping load more - isLoading:', isLoading, 'hasMoreReports:', hasMoreReports);
            return;
        }

        isLoading = true;
        log('Loading more reports...');

        const listContainer = document.querySelector('[cms-deliver="list"]');
        const templateItem = listContainer?.querySelector('[cms-deliver="item"]');

        if (!listContainer || !templateItem) {
            console.error('[CMS Client] List container or template not found');
            isLoading = false;
            return;
        }

        showLoadingIndicator(listContainer);

        try {
            currentOffset += CONFIG.REPORTS_PER_PAGE;

            let url = `${CONFIG.WORKER_URL}/reports?limit=${CONFIG.REPORTS_PER_PAGE}&offset=${currentOffset}`;

            if (currentFilters.search) {
                url += `&search=${encodeURIComponent(currentFilters.search)}`;
            }

            url += `&_t=${Date.now()}`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const response_data = await response.json();
            const items = response_data.data || [];

            const successCount = await populateReports(items, listContainer, templateItem, true);

            totalReports = response_data.metadata?.total || totalReports;
            hasMoreReports = (currentOffset < totalReports);

            log(`Loaded ${successCount} more reports. Total offset: ${currentOffset}, Total reports: ${totalReports}, Has more: ${hasMoreReports}`);

            if (!hasMoreReports) {
                showNoMoreMessage(listContainer);
            }

        } catch (error) {
            console.error('[CMS Client] Error loading more reports:', error);
            currentOffset -= CONFIG.REPORTS_PER_PAGE;
        } finally {
            hideLoadingIndicator();
            isLoading = false;
        }
    }

    // Main function to fetch and populate reports (initial load only)
    async function loadReports(initializeUI = true) {
        try {
            const listContainer = await waitForElement('[cms-deliver="list"]', 5000);

            if (!listContainer) {
                console.error('[CMS Client] List container not found');
                return;
            }

            const templateItem = listContainer.querySelector('[cms-deliver="item"]');

            if (!templateItem) {
                console.error('[CMS Client] Template item not found');
                return;
            }

            const response = await fetch(`${CONFIG.WORKER_URL}/reports?limit=${CONFIG.REPORTS_LIMIT}&_t=${Date.now()}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const response_data = await response.json();
            const items = response_data.data || [];

            const successCount = await populateReports(items, listContainer, templateItem);

            currentOffset = CONFIG.REPORTS_LIMIT;
            totalReports = response_data.metadata?.total || items.length;
            hasMoreReports = (currentOffset < totalReports);
            currentFilters = {};

            console.log(`[CMS Client] Loaded ${successCount} reports. Total: ${totalReports}, Has more: ${hasMoreReports}`);

            if (totalReports <= 40 && hasMoreReports) {
                console.log(`[CMS Client] Total reports is ${totalReports}, loading all immediately`);
                setTimeout(() => {
                    if (hasMoreReports && !isLoading) {
                        loadMoreReports();
                    }
                }, 500);
            }

            if (initializeUI) {
                initializeInteractions();
                initializeInfiniteScroll(listContainer);
            }

            window.dispatchEvent(new CustomEvent('cmsDataLoaded', {
                detail: {
                    count: successCount,
                    total: totalReports
                }
            }));

        } catch (error) {
            console.error('[CMS Client] Error:', error);

            const listContainer = document.querySelector('[cms-deliver="list"]');
            if (listContainer) {
                listContainer.innerHTML = `
                    <div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c00;">
                        <strong>Error loading reports:</strong><br>
                        ${error.message}<br>
                        <small>Check browser console for details</small>
                    </div>
                `;
            }
        }
    }

    // Track if interactions have been initialized
    let interactionsInitialized = false;

    // Initialize tabs and accordion interactions only (called once)
    function initializeTabsAndAccordion() {
        if (interactionsInitialized) return;
        interactionsInitialized = true;

        // Tab switching - use event delegation
        document.addEventListener('click', function(e) {
            const tab = e.target.closest('[data-tab]');
            if (!tab) return;

            e.preventDefault();
            const tabId = tab.getAttribute('data-tab');
            const container = tab.closest('.mini-report-wrap');

            if (!container) return;

            const target = container.querySelector('[open-target]');
            const arrow = container.querySelector('[dropdown-icon]');

            const isCurrentTab = tab.classList.contains('current');

            if (isCurrentTab) {
                if (target) {
                    if (!target.style.transition) {
                        target.style.transition = 'height 300ms ease';
                    }
                    target.style.height = '0px';
                    if (arrow) arrow.style.transform = 'rotate(0deg)';
                }
                return;
            }

            container.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('current'));
            tab.classList.add('current');

            container.querySelectorAll('[data-tab-content]').forEach(content => {
                if (content.getAttribute('data-tab-content') === tabId) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });

            if (target && target.style.height !== '0px' && target.style.height !== '0') {
                const currentHeight = target.offsetHeight;

                const originalTransition = target.style.transition;
                target.style.transition = 'none';
                target.style.height = 'auto';
                const newHeight = target.scrollHeight;

                target.style.height = currentHeight + 'px';

                target.offsetHeight;

                target.style.transition = originalTransition || 'height 300ms ease';
                target.style.height = newHeight + 'px';
            }
        });

        // Accordion open/close - use event delegation
        document.addEventListener('click', function(e) {
            const trigger = e.target.closest('[open-trigger]');
            if (!trigger) return;

            const clickedLink = e.target.closest('a');
            if (clickedLink && trigger.contains(clickedLink)) {
                return;
            }

            e.preventDefault();
            const container = trigger.closest('.mini-report-wrap');
            const target = container?.querySelector('[open-target]');
            const arrow = container?.querySelector('[dropdown-icon]');

            if (!target) return;

            if (!target.style.transition) {
                target.style.transition = 'height 300ms ease';
            }

            const isClosed = target.style.height === '0px' || target.style.height === '0';

            if (isClosed || !target.style.height) {
                target.style.height = target.scrollHeight + 'px';
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            } else {
                target.style.height = '0px';
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
        });
    }

    // Initialize all interactions (tabs, accordion, search) - only called once
    function initializeInteractions() {
        initializeTabsAndAccordion();
        initializeSearch();
    }

    // Initialize infinite scroll with IntersectionObserver
    function initializeInfiniteScroll(listContainer) {
        const sentinel = listContainer.querySelector('[scroll-sentinel="true"]');

        if (!sentinel) {
            console.error('[CMS Client] Scroll sentinel not found! Add a div with scroll-sentinel="true" at the bottom of your list.');
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && hasMoreReports && !isLoading) {
                    log('Sentinel visible, loading more reports...');
                    loadMoreReports();
                }
            });
        }, {
            root: null,
            rootMargin: '500px',
            threshold: 0.1
        });

        observer.observe(sentinel);

        console.log('[CMS Client] Infinite scroll initialized with 500px margin');

        setTimeout(() => {
            const remaining = totalReports - currentOffset;
            if (remaining > 0 && remaining <= 25 && hasMoreReports) {
                console.log(`[CMS Client] Auto-loading remaining ${remaining} reports`);
                loadMoreReports();
            }
        }, 1000);

        setTimeout(() => {
            if (hasMoreReports && !isLoading) {
                const viewportHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;

                if (viewportHeight > documentHeight * 0.5) {
                    console.log(`[CMS Client] Viewport tall enough, loading more reports immediately`);
                    loadMoreReports();
                }
            }
        }, 100);
    }

    // Initialize search/filter functionality with server-side search
    function initializeSearch() {
        const searchInput = document.querySelector('[filter-reports="search"]');
        if (!searchInput) {
            return;
        }

        let debounceTimer;

        async function performSearch(query) {
            const trimmedQuery = query.trim();

            const listContainer = document.querySelector('[cms-deliver="list"]');
            const templateItem = listContainer.querySelector('[cms-deliver="item"]');

            if (!listContainer || !templateItem) {
                console.error('[CMS Client] Search error: List container or template not found');
                return;
            }

            if (!trimmedQuery) {
                currentOffset = 0;
                hasMoreReports = true;
                currentFilters = {};

                await loadReports(false);
                return;
            }

            try {
                currentOffset = 0;
                hasMoreReports = true;
                currentFilters = { search: trimmedQuery };

                const noMoreMsg = document.getElementById('no-more-reports');
                if (noMoreMsg) noMoreMsg.remove();

                const searchUrl = `${CONFIG.WORKER_URL}/reports?search=${encodeURIComponent(trimmedQuery)}&limit=${CONFIG.REPORTS_LIMIT}&offset=0`;
                const response = await fetch(searchUrl);

                if (!response.ok) {
                    throw new Error(`Search failed: ${response.status} ${response.statusText}`);
                }

                const response_data = await response.json();
                const items = response_data.data || [];

                currentOffset = CONFIG.REPORTS_LIMIT;
                totalReports = response_data.metadata?.total || items.length;
                hasMoreReports = (currentOffset < totalReports);

                if (items.length === 0) {
                    const clones = listContainer.querySelectorAll('[cms-deliver="item"]:not(:first-child)');
                    clones.forEach(item => item.remove());

                    const existingMsg = listContainer.querySelector('.no-search-results, .search-error');
                    if (existingMsg) existingMsg.remove();

                    const noResultsMsg = document.createElement('div');
                    noResultsMsg.className = 'no-search-results';
                    noResultsMsg.style.cssText = 'padding: 40px 20px; text-align: center; color: #666;';
                    noResultsMsg.innerHTML = `
                        <div style="font-size: 18px; margin-bottom: 10px;">No reports found for "${trimmedQuery}"</div>
                        <div style="font-size: 14px;">Try different search terms</div>
                    `;
                    listContainer.appendChild(noResultsMsg);

                    templateItem.style.display = 'none';

                    hasMoreReports = false;
                } else {
                    await populateReports(items, listContainer, templateItem, false);
                }

                console.log(`[CMS Client] Search complete: ${items.length} results (Total: ${totalReports}, Has more: ${hasMoreReports})`);

            } catch (error) {
                console.error('Search error:', error);

                const errorMsg = document.createElement('div');
                errorMsg.className = 'search-error';
                errorMsg.style.cssText = 'padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c00; margin: 20px;';
                errorMsg.innerHTML = `
                    <strong>Search error:</strong> ${error.message}<br>
                    <small>Please try again</small>
                `;
                listContainer.appendChild(errorMsg);

                setTimeout(() => errorMsg.remove(), 5000);
            }
        }

        searchInput.addEventListener('input', function(e) {
            const query = e.target.value;

            clearTimeout(debounceTimer);

            debounceTimer = setTimeout(() => {
                performSearch(query);
            }, 500);
        });

        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(debounceTimer);
                performSearch(e.target.value);
            }
        });

        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.target.value = '';
                clearTimeout(debounceTimer);
                performSearch('');
            }
        });

        console.log('[CMS Client] Search initialized');
    }

    // Initialize function
    function init() {
        if (window.Webflow && window.Webflow.env && window.Webflow.env() === 'design') {
            console.log('[CMS Client] Skipping in Webflow Designer mode');
            return;
        }

        if (typeof window.jQuery !== 'undefined') {
            window.jQuery(document).ready(() => {
                loadReports();
            });
        } else {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', loadReports);
            } else {
                setTimeout(loadReports, 100);
            }
        }

        window.cmsLoadReports = loadReports;
    }

    init();

    window.cmsDebug = {
        config: CONFIG,
        loadReports: loadReports,
        checkElements: function() {
            const list = document.querySelector('[cms-deliver="list"]');
            const item = document.querySelector('[cms-deliver="item"]');
            const title = item ? item.querySelector('.text-block-829806-1') : null;

            console.log('List container:', list);
            console.log('Template item:', item);
            console.log('Title element:', title);

            return {
                hasList: !!list,
                hasItem: !!item,
                hasTitle: !!title
            };
        },
        getState: function() {
            return {
                currentOffset,
                totalReports,
                hasMoreReports,
                isLoading,
                remaining: totalReports - currentOffset
            };
        }
    };

    console.log('[CMS Client] Mini Reports script loaded. Debug available at window.cmsDebug');

})();
