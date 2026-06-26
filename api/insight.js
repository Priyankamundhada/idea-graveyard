export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, cat, year, kill, hyp, notes, action, state } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Missing idea title' });
  }

  let prompt;

  if (action === 'score') {
    prompt = `You are a sharp startup analyst. A founder is burying this idea:

Title: "${title}"
Category: ${cat || 'Unknown'}
Year: ${year || new Date().getFullYear()}
Hypothesis: ${hyp || 'Not provided'}
Notes: ${notes || 'None'}
Why they killed it: "${kill || 'No reason given'}"

Score this idea's CURRENT market relevance from 1-10:
- 8-10 (Hot): The kill reason has been significantly weakened by market shifts, new technology, or changed consumer behaviour — even if some obstacles remain. Err toward 8 if the core blocker is gone.
- 5-7 (Warm): The kill reason is partially invalidated but the core obstacles are still real and unsolved.
- 1-4 (Cold): The kill reason is still fully valid, little has changed.

Respond ONLY with valid JSON, nothing else:
{"score": 7, "reason": "2-3 sentences on why this score and what has changed"}`;

  } else if (action === 'validate') {
    prompt = `You are a sharp startup validator. Analyse this idea a founder is pursuing:

Title: "${title}"
Category: ${cat || 'Unknown'}
Hypothesis: ${hyp || 'Not provided'}
Notes: ${notes || 'None'}

Return a structured analysis with these exact sections:

**Validation Score: X/10**
1-2 sentences on overall confidence this idea has legs.

**What's missing**
If hypothesis is vague or notes are thin, tell them exactly what to add. If complete, say "Good foundation."

**3 Questions to answer before pursuing further**
1. Most critical assumption to test
2. Second most important
3. Third

Be specific to THIS idea, not generic advice.`;

  } else {
    if (state === 'pursuing') {
      prompt = `A founder is actively pursuing this startup idea:

Title: "${title}"
Category: ${cat || 'Unknown'}
Hypothesis: ${hyp || 'Not specified'}
Notes: ${notes || 'None'}

In 2-3 sentences: assess current market timing and identify the single biggest risk to validate first. Be specific.`;
    } else {
      prompt = `A founder buried this startup idea in ${year}:

Title: "${title}"
Category: ${cat || 'Unknown'}
Hypothesis: ${hyp || 'Not specified'}
Why they killed it: "${kill || 'No reason recorded'}"

In 2-3 sentences, explain specifically why timing or market conditions might be better now. Be concrete — mention real shifts in technology, regulation, or consumer behavior.`;
    }
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 400,
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'You are a sharp startup analyst. Be specific and concise. No fluff.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Groq error:', err);
      return res.status(500).json({ error: 'Groq API error' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();

    if (action === 'score') {
      try {
        const parsed = JSON.parse(text);
        return res.status(200).json({ score: parsed.score, reason: parsed.reason });
      } catch (e) {
        const scoreMatch = text.match(/"score":\s*(\d+)/);
        const reasonMatch = text.match(/"reason":\s*"([^"]+)"/);
        return res.status(200).json({
          score: scoreMatch ? parseInt(scoreMatch[1]) : 5,
          reason: reasonMatch ? reasonMatch[1] : text
        });
      }
    } else if (action === 'validate') {
      return res.status(200).json({ validation: text });
    } else {
      return res.status(200).json({ insight: text });
    }

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
