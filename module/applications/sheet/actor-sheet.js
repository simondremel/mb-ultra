import { config } from "../../config.js";
import { actorRestAction } from "../../actions/actor-rest-action.js";
import { actorRollScarsAction } from "../../actions/actor-roll-scars-action.js";
import { actorSaveAction } from "../../actions/actor-save-action.js";
import { actorRestoreAction } from "../../actions/actor-restore-action.js";
import { actorTakeDamageAction } from "../../actions/actor-take-damage-action.js";
import { attackVirtueLossAction } from "../../actions/actor-virtue-loss-action.js";
import { actorAttackAction } from "../../actions/actor-attack-action.js";
import { actorRegenerateAction } from "../../actions/actor-regenerate-action.js";
import { actorAddItemAction } from "../../actions/actor-add-item-action.js";
import { actorAddFatigueAction } from "../../actions/actor-add-fatigue-action.js";
import { actorInlineRollAction } from "../../actions/actor-inline-roll-action.js";

/**
 * @extends {ActorSheet}
 */
export class MBActorSheet extends foundry.appv1.sheets.ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["mythic-bastionland", "sheet", "actor"],
      width: 630,
      minWidth: 630,
      height: 600,
      scrollY: [".scrollable"]
    });
  }

  /** @override */
  get title() {
    return `${super.title} - ${game.i18n.localize(`TYPES.Actor.${this.actor.type}`)}`;
  }

  /** @override */
  get template() {
    return `${config.systemPath}/templates/applications/sheet/actor/${this.actor.type}-sheet.hbs`;
  }

  /** @override */
  _getHeaderButtons() {
    const additionalButtons = [];
    if ([config.actorTypes.knight, config.actorTypes.npc, config.actorTypes.squire, config.actorTypes.warband].includes(this.actor.type)) {
      if (game.user.isGM || (game.settings.get("mbultra", "MB.AllowPlayerRegenerateButton"))) {
        additionalButtons.push({
          class: `regenerate-button-${this.actor.id}`,
          label: game.i18n.localize("MB.Regenerate"),
          icon: "fas fa-dice-d20",
          onclick: event => this.#invokeAction(event, actorRegenerateAction, this.actor)
        });
      }
    }
    return [...additionalButtons, ...super._getHeaderButtons()];
  }

  /** @override */
  async getData(options) {
    let data = super.getData(options);
    data.config = config;
    data.ages = Object.values(config.age).map(value => ({ value, label: `MB.Actor.Age.${value}` }));
    data.ranks = Object.values(config.rank).map(value => ({ value, label: `MB.Actor.Rank.${value}` }));
    data = await this.#prepareActors(data);
    data = await this.#prepareItems(data);
    data.data.system.biography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(data.data.system.biography, { secret: data.editable });

    //console.log(data);
    return data;
  }

  async #prepareItems(data) {
    const itemTypeOrders = { weapon: 1, shield: 2, plate: 3, coat: 4, helm: 5, misc: 6, fatigue: 6.5, passion: 7, ability: 7, scar: 7 };
    data.data.items = data.data.items.sort((a, b) => itemTypeOrders[a.type] - itemTypeOrders[b.type] || a.name.localeCompare(b.name));

    for (const item of data.data.items) {
      item.system.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description);
      item.system.isEquippable = [config.itemTypes.weapon, config.itemTypes.coat, config.itemTypes.plate, config.itemTypes.helm, config.itemTypes.shield].includes(item.type);
    }

    data.data.abilities = data.data.items.filter((item) => item.type === config.itemTypes.ability);
    data.data.passions = data.data.items.filter((item) => item.type === config.itemTypes.passion);
    data.data.scars = data.data.items.filter((item) => item.type === config.itemTypes.scar);
    data.data.properties = data.data.items.filter((item) => ([config.itemTypes.weapon, config.itemTypes.coat, config.itemTypes.plate, config.itemTypes.helm, config.itemTypes.shield, config.itemTypes.misc, config.itemTypes.fatigue].includes(item.type)));
    data.data.inventory = this.#buildInventory(data.data.properties);
    data.data.totalArmor = data.data.items.reduce((totalArmor, item) => {
      return totalArmor + (item.system.equipped ? (item.system.armor ?? 0) : 0);
    }, 0);

    return data;
  }

  /**
   * Distributes property items over the fixed body and backpack slots.
   * Slots beyond the fixed amount are flagged as overflow.
   * @param {Object[]} properties
   * @returns {{hand: Object[], upper: Object[], backpack: Object[]}}
   */
  #buildInventory(properties) {
    const bodySlots = (types, size) => {
      const { placed, overflow } = MBActorSheet.#placeEquipped(properties.filter((item) => item.system.equipped && types.includes(item.type)), size);
      return [
        ...placed.map((cell) => (cell?.blocked ? { item: null, blocker: cell.blocked, over: false } : { item: cell, over: false })),
        ...overflow.map((item) => ({ item, over: true }))
      ];
    };

    const equipped = properties.filter((item) => item.system.equipped && item.system.isEquippable);
    const backpack = MBActorSheet.#placeBackpack(properties.filter((item) => !equipped.includes(item)), config.backpackSlots);
    this.#queueBackpackSave(backpack.updates);
    return {
      hand: bodySlots(config.handItemTypes, config.bodySlots.hand),
      upper: bodySlots(config.upperItemTypes, config.bodySlots.upper),
      backpack: backpack.cells
    };
  }

  /**
   * Places unequipped items in their remembered backpack slot (system.backpackSlot, 1-based).
   * Items without a valid, unclaimed slot take the first free one, or overrun.
   * @param {Object[]} items
   * @param {Number} size
   * @returns {{cells: Object[], updates: Object[]}} cells to render and slot assignments to persist
   */
  static #placeBackpack(items, size) {
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
      .map((item, index) => (item && item.system.backpackSlot !== index + 1 ? { _id: item._id ?? item.id, "system.backpackSlot": index + 1 } : null))
      .filter(Boolean);
    return {
      cells: [...placed.map((item) => ({ item, over: false })), ...overrun.map((item) => ({ item, over: true }))],
      updates
    };
  }

  /**
   * Persists backpack slot assignments after rendering, so items keep their slot.
   * @param {Object[]} updates
   */
  #queueBackpackSave(updates) {
    if (!updates.length || this.#savingBackpack || !this.actor.isOwner || this.actor.pack) return;
    this.#savingBackpack = true;
    setTimeout(async () => {
      try {
        await this.actor.updateEmbeddedDocuments("Item", updates);
      } finally {
        this.#savingBackpack = false;
      }
    }, 0);
  }

  #savingBackpack = false;

  /**
   * Number of body slots an item occupies: long weapons need both hands.
   * @param {Object} item
   * @returns {Number}
   */
  static #slotWidth(item) {
    return item.type === config.itemTypes.weapon && item.system.long ? 2 : 1;
  }

  /**
   * Finds the first index where `width` consecutive slots are free.
   * @param {(Object|null)[]} placed
   * @param {Number} width
   * @returns {Number} -1 when there is no room
   */
  static #findFreeSlot(placed, width) {
    for (let index = 0; index + width <= placed.length; index++) {
      if (placed.slice(index, index + width).every((cell) => cell === null)) return index;
    }
    return -1;
  }

  /**
   * Places equipped items in their remembered body slot (system.slot, 1-based).
   * Items without a valid, unclaimed slot take the first free one, or overflow.
   * Extra slots taken by a wide item hold a `{ blocked: item }` marker.
   * @param {Object[]} items equipped items of one slot group
   * @param {Number} size
   * @returns {{placed: (Object|null)[], overflow: Object[]}}
   */
  static #placeEquipped(items, size) {
    const placed = new Array(size).fill(null);
    const loose = [];
    const put = (item, index) => {
      placed[index] = item;
      for (let extra = 1; extra < MBActorSheet.#slotWidth(item); extra++) placed[index + extra] = { blocked: item };
    };

    const widestFirst = [...items].sort((a, b) => MBActorSheet.#slotWidth(b) - MBActorSheet.#slotWidth(a));
    for (const item of widestFirst) {
      const index = (item.system.slot ?? 0) - 1;
      const width = MBActorSheet.#slotWidth(item);
      if (index >= 0 && index + width <= size && placed.slice(index, index + width).every((cell) => cell === null)) put(item, index);
      else loose.push(item);
    }
    const overflow = [];
    for (const item of loose) {
      const free = MBActorSheet.#findFreeSlot(placed, MBActorSheet.#slotWidth(item));
      if (free >= 0) put(item, free);
      else overflow.push(item);
    }
    return { placed, overflow };
  }

  async #prepareActors(data) {
    const actors = [];
    for (const uuid of data.data.system.actors ?? []) {
      const actor = await fromUuid(uuid);
      if (actor) {
        actors.push((await actor.sheet.getData()).data);
      }
    }
    data.data.steeds = actors.filter((actor) => actor.type === config.actorTypes.steed);
    data.data.companions = actors.filter((actor) => [config.actorTypes.npc, config.actorTypes.creature, config.actorTypes.squire].includes(actor.type));
    return data;
  }

  /**
   * @param {String} event
   * @param {Object} listeners
   */
  #bindSelectorsEvent(event, listeners) {
    for (const [selector, callback] of Object.entries(listeners)) {
      this.element.find(selector).on(event, callback.bind(this));
    }
  }

  /**
   * @param {MouseEvent} event
   * @param {String} data 
   * @returns {String}
   */
  #getEventData(event, data) {
    return $(event.target).closest(`[data-${data}]`).data(data);
  }

  /**
   * @param {MouseEvent} event
   * @returns {Item}
   */
  #getItem(event) {
    return this.actor.items.get(this.#getEventData(event, "item-id"));
  }

  /**
   * @param {MouseEvent} event
   * @returns {Item}
   */
  #getActor(event) {
    return game.actors.get(this.#getEventData(event, "actor-id"));
  }

  /**
   * @override
   *
   * @param {JQuery.<HTMLElement>} html
   */
  activateListeners(html) {
    super.activateListeners(html);

    if (!this.options.editable) return;

    this.#bindSelectorsEvent("click", {
      ".item-toggle-equipped": this.#onToggleEquipped,
      ".item-edit": this.#onItemEdit,
      ".item-delete": this.#onItemDelete,
      ".actor-edit": this.#onActorEdit,
      ".actor-delete": this.#onActorDelete,
      ".item-qty-plus": this.#onItemAddQuantity,
      ".item-qty-minus": this.#onItemSubtractQuantity,
      ".roll-save": event => this.#invokeAction(event, actorSaveAction, this.actor, { virtue: this.#getEventData(event, "virtue") }),
      ".button-add-fatigue": event => this.#invokeAction(event, actorAddFatigueAction, this.actor),
      ".button-add-item": event => this.#invokeAction(event, actorAddItemAction, this.actor),
      ".button-rest": event => this.#invokeAction(event, actorRestAction, this.actor),
      ".button-roll-scars": event => this.#invokeAction(event, actorRollScarsAction, this.actor),
      ".button-restore": event => this.#invokeAction(event, actorRestoreAction, this.actor),
      ".button-take-damage": event => this.#invokeAction(event, actorTakeDamageAction, this.actor),
      ".button-virtue-loss": event => this.#invokeAction(event, attackVirtueLossAction, this.actor),
      ".button-attack": event => this.#invokeAction(event, actorAttackAction, this.actor),
      ".inline-roll": event => this.#invokeAction(event, actorInlineRollAction, this.#getActor(event) ?? this.actor, this.#getOnlineRollData(event))
    });
  }

  /**
   * @private
   *
   * @param {MouseEvent} event
   */
  #getOnlineRollData(event) {
    return {
      formula: this.#getEventData(event, "formula"),
      flavor: this.#getEventData(event, "flavor"),
      source: this.#getEventData(event, "source"),
      applyFatigue: this.#getEventData(event, "fatigue")
    };
  }

  /**
   * @param {MouseEvent} event 
   * @param {Function} action 
   * @param  {...any} args 
   */
  async #invokeAction(event, action, ...args) {
    event.preventDefault();
    event.stopPropagation();
    await action(...args);
  }

  /**
   * @private
   *
   * @param {MouseEvent} event
   */
  async #onItemEdit(event) {
    event.preventDefault();
    const item = this.#getItem(event);
    if (item) {
      item.sheet.render(true);
    }
  }

  /**
   * @private
   *
   * @param {MouseEvent} event
   */
  async #onActorEdit(event) {
    event.preventDefault();
    const actor = this.#getActor(event);
    if (actor) {
      actor.sheet.render(true);
    }
  }

  /**
   * @private
   *
   * @param {MouseEvent} event
   */
  async #onItemDelete(event) {
    event.preventDefault();
    const item = this.#getItem(event);
    await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
  }

  /**
   * @private
   *
   * @param {MouseEvent} event
   */
  async #onActorDelete(event) {
    event.preventDefault();
    const actor = this.#getActor(event);
    this.actor.update({ "system.actors": this.actor.system.actors.filter((a) => a !== actor.uuid) });
  }

  /**
   * @private
   *
   * @param {MouseEvent} event
   */
  async #onItemAddQuantity(event) {
    event.preventDefault();
    const item = this.#getItem(event);
    await item.update({ "system.quantity.value": item.system.quantity.max ? Math.min(item.system.quantity.value + 1, item.system.quantity.max) : item.system.quantity.value + 1 });
  }

  /**
   * @private
   *
   * @param {MouseEvent} event
   */
  async #onItemSubtractQuantity(event) {
    event.preventDefault();
    const item = this.#getItem(event);
    await item.update({ "system.quantity.value": Math.max(item.system.quantity.value - 1, 0) });
  }

  /**
   * @private
   *
   * @param {MouseEvent} event
   */
  async #onToggleEquipped(event) {
    const item = this.#getItem(event);
    const isHand = config.handItemTypes.includes(item.type);
    const types = isHand ? config.handItemTypes : config.upperItemTypes;
    const size = isHand ? config.bodySlots.hand : config.bodySlots.upper;
    const equipped = this.actor.items.filter((i) => i.system.equipped && types.includes(i.type));
    const { placed } = MBActorSheet.#placeEquipped(equipped, size);

    // Remember the current slot of every equipped item so nothing shifts when this one changes.
    const updates = placed
      .map((placedItem, index) => (placedItem && !placedItem.blocked && placedItem.system.slot !== index + 1 && placedItem !== item
        ? { _id: placedItem.id, "system.slot": index + 1 } : null))
      .filter(Boolean);

    if (item.system.equipped) {
      updates.push({ _id: item.id, "system.equipped": false, "system.slot": 0, "system.backpackSlot": 0 });
    } else {
      if (config.upperItemTypes.includes(item.type) && equipped.some((i) => i.type === item.type)) {
        ui.notifications.warn(game.i18n.format("MB.Inventory.AlreadyWorn", { type: game.i18n.localize(`TYPES.Item.${item.type}`).toLowerCase() }));
        return;
      }
      const free = MBActorSheet.#findFreeSlot(placed, MBActorSheet.#slotWidth(item));
      if (free < 0) {
        const message = MBActorSheet.#slotWidth(item) > 1
          ? game.i18n.format("MB.Inventory.NeedsBothHands", { name: item.name })
          : game.i18n.format("MB.Inventory.SlotsFull", { slot: game.i18n.localize(isHand ? "MB.Inventory.Hand" : "MB.Inventory.Upper") });
        ui.notifications.warn(message);
        return;
      }
      updates.push({ _id: item.id, "system.equipped": true, "system.slot": free + 1 });
    }
    await this.actor.updateEmbeddedDocuments("Item", updates);
  }

  /**
   * @override
   * @param {Event} event 
   * @param {{updateData: Object, preventClose: Boolean}}
   * @returns 
   */
  async _onSubmit(event, { updateData = null, preventClose = false } = {}) {
    const fields = [
      "system.glory",
      "system.coinage",
      "system.guard.value", "system.guard.max",
      "system.virtues.vigour.value", "system.virtues.vigour.max",
      "system.virtues.clarity.value", "system.virtues.clarity.max",
      "system.virtues.spirit.value", "system.virtues.spirit.max"
    ];

    fields.forEach((key) => {
      const field = this.element.find(`[name='${key}']`);
      if (field.length) {
        field.val(Math.max(field.val(), 0));
      }
    });

    return super._onSubmit(event, { updateData, preventClose });
  }

  /**
   * @override
   * @param {DragEvent} event
   * @param {ActorSheet.DropData.Actor} actorData
   * @private
   */
  async _onDropActor(event, actorData) {
    const actor = await fromUuid(actorData.uuid);
    if ([config.actorTypes.steed, config.actorTypes.npc, config.actorTypes.squire, config.actorTypes.creature].includes(actor.type)) {
      this.actor.update({ "system.actors": [...new Set([...this.actor.system.actors, actorData.uuid])] });
    }
  }
}
