// Initialize Mapbox
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
if (['ar', 'he'].includes(lang)) mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");

// Detect mobile for better map experience
const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmbus40jb016n01s5dui12tre",
  center: [35.22, 31.85],
  zoom: isMobile ? 7.5 : 8.33, // Less zoomed in on mobile
  language: ['en','es','fr','de','zh','ja','ru','ar','he'].includes(lang) ? lang : 'en'
});

map.addControl(new mapboxgl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserHeading: true}));

// Global state
let locationData = {type: "FeatureCollection", features: []};
let allMarkers = [], clusterMarkers = [], districtMarkers = [], overlapTimer, filterTimer;
let isInitialLoad = true, mapInitialized = false, forceFilteredReframe = false, isRefreshButtonAction = false;
window.isLinkClick = false;
const OVERLAP_THRESHOLD = 60, TRANSITION = "200ms";

// Utilities
const $ = sel => { try { return [...document.querySelectorAll(sel)]; } catch(e) { return []; }};
const $1 = sel => { try { return document.querySelector(sel); } catch(e) { return null; }};
const $id = id => document.getElementById(id);
const triggerEvent = (el, events) => events.forEach(e => el.dispatchEvent(new Event(e, {bubbles: true})));
const setStyles = (el, styles) => Object.assign(el.style, styles);
const debounce = (fn, delay) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };

// Toggle sidebar with improved logic
const toggleSidebar = (side, show = null) => {
  const sidebar = $id(`${side}Sidebar`);
  if (!sidebar) return;
  
  const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
  sidebar.classList.toggle('is-show', isShowing);
  
  const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
  const marginProp = `margin${side}`;
  
  if (window.innerWidth > 478) {
    sidebar.style[marginProp] = isShowing ? '0' : `-${currentWidth + 1}px`;
  } else {
    sidebar.style[marginProp] = isShowing ? '0' : '';
    if (isShowing) toggleSidebar(side === 'Left' ? 'Right' : 'Left', false);
  }
  
  setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
  const arrowIcon = $1(`[arrow-icon="${side.toLowerCase()}"]`);
  if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
};

// Toggle filtered elements
const toggleShowWhenFilteredElements = show => {
  $('[show-when-filtered="true"]').forEach(element => {
    setStyles(element, {
      display: show ? 'block' : 'none',
      visibility: show ? 'visible' : 'hidden',
      opacity: show ? '1' : '0',
      pointerEvents: show ? 'auto' : 'none'
    });
  });
};

// Handle zoom-based visibility with debouncing
const handleZoomBasedVisibility = debounce(() => {
  const currentZoom = map.getZoom();
  const shouldShowDistrictNames = currentZoom > 6;
  
  if (!districtMarkers.length) return;
  
  districtMarkers.forEach(districtMarker => {
    const element = districtMarker.element;
    
    if (shouldShowDistrictNames) {
      if (element.dataset.fadeOutId) delete element.dataset.fadeOutId;
      
      const isHidden = element.style.display === 'none' || element.style.opacity === '0' || !element.style.opacity;
      if (isHidden) {
        setStyles(element, {display: 'block', visibility: 'visible', transition: 'opacity 300ms ease', opacity: '0', pointerEvents: 'none'});
        element.offsetHeight;
        setStyles(element, {opacity: '1', pointerEvents: 'auto'});
      } else {
        setStyles(element, {display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto'});
      }
    } else {
      setStyles(element, {transition: 'opacity 300ms ease', opacity: '0', pointerEvents: 'none'});
      const fadeOutId = Date.now() + Math.random();
      element.dataset.fadeOutId = fadeOutId;
      
      setTimeout(() => {
        if (element.dataset.fadeOutId === fadeOutId.toString() && element.style.opacity === '0') {
          setStyles(element, {visibility: 'hidden', display: 'none'});
          delete element.dataset.fadeOutId;
        }
      }, 300);
    }
  });
}, 50);

// Get location data from DOM
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
      properties: {name: names[i].textContent.trim(), id: `location-${i}`, popupIndex: i, slug: slugs[i]?.textContent.trim() || '', index: i}
    });
  }
}

// Create markers with simplified logic
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
    
    const currentZoom = map.getZoom();
    const shouldShow = currentZoom >= 9 && !isInitialLoad;
    setStyles(el, {
      opacity: shouldShow ? '1' : '0',
      visibility: shouldShow ? 'visible' : 'hidden',
      display: shouldShow ? 'block' : 'none',
      pointerEvents: shouldShow ? 'auto' : 'none',
      transition: `opacity ${TRANSITION} ease`
    });
    
    Object.assign(el.dataset, {name, markerslug: slug, markerindex: index});
    const marker = new mapboxgl.Marker({element: el, anchor: 'bottom'}).setLngLat(coordinates).addTo(map);
    allMarkers.push({marker, name, slug, index, coordinates});
  });
  
  setupMarkerClicks();
  setTimeout(checkOverlap, 100);
}

// Setup marker clicks with consolidated handler
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
      if (locality) {
        handleSearchTrigger(locality, 'hiddensearch');
      }
    };
    
    info.marker._element = newEl;
  });
}

// Consolidated search trigger handler
function handleSearchTrigger(locality, targetField = 'hiddensearch') {
  window.isMarkerClick = true;
  console.log(`🎯 handleSearchTrigger: "${locality}", field: "${targetField}"`);
  
  const oppositeField = targetField === 'hiddensearch' ? 'hiddendistrict' : 'hiddensearch';
  
  // Clear opposite field
  const oppositeSearch = $id(oppositeField);
  if (oppositeSearch?.value) {
    oppositeSearch.value = '';
    triggerEvent(oppositeSearch, ['input', 'change', 'keyup']);
    oppositeSearch.closest('form')?.dispatchEvent(new Event('input', {bubbles: true}));
  }
  
  // Set target field
  const search = $id(targetField);
  if (search) {
    search.value = locality;
    triggerEvent(search, ['input', 'change', 'keyup']);
    search.closest('form')?.dispatchEvent(new Event('input', {bubbles: true}));
    
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
}

// Simplified clustering logic
function getOrCreateCluster(center, count, coords) {
  const existing = clusterMarkers.find(c => 
    Math.sqrt((c.point.x - center.x) ** 2 + (c.point.y - center.y) ** 2) < OVERLAP_THRESHOLD / 2
  );
  
  if (existing) {
    existing.count += count;
    // Find the number element more comprehensively
    const num = existing.element.querySelector('#PlaceNum, [id*="PlaceNum"], .place-num, [class*="num"]') || 
                existing.element.querySelector('div, span');
    if (num) num.textContent = existing.count;
    return existing;
  }
  
  let wrap = null;
  const originalWrap = $id('PlaceNumWrap');
  
  if (originalWrap) {
    // Clone with all children and attributes
    wrap = originalWrap.cloneNode(true);
    
    // Remove ID to avoid conflicts
    wrap.removeAttribute('id');
    
    // Find and update the number element - be more thorough
    const num = wrap.querySelector('#PlaceNum') || 
                wrap.querySelector('[id*="PlaceNum"]') || 
                wrap.querySelector('.place-num') || 
                wrap.querySelector('[class*="num"]') || 
                wrap.querySelector('div') || 
                wrap.querySelector('span') || 
                wrap;
    
    if (num) {
      // Remove ID from cloned number element to avoid duplicates
      if (num.id) num.removeAttribute('id');
      num.textContent = count;
    }
  } else {
    // Fallback if PlaceNumWrap doesn't exist
    wrap = document.createElement('div');
    wrap.style.cssText = 'background: rgba(0,0,0,0.7); color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold;';
    
    const num = document.createElement('div');
    num.textContent = count;
    wrap.appendChild(num);
  }
  
  wrap.classList.add('cluster-marker');
  const marker = new mapboxgl.Marker({element: wrap, anchor: 'center'}).setLngLat(coords).addTo(map);
  
  const cluster = {marker, element: wrap, count, point: center, coordinates: coords};
  clusterMarkers.push(cluster);
  return cluster;
}

// Optimized overlap checking with mobile-friendly marker visibility
function checkOverlap() {
  if (isRefreshButtonAction && map.isMoving()) return;
  
  const currentZoom = map.getZoom();
  const shouldShowMarkers = currentZoom >= (isMobile ? 8 : 9); // Zoom 8 threshold on mobile
  
  console.log(`🔄 checkOverlap: zoom ${currentZoom.toFixed(2)}, show: ${shouldShowMarkers}, mobile: ${isMobile}`);
  
  if (!shouldShowMarkers) {
    [...allMarkers, ...clusterMarkers].forEach(info => {
      const element = info.marker?.getElement() || info.element;
      setStyles(element, {transition: 'opacity 300ms ease', opacity: '0', pointerEvents: 'none'});
      setTimeout(() => element.style.opacity === '0' && setStyles(element, {visibility: 'hidden', display: 'none'}), 300);
    });
    return;
  }
  
  if (allMarkers.length <= 1) return;
  
  const positions = allMarkers.map(info => ({
    ...info,
    point: map.project(info.marker.getLngLat()),
    element: info.marker.getElement(),
    visible: true,
    clustered: false
  }));
  
  const newClusters = [];
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].clustered || positions[i].element.classList.contains('filtered-out')) continue;
    
    const cluster = {markerIndices: [i], center: positions[i].point, coordinates: positions[i].coordinates};
    
    for (let j = 0; j < positions.length; j++) {
      if (i === j || positions[j].clustered || positions[j].element.classList.contains('filtered-out')) continue;
      
      const dist = Math.sqrt((positions[i].point.x - positions[j].point.x) ** 2 + (positions[i].point.y - positions[j].point.y) ** 2);
      if (dist < OVERLAP_THRESHOLD) {
        cluster.markerIndices.push(j);
        console.log(`🔗 Grouping ${positions[i].name} with ${positions[j].name}`);
      }
    }
    
    if (cluster.markerIndices.length > 1) {
      cluster.markerIndices.forEach(idx => {
        positions[idx].clustered = true;
        positions[idx].visible = false;
      });
      
      const sumX = cluster.markerIndices.reduce((sum, idx) => sum + positions[idx].point.x, 0);
      const sumY = cluster.markerIndices.reduce((sum, idx) => sum + positions[idx].point.y, 0);
      cluster.center = {x: sumX / cluster.markerIndices.length, y: sumY / cluster.markerIndices.length};
      cluster.coordinates = map.unproject(cluster.center);
      cluster.count = cluster.markerIndices.length;
      
      newClusters.push(cluster);
    }
  }
  
  // Update or create clusters
  const updatedClusterIds = new Set();
  newClusters.forEach(newCluster => {
    const existingCluster = clusterMarkers.find(existing => {
      const dist = Math.sqrt((existing.point.x - newCluster.center.x) ** 2 + (existing.point.y - newCluster.center.y) ** 2);
      return dist < OVERLAP_THRESHOLD && !updatedClusterIds.has(existing.id);
    });
    
    if (existingCluster) {
      updatedClusterIds.add(existingCluster.id);
      Object.assign(existingCluster, {count: newCluster.count, coordinates: newCluster.coordinates, point: newCluster.center});
      
      const num = existingCluster.element.querySelector('#PlaceNum, div');
      if (num) num.textContent = newCluster.count;
      existingCluster.marker.setLngLat(newCluster.coordinates);
      setStyles(existingCluster.element, {transition: 'opacity 300ms ease', opacity: '1', pointerEvents: 'auto'});
    } else {
      const clusterMarker = getOrCreateCluster(newCluster.center, newCluster.count, newCluster.coordinates);
      if (clusterMarker) {
        clusterMarker.id = `new-cluster-${Date.now()}-${Math.random()}`;
        updatedClusterIds.add(clusterMarker.id);
        setStyles(clusterMarker.element, {transition: 'opacity 300ms ease', opacity: '0'});
        setTimeout(() => clusterMarker.element && (clusterMarker.element.style.opacity = '1'), 50);
      }
    }
  });
  
  // Remove unused clusters
  clusterMarkers = clusterMarkers.filter(cluster => {
    if (!updatedClusterIds.has(cluster.id)) {
      setStyles(cluster.element, {transition: 'opacity 300ms ease', opacity: '0'});
      setTimeout(() => cluster.marker.remove(), 300);
      return false;
    }
    return true;
  });
  
  // Set marker visibility
  positions.forEach(info => {
    if (isInitialLoad && map.getZoom() < (isMobile ? 8 : 9)) return;
    
    const element = info.element;
    if (!info.visible || info.clustered) {
      setStyles(element, {transition: 'opacity 300ms ease', opacity: '0', pointerEvents: 'none'});
      element.classList.add('marker-faded');
    } else {
      setStyles(element, {display: 'block', visibility: 'visible', transition: 'opacity 300ms ease'});
      if (element.style.opacity === '0' || !element.style.opacity) {
        element.style.opacity = '0';
        element.offsetHeight;
        setStyles(element, {opacity: '1', pointerEvents: 'auto'});
      } else {
        setStyles(element, {opacity: '1', pointerEvents: 'auto'});
      }
      element.classList.remove('marker-faded');
    }
  });
}

// Consolidated filtering checks
const checkFiltering = (instance) => {
  if (window.fsAttributes?.cmsfilter) {
    const filterInstance = window.fsAttributes.cmsfilter.getByInstance(instance);
    if (filterInstance) {
      const activeFilters = filterInstance.filtersData;
      if (activeFilters && Object.keys(activeFilters).length > 0) return true;
      
      const renderedItems = filterInstance.listInstance.items.filter(item => !item.element.style.display || item.element.style.display !== 'none');
      if (renderedItems.length > 0 && renderedItems.length < filterInstance.listInstance.items.length) return true;
    }
  }
  
  const filterList = $(`[fs-list-instance="${instance}"]`)[0];
  if (filterList) {
    const allItems = filterList.querySelectorAll('[fs-cmsfilter-element="list-item"]');
    const visibleItems = filterList.querySelectorAll('[fs-cmsfilter-element="list-item"]:not([style*="display: none"])');
    if (allItems.length > 0 && visibleItems.length > 0 && visibleItems.length < allItems.length) return true;
  }
  
  return false;
};

const checkFilterInstanceFiltering = () => checkFiltering('Filter');
const checkMapMarkersFiltering = () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (Array.from(urlParams.keys()).some(key => key.startsWith('mapmarkers_') || key.includes('mapmarkers') || key === 'district' || key === 'locality')) return true;
  
  if (checkFiltering('mapmarkers')) return true;
  
  const filteredLat = $('.data-places-latitudes-filter');
  const allLat = $('.data-places-latitudes, .data-place-latitude');
  return filteredLat.length > 0 && filteredLat.length < allLat.length;
};

// Apply filter with improved reframing
function applyFilterToMarkers() {
  if (isInitialLoad && !checkMapMarkersFiltering()) return;
  
  const filteredLat = $('.data-places-latitudes-filter');
  const filteredLon = $('.data-places-longitudes-filter');
  const allLat = $('.data-places-latitudes, .data-place-latitude');
  
  let visibleCoordinates = [];
  if (filteredLat.length && filteredLon.length && filteredLat.length < allLat.length) {
    visibleCoordinates = filteredLat.map((el, i) => {
      const lat = parseFloat(el.textContent.trim());
      const lon = parseFloat(filteredLon[i]?.textContent.trim());
      return !isNaN(lat) && !isNaN(lon) ? [lon, lat] : null;
    }).filter(Boolean);
  }
  
  const animationDuration = isInitialLoad ? 600 : 1000;
  
  if (visibleCoordinates.length > 0) {
    console.log(`🗺️ Reframing to ${visibleCoordinates.length} filtered markers`);
    const bounds = new mapboxgl.LngLatBounds();
    visibleCoordinates.forEach(coord => bounds.extend(coord));
    
    const newZoom = map.cameraForBounds(bounds, {padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15}, maxZoom: 13}).zoom;
    
    if (newZoom > map.getZoom() + 1) {
      clusterMarkers.forEach(c => c.marker.remove());
      clusterMarkers = [];
      allMarkers.forEach(info => info.marker.getElement().classList.remove('marker-faded'));
    }
    
    map.fitBounds(bounds, {padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15}, maxZoom: 13, duration: animationDuration, essential: true});
  } else {
    console.log('🗺️ No filtered markers, reframing to West Bank');
    if (!isInitialLoad || !checkMapMarkersFiltering()) {
      clusterMarkers.forEach(c => c.marker.remove());
      clusterMarkers = [];
      allMarkers.forEach(info => info.marker.getElement().classList.remove('marker-faded'));
      map.flyTo({center: [35.22, 31.85], zoom: 8.33, duration: animationDuration, essential: true});
    }
  }
  
  setTimeout(checkOverlap, animationDuration + 50);
}

const handleFilterUpdate = debounce(() => {
  if (window.isLinkClick || window.isMarkerClick || window.isHiddenSearchActive) return;
  isRefreshButtonAction = true;
  applyFilterToMarkers();
  setTimeout(() => isRefreshButtonAction = false, 1000);
}, 300);

// Custom tab switcher for elements without sidebar functionality
function setupTabSwitcher() {
  // Find all elements with open-tab attribute
  const tabTriggers = $('[open-tab]');
  
  tabTriggers.forEach(trigger => {
    // Skip if already has event listener
    if (trigger.dataset.tabSwitcherSetup === 'true') return;
    
    trigger.addEventListener('click', function(e) {
      // Only prevent default if element doesn't have sidebar functionality
      if (!this.hasAttribute('open-right-sidebar')) {
        e.preventDefault();
      }
      
      // Get the group name from the clicked element
      const groupName = this.getAttribute('open-tab');
      
      // If element has sidebar attribute, let the sidebar script handle the tab switching
      if (this.hasAttribute('open-right-sidebar')) {
        return; // Sidebar script handles this
      }
      
      // Find the corresponding tab with opened-tab attribute
      const targetTab = document.querySelector(`[opened-tab="${groupName}"]`);
      
      if (targetTab) {
        // Trigger click on the target tab to activate Webflow's built-in functionality
        targetTab.click();
      }
    });
    
    // Mark as set up
    trigger.dataset.tabSwitcherSetup = 'true';
  });
}
function setupControls() {
  const controlMap = {
    'AllEvents': () => $id('ClearAll')?.click(),
    'ToggleLeft': () => {
      const leftSidebar = $id('LeftSidebar');
      if (leftSidebar) toggleSidebar('Left', !leftSidebar.classList.contains('is-show'));
    }
  };
  
  Object.entries(controlMap).forEach(([id, action]) => {
    const btn = $id(id);
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', e => {e.preventDefault(); e.stopPropagation(); action();});
    }
  });
  
  // Setup sidebar controls with consolidated logic
  const setupSidebarControls = (selector, sidebarSide, eventType = 'click') => {
    $(selector).forEach(element => {
      const newElement = element.cloneNode(true);
      element.parentNode?.replaceChild(newElement, element);
      
      const handler = () => {
        const sidebar = $id(`${sidebarSide}Sidebar`);
        if (!sidebar) return;
        
        // Check for open-only attribute
        const openRightSidebar = newElement.getAttribute('open-right-sidebar');
        if (openRightSidebar === 'open-only') {
          // Always open, never close
          toggleSidebar(sidebarSide, true);
        } else {
          // Normal toggle behavior
          toggleSidebar(sidebarSide, !sidebar.classList.contains('is-show'));
        }
        
        const groupName = newElement.getAttribute('open-tab');
        if (groupName) {
          setTimeout(() => document.querySelector(`[opened-tab="${groupName}"]`)?.click(), 50);
        }
      };
      
      if (eventType === 'change' && (newElement.type === 'radio' || newElement.type === 'checkbox')) {
        newElement.addEventListener('change', () => newElement.checked && handler());
      } else {
        newElement.addEventListener(eventType, e => {e.stopPropagation(); handler();});
      }
    });
  };
  
  setupSidebarControls('[open-right-sidebar="true"], [open-right-sidebar="open-only"]', 'Right');
  setupSidebarControls('.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]', 'Left', 'change');
}

// Smart sidebar setup with conditional initialization
function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = $id(`${side}Sidebar`);
    const tab = $id(`${side}SideTab`);
    const close = $id(`${side}SidebarClose`);
    
    // Check if all elements exist and aren't already set up
    if (!sidebar || !tab || !close) return false;
    if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
    
    // Style sidebar
    sidebar.style.cssText += `transition: margin-${side.toLowerCase()} 0.25s cubic-bezier(0.4, 0, 0.2, 1); z-index: ${zIndex}; position: relative;`;
    tab.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    
    const bringToFront = () => {
      const newZ = ++zIndex;
      sidebar.style.zIndex = newZ;
      
      if (window.innerWidth <= 478) {
        tab.style.zIndex = newZ + 10;
        if (tab.parentElement) tab.parentElement.style.zIndex = newZ + 10;
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
      
      const arrowIcon = $1(`[arrow-icon="${side.toLowerCase()}"]`);
      if (arrowIcon) arrowIcon.style.transform = show ? 'rotateY(180deg)' : 'rotateY(0deg)';
      
      if (window.innerWidth > 478) {
        const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
        sidebar.style[`margin${side}`] = show ? '0' : `-${currentWidth + 1}px`;
      } else {
        sidebar.style[`margin${side}`] = show ? '0' : '';
        if (show) {
          const oppositeSide = side === 'Left' ? 'Right' : 'Left';
          const oppositeSidebar = $id(`${oppositeSide}Sidebar`);
          if (oppositeSidebar) {
            oppositeSidebar.classList.remove('is-show');
            const oppositeArrowIcon = $1(`[arrow-icon="${oppositeSide.toLowerCase()}"]`);
            if (oppositeArrowIcon) oppositeArrowIcon.style.transform = 'rotateY(0deg)';
            oppositeSidebar.style[`margin${oppositeSide}`] = '';
            oppositeSidebar.style.pointerEvents = '';
          }
        }
      }
      
      sidebar.style.pointerEvents = show ? 'auto' : '';
    };
    
    // Add click listener to sidebar for z-index management
    if (!sidebar.dataset.clickSetup) {
      sidebar.addEventListener('click', () => {
        if (sidebar.classList.contains('is-show')) bringToFront();
      });
      sidebar.dataset.clickSetup = 'true';
    }
    
    // Setup tab button if not already done
    if (tab.dataset.setupComplete !== 'true') {
      tab.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggle(!sidebar.classList.contains('is-show'));
      });
      tab.dataset.setupComplete = 'true';
    }
    
    // Setup close button if not already done
    if (close.dataset.setupComplete !== 'true') {
      close.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggle(false);
      });
      close.dataset.setupComplete = 'true';
    }
    
    zIndex++;
    return true;
  };
  
  // Smart retry function that waits for all elements
  const attemptSetup = (attempt = 1, maxAttempts = 5) => {
    const leftReady = setupSidebarElement('Left');
    const rightReady = setupSidebarElement('Right');
    
    if (leftReady && rightReady) {
      setupInitialMargins();
      setTimeout(setupControls, 100);
      return;
    }
    
    // If not all ready and we haven't hit max attempts, try again
    if (attempt < maxAttempts) {
      const delay = [100, 300, 500, 1000][attempt - 1] || 1000;
      setTimeout(() => attemptSetup(attempt + 1, maxAttempts), delay);
    } else {
      setupInitialMargins(); // Still try to set up margins
      setTimeout(setupControls, 100);
    }
  };
  
  const setupInitialMargins = () => {
    if (window.innerWidth <= 478) return;
    
    ['Left', 'Right'].forEach(side => {
      const sidebar = $id(`${side}Sidebar`);
      if (sidebar && !sidebar.classList.contains('is-show')) {
        const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
        sidebar.style[`margin${side}`] = `-${currentWidth + 1}px`;
      }
    });
  };
  
  // Start the smart setup process
  attemptSetup();
}

// Consolidated event setup
function setupEvents() {
  const eventHandlers = [
    {selector: '[data-auto-sidebar="true"]', events: ['change', 'input'], handler: () => setTimeout(() => toggleSidebar('Left', true), 100)},
    {selector: 'select, [fs-cmsfilter-element="select"]', events: ['change'], handler: () => setTimeout(handleFilterUpdate, 100)},
    {selector: '[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select', events: ['change'], handler: () => setTimeout(handleFilterUpdate, 100)}
  ];
  
  eventHandlers.forEach(({selector, events, handler}) => {
    $(selector).forEach(element => {
      events.forEach(event => {
        if (event === 'input' && ['text', 'search'].includes(element.type)) {
          element.addEventListener(event, handler);
        } else if (event !== 'input' || element.type !== 'text') {
          element.addEventListener(event, handler);
        }
      });
    });
  });
  
  // Setup #hiddensearch for search functionality without map refresh
  const hiddenSearch = $id('hiddensearch');
  if (hiddenSearch) {
    ['input', 'change', 'keyup'].forEach(event => {
      hiddenSearch.addEventListener(event, () => {
        window.isHiddenSearchActive = true;
        // Only toggle sidebar and filtered elements, no map refresh
        if (hiddenSearch.value.trim()) {
          toggleShowWhenFilteredElements(true);
          toggleSidebar('Left', true);
        }
        setTimeout(() => window.isHiddenSearchActive = false, 500);
      });
    });
  }
  
  // Consolidated apply-map-filter attribute (excludes districtselect and select-field-5 which have specific logic)
  $('[apply-map-filter="true"], #refreshDiv, #refresh-on-enter, .filterrefresh, #filter-button').forEach(element => {
    const newElement = element.cloneNode(true);
    if (element.parentNode) element.parentNode.replaceChild(newElement, element);
    
    const events = [];
    if (newElement.id === 'refresh-on-enter' || newElement.getAttribute('apply-map-filter') === 'true') {
      events.push('click', 'keypress', 'input');
    } else {
      events.push('click');
    }
    
    events.forEach(eventType => {
      newElement.addEventListener(eventType, (e) => {
        if (eventType === 'keypress' && e.key !== 'Enter') return;
        if (window.isMarkerClick) return;
        
        e.preventDefault();
        
        forceFilteredReframe = true;
        isRefreshButtonAction = true;
        
        const delay = eventType === 'input' ? 300 : 100;
        
        setTimeout(() => {
          applyFilterToMarkers();
          setTimeout(() => {
            forceFilteredReframe = false;
            isRefreshButtonAction = false;
          }, 1000);
        }, delay);
      });
    });
  });
  
  // Global event listeners
  ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed'].forEach(event => {
    document.addEventListener(event, handleFilterUpdate);
  });
  
  // Firefox form handling
  if (navigator.userAgent.toLowerCase().includes('firefox')) {
    $('form').forEach(form => {
      const hasFilterElements = form.querySelector('[fs-cmsfilter-element]') !== null;
      const isNearMap = $id('map') && (form.contains($id('map')) || $id('map').contains(form) || form.parentElement === $id('map').parentElement);
      
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
  
  // Cluster click handler
  document.onclick = e => {
    let target = e.target;
    while (target && !target.classList?.contains('cluster-marker')) target = target.parentElement;
    
    if (target) {
      const cluster = clusterMarkers.find(c => c.element === target);
      if (cluster) map.flyTo({center: cluster.coordinates, zoom: map.getZoom() + 2.5, duration: 800});
    }
  };
  
  // Link click tracking
  $('a:not(.filterrefresh):not([fs-cmsfilter-element])').forEach(link => {
    link.onclick = () => {
      if (!link.closest('[fs-cmsfilter-element]') && !link.classList.contains('w-pagination-next') && !link.classList.contains('w-pagination-previous')) {
        window.isLinkClick = true;
        setTimeout(() => window.isLinkClick = false, 500);
      }
    };
  });
}

// Specific dropdown listeners for districtselect and select-field-5
function setupDropdownListeners() {
  if (window.dropdownListenersSetup) return;
  window.dropdownListenersSetup = true;
  
  // Handle districtselect elements while preserving existing functionality
  $('[districtselect]').forEach(element => {
    // Add our functionality WITHOUT removing existing event listeners
    element.addEventListener('click', (e) => {
      // Don't prevent default - let the original dropdown functionality work
      if (window.isMarkerClick) return;
      
      // Add a small delay to let the original functionality complete first
      setTimeout(() => {
        forceFilteredReframe = true;
        isRefreshButtonAction = true;
        
        setTimeout(() => {
          applyFilterToMarkers();
          setTimeout(() => {
            forceFilteredReframe = false;
            isRefreshButtonAction = false;
          }, 1000);
        }, 100); // Small delay to let original dropdown logic complete
      }, 50);
    });
  });
  
  // Handle select-field-5 while preserving existing functionality
  const selectField5 = $id('select-field-5');
  if (selectField5) {
    // Add our functionality without removing existing listeners
    selectField5.addEventListener('change', (e) => {
      if (window.isMarkerClick) return;
      
      // Small delay to let original functionality complete
      setTimeout(() => {
        forceFilteredReframe = true;
        isRefreshButtonAction = true;
        
        setTimeout(() => {
          applyFilterToMarkers();
          setTimeout(() => {
            forceFilteredReframe = false;
            isRefreshButtonAction = false;
          }, 1000);
        }, 100);
      }, 50);
    });
  }
}

// Load district tags from collection list and create markers
function loadDistrictTags() {
  const districtTagCollection = $id('district-tag-collection');
  if (!districtTagCollection) return;
  
  const districtTagItems = districtTagCollection.querySelectorAll('#district-tag-item');
  
  districtTagItems.forEach(tagItem => {
    // Skip hidden items (those without coordinates)
    if (getComputedStyle(tagItem).display === 'none') return;
    
    const name = tagItem.getAttribute('district-tag-name');
    const lat = parseFloat(tagItem.getAttribute('district-tag-lattitude'));
    const lng = parseFloat(tagItem.getAttribute('district-tag-longitude'));
    
    // Skip if missing name or invalid coordinates
    if (!name || isNaN(lat) || isNaN(lng)) return;
    
    const originalWrap = $id('district-name-wrap');
    if (!originalWrap) return;
    
    // Clone the district name wrap
    const districtWrap = originalWrap.cloneNode(true);
    districtWrap.removeAttribute('id');
    districtWrap.className += ` district-tag-${name.toLowerCase().replace(/\s+/g, '-')}`;
    districtWrap.style.zIndex = '1000';
    
    // Set the district name
    const nameElement = districtWrap.querySelector('#district-name');
    if (nameElement) {
      nameElement.textContent = name;
      nameElement.removeAttribute('id');
    }
    
    // Create marker at specified coordinates
    const marker = new mapboxgl.Marker({element: districtWrap, anchor: 'center'})
      .setLngLat([lng, lat])
      .addTo(map);
    
    // Add click handler for both map and reports filtering
    districtWrap.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      
      window.isMarkerClick = true;
      
      // Set both fields for complete filtering
      const hiddenDistrict = $id('hiddendistrict');
      const refreshOnEnter = $id('refresh-on-enter');
      
      // Clear opposite fields first
      const hiddenSearch = $id('hiddensearch');
      if (hiddenSearch?.value) {
        hiddenSearch.value = '';
        triggerEvent(hiddenSearch, ['input', 'change', 'keyup']);
        hiddenSearch.closest('form')?.dispatchEvent(new Event('input', {bubbles: true}));
      }
      
      // Set hiddendistrict for reports filtering
      if (hiddenDistrict) {
        hiddenDistrict.value = name;
        triggerEvent(hiddenDistrict, ['input', 'change', 'keyup']);
        hiddenDistrict.closest('form')?.dispatchEvent(new Event('input', {bubbles: true}));
      }
      
      // Set refresh-on-enter for map filtering  
      if (refreshOnEnter) {
        refreshOnEnter.value = name;
        triggerEvent(refreshOnEnter, ['input', 'change', 'keyup']);
        refreshOnEnter.closest('form')?.dispatchEvent(new Event('input', {bubbles: true}));
      }
      
      // Trigger CMS filter reload
      setTimeout(() => {
        if (window.fsAttributes?.cmsfilter) window.fsAttributes.cmsfilter.reload();
        ['fs-cmsfilter-change', 'fs-cmsfilter-search'].forEach(type => 
          document.dispatchEvent(new CustomEvent(type, {bubbles: true, detail: {value: name}}))
        );
      }, 100);
      
      // Show filtered elements and sidebar
      toggleShowWhenFilteredElements(true);
      toggleSidebar('Left', true);
      
      // Trigger map reframing
      setTimeout(() => {
        forceFilteredReframe = true;
        isRefreshButtonAction = true;
        applyFilterToMarkers();
        setTimeout(() => {
          forceFilteredReframe = false;
          isRefreshButtonAction = false;
        }, 1000);
      }, 200);
      
      setTimeout(() => window.isMarkerClick = false, 1000);
    });
    
    // Add to district markers array for zoom-based visibility
    districtMarkers.push({marker, element: districtWrap, name});
  });
}
// Load area overlays (A, B, C areas)
function loadAreaOverlays() {
  const areas = [
    {
      name: 'Area A',
      url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_a.geojson',
      sourceId: 'area-a-source',
      layerId: 'area-a-layer',
      color: '#98b074',
      opacity: 0.3
    },
    {
      name: 'Area B', 
      url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_b.geojson',
      sourceId: 'area-b-source',
      layerId: 'area-b-layer',
      color: '#a84b4b',
      opacity: 0.3
    },
    {
      name: 'Area C',
      url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_c.geojson', 
      sourceId: 'area-c-source',
      layerId: 'area-c-layer',
      color: '#e99797',
      opacity: 0.3
    }
  ];
  
  const addAreaToMap = area => {
    fetch(area.url)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then(geojsonData => {
        // Remove existing layer and source if they exist
        if (map.getLayer(area.layerId)) {
          map.removeLayer(area.layerId);
        }
        if (map.getSource(area.sourceId)) {
          map.removeSource(area.sourceId);
        }
        
        // Add source
        map.addSource(area.sourceId, {
          type: 'geojson',
          data: geojsonData
        });
        
        // Add fill layer
        map.addLayer({
          id: area.layerId,
          type: 'fill',
          source: area.sourceId,
          paint: {
            'fill-color': area.color,
            'fill-opacity': area.opacity
          }
        });
      })
      .catch(error => {
        // Silent error handling for area loading
      });
  };
  
  if (map.loaded()) {
    areas.forEach(area => addAreaToMap(area));
  } else {
    map.on('load', () => areas.forEach(area => addAreaToMap(area)));
  }
}
// Simplified boundary loading
function loadBoundaries() {
  const boundaries = [
    'Jerusalem', 'Hebron', 'Tulkarm', 'Tubas', 'Salfit', 'Ramallah', 
    'Nablus', 'Jericho', 'Jenin', 'Bethlehem', 'Qalqilya'
  ].map(name => ({
    name,
    url: `https://raw.githubusercontent.com/Tovlim/COTO/main/${name}.geojson`,
    sourceId: `${name.toLowerCase()}-boundary`,
    fillId: `${name.toLowerCase()}-fill`,
    borderId: `${name.toLowerCase()}-border`
  }));
  
  const calculateCentroid = coordinates => {
    let totalLat = 0, totalLng = 0, pointCount = 0;
    
    const processCoords = coords => {
      if (Array.isArray(coords) && coords.length > 0) {
        if (typeof coords[0] === 'number') {
          totalLng += coords[0];
          totalLat += coords[1];
          pointCount++;
        } else {
          coords.forEach(coord => processCoords(coord));
        }
      }
    };
    
    processCoords(coordinates);
    return pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : [0, 0];
  };
  
  const addBoundaryToMap = boundary => {
    fetch(boundary.url)
      .then(response => response.json())
      .then(geojsonData => {
        if (map.getSource(boundary.sourceId)) {
          [boundary.borderId, boundary.fillId].forEach(id => map.removeLayer(id));
          map.removeSource(boundary.sourceId);
        }
        
        map.addSource(boundary.sourceId, {type: 'geojson', data: geojsonData});
        map.addLayer({id: boundary.fillId, type: 'fill', source: boundary.sourceId, paint: {'fill-color': '#1a1b1e', 'fill-opacity': 0.25}});
        map.addLayer({id: boundary.borderId, type: 'line', source: boundary.sourceId, paint: {'line-color': '#1a1b1e', 'line-width': 2, 'line-opacity': 1}});
        
        const centroid = calculateCentroid(geojsonData.features[0].geometry.coordinates);
        const originalWrap = $id('district-name-wrap');
        
        if (originalWrap) {
          const districtWrap = originalWrap.cloneNode(true);
          districtWrap.removeAttribute('id');
          districtWrap.className += ` district-${boundary.name.toLowerCase()}`;
          districtWrap.style.zIndex = '1000';
          
          const nameElement = districtWrap.querySelector('#district-name');
          if (nameElement) {
            nameElement.textContent = boundary.name;
            nameElement.removeAttribute('id');
          }
          
          const marker = new mapboxgl.Marker({element: districtWrap, anchor: 'center'}).setLngLat(centroid).addTo(map);
          
          districtWrap.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            
            const nameEl = districtWrap.querySelector('.text-block-82:not(.number)');
            if (nameEl) {
              const districtName = nameEl.textContent.trim();
              if (districtName) handleSearchTrigger(districtName, 'hiddendistrict');
            }
            
            const bounds = new mapboxgl.LngLatBounds();
            const addCoords = coords => {
              if (Array.isArray(coords) && coords.length > 0) {
                if (typeof coords[0] === 'number') bounds.extend(coords);
                else coords.forEach(addCoords);
              }
            };
            
            geojsonData.features.forEach(feature => addCoords(feature.geometry.coordinates));
            map.fitBounds(bounds, {padding: 50, duration: 1000, essential: true});
          });
          
          districtMarkers.push({marker, element: districtWrap, name: boundary.name});
        }
        
        // Boundary interaction handlers
        map.on('click', boundary.fillId, () => {
          const bounds = new mapboxgl.LngLatBounds();
          geojsonData.features.forEach(feature => {
            const addCoords = coords => {
              if (Array.isArray(coords) && coords.length > 0) {
                if (typeof coords[0] === 'number') bounds.extend(coords);
                else coords.forEach(addCoords);
              }
            };
            addCoords(feature.geometry.coordinates);
          });
          map.fitBounds(bounds, {padding: 50, duration: 1000});
        });
        
        map.on('mouseenter', boundary.fillId, () => {
          map.getCanvas().style.cursor = 'pointer';
          map.setPaintProperty(boundary.fillId, 'fill-color', '#e93119');
          map.setPaintProperty(boundary.borderId, 'line-color', '#e93119');
          if (map.getLayer(boundary.fillId)) map.moveLayer(boundary.fillId);
          if (map.getLayer(boundary.borderId)) map.moveLayer(boundary.borderId);
        });
        
        map.on('mouseleave', boundary.fillId, () => {
          map.getCanvas().style.cursor = '';
          map.setPaintProperty(boundary.fillId, 'fill-color', '#1a1b1e');
          map.setPaintProperty(boundary.borderId, 'line-color', '#1a1b1e');
        });
      })
      .catch(error => {
        // Silent error handling for boundary loading
      });
  };
  
  (map.loaded() ? boundaries : (() => {map.on('load', () => boundaries.forEach(addBoundaryToMap)); return [];})()).forEach(addBoundaryToMap);
}

// Tag monitoring with simplified logic
const monitorTags = () => {
  const checkTags = () => toggleShowWhenFilteredElements($id('hiddentagparent') !== null);
  checkTags();
  
  const tagParent = $id('tagparent');
  if (tagParent) {
    new MutationObserver(() => setTimeout(checkTags, 50)).observe(tagParent, {childList: true, subtree: true});
  } else {
    setInterval(checkTags, 1000);
  }
};

// Simplified initialization
function init() {
  getLocationData();
  addCustomMarkers();
  setupEvents();
  
  const handleMapEvents = () => {
    clearTimeout(overlapTimer);
    overlapTimer = setTimeout(() => {
      handleZoomBasedVisibility();
      checkOverlap();
    }, 10);
  };
  
  map.on('moveend', handleMapEvents);
  map.on('zoomend', handleMapEvents);
  
  [300, 1000, 3000].forEach(delay => setTimeout(setupMarkerClicks, delay));
  setTimeout(setupDropdownListeners, 1000);
  setTimeout(setupDropdownListeners, 3000);
  
  // Setup tab switcher with retries for dynamic content
  [500, 1500, 3000].forEach(delay => setTimeout(setupTabSwitcher, delay));
  
  mapInitialized = true;
  setTimeout(() => {
    if (isInitialLoad) {
      const hasFiltering = checkMapMarkersFiltering();
      if (hasFiltering) setTimeout(checkOverlap, 300);
      else setTimeout(checkOverlap, 300);
      isInitialLoad = false;
    }
  }, 500);
}

// Event handlers and initialization
setTimeout(() => {
  const ctrl = $1('.mapboxgl-ctrl-top-right');
  if (ctrl) setStyles(ctrl, {top: '4rem', right: '0.5rem', zIndex: '10'});
}, 500);

map.on("load", () => {
  try {
    init();
    loadAreaOverlays();
    loadBoundaries();
    // Load district tags after boundaries
    setTimeout(loadDistrictTags, 500);
  } catch (error) {
    // Silent error handling
  }
});

document.addEventListener('DOMContentLoaded', () => {
  setupSidebars();
  setupTabSwitcher();
});

window.addEventListener('load', () => {
  setupSidebars();
  setupTabSwitcher();
  setTimeout(() => {
    if (!allMarkers.length && map.loaded()) {
      try { init(); } catch (error) { /* Silent error handling */ }
    }
  }, 200);
  
  // Load district tags with retries for CMS content
  [1000, 2000, 3000].forEach(delay => setTimeout(loadDistrictTags, delay));
  
  // Auto-trigger reframing
  const checkAndReframe = () => {
    if (map.loaded() && !map.isMoving() && checkMapMarkersFiltering()) {
      forceFilteredReframe = true;
      isRefreshButtonAction = true;
      applyFilterToMarkers();
      setTimeout(() => {forceFilteredReframe = false; isRefreshButtonAction = false;}, 1000);
      return true;
    }
    return false;
  };
  
  if (!checkAndReframe()) setTimeout(() => !checkAndReframe() && setTimeout(checkAndReframe, 1000), 500);
});

setTimeout(monitorTags, 1000);
