export function normalizeUserSearch(value = "") {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function filterUsers(users = [], query = "") {
  const normalized = normalizeUserSearch(query);
  if (!normalized) return [];

  return users.filter((user) => {
    const handle = normalizeUserSearch(user.username || user.handle);
    const name = String(user.display_name || user.name || "").toLowerCase();
    return handle.includes(normalized) || name.includes(normalized);
  });
}
