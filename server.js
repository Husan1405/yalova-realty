const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

// Ensure public/catalog and data dir exist
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// Ensure catalog.json exists
if(!fs.existsSync(CATALOG_FILE)){
  fs.writeFileSync(CATALOG_FILE, JSON.stringify([]), 'utf8');
}

// Public endpoint: return published catalog
app.get('/api/catalog', (req, res) => {
  fs.readFile(CATALOG_FILE, 'utf8', (err, data) => {
    if(err) return res.status(500).json({ error: err.message });
    try{ const parsed = JSON.parse(data); return res.json(parsed); }catch(e){ return res.status(500).json({ error: 'Invalid catalog file' }); }
  })
});

// Serve static site
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, ()=>{
  console.log('Server running on port', PORT);
});
