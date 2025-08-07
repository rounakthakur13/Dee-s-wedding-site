const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

const app = express();
app.use(cors());
app.post('/upload', upload.array('file'), (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ success: false, error: 'No files uploaded.' });
  res.json({
    success: true,
    files: files.map(f => ({
      filename: f.filename,
      originalname: f.originalname,
      path: f.path,
      size: f.size
    }))
  });
});

app.listen(4000, () => console.log('Local upload server running on port 4000'));