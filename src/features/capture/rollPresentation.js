export const ROLL_STAGES = [
  "loading",
  "winding",
  "developing",
  "revealing",
  "finished",
];

export function getNextRollStage(stage) {
  const index = ROLL_STAGES.indexOf(stage);
  if (index < 0 || index === ROLL_STAGES.length - 1) return "finished";
  return ROLL_STAGES[index + 1];
}
