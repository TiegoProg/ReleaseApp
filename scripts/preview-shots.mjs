// Preview rápido de los guiones de un ad contra /api/voice (motor actual del
// server). No toca Seedance. Los textos van inline para evitar comillas en shell.
const BASE = process.env.ORBITA_BASE || "http://localhost:3000";
const PERSONA = "b43726b6-1c90-485e-83fa-652276458198"; // Mark (voz Charon)

// CLAVE: el guion está escrito como HABLA REAL (titubeos, fragmentos, muletillas,
// arranques en falso). El TTS lee lo que escribes — si suena pauteado es porque
// el texto es copy pulido. La dirección de estilo es corta; el ritmo lo da el texto.
const STYLE =
  "Spontaneous, like a real person talking mid-conversation — casual fifties guy, relaxed broken rhythm, natural little pauses and hesitations, NOT read aloud like a script: ";
const shots = [
  {
    name: "Shot 1 · hook (habla real)",
    text:
      STYLE +
      "Okay so— my wife buys me these mushroom pills, right? And I just... I laughed at her. Out loud. I'm like, honey, I am not eating fungus for breakfast.",
  },
  {
    name: "Shot 2 · descubrimiento (habla real)",
    text:
      STYLE +
      "But she keeps leaving 'em by my coffee. Every morning. So... fine, I caved. And — I mean, couple weeks in? My afternoons just... they felt steadier than they had in years.",
  },
  {
    name: "Shot 3 · cierre/CTA (habla real)",
    text:
      STYLE +
      "And the worst part? I had to tell her she was right. Ugh. So look — if she's been, y'know, hinting? Link's down there. Just... don't gloat about it like she did.",
  },
];

for (const s of shots) {
  try {
    const r = await fetch(`${BASE}/api/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personaId: PERSONA, text: s.text }),
    });
    const d = await r.json();
    if (r.ok) console.log(`✅ ${s.name} | mode=${d.mode}\n   ${d.audioUrl}`);
    else console.log(`❌ ${s.name}: ${d.error}`);
  } catch (e) {
    console.log(`❌ ${s.name}: ${e.message}`);
  }
}
