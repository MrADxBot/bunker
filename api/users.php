<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

const USERS_FILE = __DIR__ . '/data/users.json';
const MAX_USERNAME_LENGTH = 30;

if (!is_dir(__DIR__ . '/data')) {
    mkdir(__DIR__ . '/data', 0777, true);
}

if (!file_exists(USERS_FILE)) {
    file_put_contents(USERS_FILE, "[]", LOCK_EX);
}

function respond(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function utf8Substr(string $value, int $start, int $length): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($value, $start, $length);
    }

    if (!preg_match_all('/./us', $value, $matches)) {
        return substr($value, $start, $length);
    }

    return implode('', array_slice($matches[0], $start, $length));
}

function sanitizeUsername(string $username): string
{
    $username = trim($username);
    $username = utf8Substr($username, 0, MAX_USERNAME_LENGTH);
    return preg_replace('/\s+/', ' ', $username) ?? '';
}

function normalizeRole(string $role): string
{
    $allowed = ['player', 'host', 'admin'];
    return in_array($role, $allowed, true) ? $role : 'player';
}

function hashPassword(string $password): string
{
    // Хэш совпадает с клиентским вариантом из auth.js: base64 UTF-8 строки.
    return base64_encode($password);
}

function readUsers(): array
{
    $contents = @file_get_contents(USERS_FILE);
    if ($contents === false || trim($contents) === '') {
        return [];
    }

    $decoded = json_decode($contents, true);
    return is_array($decoded) ? $decoded : [];
}

function writeUsers(array $users): void
{
    $json = json_encode(array_values($users), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        respond(['ok' => false, 'error' => 'Не удалось сохранить пользователей'], 500);
    }

    if (file_put_contents(USERS_FILE, $json, LOCK_EX) === false) {
        respond(['ok' => false, 'error' => 'Не удалось сохранить пользователей'], 500);
    }
}

function publicUser(array $user): array
{
    return [
        'username' => (string) ($user['username'] ?? ''),
        'role' => (string) ($user['role'] ?? 'player'),
        'createdAt' => (string) ($user['createdAt'] ?? ''),
    ];
}

function findUserIndex(array $users, string $username): int
{
    foreach ($users as $index => $user) {
        if (strcasecmp((string) ($user['username'] ?? ''), $username) === 0) {
            return (int) $index;
        }
    }

    return -1;
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
$users = readUsers();

if ($action === 'list') {
    respond([
        'ok' => true,
        'users' => array_map('publicUser', $users),
    ]);
}

if ($action === 'register') {
    $username = sanitizeUsername((string) ($body['username'] ?? ''));
    $passwordHash = (string) ($body['passwordHash'] ?? '');
    $role = normalizeRole((string) ($body['role'] ?? 'player'));

    if ($username === '') {
        respond(['ok' => false, 'error' => 'Имя пользователя не задано'], 422);
    }
    if ($passwordHash === '') {
        respond(['ok' => false, 'error' => 'Пароль не задан'], 422);
    }

    if (findUserIndex($users, $username) !== -1) {
        respond(['ok' => false, 'error' => 'Такой логин уже существует'], 409);
    }

    $users[] = [
        'username' => $username,
        'passwordHash' => $passwordHash,
        'role' => $role,
        'createdAt' => date(DATE_ATOM),
    ];

    writeUsers($users);

    respond([
        'ok' => true,
        'user' => publicUser(end($users) ?: []),
    ]);
}

if ($action === 'login') {
    $username = sanitizeUsername((string) ($body['username'] ?? ''));
    $passwordHash = (string) ($body['passwordHash'] ?? '');

    if ($username === '') {
        respond(['ok' => false, 'error' => 'Имя пользователя не задано'], 422);
    }

    $index = findUserIndex($users, $username);
    if ($index === -1) {
        respond(['ok' => false, 'error' => 'Пользователь не найден'], 404);
    }

    if (($users[$index]['passwordHash'] ?? '') !== $passwordHash) {
        respond(['ok' => false, 'error' => 'Неверный пароль'], 401);
    }

    respond([
        'ok' => true,
        'user' => publicUser($users[$index]),
    ]);
}

if ($action === 'updateRole') {
    $username = sanitizeUsername((string) ($body['username'] ?? ''));
    $newRole = normalizeRole((string) ($body['newRole'] ?? 'player'));

    $index = findUserIndex($users, $username);
    if ($index === -1) {
        respond(['ok' => false, 'error' => 'Пользователь не найден'], 404);
    }

    $users[$index]['role'] = $newRole;
    writeUsers($users);

    respond([
        'ok' => true,
        'user' => publicUser($users[$index]),
    ]);
}

if ($action === 'delete') {
    $username = sanitizeUsername((string) ($body['username'] ?? ''));
    $index = findUserIndex($users, $username);
    if ($index === -1) {
        respond(['ok' => false, 'error' => 'Пользователь не найден'], 404);
    }

    array_splice($users, $index, 1);
    writeUsers($users);

    respond(['ok' => true]);
}

respond(['ok' => false, 'error' => 'Неизвестное действие'], 400);