// ==================== BUNKER GAME DATA ====================

const CATASTROPHES = [
  { title: "Ядерная война", description: "Мировые державы обменялись ядерными ударами. Радиация накрывает всю поверхность планеты. Выжившие могут укрыться только в специальных бункерах.", icon: "☢️" },
  { title: "Пандемия смертельного вируса", description: "Неизвестный вирус с летальностью 98% распространился по всему миру. Заражённые агрессивны и неуправляемы. Бункер — единственное безопасное место.", icon: "🦠" },
  { title: "Падение астероида", description: "Астероид диаметром 12 км столкнулся с Землёй. Ядерная зима продлится 20 лет. Поверхность планеты непригодна для жизни.", icon: "☄️" },
  { title: "Восстание ИИ", description: "Суперинтеллект вышел из-под контроля и уничтожает человечество дронами-роботами. Бункер защищён от электромагнитных волн.", icon: "🤖" },
  { title: "Глобальное потепление", description: "Уровень мирового океана поднялся на 50 метров. Большая часть суши затоплена. Токсичные газы делают воздух непригодным для дыхания.", icon: "🌊" },
  { title: "Извержение супервулкана", description: "Йеллоустоун проснулся. Вулканический пепел покрывает всю Северную Америку. Температура упала на 15 градусов, солнечный свет заблокирован на годы.", icon: "🌋" },
  { title: "Биологическое оружие", description: "Террористы выпустили разработанный в лаборатории патоген, который превращает людей в агрессивных мутантов. Единственное спасение — изоляция.", icon: "💀" },
  { title: "Магнитная буря класса X20", description: "Солнечная вспышка уничтожила все электросети и электронику. Цивилизация рухнула. Начался хаос и войны за ресурсы.", icon: "🌞" },
];

const BUNKER_DESCRIPTIONS = [
  "Подземный бункер рассчитан на {capacity} человек. Запасов еды и воды хватит на 25 лет. Есть генератор, медпункт, теплица и мастерская.",
  "Военный бункер {capacity}-местный с системой жизнеобеспечения на 30 лет. Оснащён лабораторией, арсеналом и коммуникационным центром.",
  "Гражданский убежище вмещает {capacity} жителей. Запасы рассчитаны на 20 лет. Есть школа, больница и производственный цех.",
];

const PROFESSIONS = [
  { name: "Врач-хирург", value: 9, description: "Может проводить сложные операции" },
  { name: "Терапевт", value: 7, description: "Лечит болезни, знает фармацевтику" },
  { name: "Военный стратег", value: 8, description: "Умеет организовать оборону и выживание" },
  { name: "Инженер-механик", value: 8, description: "Починит любую технику" },
  { name: "Инженер-электрик", value: 7, description: "Поддерживает электросистемы бункера" },
  { name: "Агроном", value: 8, description: "Организует выращивание еды" },
  { name: "Биолог", value: 7, description: "Исследует вирусы и мутации" },
  { name: "Химик", value: 7, description: "Синтезирует лекарства и топливо" },
  { name: "Психолог", value: 6, description: "Поддерживает психическое здоровье группы" },
  { name: "Повар", value: 6, description: "Готовит из ограниченных ресурсов" },
  { name: "Строитель", value: 6, description: "Укрепляет и расширяет бункер" },
  { name: "Программист", value: 5, description: "Управляет системами бункера" },
  { name: "Учитель", value: 5, description: "Обучает и поддерживает порядок" },
  { name: "Пожарный", value: 6, description: "Борется с пожарами и чрезвычайными ситуациями" },
  { name: "Полицейский", value: 6, description: "Поддерживает порядок и дисциплину" },
  { name: "Юрист", value: 3, description: "Знает законы, но в бункере они не нужны" },
  { name: "Маркетолог", value: 2, description: "Продаёт воздух, полезность под вопросом" },
  { name: "Блогер", value: 2, description: "Снимал видосы, теперь не знает чем заняться" },
  { name: "Астроном", value: 4, description: "Может отслеживать изменения в космосе" },
  { name: "Геолог", value: 5, description: "Знает подземные ресурсы и риски" },
  { name: "Физик-ядерщик", value: 8, description: "Может работать с ядерными реакторами" },
  { name: "Ветеринар", value: 6, description: "Лечит животных, частично — людей" },
  { name: "Военный медик", value: 9, description: "Боевая медицина в экстремальных условиях" },
  { name: "Снайпер", value: 7, description: "Защищает бункер с дальней дистанции" },
  { name: "Водолаз", value: 5, description: "Работает в затопленных зонах" },
  { name: "Пилот вертолёта", value: 6, description: "Разведка и транспортировка" },
  { name: "Генетик", value: 8, description: "Изучает мутации, разрабатывает вакцины" },
  { name: "Акушер", value: 7, description: "Принимает роды, важен для продолжения рода" },
  { name: "Стоматолог", value: 5, description: "Предотвращает зубные боли, важно для выживания" },
  { name: "Фермер", value: 7, description: "Опыт сельского хозяйства и животноводства" },
];

const HEALTH_CONDITIONS = [
  { name: "Абсолютно здоров", value: 10, positive: true },
  { name: "Лёгкая близорукость", value: 8, positive: true },
  { name: "Аллергия на пыль", value: 7, positive: true },
  { name: "Лёгкая астма", value: 6, positive: true },
  { name: "Диабет 2 типа (контролируемый)", value: 5, positive: false },
  { name: "Гипертония", value: 5, positive: false },
  { name: "Сломана нога (заживает)", value: 4, positive: false },
  { name: "Хроническая мигрень", value: 6, positive: true },
  { name: "Цветовая слепота", value: 7, positive: true },
  { name: "Беременность 3 месяца", value: 5, positive: false },
  { name: "ВИЧ (под контролем)", value: 4, positive: false },
  { name: "Онкология в ремиссии", value: 4, positive: false },
  { name: "Эпилепсия", value: 4, positive: false },
  { name: "Шизофрения (медикаментозно)", value: 3, positive: false },
  { name: "Сердечная недостаточность", value: 3, positive: false },
  { name: "Иммунодефицит", value: 2, positive: false },
  { name: "Спортивная физическая форма", value: 9, positive: true },
  { name: "Ожирение 3 степени", value: 3, positive: false },
  { name: "Артрит", value: 5, positive: false },
  { name: "Анорексия", value: 3, positive: false },
  { name: "Никотиновая зависимость", value: 6, positive: true },
  { name: "Алкогольная зависимость", value: 3, positive: false },
  { name: "Наркотическая зависимость", value: 2, positive: false },
  { name: "Перенёс инсульт", value: 4, positive: false },
  { name: "Потеря слуха на 50%", value: 5, positive: false },
  { name: "Протез руки", value: 6, positive: true },
  { name: "Отличный иммунитет", value: 9, positive: true },
  { name: "Псориаз", value: 7, positive: true },
  { name: "Клаустрофобия", value: 4, positive: false },
];

const HOBBIES = [
  { name: "Охота и выживание", value: 9 },
  { name: "Огородничество", value: 8 },
  { name: "Рыбалка", value: 7 },
  { name: "Стрельба из лука", value: 7 },
  { name: "Единоборства (чёрный пояс)", value: 8 },
  { name: "Медитация и йога", value: 6 },
  { name: "Электроника и радиосвязь", value: 8 },
  { name: "Кулинария и консервирование", value: 8 },
  { name: "Плотницкое дело", value: 7 },
  { name: "Альпинизм", value: 7 },
  { name: "Первая помощь", value: 8 },
  { name: "Военная история", value: 5 },
  { name: "Астрология", value: 2 },
  { name: "Онлайн-игры", value: 2 },
  { name: "Коллекционирование марок", value: 1 },
  { name: "Вязание", value: 4 },
  { name: "Садоводство", value: 7 },
  { name: "Химия (любитель)", value: 7 },
  { name: "Хакерство", value: 6 },
  { name: "Сбор трав и грибов", value: 8 },
  { name: "Пение и музыка", value: 5 },
  { name: "Рисование", value: 4 },
  { name: "Бег и марафон", value: 7 },
  { name: "Скалолазание", value: 7 },
  { name: "Ориентирование", value: 8 },
  { name: "Ветеринария (любитель)", value: 6 },
  { name: "Пчеловодство", value: 6 },
  { name: "Кузнечное дело", value: 7 },
  { name: "Гончарство", value: 4 },
  { name: "Шитьё и пошив одежды", value: 6 },
];

const LUGGAGES = [
  { name: "Аптечка полевого врача", value: 9 },
  { name: "Запас семян растений", value: 9 },
  { name: "Генератор на солнечных панелях", value: 8 },
  { name: "Ящик инструментов", value: 8 },
  { name: "Автомат Калашникова с патронами", value: 7 },
  { name: "Библиотека выживания (50 книг)", value: 8 },
  { name: "Фильтр воды промышленный", value: 8 },
  { name: "Радиостанция", value: 7 },
  { name: "Набор антибиотиков", value: 8 },
  { name: "Корова", value: 7 },
  { name: "Пара кроликов", value: 6 },
  { name: "Ноутбук с оффлайн-энциклопедией", value: 6 },
  { name: "Запас спиртного (100 бутылок)", value: 5 },
  { name: "Набор для рыбалки", value: 6 },
  { name: "Паяльник и электронные компоненты", value: 6 },
  { name: "Надувная лодка", value: 5 },
  { name: "Фотоальбом с семьёй", value: 1 },
  { name: "Любимый кот", value: 3 },
  { name: "Игровая приставка", value: 1 },
  { name: "Коллекция монет", value: 1 },
  { name: "Запас еды на год", value: 9 },
  { name: "Бочка топлива (200 л)", value: 7 },
  { name: "Противогаз и защитный костюм", value: 8 },
  { name: "Набор для дезинфекции", value: 7 },
  { name: "Теплица разборная", value: 8 },
  { name: "Дрон-разведчик", value: 7 },
  { name: "Автомобиль повышенной проходимости", value: 6 },
  { name: "Ничего (пришёл налегке)", value: 0 },
  { name: "Золотые слитки (5 кг)", value: 4 },
  { name: "Набор для пошива одежды", value: 5 },
];

const PHOBIAS_FACTS = [
  { name: "Боюсь замкнутых пространств (клаустрофобия)", negative: true },
  { name: "Боюсь темноты (ахлуофобия)", negative: true },
  { name: "Скрытый агент ФСБ", negative: false },
  { name: "Имею двойное гражданство", negative: false },
  { name: "Владею 5 языками", negative: false },
  { name: "Боюсь насекомых (энтомофобия)", negative: true },
  { name: "Тайный агент ЦРУ", negative: false },
  { name: "Бывший военный с опытом войны", negative: false },
  { name: "Знаю расположение тайных складов", negative: false },
  { name: "Боюсь крови (гемофобия)", negative: true },
  { name: "Умею пилотировать самолёт", negative: false },
  { name: "Есть тайная болезнь (не указана в карте)", negative: true },
  { name: "Член тайного общества", negative: false },
  { name: "Говорю во сне секреты", negative: true },
  { name: "Боюсь смерти (некрофобия)", negative: true },
  { name: "Знаю, где находится другой бункер", negative: false },
  { name: "Кладоман (знает, где зарыты сокровища)", negative: false },
  { name: "Лунатик (ходит во сне)", negative: true },
  { name: "Умею читать по губам", negative: false },
  { name: "Фотографическая память", negative: false },
  { name: "Боюсь высоты (акрофобия)", negative: true },
  { name: "Умеет взламывать замки", negative: false },
  { name: "Знает язык жестов", negative: false },
  { name: "Клептоман", negative: true },
  { name: "Провидец (утверждает, что видит будущее)", negative: false },
  { name: "Есть личный враг в этом бункере", negative: true },
  { name: "Боюсь воды (гидрофобия)", negative: true },
  { name: "Чемпион по шахматам", negative: false },
  { name: "Умеет выживать без еды 3 недели", negative: false },
  { name: "Пацифист (откажется от насилия)", negative: true },
];

const ACTION_CARDS = [
  { name: "Разведчик", description: "Вы можете тайно узнать одну скрытую характеристику любого игрока.", icon: "🔍" },
  { name: "Переговорщик", description: "Один раз вы можете отменить голосование за себя и потребовать новое.", icon: "🤝" },
  { name: "Шантажист", description: "Вы знаете секрет одного игрока. Раскройте его в любой момент для дискредитации.", icon: "📋" },
  { name: "Лидер", description: "Ваш голос считается за два при следующем голосовании.", icon: "👑" },
  { name: "Медик", description: "Один раз вы можете вылечить любого игрока от его болезни.", icon: "💊" },
  { name: "Сапёр", description: "Обнаруживаете скрытую угрозу — можете раскрыть ложь одного игрока.", icon: "💣" },
  { name: "Дипломат", description: "Можете спасти одного выбывшего игрока и вернуть его в игру.", icon: "🕊️" },
  { name: "Провокатор", description: "Устраиваете внеочередное голосование в любой момент игры.", icon: "😈" },
  { name: "Хранитель тайн", description: "Один из ваших атрибутов остаётся скрытым до конца игры.", icon: "🔐" },
  { name: "Союзник", description: "Договоритесь с одним игроком — вас нельзя выгнать пока союзник в игре.", icon: "🤜" },
  { name: "Обычный человек", description: "Нет специальных способностей. Всё в ваших руках!", icon: "👤" },
  { name: "Манипулятор", description: "Можете изменить один голос любого игрока на следующем голосовании.", icon: "🎭" },
];

const SPECIAL_TRAITS = [
  "Никогда не паникует в кризисных ситуациях",
  "Может работать без сна 3 суток",
  "Имеет фотографическую память",
  "Владеет навыками гипноза",
  "Прирождённый лидер, все его слушаются",
  "Умеет договариваться с любым человеком",
  "Предчувствует опасность заранее",
  "Знает 3 языка программирования",
  "Имеет опыт жизни в тайге 1 год",
  "Был участником реалити-шоу «Выживший»",
];

/**
 * Get a random item from an array
 */
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random player card
 */
function generatePlayerCard(playerName) {
  const profession = randomItem(PROFESSIONS);
  const health = randomItem(HEALTH_CONDITIONS);
  const hobby = randomItem(HOBBIES);
  const luggage = randomItem(LUGGAGES);
  const phobiaFact = randomItem(PHOBIAS_FACTS);
  const actionCard = randomItem(ACTION_CARDS);

  return {
    playerName,
    profession,
    health,
    hobby,
    luggage,
    phobiaFact,
    actionCard,
    // Track which attributes have been revealed
    revealed: {
      profession: false,
      health: false,
      hobby: false,
      luggage: false,
      phobiaFact: false,
      actionCard: false,
    },
    isEliminated: false,
    votes: 0,
  };
}

/**
 * Generate a random catastrophe
 */
function generateCatastrophe() {
  return randomItem(CATASTROPHES);
}

/**
 * Generate bunker description with capacity
 */
function generateBunkerDescription(capacity) {
  const template = randomItem(BUNKER_DESCRIPTIONS);
  return template.replace("{capacity}", capacity);
}
