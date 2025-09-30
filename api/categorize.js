export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { queries } = req.body;

  if (!queries || !Array.isArray(queries)) {
    return res.status(400).json({ error: 'Queries must be an array' });
  }

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[API] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  console.log(`[API] Kategorizace ${queries.length} položek`);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Roztřiď následující seznam položek do logických kategorií.

Položky:
${queries.map((q, i) => `${i+1}. ${q}`).join('\n')}

Vrať POUZE JSON ve formátu:
[
  {"category": "Identifikační údaje", "items": ["Rodné číslo", "Datum narození", ...]},
  {"category": "Kontaktní údaje", "items": ["Email", "Telefon", ...]},
  {"category": "Finanční údaje", "items": ["Výše úvěru", ...]},
  {"category": "Ostatní", "items": [...]}
]

PRAVIDLA:
- Použij české názvy kategorií
- Každá položka musí být pouze v jedné kategorii
- Položky, které nelze zařadit, dej do kategorie "Ostatní"
- Vrať POUZE JSON, žádný další text`
        }]
      })
    });

    const data = await response.json();

    if (response.ok) {
      const text = data.content?.[0]?.text?.trim();
      const categories = JSON.parse(text);
      console.log(`[API] Kategorizováno do ${categories.length} kategorií`);
      return res.status(200).json({ categories });
    } else {
      console.error('Claude API error:', data);
      return res.status(500).json({ error: 'Chyba při kategorizaci', details: data.error });
    }
  } catch (error) {
    console.error('Categorization error:', error.message, error.stack);
    return res.status(500).json({ error: 'Chyba při kategorizaci', details: error.message });
  }
}
