# Модуль `js/data.js`

Описание:

Набор статических данных и вспомогательных функций для генерации игровых карточек и описаний бункеров.

Экспортируемые сущности (в глобальной области):
- Константы массивов: `CATASTROPHES`, `BUNKER_DESCRIPTIONS`, `PROFESSIONS`, `HEALTH_CONDITIONS`, `HOBBIES`, `LUGGAGES`, `PHOBIAS_FACTS`, `ACTION_CARDS`, `SPECIAL_TRAITS`
- Функции: `randomItem(arr)`, `generatePlayerCard(playerName)`, `generateCatastrophe()`, `generateBunkerDescription(capacity)`

Использование:
- `generatePlayerCard('Иван')` — возвращает объект карточки игрока с профессией, здоровьем, багажом и т.д.

Замечания:
- Модуль не зависит от сервера — содержит локальные шаблоны и данные.
- Исходник: [js/data.js](js/data.js#L1-L400)
