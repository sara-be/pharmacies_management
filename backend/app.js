const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors'); // Added cors
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');


app.use(cookieParser());
app.use(cors({      // Added cors middleware
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:4000'],
  credentials: true
}));
const staticPath = path.join(__dirname, '..', 'public');
app.use(express.static(staticPath));
app.use(express.json());  
//Auth routes
    // ?Registration
app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await pool.query(
    'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, email',
    [name, email, hashedPassword]
  );
  res.status(201).json({ message: 'Utilisateur créé', user: user.rows[0]});
});

    //?Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = userResult.rows[0];
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  res.cookie("access_token", token,{
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // use secure cookies in prod only
    sameSite: "strict",
    maxAge: 60*60*1000
  });

  res.json({ message: "Logged in", token });
});

    //?Logout
app.post("/logout", (req, res) => {
  res.clearCookie("access_token",
    {
      httpOnly: true,
      secure:true,
      sameSite:"strict"
    }
  );
  res.status(200).json({ message: "Logged out successfully" });
});

    //? auth middleware
const authMiddleWare=(req, res, next)=>{
  const token = req.cookies?.access_token;
  if (!token){
    return res.status(401).json({authenticated:false, message:"No token provided"});
  }
  try{
    const decoded= jwt.verify(token, process.env.JWT_SECRET);
    req.user= decoded;
    next();
  }catch(err){
    return res.status(401).json({authenticated:false, message:"Invalid token"});
  }
};

// Return current authenticated user
app.get('/auth/me', authMiddleWare, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ authenticated: false, message: 'User not found' });
    res.json({ authenticated: true, user });
  } catch (err) {
    res.status(500).json({ authenticated: false, message: err.message });
  }
});




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



// Pharmacies manipulation
app.get('/pharmacies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * from pharmacies');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/pharmacy',authMiddleWare, async (req, res) => {
  try {
    const { name, address, city, phone, schedule, guard, delivery, status, image } = req.body;
    const result = await pool.query(
      'INSERT INTO pharmacies (name, address, city, phone, schedule, guard, delivery, status, image) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [name, address, city, phone, schedule, guard, delivery, status, image]
    );
    res.json({message:"added successfully",result:result.rows[0]});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/pharmacy/:id',authMiddleWare, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM pharmacies WHERE id = $1 RETURNING *', [id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/pharmacy/:id',authMiddleWare,async (req,res)=>{
    try{
        const {id} = req.params;
        const {name, address, city, phone, schedule, guard, delivery, status, image} = req.body;
        const result = await pool.query(
            'UPDATE pharmacies SET name=$1, address=$2, city=$3, phone=$4, schedule=$5, guard=$6, delivery=$7, status=$8, image=$9 WHERE id=$10 RETURNING *',
            [name, address, city, phone, schedule, guard, delivery, status, image, id]
        );
        res.json(result.rows[0]);
    }catch(error){
        res.status(500).json({error: error.message});
    }
});



//Favorites manipulation
app.get('/favorites', authMiddleWare, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM favorites WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/favorite', authMiddleWare, async (req, res) => {
  try {
    const { pharmacy_id } = req.body;
    const result = await pool.query(
      'INSERT INTO favorites (user_id, pharmacy_id) VALUES ($1, $2) RETURNING *',
      [req.user.id, pharmacy_id]
    );
    res.json({message:"added successfully",result:result.rows[0]});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/favorite/:id', authMiddleWare, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM favorites WHERE id = $1 RETURNING *', [id]);
    res.json({message:"deleted successfully",result:result.rows[0]});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// app.patch('/favorite/:id', authMiddleWare, async (req, res) => {
//   const { id } = req.params;
//   const { pharmacy_id } = req.body;
// });



//Server setup
app.listen(4000, () => {
  console.log('Server is running on port 4000');
});