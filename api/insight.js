export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, cat, year, kill, hyp, notes, action } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Missing idea title' });
  }

  let prompt;

  if (action === 'score') {
    // Called when burying — score the idea and optionally explain why it might be hot
    prompt = `You are a sharp startup analyst. A founder is burying this idea:

Title: "${title}"
Category: ${cat || 'Unknown'}
Year: ${year || new Date().getFullYear()}
Hypothesis: ${hyp || 'Not provided'}
Notes: ${notes || 'None'}
Why they killed it: "${kill || 'No reason given'}"

Score this idea's CURRENT market relevance from 1-10 based on:
- How much the market, technology, or timing has shifted since it was buried
- Whether the kill reason is still valid today
- The strength of the underlying insight

Respond ONLY with valid JSON in this exact format, nothing else:
{"score": 7, "reason": "2-3 sentence explanation of why this score, referencing specific market shifts"}`;

  } else {
    // Called when opening drawer - works for both pursuing and buried ideas
    const { state, notes } = req.body;
    if (state === 'pursuing') {
      prompt = `A founder is actively pursuing this startup idea:

Title: "${title}"
Category: ${cat || 'Unknown'}
Hypothesis: ${hyp || 'Not specified'}
Notes: ${notes || 'None'}

In 2-3 sentences, give sharp tactical advice on what to validate first and what the biggest risk is. Be specific and direct.`;
    } else {
      prompt = `A founder buried this startup idea in ${year}:

Title: "${title}"
Category: ${cat || 'Unknown'}
Hypothesis: ${hyp || 'Not specified'}
Why they killed it: "${kill || 'No reason recorded'}"

In 2-3 sentences, explain specifically why the timing or market conditions might be better for this idea now. Be concrete — mention real shifts in technology, regulation, consumer behavior, or infrastructure. Do not be generic.`;
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
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are a sharp startup analyst. Be specific and concise. No fluff.'
          },
          {
            role: 'user',
            content: prompt
          }
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
        // Fallback if JSON parsing fails
        const scoreMatch = text.match(/"score":\s*(\d+)/);
        const reasonMatch = text.match(/"reason":\s*"([^"]+)"/);
        return res.status(200).json({
          score: scoreMatch ? parseInt(scoreMatch[1]) : 5,
          reason: reasonMatch ? reasonMatch[1] : text
        });
      }
    } else {
      return res.status(200).json({ insight: text });
    }

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
