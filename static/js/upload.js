// MODAL HANDLING
const uploadModal = document.getElementById('uploadModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');

function openUploadModal() {
  uploadModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
  uploadModal.classList.remove('active');
  document.body.style.overflow = '';
  resetModal();
}

modalOverlay.addEventListener('click', closeUploadModal);
modalClose.addEventListener('click', closeUploadModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && uploadModal.classList.contains('active')) closeUploadModal();
});
window.openUploadModal = openUploadModal;

// FILE UPLOAD HANDLING
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const uploadResult = document.getElementById('uploadResult');

let selectedFiles = [];

function resetModal() {
  selectedFiles = [];
  uploadProgress.style.display = 'none';
  uploadResult.style.display = 'none';
  uploadResult.innerHTML = '';
  fileInput.value = '';
  uploadBox.style.display = 'block';
}

// Click to upload
uploadBox.addEventListener('click', () => fileInput.click());

// File selected via input
fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
  if (files.length > 0) initCards(files);
});

// Drag and drop
uploadBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadBox.classList.add('dragging');
});
uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragging'));
uploadBox.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadBox.classList.remove('dragging');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
  if (files.length > 0) initCards(files);
  else showGlobalError('Please upload PDF files only');
});

// ─── CARD LOGIC ───────────────────────────────────────────────────

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(1) + ' KB'
    : (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function initCards(files) {
  selectedFiles = files;
  uploadBox.style.display = 'none';
  uploadProgress.style.display = 'none';

  // Build card list
  uploadResult.style.display = 'block';
  uploadResult.className = 'upload-result stmt-card-list';
  uploadResult.innerHTML = `
    <div class="stmt-cards" id="stmtCards">
      ${files.map((f, i) => `
        <div class="stmt-card" id="stmt-card-${i}">
          <div class="stmt-card-icon">📄</div>
          <div class="stmt-card-info">
            <div class="stmt-card-name">${f.name}</div>
            <div class="stmt-card-size">${formatSize(f.size)}</div>
          </div>
          <div class="stmt-card-badge queued" id="stmt-badge-${i}">Queued</div>
        </div>
      `).join('')}
    </div>
    <button class="result-button" id="uploadAllBtn" style="margin-top:1.4rem">
      Upload ${files.length === 1 ? 'Statement' : `All ${files.length} Statements`} →
    </button>
  `;

  document.getElementById('uploadAllBtn').addEventListener('click', () => {
    document.getElementById('uploadAllBtn').remove();
    uploadFilesSequentially(files);
  });
}

async function uploadFilesSequentially(files) {
  let anySuccess = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    setBadge(i, 'uploading', 'Uploading…');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();

      if (data.error) {
        setBadge(i, 'error', '✕ ' + data.error);
      } else {
        setBadge(i, 'success', `✓ ${data.count} transactions`);
        anySuccess = true;
      }
    } catch (err) {
      setBadge(i, 'error', '✕ Network error');
    }
  }

  // After all done, show go-to-dashboard button
  const list = document.getElementById('stmtCards');
  if (list && anySuccess) {
    const btn = document.createElement('button');
    btn.className = 'result-button';
    btn.style.marginTop = '1.4rem';
    btn.textContent = 'Go to Dashboard →';
    btn.addEventListener('click', () => { window.location.href = '/dashboard'; });
    list.parentNode.appendChild(btn);
  } else if (!anySuccess) {
    showGlobalError('All uploads failed. Please try again.');
  }
}

function setBadge(index, state, text) {
  const badge = document.getElementById(`stmt-badge-${index}`);
  if (!badge) return;
  badge.textContent = text;
  badge.className = `stmt-card-badge ${state}`;
}

function showGlobalError(message) {
  uploadBox.style.display = 'none';
  uploadResult.style.display = 'block';
  uploadResult.className = 'upload-result upload-error';
  uploadResult.innerHTML = `
    <div class="result-icon">✕</div>
    <div class="result-title">Upload failed</div>
    <div class="result-desc">${message}</div>
    <button class="result-button" id="tryAgainBtn" style="background:var(--red)">Try Again</button>
  `;
  document.getElementById('tryAgainBtn').addEventListener('click', resetModal);
}
