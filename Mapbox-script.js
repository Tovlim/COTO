// Initialize Mapbox
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
if (['ar', 'he'].includes(lang)) mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmbus40jb016n01s5dui12tre",
  center: [35.22, 31.85], // Start directly at West Bank
  zoom: isMobile() ? 7.5 : 8.33, // Less zoom on mobile
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

// Toggle sidebar visibility
const toggleSidebar = (side, show = null) => {
  const sidebar = $id(`${side}Sidebar`);
  if (!sidebar) return;
  
  const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
  sidebar.classList.toggle('is-show', isShowing);
  
  if (window.innerWidth > 478) {
    const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
    sidebar.style[`margin${side}`] = isShowing ? '0' : `-${currentWidth + 1}px`;
  } else {
    sidebar.style[`margin${side}`] = isShowing ? '0' : '';
    if (isShowing) toggleSidebar(side === 'Left' ? 'Right' : 'Left', false);
  }
  
  sidebar.style.pointerEvents = isShowing ? 'auto' : '';
  const arrowIcon = $1(`[arrow-icon="${side.toLowerCase()}"]`);
  if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
};

// Toggle filtered elements visibility
const toggleShowWhenFilteredElements = show => {
  $('[show-when-filtered="true"]').forEach(element => {
    Object.assign(element.style, {
      display: show ? 'block' : 'none',
      visibility: show ? 'visible' : 'hidden',
      opacity: show ? '1' : '0',
      pointerEvents: show ? 'auto' : 'none'
    });
  });
};

// Add debounce for zoom-based visibility
let zoomVisibilityTimeout;

// Handle district names and marker visibility based on zoom
function handleZoomBasedVisibility() {
  clearTimeout(zoomVisibilityTimeout);
  
  zoomVisibilityTimeout = setTimeout(() => {
    const currentZoom = map.getZoom();
    const shouldShowDistrictNames = currentZoom > 6;
    
    const stackLines = new Error().stack.split('\n').slice(1, 5).map(line => line.trim());
    console.log('🔍 handleZoomBasedVisibility called:', {
      currentZoom: currentZoom.toFixed(2),
      shouldShowDistrictNames,
      districtMarkersCount: districtMarkers.length,
      stackTrace: stackLines
    });
    
    if (districtMarkers.length === 0) {
      console.log('⚠️ No district markers found - they may not be loaded yet');
      return;
    }
    
    // District names visibility with proper fade transitions
    districtMarkers.forEach((districtMarker, index) => {
      const element = districtMarker.element;
      
      console.log(`📍 District ${districtMarker.name} (${index}):`, {
        shouldShow: shouldShowDistrictNames,
        currentOpacity: element.style.opacity,
        currentDisplay: element.style.display,
        currentVisibility: element.style.visibility
      });
      
      if (shouldShowDistrictNames) {
        console.log(`✅ Fading IN district: ${districtMarker.name}`);
        
        if (element.dataset.fadeOutId) {
          console.log(`🧹 Clearing fadeOutId for ${districtMarker.name}: ${element.dataset.fadeOutId}`);
          delete element.dataset.fadeOutId;
        }
        
        const isCurrentlyHidden = element.style.display === 'none' || 
                                  element.style.visibility === 'hidden' || 
                                  element.style.opacity === '0' || 
                                  !element.style.opacity;
        
        if (isCurrentlyHidden) {
          console.log(`🎭 Starting fade IN transition for: ${districtMarker.name} (was hidden)`);
          
          element.style.display = 'block';
          element.style.visibility = 'visible';
          element.style.transition = 'opacity 300ms ease';
          element.style.opacity = '0';
          element.style.pointerEvents = 'none';
          
          element.offsetHeight;
          
          element.style.opacity = '1';
          element.style.pointerEvents = 'auto';
          
          setTimeout(() => {
            console.log(`🔍 ${districtMarker.name} state after fade-in attempt:`, {
              opacity: element.style.opacity,
              display: element.style.display,
              visibility: element.style.visibility
            });
          }, 350);
          
        } else {
          console.log(`⭐ ${districtMarker.name} already visible, just ensuring full visibility.`);
          element.style.display = 'block';
          element.style.visibility = 'visible';
          element.style.opacity = '1';
          element.style.pointerEvents = 'auto';
        }
      } else {
        console.log(`❌ Fading OUT district: ${districtMarker.name} (zoom ${currentZoom.toFixed(2)} <= 6)`);
        element.style.transition = 'opacity 300ms ease';
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        
        const fadeOutId = Date.now() + Math.random();
        element.dataset.fadeOutId = fadeOutId;
        
        console.log(`⏰ Setting timeout for ${districtMarker.name} with fadeOutId: ${fadeOutId}`);
        
        setTimeout(() => {
          console.log(`🕒 Timeout fired for ${districtMarker.name}, fadeOutId: ${fadeOutId}, current fadeOutId: ${element.dataset.fadeOutId}, current opacity: ${element.style.opacity}`);
          
          if (element.dataset.fadeOutId === fadeOutId.toString() && element.style.opacity === '0') {
            console.log(`🚫 Actually hiding ${districtMarker.name}`);
            element.style.visibility = 'hidden';
            element.style.display = 'none';
            delete element.dataset.fadeOutId;
          } else {
            console.log(`⚠️ Not hiding ${districtMarker.name} - fadeOutId mismatch or opacity changed:`, {
              expectedFadeOutId: fadeOutId,
              currentFadeOutId: element.dataset.fadeOutId,
              currentOpacity: element.style.opacity
            });
          }
        }, 300);
      }
    });
  }, 50);
}

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
    
    // Start markers hidden on initial load
    const currentZoom = map.getZoom();
    // Mobile-friendly initial visibility check
    const shouldInitiallyShow = isMobile() ? currentZoom >= 7.5 : currentZoom >= 9;
    
    if (!shouldInitiallyShow || isInitialLoad) {
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
      console.log(`🚀 Creating marker for ${name} - initially hidden (zoom: ${currentZoom.toFixed(2)}, isInitialLoad: ${isInitialLoad}, mobile: ${isMobile()})`);
    } else {
      el.style.opacity = '1';
      el.style.visibility = 'visible';
      el.style.display = 'block';
      el.style.pointerEvents = 'auto';
      console.log(`🚀 Creating marker for ${name} - initially visible (zoom: ${currentZoom.toFixed(2)}, mobile: ${isMobile()})`);
    }
    
    el.style.transition = `opacity ${TRANSITION} ease`;
    
    Object.assign(el.dataset, {name, markerslug: slug, markerindex: index});
    const marker = new mapboxgl.Marker({element: el, anchor: 'bottom'}).setLngLat(coordinates).addTo(map);
    allMarkers.push({marker, name, slug, index, coordinates});
  });
  
  setupMarkerClicks();
  setTimeout(() => checkOverlap(), 100);
}

// Setup marker click handlers
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
      
      console.log('🗺️ Map marker clicked, using #hiddensearch');
      handleSearchTrigger(locality, 'hiddensearch');
    };
    
    info.marker._element = newEl;
  });
}

// Handle search trigger (reusable function)
function handleSearchTrigger(locality, targetField = 'hiddensearch') {
  window.isMarkerClick = true;
  
  console.log(`🎯 handleSearchTrigger called with locality: "${locality}", targetField: "${targetField}"`);
  
  // Determine the opposite field to clear
  const oppositeField = targetField === 'hiddensearch' ? 'hiddendistrict' : 'hiddensearch';
  
  // Clear the opposite field first
  const oppositeSearch = $id(oppositeField);
  if (oppositeSearch && oppositeSearch.value) {
    console.log(`🧹 Clearing ${oppositeField} (previous value: "${oppositeSearch.value}")`);
    oppositeSearch.value = '';
    triggerEvent(oppositeSearch, ['input', 'change', 'keyup']);
    
    const oppositeForm = oppositeSearch.closest('form');
    if (oppositeForm) oppositeForm.dispatchEvent(new Event('input', {bubbles: true}));
  }
  
  // Set the target field
  const search = $id(targetField);
  if (search) {
    console.log(`🔍 Setting ${targetField} to: "${locality}"`);
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
  } else {
    console.warn(`⚠️ Target field #${targetField} not found`);
  }
  
  toggleShowWhenFilteredElements(true);
  toggleSidebar('Left', true);
  setTimeout(() => window.isMarkerClick = false, 1000);
}

// Clustering logic
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
  
  console.log('🔄 checkOverlap called:', {
    currentZoom: map.getZoom().toFixed(2),
    allMarkersCount: allMarkers.length,
    existingClustersCount: clusterMarkers.length,
    isInitialLoad,
    isMobile: isMobile()
  });
  
  // Handle zoom-based visibility first
  const currentZoom = map.getZoom();
  // Mobile-friendly marker visibility - show markers earlier on mobile
  const shouldShowMarkers = isMobile() ? currentZoom >= 7.5 : currentZoom >= 9;
  
  console.log(`🔍 Zoom check: ${currentZoom.toFixed(2)} >= ${isMobile() ? '7.5' : '9'}? ${shouldShowMarkers} (mobile: ${isMobile()})`);
  
  if (!shouldShowMarkers) {
    console.log('❌ Zoom too low for markers, hiding all markers and exiting clustering');
    [...allMarkers, ...clusterMarkers].forEach(info => {
      const element = info.marker ? info.marker.getElement() : info.element;
      element.style.transition = 'opacity 300ms ease';
      element.style.opacity = '0';
      element.style.pointerEvents = 'none';
      
      setTimeout(() => {
        if (element.style.opacity === '0') {
          element.style.visibility = 'hidden';
          element.style.display = 'none';
        }
      }, 300);
    });
    return;
  }
  
  if (allMarkers.length <= 1) {
    console.log('⚠️ Not enough markers for clustering (need >1)');
    return;
  }
  
  console.log('🎯 Starting clustering logic...');
  
  const positions = allMarkers.map(info => ({
    ...info,
    point: map.project(info.marker.getLngLat()),
    element: info.marker.getElement(),
    visible: true,
    clustered: false,
    clusterId: null
  }));
  
  console.log('📊 Marker positions calculated:', positions.map(p => ({
    name: p.name,
    point: `${p.point.x.toFixed(1)}, ${p.point.y.toFixed(1)}`,
    filteredOut: p.element.classList.contains('filtered-out')
  })));
  
  const newClusters = [];
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].clustered || positions[i].element.classList.contains('filtered-out')) continue;
    
    const cluster = {markerIndices: [i], center: positions[i].point, coordinates: positions[i].coordinates, id: `cluster-${i}`};
    
    for (let j = 0; j < positions.length; j++) {
      if (i === j || positions[j].clustered || positions[j].element.classList.contains('filtered-out')) continue;
      
      const dist = Math.sqrt((positions[i].point.x - positions[j].point.x) ** 2 + (positions[i].point.y - positions[j].point.y) ** 2);
      if (dist < OVERLAP_THRESHOLD) {
        cluster.markerIndices.push(j);
        positions[j].clusterId = cluster.id;
        console.log(`🔗 Grouping ${positions[i].name} with ${positions[j].name} (distance: ${dist.toFixed(1)}px)`);
      }
    }
    
    if (cluster.markerIndices.length > 1) {
      cluster.markerIndices.forEach(idx => {
        positions[idx].clustered = true;
        positions[idx].visible = false;
        positions[idx].clusterId = cluster.id;
      });
      
      const sumX = cluster.markerIndices.reduce((sum, idx) => sum + positions[idx].point.x, 0);
      const sumY = cluster.markerIndices.reduce((sum, idx) => sum + positions[idx].point.y, 0);
      cluster.center = {x: sumX / cluster.markerIndices.length, y: sumY / cluster.markerIndices.length};
      cluster.coordinates = map.unproject(cluster.center);
      cluster.count = cluster.markerIndices.length;
      
      console.log(`✨ Created cluster with ${cluster.count} markers at ${cluster.center.x.toFixed(1)}, ${cluster.center.y.toFixed(1)}`);
      newClusters.push(cluster);
    }
  }
  
  console.log(`🎊 Clustering results: ${newClusters.length} clusters found`);
  
  const updatedClusterIds = new Set();
  
  newClusters.forEach(newCluster => {
    const existingCluster = clusterMarkers.find(existing => {
      const dist = Math.sqrt((existing.point.x - newCluster.center.x) ** 2 + (existing.point.y - newCluster.center.y) ** 2);
      return dist < OVERLAP_THRESHOLD && !updatedClusterIds.has(existing.id);
    });
    
    if (existingCluster) {
      console.log(`♻️ Updating existing cluster for ${newCluster.count} markers`);
      updatedClusterIds.add(existingCluster.id);
      existingCluster.count = newCluster.count;
      existingCluster.coordinates = newCluster.coordinates;
      existingCluster.point = newCluster.center;
      
      const num = existingCluster.element.querySelector('#PlaceNum') || existingCluster.element.querySelector('div');
      if (num) num.textContent = newCluster.count;
      
      existingCluster.marker.setLngLat(newCluster.coordinates);
      existingCluster.element.style.cssText += 'transition: opacity 300ms ease; opacity: 1; pointer-events: auto;';
    } else {
      console.log(`🆕 Creating new cluster for ${newCluster.count} markers`);
      const clusterMarker = getOrCreateCluster(newCluster.center, newCluster.count, newCluster.coordinates);
      if (clusterMarker) {
        clusterMarker.id = `new-cluster-${Date.now()}-${Math.random()}`;
        updatedClusterIds.add(clusterMarker.id);
        clusterMarker.element.style.cssText += 'transition: opacity 300ms ease; opacity: 0;';
        setTimeout(() => clusterMarker.element && (clusterMarker.element.style.opacity = '1'), 50);
      }
    }
  });
  
  clusterMarkers = clusterMarkers.filter(cluster => {
    if (!updatedClusterIds.has(cluster.id)) {
      cluster.element.style.cssText += 'transition: opacity 300ms ease; opacity: 0;';
      setTimeout(() => cluster.marker.remove(), 300);
      return false;
    }
    return true;
  });
  
  console.log('👁️ Setting individual marker visibility...');
  positions.forEach((info, idx) => {
    // Mobile-friendly skip check
    const mobileMinZoom = isMobile() ? 7.5 : 9;
    if (isInitialLoad && map.getZoom() < mobileMinZoom) {
      console.log(`⏸️ Skipping marker visibility for ${info.name} during initial load (zoom too low for ${isMobile() ? 'mobile' : 'desktop'})`);
      return;
    }
    
    const element = info.element;
    
    if (!info.visible || info.clustered) {
      element.style.transition = 'opacity 300ms ease';
      element.style.opacity = '0';
      element.style.pointerEvents = 'none';
      element.classList.add('marker-faded');
    } else {
      element.style.display = 'block';
      element.style.visibility = 'visible';
      element.style.transition = 'opacity 300ms ease';
      
      if (element.style.opacity === '0' || !element.style.opacity) {
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        element.offsetHeight;
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
      } else {
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
      }
      element.classList.remove('marker-faded');
    }
    
    console.log(`👁️ Marker ${info.name}: visible=${info.visible}, clustered=${info.clustered}, final opacity=${element.style.opacity}`);
  });
  
  console.log('✅ checkOverlap completed');
}

// Check if filtering is active
const checkFilterInstanceFiltering = () => {
  if (window.fsAttributes?.cmsfilter) {
    const filterInstance = window.fsAttributes.cmsfilter.getByInstance('Filter');
    if (filterInstance) {
      const activeFilters = filterInstance.filtersData;
      if (activeFilters && Object.keys(activeFilters).length > 0) return true;
      
      const renderedItems = filterInstance.listInstance.items.filter(item => !item.element.style.display || item.element.style.display !== 'none');
      if (renderedItems.length > 0 && renderedItems.length < filterInstance.listInstance.items.length) return true;
    }
  }
  
  const filterList = $('[fs-list-instance="Filter"]')[0];
  if (filterList) {
    const allItems = filterList.querySelectorAll('[fs-cmsfilter-element="list-item"]');
    const visibleItems = filterList.querySelectorAll('[fs-cmsfilter-element="list-item"]:not([style*="display: none"])');
    if (allItems.length > 0 && visibleItems.length > 0 && visibleItems.length < allItems.length) return true;
  }
  
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
};

const checkMapMarkersFiltering = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const hasMapMarkersURLFilter = Array.from(urlParams.keys()).some(key => 
    key.startsWith('mapmarkers_') || key.includes('mapmarkers') || key === 'district' || key === 'locality'
  );
  if (hasMapMarkersURLFilter) return true;
  
  if (window.fsAttributes?.cmsfilter) {
    const mapMarkersInstance = window.fsAttributes.cmsfilter.getByInstance('mapmarkers');
    if (mapMarkersInstance) {
      const activeFilters = mapMarkersInstance.filtersData;
      if (activeFilters && Object.keys(activeFilters).length > 0) return true;
      
      const renderedItems = mapMarkersInstance.listInstance.items.filter(item => !item.element.style.display || item.element.style.display !== 'none');
      if (renderedItems.length > 0 && renderedItems.length < mapMarkersInstance.listInstance.items.length) return true;
    }
  }
  
  const filteredLat = $('.data-places-latitudes-filter');
  const allLat = $('.data-places-latitudes, .data-place-latitude');
  if (filteredLat.length > 0 && filteredLat.length < allLat.length) return true;
  
  const mapMarkersList = $('[fs-list-instance="mapmarkers"]')[0];
  if (mapMarkersList) {
    const allItems = mapMarkersList.querySelectorAll('[fs-cmsfilter-element="list-item"]');
    const visibleItems = mapMarkersList.querySelectorAll('[fs-cmsfilter-element="list-item"]:not([style*="display: none"])');
    if (allItems.length > 0 && visibleItems.length > 0 && visibleItems.length < allItems.length) return true;
  }
  
  return false;
};

// Apply filter to markers
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
  
  const animationDuration = isInitialLoad ? 600 : 1000; // Consistent with district boundary transitions
  
  if (visibleCoordinates.length > 0) {
    console.log(`🗺️ Reframing to ${visibleCoordinates.length} filtered markers`);
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
    
    map.fitBounds(bounds, {
      padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15},
      maxZoom: 13,
      duration: animationDuration,
      essential: true
    });
  } else {
    console.log('🗺️ No filtered markers found, reframing to West Bank');
    const hasFiltering = checkMapMarkersFiltering();
    if (!isInitialLoad || !hasFiltering) {
      clusterMarkers.forEach(c => c.marker.remove());
      clusterMarkers = [];
      allMarkers.forEach(info => info.marker.getElement().classList.remove('marker-faded'));
      
      // Reframe to West Bank with smooth transition
      map.flyTo({
        center: [35.22, 31.85], 
        zoom: isMobile() ? 7.5 : 8.33, // Mobile-friendly zoom
        duration: animationDuration,
        essential: true
      });
    }
  }
  
  setTimeout(() => checkOverlap(), animationDuration + 50);
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

// Setup controls and event listeners
function setupControls() {
  const buttons = [
    {id: 'AllEvents', action: () => $id('ClearAll')?.click()},
    {id: 'ToggleLeft', action: () => {
      const leftSidebar = $id('LeftSidebar');
      if (leftSidebar) toggleSidebar('Left', !leftSidebar.classList.contains('is-show'));
    }}
  ];
  
  buttons.forEach(({id, action}) => {
    const btn = $id(id);
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        action();
      });
    }
  });
  
  $('[open-right-sidebar="true"]').forEach(element => {
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);
    
    newElement.addEventListener('click', e => {
      const rightSidebar = $id('RightSidebar');
      if (rightSidebar) toggleSidebar('Right', !rightSidebar.classList.contains('is-show'));
      
      const groupName = newElement.getAttribute('open-tab');
      if (groupName) {
        setTimeout(() => {
          const targetTab = document.querySelector(`[opened-tab="${groupName}"]`);
          if (targetTab) targetTab.click();
        }, 50);
      }
    });
  });
  
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
  const addResizeHandle = (sidebar, side) => {
    if (!sidebar || sidebar.querySelector('.sidebar-resize-handle')) return;
    
    const handle = document.createElement('div');
    handle.className = `sidebar-resize-handle ${side}-resize-handle`;
    sidebar.appendChild(handle);
    
    let isResizing = false, startX = 0, startWidth = 0;
    const minWidth = 500;
    
    const getMaxWidth = () => {
      const oppositeSide = side === 'left' ? 'right' : 'left';
      const oppositeSidebar = $id(`${oppositeSide.charAt(0).toUpperCase() + oppositeSide.slice(1)}Sidebar`);
      
      if (oppositeSidebar && oppositeSidebar.classList.contains('is-show')) {
        const oppositeWidth = parseInt(getComputedStyle(oppositeSidebar).width) || 300;
        return window.innerWidth - oppositeWidth - 100;
      }
      return window.innerWidth - 100;
    };
    
    const updateSidebarMargins = (newWidth) => {
      if (!sidebar.classList.contains('is-show')) {
        sidebar.style[`margin${side.charAt(0).toUpperCase() + side.slice(1)}`] = `-${newWidth}px`;
      }
    };
    
    const startResize = (e) => {
      if (window.innerWidth <= 478) return;
      
      isResizing = true;
      startX = e.clientX || e.touches?.[0]?.clientX;
      startWidth = parseInt(getComputedStyle(sidebar).width);
      
      handle.classList.add('resizing');
      document.body.classList.add('sidebar-resizing');
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    };
    
    const doResize = (e) => {
      if (!isResizing) return;
      
      const currentX = e.clientX || e.touches?.[0]?.clientX;
      let newWidth = side === 'left' ? startWidth + (currentX - startX) : startWidth - (currentX - startX);
      
      newWidth = Math.max(minWidth, Math.min(getMaxWidth(), newWidth));
      
      sidebar.style.width = sidebar.style.minWidth = sidebar.style.maxWidth = newWidth + 'px';
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
    
    ['mousedown', 'touchstart'].forEach(event => handle.addEventListener(event, startResize, { passive: false }));
    ['mousemove', 'touchmove'].forEach(event => document.addEventListener(event, doResize, { passive: false }));
    ['mouseup', 'touchend'].forEach(event => document.addEventListener(event, stopResize));
    
    const initialWidth = parseInt(getComputedStyle(sidebar).width) || 300;
    if (!sidebar.classList.contains('is-show')) {
      sidebar.style[`margin${side.charAt(0).toUpperCase() + side.slice(1)}`] = `-${initialWidth}px`;
    }
    
    window.addEventListener('resize', () => {
      const currentWidth = parseInt(getComputedStyle(sidebar).width);
      const maxWidth = getMaxWidth();
      if (currentWidth > maxWidth) {
        const newWidth = maxWidth;
        sidebar.style.width = sidebar.style.minWidth = sidebar.style.maxWidth = newWidth + 'px';
        updateSidebarMargins(newWidth);
      }
    });
  };
  
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
  
  setupInitialMargins();
  [100, 300, 500].forEach(delay => setTimeout(setupInitialMargins, delay));
  
  const checkAndSetupResize = () => {
    if (window.innerWidth > 991) setupSidebarResizing();
  };
  
  checkAndSetupResize();
  [100, 500].forEach(delay => setTimeout(checkAndSetupResize, delay));
  setTimeout(() => setupControls(), 200);
}

// Setup all event listeners
function setupEvents() {
  ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed'].forEach(event => {
    document.addEventListener(event, () => handleFilterUpdate());
  });
  
  $('[data-auto-sidebar="true"]').forEach(element => {
    const events = ['change', 'input'];
    if (['text', 'search', 'email', 'url'].includes(element.type)) events.push('keyup');
    
    events.forEach(eventType => {
      element.addEventListener(eventType, () => {
        setTimeout(() => toggleSidebar('Left', true), 100);
      });
    });
  });
  
  const refreshOnEnter = $id('refresh-on-enter');
  if (refreshOnEnter) {
    ['click', 'keypress', 'input'].forEach(eventType => {
      refreshOnEnter.addEventListener(eventType, (e) => {
        if (eventType === 'keypress' && e.key !== 'Enter') return;
        console.log(`🔄 refresh-on-enter ${eventType} triggered`);
        setTimeout(() => handleFilterUpdate(), eventType === 'input' ? 300 : 100);
      });
    });
  }
  
  $('select, [fs-cmsfilter-element="select"]').forEach(select => {
    select.addEventListener('change', () => setTimeout(() => handleFilterUpdate(), 100));
  });
  
  $('[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select').forEach(input => {
    input.addEventListener('change', () => setTimeout(() => handleFilterUpdate(), 100));
    if (['text', 'search'].includes(input.type)) {
      input.addEventListener('input', () => setTimeout(() => handleFilterUpdate(), 300));
    }
  });
  
  const search = $id('hiddensearch');
  if (search) {
    ['input', 'change', 'keyup'].forEach(event => {
      search.addEventListener(event, () => {
        window.isHiddenSearchActive = true;
        if (search.value.trim()) setTimeout(() => handleFilterUpdate(), 300);
        setTimeout(() => window.isHiddenSearchActive = false, 500);
      });
    });
  }
  
  [$id('refreshDiv'), $id('filter-button'), ...$('.filterrefresh')].forEach(button => {
    if (button) {
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      newButton.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`🔄 ${button.id || 'filter button'} clicked`);
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
  
  const selectField5 = $id('select-field-5');
  if (selectField5) {
    selectField5.addEventListener('change', () => setTimeout(() => handleFilterUpdate(), 100));
  }
  
  document.onclick = e => {
    let target = e.target;
    while (target && !target.classList?.contains('cluster-marker')) target = target.parentElement;
    
    if (target) {
      const cluster = clusterMarkers.find(c => c.element === target);
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

// Setup dropdown listeners
function setupDropdownListeners() {
  if (window.dropdownListenersSetup) return;
  window.dropdownListenersSetup = true;
  
  $('[districtselect]').forEach(element => {
    element.addEventListener('click', (e) => {
      if (window.isMarkerClick) return;
      
      console.log('🔄 districtselect clicked');
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
      
      console.log('🔄 select-field-5 changed');
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

// Monitor tags for filtering
function monitorTags() {
  const checkAndUpdateElements = () => {
    const hiddenTagParent = $id('hiddentagparent');
    const hasActiveTags = hiddenTagParent !== null;
    toggleShowWhenFilteredElements(hasActiveTags);
  };
  
  checkAndUpdateElements();
  
  const tagParent = $id('tagparent');
  if (tagParent) {
    const observer = new MutationObserver((mutations) => {
      let hiddenTagParentChanged = false;
      
      mutations.forEach(mutation => {
        const checkNodes = (nodes) => {
          return Array.from(nodes).some(node => {
            if (node.nodeType === 1) {
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
        setTimeout(checkAndUpdateElements, 50);
      }
    });
    
    observer.observe(tagParent, {childList: true, subtree: true});
  } else {
    setInterval(() => checkAndUpdateElements(), 1000);
  }
}

// Initial animation
function performInitialAnimation() {
  if (!isInitialLoad || !mapInitialized) return;
  
  const hasFiltering = checkMapMarkersFiltering();
  
  if (!hasFiltering) {
    // No initial animation needed - already starting at West Bank
    console.log('🎬 No filtering detected, staying at West Bank position');
    setTimeout(() => checkOverlap(), 300);
  } else {
    console.log('🎬 Filtering detected, applying filter reframing');
    setTimeout(() => checkOverlap(), 300);
  }
  
  isInitialLoad = false;
}

// Load boundaries and create district markers
function loadBoundaries() {
  const boundaries = [
    {name: 'Jerusalem', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Jerusalem.geojson', sourceId: 'jerusalem-boundary', fillId: 'jerusalem-fill', borderId: 'jerusalem-border'},
    {name: 'Hebron', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Hebron.geojson', sourceId: 'hebron-boundary', fillId: 'hebron-fill', borderId: 'hebron-border'},
    {name: 'Tulkarm', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Tulkarm.geojson', sourceId: 'tulkarm-boundary', fillId: 'tulkarm-fill', borderId: 'tulkarm-border'},
    {name: 'Tubas', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Tubas.geojson', sourceId: 'tubas-boundary', fillId: 'tubas-fill', borderId: 'tubas-border'},
    {name: 'Salfit', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Salfit.geojson', sourceId: 'salfit-boundary', fillId: 'salfit-fill', borderId: 'salfit-border'},
    {name: 'Ramallah', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Ramallah.geojson', sourceId: 'ramallah-boundary', fillId: 'ramallah-fill', borderId: 'ramallah-border'},
    {name: 'Nablus', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Nablus.geojson', sourceId: 'nablus-boundary', fillId: 'nablus-fill', borderId: 'nablus-border'},
    {name: 'Jericho', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Jericho.geojson', sourceId: 'jericho-boundary', fillId: 'jericho-fill', borderId: 'jericho-border'},
    {name: 'Jenin', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Jenin.geojson', sourceId: 'jenin-boundary', fillId: 'jenin-fill', borderId: 'jenin-border'},
    {name: 'Bethlehem', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Bethlehem.geojson', sourceId: 'bethlehem-boundary', fillId: 'bethlehem-fill', borderId: 'bethlehem-border'},
    {name: 'Qalqilya', url: 'https://raw.githubusercontent.com/Tovlim/COTO/main/Qalqilya.geojson', sourceId: 'qalqilya-boundary', fillId: 'qalqilya-fill', borderId: 'qalqilya-border'}
  ];
  
  const calculateCentroid = (coordinates) => {
    let totalLat = 0, totalLng = 0, pointCount = 0;
    
    const processCoords = (coords) => {
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
  
  const addBoundaryToMap = (boundary) => {
    fetch(boundary.url)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then(geojsonData => {
        if (map.getSource(boundary.sourceId)) {
          map.removeLayer(boundary.borderId);
          map.removeLayer(boundary.fillId);
          map.removeSource(boundary.sourceId);
        }
        
        map.addSource(boundary.sourceId, {type: 'geojson', data: geojsonData});
        
        map.addLayer({
          id: boundary.fillId,
          type: 'fill',
          source: boundary.sourceId,
          paint: {'fill-color': '#1a1b1e', 'fill-opacity': 0.25}
        });
        
        map.addLayer({
          id: boundary.borderId,
          type: 'line',
          source: boundary.sourceId,
          paint: {'line-color': '#1a1b1e', 'line-width': 2, 'line-opacity': 1}
        });
        
        const firstFeature = geojsonData.features[0];
        const centroid = calculateCentroid(firstFeature.geometry.coordinates);
        
        const originalDistrictWrap = $id('district-name-wrap');
        if (originalDistrictWrap) {
          const districtNameWrap = originalDistrictWrap.cloneNode(true);
          districtNameWrap.removeAttribute('id');
          districtNameWrap.className += ` district-${boundary.name.toLowerCase()}`;
          districtNameWrap.style.zIndex = '1000';
          
          const districtNameElement = districtNameWrap.querySelector('#district-name');
          if (districtNameElement) {
            districtNameElement.textContent = boundary.name;
            districtNameElement.removeAttribute('id');
          }
          
          const marker = new mapboxgl.Marker({element: districtNameWrap, anchor: 'center'}).setLngLat(centroid).addTo(map);
          
          districtNameWrap.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            console.log(`🎯 District name clicked: ${boundary.name}`);
            
            // First trigger the search functionality
            const districtNameTextElement = districtNameWrap.querySelector('.text-block-82:not(.number)');
            if (districtNameTextElement) {
              const districtName = districtNameTextElement.textContent.trim();
              if (districtName) {
                console.log('🏛️ District name clicked, using #hiddendistrict');
                handleSearchTrigger(districtName, 'hiddendistrict');
              }
            }
            
            // Then reframe to the district boundaries with smooth transition
            const bounds = new mapboxgl.LngLatBounds();
            
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
            
            console.log(`🗺️ Reframing to ${boundary.name} boundaries`);
            map.fitBounds(bounds, {
              padding: 50, 
              duration: 1000, // Same duration as boundary click
              essential: true
            });
          });
          
          districtMarkers.push({marker, element: districtNameWrap, name: boundary.name});
        }
        
        map.on('click', boundary.fillId, (e) => {
          const bounds = new mapboxgl.LngLatBounds();
          
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
      .catch(error => console.error(`Error loading ${boundary.name} boundary:`, error));
  };
  
  if (map.loaded()) {
    boundaries.forEach(boundary => addBoundaryToMap(boundary));
  } else {
    map.on('load', () => boundaries.forEach(boundary => addBoundaryToMap(boundary)));
  }
}

// Initialize everything
function init() {
  getLocationData();
  addCustomMarkers();
  setupEvents();
  
  map.on('moveend', () => {
    clearTimeout(overlapTimer);
    overlapTimer = setTimeout(() => {
      console.log('🎯 moveend event fired, calling handleZoomBasedVisibility and checkOverlap');
      handleZoomBasedVisibility();
      checkOverlap();
    }, 10);
  });
  map.on('zoomend', () => {
    clearTimeout(overlapTimer);
    overlapTimer = setTimeout(() => {
      console.log('🎯 zoomend event fired, calling handleZoomBasedVisibility and checkOverlap');
      handleZoomBasedVisibility();
      checkOverlap();
    }, 10);
  });
  
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
map.on("load", () => {
  try {
    init();
    loadBoundaries();
  } catch (error) {
    console.error('Error calling init() function:', error);
  }
});

document.addEventListener('DOMContentLoaded', () => setupSidebars());

window.addEventListener('load', () => {
  setupSidebars();
  setTimeout(() => {
    if (!allMarkers.length && map.loaded()) {
      try {
        init();
      } catch (error) {
        console.error('Error calling init() from window load:', error);
      }
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

// Start monitoring
setTimeout(() => monitorTags(), 1000);
