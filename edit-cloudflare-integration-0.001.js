// Edit-Cloudflare Integration Script
// Ensures edit-report.js and cloudflare-add-report.js work together seamlessly
// Version: 1.0.0

(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    DEBUG: false,
    CLOUDFLARE_IMAGES_HASH: 'ubX9SHuSzRZ1mgZP7QLzCg',
    CLOUDFLARE_STREAM_DOMAIN: 'customer-yl8ull5om1gg5kc8.cloudflarestream.com'
  };
  
  // State management
  let isInitialized = false;
  let currentEditData = null;
  let mediaLoadedFromEdit = {
    images: [],
    videos: [],
    mainImage: null
  };
  
  // Utility functions
  const log = (...args) => {
    if (CONFIG.DEBUG) console.log('[Edit-Cloudflare Integration]', ...args);
  };
  
  // Wait for both scripts to be loaded
  function waitForScripts(callback) {
    let checkCount = 0;
    const maxChecks = 50;
    
    const checkScripts = () => {
      checkCount++;
      
      // Check if both scripts are loaded
      const editScriptReady = window.EditReportScript !== undefined;
      const cloudflareReady = document.querySelector('[cloudflare="video-upload"]') !== null;
      
      if (editScriptReady && cloudflareReady) {
        log('Both scripts are ready');
        callback();
      } else if (checkCount < maxChecks) {
        setTimeout(checkScripts, 100);
      } else {
        console.warn('Integration timeout - one or both scripts may not be loaded');
      }
    };
    
    checkScripts();
  }
  
  // Extract video ID from various URL formats
  function extractVideoId(url) {
    if (!url) return null;
    
    // Check for Cloudflare Stream URLs
    const patterns = [
      /\/([a-f0-9]{32})\//,  // Standard pattern
      /embed\/([a-f0-9]{32})/,  // Embed pattern
      /watch\/([a-f0-9]{32})/,  // Watch pattern
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }
  
  // Extract image ID from Cloudflare image URL
  function extractImageId(url) {
    if (!url) return null;
    
    // Pattern for Cloudflare Images
    const pattern = new RegExp(`imagedelivery\\.net/${CONFIG.CLOUDFLARE_IMAGES_HASH}/([^/]+)/`);
    const match = url.match(pattern);
    
    return match ? match[1] : null;
  }
  
  // Check if URL is a Cloudflare URL
  function isCloudflareUrl(url) {
    if (!url) return false;
    
    return url.includes('imagedelivery.net') || 
           url.includes('cloudflarestream.com') ||
           url.includes('customer-yl8ull5om1gg5kc8');
  }
  
  // Display existing media in Cloudflare preview areas and populate input fields
  function displayExistingMedia() {
    if (!currentEditData) return;
    
    log('Displaying existing media from edited report');
    
    // Handle images - first image goes to main-image, rest go to image-1, image-2, etc.
    if (currentEditData.images && currentEditData.images.length > 0) {
      // First image goes to main-image field
      const mainImageUrl = currentEditData.images[0];
      const mainImageField = document.querySelector('[cloudflare="main-image"]');
      if (mainImageField) {
        mainImageField.value = mainImageUrl;
        log('Set main-image field:', mainImageUrl);
      }
      displayMainImage(mainImageUrl);
      mediaLoadedFromEdit.mainImage = mainImageUrl;
      
      // Rest of images go to image-1, image-2, etc.
      for (let i = 1; i < currentEditData.images.length; i++) {
        const url = currentEditData.images[i];
        const imageField = document.querySelector(`[cloudflare="image-${i}"]`);
        if (imageField) {
          imageField.value = url;
          log(`Set image-${i} field:`, url);
        }
        displayImage(i, url); // Display at position i (which becomes i+1 in display)
        mediaLoadedFromEdit.images[i - 1] = url;
      }
    }
    
    // Handle videos - populate video-1, video-2, etc.
    if (currentEditData.videos && currentEditData.videos.length > 0) {
      currentEditData.videos.forEach((url, index) => {
        const position = index + 1;
        const videoField = document.querySelector(`[cloudflare="video-${position}"]`);
        if (videoField) {
          videoField.value = url;
          log(`Set video-${position} field:`, url);
        }
        displayVideo(position, url);
        mediaLoadedFromEdit.videos[index] = url;
      });
    }
    
    // Update upload counts after populating fields
    setTimeout(() => {
      updateUploadCounts();
    }, 100);
  }
  
  // Display main image
  function displayMainImage(url) {
    const imageEl = document.querySelector('[display-image="1"]');
    const wrapEl = document.querySelector('[display-image="wrap"]');
    
    if (imageEl && wrapEl) {
      imageEl.src = url;
      imageEl.style.display = 'block';
      wrapEl.style.display = 'grid';
      log('Displayed main image:', url);
    }
  }
  
  // Display regular image
  function displayImage(position, url) {
    const imageEl = document.querySelector(`[display-image="${position + 1}"]`);
    const wrapEl = document.querySelector('[display-image="wrap"]');
    
    if (imageEl && wrapEl) {
      imageEl.src = url;
      imageEl.style.display = 'block';
      wrapEl.style.display = 'grid';
      log(`Displayed image at position ${position}:`, url);
    }
  }
  
  // Display video with appropriate format
  function displayVideo(position, url) {
    const videoEl = document.querySelector(`[display-video="${position}"]`);
    const wrapEl = document.querySelector('[display-video="wrap"]');
    
    if (!videoEl || !wrapEl) return;
    
    // Clear existing content
    videoEl.innerHTML = '';
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      // YouTube video - display as iframe
      displayYouTubeVideo(videoEl, url);
    } else if (url.includes('vimeo.com')) {
      // Vimeo video - display as iframe
      displayVimeoVideo(videoEl, url);
    } else if (isCloudflareUrl(url)) {
      // Cloudflare Stream video - display thumbnail
      displayCloudflareVideo(videoEl, url);
    } else {
      // Unknown video type - display placeholder
      displayVideoPlaceholder(videoEl, url);
    }
    
    videoEl.style.display = 'block';
    wrapEl.style.display = 'grid';
    log(`Displayed video at position ${position}:`, url);
  }
  
  // Display YouTube video
  function displayYouTubeVideo(element, url) {
    // Extract YouTube video ID
    let videoId = '';
    if (url.includes('youtube.com/embed/')) {
      videoId = url.split('embed/')[1].split('?')[0];
    } else if (url.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(new URL(url).search);
      videoId = urlParams.get('v');
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    }
    
    if (videoId) {
      element.innerHTML = `
        <div style="position: relative; padding-top: 100%; height: 0; background: #000; overflow: hidden;">
          <iframe 
            src="https://www.youtube.com/embed/${videoId}"
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      `;
    }
  }
  
  // Display Vimeo video
  function displayVimeoVideo(element, url) {
    // Extract Vimeo video ID
    const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
    
    if (videoId) {
      element.innerHTML = `
        <div style="position: relative; padding-top: 100%; height: 0; background: #000; overflow: hidden;">
          <iframe 
            src="https://player.vimeo.com/video/${videoId}"
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
            frameborder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      `;
    }
  }
  
  // Display Cloudflare Stream video
  function displayCloudflareVideo(element, url) {
    const uid = extractVideoId(url);
    
    if (uid) {
      element.innerHTML = `
        <div style="position: relative; padding-top: 100%; height: 0; background: #000; overflow: hidden;">
          <img 
            src="https://${CONFIG.CLOUDFLARE_STREAM_DOMAIN}/${uid}/thumbnails/thumbnail.jpg?time=1s&height=600"
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;"
            alt="Video thumbnail"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #333;
            display: none;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
          ">Video Preview</div>
          <div style="
            position: absolute;
            bottom: 8px;
            left: 8px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
          ">Cloudflare Video</div>
        </div>
      `;
    }
  }
  
  // Display video placeholder
  function displayVideoPlaceholder(element, url) {
    element.innerHTML = `
      <div style="
        position: relative; 
        padding-top: 100%; 
        height: 0; 
        background: #333; 
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        ">
          <div style="font-size: 14px;">External Video</div>
          <div style="font-size: 10px; margin-top: 5px; opacity: 0.7;">Click to view</div>
        </div>
      </div>
    `;
  }
  
  // Enhanced field update tracking
  function setupFieldUpdateTracking() {
    // Track when Cloudflare script updates fields
    const originalUpdateTextInput = window.updateTextInput;
    if (typeof originalUpdateTextInput === 'function') {
      window.updateTextInput = function(type, position, url) {
        log(`Cloudflare updating ${type} at position ${position}`);
        
        // Call original function
        if (originalUpdateTextInput) {
          originalUpdateTextInput.apply(this, arguments);
        }
        
        // Update our tracking
        if (type === 'image') {
          mediaLoadedFromEdit.images[position - 1] = url;
        } else if (type === 'video') {
          mediaLoadedFromEdit.videos[position - 1] = url;
        }
      };
    }
  }
  
  // Override clear form to preserve non-media fields during media updates
  function setupSmartClear() {
    const originalClearForm = window.clearForm;
    
    // Create a smart clear that preserves non-media fields when uploading
    window.smartClearMediaOnly = function() {
      log('Smart clearing media fields only');
      
      // Clear only media-related fields
      const mediaSelectors = [
        '[cloudflare*="image"]',
        '[cloudflare*="video"]',
        '[cloudflare="main-image"]',
        '[data-report-image-1="input"]',
        '[data-report-image-2="input"]',
        '[data-report-image-3="input"]',
        '[data-report-video-1="input"]',
        '[data-report-video-2="input"]',
        '[data-report-video-3="input"]'
      ];
      
      mediaSelectors.forEach(selector => {
        const fields = document.querySelectorAll(selector);
        fields.forEach(field => {
          if (field.tagName.toLowerCase() === 'input') {
            field.value = '';
          }
        });
      });
    };
  }
  
  // Listen for edit button clicks to capture data
  function setupEditListener() {
    // Listen for edit button clicks
    document.body.addEventListener('click', function(e) {
      const editButton = e.target.closest('[edit-report="true"]');
      if (!editButton) return;
      
      // Wait a bit for edit-report.js to extract data
      setTimeout(() => {
        if (window.EditReportScript && window.EditReportScript.getCurrentReport) {
          currentEditData = window.EditReportScript.getCurrentReport();
          log('Captured edit data:', currentEditData);
          
          // Display existing media after form is populated
          setTimeout(() => {
            displayExistingMedia();
          }, 200);
        }
      }, 150);
    }, true);
  }
  
  // Update upload state counts based on loaded media
  function updateUploadCounts() {
    if (!window.uploadStates) {
      // Wait for uploadStates to be available
      setTimeout(() => updateUploadCounts(), 100);
      return;
    }
    
    // Count non-empty media fields
    let imageCount = 0;
    let videoCount = 0;
    let mainImageCount = 0;
    
    // Check main image
    const mainImageField = document.querySelector('[cloudflare="main-image"]');
    if (mainImageField && mainImageField.value) {
      mainImageCount = 1;
      // Also update the window.uploadStates for main-image
      window.uploadStates['main-image'].count = 1;
    }
    
    // Check regular images - count the highest numbered field with content
    let highestImageIndex = 0;
    for (let i = 1; i <= 14; i++) {
      const field = document.querySelector(`[cloudflare="image-${i}"]`);
      if (field && field.value) {
        highestImageIndex = i;
      }
    }
    imageCount = highestImageIndex;
    
    // Check videos - count the highest numbered field with content
    let highestVideoIndex = 0;
    for (let i = 1; i <= 5; i++) {
      const field = document.querySelector(`[cloudflare="video-${i}"]`);
      if (field && field.value) {
        highestVideoIndex = i;
      }
    }
    videoCount = highestVideoIndex;
    
    // Update states
    window.uploadStates.image.count = imageCount;
    window.uploadStates.video.count = videoCount;
    window.uploadStates['main-image'].count = mainImageCount;
    
    log('Updated upload counts:', {
      images: imageCount,
      videos: videoCount,
      mainImage: mainImageCount
    });
  }
  
  // Initialize integration
  function initialize() {
    if (isInitialized) return;
    
    log('Initializing Edit-Cloudflare Integration');
    
    waitForScripts(() => {
      setupEditListener();
      setupFieldUpdateTracking();
      setupSmartClear();
      
      // Update counts after a delay to ensure form is populated
      setTimeout(() => {
        updateUploadCounts();
      }, 1000);
      
      isInitialized = true;
      log('Integration initialized successfully');
    });
  }
  
  // Public API
  window.EditCloudflareIntegration = {
    getCurrentEditData: () => currentEditData,
    getMediaLoadedFromEdit: () => mediaLoadedFromEdit,
    displayExistingMedia,
    updateUploadCounts,
    setDebug: (enabled) => { CONFIG.DEBUG = enabled; }
  };
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
})();
