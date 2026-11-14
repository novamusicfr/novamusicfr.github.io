// Détection des liens Spotify / YouTube / Deezer / SoundCloud / Apple Music
/* Plateformes supportées */
export const P = {
  spotify:    { name:"Spotify",     color:"#1db954", letter:"S", hint:"Playlists, albums, titres, podcasts" },
  youtube:    { name:"YouTube",     color:"#ff2a2a", letter:"Y", hint:"Playlists, vidéos, YouTube Music" },
  deezer:     { name:"Deezer",      color:"#a238ff", letter:"D", hint:"Playlists, albums, titres" },
  soundcloud: { name:"SoundCloud",  color:"#ff7a00", letter:"SC", hint:"Sets, titres, profils" },
  apple:      { name:"Apple Music", color:"#fa2d48", letter:"A", hint:"Playlists, albums, titres" }
};
export const TYPE_FR = { playlist:"Playlist", album:"Album", track:"Titre", artist:"Artiste", episode:"Épisode", show:"Podcast", video:"Vidéo", set:"Set", song:"Titre" };

/* =========================================================
   Détection des liens
   ========================================================= */
export function parseLink(raw){
  const s = (raw||"").trim();
  if(!s) return null;

  // Spotify (lien web ou URI spotify:playlist:xxx)
  let m = s.match(/(?:open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?|spotify:)(playlist|album|track|artist|episode|show)[\/:]([A-Za-z0-9]+)/i);
  if(m){
    const type=m[1].toLowerCase(), id=m[2];
    return { provider:"spotify", type, id,
      embed:`https://open.spotify.com/embed/${type}/${id}?utm_source=generator`,
      url:`https://open.spotify.com/${type}/${id}`, height: type==="track"||type==="episode" ? 152 : 380 };
  }
  if(/spotify\.link|spoti\.fi/i.test(s)) return { error:"Lien court Spotify : ouvre-le une fois dans ton navigateur puis copie l'adresse complète (open.spotify.com/…)." };

  // Deezer
  m = s.match(/deezer\.com\/(?:[a-z]{2}\/)?(playlist|album|track|artist)\/(\d+)/i);
  if(m){
    const type=m[1].toLowerCase(), id=m[2];
    return { provider:"deezer", type, id,
      embed:`https://widget.deezer.com/widget/dark/${type}/${id}`,
      url:`https://www.deezer.com/${type}/${id}`, height: type==="track" ? 160 : 380 };
  }
  if(/link\.deezer\.com|deezer\.page\.link/i.test(s)) return { error:"Lien court Deezer : ouvre-le une fois puis copie l'adresse complète (deezer.com/…/playlist/…)." };

  // YouTube / YouTube Music
  let u; try{ u = new URL(s.startsWith("http")?s:"https://"+s); }catch(e){ u=null; }
  if(u && /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/i.test(u.hostname)){
    const list = u.searchParams.get("list");
    let v = u.searchParams.get("v");
    if(!v && /youtu\.be$/i.test(u.hostname)) v = u.pathname.slice(1).split("/")[0];
    if(!v){ const sm = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/); if(sm) v = sm[1]; }
    if(list && !v) return { provider:"youtube", type:"playlist", id:list,
      embed:`https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`,
      url:`https://www.youtube.com/playlist?list=${encodeURIComponent(list)}`, video:true };
    if(v) return { provider:"youtube", type: list?"playlist":"video", id:v,
      embed:`https://www.youtube.com/embed/${encodeURIComponent(v)}${list?`?list=${encodeURIComponent(list)}`:""}`,
      url:`https://www.youtube.com/watch?v=${encodeURIComponent(v)}${list?`&list=${encodeURIComponent(list)}`:""}`, video:true };
    return { error:"Lien YouTube non reconnu : il faut un lien de vidéo ou de playlist (avec ?list=…)." };
  }

  // SoundCloud
  if(u && /(^|\.)soundcloud\.com$/i.test(u.hostname)){
    if(/^on\./i.test(u.hostname)) return { error:"Lien court SoundCloud : ouvre-le une fois puis copie l'adresse complète (soundcloud.com/…)." };
    const clean = `https://soundcloud.com${u.pathname}`.replace(/\/$/,"");
    const parts = u.pathname.split("/").filter(Boolean);
    if(!parts.length) return { error:"Lien SoundCloud incomplet." };
    const type = parts[1]==="sets" ? "set" : parts.length>=2 ? "track" : "artist";
    return { provider:"soundcloud", type, id:clean,
      embed:`https://w.soundcloud.com/player/?url=${encodeURIComponent(clean)}&color=%237c5cff&visual=true&auto_play=true`,
      url:clean, height: type==="track" ? 166 : 380 };
  }

  // Apple Music
  if(u && /music\.apple\.com$/i.test(u.hostname)){
    const parts = u.pathname.split("/").filter(Boolean);
    const type = (parts[1]||"playlist").toLowerCase();
    const isSong = type==="song" || u.searchParams.get("i");
    return { provider:"apple", type: isSong?"track":(TYPE_FR[type]?type:"playlist"), id:u.pathname,
      embed:`https://embed.music.apple.com${u.pathname}${u.search}`,
      url:u.href, height: isSong ? 175 : 450 };
  }

  return { error:"Lien non reconnu. Plateformes supportées : Spotify, YouTube, Deezer, SoundCloud, Apple Music." };
}

