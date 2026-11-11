import { supabase, createAccountClient } from "../../lib/supabase";
import { captureAuthScope } from "../../app/authScope.js";

export const DEFAULT_INTERESTS = [
  "Music", "Photography", "Fitness", "Gaming", "Fashion", "Travel", "Food",
  "Art", "Movies", "Sports", "Tech", "Cars", "Books", "Outdoors",
];

export async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("You must be logged in.");
  return user.id;
}

export async function getCurrentProfile() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from("profiles").select("id,username,display_name,bio,avatar_url,profile_theme,interests,onboarding_completed,is_private").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPublicProfile(profileId) {
  if (!profileId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,avatar_url,profile_theme,is_private,profile_music_track_id")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureCurrentProfile(authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  scope.assertUser(user?.id);
  if (authError) throw authError;
  if (!user) throw new Error("You must be logged in.");
  const fallbackUsername = user.user_metadata?.username || `user_${user.id.slice(0, 8)}`;
  const { data, error } = await client.from("profiles").upsert({ id: scope.user, username: fallbackUsername }, { onConflict: "id" }).select("id,username,display_name,bio,avatar_url,profile_theme,interests,onboarding_completed,is_private").single();
  if (error) throw error;
  return data;
}

export async function saveInterests(interests, authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);
  const clean = Array.from(new Set((interests || []).map((value) => String(value).trim()).filter(Boolean))).slice(0, 30);
  const { data, error } = await client.from("profiles").update({ interests: clean }).eq("id", scope.user).select("interests").single();
  if (error) throw error;
  return data.interests || [];
}

export async function completeOnboarding(authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);
  const { data, error } = await client.from("profiles").update({ onboarding_completed: true }).eq("id", scope.user).select("onboarding_completed").single();
  if (error) throw error;
  return Boolean(data.onboarding_completed);
}

export async function setPrivateAccount(isPrivate, authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);
  const { data, error } = await client.from("profiles").update({ is_private: Boolean(isPrivate) }).eq("id", scope.user).select("is_private").single();
  if (error) throw error;
  return Boolean(data.is_private);
}

export async function getFollowingIds() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from("follows").select("following_id,status").eq("follower_id", userId);
  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.following_id, row.status]));
}

export async function getRelationshipCounts(profileId) {
  if (!profileId) return { followers: 0, following: 0 };

  const { data, error } = await supabase
    .from("profiles")
    .select("follower_count,following_count")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;

  return {
    followers: data?.follower_count || 0,
    following: data?.following_count || 0,
  };
}

export async function getFollowStatus(targetUserId) {
  const userId = await getCurrentUserId();
  if (userId === targetUserId) return "self";
  const { data, error } = await supabase.from("follows").select("status").eq("follower_id", userId).eq("following_id", targetUserId).maybeSingle();
  if (error) throw error;
  return data?.status || null;
}

export async function followUser(targetUserId, authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);
  if (userId === targetUserId) throw new Error("You cannot follow yourself.");
  const { data: target, error: targetError } = await client.from("profiles").select("is_private").eq("id", targetUserId).single();
  scope.assertCurrent();
  if (targetError) throw targetError;
  const status = target.is_private ? "pending" : "accepted";
  const { data, error } = await client.from("follows").upsert({ follower_id: scope.user, following_id: targetUserId, status }, { onConflict: "follower_id,following_id" }).select("status").single();
  if (error) throw error;
  return data.status;
}

export async function unfollowUser(targetUserId, authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);
  const { error } = await client.from("follows").delete().eq("follower_id", scope.user).eq("following_id", targetUserId);
  if (error) throw error;
  return null;
}

export async function getPeopleSuggestions({ limit = 30 } = {}) {
  const userId = await getCurrentUserId();
  const [profileResult, peopleResult, following] = await Promise.all([
    supabase.from("profiles").select("interests").eq("id", userId).maybeSingle(),
    supabase.from("profiles").select("id,username,display_name,bio,avatar_url,profile_theme,interests,is_private,created_at").neq("id", userId).order("created_at", { ascending: false }).limit(Math.max(limit * 3, 60)),
    getFollowingIds(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (peopleResult.error) throw peopleResult.error;
  const interests = new Set((profileResult.data?.interests || []).map((value) => String(value).toLowerCase()));
  return (peopleResult.data || []).filter((person) => !following[person.id]).map((person) => ({ ...person, sharedInterests: (person.interests || []).filter((value) => interests.has(String(value).toLowerCase())), score: (person.interests || []).filter((value) => interests.has(String(value).toLowerCase())).length })).sort((a, b) => b.score - a.score || new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
}

export async function getPendingFollowRequests() {
  const userId = await getCurrentUserId();
  const { data: requests, error } = await supabase.from("follows").select("follower_id,created_at").eq("following_id", userId).eq("status", "pending");
  if (error) throw error;
  const ids = (requests || []).map((row) => row.follower_id);
  if (!ids.length) return [];
  const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,username,display_name,bio,avatar_url").in("id", ids);
  if (profileError) throw profileError;
  const byId = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  return (requests || []).map((row) => ({ ...row, profile: byId[row.follower_id] })).filter((row) => row.profile);
}

export async function approveFollowRequest(followerId, authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);
  const { data, error } = await client.from("follows").update({ status: "accepted" }).eq("follower_id", followerId).eq("following_id", scope.user).eq("status", "pending").select("status").single();
  if (error) throw error;
  return data.status;
}

export async function declineFollowRequest(followerId, authScope) {
  const scope = captureAuthScope(authScope), client = createAccountClient(scope);
  const userId = await getCurrentUserId();
  scope.assertUser(userId);
  const { error } = await client.from("follows").delete().eq("follower_id", followerId).eq("following_id", scope.user).eq("status", "pending");
  if (error) throw error;
}


export async function getProfileFollowers(profileId) {
  if (!profileId) return [];
  const { data, error } = await supabase.rpc("get_profile_followers", {
    target_profile_id: profileId,
  });
  if (error) throw error;
  return data || [];
}

export async function getProfileFollowing(profileId) {
  if (!profileId) return [];
  const { data, error } = await supabase.rpc("get_profile_following", {
    target_profile_id: profileId,
  });
  if (error) throw error;
  return data || [];
}
