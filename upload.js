const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// --- SQLite Setup ---
const dbPath = path.join(__dirname, 'uploads.db');
const db = new sqlite3.Database(dbPath);
// Always create table without groupName column if not exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    originalname TEXT,
    guestName TEXT,
    caption TEXT,
    event TEXT,
    uploadedAt TEXT,
    type TEXT
  )`);
});

const app = express();
const bodyParser = require('body-parser');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
// API endpoint to get all uploads metadata from SQLite
app.get('/api/uploads', (req, res) => {
  db.all('SELECT * FROM uploads ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Add file URL for each entry
    const withUrls = rows.map(entry => ({
      ...entry,
      url: `/uploads/${entry.filename}`
    }));
    res.json(withUrls);
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safeName);
  }
});

// Use multer.any() to capture all files and fields
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  }
}).any();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (index.html, etc.) from the current directory
app.use(express.static(__dirname));

// Parse multipart/form-data for uploads
// Helper functions for metadata
// Remove old metadata.json if it exists (no longer needed)
const metadataPath = path.join(uploadDir, 'metadata.json');
if (fs.existsSync(metadataPath)) {
  fs.unlinkSync(metadataPath);
}

app.post('/upload', (req, res) => {
  upload(req, res, err => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message, files: [] });
    }
    // Multer .any() puts all files in req.files and fields in req.body
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, error: 'No files uploaded.', files: [] });
    }
    // Collect metadata fields
    const guestName = (req.body.guestName || '').toString().trim();
    const caption = (req.body.caption || '').toString().trim();
    const event = (req.body.event || '').toString().trim();
    const uploadedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    // Debug log (disabled for production)
    // console.log('UPLOAD:', { guestName, caption, event });
    // Insert each file's metadata into the database (no groupName)
    const insertStmt = db.prepare(`INSERT INTO uploads (filename, originalname, guestName, caption, event, uploadedAt, type) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    files.forEach(f => {
      insertStmt.run(
        f.filename,
        f.originalname,
        guestName,
        caption,
        event,
        uploadedAt,
        f.mimetype.startsWith('image/') ? 'image' : (f.mimetype.startsWith('video/') ? 'video' : 'other')
      );
    });
    insertStmt.finalize();
    res.json({
      success: true,
      files: files.map(f => f.filename),
      error: ''
    });
  });
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'));
});

app.post('/contact', (req, res) => {
  // Handle contact form submission
  // Add your logic here (e.g., send an email, save to database, etc.)
  res.json({ success: true, message: 'Contact form submitted successfully.' });
});

// Delete upload API: removes file and DB entry
app.delete('/api/delete-upload/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!filename) return res.status(400).json({ error: 'No filename provided' });
  // Remove from DB
  db.run('DELETE FROM uploads WHERE filename = ?', [filename], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    // Remove file
    const filePath = path.join(uploadDir, filename);
    fs.unlink(filePath, err2 => {
      // Ignore file not found error
      if (err2 && err2.code !== 'ENOENT') return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});

// Only start the server once
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Upload server running on http://localhost:${PORT}`);
});
