// Detect mobile for better map experience
const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Show loading screen at start
const loadingScreen = document.getElementById('loading-map-screen');
if (loadingScreen) {
  loadingScreen.style.display = 'flex';
}

// Fallback: Hide loading screen after max 10 seconds regardless
setTimeout(() => {
  const loadingScreen = document.getElementById('loading-map-screen');
  if (loadingScreen && loadingScreen.style.display !== 'none') {
    loadingScreen.style.display = 'none';
  }
}, 10000);

// Initialize Mapbox
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
if (['ar', 'he'].includes(lang)) mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmbus40jb016n01s5dui12tre",
  center: [35.22, 31.85],
  zoom: isMobile ? 7.5 : 8.33,
  language: ['en','es','fr','de','zh','ja','ru','ar','he'].includes(lang) ? lang : 'en'
});

map.addControl(new mapboxgl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserHeading: true}));

// Add zoom controls (zoom in/out buttons)
map.addControl(new mapboxgl.NavigationControl({
  showCompass: false,  // Hide compass, only show zoom buttons
  showZoom: true,      // Show zoom in/out buttons
  visualizePitch: false // Hide pitch visualization
}), 'top-right');

// Custom Map Reset Control
class MapResetControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    
    this._button = document.createElement('button');
    this._button.className = 'mapboxgl-ctrl-icon';
    this._button.type = 'button';
    this._button.title = 'Reset map to default view';
    this._button.setAttribute('aria-label', 'Reset map to default view');
    
    // Add custom reset icon styling
    this._button.style.cssText = `
      background-image: url("https://cdn.prod.website-files.com/6824fc6dd9bace7c31d8a0d9/6873aecae0c1702f3d417a81_reset%20icon%203.svg");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 15px 15px;
    `;
    
    this._button.addEventListener('click', () => {
      // Reset to default position
      this._map.flyTo({
        center: [35.22, 31.85],
        zoom: isMobile ? 7.5 : 8.33,
        duration: 1000,
        essential: true
      });
      
      // Clear any active filters and markers if needed
      state.clusterMarkers.forEach(c => c.marker.remove());
      state.clusterMarkers = [];
      state.allMarkers.forEach(info => info.marker.getElement().classList.remove('marker-faded'));
    });
    
    this._container.appendChild(this._button);
    return this._container;
  }
  
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

// Add the custom reset control
map.addControl(new MapResetControl(), 'top-right');

// Global state - consolidated
const state = {
  locationData: {type: "FeatureCollection", features: []},
  allMarkers: [],
  clusterMarkers: [],
  districtMarkers: [],
  timers: {overlap: null, filter: null, zoom: null},
  lastClickedMarker: null,
  lastClickTime: 0,
  lastAnyMarkerClickTime: 0, // Global debounce for any marker clicks
  flags: {
    isInitialLoad: true,
    mapInitialized: false,
    forceFilteredReframe: false,
    isRefreshButtonAction: false,
    dropdownListenersSetup: false
  }
};

window.isLinkClick = false;
const OVERLAP_THRESHOLD = 60;
const MARKER_FONT = '"itc-avant-garde-gothic-pro", sans-serif';
const TRANSITIONS = {
  default: "200ms",
  district: 'opacity 300ms ease, background-color 0.3s ease'
};

// Optimized utilities
const $ = sel => document.querySelectorAll(sel);
const $1 = sel => document.querySelector(sel);
const $id = id => document.getElementById(id);

const utils = {
  triggerEvent: (el, events) => events.forEach(e => el.dispatchEvent(new Event(e, {bubbles: true}))),
  setStyles: (el, styles) => Object.assign(el.style, styles),
  applyFont: (element) => {
    element.style.fontFamily = MARKER_FONT;
    const children = element.querySelectorAll('*');
    for (let i = 0; i < children.length; i++) {
      children[i].style.fontFamily = MARKER_FONT;
    }
  },
  debounce: (fn, delay) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },
  calculateCentroid: coordinates => {
    let totalLat = 0, totalLng = 0, pointCount = 0;
    
    const processCoords = coords => {
      if (Array.isArray(coords) && coords.length > 0) {
        if (typeof coords[0] === 'number') {
          totalLng += coords[0];
          totalLat += coords[1];
          pointCount++;
        } else coords.forEach(processCoords);
      }
    };
    
    processCoords(coordinates);
    return pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : [0, 0];
  }
};

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
  
  utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
  const arrowIcon = $1(`[arrow-icon="${side.toLowerCase()}"]`);
  if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
};

// Toggle filtered elements
const toggleShowWhenFilteredElements = show => {
  $('[show-when-filtered="true"]').forEach(element => {
    utils.setStyles(element, {
      display: show ? 'block' : 'none',
      visibility: show ? 'visible' : 'hidden',
      opacity: show ? '1' : '0',
      pointerEvents: show ? 'auto' : 'none'
    });
  });
};

// Handle zoom-based visibility with optimized debouncing
const handleZoomBasedVisibility = utils.debounce(() => {
  const currentZoom = map.getZoom();
  const shouldShowDistrictNames = currentZoom > 6;
  
  if (!state.districtMarkers.length) return;
  
  state.districtMarkers.forEach(districtMarker => {
    const element = districtMarker.element;
    
    if (shouldShowDistrictNames) {
      if (element.dataset.fadeOutId) delete element.dataset.fadeOutId;
      
      const isHidden = element.style.display === 'none' || element.style.opacity === '0' || !element.style.opacity;
      if (isHidden) {
        utils.setStyles(element, {display: 'block', visibility: 'visible', transition: TRANSITIONS.district, opacity: '0', pointerEvents: 'none'});
        element.offsetHeight;
        utils.setStyles(element, {opacity: '1', pointerEvents: 'auto'});
      } else {
        utils.setStyles(element, {display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto', transition: TRANSITIONS.district});
      }
    } else {
      utils.setStyles(element, {transition: TRANSITIONS.district, opacity: '0', pointerEvents: 'none'});
      const fadeOutId = Date.now() + Math.random();
      element.dataset.fadeOutId = fadeOutId;
      
      setTimeout(() => {
        if (element.dataset.fadeOutId === fadeOutId.toString() && element.style.opacity === '0') {
          utils.setStyles(element, {visibility: 'hidden', display: 'none'});
          delete element.dataset.fadeOutId;
        }
      }, 300);
    }
  });
}, 50);

// Select district checkbox for filtering (triggered by map markers)
function selectDistrictCheckbox(districtName) {
  // Find all district and locality checkboxes
  const districtCheckboxes = $('[checkbox-filter="district"] input[fs-list-value]');
  const localityCheckboxes = $('[checkbox-filter="locality"] input[fs-list-value]');
  
  // Clear ALL district checkboxes first
  districtCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      checkbox.checked = false;
      utils.triggerEvent(checkbox, ['change', 'input']);
      
      // Trigger form events for each cleared checkbox
      const form = checkbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
  
  // Clear ALL locality checkboxes first
  localityCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      checkbox.checked = false;
      utils.triggerEvent(checkbox, ['change', 'input']);
      
      // Trigger form events for each cleared checkbox
      const form = checkbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
  
  // Find and check the matching district checkbox
  const targetCheckbox = Array.from(districtCheckboxes).find(checkbox => 
    checkbox.getAttribute('fs-list-value') === districtName
  );
  
  if (targetCheckbox) {
    targetCheckbox.checked = true;
    utils.triggerEvent(targetCheckbox, ['change', 'input']);
    
    // Trigger form events to ensure Finsweet registers the change
    const form = targetCheckbox.closest('form');
    if (form) {
      form.dispatchEvent(new Event('change', {bubbles: true}));
      form.dispatchEvent(new Event('input', {bubbles: true}));
    }
  }
  
  // Comprehensive Finsweet reload after all changes
  setTimeout(() => {
    if (window.fsAttributes?.cmsfilter) {
      window.fsAttributes.cmsfilter.reload();
    }
    
    // Dispatch custom filter events for both clearing and setting
    ['fs-cmsfilter-change', 'fs-cmsfilter-filtered'].forEach(eventType => {
      document.dispatchEvent(new CustomEvent(eventType, {
        bubbles: true,
        detail: {
          field: 'Districts',
          value: districtName,
          checked: true
        }
      }));
    });
  }, 50);
}

// Select locality checkbox for filtering (triggered by map markers)
function selectLocalityCheckbox(localityName) {
  // Find all district and locality checkboxes
  const districtCheckboxes = $('[checkbox-filter="district"] input[fs-list-value]');
  const localityCheckboxes = $('[checkbox-filter="locality"] input[fs-list-value]');
  
  // Clear ALL district checkboxes first
  districtCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      checkbox.checked = false;
      utils.triggerEvent(checkbox, ['change', 'input']);
      
      // Trigger form events for each cleared checkbox
      const form = checkbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
  
  // Clear ALL locality checkboxes first
  localityCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      checkbox.checked = false;
      utils.triggerEvent(checkbox, ['change', 'input']);
      
      // Trigger form events for each cleared checkbox
      const form = checkbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });
  
  // Find and check the matching locality checkbox
  const targetCheckbox = Array.from(localityCheckboxes).find(checkbox => 
    checkbox.getAttribute('fs-list-value') === localityName
  );
  
  if (targetCheckbox) {
    targetCheckbox.checked = true;
    utils.triggerEvent(targetCheckbox, ['change', 'input']);
    
    // Trigger form events to ensure Finsweet registers the change
    const form = targetCheckbox.closest('form');
    if (form) {
      form.dispatchEvent(new Event('change', {bubbles: true}));
      form.dispatchEvent(new Event('input', {bubbles: true}));
    }
  }
  
  // Comprehensive Finsweet reload after all changes
  setTimeout(() => {
    if (window.fsAttributes?.cmsfilter) {
      window.fsAttributes.cmsfilter.reload();
    }
    
    // Dispatch custom filter events for both clearing and setting
    ['fs-cmsfilter-change', 'fs-cmsfilter-filtered'].forEach(eventType => {
      document.dispatchEvent(new CustomEvent(eventType, {
        bubbles: true,
        detail: {
          field: 'Localities',
          value: localityName,
          checked: true
        }
      }));
    });
  }, 50);
}

// Optimized location data extraction
function getLocationData() {
  state.locationData.features = [];
  const selectors = [
    $('.data-places-names, .data-place-name'),
    $('.data-places-latitudes, .data-place-latitude'),
    $('.data-places-longitudes, .data-place-longitude'),
    $('.data-places-slugs, .data-place-slug, .data-slug')
  ];
  
  const [names, lats, lngs, slugs] = selectors;
  if (!names.length) return;
  
  const minLength = Math.min(names.length, lats.length, lngs.length);
  for (let i = 0; i < minLength; i++) {
    const [lat, lng] = [parseFloat(lats[i].textContent), parseFloat(lngs[i].textContent)];
    if (isNaN(lat) || isNaN(lng)) continue;
    
    state.locationData.features.push({
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

// Optimized marker creation
function addCustomMarkers() {
  if (!state.locationData.features.length) return;
  
  const popups = $('.OnMapPlaceLinks, #MapPopUp, [id^="MapPopUp"]');
  const used = [];
  
  // Clean up existing markers
  [...state.allMarkers, ...state.clusterMarkers].forEach(m => m.marker.remove());
  state.allMarkers = [];
  state.clusterMarkers = [];
  
  state.locationData.features.forEach((feature, i) => {
    const {coordinates} = feature.geometry;
    const {name, popupIndex, slug, index} = feature.properties;
    
    let popup = popups[popupIndex];
    if (popup && used.includes(popup)) popup = popups.find(p => !used.includes(p));
    
    const el = document.createElement('div');
    
    if (popup) {
      used.push(popup);
      el.className = 'custom-marker';
      const clone = popup.cloneNode(true);
      clone.style.cssText = `display: block; transition: opacity ${TRANSITIONS.default} ease;`;
      utils.applyFont(clone);
      el.appendChild(clone);
    } else {
      el.className = 'text-marker';
      el.textContent = name;
      el.style.cssText = `color: #fff; background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 4px; font-weight: normal; white-space: nowrap; transition: opacity ${TRANSITIONS.default} ease; font-family: ${MARKER_FONT};`;
    }
    
    const currentZoom = map.getZoom();
    const shouldShow = currentZoom >= (isMobile ? 8 : 9) && !state.flags.isInitialLoad;
    utils.setStyles(el, {
      opacity: shouldShow ? '1' : '0',
      visibility: shouldShow ? 'visible' : 'hidden',
      display: shouldShow ? 'block' : 'none',
      pointerEvents: shouldShow ? 'auto' : 'none',
      transition: `opacity ${TRANSITIONS.default} ease`
    });
    
    Object.assign(el.dataset, {name, markerslug: slug, markerindex: index});
    const marker = new mapboxgl.Marker({element: el, anchor: 'bottom'}).setLngLat(coordinates).addTo(map);
    state.allMarkers.push({marker, name, slug, index, coordinates});
  });
  
  setupMarkerClicks();
  setTimeout(checkOverlap, 100);
}

// Setup marker clicks with consolidated handler
function setupMarkerClicks() {
  state.allMarkers.forEach(info => {
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
      
      const currentTime = Date.now();
      
      // Global debounce - prevent any marker clicks within 1500ms
      if (currentTime - state.lastAnyMarkerClickTime < 1500) {
        return;
      }
      
      // Specific marker debounce - prevent same marker clicks within 2000ms
      const markerKey = `locality-${locality}`;
      if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 2000) {
        return;
      }
      
      state.lastClickedMarker = markerKey;
      state.lastClickTime = currentTime;
      state.lastAnyMarkerClickTime = currentTime;
      
      window.isMarkerClick = true;
      
      // Use checkbox selection for localities (map markers)
      selectLocalityCheckbox(locality);
      
      // Show filtered elements and sidebar
      toggleShowWhenFilteredElements(true);
      toggleSidebar('Left', true);
      
      setTimeout(() => window.isMarkerClick = false, 2000);
    };
    
    info.marker._element = newEl;
  });
}

// Optimized clustering with performance improvements
function getOrCreateCluster(center, count, coords) {
  const existing = state.clusterMarkers.find(c => 
    Math.sqrt((c.point.x - center.x) ** 2 + (c.point.y - center.y) ** 2) < OVERLAP_THRESHOLD / 2
  );
  
  if (existing) {
    existing.count += count;
    const num = existing.element.querySelector('#PlaceNum, [id*="PlaceNum"], .place-num') || 
                existing.element.querySelector('.text-block-82.number') ||
                existing.element.querySelector('div:not(.ClusterCopyWrap)') || 
                existing.element.querySelector('span');
    if (num) {
      num.textContent = existing.count;
      
      // Update the copy element to mirror the main PlaceNum
      const numCopy = existing.element.querySelector('#ClusterCopy');
      if (numCopy) {
        numCopy.textContent = existing.count;
      }
    }
    return existing;
  }
  
  let wrap = null;
  const originalWrap = $id('PlaceNumWrap');
  
  if (originalWrap) {
    wrap = originalWrap.cloneNode(true);
    wrap.removeAttribute('id');
    utils.applyFont(wrap);
    
    const num = wrap.querySelector('#PlaceNum') || 
                wrap.querySelector('[id*="PlaceNum"]') || 
                wrap.querySelector('.place-num') || 
                wrap.querySelector('.text-block-82.number') ||
                wrap.querySelector('div:not(.ClusterCopyWrap)') || 
                wrap.querySelector('span');
    
    if (num) {
      if (num.id) num.removeAttribute('id');
      num.textContent = count;
      
      // Update the copy element to mirror the main PlaceNum
      const numCopy = wrap.querySelector('#ClusterCopy');
      if (numCopy) {
        numCopy.textContent = count;
        numCopy.removeAttribute('id'); // Remove ID to avoid duplicates
      }
    }
  } else {
    wrap = document.createElement('div');
    wrap.style.cssText = `background: rgba(0,0,0,0.7); color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; font-family: ${MARKER_FONT};`;
    
    const num = document.createElement('div');
    num.textContent = count;
    wrap.appendChild(num);
  }
  
  wrap.classList.add('cluster-marker');
  const marker = new mapboxgl.Marker({element: wrap, anchor: 'center'}).setLngLat(coords).addTo(map);
  
  const cluster = {marker, element: wrap, count, point: center, coordinates: coords};
  state.clusterMarkers.push(cluster);
  return cluster;
}

// Optimized overlap checking
function checkOverlap() {
  if (state.flags.isRefreshButtonAction && map.isMoving()) return;
  
  const currentZoom = map.getZoom();
  const shouldShowMarkers = currentZoom >= (isMobile ? 8 : 9);
  
  if (!shouldShowMarkers) {
    [...state.allMarkers, ...state.clusterMarkers].forEach(info => {
      const element = info.marker?.getElement() || info.element;
      utils.setStyles(element, {transition: 'opacity 300ms ease', opacity: '0', pointerEvents: 'none'});
      setTimeout(() => element.style.opacity === '0' && utils.setStyles(element, {visibility: 'hidden', display: 'none'}), 300);
    });
    return;
  }
  
  if (state.allMarkers.length <= 1) return;
  
  const positions = state.allMarkers.map(info => ({
    ...info,
    point: map.project(info.marker.getLngLat()),
    element: info.marker.getElement(),
    visible: true,
    clustered: false
  }));
  
  const newClusters = [];
  const processedIndices = new Set();
  
  for (let i = 0; i < positions.length; i++) {
    if (processedIndices.has(i) || positions[i].element.classList.contains('filtered-out')) continue;
    
    const cluster = {markerIndices: [i], center: positions[i].point, coordinates: positions[i].coordinates};
    processedIndices.add(i);
    
    for (let j = i + 1; j < positions.length; j++) {
      if (processedIndices.has(j) || positions[j].element.classList.contains('filtered-out')) continue;
      
      const dist = Math.sqrt((positions[i].point.x - positions[j].point.x) ** 2 + (positions[i].point.y - positions[j].point.y) ** 2);
      if (dist < OVERLAP_THRESHOLD) {
        cluster.markerIndices.push(j);
        processedIndices.add(j);
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
  
  // Update clusters efficiently
  const updatedClusterIds = new Set();
  newClusters.forEach(newCluster => {
    const existingCluster = state.clusterMarkers.find(existing => {
      const dist = Math.sqrt((existing.point.x - newCluster.center.x) ** 2 + (existing.point.y - newCluster.center.y) ** 2);
      return dist < OVERLAP_THRESHOLD && !updatedClusterIds.has(existing.id);
    });
    
    if (existingCluster) {
      updatedClusterIds.add(existingCluster.id);
      Object.assign(existingCluster, {count: newCluster.count, coordinates: newCluster.coordinates, point: newCluster.center});
      
      const num = existingCluster.element.querySelector('#PlaceNum') ||
                  existingCluster.element.querySelector('[id*="PlaceNum"]') || 
                  existingCluster.element.querySelector('.place-num') ||
                  existingCluster.element.querySelector('.text-block-82.number') ||
                  existingCluster.element.querySelector('div:not(.ClusterCopyWrap)');
      if (num) {
        num.textContent = newCluster.count;
        
        // Update the copy element to mirror the main PlaceNum
        const numCopy = existingCluster.element.querySelector('#ClusterCopy');
        if (numCopy) {
          numCopy.textContent = newCluster.count;
        }
      }
      existingCluster.marker.setLngLat(newCluster.coordinates);
      utils.setStyles(existingCluster.element, {transition: 'opacity 300ms ease', opacity: '1', pointerEvents: 'auto'});
    } else {
      const clusterMarker = getOrCreateCluster(newCluster.center, newCluster.count, newCluster.coordinates);
      if (clusterMarker) {
        clusterMarker.id = `cluster-${Date.now()}-${Math.random()}`;
        updatedClusterIds.add(clusterMarker.id);
        utils.setStyles(clusterMarker.element, {transition: 'opacity 300ms ease', opacity: '0'});
        setTimeout(() => clusterMarker.element && (clusterMarker.element.style.opacity = '1'), 50);
      }
    }
  });
  
  // Clean up unused clusters
  state.clusterMarkers = state.clusterMarkers.filter(cluster => {
    if (!updatedClusterIds.has(cluster.id)) {
      utils.setStyles(cluster.element, {transition: 'opacity 300ms ease', opacity: '0'});
      setTimeout(() => cluster.marker.remove(), 300);
      return false;
    }
    return true;
  });
  
  // Set marker visibility efficiently
  positions.forEach(info => {
    if (state.flags.isInitialLoad && map.getZoom() < (isMobile ? 8 : 9)) return;
    
    const element = info.element;
    if (!info.visible || info.clustered) {
      utils.setStyles(element, {transition: 'opacity 300ms ease', opacity: '0', pointerEvents: 'none'});
      element.classList.add('marker-faded');
    } else {
      utils.setStyles(element, {display: 'block', visibility: 'visible', transition: 'opacity 300ms ease'});
      if (element.style.opacity === '0' || !element.style.opacity) {
        element.style.opacity = '0';
        element.offsetHeight;
        utils.setStyles(element, {opacity: '1', pointerEvents: 'auto'});
      } else {
        utils.setStyles(element, {opacity: '1', pointerEvents: 'auto'});
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
  
  const filterList = $1(`[fs-list-instance="${instance}"]`);
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

// Optimized filter application
function applyFilterToMarkers() {
  if (state.flags.isInitialLoad && !checkMapMarkersFiltering()) return;
  
  const filteredLat = $('.data-places-latitudes-filter');
  const filteredLon = $('.data-places-longitudes-filter');
  const allLat = $('.data-places-latitudes, .data-place-latitude');
  
  let visibleCoordinates = [];
  if (filteredLat.length && filteredLon.length && filteredLat.length < allLat.length) {
    visibleCoordinates = Array.from(filteredLat, (el, i) => {
      const lat = parseFloat(el.textContent.trim());
      const lon = parseFloat(filteredLon[i]?.textContent.trim());
      return !isNaN(lat) && !isNaN(lon) ? [lon, lat] : null;
    }).filter(Boolean);
  }
  
  const animationDuration = state.flags.isInitialLoad ? 600 : 1000;
  
  if (visibleCoordinates.length > 0) {
    const bounds = new mapboxgl.LngLatBounds();
    visibleCoordinates.forEach(coord => bounds.extend(coord));
    
    const newZoom = map.cameraForBounds(bounds, {
      padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15},
      maxZoom: 13
    }).zoom;
    
    if (newZoom > map.getZoom() + 1) {
      state.clusterMarkers.forEach(c => c.marker.remove());
      state.clusterMarkers = [];
      state.allMarkers.forEach(info => info.marker.getElement().classList.remove('marker-faded'));
    }
    
    map.fitBounds(bounds, {
      padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15},
      maxZoom: 13,
      duration: animationDuration,
      essential: true
    });
  } else {
    if (!state.flags.isInitialLoad || !checkMapMarkersFiltering()) {
      state.clusterMarkers.forEach(c => c.marker.remove());
      state.clusterMarkers = [];
      state.allMarkers.forEach(info => info.marker.getElement().classList.remove('marker-faded'));
      map.flyTo({center: [35.22, 31.85], zoom: isMobile ? 7.5 : 8.33, duration: animationDuration, essential: true});
    }
  }
  
  setTimeout(checkOverlap, animationDuration + 50);
}

const handleFilterUpdate = utils.debounce(() => {
  if (window.isLinkClick || window.isMarkerClick) return;
  state.flags.isRefreshButtonAction = true;
  applyFilterToMarkers();
  setTimeout(() => state.flags.isRefreshButtonAction = false, 1000);
}, 300);

// Custom tab switcher
function setupTabSwitcher() {
  const tabTriggers = $('[open-tab]');
  
  tabTriggers.forEach(trigger => {
    if (trigger.dataset.tabSwitcherSetup === 'true') return;
    
    trigger.addEventListener('click', function(e) {
      if (!this.hasAttribute('open-right-sidebar')) {
        e.preventDefault();
      }
      
      const groupName = this.getAttribute('open-tab');
      
      if (this.hasAttribute('open-right-sidebar')) {
        return;
      }
      
      const targetTab = $1(`[opened-tab="${groupName}"]`);
      if (targetTab) targetTab.click();
    });
    
    trigger.dataset.tabSwitcherSetup = 'true';
  });
}

// Consolidated controls setup with optimization
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
  
  // Optimized sidebar controls
  const setupSidebarControls = (selector, sidebarSide, eventType = 'click') => {
    $(selector).forEach(element => {
      const newElement = element.cloneNode(true);
      element.parentNode?.replaceChild(newElement, element);
      
      const handler = () => {
        const sidebar = $id(`${sidebarSide}Sidebar`);
        if (!sidebar) return;
        
        const openRightSidebar = newElement.getAttribute('open-right-sidebar');
        if (openRightSidebar === 'open-only') {
          toggleSidebar(sidebarSide, true);
        } else {
          toggleSidebar(sidebarSide, !sidebar.classList.contains('is-show'));
        }
        
        const groupName = newElement.getAttribute('open-tab');
        if (groupName) {
          setTimeout(() => $1(`[opened-tab="${groupName}"]`)?.click(), 50);
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
  
  setupTabSwitcher();
  setupAreaKeyControls();
}

// Optimized sidebar setup with performance improvements
function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = $id(`${side}Sidebar`);
    const tab = $id(`${side}SideTab`);
    const close = $id(`${side}SidebarClose`);
    
    if (!sidebar || !tab || !close) return false;
    if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
    
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
    
    if (!sidebar.dataset.clickSetup) {
      sidebar.addEventListener('click', () => {
        if (sidebar.classList.contains('is-show')) bringToFront();
      });
      sidebar.dataset.clickSetup = 'true';
    }
    
    if (tab.dataset.setupComplete !== 'true') {
      tab.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggle(!sidebar.classList.contains('is-show'));
      });
      tab.dataset.setupComplete = 'true';
    }
    
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
  
  const attemptSetup = (attempt = 1, maxAttempts = 5) => {
    const leftReady = setupSidebarElement('Left');
    const rightReady = setupSidebarElement('Right');
    
    if (leftReady && rightReady) {
      setupInitialMargins();
      setTimeout(setupControls, 100);
      return;
    }
    
    if (attempt < maxAttempts) {
      const delay = [100, 300, 500, 1000][attempt - 1] || 1000;
      setTimeout(() => attemptSetup(attempt + 1, maxAttempts), delay);
    } else {
      setupInitialMargins();
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
  
  attemptSetup();
}

// Optimized event setup with consolidated handlers
function setupEvents() {
  const eventHandlers = [
    {selector: '[data-auto-sidebar="true"]', events: ['change', 'input'], handler: () => {
      // Only open sidebar on devices wider than 478px
      if (window.innerWidth > 478) {
        setTimeout(() => toggleSidebar('Left', true), 100);
      }
    }},
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
  
  // Consolidated apply-map-filter setup
  $('[apply-map-filter="true"], #refreshDiv, #refresh-on-enter, .filterrefresh, #filter-button').forEach(element => {
    const newElement = element.cloneNode(true);
    if (element.parentNode) element.parentNode.replaceChild(newElement, element);
    
    const events = newElement.id === 'refresh-on-enter' || newElement.getAttribute('apply-map-filter') === 'true' 
      ? ['click', 'keypress', 'input'] : ['click'];
    
    events.forEach(eventType => {
      newElement.addEventListener(eventType, (e) => {
        if (eventType === 'keypress' && e.key !== 'Enter') return;
        if (window.isMarkerClick) return;
        
        e.preventDefault();
        
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        const delay = eventType === 'input' ? 300 : 100;
        
        setTimeout(() => {
          applyFilterToMarkers();
          setTimeout(() => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
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
          
          state.flags.forceFilteredReframe = true;
          state.flags.isRefreshButtonAction = true;
          
          setTimeout(() => {
            applyFilterToMarkers();
            setTimeout(() => {
              state.flags.forceFilteredReframe = false;
              state.flags.isRefreshButtonAction = false;
            }, 1000);
          }, 100);
          
          return false;
        }, true);
      }
    });
  }
  
  // Cluster and link click handlers
  document.onclick = e => {
    let target = e.target;
    while (target && !target.classList?.contains('cluster-marker')) target = target.parentElement;
    
    if (target) {
      const cluster = state.clusterMarkers.find(c => c.element === target);
      if (cluster) map.flyTo({center: cluster.coordinates, zoom: map.getZoom() + 2.5, duration: 800});
    }
  };
  
  $('a:not(.filterrefresh):not([fs-cmsfilter-element])').forEach(link => {
    link.onclick = () => {
      if (!link.closest('[fs-cmsfilter-element]') && !link.classList.contains('w-pagination-next') && !link.classList.contains('w-pagination-previous')) {
        window.isLinkClick = true;
        setTimeout(() => window.isLinkClick = false, 500);
      }
    };
  });
}

// Optimized dropdown listeners
function setupDropdownListeners() {
  if (state.flags.dropdownListenersSetup) return;
  state.flags.dropdownListenersSetup = true;
  
  $('[districtselect]').forEach(element => {
    element.addEventListener('click', (e) => {
      if (window.isMarkerClick) return;
      
      setTimeout(() => {
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        setTimeout(() => {
          applyFilterToMarkers();
          setTimeout(() => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, 100);
      }, 50);
    });
  });
  
  const selectField5 = $id('select-field-5');
  if (selectField5) {
    selectField5.addEventListener('change', (e) => {
      if (window.isMarkerClick) return;
      
      setTimeout(() => {
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        setTimeout(() => {
          applyFilterToMarkers();
          setTimeout(() => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, 100);
      }, 50);
    });
  }
}

// Optimized area overlays
function loadAreaOverlays() {
  const areas = [
    {name: 'Area A', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_a.geojson', sourceId: 'area-a-source', layerId: 'area-a-layer', color: '#98b074', opacity: 0.3},
    {name: 'Area B', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_b.geojson', sourceId: 'area-b-source', layerId: 'area-b-layer', color: '#a84b4b', opacity: 0.3},
    {name: 'Area C', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_c.geojson', sourceId: 'area-c-source', layerId: 'area-c-layer', color: '#e99797', opacity: 0.3}
  ];
  
  const addAreaToMap = area => {
    fetch(area.url)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(geojsonData => {
        if (map.getLayer(area.layerId)) map.removeLayer(area.layerId);
        if (map.getSource(area.sourceId)) map.removeSource(area.sourceId);
        
        map.addSource(area.sourceId, {type: 'geojson', data: geojsonData});
        map.addLayer({
          id: area.layerId,
          type: 'fill',
          source: area.sourceId,
          paint: {'fill-color': area.color, 'fill-opacity': area.opacity}
        });
      })
      .catch(() => {}); // Silent error handling
  };
  
  if (map.loaded()) areas.forEach(addAreaToMap);
  else map.on('load', () => areas.forEach(addAreaToMap));
}

// Optimized area key controls
function setupAreaKeyControls() {
  const areaControls = [
    {keyId: 'area-a-key', layerId: 'area-a-layer', wrapId: 'area-a-key-wrap'},
    {keyId: 'area-b-key', layerId: 'area-b-layer', wrapId: 'area-b-key-wrap'},
    {keyId: 'area-c-key', layerId: 'area-c-layer', wrapId: 'area-c-key-wrap'}
  ];
  
  areaControls.forEach(control => {
    const checkbox = $id(control.keyId);
    if (!checkbox) return;
    
    checkbox.checked = false;
    
    checkbox.addEventListener('change', () => {
      if (!map.getLayer(control.layerId)) return;
      const visibility = checkbox.checked ? 'none' : 'visible';
      map.setLayoutProperty(control.layerId, 'visibility', visibility);
    });
    
    // Find the wrapper element for hover events
    const wrapperDiv = $id(control.wrapId);
    
    if (wrapperDiv) {
      wrapperDiv.addEventListener('mouseenter', () => {
        if (!map.getLayer(control.layerId)) return;
        map.moveLayer(control.layerId);
        map.setPaintProperty(control.layerId, 'fill-opacity', 0.8);
      });
      
      wrapperDiv.addEventListener('mouseleave', () => {
        if (!map.getLayer(control.layerId)) return;
        map.setPaintProperty(control.layerId, 'fill-opacity', 0.3);
      });
    }
  });
}

// Optimized boundary loading
function loadBoundaries() {
  const districts = [
    'Jerusalem', 'Hebron', 'Tulkarm', 'Tubas', 'Salfit', 'Ramallah', 
    'Nablus', 'Jericho', 'Jenin', 'Bethlehem', 'Qalqilya'
  ];
  
  // Additional districts with custom URLs and names
  const customDistricts = [
    {name: 'East Jerusalem', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s0/east_jerusalem.json'},
    {name: 'Deir Al-Balah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Deir%20Al-Balah.geojson'},
    {name: 'Rafah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Rafah.geojson'},
    {name: 'North Gaza', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/North%20Gaza.geojson'},
    {name: 'Khan Younis', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Khan%20Younis.geojson'},
    {name: 'Gaza', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Gaza.geojson'}
  ];
  
  const addBoundaryToMap = (name, customUrl = null) => {
    const boundary = {
      name,
      url: customUrl || `https://raw.githubusercontent.com/Tovlim/COTO/main/${name}.geojson`,
      sourceId: `${name.toLowerCase().replace(/\s+/g, '-')}-boundary`,
      fillId: `${name.toLowerCase().replace(/\s+/g, '-')}-fill`,
      borderId: `${name.toLowerCase().replace(/\s+/g, '-')}-border`
    };
    
    fetch(boundary.url)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(geojsonData => {
        if (map.getSource(boundary.sourceId)) {
          [boundary.borderId, boundary.fillId].forEach(id => map.removeLayer(id));
          map.removeSource(boundary.sourceId);
        }
        
        map.addSource(boundary.sourceId, {type: 'geojson', data: geojsonData});
        map.addLayer({id: boundary.fillId, type: 'fill', source: boundary.sourceId, paint: {'fill-color': '#1a1b1e', 'fill-opacity': 0.25}});
        map.addLayer({id: boundary.borderId, type: 'line', source: boundary.sourceId, paint: {'line-color': '#1a1b1e', 'line-width': 2, 'line-opacity': 1}});
        
        const centroid = utils.calculateCentroid(geojsonData.features[0].geometry.coordinates);
        const originalWrap = $id('district-name-wrap');
        
        if (originalWrap) {
          const districtWrap = originalWrap.cloneNode(true);
          districtWrap.removeAttribute('id');
          districtWrap.className += ` district-${name.toLowerCase().replace(/\s+/g, '-')}`;
          districtWrap.style.zIndex = '1000';
          districtWrap.style.transition = TRANSITIONS.district;
          utils.applyFont(districtWrap);
          
          const nameElement = districtWrap.querySelector('#district-name');
          if (nameElement) {
            nameElement.textContent = name;
            nameElement.removeAttribute('id');
          }
          
          const marker = new mapboxgl.Marker({element: districtWrap, anchor: 'center'}).setLngLat(centroid).addTo(map);
          
          districtWrap.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            
            const currentTime = Date.now();
            
            // Global debounce - prevent any marker clicks within 1500ms
            if (currentTime - state.lastAnyMarkerClickTime < 1500) {
              return;
            }
            
            // Specific marker debounce - prevent same marker clicks within 2000ms
            const markerKey = `district-boundary-${name}`;
            if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 2000) {
              return;
            }
            
            state.lastClickedMarker = markerKey;
            state.lastClickTime = currentTime;
            state.lastAnyMarkerClickTime = currentTime;
            
            // Set marker click flag to prevent filter interference
            window.isMarkerClick = true;
            
            const nameEl = districtWrap.querySelector('.text-block-82:not(.number)');
            if (nameEl?.textContent.trim()) {
              // Use checkbox selection for boundary districts
              selectDistrictCheckbox(nameEl.textContent.trim());
            }
            
            // Show filtered elements and sidebar
            toggleShowWhenFilteredElements(true);
            toggleSidebar('Left', true);
            
            const bounds = new mapboxgl.LngLatBounds();
            const addCoords = coords => {
              if (Array.isArray(coords) && coords.length > 0) {
                if (typeof coords[0] === 'number') bounds.extend(coords);
                else coords.forEach(addCoords);
              }
            };
            
            geojsonData.features.forEach(feature => addCoords(feature.geometry.coordinates));
            map.fitBounds(bounds, {padding: 50, duration: 1000, essential: true});
            
            // Reset marker click flag after reframing
            setTimeout(() => window.isMarkerClick = false, 2200);
          });
          
          // Bidirectional hover effects
          districtWrap.addEventListener('mouseenter', () => {
            map.setPaintProperty(boundary.fillId, 'fill-color', '#e93119');
            map.setPaintProperty(boundary.borderId, 'line-color', '#e93119');
            if (map.getLayer(boundary.fillId)) map.moveLayer(boundary.fillId);
            if (map.getLayer(boundary.borderId)) map.moveLayer(boundary.borderId);
          });
          
          districtWrap.addEventListener('mouseleave', () => {
            map.setPaintProperty(boundary.fillId, 'fill-color', '#1a1b1e');
            map.setPaintProperty(boundary.borderId, 'line-color', '#1a1b1e');
          });
          
          state.districtMarkers.push({marker, element: districtWrap, name});
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
          
          const correspondingMarker = state.districtMarkers.find(marker => 
            marker.name.toLowerCase() === name.toLowerCase()
          );
          if (correspondingMarker?.element) {
            correspondingMarker.element.style.backgroundColor = '#fc4e37';
          }
        });
        
        map.on('mouseleave', boundary.fillId, () => {
          map.getCanvas().style.cursor = '';
          map.setPaintProperty(boundary.fillId, 'fill-color', '#1a1b1e');
          map.setPaintProperty(boundary.borderId, 'line-color', '#1a1b1e');
          
          const correspondingMarker = state.districtMarkers.find(marker => 
            marker.name.toLowerCase() === name.toLowerCase()
          );
          if (correspondingMarker?.element) {
            correspondingMarker.element.style.backgroundColor = '';
          }
        });
      })
      .catch(() => {}); // Silent error handling
  };
  
  const loadAllBoundaries = () => {
    // Load standard districts
    districts.forEach(name => addBoundaryToMap(name));
    
    // Load custom districts with specific URLs
    customDistricts.forEach(district => addBoundaryToMap(district.name, district.url));
  };
  
  if (map.loaded()) loadAllBoundaries();
  else map.on('load', loadAllBoundaries);
}

// Function to select district in dropdown
function selectDistrictInDropdown(districtName) {
  const selectField = $id('select-field-5');
  if (!selectField) return;
  
  // Set the select value first
  selectField.value = districtName;
  
  // Trigger change event on the select element
  utils.triggerEvent(selectField, ['change', 'input']);
  
  // Let Finsweet handle the visual updates by triggering their reload
  setTimeout(() => {
    if (window.fsAttributes?.selectcustom) {
      window.fsAttributes.selectcustom.reload();
    }
    if (window.fsAttributes?.cmsselect) {
      window.fsAttributes.cmsselect.reload();
    }
  }, 50);
  
  // Trigger form events
  const form = selectField.closest('form');
  if (form) {
    form.dispatchEvent(new Event('change', {bubbles: true}));
    form.dispatchEvent(new Event('input', {bubbles: true}));
  }
}

// Optimized district tags loading
function loadDistrictTags() {
  const districtTagCollection = $id('district-tag-collection');
  if (!districtTagCollection) return;
  
  const districtTagItems = districtTagCollection.querySelectorAll('#district-tag-item');
  
  districtTagItems.forEach(tagItem => {
    if (getComputedStyle(tagItem).display === 'none') return;
    
    const name = tagItem.getAttribute('district-tag-name');
    const lat = parseFloat(tagItem.getAttribute('district-tag-lattitude'));
    const lng = parseFloat(tagItem.getAttribute('district-tag-longitude'));
    
    if (!name || isNaN(lat) || isNaN(lng)) return;
    
    const originalWrap = $id('district-name-wrap');
    if (!originalWrap) return;
    
    const districtWrap = originalWrap.cloneNode(true);
    districtWrap.removeAttribute('id');
    districtWrap.className += ` district-tag-${name.toLowerCase().replace(/\s+/g, '-')}`;
    districtWrap.style.zIndex = '1000';
    districtWrap.style.transition = TRANSITIONS.district;
    utils.applyFont(districtWrap);
    
    const nameElement = districtWrap.querySelector('#district-name');
    if (nameElement) {
      nameElement.textContent = name;
      nameElement.removeAttribute('id');
    }
    
    const marker = new mapboxgl.Marker({element: districtWrap, anchor: 'center'}).setLngLat([lng, lat]).addTo(map);
    
    // Consolidated click handler for dual filtering
    districtWrap.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      
      const currentTime = Date.now();
      
      // Global debounce - prevent any marker clicks within 1500ms
      if (currentTime - state.lastAnyMarkerClickTime < 1500) {
        return;
      }
      
      // Specific marker debounce - prevent same marker clicks within 2000ms
      const markerKey = `district-tag-${name}`;
      if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 2000) {
        return;
      }
      
      state.lastClickedMarker = markerKey;
      state.lastClickTime = currentTime;
      state.lastAnyMarkerClickTime = currentTime;
      
      window.isMarkerClick = true;
      
      // Use checkbox selection for reports filtering
      selectDistrictCheckbox(name);
      
      // Select district in dropdown (instead of refresh-on-enter)
      selectDistrictInDropdown(name);
      
      // Show filtered elements and sidebar
      toggleShowWhenFilteredElements(true);
      toggleSidebar('Left', true);
      
      // Trigger map reframing
      setTimeout(() => {
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        applyFilterToMarkers();
        setTimeout(() => {
          state.flags.forceFilteredReframe = false;
          state.flags.isRefreshButtonAction = false;
        }, 1000);
      }, 200);
      
      setTimeout(() => window.isMarkerClick = false, 2000);
    });
    
    state.districtMarkers.push({marker, element: districtWrap, name});
  });
}

// Tag monitoring with optimized logic
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

// Optimized initialization
function init() {
  getLocationData();
  addCustomMarkers();
  setupEvents();
  
  const handleMapEvents = () => {
    clearTimeout(state.timers.overlap);
    state.timers.overlap = setTimeout(() => {
      handleZoomBasedVisibility();
      checkOverlap();
    }, 10);
  };
  
  map.on('moveend', handleMapEvents);
  map.on('zoomend', handleMapEvents);
  
  // Staggered setup with optimized timing
  [300, 1000, 3000].forEach(delay => setTimeout(setupMarkerClicks, delay));
  [1000, 3000].forEach(delay => setTimeout(setupDropdownListeners, delay));
  [500, 1500, 3000].forEach(delay => setTimeout(setupTabSwitcher, delay));
  
  state.flags.mapInitialized = true;
  setTimeout(() => {
    if (state.flags.isInitialLoad) {
      const hasFiltering = checkMapMarkersFiltering();
      if (hasFiltering) setTimeout(checkOverlap, 300);
      else setTimeout(checkOverlap, 300);
      state.flags.isInitialLoad = false;
    }
  }, 500);
}

// Control positioning and event setup
setTimeout(() => {
  const ctrl = $1('.mapboxgl-ctrl-top-right');
  if (ctrl) utils.setStyles(ctrl, {top: '4rem', right: '0.5rem', zIndex: '10'});
}, 500);

// Optimized event handlers
map.on("load", () => {
  try {
    init();
    loadAreaOverlays();
    loadBoundaries();
    setTimeout(loadDistrictTags, 500);
    setTimeout(setupAreaKeyControls, 1000);
    
    // Hide loading screen after everything is loaded
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-map-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
    }, 1500); // Give a small delay to ensure all components are ready
    
  } catch (error) {
    // Silent error handling - but still hide loading screen
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-map-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
    }, 2000);
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
    if (!state.allMarkers.length && map.loaded()) {
      try { init(); } catch (error) { /* Silent error handling */ }
    }
  }, 200);
  
  // Optimized retries with consolidated timing
  [1000, 2000, 3000].forEach(delay => setTimeout(loadDistrictTags, delay));
  [1500, 2500, 3500].forEach(delay => setTimeout(setupAreaKeyControls, delay));
  
  // Auto-trigger reframing with optimized logic
  const checkAndReframe = () => {
    if (map.loaded() && !map.isMoving() && checkMapMarkersFiltering()) {
      state.flags.forceFilteredReframe = true;
      state.flags.isRefreshButtonAction = true;
      applyFilterToMarkers();
      setTimeout(() => {
        state.flags.forceFilteredReframe = false;
        state.flags.isRefreshButtonAction = false;
      }, 1000);
      return true;
    }
    return false;
  };
  
  if (!checkAndReframe()) {
    setTimeout(() => !checkAndReframe() && setTimeout(checkAndReframe, 1000), 500);
  }
});

setTimeout(monitorTags, 1000);
