// Cloudflare Upload Integration Script
// Secure version with rate limiting and worker-only uploads

(function() {
  'use strict';
  
  // Configuration
  const WORKER_ENDPOINT = 'https://cloudflare-image-upload-purple-mud-4f7a.occupation-crimes.workers.dev';
  const CLOUDFLARE_IMAGES_HASH = 'ubX9SHuSzRZ1mgZP7QLzCg';
  
  // Max uploads configuration
  const MAX_VIDEOS = 5;
  const MAX_IMAGES = 14;
  const MAX_MAIN_IMAGES = 1;
  
  // Rate limiting configuration
  const RATE_LIMIT_MAX = 20; // uploads per minute
  const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
  let uploadTimestamps = [];
  
  // File type validation
  const ALLOWED_VIDEO_TYPES = [
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi',
    'video/webm', 'video/ogg', 'video/3gpp', 'video/x-ms-wmv'
  ];
  
  const ALLOWED_IMAGE_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
    'image/webp', 'image/svg+xml', 'image/bmp'
  ];
  
  // Upload state management
  let uploadStates = {
    video: { count: 0, uploading: false },
    image: { count: 0, uploading: false },
    'main-image': { count: 0, uploading: false }
  };
  
  // Rate limiting functions
  function checkRateLimit() {
    const now = Date.now();
    
    // Remove timestamps older than the window
    uploadTimestamps = uploadTimestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    // Check if we're at the limit
    if (uploadTimestamps.length >= RATE_LIMIT_MAX) {
      const oldestUpload = Math.min(...uploadTimestamps);
      const timeUntilReset = Math.ceil((RATE_LIMIT_WINDOW - (now - oldestUpload)) / 1000);
      return {
        allowed: false,
        timeUntilReset: timeUntilReset
      };
    }
    
    return { allowed: true };
  }
  
  function recordUpload() {
    uploadTimestamps.push(Date.now());
  }
  
  // Initialize when DOM is ready
  function init() {
    setupFileInputs();
    setupClickHandlers();
    setupIndividualControls();
  }
  
  // Create hidden file inputs and setup
  function setupFileInputs() {
    // Create video file input
    const videoInput = document.createElement('input');
    videoInput.type = 'file';
    videoInput.multiple = true;
    videoInput.accept = 'video/*';
    videoInput.style.display = 'none';
    videoInput.id = 'cloudflare-video-input';
    document.body.appendChild(videoInput);
    
    // Create image file input
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.multiple = true;
    imageInput.accept = 'image/*';
    imageInput.style.display = 'none';
    imageInput.id = 'cloudflare-image-input';
    document.body.appendChild(imageInput);
    
    // Create main image file input
    const mainImageInput = document.createElement('input');
    mainImageInput.type = 'file';
    mainImageInput.multiple = false;
    mainImageInput.accept = 'image/*';
    mainImageInput.style.display = 'none';
    mainImageInput.id = 'cloudflare-main-image-input';
    document.body.appendChild(mainImageInput);
    
    // Setup event listeners
    videoInput.addEventListener('change', function(e) {
      handleFileSelection(e.target.files, 'video');
    });
    
    imageInput.addEventListener('change', function(e) {
      handleFileSelection(e.target.files, 'image');
    });
    
    mainImageInput.addEventListener('change', function(e) {
      handleFileSelection(e.target.files, 'main-image');
    });
  }
  
  // Setup individual replace/remove controls for each slot
  function setupIndividualControls() {
    // Setup image controls (1-15, where 1 is main image)
    for (let i = 1; i <= 15; i++) {
      const imageEl = document.querySelector(`[display-image="${i}"]`);
      if (imageEl) {
        console.log(`Setting up controls for image ${i}`);
        addStaticImageControls(imageEl, i);
      } else {
        console.log(`Image element ${i} not found`);
      }
    }
    
    // Setup video controls (1-5)
    for (let i = 1; i <= MAX_VIDEOS; i++) {
      const videoEl = document.querySelector(`[display-video="${i}"]`);
      if (videoEl) {
        console.log(`Setting up controls for video ${i}`);
        addStaticVideoControls(videoEl, i);
      } else {
        console.log(`Video element ${i} not found`);
      }
    }
  }
  
  // Add static image controls that are always present
  function addStaticImageControls(imageEl, position) {
    // Create controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'media-controls';
    controlsDiv.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      display: none;
      gap: 5px;
      z-index: 10;
    `;
    
    // Replace button
    const replaceBtn = document.createElement('button');
    replaceBtn.textContent = 'Replace';
    replaceBtn.style.cssText = `
      background: #4285f4;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    replaceBtn.addEventListener('click', function(e) {
      e.preventDefault();
      replaceImageAtPosition(position);
    });
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.style.cssText = `
      background: #f44336;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    removeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      removeImageAtPosition(position);
    });
    
    controlsDiv.appendChild(replaceBtn);
    controlsDiv.appendChild(removeBtn);
    
    // Make image container relative for absolute positioning
    if (imageEl.parentNode) {
      imageEl.parentNode.style.position = 'relative';
      imageEl.parentNode.appendChild(controlsDiv);
    }
  }
  
  // Add static video controls that are always present
  function addStaticVideoControls(videoEl, position) {
    // Create controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'media-controls';
    controlsDiv.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      display: none;
      gap: 5px;
      z-index: 10;
    `;
    
    // Replace button
    const replaceBtn = document.createElement('button');
    replaceBtn.textContent = 'Replace';
    replaceBtn.style.cssText = `
      background: #4285f4;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    replaceBtn.addEventListener('click', function(e) {
      e.preventDefault();
      replaceVideoAtPosition(position);
    });
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.style.cssText = `
      background: #f44336;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    removeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      removeVideoAtPosition(position);
    });
    
    controlsDiv.appendChild(replaceBtn);
    controlsDiv.appendChild(removeBtn);
    
    // Make video container relative for absolute positioning
    videoEl.style.position = 'relative';
    videoEl.appendChild(controlsDiv);
  }
  
  // Setup click handlers for upload buttons
  function setupClickHandlers() {
    // Video upload button click handler
    const videoUploadButton = document.querySelector('[cloudflare="video-upload"]');
    if (videoUploadButton) {
      videoUploadButton.style.cursor = 'pointer';
      videoUploadButton.addEventListener('click', function(e) {
        e.preventDefault();
        if (!uploadStates.video.uploading && uploadStates.video.count < MAX_VIDEOS) {
          document.getElementById('cloudflare-video-input').click();
        } else if (uploadStates.video.count >= MAX_VIDEOS) {
          showError('video', `Maximum ${MAX_VIDEOS} videos allowed`);
        }
      });
    }
    
    // Image upload button click handler
    const imageUploadButton = document.querySelector('[cloudflare="image-upload"]');
    if (imageUploadButton) {
      imageUploadButton.style.cursor = 'pointer';
      imageUploadButton.addEventListener('click', function(e) {
        e.preventDefault();
        if (!uploadStates.image.uploading && uploadStates.image.count < MAX_IMAGES) {
          document.getElementById('cloudflare-image-input').click();
        } else if (uploadStates.image.count >= MAX_IMAGES) {
          showError('image', `Maximum ${MAX_IMAGES} images allowed`);
        }
      });
    }
    
    // Main image upload button click handler
    const mainImageUploadButton = document.querySelector('[cloudflare="main-image-upload"]');
    if (mainImageUploadButton) {
      mainImageUploadButton.style.cursor = 'pointer';
      mainImageUploadButton.addEventListener('click', function(e) {
        e.preventDefault();
        if (!uploadStates['main-image'].uploading) {
          // Allow replacement - reset count to 0 to allow new upload
          if (uploadStates['main-image'].count >= MAX_MAIN_IMAGES) {
            uploadStates['main-image'].count = 0;
          }
          document.getElementById('cloudflare-main-image-input').click();
        }
      });
    }
  }
  
  // Handle file selection and validation
  function handleFileSelection(files, type) {
    // Check rate limit first
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.allowed) {
      showError(type, `Upload rate limit exceeded. Try again in ${rateLimitCheck.timeUntilReset} seconds.`);
      return;
    }
    
    const validFiles = [];
    const invalidFiles = [];
    const allowedTypes = (type === 'video') ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
    let maxCount;
    
    // Determine max count based on type
    if (type === 'video') {
      maxCount = MAX_VIDEOS;
    } else if (type === 'main-image') {
      maxCount = MAX_MAIN_IMAGES;
    } else {
      maxCount = MAX_IMAGES;
    }
    
    // Check if we have space for new files
    const remainingSlots = maxCount - uploadStates[type].count;
    if (remainingSlots <= 0 && type !== 'main-image') {
      showError(type, `Maximum ${maxCount} ${type.replace('-', ' ')}${maxCount > 1 ? 's' : ''} already uploaded`);
      return;
    }
    
    Array.from(files).forEach((file, index) => {
      if (type === 'main-image' || index < remainingSlots) {
        if (allowedTypes.includes(file.type)) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file);
        }
      }
    });
    
    // Show validation errors
    if (invalidFiles.length > 0) {
      showError(type, `Invalid file types: ${invalidFiles.map(f => f.name).join(', ')}`);
    }
    
    // Show warning if too many files selected
    if (files.length > remainingSlots && type !== 'main-image') {
      const typeDisplay = type.replace('-', ' ');
      showError(type, `Only ${remainingSlots} more ${typeDisplay}(s) can be uploaded. ${files.length - remainingSlots} file(s) ignored.`);
    }
    
    // Start upload for valid files
    if (validFiles.length > 0) {
      startUpload(validFiles, type);
    }
  }
  
  // Start upload process
  async function startUpload(files, type) {
    uploadStates[type].uploading = true;
    
    // Determine which progress div to use
    let progressDiv;
    if (type === 'video') {
      progressDiv = document.querySelector('[cloudflare="video-progress"]');
    } else if (type === 'image' || type === 'main-image') {
      progressDiv = document.querySelector('[cloudflare="image-progress"]');
    }
    
    try {
      const uploadPromises = files.map((file, index) => uploadFile(file, type, index));
      const results = await Promise.allSettled(uploadPromises);
      
      // Process results
      const successfulUploads = [];
      const failedUploads = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulUploads.push(result.value);
        } else {
          failedUploads.push({ file: files[index], index, error: result.reason });
        }
      });
      
      // Update URLs in text inputs and display media
      if (successfulUploads.length > 0) {
        successfulUploads.forEach(upload => {
          uploadStates[type].count++;
          if (type === 'main-image') {
            updateMainImageTextInput(upload.url);
            displayMainImage(upload.url);
          } else {
            updateTextInput(type, uploadStates[type].count, upload.url);
            if (type === 'video') {
              displayVideo(uploadStates[type].count, upload.iframeUrl || upload.url);
            } else {
              displayImage(uploadStates[type].count, upload.url);
            }
          }
        });
      }
      
      // Show retry options for failed uploads
      if (failedUploads.length > 0) {
        showRetryOptions(failedUploads, type);
      }
      
      // Show completion message
      if (successfulUploads.length > 0) {
        const typeDisplay = type.replace('-', ' ');
        showSuccess(type, `${successfulUploads.length} ${typeDisplay}(s) uploaded successfully`);
      }
      
    } catch (error) {
      showError(type, 'Upload failed: ' + error.message);
    } finally {
      uploadStates[type].uploading = false;
    }
  }
  
  // Upload individual file
  async function uploadFile(file, type, index) {
    // Record this upload attempt for rate limiting
    recordUpload();
    
    // Determine which progress div to use
    let progressDiv;
    if (type === 'video') {
      progressDiv = document.querySelector('[cloudflare="video-progress"]');
    } else if (type === 'image' || type === 'main-image') {
      progressDiv = document.querySelector('[cloudflare="image-progress"]');
    }
    
    // Create progress element
    const progressElement = createProgressElement(file.name, index);
    if (progressDiv) {
      progressDiv.appendChild(progressElement);
    }
    
    try {
      // Get upload URL from worker
      const uploadData = await getUploadUrl(type);
      
      // Upload file
      const result = await uploadToCloudflare(file, uploadData, type, (progress) => {
        updateProgress(progressElement, progress);
      });
      
      // Mark as complete
      markProgressComplete(progressElement);
      
      return result;
      
    } catch (error) {
      markProgressError(progressElement, error.message);
      throw error;
    }
  }
  
  // Get upload URL from secure worker
  async function getUploadUrl(type) {
    try {
      // Check if user is authenticated
      const user = firebase.auth().currentUser;
      if (!user) {
        throw new Error('Please log in to upload files');
      }
      
      // Get Firebase auth token
      const idToken = await user.getIdToken();
      
      // Determine file type for worker
      const fileType = (type === 'video') ? 'video' : 'image';
      
      const response = await fetch(WORKER_ENDPOINT + '/get-upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          type: fileType,
          metadata: { source: "webflow_form", uploadType: type }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get upload URL');
      }
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      if (error.message.includes('log in')) {
        showError(type, error.message);
      }
      throw error;
    }
  }
  
  // Upload file to Cloudflare with progress tracking
  async function uploadToCloudflare(file, uploadData, type, onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });
      
      xhr.onload = function() {
        if (xhr.status === 200 || xhr.status === 201) {
          if (type === 'video') {
            // Handle video upload response
            handleVideoUploadResponse(uploadData, resolve, reject);
          } else {
            // Handle image upload response
            handleImageUploadResponse(xhr.responseText, uploadData, resolve, reject);
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = function() {
        reject(new Error('Network error during upload'));
      };
      
      xhr.open('POST', uploadData.uploadURL);
      xhr.send(formData);
    });
  }
  
  // Handle video upload response
  async function handleVideoUploadResponse(uploadData, resolve, reject) {
    try {
      // For videos, we'll store the watch URL in the text input but use iframe for display
      const watchUrl = `https://customer-yl8ull5om1gg5kc8.cloudflarestream.com/${uploadData.uid}/watch`;
      const iframeUrl = `https://customer-yl8ull5om1gg5kc8.cloudflarestream.com/${uploadData.uid}/iframe`;
      
      // Return both URLs - watch for form submission, iframe for display
      resolve({ 
        url: watchUrl, 
        iframeUrl: iframeUrl,
        response: { uid: uploadData.uid } 
      });
    } catch (error) {
      // Fallback URLs if any error occurs
      const watchUrl = `https://customer-yl8ull5om1gg5kc8.cloudflarestream.com/${uploadData.uid}/watch`;
      const iframeUrl = `https://customer-yl8ull5om1gg5kc8.cloudflarestream.com/${uploadData.uid}/iframe`;
      resolve({ 
        url: watchUrl, 
        iframeUrl: iframeUrl,
        response: { uid: uploadData.uid } 
      });
    }
  }
  
  // Handle image upload response
  function handleImageUploadResponse(responseText, uploadData, resolve, reject) {
    try {
      // Parse the upload response to get the actual image ID
      const response = JSON.parse(responseText);
      
      // Extract the actual image ID from the response
      let actualImageId;
      if (response.result && response.result.id) {
        actualImageId = response.result.id;
      } else if (response.id) {
        actualImageId = response.id;
      } else {
        actualImageId = uploadData.id;
      }
      
      const url = `https://imagedelivery.net/${CLOUDFLARE_IMAGES_HASH}/${actualImageId}/public`;
      resolve({ url, response: { id: actualImageId } });
      
    } catch (parseError) {
      // If parsing fails, try to extract ID from response text or use fallback
      let actualImageId = uploadData.id;
      
      const idMatch = responseText.match(/"id"\s*:\s*"([^"]+)"/);
      if (idMatch) {
        actualImageId = idMatch[1];
      }
      
      const url = `https://imagedelivery.net/${CLOUDFLARE_IMAGES_HASH}/${actualImageId}/public`;
      resolve({ url, response: { id: actualImageId } });
    }
  }
  
  // Create progress element
  function createProgressElement(fileName, index) {
    const div = document.createElement('div');
    div.className = 'upload-progress-item';
    div.style.cssText = `
      margin: 5px 0;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #f9f9f9;
    `;
    
    div.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">${fileName}</div>
      <div class="progress-bar" style="width: 100%; height: 10px; background: #e0e0e0; border-radius: 5px; overflow: hidden;">
        <div class="progress-fill" style="width: 0%; height: 100%; background: #4285f4; transition: width 0.3s;"></div>
      </div>
      <div class="progress-text" style="font-size: 12px; margin-top: 5px;">0%</div>
    `;
    
    return div;
  }
  
  // Update progress
  function updateProgress(element, percent) {
    const fill = element.querySelector('.progress-fill');
    const text = element.querySelector('.progress-text');
    
    if (fill) fill.style.width = percent + '%';
    if (text) text.textContent = Math.round(percent) + '%';
  }
  
  // Mark progress as complete
  function markProgressComplete(element) {
    const fill = element.querySelector('.progress-fill');
    const text = element.querySelector('.progress-text');
    
    if (fill) fill.style.background = '#4caf50';
    if (text) text.textContent = 'Complete ✓';
  }
  
  // Mark progress as error
  function markProgressError(element, error) {
    const fill = element.querySelector('.progress-fill');
    const text = element.querySelector('.progress-text');
    
    if (fill) fill.style.background = '#f44336';
    if (text) text.textContent = 'Error: ' + error;
  }
  
  // Update specific text input with URL
  function updateTextInput(type, position, url) {
    const textInput = document.querySelector(`[cloudflare="${type}-${position}"]`);
    if (textInput) {
      textInput.value = url;
    }
  }
  
  // Update main image text input
  function updateMainImageTextInput(url) {
    const textInput = document.querySelector('[cloudflare="main-image"]');
    if (textInput) {
      textInput.value = url;
    }
  }
  
  // Display main image
  function displayMainImage(url) {
    const imageEl = document.querySelector('[display-image="1"]');
    const wrapEl = document.querySelector('[display-image="wrap"]');
    
    if (imageEl && wrapEl) {
      imageEl.src = url;
      imageEl.style.display = 'block';
      wrapEl.style.display = 'grid';
      
      // Show controls for this image
      showImageControls(1);
    }
  }
  
  // Display regular image
  function displayImage(position, url) {
    const imageEl = document.querySelector(`[display-image="${position + 1}"]`); // +1 because main image is at position 1
    const wrapEl = document.querySelector('[display-image="wrap"]');
    
    if (imageEl && wrapEl) {
      imageEl.src = url;
      imageEl.style.display = 'block';
      wrapEl.style.display = 'grid';
      
      // Show controls for this image
      showImageControls(position + 1);
    }
  }
  
  // Display video with better error handling
  function displayVideo(position, url) {
    const videoEl = document.querySelector(`[display-video="${position}"]`);
    const wrapEl = document.querySelector('[display-video="wrap"]');
    
    if (videoEl && wrapEl) {
      const iframe = videoEl.querySelector('iframe');
      if (iframe) {
        // Clear any existing src first
        iframe.src = '';
        iframe.setAttribute('data-src', url);
        
        // Try setting the src with retries for video processing
        let retryCount = 0;
        const maxRetries = 5;
        
        const tryLoadVideo = () => {
          retryCount++;
          console.log(`Attempting to load video (attempt ${retryCount}): ${url}`);
          
          iframe.src = url;
          
          // Listen for load errors
          iframe.onerror = () => {
            if (retryCount < maxRetries) {
              console.log(`Video load failed, retrying in ${retryCount * 2} seconds...`);
              setTimeout(tryLoadVideo, retryCount * 2000); // Exponential backoff
            } else {
              console.log('Video failed to load after all retries');
              showVideoError(iframe, uploadData?.uid || 'unknown');
            }
          };
        };
        
        // Start first attempt after 3 seconds
        setTimeout(tryLoadVideo, 3000);
      }
      videoEl.style.display = 'block';
      wrapEl.style.display = 'grid';
      
      // Show controls for this video
      showVideoControls(position);
    }
  }
  
  // Show video error message
  function showVideoError(iframe, uid) {
    iframe.style.display = 'none';
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      background: #f5f5f5;
      color: #666;
      font-size: 14px;
      text-align: center;
      padding: 20px;
    `;
    errorDiv.innerHTML = `
      <div>
        <div>Video is still processing...</div>
        <div style="font-size: 12px; margin-top: 10px;">
          <button onclick="location.reload()" style="
            background: #4285f4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
          ">Refresh Page</button>
        </div>
      </div>
    `;
    
    iframe.parentNode.appendChild(errorDiv);
  }
  
  // Show image controls
  function showImageControls(position) {
    const imageEl = document.querySelector(`[display-image="${position}"]`);
    if (imageEl && imageEl.parentNode) {
      const controls = imageEl.parentNode.querySelector('.media-controls');
      if (controls) {
        controls.style.display = 'flex';
      }
    }
  }
  
  // Show video controls
  function showVideoControls(position) {
    const videoEl = document.querySelector(`[display-video="${position}"]`);
    if (videoEl) {
      const controls = videoEl.querySelector('.media-controls');
      if (controls) {
        controls.style.display = 'flex';
      }
    }
  }
  
  // Hide image controls
  function hideImageControls(position) {
    const imageEl = document.querySelector(`[display-image="${position}"]`);
    if (imageEl && imageEl.parentNode) {
      const controls = imageEl.parentNode.querySelector('.media-controls');
      if (controls) {
        controls.style.display = 'none';
      }
    }
  }
  
  // Hide video controls
  function hideVideoControls(position) {
    const videoEl = document.querySelector(`[display-video="${position}"]`);
    if (videoEl) {
      const controls = videoEl.querySelector('.media-controls');
      if (controls) {
        controls.style.display = 'none';
      }
    }
  }
  
  // Replace image at specific position
  function replaceImageAtPosition(position) {
    if (position === 1) {
      // Main image
      uploadStates['main-image'].count = 0;
      window.imageReplacePosition = 1;
      window.imageReplaceType = 'main-image';
      document.getElementById('cloudflare-main-image-input').click();
    } else {
      // Regular image
      window.imageReplacePosition = position;
      window.imageReplaceType = 'image';
      document.getElementById('cloudflare-image-input').click();
    }
  }
  
  // Replace video at specific position
  function replaceVideoAtPosition(position) {
    window.videoReplacePosition = position;
    document.getElementById('cloudflare-video-input').click();
  }
  
  // Remove image at specific position
  function removeImageAtPosition(position) {
    if (position === 1) {
      // Main image
      const imageEl = document.querySelector('[display-image="1"]');
      const textInput = document.querySelector('[cloudflare="main-image"]');
      
      if (imageEl) {
        imageEl.src = 'https://cdn.prod.website-files.com/plugins/Basic/assets/placeholder.60f9b1840c.svg';
        imageEl.style.display = 'none';
      }
      if (textInput) {
        textInput.value = '';
      }
      
      hideImageControls(1);
      uploadStates['main-image'].count = 0;
      
    } else {
      // Regular image
      const imageEl = document.querySelector(`[display-image="${position}"]`);
      const textInput = document.querySelector(`[cloudflare="image-${position - 1}"]`); // -1 because image inputs start from 1
      
      if (imageEl) {
        imageEl.src = 'https://cdn.prod.website-files.com/plugins/Basic/assets/placeholder.60f9b1840c.svg';
        imageEl.style.display = 'none';
      }
      if (textInput) {
        textInput.value = '';
      }
      
      hideImageControls(position);
      uploadStates.image.count = Math.max(0, uploadStates.image.count - 1);
    }
    
    checkAndHideImageWrap();
  }
  
  // Remove video at specific position
  function removeVideoAtPosition(position) {
    const videoEl = document.querySelector(`[display-video="${position}"]`);
    const textInput = document.querySelector(`[cloudflare="video-${position}"]`);
    
    if (videoEl) {
      const iframe = videoEl.querySelector('iframe');
      if (iframe) {
        iframe.setAttribute('data-src', '');
        iframe.src = '';
      }
      videoEl.style.display = 'none';
    }
    if (textInput) {
      textInput.value = '';
    }
    
    hideVideoControls(position);
    uploadStates.video.count = Math.max(0, uploadStates.video.count - 1);
    
    checkAndHideVideoWrap();
  }
  
  // Check if image wrap should be hidden
  function checkAndHideImageWrap() {
    const wrapEl = document.querySelector('[display-image="wrap"]');
    if (!wrapEl) return;
    
    // Check if any images are visible
    let hasVisibleImages = false;
    for (let i = 1; i <= 15; i++) {
      const imageEl = document.querySelector(`[display-image="${i}"]`);
      if (imageEl && imageEl.style.display === 'block') {
        hasVisibleImages = true;
        break;
      }
    }
    
    if (!hasVisibleImages) {
      wrapEl.style.display = 'none';
    }
  }
  
  // Check if video wrap should be hidden
  function checkAndHideVideoWrap() {
    const wrapEl = document.querySelector('[display-video="wrap"]');
    if (!wrapEl) return;
    
    // Check if any videos are visible
    let hasVisibleVideos = false;
    for (let i = 1; i <= MAX_VIDEOS; i++) {
      const videoEl = document.querySelector(`[display-video="${i}"]`);
      if (videoEl && videoEl.style.display === 'block') {
        hasVisibleVideos = true;
        break;
      }
    }
    
    if (!hasVisibleVideos) {
      wrapEl.style.display = 'none';
    }
  }
  
  // Show retry options for failed uploads
  function showRetryOptions(failedUploads, type) {
    // Determine which progress div to use
    let progressDiv;
    if (type === 'video') {
      progressDiv = document.querySelector('[cloudflare="video-progress"]');
    } else if (type === 'image' || type === 'main-image') {
      progressDiv = document.querySelector('[cloudflare="image-progress"]');
    }
    
    if (!progressDiv) return;
    
    failedUploads.forEach(failed => {
      const retryDiv = document.createElement('div');
      retryDiv.style.cssText = `
        margin: 5px 0;
        padding: 10px;
        border: 1px solid #f44336;
        border-radius: 4px;
        background: #ffebee;
      `;
      
      retryDiv.innerHTML = `
        <div style="color: #f44336; font-weight: bold;">${failed.file.name} - Upload Failed</div>
        <div style="font-size: 12px; margin: 5px 0;">${failed.error}</div>
        <button onclick="retryUpload('${type}', ${failed.index})" style="
          background: #f44336;
          color: white;
          border: none;
          padding: 5px 10px;
          border-radius: 3px;
          cursor: pointer;
        ">Retry Upload</button>
      `;
      
      progressDiv.appendChild(retryDiv);
    });
  }
  
  // Retry upload function (global for onclick)
  window.retryUpload = async function(type, index) {
    showError(type, 'Please select the file again to retry upload');
  };
  
  // Show success message
  function showSuccess(type, message) {
    // Determine which progress div to use
    let progressDiv;
    if (type === 'video') {
      progressDiv = document.querySelector('[cloudflare="video-progress"]');
    } else if (type === 'image' || type === 'main-image') {
      progressDiv = document.querySelector('[cloudflare="image-progress"]');
    }
    
    if (!progressDiv) return;
    
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
      margin: 5px 0;
      padding: 10px;
      border: 1px solid #4caf50;
      border-radius: 4px;
      background: #e8f5e8;
      color: #2e7d32;
    `;
    successDiv.textContent = message;
    
    progressDiv.appendChild(successDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 3000);
  }
  
  // Show error message
  function showError(type, message) {
    // Determine which progress div to use
    let progressDiv;
    if (type === 'video') {
      progressDiv = document.querySelector('[cloudflare="video-progress"]');
    } else if (type === 'image' || type === 'main-image') {
      progressDiv = document.querySelector('[cloudflare="image-progress"]');
    }
    
    if (!progressDiv) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      margin: 5px 0;
      padding: 10px;
      border: 1px solid #f44336;
      border-radius: 4px;
      background: #ffebee;
      color: #c62828;
    `;
    errorDiv.textContent = message;
    
    progressDiv.appendChild(errorDiv);
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
