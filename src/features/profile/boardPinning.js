export const MAX_PINNED_BOARDS = 3;

export function countPinnedBoards(boards = []) {
  return boards.filter((board) => board?.pinned).length;
}

export function getPinnedBoards(boards = []) {
  return boards.filter((board) => board?.pinned).slice(0, MAX_PINNED_BOARDS);
}

export function canPinBoard(
  boards = [],
  boardId,
  maxPinned = MAX_PINNED_BOARDS
) {
  const board = boards.find((entry) => entry.id === boardId);

  if (!board || board.pinned) {
    return true;
  }

  return countPinnedBoards(boards) < maxPinned;
}
