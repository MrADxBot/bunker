<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

const ROOM_TTL_SECONDS = 10;
const ROOM_CODE_LENGTH = 6;
const MAX_PLAYERS = 12;
const DEFAULT_GAME_MODE = 'classic';
const ALLOWED_GAME_MODES = ['classic', 'nonclassic'];

$dataDir = __DIR__ . '/data/rooms';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}

function respond(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function randomCode(int $length): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $result = '';
    $maxIndex = strlen($alphabet) - 1;

    for ($i = 0; $i < $length; $i++) {
        $result .= $alphabet[random_int(0, $maxIndex)];
    }

    return $result;
}

function makeClientId(): string
{
    return bin2hex(random_bytes(16));
}

function sanitizeRoomCode(string $roomCode): string
{
    return strtoupper(preg_replace('/[^A-Z0-9]/', '', $roomCode));
}

function utf8Substr(string $value, int $start, int $length): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($value, $start, $length);
    }

    if ($start < 0) {
        $start = 0;
    }
    if ($length < 0) {
        $length = 0;
    }

    if (!preg_match_all('/./us', $value, $matches)) {
        return substr($value, $start, $length);
    }

    $chars = $matches[0];
    return implode('', array_slice($chars, $start, $length));
}

function sanitizeUsername(string $username): string
{
    $username = trim($username);
    $username = utf8Substr($username, 0, 30);
    return preg_replace('/\s+/', ' ', $username) ?? '';
}

function makeUniqueUsername(string $username, array $members): string
{
    $taken = [];
    foreach ($members as $member) {
        $taken[strtolower((string) ($member['username'] ?? ''))] = true;
    }

    if (!isset($taken[strtolower($username)])) {
        return $username;
    }

    $suffix = 2;
    while (true) {
        $candidate = utf8Substr($username, 0, 26) . " ({$suffix})";
        if (!isset($taken[strtolower($candidate)])) {
            return $candidate;
        }
        $suffix++;
    }
}

function roomFilePath(string $dataDir, string $roomCode): string
{
    return $dataDir . '/' . $roomCode . '.json';
}

function roomStatus(array $room): array
{
    $game = isset($room['game']) && is_array($room['game']) ? $room['game'] : null;
    $phase = (string) ($game['phase'] ?? 'setup');
    $started = $game !== null && $phase !== '' && $phase !== 'setup';

    return [
        'phase' => $phase,
        'started' => $started,
        'label' => $started ? 'Игра идёт' : 'В лобби',
        'joinable' => !$started,
    ];
}

function roomSummary(array $room): array
{
    $members = array_values($room['members'] ?? []);
    $players = array_values($room['players'] ?? []);
    $status = roomStatus($room);

    return [
        'code' => (string) ($room['code'] ?? ''),
        'version' => (int) ($room['version'] ?? 0),
        'playersCount' => count($players),
        'membersCount' => count($members),
        'capacity' => MAX_PLAYERS,
        'private' => !empty($room['private']),
        'gameMode' => $room['gameMode'] ?? DEFAULT_GAME_MODE,
        'status' => $status['label'],
        'phase' => $status['phase'],
        'started' => $status['started'],
        'joinable' => $status['joinable'] && count($members) < MAX_PLAYERS,
        'updatedAt' => (int) ($room['updatedAt'] ?? 0),
    ];
}

function loadRoomsSummary(string $dataDir): array
{
    $rooms = [];
    foreach (glob($dataDir . '/*.json') ?: [] as $filePath) {
        $contents = @file_get_contents($filePath);
        if ($contents === false || trim($contents) === '') {
            continue;
        }

        $room = json_decode($contents, true);
        if (!is_array($room)) {
            continue;
        }

        $changed = cleanupInactiveMembers($room);
        $playersChanged = syncPlayersFromMembers($room);
        $changed = $changed || $playersChanged;

        if (empty($room['members'])) {
            @unlink($filePath);
            continue;
        }

        if ($changed) {
            $room['version'] = (int) ($room['version'] ?? 0) + 1;
            $room['updatedAt'] = time();
            @file_put_contents(
                $filePath,
                json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
            );
        }

        $rooms[] = roomSummary($room);
    }

    usort($rooms, static function (array $left, array $right): int {
        if ($left['started'] !== $right['started']) {
            return $left['started'] <=> $right['started'];
        }
        return $right['updatedAt'] <=> $left['updatedAt'];
    });

    return $rooms;
}

function withRoomLock(string $filePath, callable $handler)
{
    $handle = fopen($filePath, 'c+');
    if ($handle === false) {
        respond(['ok' => false, 'error' => 'Не удалось открыть файл комнаты'], 500);
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            respond(['ok' => false, 'error' => 'Не удалось заблокировать комнату'], 500);
        }

        $contents = stream_get_contents($handle);
        $room = [];
        if ($contents !== false && trim($contents) !== '') {
            $decoded = json_decode($contents, true);
            if (is_array($decoded)) {
                $room = $decoded;
            }
        }

        $result = $handler($room, $handle);
        return $result;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function cleanupInactiveMembers(array &$room): bool
{
    $changed = false;
    $now = time();
    $members = $room['members'] ?? [];
    $room['members'] = array_values(array_filter($members, static function ($member) use ($now) {
        $lastSeen = (int) ($member['lastSeen'] ?? 0);
        return $lastSeen > 0 && ($now - $lastSeen) <= ROOM_TTL_SECONDS;
    }));
    if (count($room['members']) !== count($members)) {
        $changed = true;
    }

    $hostId = (string) ($room['hostId'] ?? '');
    $hasHost = false;
    foreach ($room['members'] as $member) {
        if ((string) ($member['clientId'] ?? '') === $hostId) {
            $hasHost = true;
            break;
        }
    }

    if (!$hasHost && !empty($room['members'])) {
        $room['hostId'] = $room['members'][0]['clientId'] ?? '';
        $changed = true;
    }

    return $changed;
}

function touchMember(array &$room, string $clientId): bool
{
    foreach ($room['members'] as &$member) {
        if ((string) ($member['clientId'] ?? '') === $clientId) {
            $member['lastSeen'] = time();
            return true;
        }
    }
    return false;
}

function normalizePlayers(array $players): array
{
    $normalized = [];
    $seen = [];

    foreach ($players as $name) {
        if (!is_string($name)) {
            continue;
        }
        $cleanName = sanitizeUsername($name);
        if ($cleanName === '') {
            continue;
        }
        $key = strtolower($cleanName);
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $normalized[] = $cleanName;
        if (count($normalized) >= MAX_PLAYERS) {
            break;
        }
    }

    return $normalized;
}

function syncPlayersFromMembers(array &$room): bool
{
    if (isset($room['game']) && is_array($room['game']) && !empty($room['game']['phase']) && $room['game']['phase'] !== 'setup') {
        return false;
    }

    $currentPlayers = array_values($room['players'] ?? []);
    $nextPlayers = [];

    foreach (($room['members'] ?? []) as $member) {
        $username = sanitizeUsername((string) ($member['username'] ?? ''));
        if ($username === '') {
            continue;
        }

        $key = strtolower($username);
        $exists = false;
        foreach ($nextPlayers as $existing) {
            if (strtolower($existing) === $key) {
                $exists = true;
                break;
            }
        }
        if ($exists) {
            continue;
        }

        $nextPlayers[] = $username;
        if (count($nextPlayers) >= MAX_PLAYERS) {
            break;
        }
    }

    $room['players'] = $nextPlayers;
    return $nextPlayers !== $currentPlayers;
}

function areAllMembersReady(array $room): bool
{
    $members = $room['members'] ?? [];
    if (!is_array($members) || count($members) === 0) {
        return false;
    }

    foreach ($members as $member) {
        if (empty($member['ready'])) {
            return false;
        }
    }

    return true;
}

function getAliveIndexes(array $players): array
{
    $alive = [];
    foreach ($players as $idx => $player) {
        if (empty($player['isEliminated'])) {
            $alive[] = (int) $idx;
        }
    }
    return $alive;
}

function getFirstAliveIndex(array $players): int
{
    foreach ($players as $idx => $player) {
        if (empty($player['isEliminated'])) {
            return (int) $idx;
        }
    }
    return -1;
}

function getNextAliveNotPlayedIndex(array $players, array $roundPlayedPlayers, int $afterIndex): int
{
    $count = count($players);
    if ($count === 0) {
        return -1;
    }

    for ($i = $afterIndex + 1; $i < $count; $i++) {
        if (empty($players[$i]['isEliminated']) && empty($roundPlayedPlayers[(string) $i])) {
            return $i;
        }
    }
    for ($i = 0; $i <= $afterIndex; $i++) {
        if (empty($players[$i]['isEliminated']) && empty($roundPlayedPlayers[(string) $i])) {
            return $i;
        }
    }

    return -1;
}

function prepareCurrentTurn(array &$game): void
{
    $players = $game['players'] ?? [];
    $currentIdx = (int) ($game['currentPlayerIndex'] ?? -1);
    if ($currentIdx < 0 || !isset($players[$currentIdx])) {
        $game['turnRevealed'] = false;
        return;
    }

    if (!isset($players[$currentIdx]['revealed']) || !is_array($players[$currentIdx]['revealed'])) {
        $game['turnRevealed'] = false;
        return;
    }

    $round = (int) ($game['round'] ?? 1);
    if ($round === 1 && empty($players[$currentIdx]['revealed']['profession'])) {
        $players[$currentIdx]['revealed']['profession'] = true;
        $game['players'] = $players;
        $game['turnRevealed'] = true;
        return;
    }

    $revealable = false;
    foreach ($players[$currentIdx]['revealed'] as $key => $isOpen) {
        if (!empty($isOpen)) {
            continue;
        }
        if ($round === 1 && $key !== 'profession') {
            continue;
        }
        $revealable = true;
        break;
    }

    $game['turnRevealed'] = !$revealable;
}

function getMemberByClientId(array $room, string $clientId): ?array
{
    foreach (($room['members'] ?? []) as $member) {
        if ((string) ($member['clientId'] ?? '') === $clientId) {
            return $member;
        }
    }
    return null;
}

function beginRoundInGame(array &$game): void
{
    $game['phase'] = 'game';
    $game['tieCandidates'] = [];
    $game['voteCounts'] = [];
    $game['voterChoices'] = [];
    $game['roundPlayedPlayers'] = [];
    $game['revealsThisRound'] = [];

    foreach (($game['players'] ?? []) as $idx => $player) {
        if (empty($player['isEliminated'])) {
            $game['roundPlayedPlayers'][(string) $idx] = false;
            $game['revealsThisRound'][(string) $idx] = false;
        }
    }

    $firstAlive = getFirstAliveIndex($game['players'] ?? []);
    $game['currentPlayerIndex'] = $firstAlive;
    $game['turnRevealed'] = false;

    if ($firstAlive === -1) {
        $game['phase'] = 'results';
        return;
    }

    if ((int) ($game['round'] ?? 1) === 1) {
        foreach (($game['players'] ?? []) as $idx => $player) {
            if (!empty($player['isEliminated'])) {
                continue;
            }
            if (isset($game['players'][$idx]['revealed']) && is_array($game['players'][$idx]['revealed'])) {
                $game['players'][$idx]['revealed']['profession'] = true;
                $game['revealsThisRound'][(string) $idx] = true;
            }
        }
    }
}

function startVotingInGame(array &$game): void
{
    $game['phase'] = 'voting';
    $game['voteCounts'] = [];
    $game['voterChoices'] = [];
}

function getVotingPoolNames(array $game): array
{
    $players = $game['players'] ?? [];
    $tieCandidates = $game['tieCandidates'] ?? [];

    $pool = [];
    foreach ($players as $player) {
        if (!empty($player['isEliminated'])) {
            continue;
        }

        $name = (string) ($player['playerName'] ?? '');
        if ($name === '') {
            continue;
        }

        if (!empty($tieCandidates) && !in_array($name, $tieCandidates, true)) {
            continue;
        }
        $pool[] = $name;
    }

    return $pool;
}

function findPlayerIndexByName(array $players, string $name): int
{
    foreach ($players as $idx => $player) {
        if ((string) ($player['playerName'] ?? '') === $name) {
            return (int) $idx;
        }
    }
    return -1;
}

function resolveVotingIfComplete(array &$game): void
{
    $players = $game['players'] ?? [];
    $aliveNames = [];
    foreach ($players as $player) {
        if (empty($player['isEliminated'])) {
            $aliveNames[] = (string) ($player['playerName'] ?? '');
        }
    }

    $voterChoices = $game['voterChoices'] ?? [];
    if (count($voterChoices) < count($aliveNames)) {
        return;
    }

    $pool = getVotingPoolNames($game);
    if (count($pool) === 0) {
        return;
    }

    $voteCounts = $game['voteCounts'] ?? [];
    $maxVotes = -1;
    $leaders = [];

    foreach ($pool as $name) {
        $v = (int) ($voteCounts[$name] ?? 0);
        if ($v > $maxVotes) {
            $maxVotes = $v;
            $leaders = [$name];
        } elseif ($v === $maxVotes) {
            $leaders[] = $name;
        }
    }

    if ($maxVotes < 0) {
        return;
    }

    if (count($leaders) > 1 && empty($game['tieCandidates'])) {
        $game['tieCandidates'] = $leaders;
        $game['voteCounts'] = [];
        $game['voterChoices'] = [];
        return;
    }

    if (count($leaders) > 1 && !empty($game['tieCandidates'])) {
        $leaders = [$leaders[array_rand($leaders)]];
    }

    $eliminatedName = $leaders[0];
    $eliminatedIndex = findPlayerIndexByName($players, $eliminatedName);
    if ($eliminatedIndex >= 0) {
        $game['players'][$eliminatedIndex]['isEliminated'] = true;
        $game['players'][$eliminatedIndex]['votes'] = (int) ($voteCounts[$eliminatedName] ?? 0);
        if (!isset($game['eliminatedPlayers']) || !is_array($game['eliminatedPlayers'])) {
            $game['eliminatedPlayers'] = [];
        }
        $game['eliminatedPlayers'][] = $game['players'][$eliminatedIndex];
    }

    $game['tieCandidates'] = [];
    $game['voteCounts'] = [];
    $game['voterChoices'] = [];

    $aliveAfter = getAliveIndexes($game['players'] ?? []);
    $bunkerCapacity = (int) ($game['bunkerCapacity'] ?? 0);
    if (count($aliveAfter) <= $bunkerCapacity) {
        $game['phase'] = 'results';
        return;
    }

    $game['round'] = (int) ($game['round'] ?? 1) + 1;
    beginRoundInGame($game);
}

function applyGameAction(array &$room, string $clientId, string $type, array $payload): ?string
{
    if ($type === 'resetGame') {
        if ((string) ($room['hostId'] ?? '') !== $clientId) {
            return 'Только хост может начать новую игру';
        }

        $room['game'] = null;
        syncPlayersFromMembers($room);
        return null;
    }

    if ($type === 'kickPlayer') {
        if ((string) ($room['hostId'] ?? '') !== $clientId) {
            return 'Только хост может выгнать игрока';
        }

        $targetClientId = (string) ($payload['targetClientId'] ?? '');
        if ($targetClientId === '') {
            return 'Не указан игрок для выгона';
        }

        if ($targetClientId === $clientId) {
            return 'Нельзя выгнать самого себя';
        }

        $targetIndex = null;
        foreach ($room['members'] as $idx => $member) {
            if ((string) ($member['clientId'] ?? '') === $targetClientId) {
                $targetIndex = $idx;
                break;
            }
        }

        if ($targetIndex === null) {
            return 'Игрок не найден в комнате';
        }

        array_splice($room['members'], $targetIndex, 1);
        syncPlayersFromMembers($room);

        if (empty($room['members'])) {
            return 'room_empty';
        }

        return null;
    }

    if ($type === 'sendMessage') {
        $member = getMemberByClientId($room, $clientId);
        if ($member === null) {
            return 'Клиент не состоит в комнате';
        }

        $message = trim((string) ($payload['message'] ?? ''));
        if ($message === '') {
            return null;
        }

        if (!isset($room['chat']) || !is_array($room['chat'])) {
            $room['chat'] = [];
        }

        $room['chat'][] = [
            'timestamp' => time(),
            'username' => (string) ($member['username'] ?? ''),
            'message' => utf8Substr($message, 0, 200),
        ];

        if (count($room['chat']) > 100) {
            $room['chat'] = array_slice($room['chat'], -100);
        }

        return null;
    }

    $game = $room['game'] ?? null;
    if (!is_array($game)) {
        return 'Игра еще не запущена';
    }

    $member = getMemberByClientId($room, $clientId);
    if ($member === null) {
        return 'Клиент не состоит в комнате';
    }
    $actorName = (string) ($member['username'] ?? '');
    $players = $game['players'] ?? [];

    if ($type === 'proceedGame') {
        if ((string) ($room['hostId'] ?? '') !== $clientId) {
            return 'Только хост может продолжить игру';
        }
        beginRoundInGame($game);
        $room['game'] = $game;
        return null;
    }

    if ($type === 'revealAttribute') {
        if (($game['phase'] ?? '') !== 'game') {
            return 'Сейчас не фаза раскрытия карт';
        }

        $actorIdx = findPlayerIndexByName($players, $actorName);
        if ($actorIdx < 0 || !isset($players[$actorIdx]) || !empty($players[$actorIdx]['isEliminated'])) {
            return 'Вы не можете раскрывать атрибут';
        }
        if (!empty($game['roundPlayedPlayers'][(string) $actorIdx])) {
            return 'Вы уже завершили ход в этом раунде';
        }
        if (!isset($game['revealsThisRound']) || !is_array($game['revealsThisRound'])) {
            $game['revealsThisRound'] = [];
        }
        if (!empty($game['revealsThisRound'][(string) $actorIdx])) {
            return 'Лимит раскрытия на этот раунд исчерпан';
        }

        $key = (string) ($payload['key'] ?? '');
        if ($key === '') {
            return 'Не указан атрибут для раскрытия';
        }

        if (!isset($players[$actorIdx]['revealed']) || !is_array($players[$actorIdx]['revealed'])) {
            return 'Некорректные данные игрока';
        }

        $allowedFirstRound = ['profession'];
        $round = (int) ($game['round'] ?? 1);
        if ($round === 1 && !in_array($key, $allowedFirstRound, true)) {
            return 'В 1-м раунде можно раскрыть только профессию';
        }

        if (!array_key_exists($key, $players[$actorIdx]['revealed'])) {
            return 'Неизвестный атрибут';
        }
        if (!empty($players[$actorIdx]['revealed'][$key])) {
            return 'Атрибут уже раскрыт';
        }

        $players[$actorIdx]['revealed'][$key] = true;
        $game['players'] = $players;
        $game['revealsThisRound'][(string) $actorIdx] = true;
        $room['game'] = $game;
        return null;
    }

    if ($type === 'nextPlayer') {
        if (($game['phase'] ?? '') !== 'game') {
            return 'Сейчас не фаза хода игроков';
        }

        $actorIdx = findPlayerIndexByName($players, $actorName);
        if ($actorIdx < 0 || !isset($players[$actorIdx]) || !empty($players[$actorIdx]['isEliminated'])) {
            return 'Вы не можете завершить ход';
        }
        if (!isset($players[$actorIdx]['revealed']) || !is_array($players[$actorIdx]['revealed'])) {
            return 'Некорректные данные игрока';
        }
        if (!isset($game['roundPlayedPlayers']) || !is_array($game['roundPlayedPlayers'])) {
            $game['roundPlayedPlayers'] = [];
        }
        if (!isset($game['revealsThisRound']) || !is_array($game['revealsThisRound'])) {
            $game['revealsThisRound'] = [];
        }
        if (!empty($game['roundPlayedPlayers'][(string) $actorIdx])) {
            return 'Вы уже завершили ход в этом раунде';
        }

        $round = (int) ($game['round'] ?? 1);
        $hasRevealable = false;
        foreach ($players[$actorIdx]['revealed'] as $opened) {
            if (empty($opened)) {
                $hasRevealable = true;
                break;
            }
        }
        if ($round === 1) {
            $hasRevealable = false;
        }

        $revealedThisRound = !empty($game['revealsThisRound'][(string) $actorIdx]);
        if (!$revealedThisRound && $hasRevealable) {
            return 'Сначала раскройте 1 атрибут';
        }

        $game['roundPlayedPlayers'][(string) $actorIdx] = true;

        $allDone = true;
        foreach ($players as $idx => $player) {
            if (!empty($player['isEliminated'])) {
                continue;
            }
            if (empty($game['roundPlayedPlayers'][(string) $idx])) {
                $allDone = false;
                break;
            }
        }

        if ($allDone) {
            startVotingInGame($game);
        }

        $room['game'] = $game;
        return null;
    }

    if ($type === 'castVote') {
        if (($game['phase'] ?? '') !== 'voting') {
            return 'Сейчас не фаза голосования';
        }

        $actorIdx = findPlayerIndexByName($players, $actorName);
        if ($actorIdx < 0 || !empty($players[$actorIdx]['isEliminated'])) {
            return 'Вы не можете голосовать';
        }

        if (!isset($game['voterChoices']) || !is_array($game['voterChoices'])) {
            $game['voterChoices'] = [];
        }
        if (!isset($game['voteCounts']) || !is_array($game['voteCounts'])) {
            $game['voteCounts'] = [];
        }

        if (isset($game['voterChoices'][$clientId])) {
            return 'Вы уже проголосовали в этом раунде';
        }

        $targetName = (string) ($payload['targetName'] ?? '');
        if ($targetName === '') {
            return 'Не указан кандидат';
        }

        $pool = getVotingPoolNames($game);
        if (!in_array($targetName, $pool, true)) {
            return 'Кандидат недоступен для голосования';
        }

        $targetIdx = findPlayerIndexByName($players, $targetName);
        if ($targetIdx < 0 || !empty($players[$targetIdx]['isEliminated'])) {
            return 'Кандидат уже выбыл';
        }

        $game['voterChoices'][$clientId] = $targetName;
        $game['voteCounts'][$targetName] = (int) ($game['voteCounts'][$targetName] ?? 0) + 1;

        resolveVotingIfComplete($game);
        $room['game'] = $game;
        return null;
    }

    return 'Неизвестное действие игры';
}

function roomPayload(array $room): array
{
    $hostId = (string) ($room['hostId'] ?? '');
    $members = [];
    foreach (($room['members'] ?? []) as $member) {
        $members[] = [
            'clientId' => (string) ($member['clientId'] ?? ''),
            'username' => (string) ($member['username'] ?? ''),
            'isHost' => (string) ($member['clientId'] ?? '') === $hostId,
            'ready' => !empty($member['ready']),
        ];
    }

    return [
        'code' => (string) ($room['code'] ?? ''),
        'version' => (int) ($room['version'] ?? 0),
        'private' => !empty($room['private']),
        'gameMode' => $room['gameMode'] ?? DEFAULT_GAME_MODE,
        'players' => array_values($room['players'] ?? []),
        'members' => $members,
        'game' => isset($room['game']) && is_array($room['game']) ? $room['game'] : null,
        'chat' => $room['chat'] ?? [],
    ];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['ok' => false, 'error' => 'Только POST запросы поддерживаются'], 405);
}

$rawBody = file_get_contents('php://input');
$body = json_decode((string) $rawBody, true);
if (!is_array($body)) {
    $body = $_POST;
}

$action = (string) ($body['action'] ?? '');

if ($action === 'create') {
    $username = sanitizeUsername((string) ($body['username'] ?? ''));
    $gameMode = (string) ($body['gameMode'] ?? DEFAULT_GAME_MODE);
    $isPrivate = !empty($body['private']);
    $password = (string) ($body['password'] ?? '');

    if ($username === '') {
        respond(['ok' => false, 'error' => 'Имя пользователя не задано'], 422);
    }

    if (!in_array($gameMode, ALLOWED_GAME_MODES, true)) {
        $gameMode = DEFAULT_GAME_MODE;
    }

    $roomCode = '';
    for ($i = 0; $i < 30; $i++) {
        $candidate = randomCode(ROOM_CODE_LENGTH);
        if (!file_exists(roomFilePath($dataDir, $candidate))) {
            $roomCode = $candidate;
            break;
        }
    }

    if ($roomCode === '') {
        respond(['ok' => false, 'error' => 'Не удалось создать комнату'], 500);
    }

    $clientId = makeClientId();
    $now = time();
    $room = [
        'code' => $roomCode,
        'version' => 1,
        'createdAt' => $now,
        'updatedAt' => $now,
        'hostId' => $clientId,
        'players' => [$username],
        'game' => null,
        'chat' => [],
        'private' => $isPrivate,
        'gameMode' => $gameMode,
        'members' => [
            [
                'clientId' => $clientId,
                'username' => $username,
                'lastSeen' => $now,
                'ready' => false,
            ],
        ],
    ];

    if ($isPrivate && $password !== '') {
        $room['passwordHash'] = hash('sha256', $password);
    }

    syncPlayersFromMembers($room);

    $filePath = roomFilePath($dataDir, $roomCode);
    $json = json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($filePath, $json, LOCK_EX) === false) {
        respond(['ok' => false, 'error' => 'Не удалось сохранить комнату'], 500);
    }

    respond([
        'ok' => true,
        'clientId' => $clientId,
        'roomCode' => $roomCode,
        'room' => roomPayload($room),
    ]);
}

if ($action === 'list') {
    respond([
        'ok' => true,
        'rooms' => loadRoomsSummary($dataDir),
    ]);
}

$roomActions = ['join', 'poll', 'setReady', 'updatePlayers', 'startGame', 'gameAction', 'leave'];
if (!in_array($action, $roomActions, true)) {
    respond(['ok' => false, 'error' => 'Неизвестное действие'], 422);
}

$roomCode = sanitizeRoomCode((string) ($body['roomCode'] ?? ''));
if ($roomCode === '' || strlen($roomCode) !== ROOM_CODE_LENGTH) {
    respond(['ok' => false, 'error' => 'Неверный код комнаты'], 422);
}

$filePath = roomFilePath($dataDir, $roomCode);
if (!file_exists($filePath)) {
    respond(['ok' => false, 'error' => 'Комната не найдена'], 404);
}

if ($action === 'join') {
    $username = sanitizeUsername((string) ($body['username'] ?? ''));
    if ($username === '') {
        respond(['ok' => false, 'error' => 'Имя пользователя не задано'], 422);
    }

    $clientId = makeClientId();
    $result = withRoomLock($filePath, static function (array $room, $handle) use ($roomCode, $username, $clientId, $body) {
        cleanupInactiveMembers($room);

        // Удаляем старые записи этого же пользователя
        $room['members'] = array_values(array_filter($room['members'] ?? [], static function ($member) use ($username) {
            return strcasecmp((string) ($member['username'] ?? ''), $username) !== 0;
        }));

        $game = $room['game'] ?? null;
        $phase = is_array($game) ? (string) ($game['phase'] ?? 'setup') : 'setup';
        if ($game !== null && $phase !== '' && $phase !== 'setup') {
            respond(['ok' => false, 'error' => 'Игра уже началась!'], 409);
        }

        $room['code'] = $roomCode;
        $room['version'] = (int) ($room['version'] ?? 0);
        $room['players'] = array_values($room['players'] ?? []);
        $room['members'] = array_values($room['members'] ?? []);

        if (count($room['members']) >= MAX_PLAYERS) {
            respond(['ok' => false, 'error' => 'Комната заполнена'], 409);
        }

        if (!empty($room['private'])) {
            $providedPassword = (string) ($body['password'] ?? '');
            $expectedHash = $room['passwordHash'] ?? '';
            if ($expectedHash === '' || hash('sha256', $providedPassword) !== $expectedHash) {
                respond(['ok' => false, 'error' => 'Неверный пароль комнаты'], 403);
            }
        }

        $finalUsername = makeUniqueUsername($username, $room['members']);
        $room['members'][] = [
            'clientId' => $clientId,
            'username' => $finalUsername,
            'lastSeen' => time(),
            'ready' => false,
        ];
        syncPlayersFromMembers($room);

        $room['version']++;
        $room['updatedAt'] = time();

        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

        return [
            'ok' => true,
            'clientId' => $clientId,
            'username' => $finalUsername,
            'room' => roomPayload($room),
        ];
    });

    respond($result);
}

if ($action === 'poll') {
    $clientId = (string) ($body['clientId'] ?? '');
    if ($clientId === '') {
        respond(['ok' => false, 'error' => 'clientId обязателен'], 422);
    }

    $result = withRoomLock($filePath, static function (array $room, $handle) use ($clientId) {
        $changed = cleanupInactiveMembers($room);
        $exists = touchMember($room, $clientId);
        if (!$exists) {
            respond(['ok' => false, 'error' => 'Клиент не состоит в комнате'], 403);
        }
        if (syncPlayersFromMembers($room)) {
            $changed = true;
        }

        $room['version'] = (int) ($room['version'] ?? 0) + ($changed ? 1 : 0);
        $room['updatedAt'] = time();

        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

        return [
            'ok' => true,
            'room' => roomPayload($room),
        ];
    });

    respond($result);
}

if ($action === 'setReady') {
    $clientId = (string) ($body['clientId'] ?? '');
    $ready = !empty($body['ready']);

    if ($clientId === '') {
        respond(['ok' => false, 'error' => 'clientId обязателен'], 422);
    }

    $result = withRoomLock($filePath, static function (array $room, $handle) use ($clientId, $ready) {
        cleanupInactiveMembers($room);

        $updated = false;
        foreach ($room['members'] as &$member) {
            if ((string) ($member['clientId'] ?? '') === $clientId) {
                $member['ready'] = $ready;
                $updated = true;
                break;
            }
        }

        if (!$updated) {
            respond(['ok' => false, 'error' => 'Клиент не состоит в комнате'], 403);
        }

        $room['version'] = (int) ($room['version'] ?? 0) + 1;
        $room['updatedAt'] = time();

        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

        return [
            'ok' => true,
            'room' => roomPayload($room),
        ];
    });

    respond($result);
}

if ($action === 'updatePlayers') {
    respond([
        'ok' => false,
        'error' => 'Список игроков формируется автоматически по подключенным участникам',
    ], 403);
}

if ($action === 'startGame') {
    $clientId = (string) ($body['clientId'] ?? '');
    $game = $body['game'] ?? null;

    if ($clientId === '' || !is_array($game)) {
        respond(['ok' => false, 'error' => 'Некорректные данные старта игры'], 422);
    }

    $result = withRoomLock($filePath, static function (array $room, $handle) use ($clientId, $game) {
        cleanupInactiveMembers($room);

        if (!touchMember($room, $clientId)) {
            respond(['ok' => false, 'error' => 'Клиент не состоит в комнате'], 403);
        }

        $hostId = (string) ($room['hostId'] ?? '');
        if ($hostId !== $clientId) {
            respond(['ok' => false, 'error' => 'Только хост может начать игру'], 403);
        }

        $players = $game['players'] ?? [];
        if (!is_array($players) || count($players) < 2) {
            respond(['ok' => false, 'error' => 'Недостаточно игроков для старта'], 422);
        }

        // ★★★ ПРОВЕРКА ЧТО ВСЕ ГОТОВЫ ★★★
        if (!areAllMembersReady($room)) {
            respond(['ok' => false, 'error' => 'Не все игроки готовы'], 409);
        }

        $room['game'] = $game;
        $room['version'] = (int) ($room['version'] ?? 0) + 1;
        $room['updatedAt'] = time();

        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

        return [
            'ok' => true,
            'room' => roomPayload($room),
        ];
    });

    respond($result);
}

if ($action === 'gameAction') {
    $clientId = (string) ($body['clientId'] ?? '');
    $type = (string) ($body['type'] ?? '');
    $payload = $body['payload'] ?? [];

    if ($clientId === '' || $type === '') {
        respond(['ok' => false, 'error' => 'Некорректные данные действия'], 422);
    }
    if (!is_array($payload)) {
        $payload = [];
    }

    $result = withRoomLock($filePath, static function (array $room, $handle) use ($clientId, $type, $payload) {
        cleanupInactiveMembers($room);

        if (!touchMember($room, $clientId)) {
            respond(['ok' => false, 'error' => 'Клиент не состоит в комнате'], 403);
        }

        $error = applyGameAction($room, $clientId, $type, $payload);
        
        if ($error === 'room_empty') {
            return [
                'ok' => true,
                'deleteRoom' => true,
                'roomCode' => (string) ($room['code'] ?? ''),
            ];
        }
        
        if ($error !== null) {
            return [
                'ok' => false,
                'error' => $error,
                'room' => roomPayload($room),
            ];
        }

        $room['version'] = (int) ($room['version'] ?? 0) + 1;
        $room['updatedAt'] = time();

        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

        return [
            'ok' => true,
            'room' => roomPayload($room),
        ];
    });

    if (!empty($result['deleteRoom'])) {
        @unlink($filePath);
        respond(['ok' => true, 'deleted' => true]);
    }

    respond($result, !empty($result['ok']) ? 200 : 409);
}

if ($action === 'leave') {
    $clientId = (string) ($body['clientId'] ?? '');
    if ($clientId === '') {
        respond(['ok' => false, 'error' => 'clientId обязателен'], 422);
    }

    $result = withRoomLock($filePath, static function (array $room, $handle) use ($clientId) {
        cleanupInactiveMembers($room);

        $room['members'] = array_values(array_filter($room['members'] ?? [], static function ($member) use ($clientId) {
            return (string) ($member['clientId'] ?? '') !== $clientId;
        }));

        if (count($room['members']) === 0) {
            return [
                'ok' => true,
                'deleteRoom' => true,
                'roomCode' => (string) ($room['code'] ?? ''),
            ];
        }

        $hostId = (string) ($room['hostId'] ?? '');
        $hostExists = false;
        foreach ($room['members'] as $member) {
            if ((string) ($member['clientId'] ?? '') === $hostId) {
                $hostExists = true;
                break;
            }
        }
        if (!$hostExists) {
            $room['hostId'] = (string) ($room['members'][0]['clientId'] ?? '');
        }
        syncPlayersFromMembers($room);

        $room['version'] = (int) ($room['version'] ?? 0) + 1;
        $room['updatedAt'] = time();

        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

        return [
            'ok' => true,
            'room' => roomPayload($room),
        ];
    });

    if (!empty($result['deleteRoom'])) {
        @unlink($filePath);
        respond(['ok' => true, 'deleted' => true]);
    }

    respond($result);
}

respond(['ok' => false, 'error' => 'Неизвестное действие'], 422);
