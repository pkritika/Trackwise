// MODAL HANDLING
const uploadModal = document.getElementById('uploadModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');

// Open modal
function openUploadModal() {
  uploadModal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Prevent scrolling
}

// Close modal
function closeUploadModal() {
  uploadModal.classList.remove('active');
  document.body.style.overflow = ''; // Restore scrolling
}

// Event listeners for modal
modalOverlay.addEventListener('click', closeUploadModal);
modalClose.addEventListener('click', closeUploadModal);

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && uploadModal.classList.contains('active')) {
    closeUploadModal();
  }
});

// Make openUploadModal globally available for onclick handlers
window.openUploadModal = openUploadModal;

// FILE UPLOAD HANDLING
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const uploadResult = document.getElementById('uploadResult');

// Click to upload
uploadBox.addEventListener('click', () => {
  fileInput.click();
});

// File selected
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadFile(file);
  }
});

// Drag and drop
uploadBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadBox.classList.add('dragging');
});

uploadBox.addEventListener('dragleave', () => {
  uploadBox.classList.remove('dragging');
});

uploadBox.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadBox.classList.remove('dragging');

  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    uploadFile(file);
  } else {
    showError('Please upload a PDF file');
  }
});

// Upload file to Flask backend
function uploadFile(file) {
  // Reset
  uploadResult.style.display = 'none';
  uploadProgress.style.display = 'block';
  progressFill.style.width = '0%';
  progressText.textContent = 'Uploading...';

  const formData = new FormData();
  formData.append('file', file);

  // Simulate progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += Math.random() * 30;
    if (progress > 90) progress = 90;
    progressFill.style.width = progress + '%';
  }, 200);

  fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    clearInterval(progressInterval);
    progressFill.style.width = '100%';

    if (data.error) {
      showError(data.error);
    } else {
      progressText.textContent = 'Parsing PDF...';
      setTimeout(() => {
        showSuccess(data.count);
      }, 500);
    }
  })
  .catch(error => {
    clearInterval(progressInterval);
    showError('Upload failed: ' + error.message);
  });
}

function showSuccess(count) {
  uploadProgress.style.display = 'none';
  uploadResult.style.display = 'block';
  uploadResult.className = 'upload-result upload-success';
  uploadResult.innerHTML = `
    <div class="result-icon">✓</div>
    <div class="result-title">Successfully extracted ${count} transactions!</div>
    <div class="result-desc">Your PDF has been parsed and is ready to categorize with AI</div>
    <button class="result-button" id="viewDashboardBtn">
      View Dashboard →
    </button>
  `;

  // Add click handler to the button
  document.getElementById('viewDashboardBtn').addEventListener('click', function() {
    window.location.href = '/dashboard';
  });
}

function showError(message) {
  uploadProgress.style.display = 'none';
  uploadResult.style.display = 'block';
  uploadResult.className = 'upload-result upload-error';
  uploadResult.innerHTML = `
    <div class="result-icon">✕</div>
    <div class="result-title">Upload failed</div>
    <div class="result-desc">${message}</div>
    <button class="result-button" id="tryAgainBtn" style="background:var(--red)">
      Try Again
    </button>
  `;

  // Add click handler to reset the upload form
  document.getElementById('tryAgainBtn').addEventListener('click', function() {
    uploadResult.style.display = 'none';
    fileInput.value = ''; // Reset file input
  });
}
