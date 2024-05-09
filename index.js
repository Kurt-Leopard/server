const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();
const app = express();
app.use(express.json());
app.use(cors());
const port = 5000;

const connect = mysql.createConnection({
    host:process.env.HOST,
    user:  process.env.USER,
    password: process.env.PWD,
    database: process.env.DB
});

connect.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        return;
    }
    console.log('Connected to MySQL database successfully!');

});

app.use(express.json());
app.use(cors());

const jwtSecret = 'secret_key';

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};


app.post('/register', async (req, res) => {
    const { fullname, username, password } = req.body;
  
      const hashedPassword = await hashPassword(password);

      const sqlInsert = 'INSERT INTO users (fullname, username, password,role) VALUES (?, ?, ?,?)';
      const result = connect.query(sqlInsert, [fullname, username, hashedPassword,'admin']);
      if(result.length===0){
        res.json({mgs: "user not found!"});
        return;
      }
      res.json({ message: 'User registered successfully!', userId: result.insertId }); 
 
  });

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const sql = 'SELECT * FROM users WHERE username = ?';
    connect.query(sql, [username], async (err, rows) => {
      if (err) {
        console.error('Database error fetching user:', err);
        return res.json({ message: 'Database error' }); 
      }

      if (rows.length === 0) {
        return res.json({ success:false, message: 'Invalid username or password' });
      }

      const user = rows[0];

      const isMatch = await bcrypt.compare(password, user.password); 
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      console.log(user)
      const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, jwtSecret, { expiresIn: '1h' }); 

      res.json({ success: true, token });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get("/user/:userID",(req,res)=>{
    const userID = req.params.userID;
    console.log(userID)
    const sql="SELECT * FROM users WHERE id=?";
    connect.query(sql,[userID],(err,result)=>{
        if(err){
            res.json({success:false});
            return;
        }
        console.log(result);
        res.json({success:true, data: result});
    });
})
app.get("/user",(req,res)=>{

  const sql="SELECT * FROM users";
  connect.query(sql,(err,result)=>{
      if(err){
          res.json({success:false});
          return;
      }
      console.log(result);
      res.json({success:true, data: result});
  });
})


app.get("/spotify-tracks/:title", (req, res) => {
    const { title } = req.params;

    axios.get(`https://api.spotify.com/v1/search?q=${title}&type=track&limit=10`, {
        headers: {
            'Authorization': 'Bearer BQC9c5cFqdlJu1vbLT-QSS-1aCcunP20MWLJFAR2S7qh1iBq1dAC0f8E9XVjwkHAPeKr-LMmdmeGvaj4XIleeqOmaFsWLLVZSymARC9PZxX23HwDu167RMpKDM9VlptLO_g0R3Sp_9iCaf0Fh6P4ilDvILGqFVcXOlnN1KuOXxtPJ6wogNizyU5sJsx36Etdw4ZBeYicyUyz2_MtfESsL666RsKWD-7LswWjd4xWJ-k2fKq8Hs8g9aGzwZ4YutSJsTlcDY7ktblyLP0P26QSWmZefzcdHTpTFAn9dITJwL-rPjaJA-xKnovNF7oRTdAmn3EfLYjqX2Yzo01p3Qcvlp0'
        }
    }).then((response) => {
        res.json({ success:true, tracks: response.data.tracks.items});
    });
});



const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.userId = decoded.userId; 
    next();
  });
};

app.get('/protected-route', verifyJWT, (req, res) => {
  res.json({ message: 'Welcome, authorized user!' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});