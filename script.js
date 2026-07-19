// ================================================================
//  Doctor AI Scan — Brain Tumor MRI Classification
//  Teachable Machine (TF.js) · Background Loading · Medical Guidance
// ================================================================

const MODEL_PATH = './tm-my-image-model/';

// ---- State ----
let model       = null;
let modelReady  = false;
let imgSrc      = null;
let stream      = null;

// ---- DOM ----
const $status       = document.getElementById('model-status');
const $statusText   = document.getElementById('status-text');
const $dropzone     = document.getElementById('dropzone');
const $dzDefault    = document.getElementById('dz-default');
const $preview      = document.getElementById('preview');
const $previewImg   = document.getElementById('preview-img');
const $fileInput    = document.getElementById('file-input');
const $btnScan      = document.getElementById('btn-scan');
const $resultsBox   = document.getElementById('results-box');
const $camFeed      = document.getElementById('cam-feed');
const $camPh        = document.getElementById('cam-ph');
const $btnCamStart  = document.getElementById('btn-cam-start');
const $btnCapture   = document.getElementById('btn-capture');
const $btnCamStop   = document.getElementById('btn-cam-stop');
const $panelUpload  = document.getElementById('panel-upload');
const $panelCamera  = document.getElementById('panel-camera');
const $tabUpload    = document.getElementById('tab-upload');
const $tabCamera    = document.getElementById('tab-camera');

// ================================================================
//  1 · Load model in background (non-blocking)
// ================================================================
function waitForLibs() {
  return new Promise((resolve) => {
    const check = () => {
      if (typeof tmImage !== 'undefined' && typeof tf !== 'undefined') resolve();
      else setTimeout(check, 200);
    };
    check();
  });
}

async function loadModel() {
  try {
    await waitForLibs();
    model = await tmImage.load(MODEL_PATH + 'model.json', MODEL_PATH + 'metadata.json');
    modelReady = true;
    $status.classList.remove('loading');
    $status.classList.add('ready');
    $statusText.textContent = 'Ready';
    console.log('✅ Model loaded —', model.getTotalClasses(), 'classes');
  } catch (e) {
    console.error('❌ Model load error:', e);
    $statusText.textContent = 'Error';
    $status.style.background = '#FFF0F0';
    $status.style.color = '#E54D4D';
  }
}

// ================================================================
//  2 · Tabs
// ================================================================
function switchTab(t) {
  if (t === 'upload') {
    $tabUpload.classList.add('active'); $tabCamera.classList.remove('active');
    $panelUpload.classList.add('active'); $panelCamera.classList.remove('active');
    stopCamera();
  } else {
    $tabCamera.classList.add('active'); $tabUpload.classList.remove('active');
    $panelCamera.classList.add('active'); $panelUpload.classList.remove('active');
  }
}

// ================================================================
//  3 · File upload & drag-drop
// ================================================================
$fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

$dropzone.addEventListener('dragover', e => { e.preventDefault(); $dropzone.classList.add('drag'); });
$dropzone.addEventListener('dragleave', () => $dropzone.classList.remove('drag'));
$dropzone.addEventListener('drop', e => {
  e.preventDefault(); $dropzone.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) handleFile(f);
});

function handleFile(file) {
  const r = new FileReader();
  r.onload = ev => { imgSrc = ev.target.result; showPreview(imgSrc); };
  r.readAsDataURL(file);
}

function showPreview(src) {
  $previewImg.src = src;
  $preview.classList.add('show');
  $dzDefault.style.display = 'none';
  $dropzone.classList.add('has-img');
  $btnScan.disabled = !modelReady;
  $resultsBox.innerHTML = '';
}

function clearImage(e) {
  if (e) e.stopPropagation();
  imgSrc = null;
  $previewImg.src = '';
  $preview.classList.remove('show');
  $dzDefault.style.display = '';
  $dropzone.classList.remove('has-img');
  $fileInput.value = '';
  $btnScan.disabled = true;
  $resultsBox.innerHTML = '';
}

// ================================================================
//  4 · Camera
// ================================================================
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    $camFeed.srcObject = stream;
    $camFeed.classList.add('on');
    $camPh.style.display = 'none';
    $btnCamStart.disabled = true;
    $btnCapture.disabled = false;
    $btnCamStop.classList.remove('hidden');
  } catch (err) {
    alert('Cannot access camera — check permissions.');
  }
}

function capturePhoto() {
  if (!stream) return;
  const c = document.createElement('canvas');
  c.width = $camFeed.videoWidth; c.height = $camFeed.videoHeight;
  c.getContext('2d').drawImage($camFeed, 0, 0);
  imgSrc = c.toDataURL('image/png');
  switchTab('upload');
  showPreview(imgSrc);
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  $camFeed.classList.remove('on'); $camFeed.srcObject = null;
  $camPh.style.display = '';
  $btnCamStart.disabled = false; $btnCapture.disabled = true;
  $btnCamStop.classList.add('hidden');
}

// ================================================================
//  5 · Prediction
// ================================================================
async function runPrediction() {
  if (!modelReady) { alert('Model is still loading — please wait a few seconds.'); return; }
  if (!imgSrc) return;

  $btnScan.classList.add('busy');
  $btnScan.disabled = true;
  $resultsBox.innerHTML = '';

  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc; });
    const preds = await model.predict(img);
    renderResults(preds);
  } catch (err) {
    $resultsBox.innerHTML = errCard(err.message || 'Analysis failed — please try again.');
  } finally {
    $btnScan.classList.remove('busy');
    $btnScan.disabled = false;
  }
}

function errCard(msg) {
  return `<div class="results"><div class="res-card"><div class="res-body">
    <div class="dx-banner warn"><div class="dx-ico">⚠️</div>
    <div class="dx-txt"><h4>Error</h4><p>${msg}</p></div></div></div></div></div>`;
}

// ================================================================
//  6 · Render results + Medical Guidance
// ================================================================
function renderResults(preds) {
  const sorted = [...preds].sort((a, b) => b.probability - a.probability);
  const top = sorted[0];
  const pct = (top.probability * 100).toFixed(1);

  // Classify top result
  const cl = top.className.toLowerCase();
  let type; // 'tumor' | 'clear' | 'notmri'
  if (cl.includes('yes') && !cl.includes('no'))       type = 'tumor';
  else if (cl.includes('no tumor') || (cl.includes('no ') && !cl.includes('not '))) type = 'clear';
  else type = 'notmri';

  const banners = {
    tumor:  { c:'danger',  i:'🔴', t:'Tumor Indicators Detected',           d:`AI detected possible tumor signs with ${pct}% confidence.` },
    clear:  { c:'success', i:'🟢', t:'No Tumor Indicators Detected',        d:`MRI scan appears within normal range — ${pct}% confidence.` },
    notmri: { c:'warn',    i:'⚠️', t:'Image Does Not Appear to Be an MRI',  d:`The uploaded image may not be a brain MRI scan (${pct}% confidence).` },
  };
  const b = banners[type];

  // Build bars
  let barsHTML = '';
  sorted.forEach(p => {
    const v = (p.probability * 100).toFixed(1);
    const n = p.className.toLowerCase();
    let cc = 'warn', lbl = p.className;
    if (n.includes('yes') && !n.includes('no'))       { cc = 'danger';  lbl = '🔴 Tumor Detected'; }
    else if (n.includes('no tumor') || (n.includes('no ') && !n.includes('not '))) { cc = 'success'; lbl = '🟢 No Tumor'; }
    else if (n.includes('not '))                       { cc = 'warn';    lbl = '⚠️ Not MRI Scan'; }

    barsHTML += `
      <div class="bar-item">
        <div class="bar-row"><span class="bar-label"><span class="bar-dot ${cc}"></span>${lbl}</span><span class="bar-val ${cc}">${v}%</span></div>
        <div class="track"><div class="fill ${cc}" style="width:0%" data-w="${v}"></div></div>
      </div>`;
  });

  // Medical guidance
  const guidance = getMedicalGuidance(type, pct);

  // Timestamp
  const ts = new Date().toLocaleString('en-US', { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short', year:'numeric' });

  $resultsBox.innerHTML = `
    <div class="results">
      <div class="res-card">
        <div class="res-head">
          <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Analysis Results</h3>
          <span class="res-time">${ts}</span>
        </div>
        <div class="res-body">
          <div class="dx-banner ${b.c}">
            <div class="dx-ico">${b.i}</div>
            <div class="dx-txt"><h4>${b.t}</h4><p>${b.d}</p></div>
          </div>
          <div class="bars">${barsHTML}</div>

          <!-- Medical Guidance -->
          ${guidance}

          <!-- Professional Disclaimer -->
          <div class="disclaimer">
            <p><strong>⚕️ Important Medical Notice:</strong> Doctor AI Scan is a <strong>clinical decision support tool</strong> designed to assist qualified healthcare professionals in the preliminary screening of brain MRI scans. This system is <strong>not a substitute for professional medical diagnosis</strong>, clinical examination, or the judgment of a certified radiologist or neurologist. All results generated by this AI must be validated by a licensed physician before any clinical decisions are made. The developers bear no liability for decisions based solely on this tool's output. If you are a patient, please consult your attending physician for a comprehensive evaluation.</p>
          </div>
        </div>
      </div>
    </div>`;

  // Animate bars
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('.fill[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
    }, 80);
  });

  $resultsBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ================================================================
//  7 · Medical Guidance Generator
// ================================================================
function getMedicalGuidance(type, confidence) {
  if (type === 'tumor') {
    return `
    <div class="med-guide">
      <div class="med-guide-head">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        Medical Guidance — Tumor Indicators Detected
      </div>
      <div class="med-guide-body">
        <p>The AI analysis has identified <strong>potential indicators consistent with the presence of a brain tumor</strong> in this MRI scan with a confidence level of <strong>${confidence}%</strong>. Based on this preliminary finding, the following clinical steps are recommended:</p>

        <ul>
          <li><strong>Urgent Radiological Review:</strong> This scan should be reviewed immediately by a board-certified <strong>neuroradiologist</strong> for a detailed interpretation, including assessment of tumor size, location, morphology, and potential grade classification.</li>
          <li><strong>Contrast-Enhanced MRI:</strong> If this scan was performed without gadolinium contrast, a <strong>contrast-enhanced MRI (CE-MRI)</strong> is strongly recommended to better delineate tumor margins, evaluate blood-brain barrier integrity, and assess enhancement patterns.</li>
          <li><strong>Neurology Consultation:</strong> The patient should be referred to a <strong>neurologist or neurosurgeon</strong> for a comprehensive clinical evaluation, including detailed neurological examination and symptom assessment.</li>
          <li><strong>Advanced Imaging:</strong> Consider additional imaging modalities such as <strong>MR Spectroscopy (MRS)</strong>, <strong>Perfusion MRI</strong>, or <strong>PET-CT</strong> for further characterization of the lesion and differentiation between tumor subtypes.</li>
          <li><strong>Histopathological Confirmation:</strong> Definitive diagnosis requires <strong>tissue biopsy and histopathological analysis</strong>. A stereotactic biopsy or surgical resection may be indicated depending on the lesion's characteristics and accessibility.</li>
          <li><strong>Multidisciplinary Tumor Board:</strong> Present the case to a <strong>multidisciplinary tumor board</strong> (radiology, neurosurgery, oncology, pathology) for consensus on the optimal management plan.</li>
        </ul>

        <p><strong>Note for the Patient:</strong> This AI finding is a <em>preliminary screening result</em>, not a confirmed diagnosis. Many lesions detected on MRI may be benign or represent non-neoplastic conditions. Only your physician, after a thorough evaluation, can determine the actual nature of any findings.</p>
      </div>
    </div>`;
  }

  if (type === 'clear') {
    return `
    <div class="med-guide">
      <div class="med-guide-head">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        Medical Guidance — Normal Screening Result
      </div>
      <div class="med-guide-body">
        <p>The AI analysis indicates <strong>no significant tumor indicators</strong> in this brain MRI scan with a confidence level of <strong>${confidence}%</strong>. While this is a positive preliminary finding, please note the following:</p>

        <ul>
          <li><strong>Clinical Correlation Required:</strong> A normal AI screening result does <strong>not exclude all pathologies</strong>. If the patient presents with clinical symptoms (headaches, seizures, neurological deficits, visual disturbances), further evaluation by a specialist remains essential.</li>
          <li><strong>Radiologist Review:</strong> This scan should still be formally reported by a qualified <strong>radiologist</strong> as part of standard clinical protocol. AI screening is a supplementary tool, not a replacement for expert interpretation.</li>
          <li><strong>Limitations:</strong> This AI model was trained on specific types of brain tumors and may not detect all categories of intracranial pathology, including but not limited to: <strong>small metastases, low-grade diffuse gliomas, vascular malformations,</strong> or <strong>non-mass-forming lesions</strong>.</li>
          <li><strong>Follow-up Imaging:</strong> If clinically indicated (e.g., persistent symptoms, family history of brain tumors, known primary malignancy elsewhere), consider <strong>follow-up MRI in 3-6 months</strong> as per clinical guidelines.</li>
          <li><strong>Routine Health Monitoring:</strong> Continue routine health check-ups and immediately report any new or worsening neurological symptoms to your healthcare provider.</li>
        </ul>

        <p><strong>Note for the Patient:</strong> A negative screening result is reassuring but should always be discussed with your physician in the context of your complete medical history and symptoms.</p>
      </div>
    </div>`;
  }

  // type === 'notmri'
  return `
  <div class="med-guide">
    <div class="med-guide-head">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Usage Guidance — Invalid Input Image
    </div>
    <div class="med-guide-body">
      <p>The AI system has determined that the uploaded image <strong>does not appear to be a brain MRI scan</strong>. To obtain accurate analysis results, please ensure the following:</p>

      <ul>
        <li><strong>Image Type:</strong> Upload a <strong>brain MRI scan</strong> — preferably an axial (transverse) cross-sectional view in T1-weighted, T2-weighted, or FLAIR sequence.</li>
        <li><strong>Image Quality:</strong> The image should be clear, properly oriented, and free of significant artifacts. Avoid photographs of screens — use direct digital exports (DICOM to JPEG/PNG).</li>
        <li><strong>Supported Formats:</strong> JPEG, PNG, or WEBP formats are accepted. The image will be automatically resized to 224×224 pixels for model inference.</li>
        <li><strong>Common Errors:</strong> CT scans, X-rays, ultrasound images, photographs of patients, or non-medical images will be rejected by the classification model.</li>
      </ul>

      <p>Please upload a valid brain MRI image and try again.</p>
    </div>
  </div>`;
}

// ================================================================
//  8 · Enable scan button when model finishes loading
// ================================================================
const observer = new MutationObserver(() => {
  if (modelReady && imgSrc) $btnScan.disabled = false;
});
observer.observe($status, { attributes: true, attributeFilter: ['class'] });

// ================================================================
//  9 · Init
// ================================================================
document.addEventListener('DOMContentLoaded', loadModel);
