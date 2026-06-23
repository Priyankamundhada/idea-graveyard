export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, cat, year, score, kill, hyp } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Missing idea title' });
  }

  const prompt = `A founder buried this startup idea in ${year}:

Title: "${title}"
Category: ${cat || 'Unknown'}
Hypothesis: ${hyp || 'Not specified'}
Why they killed it: "${kill || 'No reason recorded'}"
Relevance score today: ${score}/10

In 2-3 sentences, explain specifically why the timing or market conditions might be better for this idea now compared to when it was buried. Be concrete — mention real shifts in technology, regulation, consumer behavior, or infrastructure that are relevant to this specific idea. Do not be generic.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        max_tokens: 200,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are a sharp startup analyst who helps founders identify when their previously abandoned ideas have become relevant again due to market shifts. Be specific and concise. No fluff.'
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
      return res.status(500).json({ error: 'Groq API error', detail: err });
    }

    const data = await response.json();
    const insight = data.choices?.[0]?.message?.content?.trim();

    return res.status(200).json({ insight });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
