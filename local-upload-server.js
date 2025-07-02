const express = require('express');
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
app.post('/upload', (req, res) => {
  upload(req, res, async err => {
    if (err) return res.status(400).json({ success: false, error: err.message, files: [] });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, error: 'No files uploaded.', files: [] });

    // Forward each file to your local server via ngrok
    try {
      const results = [];
      for (const f of files) {
        const form = new FormData();
        form.append('file', fs.createReadStream(f.path), f.originalname);
        const response = await axios.post('https://a6a5-152-58-43-39.ngrok-free.app/upload', form, {
          headers: form.getHeaders()
        });
        results.push(response.data);
      }
      res.json({ success: true, files: results });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
});

app.listen(4000, () => console.log('Local upload server running on port 4000'));