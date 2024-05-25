require("dotenv").config();
const port = process.env.PORT || 3000;
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
export const maxDuration = 15; // This function can run for a maximum of 5 seconds


app.use(cors());

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb', parameterLimit: 50000 }));

app.use('/api/external/monitoring', require('./routes/external'));
app.use('/api/internal', require('./routes/internal'));
app.get("/", (req, res) => res.send("Express on Vercel"));

app.listen(port, () => {
  console.log(`Server is running on port ${port}...`);
});


module.exports = app;