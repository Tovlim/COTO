// Initialize Mapbox with cached elements and optimizations
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWE0d2F2cHcwYTYxMnFzNmJtanFhZzltIn0.diooYfncR44nF0Y8E1jvbw";
if (['ar', 'he'].includes(lang)) mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js");

const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/nitaihardy/cmbus40jb016n01s5dui12tre",
  center: [35.22, 31.85],
  zoom: isMobile ? 7.5 : 8.33,
  language: ['en','es','fr','de','zh','ja','ru','ar','he'].includes(lang) ? lang : 'en'
});

map.addControl(new mapboxgl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserHeading: true}));

// Global state and cached elements
let locationData = {type: "FeatureCollection", features: []};
let allMarkers = [], clusterMarkers = [], districtMarkers = [], overlapTimer, filterTimer;
let isInitialLoad = true, mapInitialized = false, forceFilteredReframe = false, isRefreshButtonAction = false;
window.isLinkClick = false;

const OVERLAP_THRESHOLD = 60, TRANSITION = "200ms";

// Cached DOM elements
const elements = {
  get hiddenSearch() { return this._hiddenSearch ||= document.getElementById('hiddensearch'); },
  get hiddenDistrict() { return this._hiddenDistrict ||= document.getElementById('hiddendistrict'); },
  get refreshOnEnter() { return this._refreshOnEnter ||= document.getElementById('refresh-on-enter'); },
  get leftSidebar() { return this._leftSidebar ||= document.getElementById('LeftSidebar'); },
  get rightSidebar() { return this._rightSidebar ||= document.getElementById('RightSidebar'); },
  get districtNameWrap() { return this._districtNameWrap ||= document.getElementById('district-name-wrap'); },
  get placeNumWrap() { return this._placeNumWrap ||= document.getElementById('PlaceNumWrap'); }
};

// Utilities
const $ = sel => { try { return [...document.querySelectorAll(sel)]; } catch(e) { return []; }};
const $1 = sel => { try { return document.querySelector(sel); } catch(e) { return null; }};
const triggerEvent = (el, events) => events.forEach(e => el.dispatchEvent(new Event(e, {bubbles: true})));
const setStyles = (el, styles) => Object.assign(el.style, styles);
const debounce = (fn, delay) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };

// Consolidated sidebar toggle
const toggleSidebar = (side, show = null) => {
  const sidebar = side === 'Left' ? elements.leftSidebar : elements.rightSidebar;
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

// Consolidated filtering display
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

// Optimized zoom-based visibility with single operation
const handleZoomBasedVisibility = debounce(() => {
  const shouldShow = map.getZoom() > 6;
  districtMarkers.forEach(({element}) => {
    if (shouldShow) {
      if (element.dataset.fadeOutId) delete element.dataset.fadeOutId;
      setStyles(element, {display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto', transition: 'opacity 300ms ease, background-color 0.3s ease'});
    } else {
      const fadeOutId = Date.now() + Math.random();
      element.dataset.fadeOutId = fadeOutId;
      setStyles(element, {opacity: '0', pointerEvents: 'none', transition: 'opacity 300ms ease, background-color 0.3s ease'});
      setTimeout(() => {
        if (element.dataset.fadeOutId === fadeOutId.toString() && element.style.opacity === '0') {
          setStyles(element, {visibility: 'hidden', display: 'none'});
          delete element.dataset.fadeOutId;
        }
      }, 300);
    }
  });
}, 50);

// Consolidated search trigger handler (CRITICAL - preserves dual filtering system)
function handleSearchTrigger(locality, targetField = 'hiddensearch') {
  window.isMarkerClick = true;
  console.log(`🎯 handleSearchTrigger: "${locality}", field: "${targetField}"`);
  
  const oppositeField = targetField === 'hiddensearch' ? 'hiddendistrict' : 'hiddensearch';
  const opposite = targetField === 'hiddensearch' ? elements.hiddenDistrict : elements.hiddenSearch;
  const target = targetField === 'hiddensearch' ? elements.hiddenSearch : elements.hiddenDistrict;
  
  // Clear opposite field
  if (opposite?.value) {
    opposite.value = '';
    triggerEvent(opposite, ['input', 'change', 'keyup']);
    opposite.closest('form')?.dispatchEvent(new Event('input', {bubbles: true}));
  }
  
  // Set target field
  if (target) {
    target.value = locality;
    triggerEvent(target, ['input', 'change', 'keyup']);
    target.closest('form')?.dispatchEvent(new Event('input', {bubbles: true}));
    
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

// Optimized location data extraction
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

// Streamlined marker creation
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
    
    const shouldShow = map.getZoom() >= 9 && !isInitialLoad;
    setStyles(el, {
      opacity: shouldShow ? '1' : '0',
      visibility: shouldShow ? 'visible' : 'hidden',
      display: shouldShow ? 'block' : 'none',
      pointerEvents: shouldShow ? 'auto' : 'none',
      transition: `opacity ${TRANSITION} ease`
    });
    
    Object.assign(el.dataset, {name, markerslug: slug, markerindex: index});
    
    // Add click handler directly
    el.onclick = e => {
      e.stopPropagation();
      e.preventDefault();
      const link = el.querySelector('[districtname]');
      const locality = link?.getAttribute('districtname');
      if (locality) handleSearchTrigger(locality, 'hiddensearch');
    };
    
    const marker = new mapboxgl.Marker({element: el, anchor: 'bottom'}).setLngLat(coordinates).addTo(map);
    allMarkers.push({marker, name, slug, index, coordinates});
  });
  
  setTimeout(checkOverlap, 100);
}

// Optimized clustering with spatial indexing concept
function checkOverlap() {
  if (isRefreshButtonAction && map.isMoving()) return;
  
  const currentZoom = map.getZoom();
  const shouldShowMarkers = currentZoom >= (isMobile ? 8 : 9);
  
  if (!shouldShowMarkers) {
    [...allMarkers, ...clusterMarkers].forEach(info => {
      const element = info.marker?.getElement() || info.element;
      setStyles(element, {transition: 'opacity 300ms ease', opacity: '0', pointerEvents: 'none'});
      setTimeout(() => element.style.opacity === '0' && setStyles(element, {visibility: 'hidden', display: 'none'}), 300);
    });
    return;
  }
  
  if (allMarkers.length <= 1) return;
  
  // Optimize position calculation and clustering
  const positions = allMarkers.map(info => ({
    ...info,
    point: map.project(info.marker.getLngLat()),
    element: info.marker.getElement(),
    visible: true,
    clustered: false
  }));
  
  // Improved clustering algorithm - process in spatial groups
  const clusters = [];
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].clustered || positions[i].element.classList.contains('filtered-out')) continue;
    
    const cluster = {indices: [i], center: positions[i].point, coordinates: positions[i].coordinates};
    
    // Only check nearby positions to reduce O(n²) complexity
    for (let j = i + 1; j < positions.length; j++) {
      if (positions[j].clustered || positions[j].element.classList.contains('filtered-out')) continue;
      
      const dist = Math.sqrt((positions[i].point.x - positions[j].point.x) ** 2 + (positions[i].point.y - positions[j].point.y) ** 2);
      if (dist < OVERLAP_THRESHOLD) {
        cluster.indices.push(j);
        positions[j].clustered = true;
      }
    }
    
    if (cluster.indices.length > 1) {
      positions[i].clustered = true;
      cluster.indices.forEach(idx => positions[idx].visible = false);
      
      // Calculate cluster center
      const sumX = cluster.indices.reduce((sum, idx) => sum + positions[idx].point.x, 0);
      const sumY = cluster.indices.reduce((sum, idx) => sum + positions[idx].point.y, 0);
      cluster.center = {x: sumX / cluster.indices.length, y: sumY / cluster.indices.length};
      cluster.coordinates = map.unproject(cluster.center);
      cluster.count = cluster.indices.length;
      
      clusters.push(cluster);
    }
  }
  
  // Update clusters efficiently
  const updatedIds = new Set();
  clusters.forEach(newCluster => {
    const existing = clusterMarkers.find(c => {
      const dist = Math.sqrt((c.point.x - newCluster.center.x) ** 2 + (c.point.y - newCluster.center.y) ** 2);
      return dist < OVERLAP_THRESHOLD / 2 && !updatedIds.has(c.id);
    });
    
    if (existing) {
      updatedIds.add(existing.id);
      Object.assign(existing, {count: newCluster.count, coordinates: newCluster.coordinates, point: newCluster.center});
      const num = existing.element.querySelector('#PlaceNum, [id*="PlaceNum"], .place-num, [class*="num"], div, span');
      if (num) num.textContent = newCluster.count;
      existing.marker.setLngLat(newCluster.coordinates);
    } else {
      const cluster = createCluster(newCluster.center, newCluster.count, newCluster.coordinates);
      if (cluster) {
        cluster.id = `cluster-${Date.now()}-${Math.random()}`;
        updatedIds.add(cluster.id);
      }
    }
  });
  
  // Remove unused clusters
  clusterMarkers = clusterMarkers.filter(cluster => {
    if (!updatedIds.has(cluster.id)) {
      cluster.marker.remove();
      return false;
    }
    return true;
  });
  
  // Set marker visibility
  positions.forEach(info => {
    const element = info.element;
    if (!info.visible || info.clustered) {
      setStyles(element, {opacity: '0', pointerEvents: 'none'});
      element.classList.add('marker-faded');
    } else {
      setStyles(element, {display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto'});
      element.classList.remove('marker-faded');
    }
  });
}

// Simplified cluster creation
function createCluster(center, count, coords) {
  const wrap = elements.placeNumWrap ? elements.placeNumWrap.cloneNode(true) : (() => {
    const div = document.createElement('div');
    div.style.cssText = 'background: rgba(0,0,0,0.7); color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold;';
    div.innerHTML = '<div></div>';
    return div;
  })();
  
  wrap.removeAttribute('id');
  wrap.classList.add('cluster-marker');
  
  const num = wrap.querySelector('#PlaceNum, [id*="PlaceNum"], .place-num, [class*="num"], div, span');
  if (num) {
    num.removeAttribute('id');
    num.textContent = count;
  }
  
  const marker = new mapboxgl.Marker({element: wrap, anchor: 'center'}).setLngLat(coords).addTo(map);
  
  // Add cluster click handler
  wrap.onclick = () => map.flyTo({center: coords, zoom: map.getZoom() + 2.5, duration: 800});
  
  const cluster = {marker, element: wrap, count, point: center, coordinates: coords};
  clusterMarkers.push(cluster);
  return cluster;
}

// Consolidated filtering logic
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

// Optimized filter application
function applyFilterToMarkers() {
  if (isInitialLoad && !checkFiltering('mapmarkers')) return;
  
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
    const bounds = new mapboxgl.LngLatBounds();
    visibleCoordinates.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds, {padding: {top: window.innerHeight * 0.15, bottom: window.innerHeight * 0.15, left: window.innerWidth * 0.15, right: window.innerWidth * 0.15}, maxZoom: 13, duration: animationDuration, essential: true});
  } else if (!isInitialLoad || !checkFiltering('mapmarkers')) {
    map.flyTo({center: [35.22, 31.85], zoom: 8.33, duration: animationDuration, essential: true});
  }
  
  setTimeout(checkOverlap, animationDuration + 50);
}

// Consolidated event setup
function setupAllEvents() {
  // Main map events
  const handleMapEvents = () => {
    clearTimeout(overlapTimer);
    overlapTimer = setTimeout(() => {
      handleZoomBasedVisibility();
      checkOverlap();
    }, 10);
  };
  
  map.on('moveend', handleMapEvents);
  map.on('zoomend', handleMapEvents);
  
  // Filter update handler
  const handleFilterUpdate = debounce(() => {
    if (window.isLinkClick || window.isMarkerClick || window.isHiddenSearchActive) return;
    isRefreshButtonAction = true;
    applyFilterToMarkers();
    setTimeout(() => isRefreshButtonAction = false, 1000);
  }, 300);
  
  // Setup various event handlers
  const eventSetups = [
    {selector: '[data-auto-sidebar="true"]', events: ['change', 'input'], handler: () => setTimeout(() => toggleSidebar('Left', true), 100)},
    {selector: 'select, [fs-cmsfilter-element="select"]', events: ['change'], handler: () => setTimeout(handleFilterUpdate, 100)},
    {selector: '[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select', events: ['change'], handler: () => setTimeout(handleFilterUpdate, 100)}
  ];
  
  eventSetups.forEach(({selector, events, handler}) => {
    $(selector).forEach(element => {
      events.forEach(event => element.addEventListener(event, handler));
    });
  });
  
  // Setup control buttons
  const setupControl = (id, action) => {
    const btn = document.getElementById(id);
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', e => {e.preventDefault(); e.stopPropagation(); action();});
    }
  };
  
  setupControl('AllEvents', () => document.getElementById('ClearAll')?.click());
  setupControl('ToggleLeft', () => toggleSidebar('Left', !elements.leftSidebar?.classList.contains('is-show')));
  
  // Global document events
  ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed'].forEach(event => {
    document.addEventListener(event, handleFilterUpdate);
  });
  
  // Hidden search setup
  if (elements.hiddenSearch) {
    ['input', 'change', 'keyup'].forEach(event => {
      elements.hiddenSearch.addEventListener(event, () => {
        window.isHiddenSearchActive = true;
        if (elements.hiddenSearch.value.trim()) {
          toggleShowWhenFilteredElements(true);
          toggleSidebar('Left', true);
        }
        setTimeout(() => window.isHiddenSearchActive = false, 500);
      });
    });
  }
}

// Parallel boundary loading (major optimization)
async function loadBoundaries() {
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
  
  // Load all boundaries in parallel
  const promises = boundaries.map(async boundary => {
    try {
      const response = await fetch(boundary.url);
      const geojsonData = await response.json();
      
      // Calculate centroid
      let totalLat = 0, totalLng = 0, pointCount = 0;
      const processCoords = coords => {
        if (Array.isArray(coords) && coords.length > 0) {
          if (typeof coords[0] === 'number') {
            totalLng += coords[0]; totalLat += coords[1]; pointCount++;
          } else coords.forEach(processCoords);
        }
      };
      processCoords(geojsonData.features[0].geometry.coordinates);
      const centroid = pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : [0, 0];
      
      return {boundary, geojsonData, centroid};
    } catch (error) {
      return null;
    }
  });
  
  const results = await Promise.all(promises);
  results.filter(Boolean).forEach(({boundary, geojsonData, centroid}) => {
    // Add to map
    if (map.getSource(boundary.sourceId)) {
      [boundary.borderId, boundary.fillId].forEach(id => map.removeLayer(id));
      map.removeSource(boundary.sourceId);
    }
    
    map.addSource(boundary.sourceId, {type: 'geojson', data: geojsonData});
    map.addLayer({id: boundary.fillId, type: 'fill', source: boundary.sourceId, paint: {'fill-color': '#1a1b1e', 'fill-opacity': 0.25}});
    map.addLayer({id: boundary.borderId, type: 'line', source: boundary.sourceId, paint: {'line-color': '#1a1b1e', 'line-width': 2, 'line-opacity': 1}});
    
    // Create district marker
    if (elements.districtNameWrap) {
      const districtWrap = elements.districtNameWrap.cloneNode(true);
      districtWrap.removeAttribute('id');
      districtWrap.className += ` district-${boundary.name.toLowerCase()}`;
      districtWrap.style.cssText += 'z-index: 1000; transition: opacity 300ms ease, background-color 0.3s ease;';
      
      const nameElement = districtWrap.querySelector('#district-name');
      if (nameElement) {
        nameElement.textContent = boundary.name;
        nameElement.removeAttribute('id');
      }
      
      const marker = new mapboxgl.Marker({element: districtWrap, anchor: 'center'}).setLngLat(centroid).addTo(map);
      
      // Event handlers
      districtWrap.onclick = e => {
        e.stopPropagation();
        e.preventDefault();
        const nameEl = districtWrap.querySelector('.text-block-82:not(.number)');
        if (nameEl) handleSearchTrigger(nameEl.textContent.trim(), 'hiddendistrict');
        
        const bounds = new mapboxgl.LngLatBounds();
        const addCoords = coords => {
          if (Array.isArray(coords) && coords.length > 0) {
            if (typeof coords[0] === 'number') bounds.extend(coords);
            else coords.forEach(addCoords);
          }
        };
        geojsonData.features.forEach(feature => addCoords(feature.geometry.coordinates));
        map.fitBounds(bounds, {padding: 50, duration: 1000, essential: true});
      };
      
      // Bidirectional hover effects
      const setHover = (isHover) => {
        const color = isHover ? '#e93119' : '#1a1b1e';
        map.setPaintProperty(boundary.fillId, 'fill-color', color);
        map.setPaintProperty(boundary.borderId, 'line-color', color);
        if (isHover) {
          if (map.getLayer(boundary.fillId)) map.moveLayer(boundary.fillId);
          if (map.getLayer(boundary.borderId)) map.moveLayer(boundary.borderId);
        }
        districtWrap.style.backgroundColor = isHover ? '#fc4e37' : '';
      };
      
      districtWrap.onmouseenter = () => setHover(true);
      districtWrap.onmouseleave = () => setHover(false);
      
      // Map boundary click - same as district name but only map filtering (no reports)
      map.on('click', boundary.fillId, () => {
        const nameEl = districtWrap.querySelector('.text-block-82:not(.number)');
        const districtName = nameEl?.textContent.trim();
        if (districtName) {
          window.isMarkerClick = true;
          
          // Clear hiddendistrict and hiddensearch
          if (elements.hiddenDistrict?.value) {
            elements.hiddenDistrict.value = '';
            triggerEvent(elements.hiddenDistrict, ['input', 'change', 'keyup']);
          }
          if (elements.hiddenSearch?.value) {
            elements.hiddenSearch.value = '';
            triggerEvent(elements.hiddenSearch, ['input', 'change', 'keyup']);
          }
          
          // Set only refresh-on-enter for map filtering (skip hiddendistrict for reports)
          if (elements.refreshOnEnter) {
            elements.refreshOnEnter.value = districtName;
            triggerEvent(elements.refreshOnEnter, ['input', 'change', 'keyup']);
            elements.refreshOnEnter.closest('form')?.dispatchEvent(new Event('input', {bubbles: true}));
          }
          
          setTimeout(() => {
            if (window.fsAttributes?.cmsfilter) window.fsAttributes.cmsfilter.reload();
            ['fs-cmsfilter-change', 'fs-cmsfilter-search'].forEach(type => 
              document.dispatchEvent(new CustomEvent(type, {bubbles: true, detail: {value: districtName}}))
            );
          }, 100);
          
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
        }
        
        // Also fit bounds to the district
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
      
      // Map boundary hover
      map.on('mouseenter', boundary.fillId, () => {
        map.getCanvas().style.cursor = 'pointer';
        setHover(true);
      });
      map.on('mouseleave', boundary.fillId, () => {
        map.getCanvas().style.cursor = '';
        setHover(false);
      });
      
      districtMarkers.push({marker, element: districtWrap, name: boundary.name});
    }
  });
}

// Simplified initialization with smart setup
function init() {
  getLocationData();
  addCustomMarkers();
  setupAllEvents();
  
  // Smart sidebar setup
  const setupSidebar = (side) => {
    const sidebar = side === 'Left' ? elements.leftSidebar : elements.rightSidebar;
    const tab = document.getElementById(`${side}SideTab`);
    const close = document.getElementById(`${side}SidebarClose`);
    
    if (!sidebar || !tab || !close || tab.dataset.setup === 'true') return;
    
    tab.onclick = e => { e.preventDefault(); toggleSidebar(side, !sidebar.classList.contains('is-show')); };
    close.onclick = e => { e.preventDefault(); toggleSidebar(side, false); };
    tab.dataset.setup = 'true';
    
    if (window.innerWidth > 478 && !sidebar.classList.contains('is-show')) {
      sidebar.style[`margin${side}`] = `-${parseInt(getComputedStyle(sidebar).width) || 300}px`;
    }
  };
  
  const attemptSidebarSetup = (attempt = 1) => {
    setupSidebar('Left');
    setupSidebar('Right');
    if (attempt < 3 && (!elements.leftSidebar || !elements.rightSidebar)) {
      setTimeout(() => attemptSidebarSetup(attempt + 1), 500);
    }
  };
  
  attemptSidebarSetup();
  mapInitialized = true;
  
  setTimeout(() => {
    if (isInitialLoad) {
      checkOverlap();
      isInitialLoad = false;
    }
  }, 500);
}

// Load area overlays and other features
const loadAreaOverlays = () => {
  const areas = [
    {name: 'Area A', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_a.geojson', id: 'area-a', color: '#98b074'},
    {name: 'Area B', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_b.geojson', id: 'area-b', color: '#a84b4b'},
    {name: 'Area C', url: 'https://raw.githubusercontent.com/btselem/map-data/master/s10/area_c.geojson', id: 'area-c', color: '#e99797'}
  ];
  
  areas.forEach(area => {
    fetch(area.url).then(r => r.json()).then(data => {
      const sourceId = `${area.id}-source`, layerId = `${area.id}-layer`;
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      
      map.addSource(sourceId, {type: 'geojson', data});
      map.addLayer({id: layerId, type: 'fill', source: sourceId, paint: {'fill-color': area.color, 'fill-opacity': 0.3}});
      
      // Setup area controls
      const checkbox = document.getElementById(`${area.id}-key`);
      if (checkbox) {
        checkbox.checked = false;
        checkbox.onchange = () => map.setLayoutProperty(layerId, 'visibility', checkbox.checked ? 'none' : 'visible');
        
        const checkboxDiv = checkbox.closest('label')?.querySelector('.w-checkbox-input.w-checkbox-input--inputType-custom.toggleable-map-key');
        if (checkboxDiv) {
          checkboxDiv.onmouseenter = () => {
            map.moveLayer(layerId);
            map.setPaintProperty(layerId, 'fill-opacity', 0.8);
          };
          checkboxDiv.onmouseleave = () => map.setPaintProperty(layerId, 'fill-opacity', 0.3);
        }
      }
    }).catch(() => {});
  });
};

// District tags loading
const loadDistrictTags = () => {
  const collection = document.getElementById('district-tag-collection');
  if (!collection) return;
  
  collection.querySelectorAll('#district-tag-item').forEach(item => {
    if (getComputedStyle(item).display === 'none') return;
    
    const name = item.getAttribute('district-tag-name');
    const lat = parseFloat(item.getAttribute('district-tag-lattitude'));
    const lng = parseFloat(item.getAttribute('district-tag-longitude'));
    
    if (!name || isNaN(lat) || isNaN(lng) || !elements.districtNameWrap) return;
    
    const wrap = elements.districtNameWrap.cloneNode(true);
    wrap.removeAttribute('id');
    wrap.style.cssText += 'z-index: 1000; transition: opacity 300ms ease, background-color 0.3s ease;';
    
    const nameEl = wrap.querySelector('#district-name');
    if (nameEl) {
      nameEl.textContent = name;
      nameEl.removeAttribute('id');
    }
    
    const marker = new mapboxgl.Marker({element: wrap, anchor: 'center'}).setLngLat([lng, lat]).addTo(map);
    
    wrap.onclick = e => {
      e.stopPropagation();
      e.preventDefault();
      
      // Set both fields for dual filtering
      if (elements.hiddenDistrict) {
        elements.hiddenDistrict.value = name;
        triggerEvent(elements.hiddenDistrict, ['input', 'change', 'keyup']);
      }
      if (elements.refreshOnEnter) {
        elements.refreshOnEnter.value = name;
        triggerEvent(elements.refreshOnEnter, ['input', 'change', 'keyup']);
      }
      
      setTimeout(() => {
        if (window.fsAttributes?.cmsfilter) window.fsAttributes.cmsfilter.reload();
        toggleShowWhenFilteredElements(true);
        toggleSidebar('Left', true);
        applyFilterToMarkers();
      }, 100);
    };
    
    districtMarkers.push({marker, element: wrap, name});
  });
};

// Main initialization
map.on("load", async () => {
  try {
    init();
    loadAreaOverlays();
    await loadBoundaries();
    setTimeout(loadDistrictTags, 500);
  } catch (error) {
    console.log('Initialization error:', error);
  }
});

// Setup retries for dynamic content
const retrySetups = () => {
  [500, 1500, 3000].forEach(delay => {
    setTimeout(loadDistrictTags, delay);
    setTimeout(() => {
      // Tab switcher for dynamic content
      $('[open-tab]').forEach(trigger => {
        if (trigger.dataset.tabSetup === 'true') return;
        trigger.onclick = function(e) {
          if (!this.hasAttribute('open-right-sidebar')) e.preventDefault();
          const groupName = this.getAttribute('open-tab');
          if (this.hasAttribute('open-right-sidebar')) return;
          document.querySelector(`[opened-tab="${groupName}"]`)?.click();
        };
        trigger.dataset.tabSetup = 'true';
      });
    }, delay);
  });
};

document.addEventListener('DOMContentLoaded', retrySetups);
window.addEventListener('load', retrySetups);

// Tag monitoring and final setups
setTimeout(() => {
  const checkTags = () => toggleShowWhenFilteredElements(document.getElementById('hiddentagparent') !== null);
  checkTags();
  const tagParent = document.getElementById('tagparent');
  if (tagParent) {
    new MutationObserver(() => setTimeout(checkTags, 50)).observe(tagParent, {childList: true, subtree: true});
  } else {
    setInterval(checkTags, 1000);
  }
}, 1000);
