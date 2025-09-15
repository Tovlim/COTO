<!-- Start seamless-load-more custom code -->

<script>
    $(document).ready(function() {
        // Store loaded items for each container
        var containerData = new Map();

        // Expose containerData globally so search script can access it
        window.containerData = containerData;

        // Initialize each container with seamless-replace="true"
        console.log('seamless-load-more: Found containers:', $('[seamless-replace="true"]').length);
        $('[seamless-replace="true"]').each(function() {
            var $container = $(this);
            var containerIndex = $('[seamless-replace="true"]').index($container);
            console.log('seamless-load-more: Initializing container', containerIndex, $container[0]);

            // Initialize container data
            containerData.set(containerIndex, {
                allItems: [],
                displayedItems: [],
                itemsPerPage: 6, // Default items per page
                currentPage: 1,
                totalPages: 1,
                isLoading: false,
                pagesLoaded: new Set()
            });

            // Load all paginated items for this container
            loadAllPaginatedItems($container, containerIndex);

            // Set up load more functionality
            setupLoadMore($container, containerIndex);
        });

        // Function to load all paginated items
        function loadAllPaginatedItems($container, containerIndex) {
            var data = containerData.get(containerIndex);
            if (data.isLoading) return;

            data.isLoading = true;

            // Store current page items
            var $currentItems = $container.find('.w-dyn-item');
            $currentItems.each(function() {
                var $item = $(this).clone();
                data.allItems.push($item[0]);
            });

            // Mark current page as loaded
            var currentPageUrl = window.location.href;
            data.pagesLoaded.add(currentPageUrl);

            // Find pagination links
            var $paginationWrapper = $container.find('.w-pagination-wrapper');
            var $nextLink = $paginationWrapper.find('.w-pagination-next');

            // If there's a next page, load it
            if ($nextLink.length && $nextLink.attr('href')) {
                loadNextPages($container, containerIndex, $nextLink.attr('href'));
            } else {
                data.isLoading = false;
                updateDisplay($container, containerIndex);
                console.log('All items loaded for container', containerIndex, ':', data.allItems.length, 'items');
            }
        }

        // Recursively load next pages
        function loadNextPages($container, containerIndex, nextUrl) {
            var data = containerData.get(containerIndex);

            // Check if we've already loaded this page
            if (data.pagesLoaded.has(nextUrl)) {
                data.isLoading = false;
                updateDisplay($container, containerIndex);
                return;
            }

            $.ajax({
                url: nextUrl,
                type: 'GET',
                success: function(response) {
                    var $newPage = $(response);
                    var $newContainers = $newPage.find('[seamless-replace="true"]');
                    var $newContainer = $newContainers.eq(containerIndex);

                    if ($newContainer.length > 0) {
                        // Extract items from the loaded page
                        var $newItems = $newContainer.find('.w-dyn-item');
                        $newItems.each(function() {
                            var $item = $(this).clone();
                            data.allItems.push($item[0]);
                        });

                        // Mark this page as loaded
                        data.pagesLoaded.add(nextUrl);

                        // Find next page link
                        var $nextLink = $newContainer.find('.w-pagination-next');
                        if ($nextLink.length && $nextLink.attr('href')) {
                            // Load next page
                            loadNextPages($container, containerIndex, $nextLink.attr('href'));
                        } else {
                            // All pages loaded
                            data.isLoading = false;
                            updateDisplay($container, containerIndex);
                            console.log('All items loaded for container', containerIndex, ':', data.allItems.length, 'items');
                        }
                    } else {
                        data.isLoading = false;
                        updateDisplay($container, containerIndex);
                    }
                },
                error: function() {
                    data.isLoading = false;
                    console.error('Failed to load page:', nextUrl);
                }
            });
        }

        // Set up load more functionality
        function setupLoadMore($container, containerIndex) {
            var data = containerData.get(containerIndex);

            // Find existing pagination elements
            var $paginationWrapper = $container.find('.w-pagination-wrapper');
            var $nextButton = $paginationWrapper.find('.w-pagination-next');

            if ($nextButton.length) {
                // Keep the existing next button but change its text and behavior
                $nextButton.text('Load More');

                // Remove href to prevent navigation
                $nextButton.removeAttr('href');

                // Hide other pagination elements (previous, numbers) but keep the wrapper
                $paginationWrapper.find('.w-pagination-previous, .w-pagination-number').hide();

                // Handle load more button click
                $nextButton.off('click').on('click', function(e) {
                    e.preventDefault();
                    var data = containerData.get(containerIndex);

                    // Calculate how many more items to show
                    var itemsToShow = (data.currentPage + 1) * data.itemsPerPage;
                    data.currentPage += 1;

                    updateDisplay($container, containerIndex);

                    console.log('Loaded more items. Now showing:', Math.min(itemsToShow, data.allItems.length), 'of', data.allItems.length);
                });
            }
        }

        // Update the display of items
        function updateDisplay($container, containerIndex) {
            var data = containerData.get(containerIndex);
            var $itemsContainer = $container.find('.w-dyn-items');

            if ($itemsContainer.length === 0) return;

            // Calculate how many items to show
            var itemsToShow = data.currentPage * data.itemsPerPage;
            var itemsToDisplay = data.allItems.slice(0, itemsToShow);

            // Clear and add items
            $itemsContainer.empty();
            itemsToDisplay.forEach(function(item) {
                $itemsContainer.append($(item).clone());
            });

            // Update load more button visibility
            var $nextButton = $container.find('.w-pagination-next');
            if (itemsToShow >= data.allItems.length) {
                $nextButton.hide();
            } else {
                $nextButton.show();
            }

            // Reinitialize Webflow interactions
            if (typeof Webflow !== 'undefined' && Webflow.require) {
                Webflow.require('ix2').init();
            }

            // Rebuild checkbox filter cache if it exists
            if (window.checkboxFilterScript && typeof window.checkboxFilterScript.recacheElements === 'function') {
                setTimeout(function() {
                    window.checkboxFilterScript.recacheElements();
                }, 100);
            }
        }

        // Handle search - this will work with the existing search script
        // The search script will now have access to all loaded items via the recached elements
    });
</script>

<!-- End seamless-load-more custom code -->

<!--
Usage Instructions:

1. Replace the seamless-pagination.html script with this seamless-load-more.html script
2. Add seamless-replace="true" attribute to each CMS collection list wrapper
3. The script will automatically:
   - Load all paginated items in the background
   - Replace pagination controls with a "Load More" button
   - Show 6 items initially, then load more when button is clicked
   - Work with your existing search functionality

The search will work across ALL loaded items (not just visible ones)
since the checkbox filter script will have access to all items through recaching.
-->
