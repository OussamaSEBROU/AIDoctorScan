// ============================================================
//  Doctor AI Scan — Brain Tumor MRI Classification
//  Powered by Teachable Machine (TensorFlow.js)
// ============================================================

// ---- Configuration ----
const MODEL_URL = './tm-my-image-model/'; // Model folder path

// ---- State ----
let model = null;
let isModelLoaded = false;
let currentImageSrc = null;      // Data-URL of the current image
let cameraStream = null;         // MediaStream reference
let capturedFromCamera = false;

// ---- DOM References ----
const $loading        = document.getElementById('model-loading');
const $dropZone       = document.getElementById('drop-zone');
const $dropDefault    = document.getElementById('drop-default');
const $previewContainer = document.getElementById('preview-container');
const $previewImage   = document.getElementById('preview-image');
const $fileInput      = document.getElementById('file-input');
const $btnScan        = document.getElementById('btn-scan');
const $resultsContainer = document.getElementById('results-container');
const $cameraFeed     = document.getElementById('camera-feed');
const $cameraPlaceholder = document.getElementById('camera-placeholder');
const $btnStartCamera = document.getElementById('btn-start-camera');
const $btnCapture     = document.getElementById('btn-capture');
const $btnStopCamera  = document.getElementById('btn-stop-camera');
const $uploadArea     = document.getElementById('upload-area');
const $cameraArea     = document.getElementById('camera-area');
const $tabUpload      = document.getElementById('tab-upload');
const $tabCamera      = document.getElementById('tab-camera');

// ============================================================
//  1. Load the Teachable Machine Model
// ============================================================
async function loadModel() {
  try {
    const modelURL  = MODEL_URL + 'model.json';
    const metadataURL = MODEL_URL + 'metadata.json';
    model = await tmImage.load(modelURL, metadataURL);
    isModelLoaded = true;
    console.log('✅ Model loaded successfully!', model.getTotalClasses(), 'classes');

    // Hide overlay with smooth transition
    $loading.classList.add('hidden');
  } catch (err) {
    console.error('❌ Failed to load model:', err);
    $loading.querySelector('.loading-text').textContent = 'Failed to load model';
    $loading.querySelector('.loading-sub').textContent = 'Please make sure model files are in the correct folder.';
    $loading.querySelector('.loading-bar-track').style.display = 'none';
  }
}

// ============================================================
//  2. Tab Switching
// ============================================================
function switchTab(tab) {
  if (tab === 'upload') {
    $tabUpload.classList.add('active');
    $tabUpload.setAttribute('aria-selected', 'true');
    $tabCamera.classList.remove('active');
    $tabCamera.setAttribute('aria-selected', 'false');
    $uploadArea.style.display = 'block';
    $cameraArea.classList.remove('active');
    stopCamera();
  } else {
    $tabCamera.classList.add('active');
    $tabCamera.setAttribute('aria-selected', 'true');
    $tabUpload.classList.remove('active');
    $tabUpload.setAttribute('aria-selected', 'false');
    $uploadArea.style.display = 'none';
    $cameraArea.classList.add('active');
  }
}

// ============================================================
//  3. File Upload & Drag-and-Drop
// ============================================================
$fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

// Drag events
$dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  $dropZone.classList.add('drag-over');
});

$dropZone.addEventListener('dragleave', () => {
  $dropZone.classList.remove('drag-over');
});

$dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  $dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleFile(file);
  }
});

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    currentImageSrc = ev.target.result;
    capturedFromCamera = false;
    showPreview(currentImageSrc);
  };
  reader.readAsDataURL(file);
}

function showPreview(src) {
  $previewImage.src = src;
  $previewContainer.classList.add('visible');
  $dropDefault.style.display = 'none';
  $dropZone.classList.add('has-image');
  $btnScan.disabled = false;
  // Clear old results
  $resultsContainer.innerHTML = '';
}

function clearImage(e) {
  if (e) e.stopPropagation();
  currentImageSrc = null;
  capturedFromCamera = false;
  $previewImage.src = '';
  $previewContainer.classList.remove('visible');
  $dropDefault.style.display = '';
  $dropZone.classList.remove('has-image');
  $fileInput.value = '';
  $btnScan.disabled = true;
  $resultsContainer.innerHTML = '';
}

// ============================================================
//  4. Camera
// ============================================================
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    $cameraFeed.srcObject = cameraStream;
    $cameraFeed.classList.add('active');
    $cameraPlaceholder.style.display = 'none';
    $btnStartCamera.disabled = true;
    $btnCapture.disabled = false;
    $btnStopCamera.classList.remove('hidden');
  } catch (err) {
    console.error('Camera error:', err);
    alert('Could not access camera. Please check permissions.');
  }
}

function capturePhoto() {
  if (!cameraStream) return;

  const canvas = document.createElement('canvas');
  canvas.width = $cameraFeed.videoWidth;
  canvas.height = $cameraFeed.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage($cameraFeed, 0, 0);

  currentImageSrc = canvas.toDataURL('image/png');
  capturedFromCamera = true;

  // Switch to upload view to show preview
  switchTab('upload');
  showPreview(currentImageSrc);
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  $cameraFeed.classList.remove('active');
  $cameraFeed.srcObject = null;
  $cameraPlaceholder.style.display = '';
  $btnStartCamera.disabled = false;
  $btnCapture.disabled = true;
  $btnStopCamera.classList.add('hidden');
}

// ============================================================
//  5. Run Prediction
// ============================================================
async function runPrediction() {
  if (!isModelLoaded || !currentImageSrc) return;

  // UI: scanning state
  $btnScan.classList.add('scanning');
  $btnScan.disabled = true;
  $resultsContainer.innerHTML = '';

  try {
    // Create an offscreen image element for prediction
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = currentImageSrc;
    });

    // Predict
    const predictions = await model.predict(img);
    console.log('🔍 Predictions:', predictions);

    // Render results
    renderResults(predictions);

  } catch (err) {
    console.error('Prediction error:', err);
    $resultsContainer.innerHTML = `
      <div class="results-section">
        <div class="results-card">
          <div class="results-body">
            <div class="diagnosis-banner warning">
              <div class="diagnosis-icon">⚠️</div>
              <div class="diagnosis-text">
                <h3>Analysis Failed</h3>
                <p>${err.message || 'An error occurred during analysis. Please try again.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  } finally {
    $btnScan.classList.remove('scanning');
    $btnScan.disabled = false;
  }
}

// ============================================================
//  6. Render Results
// ============================================================
function renderResults(predictions) {
  // Sort by probability descending
  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
  const top = sorted[0];
  const topPct = (top.probability * 100).toFixed(1);

  // Determine diagnosis type
  let bannerClass, bannerIcon, bannerTitle, bannerDesc;

  if (top.className.toLowerCase().includes('yes') || top.className.toLowerCase().includes('tumor')) {
    if (!top.className.toLowerCase().includes('no')) {
      bannerClass = 'danger';
      bannerIcon = '🔴';
      bannerTitle = 'Tumor Detected';
      bannerDesc = `The AI model detected signs of a brain tumor with ${topPct}% confidence.`;
    } else {
      bannerClass = 'success';
      bannerIcon = '🟢';
      bannerTitle = 'No Tumor Detected';
      bannerDesc = `The MRI scan appears normal with ${topPct}% confidence.`;
    }
  } else if (top.className.toLowerCase().includes('no tumor') || top.className.toLowerCase().includes('no ')) {
    bannerClass = 'success';
    bannerIcon = '🟢';
    bannerTitle = 'No Tumor Detected';
    bannerDesc = `The MRI scan appears normal with ${topPct}% confidence.`;
  } else if (top.className.toLowerCase().includes('not mri') || top.className.toLowerCase().includes('not ')) {
    bannerClass = 'warning';
    bannerIcon = '⚠️';
    bannerTitle = 'Not an MRI Scan';
    bannerDesc = `The uploaded image doesn't appear to be a brain MRI scan (${topPct}% confidence).`;
  } else {
    bannerClass = 'warning';
    bannerIcon = 'ℹ️';
    bannerTitle = top.className;
    bannerDesc = `Detected with ${topPct}% confidence.`;
  }

  // Build prediction bars
  let barsHTML = '';
  sorted.forEach((pred) => {
    const pct = (pred.probability * 100).toFixed(1);
    let colorClass = 'warning';
    if (pred.className.toLowerCase().includes('yes') && !pred.className.toLowerCase().includes('no')) {
      colorClass = 'danger';
    } else if (pred.className.toLowerCase().includes('no tumor') || (pred.className.toLowerCase().includes('no ') && !pred.className.toLowerCase().includes('not '))) {
      colorClass = 'success';
    } else if (pred.className.toLowerCase().includes('not mri') || pred.className.toLowerCase().includes('not ')) {
      colorClass = 'warning';
    }

    // Friendly label
    let label = pred.className;
    if (label.toLowerCase().includes('yes')) label = '🔴 Tumor Detected';
    else if (label.toLowerCase().includes('no tumor')) label = '🟢 No Tumor';
    else if (label.toLowerCase().includes('not mri')) label = '⚠️ Not MRI Scan';

    barsHTML += `
      <div class="prediction-item">
        <div class="prediction-label-row">
          <span class="prediction-label">
            <span class="status-dot ${colorClass}"></span>
            ${label}
          </span>
          <span class="prediction-value ${colorClass}">${pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${colorClass}" style="width: 0%;" data-width="${pct}"></div>
        </div>
      </div>
    `;
  });

  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: 'numeric', month: 'short', year: 'numeric'
  });

  $resultsContainer.innerHTML = `
    <div class="results-section">
      <div class="results-card">
        <div class="results-header">
          <h2>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Analysis Results
          </h2>
          <span class="results-timestamp">${timestamp}</span>
        </div>
        <div class="results-body">
          <div class="diagnosis-banner ${bannerClass}">
            <div class="diagnosis-icon">${bannerIcon}</div>
            <div class="diagnosis-text">
              <h3>${bannerTitle}</h3>
              <p>${bannerDesc}</p>
            </div>
          </div>
          <div class="prediction-list">
            ${barsHTML}
          </div>
          <div class="results-disclaimer">
            <p>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <strong>Disclaimer:</strong> This tool is for educational and research purposes only. It is not a certified medical device and should not be used as a substitute for professional medical diagnosis. Always consult a qualified healthcare professional for medical advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Animate progress bars
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('.progress-fill[data-width]').forEach((bar) => {
        bar.style.width = bar.dataset.width + '%';
      });
    }, 100);
  });

  // Scroll to results
  $resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
//  7. Initialize
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadModel();
});
