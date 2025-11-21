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
        REPORTS_LIMIT: 10,  // Initial load
        REPORTS_PER_PAGE: 10,  // Load 10 more each scroll
        DEBUG: false // Set to true for detailed logging
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
                // Handle lazy loading
                if (element.classList.contains('lazy')) {
                    element.classList.remove('lazy');
                    element.loading = 'eager';
                }
                element.removeAttribute('data-ll-status');
                element.classList.remove('loading');
                return true;
            } else {
                // Use placeholder if no image
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
            // Clean and set HTML content
            element.innerHTML = htmlContent;
            return true;
        }
        return false;
    }

    // Populate mini report item
    function populateReportItem(itemElement, reportData) {
        let successCount = 0;
        let failCount = 0;

        // Debug logging for problematic reports
        if (reportData.slug === 'masked-israeli-settlers-attack-palestinian-village-injuring-residents-and-activists-in-west-bank') {
            console.log('[CMS Client] Debug - Problematic report data:', reportData);
            console.log('[CMS Client] Debug - Reporters:', reportData.reporters);
            console.log('[CMS Client] Debug - First reporter slug check:', reportData.reporters?.[0]?.slug);
        }

        // 1. Title in the main section
        const titleElement = itemElement.querySelector('.text-block-829806-1');
        if (!titleElement) {
            console.error('[CMS Client] Title element not found for report:', reportData.name);
            // Debug: log what elements ARE available
            const availableClasses = Array.from(itemElement.querySelectorAll('[class*="text-block"]')).map(el => el.className);
            console.log('[CMS Client] Available text-block classes:', availableClasses);
        }
        if (setText(titleElement, reportData.name)) {
            successCount++;
        } else {
            failCount++;
        }

        // 2. Main thumbnail image
        const mainImage = itemElement.querySelector('.image-63-1-copy');
        const imageUrl = reportData.photo?.url || '';
        if (setImage(mainImage, imageUrl, reportData.name)) {
            successCount++;
        }

        // 3. Date
        const dateValue = reportData.date || reportData.createdOn;
        const formattedDate = formatDate(dateValue);
        const dateElement = itemElement.querySelector('.mini-report-info-wrap .text-block-829818:first-child');
        if (setText(dateElement, formattedDate)) {
            successCount++;
        }

        // 4. By-line (reporter or source) - handle multiple reporters
        const bylineElement = itemElement.querySelector('.mini-report-info-wrap .text-block-829818:last-child');
        let bylineText = 'Unknown source';

        if (reportData.reporters && reportData.reporters.length > 0) {
            // Join all reporter names with commas
            const reporterNames = reportData.reporters.map(r => r.name);
            if (reporterNames.length === 1) {
                bylineText = reporterNames[0];
            } else if (reporterNames.length === 2) {
                bylineText = reporterNames.join(' & ');
            } else {
                // For 3+ reporters, use commas and 'and' for the last one
                const lastReporter = reporterNames.pop();
                bylineText = reporterNames.join(', ') + ' & ' + lastReporter;
            }
        }

        setText(bylineElement, bylineText);

        // 5. Category/Topic
        const topicElement = itemElement.querySelector('[cms-field="topic"]');
        const topicLinkElement = itemElement.querySelector('[cms-link="topic"]');
        if (reportData.topic && reportData.topic.slug) {
            setText(topicElement, reportData.topic.name);
            if (topicLinkElement) {
                topicLinkElement.href = `/topic/${reportData.topic.slug}`;
                topicLinkElement.style.display = '';
            }
            successCount++;
        } else {
            // Hide link if no topic
            if (topicLinkElement) topicLinkElement.style.display = 'none';
        }

        // 6. Location fields in the extended section
        const localityElement = itemElement.querySelector('[cms-field="locality"]');
        const localityLinkElement = itemElement.querySelector('[cms-link="locality"]');
        const regionElement = itemElement.querySelector('[cms-field="region"]');
        const regionLinkElement = itemElement.querySelector('[cms-link="region"]');
        const governorateElement = itemElement.querySelector('[cms-field="governorate"]');
        const governorateLinkElement = itemElement.querySelector('[cms-link="governorate"]');
        const territoryElement = itemElement.querySelector('[cms-field="territory"]');
        const territoryLinkElement = itemElement.querySelector('[cms-link="territory"]');

        // Query all slashes once and create a map for efficient lookup
        const slashes = {};
        itemElement.querySelectorAll('[slash-for]').forEach(slash => {
            slashes[slash.getAttribute('slash-for')] = slash;
        });

        // Locality from the new transformed API
        if (reportData.locality && reportData.locality.slug) {
            setText(localityElement, reportData.locality.name);
            if (localityLinkElement) {
                localityLinkElement.href = `/locality/${reportData.locality.slug}`;
                localityLinkElement.style.display = '';
            }
            if (slashes.locality) slashes.locality.style.display = '';
        } else {
            // Hide link and slash if no locality
            if (localityLinkElement) localityLinkElement.style.display = 'none';
            if (slashes.locality) slashes.locality.style.display = 'none';
        }

        // SubRegion from the new transformed API
        if (reportData.subRegion && reportData.subRegion.slug) {
            setText(regionElement, reportData.subRegion.name);
            if (regionLinkElement) {
                regionLinkElement.href = `/region/${reportData.subRegion.slug}`;
                regionLinkElement.style.display = '';
            }
            if (slashes.region) slashes.region.style.display = '';
        } else {
            // Hide link and slash if no subregion
            if (regionLinkElement) regionLinkElement.style.display = 'none';
            if (slashes.region) slashes.region.style.display = 'none';
        }

        // Region from the new transformed API (Governorate)
        if (reportData.region && reportData.region.slug) {
            setText(governorateElement, reportData.region.name);
            if (governorateLinkElement) {
                governorateLinkElement.href = `/region/${reportData.region.slug}`;
                governorateLinkElement.style.display = '';
            }
            if (slashes.governorate) slashes.governorate.style.display = '';
        } else {
            // Hide link and slash if no governorate
            if (governorateLinkElement) governorateLinkElement.style.display = 'none';
            if (slashes.governorate) slashes.governorate.style.display = 'none';
        }

        // Territory
        if (reportData.territory) {
            setText(territoryElement, reportData.territory.name);
            // Only set link if slug exists
            if (territoryLinkElement && reportData.territory.slug) {
                territoryLinkElement.href = `/territory/${reportData.territory.slug}`;
                territoryLinkElement.style.display = '';
            } else if (territoryLinkElement) {
                // Hide link if no slug, but text will still show
                territoryLinkElement.style.display = 'none';
            }
        } else {
            // Hide link if no territory at all
            if (territoryLinkElement) territoryLinkElement.style.display = 'none';
        }

        // 7. Reporter information - handle multiple reporters with modal support
        const reportersWrap = itemElement.querySelector('[reporters-wrap="true"]');
        const reporterElement = itemElement.querySelector('[fs-list-field="Reporter"]');
        const reporterNameElement = itemElement.querySelector('[reporter]');
        const reporterLinkElement = itemElement.querySelector('[cms-link="reporter"]');
        const multiReporterNameElement = itemElement.querySelector('.multi-reporter-name');
        const multiReporterWrap = itemElement.querySelector('[multi-reporter-wrap="true"]');
        const reporterListWrap = itemElement.querySelector('[reporter-list-wrap="true"]');

        // New elements for single reporter display
        const singleReporterNameElement = itemElement.querySelector('[cms-field="reporter"]');
        const singleReporterImageElement = itemElement.querySelector('[cms-field="reporter-image"]');

        const reporters = reportData.reporters || [];

        if (reporters.length > 0 && reporters[0].slug) {
            // For the main reporter display (first reporter)
            const firstReporter = reporters[0];
            setText(reporterElement, firstReporter.name);
            setText(reporterNameElement, firstReporter.name);

            // Set reporter link
            if (reporterLinkElement) {
                reporterLinkElement.href = `/reporter/${firstReporter.slug}`;
                reporterLinkElement.style.display = '';
            }

            // Handle single reporter case - populate cms-field elements
            if (reporters.length === 1) {
                // Set single reporter name
                if (singleReporterNameElement) {
                    setText(singleReporterNameElement, firstReporter.name);
                }

                // Set single reporter image
                if (singleReporterImageElement && firstReporter.photo) {
                    singleReporterImageElement.src = firstReporter.photo.url || firstReporter.photo;
                    singleReporterImageElement.alt = firstReporter.name;
                }

                // Set single reporter link using cms-link="reporter"
                // Look for any <a> tag with cms-link="reporter" that might wrap or be near the single reporter fields
                const singleReporterLinks = itemElement.querySelectorAll('a[cms-link="reporter"]');
                singleReporterLinks.forEach(link => {
                    // Check if this link contains or is associated with single reporter fields
                    if (link.querySelector('[cms-field="reporter"]') ||
                        link.querySelector('[cms-field="reporter-image"]') ||
                        link.closest('[reporters-wrap="true"]')) {
                        if (firstReporter.slug) {
                            link.href = `/reporter/${firstReporter.slug}`;
                            link.style.display = '';
                        }
                    }
                });

                // Set single reporter support and join links
                // Use donation link for reporter-support
                if (firstReporter.donationLink) {
                    const supportLinks = itemElement.querySelectorAll('[cms-link="reporter-support"]');
                    supportLinks.forEach(link => {
                        link.href = firstReporter.donationLink;
                        link.style.display = '';
                    });
                }

                // Use join link for reporter-join
                if (firstReporter.joinLink) {
                    const joinLinks = itemElement.querySelectorAll('[cms-link="reporter-join"]');
                    joinLinks.forEach(link => {
                        link.href = firstReporter.joinLink;
                        link.style.display = '';
                    });
                }
            }

            // Handle multiple reporters with modal functionality
            if (reporters.length > 1 && multiReporterWrap && reporterListWrap && reportersWrap) {
                // Show multi-reporter wrap
                multiReporterWrap.style.display = 'flex';
                // Hide reporter list initially (will show in modal)
                reporterListWrap.style.display = 'none';

                // Format multiple reporter names
                let displayName = '';
                if (reporters.length === 2) {
                    displayName = reporters.map(r => r.name).join(' & ');
                } else {
                    // Show count for 3+ reporters
                    displayName = `${firstReporter.name} + ${reporters.length - 1} more`;
                }
                setText(multiReporterNameElement, displayName);

                // Set up reporter images if they exist
                const firstReporterImage = multiReporterWrap.querySelector('[first-reporter-image="true"]');
                const secondReporterImage = multiReporterWrap.querySelector('[second-reporter-image="true"]');

                if (firstReporterImage && reporters[0].photo) {
                    firstReporterImage.src = reporters[0].photo.url || reporters[0].photo;
                    firstReporterImage.alt = reporters[0].name;
                }

                if (secondReporterImage && reporters[1] && reporters[1].photo) {
                    secondReporterImage.src = reporters[1].photo.url || reporters[1].photo;
                    secondReporterImage.alt = reporters[1].name;
                }

                // Populate reporter list for modal - duplicate .collection-item-2 for each reporter
                const modalPreWrap = reporterListWrap.querySelector('.modal-pre-wrap');

                if (modalPreWrap) {
                    // Find the collection-item-2 template inside modal-pre-wrap
                    const templateReporterItem = modalPreWrap.querySelector('.collection-item-2');

                    if (templateReporterItem) {
                        // Find the parent container of collection-item-2 (where we'll append clones)
                        const itemsContainer = templateReporterItem.parentElement;

                        // First, clear ALL existing collection-item-2 elements
                        const existingItems = itemsContainer.querySelectorAll('.collection-item-2');
                        existingItems.forEach((item, idx) => {
                            if (idx > 0) item.remove(); // Keep first as template
                        });

                        // Hide the template initially
                        templateReporterItem.style.display = 'none';

                        reporters.forEach((reporter, index) => {
                            // Always clone the template for each reporter
                            const reporterItem = templateReporterItem.cloneNode(true);
                            reporterItem.style.display = ''; // Make visible

                            // Populate cms-field attributes
                            const reporterNameField = reporterItem.querySelector('[cms-field="reporter"]');
                            if (reporterNameField) {
                                setText(reporterNameField, reporter.name);
                            }

                            const reporterImageField = reporterItem.querySelector('[cms-field="reporter-image"]');
                            if (reporterImageField && reporter.photo) {
                                reporterImageField.src = reporter.photo.url || reporter.photo;
                                reporterImageField.alt = reporter.name;
                            }

                            // Also update existing attributes for backward compatibility
                            const nameEl = reporterItem.querySelector('[fs-list-field="Reporter"]');
                            setText(nameEl, reporter.name);

                            const linkEl = reporterItem.querySelector('[cms-link="reporter"]');
                            if (linkEl && reporter.slug) {
                                linkEl.href = `/reporter/${reporter.slug}`;
                                linkEl.style.display = '';
                            } else if (linkEl) {
                                linkEl.style.display = 'none';
                            }

                            const imgEl = reporterItem.querySelector('[reporter-image="true"]');
                            if (imgEl && reporter.photo) {
                                imgEl.src = reporter.photo.url || reporter.photo;
                                imgEl.alt = reporter.name;
                            }

                            // Set support and join links for this reporter
                            // Use donation link for reporter-support
                            const supportLinks = reporterItem.querySelectorAll('[cms-link="reporter-support"]');
                            if (reporter.donationLink) {
                                supportLinks.forEach(link => {
                                    link.href = reporter.donationLink;
                                    link.style.display = '';
                                });
                            } else {
                                // Hide support links if no donation link
                                supportLinks.forEach(link => {
                                    link.style.display = 'none';
                                });
                            }

                            // Use join link for reporter-join
                            const joinLinks = reporterItem.querySelectorAll('[cms-link="reporter-join"]');
                            if (reporter.joinLink) {
                                joinLinks.forEach(link => {
                                    link.href = reporter.joinLink;
                                    link.style.display = '';
                                });
                            } else {
                                // Hide join links if no join link
                                joinLinks.forEach(link => {
                                    link.style.display = 'none';
                                });
                            }

                            // Always append the cloned item (for all reporters)
                            itemsContainer.appendChild(reporterItem);
                        });
                    }
                }

                // Set up modal trigger (click on multi-reporter wrap)
                // Check if already initialized
                if (!multiReporterWrap.hasAttribute('data-modal-initialized')) {
                    multiReporterWrap.setAttribute('data-modal-initialized', 'true');
                    multiReporterWrap.style.cursor = 'pointer';

                    multiReporterWrap.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();

                        // Find modal elements within reporter-list-wrap
                        const reporterListWrapCurrent = reportersWrap.querySelector('[reporter-list-wrap="true"]');

                        if (reporterListWrapCurrent) {
                            // Add modal-click class to the list wrap
                            reporterListWrapCurrent.classList.add('modal-click');
                            reporterListWrapCurrent.style.display = 'flex';

                            // Add modal-click class to the modal-pre-wrap
                            const modalPreWrapInClick = reporterListWrapCurrent.querySelector('.modal-pre-wrap');
                            if (modalPreWrapInClick) {
                                modalPreWrapInClick.classList.add('modal-click');

                                // Also add to modal-elements inside modal-pre-wrap
                                const modalElements = modalPreWrapInClick.querySelector('[modal-elements="true"]');
                                if (modalElements) {
                                    modalElements.classList.add('modal-click');
                                }
                            }
                        }
                    });
                }

                // Set up modal background click to close
                if (!reporterListWrap.hasAttribute('data-modal-bg-initialized')) {
                    reporterListWrap.setAttribute('data-modal-bg-initialized', 'true');

                    reporterListWrap.addEventListener('click', function(e) {
                        // Only close if clicking directly on the background, not children
                        if (e.target === this) {
                            e.preventDefault();

                            // Remove modal-click from the modal-pre-wrap
                            const modalPreWrapInBg = this.querySelector('.modal-pre-wrap');
                            if (modalPreWrapInBg) {
                                modalPreWrapInBg.classList.remove('modal-click');

                                // Also remove from modal-elements inside modal-pre-wrap
                                const modalElements = modalPreWrapInBg.querySelector('[modal-elements="true"]');
                                if (modalElements) {
                                    modalElements.classList.remove('modal-click');
                                }
                            }

                            this.classList.remove('modal-click');
                            this.style.display = 'none';
                        }
                    });
                }

                // Set up close button for the modal-pre-wrap
                const modalPreWrapForClose = reporterListWrap.querySelector('.modal-pre-wrap');
                if (modalPreWrapForClose) {
                    const closeBtn = modalPreWrapForClose.querySelector('[modal-close-btn="true"]');
                    if (closeBtn && !closeBtn.hasAttribute('data-modal-close-initialized')) {
                        closeBtn.setAttribute('data-modal-close-initialized', 'true');

                        closeBtn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();

                            const reporterListWrapCurrent = this.closest('[reporter-list-wrap="true"]');

                            if (reporterListWrapCurrent) {
                                // Remove modal-click from the modal-pre-wrap
                                const modalPreWrapInner = reporterListWrapCurrent.querySelector('.modal-pre-wrap');
                                if (modalPreWrapInner) {
                                    modalPreWrapInner.classList.remove('modal-click');

                                    // Also remove from modal-elements inside modal-pre-wrap
                                    const modalElements = modalPreWrapInner.querySelector('[modal-elements="true"]');
                                    if (modalElements) {
                                        modalElements.classList.remove('modal-click');
                                    }
                                }

                                reporterListWrapCurrent.classList.remove('modal-click');
                                reporterListWrapCurrent.style.display = 'none';
                            }
                        });
                    }
                }
            } else if (reporters.length === 1) {
                // Single reporter - hide multi-reporter wrap but keep modal structure available
                if (multiReporterWrap) multiReporterWrap.style.display = 'none';
                // Don't hide reporter-list-wrap - keep it available

                // Still populate the name for single reporter
                setText(multiReporterNameElement, firstReporter.name);
            }
        } else {
            // Hide link if no reporters
            if (reporterLinkElement) reporterLinkElement.style.display = 'none';
            if (multiReporterWrap) multiReporterWrap.style.display = 'none';
            if (reporterListWrap) reporterListWrap.style.display = 'none';
        }

        // Support/Join buttons - use first reporter's links if available
        const supportButton = itemElement.querySelector('.support-button-2');
        const joinButton = itemElement.querySelector('.join-button-2');

        if (reporters.length > 0) {
            const firstReporter = reporters[0];

            // Use donation link for support button
            if (supportButton && firstReporter.donationLink) {
                supportButton.href = firstReporter.donationLink;
                supportButton.style.display = '';
            } else if (supportButton) {
                supportButton.style.display = 'none';
            }

            // Use join link for join button
            if (joinButton && firstReporter.joinLink) {
                joinButton.href = firstReporter.joinLink;
                joinButton.style.display = '';
            } else if (joinButton) {
                joinButton.style.display = 'none';
            }
        } else {
            // Hide buttons if no reporters
            if (supportButton) supportButton.style.display = 'none';
            if (joinButton) joinButton.style.display = 'none';
        }

        // 8. Rich text content (Info tab and Description)
        const infoContent = itemElement.querySelector('[cms-content="info"]');
        if (infoContent && reportData.description) {
            setRichText(infoContent, reportData.description);
        }

        const descriptionContent = itemElement.querySelector('[cms-content="description"]');
        if (descriptionContent && reportData.description) {
            setRichText(descriptionContent, reportData.description);
        }

        // 9. Videos (Videos tab) - using videoLink from transformed API
        const videoElements = itemElement.querySelectorAll('.embedvideo iframe');
        if (reportData.videoLink && videoElements.length > 0) {
            // Convert to embed format if needed
            let embedUrl = reportData.videoLink;
            if (embedUrl.includes('youtube.com/watch?v=')) {
                const videoId = embedUrl.split('v=')[1].split('&')[0];
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
            } else if (embedUrl.includes('youtu.be/')) {
                const videoId = embedUrl.split('youtu.be/')[1].split('?')[0];
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
            }

            videoElements[0].setAttribute('data-src', embedUrl);
            videoElements[0].src = embedUrl;
        }

        // Store report ID
        itemElement.setAttribute('data-report-id', reportData.id);
        itemElement.setAttribute('data-report-slug', reportData.slug || '');

        // Remove any loading states
        itemElement.classList.remove('is--loading');
        itemElement.classList.add('is--loaded');

        // Debug logging for success/fail counts
        if (reportData.slug === 'masked-israeli-settlers-attack-palestinian-village-injuring-residents-and-activists-in-west-bank' || failCount > 0) {
            console.log(`[CMS Client] Report "${reportData.name}" - Success: ${successCount}, Fail: ${failCount}`);
        }

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
            // Clear any existing cloned items (keep template) - only for initial/search load
            const existingClones = listContainer.querySelectorAll('[cms-deliver="item"]:not(:first-child)');
            existingClones.forEach(item => item.remove());

            // Remove any existing messages
            const existingMsg = listContainer.querySelector('.no-search-results, .search-error');
            if (existingMsg) existingMsg.remove();
        }

        // Make sure template is in the DOM and visible for cloning
        if (templateItem.parentNode !== listContainer) {
            console.error('[CMS Client] Template not in list container!');
            return 0;
        }

        // Find the scroll sentinel to insert before it
        const sentinel = listContainer.querySelector('[scroll-sentinel="true"]');

        // Use DocumentFragment for efficient batch DOM insertion
        const fragment = document.createDocumentFragment();

        // Process reports
        let successCount = 0;
        items.forEach((report, index) => {
            const newItem = templateItem.cloneNode(true);
            newItem.classList.remove('cms-template', 'is--loading', 'cms-template-original');

            // Make sure the item is visible
            newItem.style.display = '';

            const populated = populateReportItem(newItem, report);

            if (populated) {
                // Add to fragment instead of inserting directly
                fragment.appendChild(newItem);
                successCount++;
            } else {
                console.warn(`[CMS Client] Failed to populate report ${index + 1}:`, report.name || 'Unknown', 'ID:', report.id);
                // Debug log the failed report
                if (report.slug === 'masked-israeli-settlers-attack-palestinian-village-injuring-residents-and-activists-in-west-bank') {
                    console.error('[CMS Client] Specific problematic report failed to populate:', report);
                }
            }
        });

        // Single DOM insertion for all items (much faster than individual inserts)
        if (sentinel) {
            listContainer.insertBefore(fragment, sentinel);
        } else {
            listContainer.appendChild(fragment);
        }

        // Hide the original template
        templateItem.style.display = 'none';
        templateItem.classList.add('cms-template-original');

        console.log(`[CMS Client] Populated ${successCount} items in DOM`);

        return successCount;
    }

    // Show loading indicator
    function showLoadingIndicator(listContainer) {
        // Remove existing loader if any
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
            // Increment offset
            currentOffset += CONFIG.REPORTS_PER_PAGE;

            // Build URL with current filters and new offset
            let url = `${CONFIG.WORKER_URL}/reports?limit=${CONFIG.REPORTS_PER_PAGE}&offset=${currentOffset}`;

            // Add search filter if exists
            if (currentFilters.search) {
                url += `&search=${encodeURIComponent(currentFilters.search)}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const response_data = await response.json();
            const items = response_data.data || [];

            // Debug: Check if specific report is in this batch
            console.log('[CMS Client] Checking batch at offset', currentOffset - CONFIG.REPORTS_PER_PAGE, ', items received:', items.length);
            console.log('[CMS Client] First 3 slugs in batch:', items.slice(0, 3).map(r => r.slug));

            const problematicReport = items.find(r => r.slug === 'masked-israeli-settlers-attack-palestinian-village-injuring-residents-and-activists-in-west-bank');
            if (problematicReport) {
                console.log('[CMS Client] ✅ FOUND problematic report in batch at offset', currentOffset - CONFIG.REPORTS_PER_PAGE, ':', problematicReport);
                console.log('[CMS Client] Report will be at DOM position:', currentOffset - CONFIG.REPORTS_PER_PAGE + items.indexOf(problematicReport) + 1);
                console.log('[CMS Client] Report has reporters:', problematicReport.reporters?.length || 0);
            } else {
                console.log('[CMS Client] ❌ Problematic report NOT in this batch (offset', currentOffset - CONFIG.REPORTS_PER_PAGE, 'limit', CONFIG.REPORTS_PER_PAGE, ')');

                // Check if any slug contains the text we're looking for
                const similarSlugs = items.filter(r => r.slug && r.slug.includes('masked'));
                if (similarSlugs.length > 0) {
                    console.log('[CMS Client] Found similar slugs:', similarSlugs.map(r => r.slug));
                }
            }

            // Append new reports (don't clear existing)
            const successCount = await populateReports(items, listContainer, templateItem, true);

            // Update state
            totalReports = response_data.metadata?.total || totalReports;
            hasMoreReports = (currentOffset < totalReports);

            log(`Loaded ${successCount} more reports. Total offset: ${currentOffset}, Total reports: ${totalReports}, Has more: ${hasMoreReports}`);

            // Show "no more" message if we've reached the end
            if (!hasMoreReports) {
                showNoMoreMessage(listContainer);
            }

        } catch (error) {
            console.error('[CMS Client] Error loading more reports:', error);
            // Don't increment offset on error, allow retry
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

            // Fetch reports
            const response = await fetch(`${CONFIG.WORKER_URL}/reports?limit=${CONFIG.REPORTS_LIMIT}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const response_data = await response.json();

            // Populate the reports (API returns { data: [...] } now)
            const items = response_data.data || [];

            // Debug: Check if specific report is in the response
            const problematicReport = items.find(r => r.slug === 'masked-israeli-settlers-attack-palestinian-village-injuring-residents-and-activists-in-west-bank');
            if (problematicReport) {
                console.log('[CMS Client] Found problematic report in initial load:', problematicReport);
            } else {
                console.log('[CMS Client] Problematic report NOT in initial response. Checking slugs:');
                console.log('[CMS Client] All slugs:', items.map(r => r.slug));
            }

            const successCount = await populateReports(items, listContainer, templateItem);

            // Initialize pagination state
            currentOffset = CONFIG.REPORTS_LIMIT;
            totalReports = response_data.metadata?.total || items.length;
            hasMoreReports = (currentOffset < totalReports);
            currentFilters = {};  // Reset filters

            console.log(`[CMS Client] Loaded ${successCount} reports. Total: ${totalReports}, Has more: ${hasMoreReports}`);

            // Initialize UI interactions only on first load
            if (initializeUI) {
                initializeInteractions();
                initializeInfiniteScroll(listContainer);
            }

            // Dispatch success event
            window.dispatchEvent(new CustomEvent('cmsDataLoaded', {
                detail: {
                    count: successCount,
                    total: totalReports
                }
            }));

        } catch (error) {
            console.error('[CMS Client] Error:', error);

            // Try to show error in UI
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

            // Check if clicking on already active tab
            const isCurrentTab = tab.classList.contains('current');

            if (isCurrentTab) {
                // Close the accordion if clicking on active tab
                if (target) {
                    if (!target.style.transition) {
                        target.style.transition = 'height 300ms ease';
                    }
                    target.style.height = '0px';
                    if (arrow) arrow.style.transform = 'rotate(0deg)';
                }
                return;
            }

            // Update active tab
            container.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('current'));
            tab.classList.add('current');

            // Show corresponding content
            container.querySelectorAll('[data-tab-content]').forEach(content => {
                if (content.getAttribute('data-tab-content') === tabId) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });

            // Adjust the open-target height to match new content
            if (target && target.style.height !== '0px' && target.style.height !== '0') {
                // If accordion is open, update height to match new tab content with smooth transition
                // Store current height
                const currentHeight = target.offsetHeight;

                // Temporarily remove transition and set to auto to measure new height
                const originalTransition = target.style.transition;
                target.style.transition = 'none';
                target.style.height = 'auto';
                const newHeight = target.scrollHeight;

                // Restore current height without animation
                target.style.height = currentHeight + 'px';

                // Force reflow to ensure the height is set before animating
                target.offsetHeight;

                // Restore transition and animate to new height
                target.style.transition = originalTransition || 'height 300ms ease';
                target.style.height = newHeight + 'px';
            }
        });

        // Accordion open/close - use event delegation
        document.addEventListener('click', function(e) {
            const trigger = e.target.closest('[open-trigger]');
            if (!trigger) return;

            // Check if the clicked element is a link or inside a link
            const clickedLink = e.target.closest('a');
            if (clickedLink && trigger.contains(clickedLink)) {
                // Don't prevent default for links - let them work normally
                return;
            }

            e.preventDefault();
            const container = trigger.closest('.mini-report-wrap');
            const target = container?.querySelector('[open-target]');
            const arrow = container?.querySelector('[dropdown-icon]');

            if (!target) return;

            // Add transition for smooth height animation
            if (!target.style.transition) {
                target.style.transition = 'height 300ms ease';
            }

            // Check if target is closed (height is 0 or 0px)
            const isClosed = target.style.height === '0px' || target.style.height === '0';

            if (isClosed || !target.style.height) {
                // Open: set height to scrollHeight
                target.style.height = target.scrollHeight + 'px';
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            } else {
                // Close: set height to 0
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
        // Use existing Webflow div with scroll-sentinel attribute
        const sentinel = listContainer.querySelector('[scroll-sentinel="true"]');

        if (!sentinel) {
            console.error('[CMS Client] Scroll sentinel not found! Add a div with scroll-sentinel="true" at the bottom of your list.');
            return;
        }

        // Create IntersectionObserver with more aggressive settings
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && hasMoreReports && !isLoading) {
                    log('Sentinel visible, loading more reports...');
                    loadMoreReports();
                }
            });
        }, {
            root: null,  // viewport
            rootMargin: '500px',  // Trigger 500px before reaching sentinel (more aggressive)
            threshold: 0.1
        });

        observer.observe(sentinel);

        console.log('[CMS Client] Infinite scroll initialized with 500px margin');

        // Auto-load remaining reports if they're few
        setTimeout(() => {
            const remaining = totalReports - currentOffset;
            if (remaining > 0 && remaining <= 20 && hasMoreReports) {
                console.log(`[CMS Client] Auto-loading remaining ${remaining} reports`);
                loadMoreReports();
            }
        }, 2000);

        // Also trigger immediate load for next batch if viewport is tall enough
        setTimeout(() => {
            if (hasMoreReports && !isLoading) {
                const viewportHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;

                // If viewport is tall enough that we can see most of the content, load more
                if (viewportHeight > documentHeight * 0.6) {
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

        // Function to perform server-side search
        async function performSearch(query) {
            const trimmedQuery = query.trim();

            const listContainer = document.querySelector('[cms-deliver="list"]');
            const templateItem = listContainer.querySelector('[cms-deliver="item"]');

            if (!listContainer || !templateItem) {
                console.error('[CMS Client] Search error: List container or template not found');
                return;
            }

            // If search is empty, reload all reports WITHOUT reinitializing UI
            if (!trimmedQuery) {
                // Reset pagination state
                currentOffset = 0;
                hasMoreReports = true;
                currentFilters = {};

                await loadReports(false); // false = don't reinitialize interactions
                return;
            }

            try {
                // Reset pagination state for new search
                currentOffset = 0;
                hasMoreReports = true;
                currentFilters = { search: trimmedQuery };

                // Remove "no more reports" message if it exists
                const noMoreMsg = document.getElementById('no-more-reports');
                if (noMoreMsg) noMoreMsg.remove();

                // Fetch search results from Cloudflare Worker (start with first page)
                const searchUrl = `${CONFIG.WORKER_URL}/reports?search=${encodeURIComponent(trimmedQuery)}&limit=${CONFIG.REPORTS_LIMIT}&offset=0`;
                const response = await fetch(searchUrl);

                if (!response.ok) {
                    throw new Error(`Search failed: ${response.status} ${response.statusText}`);
                }

                const response_data = await response.json();
                const items = response_data.data || [];

                // Update pagination state
                currentOffset = CONFIG.REPORTS_LIMIT;
                totalReports = response_data.metadata?.total || items.length;
                hasMoreReports = (currentOffset < totalReports);

                if (items.length === 0) {
                    // Clear existing items
                    const clones = listContainer.querySelectorAll('[cms-deliver="item"]:not(:first-child)');
                    clones.forEach(item => item.remove());

                    // Remove any existing messages
                    const existingMsg = listContainer.querySelector('.no-search-results, .search-error');
                    if (existingMsg) existingMsg.remove();

                    // Show no results message
                    const noResultsMsg = document.createElement('div');
                    noResultsMsg.className = 'no-search-results';
                    noResultsMsg.style.cssText = 'padding: 40px 20px; text-align: center; color: #666;';
                    noResultsMsg.innerHTML = `
                        <div style="font-size: 18px; margin-bottom: 10px;">No reports found for "${trimmedQuery}"</div>
                        <div style="font-size: 14px;">Try different search terms</div>
                    `;
                    listContainer.appendChild(noResultsMsg);

                    // Hide template
                    templateItem.style.display = 'none';

                    // No results means no more to load
                    hasMoreReports = false;
                } else {
                    // Populate search results using the helper function (clear mode)
                    await populateReports(items, listContainer, templateItem, false);
                }

                console.log(`[CMS Client] Search complete: ${items.length} results (Total: ${totalReports}, Has more: ${hasMoreReports})`);

            } catch (error) {
                console.error('Search error:', error);

                // Show error message
                const errorMsg = document.createElement('div');
                errorMsg.className = 'search-error';
                errorMsg.style.cssText = 'padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c00; margin: 20px;';
                errorMsg.innerHTML = `
                    <strong>Search error:</strong> ${error.message}<br>
                    <small>Please try again</small>
                `;
                listContainer.appendChild(errorMsg);

                // Remove error after 5 seconds
                setTimeout(() => errorMsg.remove(), 5000);
            }
        }

        // Add input event listener with debouncing
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value;

            // Clear previous timer
            clearTimeout(debounceTimer);

            // Set new timer for debounce (500ms for server-side search)
            debounceTimer = setTimeout(() => {
                performSearch(query);
            }, 500);
        });

        // Handle search on Enter key
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(debounceTimer);
                performSearch(e.target.value);
            }
        });

        // Clear search on ESC key
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
        // Check if we're in Webflow Designer
        if (window.Webflow && window.Webflow.env && window.Webflow.env() === 'design') {
            console.log('[CMS Client] Skipping in Webflow Designer mode');
            return;
        }

        // Check if jQuery is available (Webflow uses it)
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

        // Add manual trigger to window for testing
        window.cmsLoadReports = loadReports;
    }

    // Start initialization
    init();

    // Also expose debug info
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
        // Debug function to find specific report across all pages
        findReport: async function(slug) {
            const searchSlug = slug || 'masked-israeli-settlers-attack-palestinian-village-injuring-residents-and-activists-in-west-bank';
            console.log(`[CMS Debug] Searching for report with slug: ${searchSlug}`);

            let offset = 0;
            const limit = 50; // Fetch more at once for searching
            let found = false;

            while (!found && offset < 100) { // Safety limit
                try {
                    const response = await fetch(`${CONFIG.WORKER_URL}/reports?limit=${limit}&offset=${offset}`);
                    const data = await response.json();
                    const items = data.data || [];

                    const report = items.find(r => r.slug === searchSlug);
                    if (report) {
                        console.log(`[CMS Debug] FOUND report at offset ${offset}:`, report);
                        found = true;
                        return report;
                    }

                    console.log(`[CMS Debug] Not found in batch at offset ${offset}, checked ${items.length} reports`);

                    if (items.length < limit) {
                        console.log(`[CMS Debug] Reached end of reports at offset ${offset}`);
                        break;
                    }

                    offset += limit;
                } catch (error) {
                    console.error('[CMS Debug] Error searching:', error);
                    break;
                }
            }

            if (!found) {
                console.log(`[CMS Debug] Report with slug "${searchSlug}" NOT FOUND in API`);
            }
            return null;
        },
        // Load all remaining reports manually
        loadAllRemaining: async function() {
            console.log(`[CMS Debug] Loading all remaining reports...`);
            console.log(`[CMS Debug] Current: offset=${currentOffset}, total=${totalReports}, hasMore=${hasMoreReports}`);

            let loadCount = 0;
            while (hasMoreReports && !isLoading) {
                await loadMoreReports();
                loadCount++;

                // Wait for loading to complete
                await new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (!isLoading) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                });

                // Safety check to prevent infinite loop
                if (loadCount > 10) {
                    console.warn('[CMS Debug] Safety limit reached, stopping load');
                    break;
                }
            }

            console.log(`[CMS Debug] Finished loading all. Total loaded: ${currentOffset}`);
            return currentOffset;
        },
        // Get current loading state
        getState: function() {
            return {
                currentOffset,
                totalReports,
                hasMoreReports,
                isLoading,
                remaining: totalReports - currentOffset
            };
        },
        // Find report in DOM
        findInDOM: function(slug) {
            const searchSlug = slug || 'masked-israeli-settlers-attack-palestinian-village-injuring-residents-and-activists-in-west-bank';
            console.log(`[CMS Debug] Searching DOM for report with slug: ${searchSlug}`);

            const allReports = document.querySelectorAll('[cms-deliver="item"][data-report-slug]');
            let found = false;

            allReports.forEach((item, index) => {
                const itemSlug = item.getAttribute('data-report-slug');
                if (itemSlug === searchSlug) {
                    console.log(`[CMS Debug] FOUND in DOM at position ${index + 1}`);
                    console.log(`[CMS Debug] Element:`, item);
                    console.log(`[CMS Debug] Title:`, item.querySelector('.text-block-829806-1')?.textContent);
                    console.log(`[CMS Debug] Display style:`, item.style.display);
                    console.log(`[CMS Debug] Visibility:`, window.getComputedStyle(item).visibility);
                    console.log(`[CMS Debug] Is visible:`, item.offsetParent !== null);

                    // Highlight the element temporarily
                    const originalBorder = item.style.border;
                    item.style.border = '3px solid red';
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        item.style.border = originalBorder;
                    }, 3000);

                    found = true;
                }
            });

            if (!found) {
                console.log(`[CMS Debug] Report NOT FOUND in DOM`);
                console.log(`[CMS Debug] Total reports in DOM:`, allReports.length);
            }

            return found;
        }
    };

    console.log('[CMS Client] Mini Reports script loaded. Debug available at window.cmsDebug');

})();
