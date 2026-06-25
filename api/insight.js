export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { title, cat, year, kill, hyp, notes, action, state } = req.body;
  if (!title) return res.status(400).json({ error: 'Missing idea title' });

  let prompt;

  if (action === 'score') {
    prompt = `You are a startup analyst. A founder buried this idea in ${year}:\nTitle: "${title}"\nCategory: ${cat||'Unknown'}\nHypothesis: ${hyp||'Not provided'}\nNotes: ${notes||'None'}\nKill reason: "${kill||'None'}"\n\nScore its CURRENT market relevance 1-10. Respond ONLY with JSON:\n{"score": 7, "reason": "2-3 sentences on what changed"}`;

  } else if (action === 'validate') {
    prompt = `Validate this startup idea:\nTitle: "${title}"\nCategory: ${cat||'Unknown'}\nHypothesis: ${hyp||'Not provided'}\nNotes: ${notes||'None'}\n\nRespond with:\n**Validation Score: X/10**\n(why)\n\n**What's missing**\n(what to add or "Good foundation")\n\n**3 Questions to answer**\n1. \n2. \n3. \nBe specific to this idea.`;

  } else if (state === 'pursuing') {
    prompt = `Pursuing idea: "${title}" (${cat||'Unknown'})\nHypothesis: ${hyp||'Not specified'}\nNotes: ${notes||'None'}\n\nIn 2-3 sentences: assess market timing and biggest risk to validate. Be specific.`;

  } else {
    prompt = `Buried idea from ${year}: "${title}" (${cat||'Unknown'})\nKilled because: "${kill||'No reason'}"\n\nIn 2-3 sentences, why might timing be better now? Be concrete.`;
  }

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 400, temperature: 0.7,
        messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) { const e = await r.json(); return res.status(500).json({ error: 'Groq error', detail: e }); }
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (action === 'score') {
      try { const p = JSON.parse(text); return res.status(200).json({ score: p.score, reason: p.reason }); }
      catch { return res.status(200).json({ score: 5, reason: text }); }
    } else if (action === 'validate') {
      return res.status(200).json({ validation: text });
    } else {
      return res.status(200).json({ insight: text });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
