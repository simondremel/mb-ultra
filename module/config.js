/** @name CONFIG.MB */
export const config = {};

config.bodySlots = { hand: 2, upper: 2 };
config.backpackSlots = 6;
config.systemPath = "systems/mbultra/";
config.coreRollTable = "mbultra.mythic-bastionland-core-rolltables";
config.coreItems = "mbultra.mythic-bastionland-core-items";
config.coreActors = "mbultra.mythic-bastionland-core-actors";

config.actorTypes = {
  knight: "knight",
  npc: "npc",
  creature: "creature",
  steed: "steed",
  squire: "squire",
  warband: "warband"
};

config.itemTypes = {
  ability: "ability",
  weapon: "weapon",
  coat: "coat",
  plate: "plate",
  shield: "shield",
  helm: "helm",
  passion: "passion",
  misc: "misc",
  scar: "scar",
  knight: "knight"
};

config.handItemTypes = [config.itemTypes.weapon, config.itemTypes.shield];
config.upperItemTypes = [config.itemTypes.coat, config.itemTypes.plate, config.itemTypes.helm];

config.rank = {
  "knight_errant": "knight_errant",
  "knight_gallant": "knight_gallant",
  "knight_tenant": "knight_tenant",
  "knight_dominant": "knight_dominant",
  "knight_radiant": "knight_radiant"
};

config.age = {
  "young": "young",
  "mature": "mature",
  "old": "old"
};

config.actorDefaults = {
  [config.actorTypes.knight]: {
    img: `${config.systemPath}tokens/actors/knight.png`,
    prototypeToken: {
      texture: { src: `${config.systemPath}tokens/actors/knight-token.png` },
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY
    }
  },
  [config.actorTypes.npc]: {
    img: `${config.systemPath}tokens/actors/npc.png`,
    prototypeToken: {
      texture: { src: `${config.systemPath}tokens/actors/npc-token.png` },
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY
    }
  },
  [config.actorTypes.squire]: {
    img: `${config.systemPath}tokens/actors/squire.png`,
    prototypeToken: {
      texture: { src: `${config.systemPath}tokens/actors/squire-token.png` },
      actorLink: true
    }
  },
  [config.actorTypes.creature]: {
    img: `${config.systemPath}tokens/actors/creature.png`,
    prototypeToken: {
      texture: { src: `${config.systemPath}tokens/actors/creature-token.png` },
      actorLink: false,
      disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE
    }
  },
  [config.actorTypes.steed]: {
    img: `${config.systemPath}tokens/actors/steed.png`,
    prototypeToken: {
      texture: { src: `${config.systemPath}tokens/actors/steed-token.png` },
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY
    }
  },
  [config.actorTypes.warband]: {
    img: `${config.systemPath}tokens/actors/warband.png`,
    prototypeToken: {
      texture: { src: `${config.systemPath}tokens/actors/warband-token.png` },
      actorLink: false,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY
    }
  }
};

config.itemDefaults = {
  [config.itemTypes.ability]: {
    img: `${config.systemPath}tokens/items/ability.png`
  },
  [config.itemTypes.coat]: {
    img: `${config.systemPath}tokens/items/coat.png`
  },
  [config.itemTypes.helm]: {
    img: `${config.systemPath}tokens/items/helm.png`
  },
  [config.itemTypes.misc]: {
    img: `${config.systemPath}tokens/items/misc.png`
  },
  [config.itemTypes.passion]: {
    img: `${config.systemPath}tokens/items/passion.png`
  },
  [config.itemTypes.plate]: {
    img: `${config.systemPath}tokens/items/plate.png`
  },
  [config.itemTypes.scar]: {
    img: `${config.systemPath}tokens/items/scar.png`
  },
  [config.itemTypes.shield]: {
    img: `${config.systemPath}tokens/items/shield.png`
  },
  [config.itemTypes.weapon]: {
    img: `${config.systemPath}tokens/items/weapon.png`
  },
  [config.itemTypes.knight]: {
    img: `${config.systemPath}tokens/items/knight.png`
  }
};
