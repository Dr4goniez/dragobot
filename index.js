const express = require('express');
const app = express();
const PORT = (process.env.PORT, 10);

app.listen(PORT, () => {
    console.log('Server has been initialized.');
});

app.use(express.static('public'));