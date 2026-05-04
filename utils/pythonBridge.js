// ═══════════════════════════════════════════════════════════════════════════
// FILE: forensivault/utils/pythonBridge.js
// PURPOSE: Communication bridge between Node.js and Python service
// FIXED: Uses built-in http module instead of fetch
// ═══════════════════════════════════════════════════════════════════════════

const http = require('http');

const FormData = require('form-data');
const fs = require('fs');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5001';

/**
 * Make a request to the Python service using Node's built-in http module
 */
function pythonRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(PYTHON_SERVICE_URL + endpoint);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };

    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || `Python service error: ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error('Invalid JSON response from Python service'));
        }
      });
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('Python service is not running. Start it with: cd python-services && python app.py'));
      } else {
        reject(err);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Python service request timed out'));
    });

    if (bodyStr && (method === 'POST' || method === 'PUT')) {
      req.write(bodyStr);
    }

    req.end();
  });
}

/**
 * Check if Python service is running
 */
async function checkPythonService() {
  try {
    console.log("Checking Python service at:", PYTHON_SERVICE_URL + '/health');
    const response = await pythonRequest('/health');
    console.log("Python service is running:", response.status || 'OK');
    return {
      running: true,
      ...response
    };
  } catch (err) {
    console.error("Python service check failed:", err.message);
    return {
      running: false,
      error: err.message
    };
  }
}

/**
 * Parse a disk image
 */
async function parseDiskImage(imagePath) {
  return pythonRequest('/disk/parse', 'POST', { imagePath });
}

/**
 * List files in a directory within the disk image
 */
async function listFiles(imagePath, directory = '/', recursive = false) {
  return pythonRequest('/disk/files', 'POST', {
    imagePath,
    directory,
    recursive
  });
}

/**
 * Get file tree structure
 */
async function getFileTree(imagePath, maxDepth = 10) {
  return pythonRequest('/disk/tree', 'POST', { imagePath, maxDepth });
}

/**
 * Get detailed info about a file
 */
async function getFileInfo(imagePath, filePath) {
  return pythonRequest('/disk/file/info', 'POST', { imagePath, filePath });
}

/**
 * Get file preview
 */
async function getFilePreview(imagePath, filePath, maxSize = 10240) {
  return pythonRequest('/disk/file/preview', 'POST', {
    imagePath,
    filePath,
    maxSize
  });
}

/**
 * Extract a file from disk image
 */
async function extractFile(imagePath, filePath, outputDir = null) {
  return pythonRequest('/disk/file/extract', 'POST', {
    imagePath,
    filePath,
    outputDir
  });
}

/**
 * Compute hash of a file within disk image
 */
async function computeFileHash(imagePath, filePath, algorithms = ['sha256']) {
  return pythonRequest('/disk/file/hash', 'POST', {
    imagePath,
    filePath,
    algorithms
  });
}

/**
 * Search files in disk image
 */
async function searchFiles(imagePath, searchParams = {}) {
  return pythonRequest('/disk/search', 'POST', {
    imagePath,
    ...searchParams
  });
}

/**
 * Search within file contents
 */
async function searchContent(imagePath, query, options = {}) {
  return pythonRequest('/disk/search/content', 'POST', {
    imagePath,
    query,
    ...options
  });
}

/**
 * Get disk image statistics
 */
async function getDiskStats(imagePath) {
  return pythonRequest('/disk/stats', 'POST', { imagePath });
}

/**
 * Close disk image and free resources
 */
async function closeDiskImage(imagePath) {
  return pythonRequest('/disk/close', 'POST', { imagePath });
}

/**
 * Start file carving on a disk image
 */
async function startCarving(imagePath, outputDir, fileTypes) {
  return pythonRequest('/carve/start', 'POST', { imagePath, outputDir, fileTypes });
}

/**
 * Poll carving job progress
 */
async function getCarvingStatus(imagePath) {
  return pythonRequest('/carve/status', 'POST', { imagePath });
}

/**
 * Get carving results after completion
 */
async function getCarvingResults(imagePath) {
  return pythonRequest('/carve/results', 'POST', { imagePath });
}

/**
 * Get supported carving file types
 */
async function getSupportedCarvingTypes() {
  return pythonRequest('/carve/types', 'GET');
}

/**
 * Analyze a single file for tampering indicators
 */
async function analyzeFile(filePath) {
  return pythonRequest('/analyze/file', 'POST', { filePath });
}

/**
 * Analyze multiple files at once
 */
async function analyzeBatch(filePaths) {
  return pythonRequest('/analyze/batch', 'POST', { filePaths });
}

/**
 * Upload a disk image file directly to the Python service
 */
async function uploadDiskImageToPython(localFilePath, filename) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', fs.createReadStream(localFilePath), filename);

    const url = new URL(PYTHON_SERVICE_URL + '/disk/upload');
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: form.getHeaders(),
      timeout: 60000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || 'Python upload failed'));
          } else {
            resolve(parsed);
          }
        } catch(e) {
          reject(new Error('Invalid JSON from Python service'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Upload to Python timed out'));
    });

    form.pipe(req);
  });
}

module.exports = {
  pythonRequest,
  checkPythonService,
  parseDiskImage,
  listFiles,
  getFileTree,
  getFileInfo,
  getFilePreview,
  extractFile,
  computeFileHash,
  searchFiles,
  searchContent,
  getDiskStats,
  closeDiskImage,
  startCarving,
  getCarvingStatus,
  getCarvingResults,
  getSupportedCarvingTypes,
  uploadDiskImageToPython,  
  PYTHON_SERVICE_URL,
  analyzeFile,
  analyzeBatch,
};