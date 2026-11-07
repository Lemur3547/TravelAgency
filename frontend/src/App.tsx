import { useEffect, useState } from 'react';

function App() {
  const [message, setMessage] = useState('Загрузка...');

  useEffect(() => {
    // Укажите точный порт вашего бэкенда
    fetch('https://humble-space-broccoli-9769vpppq7r929pg-8000.app.github.dev/health') 
      .then((res) => res.json())
      .then((data) => setMessage(data.status))
      .catch((err) => setMessage('Ошибка подключения к бэкенду'));
  }, []);

  return (
    <div>
      <h1>Статус системы:</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;
