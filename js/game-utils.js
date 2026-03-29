// ==================== BUNKER GAME UTILS ====================

const BunkerGameUtils = (() => {
  function createInitialState(playerNames = []) {
    return {
      phase: "setup", // setup | catastrophe | game | voting | results
      players: [],
      catastrophe: null,
      bunkerCapacity: 0,
      currentPlayerIndex: 0,
      round: 1,
      votingResults: {},
      survivorCount: 0,
      eliminatedPlayers: [],
      activeActionCard: null,
      roundPlayedPlayers: {},
      turnRevealed: false,
      tieCandidates: [],
      _voterChoices: {},
      _revealsThisRound: {},
      _playerNames: Array.isArray(playerNames) ? playerNames.slice() : [],
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getAvatarEmoji(index) {
    const avatars = ["👨", "👩", "🧔", "👩‍🦰", "👨‍🦱", "👩‍🦱", "🧓", "👵", "👦", "👧", "🧑", "👩‍🦳"];
    return avatars[index % avatars.length];
  }

  function getPlayerAttributes(player) {
    return [
      { key: "profession", icon: "П", label: "Профессия", value: player.profession.name, desc: player.profession.description },
      { key: "health", icon: "З", label: "Здоровье", value: player.health.name, desc: "" },
      { key: "hobby", icon: "Х", label: "Хобби", value: player.hobby.name, desc: "" },
      { key: "luggage", icon: "Б", label: "Багаж", value: player.luggage.name, desc: "" },
      { key: "phobiaFact", icon: "Ф", label: "Факт/Фобия", value: player.phobiaFact.name, desc: "" },
      { key: "actionCard", icon: player.actionCard.icon, label: "Карта действия", value: player.actionCard.name, desc: player.actionCard.description },
    ];
  }

  function canRevealKey(round, key) {
    return round === 1 ? key === "profession" : true;
  }

  function hasRevealableAttributes(player, round) {
    return getPlayerAttributes(player).some((attr) => !player.revealed[attr.key] && canRevealKey(round, attr.key));
  }

  return {
    createInitialState,
    escapeHtml,
    getAvatarEmoji,
    getPlayerAttributes,
    canRevealKey,
    hasRevealableAttributes,
  };
})();

window.BunkerGameUtils = BunkerGameUtils;
