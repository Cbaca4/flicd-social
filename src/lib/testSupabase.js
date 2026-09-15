import { supabase } from "./supabase";

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Supabase connection test:", error);
    return false;
  }

  console.log("Supabase connected successfully:", data);
  return true;
}