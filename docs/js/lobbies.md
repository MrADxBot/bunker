# Модуль `js/lobbies.js`

Описание:

Код для страницы лобби: загрузка списка комнат с `api/rooms.php`, создание и вход в комнаты, UI-модалки (создание/приватный вход), управление профилем.

Основные функции:
- `loadRooms()` — загрузить список комнат с сервера
- `renderRoomsTable()` — отрисовать таблицу комнат
- `handleJoinRoom(roomCode, isPrivate)` — обработать попытку входа
- `joinRoom(...)`, `createRoom(...)` — вызовы API для входа/создания
- `initProfileDropdown()`, `initCreateModal()`, `initPrivateJoinModal()` — инициализация UI

Требования:
- Зависит от `BunkerAuth` для проверки авторизации.
- Исходник: [js/lobbies.js](js/lobbies.js#L1-L400)
