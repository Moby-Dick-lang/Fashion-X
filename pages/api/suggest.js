export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wardrobe } = req.body;

  if (!wardrobe || wardrobe.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 wardrobe items' });
  }

  // Group items by category for better suggestions
  const grouped = {};
  wardrobe.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = 0;
    grouped[item.category]++;
  });

  const wardrobeSummary = Object.entries(grouped)
    .map(([cat, count]) => `${count} ${cat}`)
    .join(', ');

  const wardrobeList = wardrobe
    .map(item => `- ${item.category}`)
    .join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `You are Fashion X, a personal AI stylist. Based on the items in this wardrobe, suggest one complete, stylish outfit.

Wardrobe items:
${wardrobeList}

Give a direct, confident outfit suggestion in 3-4 sentences. Be specific about which item types to combine and how to style them. End with one practical styling tip. Keep it short, stylish, and actionable.`
          }
        ]
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const suggestion = data.content[0].text;
    return res.json({ suggestion });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to get suggestion. Try again.' });
  }
}
