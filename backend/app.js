const express = require('express');
const app = express();
const path = require('path');
const pool = require('./db');

app.use(express.static(path.join(__dirname, '..', 'public')));


//Navigation routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.get('/about', (req, res)=>{
    res.sendFile(path.join(__dirname,'..','public','about.html'));
});
app.get('/contact',(req, res)=>{
    res.sendFile(path.join(__dirname,'..','public','contact.html'))
});



// Database manipulation
app.get('/pharmacies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * from pharmacies');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/pharmacy', async (req, res) => {
  try {
    const { name, address, city, phone, schedule, guard, delivery, status, image } = req.body;
    const result = await pool.query(
      'INSERT INTO pharmacies (name, address, ville, telephone, horaire, garde, livraison, statut, image) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [name, address, city, phone, schedule, guard, delivery, status, image]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});






//Server setup
app.listen(4000, () => {
  console.log('Server is running on port 4000');
});