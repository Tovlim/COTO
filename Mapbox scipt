<script>
// Initialize Mapbox
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
if (['ar', 'he'].includes(lang)) mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmbus40jb016n01s5dui12tre",
  center: [34.8, 31.2],
  zoom: 6.2,
  language: ['en','es','fr','de','zh','ja','ru','ar','he'].includes(lang) ? lang : 'en'
});

map.addControl(new mapboxgl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserHeading: true}));

// Global state
let locationData = {type: "FeatureCollection", features: []};
let allMarkers = [], clusterMarkers = [], overlapTimer, filterTimer;
let isInitialLoad = true, mapInitialized = false;
window.isLinkClick = false;

let forceFilteredReframe = false, isRefreshButtonAction = false;
const OVERLAP_THRESHOLD = 60, TRANSITION = "200ms";

// Utility functions
const $ = sel => { try { return [...document.querySelectorAll(sel)]; } catch(e) { return []; }};
const $1 = sel => { try { return document.querySelector(sel); } catch(e) { return null; }};
const $id = id => document.getElementById(id);

const toggleSidebar = (side, show = null) => {
  const sidebar = $id(`${side}Sidebar`);
  if (!sidebar) return;
  
  const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
  sidebar.classList.toggle('is-show', isShowing);
  Object.assign(sidebar.style, {
    [`margin${side}`]: isShowing ? '0' : '',
    zIndex: isShowing ? (parseInt(getComputedStyle(sidebar).zIndex) || 1000) + 1 : '',
    pointerEvents: isShowing ? 'auto' : ''
  });
  
  if (isShowing && window.innerWidth <= 478) toggleSidebar(side === 'Left' ? 'Right' : 'Left', false);
};

const toggleShowWhenFilteredElements = show => {
  const elements = $('[show-when-filtered="true"]');
  elements.forEach(element => {
    Object.assign(element.style, {
      display: show ? 'block' : 'none',
      visibility: show ? 'visible' : 'hidden',
      opacity: show ? '1' : '0',
      pointerEvents: show ? 'auto' : 'none'
    });
  });
  console.log(`Updated ${elements.length} elements with show-when-filtered="true" to ${show ? 'visible' : 'hidden'}`);
};

const triggerEvent = (el, events) => events.forEach(e => el.dispatchEvent(new Event(e, {bubbles: true})));

// Get location data
function getLocationData() {
  locationData.features = [];
  const [names, lats, lngs, slugs] = [
    $('.data-places-names, .data-place-name'),
    $('.data-places-latitudes, .data-place-latitude'),
    $('.data-places-longitudes, .data-place-longitude'),
    $('.data-places-slugs, .data-place-slug, .data-slug')
  ];
  
  if (!names.length) return;
  
  for (let i = 0; i < Math.min(names.length, lats.length, lngs.length); i++) {
    const [lat, lng] = [parseFloat(lats[i].textContent), parseFloat(lngs[i].textContent)];
    if (isNaN(lat) || isNaN(lng)) continue;
    
    locationData.features.push({
      type: "Feature",
      geometry: {type: "Point", coordinates: [lng, lat]},
      properties: {
        name: names[i].textContent.trim(),
        id: `location-${i}`,
        popupIndex: i,
        slug: slugs[i]?.textContent.trim() || '',
        index: i
      }
    });
  }
}

// Create markers
function addCustomMarkers() {
  if (!locationData.features.length) return;
  
  const popups = $('.OnMapPlaceLinks, #MapPopUp, [id^="MapPopUp"]');
  const used = [];
  
  [...allMarkers, ...clusterMarkers].forEach(m => m.marker.remove());
  allMarkers = [];
  clusterMarkers = [];
  
  locationData.features.forEach((feature, i) => {
    const {coordinates} = feature.geometry;
    const {name, popupIndex, slug, index} = feature.properties;
    
    let popup = popups[popupIndex];
    if (popup && used.includes(popup)) popup = popups.find(p => !used.includes(p));
    
    const el = document.createElement('div');
    let marker;
    
    if (popup) {
      used.push(popup);
      el.className = 'custom-marker';
      const clone = popup.cloneNode(true);
      clone.style.cssText = `display: block; transition: opacity ${TRANSITION} ease;`;
      el.appendChild(clone);
    } else {
      el.className = 'text-marker';
      el.textContent = name;
      el.style.cssText = `color: #fff; background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 4px; font-weight: normal; white-space: nowrap; transition: opacity ${TRANSITION} ease;`;
    }
    
    Object.assign(el.dataset, {name, markerslug: slug, markerindex: index});
    marker = new mapboxgl.Marker({element: el, anchor: 'bottom'}).setLngLat(coordinates).addTo(map);
    allMarkers.push({marker, name, slug, index, coordinates});
  });
  
  setupMarkerClicks();
  checkOverlap();
}

// Setup marker clicks
function setupMarkerClicks() {
  allMarkers.forEach(info => {
    const el = info.marker.getElement();
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);
    
    newEl.onclick = e => {
      e.stopPropagation();
      e.preventDefault();
      
      const link = newEl.querySelector('[districtname]');
      if (!link) return;
      
      const locality = link.getAttribute('districtname');
      if (!locality) return;
      
      window.isMarkerClick = true;
      
      const search = $id('hiddensearch');
      if (search) {
        search.value = locality;
        triggerEvent(search, ['input', 'change', 'keyup']);
        
        const form = search.closest('form');
        if (form) form.dispatchEvent(new Event('input', {bubbles: true}));
        
        setTimeout(() => {
          if (window.fsAttributes?.cmsfilter) window.fsAttributes.cmsfilter.reload();
          ['fs-cmsfilter-change', 'fs-cmsfilter-search'].forEach(type => 
            document.dispatchEvent(new CustomEvent(type, {bubbles: true, detail: {value: locality}}))
          );
        }, 100);
      }
      
      toggleShowWhenFilteredElements(true);
      toggleSidebar('Left', true);
      
      setTimeout(() => window.isMarkerClick = false, 1000);
    };
    
    info.marker._element = newEl;
  });
}

// Clustering
function getOrCreateCluster(center, count, coords) {
  const existing = clusterMarkers.find(c => {
    const dist = Math.sqrt((c.point.x - center.x) ** 2 + (c.point.y - center.y) ** 2);
    return dist < OVERLAP_THRESHOLD / 2;
  });
  
  if (existing) {
    existing.count += count;
    const num = existing.element.querySelector('#PlaceNum') || existing.element.querySelector('div');
    if (num) num.textContent = existing.count;
    return existing;
  }
  
  let wrap = $id('PlaceNumWrap')?.cloneNode(true);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.style.cssText = 'background: rgba(0,0,0,0.7); color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;';
    const num = document.createElement('div');
    num.id = 'PlaceNum';
    num.textContent = count;
    wrap.appendChild(num);
  }
  
  const num = wrap.querySelector('#PlaceNum') || wrap.querySelector('div');
  if (num) num.textContent = count;
  
  wrap.classList.add('cluster-marker');
  const marker = new mapboxgl.Marker({element: wrap, anchor: 'center'}).setLngLat(coords).addTo(map);
  
  const cluster = {marker, element: wrap, count, point: center, coordinates: coords};
  clusterMarkers.push(cluster);
  return cluster;
}

function checkOverlap() {
  if (isRefreshButtonAction && map.isMoving()) return;
  if (allMarkers.length <= 1) return;
  
  clusterMarkers.forEach(c => c.marker.remove());
  clusterMarkers = [];
  
  const positions = allMarkers.map(info => ({
    ...info,
    point: map.project(info.marker.getLngLat()),
    element: info.marker.getElement(),
    visible: true,
    clustered: false
  }));
  
  const clusters = [];
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].clustered || positions[i].element.classList.contains('filtered-out')) continue;
    
    const cluster = {markers: [i], center: positions[i].point, coordinates: positions[i].coordinates};
    
    for (let j = 0; j < positions.length; j++) {
      if (i === j || positions[j].clustered || positions[j].element.classList.contains('filtered-out')) continue;
      
      const dist = Math.sqrt((positions[i].point.x - positions[j].point.x) ** 2 + (positions[i].point.y - positions[j].point.y) ** 2);
      if (dist < OVERLAP_THRESHOLD) cluster.markers.push(j);
    }
    
    if (cluster.markers.length > 1) {
      cluster.markers.forEach(idx => {
        positions[idx].clustered = true;
        positions[idx].visible = false;
      });
      
      const sumX = cluster.markers.reduce((sum, idx) => sum + positions[idx].point.x, 0);
      const sumY = cluster.markers.reduce((sum, idx) => sum + positions[idx].point.y, 0);
      cluster.center = {x: sumX / cluster.markers.length, y: sumY / cluster.markers.length};
      cluster.coordinates = map.unproject(cluster.center);
      clusters.push(cluster);
    }
  }
  
  clusters.forEach(c => getOrCreateCluster(c.center, c.markers.length, c.coordinates));
  positions.forEach(info => info.element.classList.toggle('marker-faded', !info.visible || info.clustered));
}

// Filtering functions
function checkFilterInstanceFiltering() {
  // Check FinSweet API
  if (window.fsAttributes?.cmsfilter) {
    const filterInstance = window.fsAttributes.cmsfilter.getByInstance('Filter');
    if (filterInstance) {
      const activeFilters = filterInstance.filtersData;
      if (activeFilters && Object.keys(activeFilters).length > 0) return true;
      
      const renderedItems = filterInstance.listInstance.items.filter(item => !item.element.style.display || item.element.style.display !== 'none');
      const totalItems = filterInstance.listInstance.items;
      if (renderedItems.length > 0 && renderedItems.length < totalItems.length) return true;
    }
  }
  
  // Check DOM visibility
  const filterList = $('[fs-list-instance="Filter"]')[0];
  if (filterList) {
    const allItems = filterList.querySelectorAll('[fs-cmsfilter-element="list-item"]');
    const visibleItems = filterList.querySelectorAll('[fs-cmsfilter-element="list-item"]:not([style*="display: none"])');
    if (allItems.length > 0 && visibleItems.length > 0 && visibleItems.length < allItems.length) return true;
  }
  
  // Check active form inputs
  const filterContainer = $('[fs-list-instance="Filter"]')[0];
  if (filterContainer) {
    const inputs = filterContainer.querySelectorAll('input, select');
    const activeInputs = Array.from(inputs).filter(input => {
      if (input.type === 'checkbox' || input.type === 'radio') return input.checked;
      return input.value && input.value.trim() !== '';
    });
    if (activeInputs.length > 0) return true;
  }
  
  return false;
}

function checkMapMarkersFiltering() {
  // Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const hasMapMarkersURLFilter = Array.from(urlParams.keys()).some(key => 
    key.startsWith('mapmarkers_') || key.includes('mapmarkers') || key === 'district' || key === 'locality'
  );
  if (hasMapMarkersURLFilter) return true;
  
  // Check FinSweet API
  if (window.fsAttributes?.cmsfilter) {
    const mapMarkersInstance = window.fsAttributes.cmsfilter.getByInstance('mapmarkers');
    if (mapMarkersInstance) {
      const activeFilters = mapMarkersInstance.filtersData;
      if (activeFilters && Object.keys(activeFilters).length > 0) return true;
      
      const renderedItems = mapMarkersInstance.listInstance.items.filter(item => !item.element.style.display || item.element.style.display !== 'none');
      const totalItems = mapMarkersInstance.listInstance.items;
      if (renderedItems.length > 0 && renderedItems.length < totalItems.length) return true;
    }
  }
  
  // Check filtered coordinate elements
  const filteredLat = $('.data-places-latitudes-filter');
  const filteredLon = $('.data-places-longitudes-filter');
  const allLat = $('.data-places-latitudes, .data-place-latitude');
  const allLon = $('.data-places-longitudes, .data-place-longitude');
  
  if (filteredLat.length > 0 && filteredLat.length < allLat.length) return true;
  
  // Check DOM visibility
  const mapMarkersList = $('[fs-list-instance="mapmarkers"]')[0];
  if (mapMarkersList) {
    const allItems = mapMarkersList.querySelectorAll('[fs-cmsfilter-element="list-item"]');
    const visibleItems = mapMarkersList.querySelectorAll('[fs-cmsfilter-element="list-item"]:not([style*="display: none"])');
    if (allItems.length > 0 && visibleItems.length > 0 && visibleItems.length < allItems.length) return true;
  }
  
  return false;
}

// Apply filter to markers (reframing functionality)
function applyFilterToMarkers() {
  if (isInitialLoad && !checkMapMarkersFiltering()) return;
  
  let visibleCoordinates = [];
  
  const filteredLat = $('.data-places-latitudes-filter');
  const filteredLon = $('.data-places-longitudes-filter');
  const allLat = $('.data-places-latitudes, .data-place-latitude');
  
  if (filteredLat.length && filteredLon.length && filteredLat.length < allLat.length) {
    visibleCoordinates = filteredLat.map((el, i) => {
      const lat = parseFloat(el.textContent.trim());
      const lon = parseFloat(filteredLon[i]?.textContent.trim());
      return !isNaN(lat) && !isNaN(lon) ? [lon, lat] : null;
    }).filter(coord => coord);
  }
  
  if (visibleCoordinates.length > 0) {
    const currentZoom = map.getZoom();
    const bounds = new mapboxgl.LngLatBounds();
    
    visibleCoordinates.forEach(coord => bounds.extend(coord));
    
    const newZoom = map.cameraForBounds(bounds, {
      padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15},
      maxZoom: 13
    }).zoom;
    
    if (newZoom > currentZoom + 1) {
      clusterMarkers.forEach(c => c.marker.remove());
      clusterMarkers = [];
      allMarkers.forEach(info => info.marker.getElement().classList.remove('marker-faded'));
    }
    
    const animationDuration = isInitialLoad ? 600 : 800;
    
    map.fitBounds(bounds, {
      padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15},
      maxZoom: 13,
      duration: animationDuration
    });
    
    setTimeout(() => checkOverlap(), animationDuration + 50);
  } else {
    const hasFiltering = checkMapMarkersFiltering();
    if (!isInitialLoad || !hasFiltering) {
      clusterMarkers.forEach(c => c.marker.remove());
      clusterMarkers = [];
      allMarkers.forEach(info => info.marker.getElement().classList.remove('marker-faded'));
      
      const animationDuration = isInitialLoad ? 600 : 800;
      
      map.flyTo({center: [34.8, 31.2], zoom: 6.2, duration: animationDuration});
      setTimeout(() => checkOverlap(), animationDuration + 50);
    }
  }
}

function handleFilterUpdate() {
  if (window.isLinkClick || window.isMarkerClick || window.isHiddenSearchActive) return;
  
  isRefreshButtonAction = true;
  clearTimeout(filterTimer);
  
  filterTimer = setTimeout(() => {
    applyFilterToMarkers();
    filterTimer = null;
    setTimeout(() => isRefreshButtonAction = false, 1000);
  }, 300);
}

// Setup controls
function setupControls() {
  // AllEvents button - just click #ClearAll
  const allEventsBtn = $id('AllEvents') || $1('#AllEvents, [id="AllEvents"]');
  if (allEventsBtn) {
    const newBtn = allEventsBtn.cloneNode(true);
    allEventsBtn.parentNode.replaceChild(newBtn, allEventsBtn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const clearAllBtn = $id('ClearAll');
      if (clearAllBtn) {
        clearAllBtn.click();
      }
    });
  }
  
  // ToggleLeft button - toggle left sidebar
  const toggleLeftBtn = $id('ToggleLeft');
  if (toggleLeftBtn) {
    const newBtn = toggleLeftBtn.cloneNode(true);
    toggleLeftBtn.parentNode.replaceChild(newBtn, toggleLeftBtn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const leftSidebar = $id('LeftSidebar');
      if (leftSidebar) {
        const isCurrentlyShowing = leftSidebar.classList.contains('is-show');
        toggleSidebar('Left', !isCurrentlyShowing);
      }
    });
  }
  
  // Elements with open-right-sidebar="true" - toggle right sidebar
  $('[open-right-sidebar="true"]').forEach(element => {
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);
    
    newElement.addEventListener('click', (e) => {
      // Don't prevent default or stop propagation to allow other scripts to work
      
      const rightSidebar = $id('RightSidebar');
      if (rightSidebar) {
        const isCurrentlyShowing = rightSidebar.classList.contains('is-show');
        toggleSidebar('Right', !isCurrentlyShowing);
      }
      
      // If element also has open-tab attribute, trigger that functionality
      const groupName = newElement.getAttribute('open-tab');
      if (groupName) {
        console.log('Element has both attributes, triggering tab:', groupName);
        
        // Small delay to ensure sidebar toggle happens first
        setTimeout(() => {
          const targetTab = document.querySelector(`[opened-tab="${groupName}"]`);
          if (targetTab) {
            targetTab.click();
          } else {
            console.warn(`No tab found with opened-tab="${groupName}"`);
          }
        }, 50);
      }
    });
  });
  
  // OpenLeftSidebar elements
  [...$('.OpenLeftSidebar'), ...$('[OpenLeftSidebar]'), ...$('[openleftsidebar]')].forEach(element => {
    if (element?.parentNode) {
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);
      
      if (newElement.type === 'radio' || newElement.type === 'checkbox') {
        newElement.addEventListener('change', () => {
          if (newElement.checked) toggleSidebar('Left', true);
        });
      } else {
        newElement.addEventListener('click', e => {
          e.stopPropagation();
          toggleSidebar('Left', true);
        });
      }
    }
  });
}

// Setup sidebar resizing
function setupSidebarResizing() {
  // Add resize handles to sidebars
  const addResizeHandle = (sidebar, side) => {
    if (!sidebar || sidebar.querySelector('.sidebar-resize-handle')) return;
    
    const handle = document.createElement('div');
    handle.className = `sidebar-resize-handle ${side}-resize-handle`;
    sidebar.appendChild(handle);
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let minWidth = 500; // Increased minimum width
    
    const getMaxWidth = () => {
      const oppositeSide = side === 'left' ? 'right' : 'left';
      const oppositeSidebar = $id(`${oppositeSide.charAt(0).toUpperCase() + oppositeSide.slice(1)}Sidebar`);
      
      if (oppositeSidebar && oppositeSidebar.classList.contains('is-show')) {
        // If opposite sidebar is open, limit to leave space for it
        const oppositeWidth = parseInt(getComputedStyle(oppositeSidebar).width) || 300;
        return window.innerWidth - oppositeWidth - 100; // 100px buffer
      } else {
        // If opposite sidebar is closed, can use most of screen width
        return window.innerWidth - 100; // 100px buffer from edge
      }
    };
    
    const startResize = (e) => {
      if (window.innerWidth <= 478) return; // Disable on mobile
      
      isResizing = true;
      startX = e.clientX || e.touches?.[0]?.clientX;
      startWidth = parseInt(getComputedStyle(sidebar).width);
      
      handle.classList.add('resizing');
      document.body.classList.add('sidebar-resizing');
      document.body.style.cursor = 'col-resize';
      
      e.preventDefault();
    };
    
    const updateSidebarMargins = (newWidth) => {
      // Update the hidden state margin to match the sidebar width
      if (side === 'left') {
        // For left sidebar, update left margin when hidden
        if (!sidebar.classList.contains('is-show')) {
          sidebar.style.marginLeft = `-${newWidth}px`;
        }
      } else {
        // For right sidebar, update right margin when hidden
        if (!sidebar.classList.contains('is-show')) {
          sidebar.style.marginRight = `-${newWidth}px`;
        }
      }
    };
    
    const doResize = (e) => {
      if (!isResizing) return;
      
      const currentX = e.clientX || e.touches?.[0]?.clientX;
      let newWidth;
      
      if (side === 'left') {
        newWidth = startWidth + (currentX - startX);
      } else {
        newWidth = startWidth - (currentX - startX);
      }
      
      // Apply constraints based on opposite sidebar
      const maxWidth = getMaxWidth();
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      
      // Update sidebar width
      sidebar.style.width = newWidth + 'px';
      sidebar.style.minWidth = newWidth + 'px';
      sidebar.style.maxWidth = newWidth + 'px';
      
      // Update margins for hidden state in real-time
      updateSidebarMargins(newWidth);
      
      e.preventDefault();
    };
    
    const stopResize = () => {
      if (!isResizing) return;
      
      isResizing = false;
      handle.classList.remove('resizing');
      document.body.classList.remove('sidebar-resizing');
      document.body.style.cursor = '';
    };
    
    // Mouse events
    handle.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    
    // Touch events for mobile
    handle.addEventListener('touchstart', startResize, { passive: false });
    document.addEventListener('touchmove', doResize, { passive: false });
    document.addEventListener('touchend', stopResize);
    
    // Update constraints when window resizes or opposite sidebar toggles
    const updateConstraints = () => {
      const currentWidth = parseInt(getComputedStyle(sidebar).width);
      const maxWidth = getMaxWidth();
      if (currentWidth > maxWidth) {
        const newWidth = maxWidth;
        sidebar.style.width = newWidth + 'px';
        sidebar.style.minWidth = newWidth + 'px';
        sidebar.style.maxWidth = newWidth + 'px';
        updateSidebarMargins(newWidth);
      }
    };
    
    // Initialize margins on setup - set initial hidden state
    const initialWidth = parseInt(getComputedStyle(sidebar).width) || 300;
    if (!sidebar.classList.contains('is-show')) {
      if (side === 'left') {
        sidebar.style.marginLeft = `-${initialWidth}px`;
      } else {
        sidebar.style.marginRight = `-${initialWidth}px`;
      }
    }
    
    window.addEventListener('resize', updateConstraints);
    
    // Listen for opposite sidebar toggle events
    const oppositeSide = side === 'left' ? 'right' : 'left';
    const oppositeSidebar = $id(`${oppositeSide.charAt(0).toUpperCase() + oppositeSide.slice(1)}Sidebar`);
    if (oppositeSidebar) {
      const observer = new MutationObserver(() => {
        setTimeout(updateConstraints, 100); // Small delay to let toggle animation complete
      });
      observer.observe(oppositeSidebar, { attributes: true, attributeFilter: ['class'] });
    }
  };
  
  // Add handles to both sidebars
  const leftSidebar = $id('LeftSidebar');
  const rightSidebar = $id('RightSidebar');
  
  if (leftSidebar) addResizeHandle(leftSidebar, 'left');
  if (rightSidebar) addResizeHandle(rightSidebar, 'right');
}
// Setup sidebars
function setupSidebars() {
  let zIndex = 1000;
  
  const setup = () => {
    ['Right', 'Left'].forEach(side => {
      const sidebar = $id(`${side}Sidebar`);
      const tab = $id(`${side}SideTab`);
      const close = $id(`${side}SidebarClose`);
      
      if (!sidebar || !tab || !close) return;
      
      // Improved smooth but snappy animation
      sidebar.style.cssText += `transition: margin-${side.toLowerCase()} 0.25s cubic-bezier(0.4, 0, 0.2, 1); z-index: ${zIndex}; position: relative;`;
      tab.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      
      const newTab = tab.cloneNode(true);
      const newClose = close.cloneNode(true);
      tab.parentNode.replaceChild(newTab, tab);
      close.parentNode.replaceChild(newClose, close);
      
      const bringToFront = () => {
        const newZ = ++zIndex;
        sidebar.style.zIndex = newZ;
        const currentTab = $id(`${side}SideTab`);
        if (currentTab && window.innerWidth <= 478) {
          currentTab.style.zIndex = newZ + 10;
          if (currentTab.parentElement) currentTab.parentElement.style.zIndex = newZ + 10;
        }
        
        const oppositeSide = side === 'Left' ? 'Right' : 'Left';
        const oppositeSidebar = $id(`${oppositeSide}Sidebar`);
        const oppositeTab = $id(`${oppositeSide}SideTab`);
        
        if (oppositeSidebar) oppositeSidebar.style.zIndex = newZ - 1;
        if (oppositeTab && window.innerWidth <= 478) {
          oppositeTab.style.zIndex = newZ + 5;
          if (oppositeTab.parentElement) oppositeTab.parentElement.style.zIndex = newZ + 5;
        }
      };

      const toggle = show => {
        if (show) bringToFront();
        sidebar.classList.toggle('is-show', show);
        
        // Rotate arrow icons based on sidebar state
        const arrowIcon = $1(`[arrow-icon="${side.toLowerCase()}"]`);
        if (arrowIcon) {
          arrowIcon.style.transform = show ? 'rotateY(180deg)' : 'rotateY(0deg)';
        }
        
        // Only apply custom margin logic on screens >478px
        if (window.innerWidth > 478) {
          // Get current width for margin calculation
          const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
          
          // Apply appropriate margin based on show state
          if (show) {
            // When showing, set margin to 0
            if (side === 'Left') {
              sidebar.style.marginLeft = '0';
            } else {
              sidebar.style.marginRight = '0';
            }
          } else {
            // When hiding, set negative margin equal to width + 1px buffer to prevent peeking
            if (side === 'Left') {
              sidebar.style.marginLeft = `-${currentWidth + 1}px`;
            } else {
              sidebar.style.marginRight = `-${currentWidth + 1}px`;
            }
          }
        } else {
          // On mobile (≤478px), use the original simple logic
          sidebar.style[`margin${side}`] = show ? '0' : '';
        }
        
        sidebar.style.pointerEvents = show ? 'auto' : '';
        
        if (show && window.innerWidth <= 478) {
          const oppositeSide = side === 'Left' ? 'Right' : 'Left';
          const oppositeSidebar = $id(`${oppositeSide}Sidebar`);
          if (oppositeSidebar) {
            oppositeSidebar.classList.remove('is-show');
            
            // Rotate opposite arrow icon back to closed position
            const oppositeArrowIcon = $1(`[arrow-icon="${oppositeSide.toLowerCase()}"]`);
            if (oppositeArrowIcon) {
              oppositeArrowIcon.style.transform = 'rotateY(0deg)';
            }
            
            // On mobile, use original simple logic for opposite sidebar too
            oppositeSidebar.style[`margin${oppositeSide}`] = '';
            oppositeSidebar.style.pointerEvents = '';
          }
        }
      };
      
      sidebar.addEventListener('click', () => {
        if (sidebar.classList.contains('is-show')) bringToFront();
      });
      
      newTab.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        toggle(!sidebar.classList.contains('is-show'));
      };
      
      newClose.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        toggle(false);
      };
    });
  };
  
  setup();
  [200, 500, 1000, 2000].forEach(delay => setTimeout(setup, delay));
  
  // Setup initial sidebar margins on screens >478px to prevent peeking
  const setupInitialMargins = () => {
    if (window.innerWidth <= 478) {
      console.log('Skipping initial margin setup - mobile device');
      return;
    }
    
    ['Left', 'Right'].forEach(side => {
      const sidebar = $id(`${side}Sidebar`);
      if (sidebar && !sidebar.classList.contains('is-show')) {
        const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
        if (side === 'Left') {
          sidebar.style.marginLeft = `-${currentWidth + 1}px`;
        } else {
          sidebar.style.marginRight = `-${currentWidth + 1}px`;
        }
        console.log(`Initial margin set for ${side}Sidebar: -${currentWidth + 1}px`);
      }
    });
  };
  
  // Apply initial margins immediately and after delays
  setupInitialMargins();
  setTimeout(setupInitialMargins, 100);
  setTimeout(setupInitialMargins, 300);
  setTimeout(setupInitialMargins, 500);
  
  // Only setup resizing on large screens - check immediately and after delays
  const checkAndSetupResize = () => {
    console.log('Checking screen size for resize setup:', window.innerWidth);
    if (window.innerWidth > 991) {
      console.log('Setting up resize functionality');
      setupSidebarResizing();
    } else {
      console.log('Skipping resize setup - screen too small');
    }
  };
  
  // Check immediately
  checkAndSetupResize();
  
  // Also check after delays to ensure it works
  setTimeout(checkAndSetupResize, 100);
  setTimeout(checkAndSetupResize, 500);
  
  setTimeout(() => {
    setupControls();
  }, 200);
}

// Setup events
function setupEvents() {
  // FinSweet events
  ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed'].forEach(event => {
    document.addEventListener(event, () => {
      handleFilterUpdate();
    });
  });
  
  // Auto-open left sidebar when filtering elements change
  $('[data-auto-sidebar="true"]').forEach(element => {
    const events = ['change', 'input'];
    
    // Add keyup for text inputs to catch typing
    if (['text', 'search', 'email', 'url'].includes(element.type)) {
      events.push('keyup');
    }
    
    events.forEach(eventType => {
      element.addEventListener(eventType, (e) => {
        console.log('Auto-sidebar trigger:', element.type || element.tagName, 'value:', element.value || element.checked);
        
        // Small delay to ensure FinSweet processes the change first
        setTimeout(() => {
          toggleSidebar('Left', true);
        }, 100);
      });
    });
  });
  
  // Refresh button
  const refreshOnEnter = $id('refresh-on-enter');
  if (refreshOnEnter) {
    ['click', 'keypress', 'input'].forEach(eventType => {
      refreshOnEnter.addEventListener(eventType, (e) => {
        if (eventType === 'keypress' && e.key !== 'Enter') return;
        setTimeout(() => handleFilterUpdate(), eventType === 'input' ? 300 : 100);
      });
    });
  }
  
  // Form elements
  $('select, [fs-cmsfilter-element="select"]').forEach(select => {
    select.addEventListener('change', () => {
      setTimeout(() => handleFilterUpdate(), 100);
    });
  });
  
  $('[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select').forEach(input => {
    input.addEventListener('change', () => {
      setTimeout(() => handleFilterUpdate(), 100);
    });
    if (['text', 'search'].includes(input.type)) {
      input.addEventListener('input', () => {
        setTimeout(() => handleFilterUpdate(), 300);
      });
    }
  });
  
  // Hidden search
  const search = $id('hiddensearch');
  if (search) {
    ['input', 'change', 'keyup'].forEach(event => {
      search.addEventListener(event, () => {
        // Set flag to prevent map reframing when hiddensearch is cleared
        window.isHiddenSearchActive = true;
        
        if (search.value.trim()) {
          // Only reframe when there's a value (searching/filtering)
          setTimeout(() => handleFilterUpdate(), 300);
        }
        
        // Reset the flag after processing
        setTimeout(() => {
          window.isHiddenSearchActive = false;
        }, 500);
      });
    });
  }
  
  // Refresh buttons
  [
    $id('refreshDiv'),
    $id('filter-button'),
    ...$('.filterrefresh')
  ].forEach(button => {
    if (button) {
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      newButton.addEventListener('click', (e) => {
        e.preventDefault();
        forceFilteredReframe = true;
        isRefreshButtonAction = true;
        
        applyFilterToMarkers();
        
        setTimeout(() => {
          forceFilteredReframe = false;
          isRefreshButtonAction = false;
        }, 1000);
      });
    }
  });
  
  // Firefox form handling
  if (navigator.userAgent.toLowerCase().includes('firefox')) {
    $('form').forEach(form => {
      const hasFilterElements = form.querySelector('[fs-cmsfilter-element]') !== null;
      const isNearMap = $id('map') && 
                        (form.contains($id('map')) || 
                         $id('map').contains(form) ||
                         form.parentElement === $id('map').parentElement);
      
      if (hasFilterElements || isNearMap) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          forceFilteredReframe = true;
          isRefreshButtonAction = true;
          
          setTimeout(() => {
            applyFilterToMarkers();
            setTimeout(() => {
              forceFilteredReframe = false;
              isRefreshButtonAction = false;
            }, 1000);
          }, 100);
          
          return false;
        }, true);
      }
    });
  }
  
  // Select field 5
  const selectField5 = $id('select-field-5');
  if (selectField5) {
    selectField5.addEventListener('change', () => {
      setTimeout(() => handleFilterUpdate(), 100);
    });
  }
  
  // Cluster clicks
  document.onclick = e => {
    let target = e.target;
    while (target && !target.classList?.contains('cluster-marker')) target = target.parentElement;
    
    if (target) {
      const cluster = clusterMarkers.find(c => c.element === target);
      if (cluster) map.flyTo({center: cluster.coordinates, zoom: map.getZoom() + 2.5, duration: 800});
    }
  };
  
  // Link clicks
  $('a:not(.filterrefresh):not([fs-cmsfilter-element])').forEach(link => {
    link.onclick = () => {
      if (!link.closest('[fs-cmsfilter-element]') && !link.classList.contains('w-pagination-next') && !link.classList.contains('w-pagination-previous')) {
        window.isLinkClick = true;
        setTimeout(() => window.isLinkClick = false, 500);
      }
    };
  });
}

// Setup dropdown listeners
function setupDropdownListeners() {
  if (window.dropdownListenersSetup) return;
  window.dropdownListenersSetup = true;
  
  $('[districtselect]').forEach(element => {
    element.addEventListener('click', (e) => {
      if (window.isMarkerClick) return;
      
      forceFilteredReframe = true;
      isRefreshButtonAction = true;
      
      setTimeout(() => {
        applyFilterToMarkers();
        setTimeout(() => {
          forceFilteredReframe = false;
          isRefreshButtonAction = false;
        }, 1000);
      }, 300);
    });
  });
  
  const selectField5 = $id('select-field-5');
  if (selectField5) {
    selectField5.addEventListener('change', (e) => {
      if (window.isMarkerClick) return;
      
      forceFilteredReframe = true;
      isRefreshButtonAction = true;
      
      setTimeout(() => {
        applyFilterToMarkers();
        setTimeout(() => {
          forceFilteredReframe = false;
          isRefreshButtonAction = false;
        }, 1000);
      }, 200);
    });
  }
}

// Monitor tags and show/hide elements with show-when-filtered="true"
function monitorTags() {
  const checkAndUpdateElements = () => {
    const hiddenTagParent = $id('hiddentagparent');
    const hasActiveTags = hiddenTagParent !== null;
    
    console.log(`Tag monitoring: #hiddentagparent ${hasActiveTags ? 'exists' : 'not found'} - Elements with show-when-filtered ${hasActiveTags ? 'shown' : 'hidden'}`);
    toggleShowWhenFilteredElements(hasActiveTags);
  };
  
  // Initial check
  checkAndUpdateElements();
  
  // Watch for hiddentagparent changes in the stable parent container
  const tagParent = $id('tagparent');
  if (tagParent) {
    console.log('Setting up tag monitoring on #tagparent for #hiddentagparent changes');
    
    const observer = new MutationObserver((mutations) => {
      let hiddenTagParentChanged = false;
      
      mutations.forEach(mutation => {
        // Check if hiddentagparent was added or removed
        const checkNodes = (nodes) => {
          return Array.from(nodes).some(node => {
            if (node.nodeType === 1) { // Element node
              return node.id === 'hiddentagparent' || (node.querySelector && node.querySelector('#hiddentagparent'));
            }
            return false;
          });
        };
        
        if (checkNodes(mutation.addedNodes) || checkNodes(mutation.removedNodes)) {
          hiddenTagParentChanged = true;
        }
      });
      
      if (hiddenTagParentChanged) {
        console.log('#hiddentagparent changed - updating show-when-filtered elements visibility');
        setTimeout(checkAndUpdateElements, 50); // Small delay to ensure DOM is updated
      }
    });
    
    // Observe child list changes (hiddentagparent being added/removed)
    observer.observe(tagParent, {
      childList: true,
      subtree: true // Watch all descendants in case hiddentagparent is nested
    });
    
    console.log('Tag monitoring active - watching for #hiddentagparent');
  } else {
    console.warn('#tagparent not found - falling back to periodic checks');
    
    // Fallback: periodic check if parent not found
    setInterval(() => {
      checkAndUpdateElements();
    }, 1000);
  }
}

// Initial animation
function performInitialAnimation() {
  if (!isInitialLoad || !mapInitialized) return;
  
  const hasFiltering = checkMapMarkersFiltering();
  
  if (!hasFiltering) {
    map.flyTo({
      center: [35, 31.4],
      zoom: 7,
      duration: 800,
      curve: 1.0,
      easing: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    });
    
    setTimeout(() => checkOverlap(), 850);
  } else {
    setTimeout(() => checkOverlap(), 300);
  }
  
  isInitialLoad = false;
}

// Initialize
function init() {
  getLocationData();
  addCustomMarkers();
  setupEvents();
  
  map.on('moveend', () => clearTimeout(overlapTimer) || (overlapTimer = setTimeout(checkOverlap, 10)));
  map.on('zoomend', () => clearTimeout(overlapTimer) || (overlapTimer = setTimeout(checkOverlap, 10)));
  
  setTimeout(checkOverlap, 300);
  setTimeout(setupMarkerClicks, 1000);
  setTimeout(setupDropdownListeners, 1000);
  setTimeout(setupDropdownListeners, 3000);
  
  mapInitialized = true;
  setTimeout(performInitialAnimation, 500);
}

// Control positioning
setTimeout(() => {
  const ctrl = $1('.mapboxgl-ctrl-top-right');
  if (ctrl) Object.assign(ctrl.style, {top: '4rem', right: '0.5rem', zIndex: '10'});
}, 500);

// Event handlers
console.log('🎬 Setting up map event handlers');

map.on("load", () => {
  console.log('🗺️ Map "load" event fired');
  try {
    console.log('🎯 About to call init() function');
    init();
    console.log('✅ init() function call completed');
  } catch (error) {
    console.error('💥 Error calling init() function:', error);
    console.error('📍 Error stack:', error.stack);
  }
  
  // Also try calling boundaries directly as backup
  try {
    console.log('🌍 Calling boundaries directly as backup');
    loadBoundaries();
  } catch (error) {
    console.error('💥 Error calling boundaries directly:', error);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOMContentLoaded event fired');
  setupSidebars();
});

window.addEventListener('load', () => {
  console.log('🪟 Window "load" event fired');
  setupSidebars();
  setTimeout(() => {
    console.log('⏰ Checking if init should be called from window load');
    if (!allMarkers.length && map.loaded()) {
      console.log('📍 No markers found and map loaded, calling init');
      try {
        init();
      } catch (error) {
        console.error('💥 Error calling init() from window load:', error);
      }
    } else {
      console.log('📍 Markers exist or map not loaded, skipping init');
      console.log('   - allMarkers.length:', allMarkers.length);
      console.log('   - map.loaded():', map.loaded());
    }
  }, 200);
});

// Auto-trigger reframing after script loads
window.addEventListener('load', function() {
  const checkAndReframe = () => {
    if (map.loaded() && !map.isMoving()) {
      const hasMapMarkersFiltering = checkMapMarkersFiltering();
      
      if (hasMapMarkersFiltering) {
        forceFilteredReframe = true;
        isRefreshButtonAction = true;
        
        applyFilterToMarkers();
        
        setTimeout(() => {
          forceFilteredReframe = false;
          isRefreshButtonAction = false;
        }, 1000);
        
        return true;
      }
      return false;
    }
    return false;
  };
  
  if (checkAndReframe()) return;
  
  setTimeout(() => {
    if (!checkAndReframe()) {
      setTimeout(checkAndReframe, 1000);
    }
  }, 500);
});

// Load GeoJSON boundaries
function loadBoundaries() {
  console.log('🌍 loadBoundaries function started');
  
  const boundaries = [
    {
      name: 'Jerusalem',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Jerusalem.geojson',
      sourceId: 'jerusalem-boundary',
      fillId: 'jerusalem-fill',
      borderId: 'jerusalem-border',
      color: '#3388ff'
    },
    {
      name: 'Hebron',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Hebron.geojson',
      sourceId: 'hebron-boundary',
      fillId: 'hebron-fill',
      borderId: 'hebron-border',
      color: '#ff8833'
    },
    {
      name: 'Tulkarm',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Tulkarm.geojson',
      sourceId: 'tulkarm-boundary',
      fillId: 'tulkarm-fill',
      borderId: 'tulkarm-border',
      color: '#33ff88'
    },
    {
      name: 'Tubas',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Tubas.geojson',
      sourceId: 'tubas-boundary',
      fillId: 'tubas-fill',
      borderId: 'tubas-border',
      color: '#ff3388'
    },
    {
      name: 'Salfit',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Salfit.geojson',
      sourceId: 'salfit-boundary',
      fillId: 'salfit-fill',
      borderId: 'salfit-border',
      color: '#8833ff'
    },
    {
      name: 'Ramallah',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Ramallah.geojson',
      sourceId: 'ramallah-boundary',
      fillId: 'ramallah-fill',
      borderId: 'ramallah-border',
      color: '#ffff33'
    },
    {
      name: 'Nablus',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Nablus.geojson',
      sourceId: 'nablus-boundary',
      fillId: 'nablus-fill',
      borderId: 'nablus-border',
      color: '#33ffff'
    },
    {
      name: 'Jericho',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Jericho.geojson',
      sourceId: 'jericho-boundary',
      fillId: 'jericho-fill',
      borderId: 'jericho-border',
      color: '#ff6633'
    },
    {
      name: 'Jenin',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Jenin.geojson',
      sourceId: 'jenin-boundary',
      fillId: 'jenin-fill',
      borderId: 'jenin-border',
      color: '#6633ff'
    },
    {
      name: 'Bethlehem',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Bethlehem.geojson',
      sourceId: 'bethlehem-boundary',
      fillId: 'bethlehem-fill',
      borderId: 'bethlehem-border',
      color: '#33ff66'
    },
    {
      name: 'Qalqilya',
      url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Qalqilya.geojson',
      sourceId: 'qalqilya-boundary',
      fillId: 'qalqilya-fill',
      borderId: 'qalqilya-border',
      color: '#ff3366'
    }
  ];
  
  // Function to calculate the centroid of a polygon
  const calculateCentroid = (coordinates) => {
    let totalLat = 0;
    let totalLng = 0;
    let pointCount = 0;
    
    const processCoords = (coords) => {
      if (Array.isArray(coords) && coords.length > 0) {
        if (typeof coords[0] === 'number') {
          // This is a coordinate pair [lng, lat]
          totalLng += coords[0];
          totalLat += coords[1];
          pointCount++;
        } else {
          // This is an array of coordinates, process recursively
          coords.forEach(coord => processCoords(coord));
        }
      }
    };
    
    processCoords(coordinates);
    
    return pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : [0, 0];
  };
  
  const addBoundaryToMap = (boundary) => {
    console.log(`🎯 Loading ${boundary.name} boundary`);
    console.log(`🔗 URL: ${boundary.url}`);
    
    fetch(boundary.url)
      .then(response => {
        console.log(`📡 ${boundary.name} fetch response:`, response.status, response.statusText);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(geojsonData => {
        console.log(`✅ ${boundary.name} GeoJSON loaded successfully`);
        
        // Check if source already exists and remove it
        if (map.getSource(boundary.sourceId)) {
          console.log(`🧹 Removing existing ${boundary.name} layers`);
          map.removeLayer(boundary.borderId);
          map.removeLayer(boundary.fillId);
          map.removeSource(boundary.sourceId);
        }
        
        console.log(`➕ Adding ${boundary.name} source to map`);
        // Add the source
        map.addSource(boundary.sourceId, {
          type: 'geojson',
          data: geojsonData
        });
        
        console.log(`🎨 Adding ${boundary.name} fill layer`);
        // Add fill layer (semi-transparent)
        map.addLayer({
          id: boundary.fillId,
          type: 'fill',
          source: boundary.sourceId,
          paint: {
            'fill-color': boundary.color,
            'fill-opacity': 0.1
          }
        });
        
        console.log(`🖋️ Adding ${boundary.name} border layer`);
        // Add border layer
        map.addLayer({
          id: boundary.borderId,
          type: 'line',
          source: boundary.sourceId,
          paint: {
            'line-color': boundary.color,
            'line-width': 2,
            'line-opacity': 0.8
          }
        });
        
        // Calculate centroid and add district name marker
        console.log(`📍 Calculating centroid for ${boundary.name}`);
        const firstFeature = geojsonData.features[0];
        const centroid = calculateCentroid(firstFeature.geometry.coordinates);
        console.log(`📍 ${boundary.name} centroid:`, centroid);
        
        // Create district name element
        const districtNameWrap = document.createElement('div');
        districtNameWrap.id = 'district-name-wrap';
        districtNameWrap.className = `district-${boundary.name.toLowerCase()}`;
        districtNameWrap.style.zIndex = '1000'; // Above other markers
        
        const districtName = document.createElement('div');
        districtName.id = 'district-name';
        districtName.textContent = boundary.name;
        
        districtNameWrap.appendChild(districtName);
        
        // Add as marker at centroid
        const districtMarker = new mapboxgl.Marker({
          element: districtNameWrap,
          anchor: 'center'
        })
        .setLngLat(centroid)
        .addTo(map);
        
        console.log(`📝 ${boundary.name} district name added at centroid`);
        
        console.log(`🎉 ${boundary.name} boundary layers added successfully!`);
        
        // Add click handler for boundary to zoom to bounds
        map.on('click', boundary.fillId, (e) => {
          console.log(`👆 ${boundary.name} boundary clicked - zooming to bounds`);
          
          // Calculate bounds of the clicked boundary
          const bounds = new mapboxgl.LngLatBounds();
          
          // Add all coordinates to bounds
          const addCoordsToBounds = (coords) => {
            if (Array.isArray(coords) && coords.length > 0) {
              if (typeof coords[0] === 'number') {
                bounds.extend(coords);
              } else {
                coords.forEach(coord => addCoordsToBounds(coord));
              }
            }
          };
          
          geojsonData.features.forEach(feature => {
            addCoordsToBounds(feature.geometry.coordinates);
          });
          
          // Fit map to bounds with padding
          map.fitBounds(bounds, {
            padding: {
              top: 50,
              bottom: 50,
              left: 50,
              right: 50
            },
            duration: 1000 // 1 second smooth animation
          });
        });
        
        // Change cursor on hover
        map.on('mouseenter', boundary.fillId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', boundary.fillId, () => {
          map.getCanvas().style.cursor = '';
        });
        
      })
      .catch(error => {
        console.error(`❌ Error loading ${boundary.name} boundary:`, error);
        console.warn(`⚠️ ${boundary.name} boundary will not be displayed`);
      });
  };
  
  // Load all boundaries
  console.log(`🔍 Checking if map is loaded: ${map.loaded()}`);
  if (map.loaded()) {
    console.log('✅ Map already loaded, adding boundaries immediately');
    boundaries.forEach(boundary => addBoundaryToMap(boundary));
  } else {
    console.log('⏳ Map not loaded yet, waiting for load event');
    map.on('load', () => {
      console.log('🎯 Map load event fired, now adding boundaries');
      boundaries.forEach(boundary => addBoundaryToMap(boundary));
    });
  }
  
  console.log('🏁 loadBoundaries function completed');
}

// Start monitoring
setTimeout(() => monitorTags(), 1000);
</script>
