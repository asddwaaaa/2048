const express = require('express');
const path = require('path');
const app = express();

// Render сам подставит нужный порт
const PORT = process.env.PORT || 8000;

// Раздаём статические файлы из текущей папки
app.use(express.static(path.join(__dirname)));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check для Render
app.get('/healtz', (req, res) => {
  res.status(200).send("OK");
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
