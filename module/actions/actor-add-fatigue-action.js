/**
 * @param {Actor} actor
 */
export const actorAddFatigueAction = async (actor) => {
  await actor.createEmbeddedDocuments("Item", [{ name: game.i18n.localize("TYPES.Item.fatigue"), type: "fatigue" }]);
};
