# Модуль `js/rooms.js`

Описание:

Модуль управления онлайн-комнатами и сетевой синхронизацией. Обёртка над `api/rooms.php`, реализует долгий опрос (`poll`) и функции для создания/входа/выхода из комнаты.

Публичный API (объект `BunkerRooms`):
- `init(options)` — инициализация с callback'ами: `onRoomUpdate`, `onError`, `onConnected`, `onDisconnected`
- `createRoom(username)` — создать комнату
- `joinRoom(roomCode, username)` — присоединиться к комнате
- `leaveRoom()` — выйти из комнаты
- `setReady(ready)` — пометить готовность
- `updatePlayers(players)` — обновить список игроков (серверная логика запрещает прямое обновление)
- `startGameSession(game)` — отправить состояние игры (для хоста)
- `gameAction(type, payload)` — отправить игровое действие
- `getState()` — получить локальное состояние

Замечания:
- Модуль использует периодический `setInterval` для опроса сервера и применяет локальные колбэки при обновлениях.
- Исходник: [js/rooms.js](js/rooms.js#L1-L400)
