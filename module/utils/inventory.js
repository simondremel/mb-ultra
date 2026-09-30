import { config } from "../config.js";

const PROPERTY_TYPES = [
  config.itemTypes.weapon, config.itemTypes.coat, config.itemTypes.plate, config.itemTypes.helm,
  config.itemTypes.shield, config.itemTypes.misc, config.itemTypes.fatigue
];

const GROUPS = {
  hand: { types: config.handItemTypes, size: config.bodySlots.hand },
  upper: { types: config.upperItemTypes, size: config.bodySlots.upper }
};

const idOf = (item) => item._id ?? item.id;

/**
 * @param {String} type
 * @returns {"hand"|"upper"|null} body slot group an item type can be equipped in
 */
export const groupOf = (type) => Object.keys(GROUPS).find((group) => GROUPS[group].types.includes(type)) ?? null;

/**
 * Number of body slots an item occupies: long weapons need both hands.
 * @param {Object} item
 * @returns {Number}
 */
export const slotWidth = (item) => (item.type === config.itemTypes.weapon && item.system.long ? 2 : 1);

/**
 * Finds the first index where `width` consecutive slots are free.
 * @param {(Object|null)[]} placed
 * @param {Number} width
 * @returns {Number} -1 when there is no room
 */
export const findFreeSlot = (placed, width) => {
  for (let index = 0; index + width <= placed.length; index++) {
    if (placed.slice(index, index + width).every((cell) => cell === null)) return index;
  }
  return -1;
};

/**
 * Places equipped items in their remembered body slot (system.slot, 1-based).
 * Items without a valid, unclaimed slot take the first free one, or overrun.
 * Extra slots taken by a wide item hold a `{ blocked: item }` marker.
 * @param {Object[]} items equipped items of one slot group
 * @param {Number} size
 * @returns {{placed: (Object|null)[], overflow: Object[]}}
 */
export const placeEquipped = (items, size) => {
  const placed = new Array(size).fill(null);
  const loose = [];
  const put = (item, index) => {
    placed[index] = item;
    for (let extra = 1; extra < slotWidth(item); extra++) placed[index + extra] = { blocked: item };
  };

  const widestFirst = [...items].sort((a, b) => slotWidth(b) - slotWidth(a));
  for (const item of widestFirst) {
    const index = (item.system.slot ?? 0) - 1;
    const width = slotWidth(item);
    if (index >= 0 && index + width <= size && placed.slice(index, index + width).every((cell) => cell === null)) put(item, index);
    else loose.push(item);
  }
  const overflow = [];
  for (const item of loose) {
    const free = findFreeSlot(placed, slotWidth(item));
    if (free >= 0) put(item, free);
    else overflow.push(item);
  }
  return { placed, overflow };
};

/**
 * Places unequipped items in their remembered backpack slot (system.backpackSlot, 1-based).
 * Items without a valid, unclaimed slot take the first free one, or overrun.
 * @param {Object[]} items
 * @param {Number} size
 * @returns {{cells: Object[], updates: Object[]}} cells to render and slot assignments to persist
 */
export const placeBackpack = (items, size) => {
  const placed = new Array(size).fill(null);
  const loose = [];
  for (const item of items) {
    const index = (item.system.backpackSlot ?? 0) - 1;
    if (index >= 0 && index < size && !placed[index]) placed[index] = item;
    else loose.push(item);
  }
  const overrun = [];
  for (const item of loose) {
    const free = placed.indexOf(null);
    if (free >= 0) placed[free] = item;
    else overrun.push(item);
  }
  const updates = placed
    .map((item, index) => (item && item.system.backpackSlot !== index + 1 ? { _id: idOf(item), "system.backpackSlot": index + 1 } : null))
    .filter(Boolean);
  return {
    cells: [...placed.map((item) => ({ item, over: false })), ...overrun.map((item) => ({ item, over: true }))],
    updates
  };
};

const isEquippableType = (type) => groupOf(type) !== null;

const buildSim = (items) => new Map(items
  .filter((item) => PROPERTY_TYPES.includes(item.type))
  .map((item) => [idOf(item), {
    id: idOf(item),
    name: item.name,
    type: item.type,
    system: {
      equipped: !!item.system.equipped && isEquippableType(item.type),
      slot: item.system.slot ?? 0,
      backpackSlot: item.system.backpackSlot ?? 0,
      long: !!item.system.long
    }
  }]));

const equippedIn = (sim, group) => [...sim.values()].filter((item) => item.system.equipped && groupOf(item.type) === group);

/** Writes the current (possibly implicit) placement of every item into the simulated state. */
const materialize = (sim) => {
  for (const group of Object.keys(GROUPS)) {
    const { placed, overflow } = placeEquipped(equippedIn(sim, group), GROUPS[group].size);
    placed.forEach((cell, index) => { if (cell && !cell.blocked) cell.system.slot = index + 1; });
    overflow.forEach((item) => { item.system.slot = 0; });
  }
  const { cells } = placeBackpack([...sim.values()].filter((item) => !item.system.equipped), config.backpackSlots);
  cells.forEach(({ item, over }, index) => { if (item) item.system.backpackSlot = over ? 0 : index + 1; });
};

const bodyIndexOf = (sim, item) => {
  const group = groupOf(item.type);
  return placeEquipped(equippedIn(sim, group), GROUPS[group].size).placed.indexOf(item);
};

/**
 * Checks whether an unequipped item can be equipped at a body slot and returns its start index.
 * @returns {{start: Number}|{error: {key: String, args: Object}}}
 */
const tryEquip = (sim, item, group, index) => {
  if (groupOf(item.type) !== group) return { error: { key: "WrongSlot", args: { name: item.name, group } } };
  const others = equippedIn(sim, group).filter((other) => other !== item);
  if (group === "upper" && others.some((other) => other.type === item.type)) {
    return { error: { key: "AlreadyWorn", args: { name: item.name, type: item.type } } };
  }
  const { size } = GROUPS[group];
  const width = slotWidth(item);
  const start = Math.min(index, size - width);
  const { placed } = placeEquipped(others, size);
  if (placed.slice(start, start + width).some((cell) => cell !== null)) {
    return { error: { key: width > 1 ? "NeedsBothHands" : "SlotsFull", args: { name: item.name, group } } };
  }
  return { start };
};

const equip = (item, start) => {
  item.system.equipped = true;
  item.system.slot = start + 1;
  item.system.backpackSlot = 0;
};

const unequip = (item, backpackIndex) => {
  item.system.equipped = false;
  item.system.slot = 0;
  item.system.backpackSlot = backpackIndex >= 0 ? backpackIndex + 1 : 0;
};

const toUpdates = (items, sim) => items
  .filter((item) => sim.has(idOf(item)))
  .map((item) => {
    const next = sim.get(idOf(item)).system;
    const update = { _id: idOf(item) };
    if (isEquippableType(item.type)) {
      if (!!item.system.equipped !== next.equipped) update["system.equipped"] = next.equipped;
      if ((item.system.slot ?? 0) !== next.slot) update["system.slot"] = next.slot;
    }
    if ((item.system.backpackSlot ?? 0) !== next.backpackSlot) update["system.backpackSlot"] = next.backpackSlot;
    return Object.keys(update).length > 1 ? update : null;
  })
  .filter(Boolean);

/**
 * Plans an inventory drag and drop.
 * @param {Object[]} items all items of the actor
 * @param {String} itemId dragged item
 * @param {{zone: "hand"|"upper"|"backpack", index: Number}} target
 * @returns {{updates: Object[]}|{error: {key: String, args: Object}}}
 */
export const planMove = (items, itemId, target) => {
  const sim = buildSim(items);
  materialize(sim);
  const item = sim.get(itemId);
  if (!item) return { updates: [] };
  const fromBody = item.system.equipped;
  const finish = () => ({ updates: toUpdates(items, sim) });

  if (target.zone === "backpack") {
    const occupant = [...sim.values()].find((other) => !other.system.equipped && other.system.backpackSlot === target.index + 1);
    if (occupant === item) return { updates: [] };

    if (!fromBody) {
      if (occupant) occupant.system.backpackSlot = item.system.backpackSlot;
      item.system.backpackSlot = target.index + 1;
      return finish();
    }

    const group = groupOf(item.type);
    const start = Math.max(bodyIndexOf(sim, item), 0);
    unequip(item, target.index);
    if (occupant) {
      occupant.system.backpackSlot = 0;
      const result = tryEquip(sim, occupant, group, start);
      if (result.error) return result;
      equip(occupant, result.start);
    }
    return finish();
  }

  const group = target.zone;
  const { placed } = placeEquipped(equippedIn(sim, group), GROUPS[group].size);
  const cell = placed[target.index];
  const occupant = cell?.blocked ?? cell ?? null;
  if (occupant === item) return { updates: [] };

  if (!fromBody) {
    const original = item.system.backpackSlot;
    if (occupant) unequip(occupant, original - 1);
    const result = tryEquip(sim, item, group, target.index);
    if (result.error) return result;
    equip(item, result.start);
    return finish();
  }

  if (groupOf(item.type) !== group) return { error: { key: "WrongSlot", args: { name: item.name, group } } };
  const from = bodyIndexOf(sim, item);
  if (occupant) {
    if (slotWidth(occupant) > 1 || slotWidth(item) > 1) return { error: { key: "CannotSwap", args: { name: item.name, group } } };
    occupant.system.slot = from + 1;
    item.system.slot = placed.indexOf(occupant) + 1;
    return finish();
  }
  item.system.equipped = false;
  const result = tryEquip(sim, item, group, target.index);
  if (result.error) return result;
  equip(item, result.start);
  return finish();
};
