/** `list` with `item` put at slot `at`, a drop slot: before what sits there now (the list's length: at the end). The same
 *  list when the item isn't in it. */
export function moveToSlot<Item>(list: Item[], item: Item, at: number): Item[] {
  const from = list.indexOf(item)
  if (from < 0) return list
  const moved = list.filter((other) => other !== item)
  moved.splice(at > from ? at - 1 : at, 0, item)
  return moved
}
