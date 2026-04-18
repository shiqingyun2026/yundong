const getSupabaseClient = () => {
  const supabase = require('./supabase')

  if (!supabase) {
    throw new Error('Supabase client is not configured')
  }

  return supabase
}

module.exports = {
  getSupabaseClient
}
