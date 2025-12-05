/**
 * Webflow CMS Client Script - Mini Reports Version with Advanced Filtering
 * Works with the new mini-report HTML structure and comprehensive filtering system
 */

(function() {
    'use strict';

    console.log('[CMS Client] Mini Reports with Filters script loading...');

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

    // Filter state management
    let currentFilters = {
        search: '',
        dateFrom: '',
        dateUntil: '',
        topic: [],
        region: [],
        locality: [],
        territory: [],
        reporter: [],
        urgent: null
    };

    // Flag to prevent processing checkbox changes during clear operations
    let isClearing = false;

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

    // Format date for display in tags (short format)
    function formatDateForTag(dateString) {
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
            return dateString;
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

    // Populate header thumbnail with main image
    function populateHeaderThumbnail(itemElement, reportData) {
        const thumbnailElement = itemElement.querySelector('[cms-content="header-thumbnail"]');
        if (!thumbnailElement) return;

        // Check if report has a main image
        if (!reportData.photo?.url) {
            thumbnailElement.style.display = 'none';
            return;
        }

        const galleryId = 'gallery-' + reportData.id;
        const hasGalleryImages = reportData.reportImages && reportData.reportImages.length > 0;

        // Set the thumbnail link attributes (but NOT data-fancybox to exclude from gallery)
        thumbnailElement.href = reportData.photo.url;
        // Remove data-fancybox to exclude from automatic gallery
        thumbnailElement.removeAttribute('data-fancybox');
        thumbnailElement.setAttribute('data-caption', reportData.name || '');
        thumbnailElement.setAttribute('data-thumb', reportData.photo.url);

        // Set the thumbnail image
        const thumbnailImg = thumbnailElement.querySelector('img');
        if (thumbnailImg) {
            thumbnailImg.src = reportData.photo.url;
            thumbnailImg.alt = reportData.name || '';
            thumbnailImg.classList.remove('lazy', 'loading');
            thumbnailImg.removeAttribute('data-ll-status');
        }

        // Add click handler to manually open gallery
        if (!thumbnailElement.hasAttribute('data-thumbnail-initialized')) {
            thumbnailElement.setAttribute('data-thumbnail-initialized', 'true');

            thumbnailElement.addEventListener('click', function(e) {
                e.preventDefault();

                // If there are gallery images and they haven't been loaded yet
                if (hasGalleryImages && itemElement.getAttribute('data-content-loaded') !== 'true') {
                    // Load the report content (including images)
                    lazyLoadReportContent(itemElement);

                    // Wait a moment for images to be populated, then trigger Fancybox
                    setTimeout(() => {
                        if (typeof Fancybox !== 'undefined') {
                            // Get all gallery images (excluding header thumbnail)
                            const galleryElements = document.querySelectorAll(`[data-fancybox="${galleryId}"]`);
                            const galleryImages = [...galleryElements].map(el => ({
                                src: el.href,
                                caption: el.getAttribute('data-caption') || '',
                                thumb: el.getAttribute('data-thumb') || el.href
                            }));

                            // Open gallery starting from the first image
                            Fancybox.show(galleryImages, { startIndex: 0 });
                        }
                    }, 100);
                }
                // If gallery images exist and are already loaded
                else if (hasGalleryImages && typeof Fancybox !== 'undefined') {
                    const galleryElements = document.querySelectorAll(`[data-fancybox="${galleryId}"]`);
                    const galleryImages = [...galleryElements].map(el => ({
                        src: el.href,
                        caption: el.getAttribute('data-caption') || '',
                        thumb: el.getAttribute('data-thumb') || el.href
                    }));

                    Fancybox.show(galleryImages, { startIndex: 0 });
                }
                // If no gallery images, just open the main image alone
                else if (!hasGalleryImages && typeof Fancybox !== 'undefined') {
                    Fancybox.show([{
                        src: reportData.photo.url,
                        caption: reportData.name || '',
                        thumb: reportData.photo.url
                    }]);
                }
            });
        }

        // Show the thumbnail
        thumbnailElement.style.display = '';
    }

    // Populate reporter byline links (duplicating the template for each reporter)
    function populateReporterBylineLinks(itemElement, reporters) {
        const templateLink = itemElement.querySelector('a[cms-link="reporter"]');
        if (!templateLink || !reporters || reporters.length === 0) {
            if (templateLink) templateLink.style.display = 'none';
            return;
        }

        // Get parent container
        const parentContainer = templateLink.parentElement;
        if (!parentContainer) return;

        // Remove any previously cloned reporter links and separators
        const existingLinks = parentContainer.querySelectorAll('a[cms-link="reporter"]');
        const existingSeparators = parentContainer.querySelectorAll('.reporter-separator');
        existingLinks.forEach((link, index) => {
            if (index > 0) link.remove();
        });
        existingSeparators.forEach(sep => sep.remove());

        // Find or create separator template
        const separatorTemplate = document.createElement('div');
        separatorTemplate.className = 'sub-text-block reporter-separator';
        separatorTemplate.textContent = '·';

        // Clone and populate for each reporter
        let lastElement = templateLink;
        reporters.forEach((reporter, index) => {
            if (!reporter.slug) return; // Skip reporters without slugs

            // Add separator before reporter (except for first one)
            if (index > 0) {
                const separator = separatorTemplate.cloneNode(true);
                parentContainer.insertBefore(separator, lastElement.nextSibling);
                lastElement = separator;
            }

            let reporterLink;
            if (index === 0) {
                // Use the template for the first reporter
                reporterLink = templateLink;
            } else {
                // Clone for additional reporters
                reporterLink = templateLink.cloneNode(true);
                parentContainer.insertBefore(reporterLink, lastElement.nextSibling);
            }

            // Update the link and text
            reporterLink.href = `/reporter/${reporter.slug}`;
            const reporterField = reporterLink.querySelector('[cms-field="reporters"]');
            if (reporterField) {
                reporterField.textContent = reporter.name;
            }
            reporterLink.style.display = '';
            lastElement = reporterLink;
        });

        // Hide template if no reporters
        if (reporters.filter(r => r.slug).length === 0) {
            templateLink.style.display = 'none';
        }
    }

    // Populate basic report fields (title, image, date, byline, topic)
    function populateBasicFields(itemElement, reportData) {
        let successCount = 0;

        const titleElement = itemElement.querySelector('[cms-field="title"]');
        if (setText(titleElement, reportData.name)) successCount++;

        const mainImage = itemElement.querySelector('[cms-content="main-image"]');
        if (setImage(mainImage, reportData.photo?.url || '', reportData.name)) successCount++;

        const dateValue = reportData.date || reportData.createdOn;
        const dateElement = itemElement.querySelector('[cms-field="date"]');
        if (setText(dateElement, formatDate(dateValue))) successCount++;

        const bylineElement = itemElement.querySelector('[cms-field="reporters"]');
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

        // Populate reporter byline links
        populateReporterBylineLinks(itemElement, reportData.reporters);

        // Populate header thumbnail if first image exists
        populateHeaderThumbnail(itemElement, reportData);

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
        // Remove any duplicate reporter links and separators first
        const allReporterLinks = reporterItem.querySelectorAll('[cms-link="reporter"]');
        const allSeparators = reporterItem.querySelectorAll('.reporter-separator');

        // Keep only the first reporter link, remove the rest
        allReporterLinks.forEach((link, index) => {
            if (index > 0) {
                link.remove();
            }
        });

        // Remove all separators in modal items
        allSeparators.forEach(sep => sep.remove());

        // Now populate the single reporter link
        const reporterLink = reporterItem.querySelector('[cms-link="reporter"]');
        if (reporterLink) {
            setLink(reporterLink, reporter.slug ? `/reporter/${reporter.slug}` : null);

            // Update name within the link
            const nameElement = reporterLink.querySelector('[cms-field="reporter"]');
            if (nameElement) {
                setText(nameElement, reporter.name);
            }

            // Update image within the link
            const imageElement = reporterLink.querySelector('[cms-field="reporter-image"]');
            if (imageElement && reporter.photo) {
                const photoUrl = reporter.photo.url || reporter.photo;
                imageElement.src = photoUrl;
                imageElement.alt = reporter.name;
            }
        }

        // Also update any standalone fields outside the link
        setText(reporterItem.querySelector('[fs-list-field="Reporter"]'), reporter.name);

        const imgEl = reporterItem.querySelector('[reporter-image="true"]');
        if (imgEl && reporter.photo) {
            const photoUrl = reporter.photo.url || reporter.photo;
            imgEl.src = photoUrl;
            imgEl.alt = reporter.name;
        }

        // Set action links
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

    // Populate perpetrator info for full reports
    function populatePerpetratorInfo(itemElement, reportData) {
        // Check if this is a full type report
        const itemType = itemElement.getAttribute('cms-item-type');
        if (itemType !== 'full') return;

        // Find the perpetrator info wrapper
        const perpInfoWrap = itemElement.querySelector('[cms-info="wrap"]');
        if (!perpInfoWrap) return;

        console.log('[CMS Client] Populating perpetrator info:', {
            perpetrators: reportData.perpetrators,
            settlement: reportData.settlement,
            place: reportData.place,
            locationType: reportData.locationType,
            backer: reportData.backer
        });

        // Populate perpetrator name and link (handle both singular and plural)
        const perpLink = perpInfoWrap.querySelector('a[cms-link="Perp"]');
        const perpField = perpInfoWrap.querySelector('div[cms-field="Perp"]');

        // Check for perpetrators array (plural) or perpetrator (singular)
        const perpetrator = reportData.perpetrators?.[0] || reportData.perpetrator;

        if (perpetrator) {
            if (perpLink && perpetrator.slug) {
                perpLink.href = `/perpetrator/${perpetrator.slug}`;
                perpLink.style.display = '';
            } else if (perpLink) {
                perpLink.style.display = 'none';
            }
            setText(perpField, perpetrator.name || perpetrator);
        } else {
            if (perpLink) perpLink.style.display = 'none';
            setText(perpField, 'Unknown');
        }

        // Populate settlement name and link
        const settlementLink = perpInfoWrap.querySelector('a[cms-link="Settlement"]');
        const settlementField = perpInfoWrap.querySelector('div[cms-field="Settlement"]');
        if (reportData.settlement) {
            if (settlementLink && reportData.settlement.slug) {
                settlementLink.href = `/settlement/${reportData.settlement.slug}`;
                settlementLink.style.display = '';
            } else if (settlementLink) {
                settlementLink.style.display = 'none';
            }
            setText(settlementField, reportData.settlement.name || reportData.settlement);
        } else {
            if (settlementLink) settlementLink.style.display = 'none';
            setText(settlementField, '');
        }

        // Populate place/location type
        const placeLink = perpInfoWrap.querySelector('a[cms-link="place"]');
        const placeField = perpInfoWrap.querySelector('div[cms-field="Place"]');
        if (reportData.place || reportData.locationType) {
            const placeName = reportData.place?.name || reportData.locationType?.name ||
                             reportData.place || reportData.locationType;
            const placeSlug = reportData.place?.slug || reportData.locationType?.slug;

            if (placeLink && placeSlug) {
                placeLink.href = `/place/${placeSlug}`;
                placeLink.style.display = '';
            } else if (placeLink) {
                placeLink.style.display = 'none';
            }
            setText(placeField, placeName);
        } else {
            if (placeLink) placeLink.style.display = 'none';
            setText(placeField, '');
        }

        // Populate backer
        const backerLink = perpInfoWrap.querySelector('a[cms-link="backer"]');
        const backerField = perpInfoWrap.querySelector('div[cms-field="backer"]');
        if (reportData.backer) {
            if (backerLink && reportData.backer.slug) {
                backerLink.href = `/backer/${reportData.backer.slug}`;
                backerLink.style.display = '';
            } else if (backerLink) {
                backerLink.style.display = 'none';
            }
            setText(backerField, reportData.backer.name || reportData.backer);
        } else {
            if (backerLink) backerLink.style.display = 'none';
            setText(backerField, '');
        }

        // Show/hide the "From" text based on settlement
        const fromText = Array.from(perpInfoWrap.querySelectorAll('.perpetrator-report-text'))
            .find(el => el.textContent === 'From');
        if (fromText) {
            fromText.style.display = reportData.settlement ? '' : 'none';
        }

        // Show/hide the "at" text based on place
        const atText = perpInfoWrap.querySelector('[fs-list-field="Place"]');
        if (atText) {
            atText.style.display = (reportData.place || reportData.locationType) ? '' : 'none';
        }

        // Show/hide the backer section
        const backerSection = perpInfoWrap.querySelector('.div-block-318671:last-child');
        if (backerSection) {
            backerSection.style.display = reportData.backer ? '' : 'none';
        }
    }

    // Populate content tabs (info, description, videos)
    function populateContent(itemElement, reportData, isLazyLoad = false) {
        const infoContent = itemElement.querySelector('[cms-content="info"]');
        const descriptionContent = itemElement.querySelector('[cms-content="description"]');
        if (reportData.description) {
            setRichText(infoContent, reportData.description);
            setRichText(descriptionContent, reportData.description);
        }

        // Note: Perpetrator info is now populated immediately in populateReportItem for full reports

        // Populate videos
        populateVideos(itemElement, reportData.videos);

        // Populate report images gallery with unique gallery ID
        populateImagesGallery(itemElement, reportData);

        // Skip tab visibility logic during lazy load - only apply on initial population
        if (isLazyLoad) {
            return;
        }

        // Check if this is a full type report
        const itemType = itemElement.getAttribute('cms-item-type');
        const isFullType = itemType === 'full';

        // Check content availability - only count reportImages, not main image
        const hasImages = reportData.reportImages && reportData.reportImages.length > 0;
        const hasVideos = reportData.videos && reportData.videos.length > 0;

        // Get tabs
        const infoTab = itemElement.querySelector('[data-tab="1"]');
        const imagesTab = itemElement.querySelector('[data-tab="2"]');
        const videosTab = itemElement.querySelector('[data-tab="3"]');
        const tabsWrap = itemElement.querySelector('[data-tab="wrap"]');

        // For mini type reports: hide tabs wrap entirely if no images and no videos
        // For full type reports: always show the tabs wrap, but hide individual tabs based on content
        if (isFullType) {
            // Full type: Show info tab, hide/show images and videos tabs based on content
            if (infoTab) {
                infoTab.style.display = '';
            }
            if (imagesTab) {
                imagesTab.style.display = hasImages ? '' : 'none';
            }
            if (videosTab) {
                videosTab.style.display = hasVideos ? '' : 'none';
            }
            // Keep tabs wrap visible for full type
            if (tabsWrap) {
                tabsWrap.style.display = '';
            }

            // Hide all tab content initially
            itemElement.querySelectorAll('[data-tab-content]').forEach(content => {
                content.style.display = 'none';
            });

            // Remove current class from all tabs
            itemElement.querySelectorAll('[data-tab]').forEach(tab => {
                tab.classList.remove('current');
            });

            // Ensure the accordion content area is collapsed initially
            const target = itemElement.querySelector('[open-target]');
            if (target) {
                target.style.height = '0px';
                target.style.overflow = 'hidden';
            }
        } else {
            // Mini type: Original behavior - hide entire tabs wrap if no media
            if (imagesTab) {
                imagesTab.style.display = hasImages ? '' : 'none';
            }
            if (videosTab) {
                videosTab.style.display = hasVideos ? '' : 'none';
            }
            if (tabsWrap) {
                // Hide entire tabs wrap if no images AND no videos
                if (!hasImages && !hasVideos) {
                    tabsWrap.style.display = 'none';
                } else {
                    tabsWrap.style.display = '';
                }
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

            // Set video iframe src with lazy loading
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

                // Use native lazy loading for iframes
                iframe.setAttribute('data-src', embedUrl);
                iframe.src = embedUrl;
                iframe.loading = 'lazy';

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
    function populateImagesGallery(itemElement, reportData) {
        const imagesWrap = itemElement.querySelector('[cms-deliver="images-wrap"]');
        const reportImages = reportData.reportImages;
        const mainImage = reportData.photo?.url;

        // Only show gallery if there are reportImages (not just main image)
        if (!imagesWrap || !reportImages || reportImages.length === 0) {
            if (imagesWrap) imagesWrap.style.display = 'none';
            return;
        }

        // Build image list - check if main image is already in reportImages
        const allImages = [];

        // Check if the main image is already the first item in reportImages
        const mainImageIsFirst = reportImages[0] && reportImages[0].url === mainImage;

        // Only add main image if it's not already in reportImages
        if (mainImage && !mainImageIsFirst && !reportImages.some(img => img.url === mainImage)) {
            allImages.push({
                url: mainImage,
                alt: reportData.name || 'Main image'
            });
        }

        // Add all report images
        allImages.push(...reportImages);

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
        const galleryId = 'gallery-' + reportData.id;

        // Clone and populate for each image
        allImages.forEach((image, index) => {
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

    // Setup tab visibility for full type reports without loading content
    function setupFullTypeTabsVisibility(itemElement, reportData) {
        // Check if this is a full type report
        const itemType = itemElement.getAttribute('cms-item-type');
        const isFullType = itemType === 'full';

        if (!isFullType) return;

        // Check content availability - only count reportImages, not main image
        const hasDescription = reportData.description && reportData.description.trim() !== '';
        const hasImages = reportData.reportImages && reportData.reportImages.length > 0;
        const hasVideos = reportData.videos && reportData.videos.length > 0;

        // Get tabs
        const infoTab = itemElement.querySelector('[data-tab="1"]');
        const imagesTab = itemElement.querySelector('[data-tab="2"]');
        const videosTab = itemElement.querySelector('[data-tab="3"]');
        const tabsWrap = itemElement.querySelector('[data-tab="wrap"]');

        // Full type: Show/hide tabs based on content
        if (infoTab) {
            infoTab.style.display = hasDescription ? '' : 'none';
        }
        if (imagesTab) {
            imagesTab.style.display = hasImages ? '' : 'none';
        }
        if (videosTab) {
            videosTab.style.display = hasVideos ? '' : 'none';
        }
        // Keep tabs wrap visible for full type
        if (tabsWrap) {
            tabsWrap.style.display = '';
        }

        // Hide all tab content initially
        itemElement.querySelectorAll('[data-tab-content]').forEach(content => {
            content.style.display = 'none';
        });

        // Remove current class from all tabs
        itemElement.querySelectorAll('[data-tab]').forEach(tab => {
            tab.classList.remove('current');
        });

        // Ensure the accordion content area is collapsed initially
        const target = itemElement.querySelector('[open-target]');
        if (target) {
            target.style.height = '0px';
            target.style.overflow = 'hidden';
        }

        // Mark that tabs have been initialized
        itemElement.setAttribute('data-tabs-initialized', 'true');
    }

    // Setup tab visibility for mini type reports without loading content
    function setupMiniTypeTabsVisibility(itemElement, reportData) {
        // Check if this is a mini type report (not full)
        const itemType = itemElement.getAttribute('cms-item-type');
        const isFullType = itemType === 'full';

        if (isFullType) return; // Skip if full type

        // Check content availability - only count reportImages, not main image
        const hasImages = reportData.reportImages && reportData.reportImages.length > 0;
        const hasVideos = reportData.videos && reportData.videos.length > 0;

        // Get tabs
        const infoTab = itemElement.querySelector('[data-tab="1"]');
        const imagesTab = itemElement.querySelector('[data-tab="2"]');
        const videosTab = itemElement.querySelector('[data-tab="3"]');
        const tabsWrap = itemElement.querySelector('[data-tab="wrap"]');

        // Mini type: Hide images/videos tabs based on content
        if (imagesTab) {
            imagesTab.style.display = hasImages ? '' : 'none';
        }
        if (videosTab) {
            videosTab.style.display = hasVideos ? '' : 'none';
        }

        // Mini type behavior: hide entire tabs wrap if no images AND no videos
        if (tabsWrap) {
            if (!hasImages && !hasVideos) {
                tabsWrap.style.display = 'none';
            } else {
                tabsWrap.style.display = '';
            }
        }

        // Mark that tabs have been initialized
        itemElement.setAttribute('data-tabs-initialized', 'true');
    }

    // Lazy load content for a report item (called when accordion opens)
    function lazyLoadReportContent(itemElement) {
        // Check if already loaded
        if (itemElement.getAttribute('data-content-loaded') === 'true') {
            return;
        }

        // Get stored report data
        const reportDataJson = itemElement.getAttribute('data-report-data');
        if (!reportDataJson) {
            console.warn('[CMS Client] No report data found for lazy loading');
            return;
        }

        try {
            const reportData = JSON.parse(reportDataJson);
            // Always pass true for isLazyLoad to skip tab visibility logic (already handled)
            populateContent(itemElement, reportData, true);
            itemElement.setAttribute('data-content-loaded', 'true');
            log('Lazy loaded content for report:', reportData.name);
        } catch (error) {
            console.error('[CMS Client] Error lazy loading content:', error);
        }
    }

    // Main function to populate a report item
    function populateReportItem(itemElement, reportData, lazyLoadContent = true) {
        const successCount = populateBasicFields(itemElement, reportData);
        populateLocationFields(itemElement, reportData);
        populateReporterInfo(itemElement, reportData.reporters || []);

        // Check if this is a full type report
        const itemType = itemElement.getAttribute('cms-item-type');
        const isFullType = itemType === 'full';

        // Populate perpetrator info immediately for full reports
        if (isFullType) {
            populatePerpetratorInfo(itemElement, reportData);
        }

        // Only populate content if lazyLoadContent is false (e.g., search results)
        if (!lazyLoadContent) {
            populateContent(itemElement, reportData);
        } else {
            // Store report data for lazy loading later
            itemElement.setAttribute('data-report-data', JSON.stringify(reportData));
            itemElement.setAttribute('data-content-loaded', 'false');

            // Set up tab visibility immediately based on content availability
            if (isFullType) {
                setupFullTypeTabsVisibility(itemElement, reportData);
            } else {
                setupMiniTypeTabsVisibility(itemElement, reportData);
            }
        }

        itemElement.setAttribute('data-report-id', reportData.id);
        itemElement.setAttribute('data-report-slug', reportData.slug || '');
        itemElement.classList.remove('is--loading');
        itemElement.classList.add('is--loaded');

        return successCount > 0;
    }

    // Populate reports in the DOM (used by both initial load and search)
    async function populateReports(items, listContainer, templateItem, appendMode = false) {
        // Always preserve the template item
        if (!templateItem) {
            console.error('[CMS Client] Template item not found!');
            return 0;
        }

        // Mark template as original on first use if not already marked
        if (!templateItem.classList.contains('cms-template-original')) {
            templateItem.classList.add('cms-template-original');
            templateItem.style.display = 'none';
        }

        if (!items || items.length === 0) {
            if (!appendMode) {
                // Remove all cloned items but keep the template (with cms-template-original class)
                const existingClones = listContainer.querySelectorAll('[cms-deliver="item"]:not(.cms-template-original)');
                existingClones.forEach(item => item.remove());

                // Remove any existing messages
                const existingMsg = listContainer.querySelector('.no-search-results, .search-error');
                if (existingMsg) existingMsg.remove();

                // Create and insert the no results message
                const noResultsMsg = document.createElement('div');
                noResultsMsg.className = 'no-search-results';
                noResultsMsg.style.cssText = 'padding: 40px 20px; text-align: center; color: #666;';
                noResultsMsg.innerHTML = 'No reports match your filters';

                // Insert after the template or at the end
                const sentinel = listContainer.querySelector('[scroll-sentinel="true"]');
                if (sentinel) {
                    listContainer.insertBefore(noResultsMsg, sentinel);
                } else {
                    listContainer.appendChild(noResultsMsg);
                }
            }
            return 0;
        }

        if (!appendMode) {
            // Remove all cloned items but keep the template
            const existingClones = listContainer.querySelectorAll('[cms-deliver="item"]:not(.cms-template-original)');
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
            // Remove all template-related classes from the clone
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

        // Ensure template stays hidden
        templateItem.style.display = 'none';

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

    // ===== FILTER SYSTEM START =====

    // Build URL with current filters
    function buildFilterUrl(offset = 0, limit = CONFIG.REPORTS_LIMIT) {
        let url = `${CONFIG.WORKER_URL}/reports?limit=${limit}&offset=${offset}`;

        // Add search filter
        if (currentFilters.search) {
            url += `&search=${encodeURIComponent(currentFilters.search)}`;
        }

        // Add date filters
        if (currentFilters.dateFrom) {
            url += `&dateFrom=${currentFilters.dateFrom}`;
        }
        if (currentFilters.dateUntil) {
            url += `&dateUntil=${currentFilters.dateUntil}`;
        }

        // Add array filters (checkboxes)
        ['topic', 'region', 'locality', 'territory', 'reporter'].forEach(filterKey => {
            if (currentFilters[filterKey] && currentFilters[filterKey].length > 0) {
                url += `&${filterKey}=${currentFilters[filterKey].join(',')}`;
            }
        });

        // Add boolean filters
        if (currentFilters.urgent !== null) {
            url += `&urgent=${currentFilters.urgent}`;
        }

        // Add timestamp to prevent caching
        url += `&_t=${Date.now()}`;

        return url;
    }

    // Tag Management System
    const TagManager = {
        tagWrap: null,
        tagTemplate: null,

        init() {
            // Find the tag-wrap element
            this.tagWrap = document.querySelector('[cms-filter-element="tag-wrap"]');
            if (this.tagWrap) {
                // Find the template tag inside tag-wrap
                this.tagTemplate = this.tagWrap.querySelector('[cms-filter-element="tag"]');
                // Hide the template tag
                if (this.tagTemplate) {
                    this.tagTemplate.style.display = 'none';
                    this.tagTemplate.classList.add('tag-template');
                }

                // Use event delegation for tag removal to avoid issues with recreated elements
                this.tagWrap.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('[cms-filter-element="tag-remove"]');
                    if (removeBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        const tag = removeBtn.closest('[cms-filter-element="tag"]');
                        if (tag && !tag.classList.contains('tag-template')) {
                            const filterKey = tag.getAttribute('data-filter-key');
                            const filterValue = tag.getAttribute('data-filter-value');
                            const isMultiValue = tag.hasAttribute('data-multi-value');

                            if (filterKey) {
                                if (isMultiValue) {
                                    this.removeAllValuesForKey(filterKey);
                                } else {
                                    this.removeTag(filterKey, filterValue);
                                }
                            }
                        }
                    }
                });
            }

            if (!this.tagWrap || !this.tagTemplate) {
                console.warn('[CMS Client] Tag elements not found');
            }
        },

        clearAllTags() {
            if (!this.tagWrap) return;
            // Remove all tags except the template
            const tags = this.tagWrap.querySelectorAll('[cms-filter-element="tag"]:not(.tag-template)');
            tags.forEach(tag => tag.remove());
        },

        addTag(field, value, filterKey, individualValues = null) {
            if (!this.tagWrap || !this.tagTemplate) return;

            const tag = this.tagTemplate.cloneNode(true);
            tag.style.display = '';
            tag.classList.remove('tag-template');
            tag.setAttribute('data-filter-key', filterKey);
            tag.setAttribute('data-filter-value', value);

            // Mark if this is a multi-value tag
            if (individualValues && individualValues.length > 1) {
                tag.setAttribute('data-multi-value', 'true');
            }

            // Set field and value text
            const fieldElements = tag.querySelectorAll('[cms-filter-element="tag-field"]');
            fieldElements[0] && (fieldElements[0].textContent = field);

            const valueElement = tag.querySelector('[cms-filter-element="tag-value"]');
            if (valueElement) valueElement.textContent = value;

            // Note: Click handler is now handled by event delegation in init()

            // Append the cloned tag to the wrap
            this.tagWrap.appendChild(tag);
        },

        removeAllValuesForKey(filterKey) {
            // Set clearing flag
            isClearing = true;

            // This handles removing all values for a multi-value tag
            if (Array.isArray(currentFilters[filterKey])) {
                // Clear the entire array
                currentFilters[filterKey] = [];

                // Uncheck all checkboxes for this filter
                const capitalizedKey = filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
                const checkboxes = document.querySelectorAll(
                    `[cms-filter="${filterKey}"], [cms-filter="${capitalizedKey}"]`
                );

                checkboxes.forEach(checkbox => {
                    if (checkbox.checked || isCheckboxChecked(checkbox)) {
                        checkbox.checked = false;
                        // Update Webflow checkbox styling
                        const checkboxDiv = checkbox.previousElementSibling ||
                                         checkbox.closest('.w-checkbox-input');
                        if (checkboxDiv) {
                            checkboxDiv.classList.remove('w--redirected-checked');
                        }
                        // Don't trigger change event to avoid conflicts
                    }
                });
            }

            // Small delay to ensure DOM updates are complete
            setTimeout(() => {
                isClearing = false;  // Reset flag
                applyFilters();
            }, 20);
        },

        removeTag(filterKey, value) {
            // Clear the filter
            if (filterKey === 'search') {
                currentFilters.search = '';
                const searchInput = document.querySelector('[filter-reports="search"]');
                if (searchInput) searchInput.value = '';
            } else if (filterKey === 'dateFrom') {
                currentFilters.dateFrom = '';
                const dateInput = document.querySelector('[cms-filter="From"]');
                if (dateInput) {
                    dateInput.value = '';
                    if (dateInput._flatpickr) {
                        dateInput._flatpickr.clear();
                    }
                }
            } else if (filterKey === 'dateUntil') {
                currentFilters.dateUntil = '';
                const dateInput = document.querySelector('[cms-filter="Until"]');
                if (dateInput) {
                    dateInput.value = '';
                    if (dateInput._flatpickr) {
                        dateInput._flatpickr.clear();
                    }
                }
            } else if (Array.isArray(currentFilters[filterKey])) {
                // Set clearing flag for individual removals
                isClearing = true;

                // Handle comma-separated values (in case of combined tags)
                const valuesToRemove = value.includes(',')
                    ? value.split(',').map(v => v.trim())
                    : [value];

                valuesToRemove.forEach(val => {
                    const index = currentFilters[filterKey].indexOf(val);
                    if (index > -1) {
                        currentFilters[filterKey].splice(index, 1);
                    }

                    // Uncheck the checkbox
                    let checkbox = document.querySelector(`[cms-filter="${filterKey}"][cms-filter-value="${val}"]`);
                    if (!checkbox) {
                        const capitalizedKey = filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
                        checkbox = document.querySelector(`[cms-filter="${capitalizedKey}"][cms-filter-value="${val}"]`);
                    }
                    if (checkbox) {
                        checkbox.checked = false;
                        // Update Webflow checkbox styling
                        const checkboxDiv = checkbox.previousElementSibling ||
                                         checkbox.closest('.w-checkbox-input');
                        if (checkboxDiv) {
                            checkboxDiv.classList.remove('w--redirected-checked');
                        }
                        // Don't trigger change event during clearing
                    }
                });
            } else {
                currentFilters[filterKey] = null;
            }

            // Small delay to ensure DOM updates are complete
            setTimeout(() => {
                isClearing = false;  // Reset flag
                applyFilters();
            }, 20);
        },

        updateTags() {
            this.clearAllTags();

            // Add search tag
            if (currentFilters.search) {
                this.addTag('Search', currentFilters.search, 'search');
            }

            // Add date range tags
            if (currentFilters.dateFrom) {
                this.addTag('From', formatDateForTag(currentFilters.dateFrom), 'dateFrom');
            }
            if (currentFilters.dateUntil) {
                this.addTag('Until', formatDateForTag(currentFilters.dateUntil), 'dateUntil');
            }

            // Add checkbox filter tags - create individual tags for each value
            ['topic', 'region', 'locality', 'territory', 'reporter'].forEach(filterKey => {
                if (currentFilters[filterKey] && currentFilters[filterKey].length > 0) {
                    const fieldName = filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
                    const values = currentFilters[filterKey];

                    if (values.length === 1) {
                        // Single value - create normal tag
                        this.addTag(fieldName, values[0], filterKey);
                    } else {
                        // Multiple values - create combined display but store individual values
                        this.addTag(fieldName, values.join(', '), filterKey, values);
                    }
                }
            });

            // Add urgent tag if active
            if (currentFilters.urgent !== null) {
                this.addTag('Urgent', currentFilters.urgent ? 'Yes' : 'No', 'urgent');
            }
        }
    };

    // Apply current filters and reload reports
    async function applyFilters() {
        // Reset pagination
        currentOffset = 0;
        hasMoreReports = true;

        // Update tags
        TagManager.updateTags();

        // Hide no more message
        const noMoreMsg = document.getElementById('no-more-reports');
        if (noMoreMsg) noMoreMsg.remove();

        const listContainer = document.querySelector('[cms-deliver="list"]');
        const templateItem = listContainer?.querySelector('[cms-deliver="item"]');

        if (!listContainer || !templateItem) {
            console.error('[CMS Client] List container or template not found');
            return;
        }

        try {
            const url = buildFilterUrl(0, CONFIG.REPORTS_LIMIT);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const response_data = await response.json();
            const items = response_data.data || [];

            currentOffset = CONFIG.REPORTS_LIMIT;
            totalReports = response_data.metadata?.total || items.length;
            hasMoreReports = (currentOffset < totalReports);

            await populateReports(items, listContainer, templateItem, false);

            // Update results count
            updateResultsCount(totalReports);

            console.log(`[CMS Client] Filters applied: ${items.length} results (Total: ${totalReports})`);

        } catch (error) {
            console.error('[CMS Client] Filter error:', error);

            const errorMsg = document.createElement('div');
            errorMsg.className = 'search-error';
            errorMsg.style.cssText = 'padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c00; margin: 20px;';
            errorMsg.innerHTML = `
                <strong>Filter error:</strong> ${error.message}<br>
                <small>Please try again</small>
            `;
            listContainer.appendChild(errorMsg);
        }
    }

    // Update results count display
    function updateResultsCount(count) {
        const countElements = document.querySelectorAll('[cms-filter-element="results-count"]');
        countElements.forEach(el => {
            el.textContent = count.toString();
        });
    }

    // Initialize date pickers with Flatpickr
    function initializeDatePickers() {
        // Initialize "From" date picker
        const fromInput = document.querySelector('[cms-filter="From"]');
        if (fromInput && typeof flatpickr !== 'undefined') {
            // Check if already initialized
            if (!fromInput._flatpickr) {
                flatpickr(fromInput, {
                    dateFormat: 'Y-m-d',
                    onChange: function(selectedDates, dateStr) {
                        currentFilters.dateFrom = dateStr;
                        applyFilters();
                    }
                });
            } else {
                // If already initialized, just add our event listener
                fromInput._flatpickr.config.onChange.push(function(selectedDates, dateStr) {
                    currentFilters.dateFrom = dateStr;
                    applyFilters();
                });
            }
        } else if (fromInput) {
            // Fallback: Listen for value changes if Flatpickr not available
            fromInput.addEventListener('change', function(e) {
                currentFilters.dateFrom = e.target.value;
                applyFilters();
            });
        }

        // Initialize "Until" date picker
        const untilInput = document.querySelector('[cms-filter="Until"]');
        if (untilInput && typeof flatpickr !== 'undefined') {
            // Check if already initialized
            if (!untilInput._flatpickr) {
                flatpickr(untilInput, {
                    dateFormat: 'Y-m-d',
                    onChange: function(selectedDates, dateStr) {
                        currentFilters.dateUntil = dateStr;
                        applyFilters();
                    }
                });
            } else {
                // If already initialized, just add our event listener
                untilInput._flatpickr.config.onChange.push(function(selectedDates, dateStr) {
                    currentFilters.dateUntil = dateStr;
                    applyFilters();
                });
            }
        } else if (untilInput) {
            // Fallback: Listen for value changes if Flatpickr not available
            untilInput.addEventListener('change', function(e) {
                currentFilters.dateUntil = e.target.value;
                applyFilters();
            });
        }
    }

    // Initialize checkbox filters
    function initializeCheckboxFilters() {
        const filterForm = document.querySelector('[cms-filter="form-block"]');
        if (!filterForm) return;

        // Find all checkboxes with cms-filter attribute
        const checkboxes = filterForm.querySelectorAll('input[type="checkbox"][cms-filter]');

        checkboxes.forEach(checkbox => {
            // Skip if already initialized
            if (checkbox.hasAttribute('data-filter-initialized')) return;
            checkbox.setAttribute('data-filter-initialized', 'true');

            // Track initial state
            const filterKey = checkbox.getAttribute('cms-filter').toLowerCase();
            const filterValue = checkbox.getAttribute('cms-filter-value') || checkbox.value;

            // Initialize filter array if needed
            if (!currentFilters[filterKey]) {
                currentFilters[filterKey] = [];
            }

            // Check initial state using multiple methods
            if (isCheckboxChecked(checkbox)) {
                if (!currentFilters[filterKey].includes(filterValue)) {
                    currentFilters[filterKey].push(filterValue);
                }
            }

            // Single change event listener (primary handler)
            checkbox.addEventListener('change', function(e) {
                // Don't handle if clearing is in progress
                if (!isClearing) {
                    handleCheckboxChange(this);
                }
            });

            // Skip MutationObserver and wrapper clicks as they cause duplicate handling
            // The change event should be sufficient for Webflow checkboxes
        });
    }

    // Helper function to determine if checkbox is checked
    function isCheckboxChecked(checkbox) {
        // Method 1: Check actual input state
        if (checkbox.checked) {
            return true;
        }

        // Method 2: Check for Webflow's redirected class
        const wrapper = checkbox.closest('.w-checkbox-input');
        if (wrapper && wrapper.classList.contains('w--redirected-checked')) {
            return true;
        }

        // Method 3: Check for custom checkbox wrapper state
        const checkboxDiv = checkbox.previousElementSibling;
        if (checkboxDiv && checkboxDiv.classList.contains('w-checkbox-input') &&
            checkboxDiv.classList.contains('w--redirected-checked')) {
            return true;
        }

        return false;
    }

    // Handle checkbox state changes
    function handleCheckboxChange(checkbox) {
        // Skip if we're in the middle of clearing
        if (isClearing) return;

        // Prevent duplicate processing
        if (checkbox.hasAttribute('data-processing')) return;
        checkbox.setAttribute('data-processing', 'true');

        // Small delay to let Webflow update the DOM
        setTimeout(() => {
            checkbox.removeAttribute('data-processing');

            const filterKey = checkbox.getAttribute('cms-filter').toLowerCase();
            const filterValue = checkbox.getAttribute('cms-filter-value') || checkbox.value;

            if (!currentFilters[filterKey]) {
                currentFilters[filterKey] = [];
            }

            // Use the native checked property as primary source of truth
            // since this is called from the change event
            const isChecked = checkbox.checked;
            const currentIndex = currentFilters[filterKey].indexOf(filterValue);

            // Only process if state actually changed
            if (isChecked && currentIndex === -1) {
                // Add to filter array
                currentFilters[filterKey].push(filterValue);
                applyFilters();
            } else if (!isChecked && currentIndex > -1) {
                // Remove from filter array
                currentFilters[filterKey].splice(currentIndex, 1);
                applyFilters();
            }
        }, 10);
    }

    // Initialize clear buttons
    function initializeClearButtons() {
        // Clear all button
        const clearAllButtons = document.querySelectorAll('[cms-clear-element="all"]');
        clearAllButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                clearAllFilters();
            });
        });

        // Individual clear buttons
        const clearButtons = document.querySelectorAll('[cms-clear-element]');
        clearButtons.forEach(btn => {
            const clearTargets = btn.getAttribute('cms-clear-element');
            if (clearTargets === 'all') return; // Skip "all" buttons

            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const targets = clearTargets.split(',').map(t => t.trim());

                targets.forEach(target => {
                    clearSpecificFilter(target);
                });

                // Small delay to ensure all DOM updates complete before applying filters
                setTimeout(() => {
                    applyFilters();
                }, 10);
            });
        });
    }

    // Clear all filters
    function clearAllFilters() {
        // Set clearing flag to prevent checkbox change handlers from firing
        isClearing = true;

        // Clear search
        currentFilters.search = '';
        const searchInput = document.querySelector('[filter-reports="search"]');
        if (searchInput) searchInput.value = '';

        // Clear dates
        currentFilters.dateFrom = '';
        currentFilters.dateUntil = '';
        const fromInput = document.querySelector('[cms-filter="From"]');
        const untilInput = document.querySelector('[cms-filter="Until"]');
        if (fromInput) {
            fromInput.value = '';
            if (fromInput._flatpickr) fromInput._flatpickr.clear();
        }
        if (untilInput) {
            untilInput.value = '';
            if (untilInput._flatpickr) untilInput._flatpickr.clear();
        }

        // Clear arrays first
        ['topic', 'region', 'locality', 'territory', 'reporter'].forEach(key => {
            currentFilters[key] = [];
        });

        // Clear all checkboxes (using the improved detection)
        const checkboxes = document.querySelectorAll('input[type="checkbox"][cms-filter]');
        checkboxes.forEach(cb => {
            if (cb.checked || isCheckboxChecked(cb)) {
                cb.checked = false;
                // Update Webflow checkbox styling directly
                const checkboxDiv = cb.previousElementSibling || cb.closest('.w-checkbox-input');
                if (checkboxDiv) {
                    checkboxDiv.classList.remove('w--redirected-checked');
                }
                // Don't trigger change event to avoid handler conflicts
            }
        });

        // Clear other filters
        currentFilters.urgent = null;

        // Apply filters with small delay to ensure DOM updates complete
        setTimeout(() => {
            isClearing = false;  // Reset flag
            applyFilters();
        }, 20);
    }

    // Clear specific filter
    function clearSpecificFilter(filterName) {
        if (filterName === 'From') {
            currentFilters.dateFrom = '';
            const input = document.querySelector('[cms-filter="From"]');
            if (input) {
                input.value = '';
                if (input._flatpickr) input._flatpickr.clear();
            }
        } else if (filterName === 'Until') {
            currentFilters.dateUntil = '';
            const input = document.querySelector('[cms-filter="Until"]');
            if (input) {
                input.value = '';
                if (input._flatpickr) input._flatpickr.clear();
            }
        } else if (filterName === 'search') {
            currentFilters.search = '';
            const input = document.querySelector('[filter-reports="search"]');
            if (input) input.value = '';
        } else {
            // Handle checkbox filters
            if (Array.isArray(currentFilters[filterName])) {
                currentFilters[filterName] = [];
                // Try both lowercase and capitalized versions
                let checkboxes = document.querySelectorAll(`input[type="checkbox"][cms-filter="${filterName}"]`);
                if (checkboxes.length === 0) {
                    // Try with capitalized version
                    const capitalizedName = filterName.charAt(0).toUpperCase() + filterName.slice(1);
                    checkboxes = document.querySelectorAll(`input[type="checkbox"][cms-filter="${capitalizedName}"]`);
                }
                checkboxes.forEach(cb => {
                    if (isCheckboxChecked(cb)) {
                        cb.checked = false;
                        // Update Webflow checkbox styling directly
                        const checkboxDiv = cb.previousElementSibling || cb.closest('.w-checkbox-input');
                        if (checkboxDiv) {
                            checkboxDiv.classList.remove('w--redirected-checked');
                        }
                        // Trigger change event to update Webflow styles
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            } else {
                currentFilters[filterName] = null;
            }
        }
    }

    // ===== FILTER SYSTEM END =====

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
            const url = buildFilterUrl(currentOffset, CONFIG.REPORTS_PER_PAGE);
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

            // Reset filters on initial load
            currentFilters = {
                search: '',
                dateFrom: '',
                dateUntil: '',
                topic: [],
                region: [],
                locality: [],
                territory: [],
                reporter: [],
                urgent: null
            };

            // Update results count
            updateResultsCount(totalReports);

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
                initializeFilters();
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

    // Initialize all filter components
    function initializeFilters() {
        TagManager.init();
        initializeDatePickers();
        initializeCheckboxFilters();
        initializeClearButtons();
    }

    // Track if interactions have been initialized
    let interactionsInitialized = false;

    // Store timeout IDs for overflow animation per container
    const overflowTimeouts = new WeakMap();

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

            // Skip the wrapper element itself
            if (tabId === 'wrap') return;

            // Support only [cms-deliver="item"] containers
            const container = tab.closest('[cms-deliver="item"]');

            if (!container) return;

            // Check if this is a 'full' type report
            const itemType = container.getAttribute('cms-item-type');
            const isFullType = itemType === 'full';

            const target = container.querySelector('[open-target]');
            const arrow = container.querySelector('[dropdown-icon]');

            // For full type: clicking tab opens accordion if closed and switches content
            if (isFullType) {
                // Check if clicking the current tab
                const isCurrentTab = tab.classList.contains('current');

                // Check if accordion is closed
                const isClosed = !target || target.style.height === '0px' || target.style.height === '0' || !target.style.height;

                // If clicking current tab and accordion is open, close it
                if (isCurrentTab && !isClosed && target) {
                    // Remove current class
                    tab.classList.remove('current');

                    // Clear any pending overflow timeout for this container
                    if (overflowTimeouts.has(container)) {
                        clearTimeout(overflowTimeouts.get(container));
                        overflowTimeouts.delete(container);
                    }

                    // Close the accordion
                    if (!target.style.transition) {
                        target.style.transition = 'height 300ms ease';
                    }
                    target.style.height = '0px';
                    target.style.overflow = 'hidden';
                    if (arrow) arrow.style.transform = 'rotateZ(0deg)';

                    return; // Exit here
                }

                // Switch to the selected tab
                container.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('current'));
                tab.classList.add('current');

                // Update tab content visibility
                container.querySelectorAll('[data-tab-content]').forEach(content => {
                    if (content.getAttribute('data-tab-content') === tabId) {
                        content.style.display = 'block';
                    } else {
                        content.style.display = 'none';
                    }
                });

                // Open accordion if it was closed
                if (isClosed && target) {
                    // Lazy load content if needed
                    const reportItem = container;
                    if (reportItem.getAttribute('data-content-loaded') !== 'true') {
                        lazyLoadReportContent(reportItem);
                    }

                    // Set transition
                    if (!target.style.transition) {
                        target.style.transition = 'height 300ms ease';
                    }

                    // Small delay to ensure content is rendered
                    setTimeout(() => {
                        target.style.height = target.scrollHeight + 'px';
                        if (arrow) arrow.style.transform = 'rotateZ(180deg)';

                        // Clear any existing timeout for this container
                        if (overflowTimeouts.has(container)) {
                            clearTimeout(overflowTimeouts.get(container));
                        }

                        // Set overflow visible after transition
                        const timeoutId = setTimeout(() => {
                            target.style.overflow = 'visible';
                            overflowTimeouts.delete(container);
                        }, 300);

                        overflowTimeouts.set(container, timeoutId);
                    }, 10);
                }
                // If already open, just ensure height adjusts to new content
                else if (target && target.style.height !== '0px' && target.style.height !== '0') {
                    const currentHeight = target.offsetHeight;
                    const originalTransition = target.style.transition;

                    target.style.transition = 'none';
                    target.style.height = 'auto';
                    const newHeight = target.scrollHeight;
                    target.style.height = currentHeight + 'px';

                    target.offsetHeight; // Force reflow

                    target.style.transition = originalTransition || 'height 300ms ease';
                    target.style.height = newHeight + 'px';
                }

                return; // Exit here for full type
            }

            // Original behavior for mini type (accordion reports)
            const isCurrentTab = tab.classList.contains('current');

            if (isCurrentTab) {
                if (target) {
                    if (!target.style.transition) {
                        target.style.transition = 'height 300ms ease';
                    }
                    target.style.height = '0px';
                    target.style.overflow = 'hidden';
                    if (arrow) arrow.style.transform = 'rotateZ(0deg)';
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

            // Support only [cms-deliver="item"] containers
            const container = trigger.closest('[cms-deliver="item"]');

            const target = container?.querySelector('[open-target]');
            const arrow = container?.querySelector('[dropdown-icon]');

            if (!target) return;

            // Check if this is a 'full' type report (full type doesn't use accordion triggers)
            const itemType = container?.getAttribute('cms-item-type');
            if (itemType === 'full') {
                // Full type reports don't use [open-trigger] for accordion
                // Their accordion is controlled by tabs
                return;
            }

            if (!target.style.transition) {
                target.style.transition = 'height 300ms ease';
            }

            const isClosed = target.style.height === '0px' || target.style.height === '0';

            if (isClosed || !target.style.height) {
                // Lazy load content before opening
                const reportItem = container.querySelector('[cms-deliver="item"]') || container;
                lazyLoadReportContent(reportItem);

                // Small delay to ensure content is rendered before measuring height
                setTimeout(() => {
                    target.style.height = target.scrollHeight + 'px';
                    if (arrow) arrow.style.transform = 'rotateZ(180deg)';

                    // Clear any existing timeout for this container
                    if (overflowTimeouts.has(container)) {
                        clearTimeout(overflowTimeouts.get(container));
                    }

                    // Set overflow visible after transition completes (300ms)
                    const timeoutId = setTimeout(() => {
                        target.style.overflow = 'visible';
                        overflowTimeouts.delete(container);
                    }, 300);

                    overflowTimeouts.set(container, timeoutId);
                }, 10);
            } else {
                // Clear any pending overflow timeout for this container
                if (overflowTimeouts.has(container)) {
                    clearTimeout(overflowTimeouts.get(container));
                    overflowTimeouts.delete(container);
                }

                // Close the accordion
                target.style.height = '0px';
                target.style.overflow = 'hidden';
                if (arrow) arrow.style.transform = 'rotateZ(0deg)';
            }
        });
    }

    // Initialize scroll-to-top button
    function initializeScrollToTop() {
        const scrollWrap = document.querySelector('[cms-reports="scroll-wrap"]');
        const jumpButton = document.querySelector('[cms-reports="jump-to-top"]');

        if (!scrollWrap || !jumpButton) {
            console.warn('[CMS Client] Scroll-to-top elements not found');
            return;
        }

        // Add custom scrollbar styling (overlay version that doesn't take up layout space)
        const styleId = 'cms-scrollbar-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Overlay scrollbar - no width specified so it doesn't take layout space */
                [cms-reports="scroll-wrap"]::-webkit-scrollbar {
                    /* No width/height specified - allows overlay behavior */
                }

                [cms-reports="scroll-wrap"]::-webkit-scrollbar-track {
                    background: transparent;
                }

                [cms-reports="scroll-wrap"]::-webkit-scrollbar-thumb {
                    background: transparent;
                    border-radius: 4px;
                    transition: background 0.3s ease;
                    /* Optional: add border for spacing from edge */
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }

                /* Show scrollbar on hover */
                [cms-reports="scroll-wrap"]:hover::-webkit-scrollbar-thumb {
                    background: rgba(100, 100, 100, 0.7);
                    background-clip: padding-box;
                }

                [cms-reports="scroll-wrap"]::-webkit-scrollbar-thumb:hover {
                    background: rgba(120, 120, 120, 0.9);
                    background-clip: padding-box;
                }

                /* Firefox scrollbar styling */
                [cms-reports="scroll-wrap"] {
                    scrollbar-width: thin;
                    scrollbar-color: transparent transparent;
                    transition: scrollbar-color 0.3s ease;
                }

                [cms-reports="scroll-wrap"]:hover {
                    scrollbar-color: rgba(100, 100, 100, 0.7) transparent;
                }
            `;
            document.head.appendChild(style);
        }

        // Set initial state
        jumpButton.style.opacity = '0';
        jumpButton.style.pointerEvents = 'none';
        // No transition - opacity directly follows scroll position

        // Handle scroll events
        scrollWrap.addEventListener('scroll', function() {
            const scrollTop = scrollWrap.scrollTop;

            // Calculate opacity based on scroll position (0 at top, 1 after 300px)
            const opacity = Math.min(scrollTop / 300, 1);

            jumpButton.style.opacity = opacity.toString();

            // Make clickable only when visible, don't block clicks when invisible
            if (opacity > 0) {
                jumpButton.style.pointerEvents = 'auto';
            } else {
                jumpButton.style.pointerEvents = 'none';
            }
        });

        // Handle click to scroll to top
        jumpButton.addEventListener('click', function(e) {
            e.preventDefault();

            scrollWrap.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });

        console.log('[CMS Client] Scroll-to-top initialized');
    }

    // Initialize all interactions (tabs, accordion, search) - only called once
    function initializeInteractions() {
        initializeTabsAndAccordion();
        initializeSearch();
        initializeScrollToTop();
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

        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim();

            clearTimeout(debounceTimer);

            debounceTimer = setTimeout(() => {
                currentFilters.search = query;
                applyFilters();
            }, 500);
        });

        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(debounceTimer);
                currentFilters.search = e.target.value.trim();
                applyFilters();
            }
        });

        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.target.value = '';
                clearTimeout(debounceTimer);
                currentFilters.search = '';
                applyFilters();
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
        currentFilters: currentFilters,
        applyFilters: applyFilters,
        clearAllFilters: clearAllFilters,
        TagManager: TagManager,
        checkElements: function() {
            const list = document.querySelector('[cms-deliver="list"]');
            const item = document.querySelector('[cms-deliver="item"]');
            const title = item ? item.querySelector('[cms-field="title"]') : null;
            const mainImage = item ? item.querySelector('[cms-content="main-image"]') : null;
            const date = item ? item.querySelector('[cms-field="date"]') : null;
            const reporters = item ? item.querySelector('[cms-field="reporters"]') : null;

            console.log('List container:', list);
            console.log('Template item:', item);
            console.log('Title element:', title);
            console.log('Main image element:', mainImage);
            console.log('Date element:', date);
            console.log('Reporters element:', reporters);

            return {
                hasList: !!list,
                hasItem: !!item,
                hasTitle: !!title,
                hasMainImage: !!mainImage,
                hasDate: !!date,
                hasReporters: !!reporters
            };
        },
        getState: function() {
            return {
                currentOffset,
                totalReports,
                hasMoreReports,
                isLoading,
                remaining: totalReports - currentOffset,
                filters: currentFilters
            };
        }
    };

    console.log('[CMS Client] Mini Reports with Filters script loaded. Debug available at window.cmsDebug');

})();
