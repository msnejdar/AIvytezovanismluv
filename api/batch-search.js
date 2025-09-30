export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { queries, document } = req.body;

  if (!queries || !Array.isArray(queries) || queries.length === 0) {
    return res.status(400).json({ error: 'Queries must be a non-empty array' });
  }

  if (!document) {
    return res.status(400).json({ error: 'Document is required' });
  }

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[API] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  console.log(`[API] Batch search: ${queries.length} položek`);

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
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Analyzuj následující dokument a najdi PŘESNĚ tyto údaje.

DŮLEŽITÉ: Vrať POUZE JSON ve formátu níže, nic víc.

Dokument:
${document}

Hledané údaje:
${queries.map((q, i) => `${i+1}. ${q}`).join('\n')}

Vrať JSON:
{
  "results": [
    {"query": "Rodné číslo", "value": "940819/1011"},
    {"query": "Datum narození", "value": "19.8.1994"},
    ...
  ]
}

PRAVIDLA:
- Pro každou hledanou položku vrať objekt s "query" (přesný název) a "value" (nalezená hodnota)
- Pokud hodnotu nenajdeš, vrať "value": "Nenalezeno"
- Vrať POUZE samotné hodnoty, žádné vysvětlení
- Zachovej PŘESNÉ názvy dotazů jak jsou uvedeny výše`
        }]
      })
    });

    const data = await response.json();

    if (response.ok) {
      const text = data.content?.[0]?.text?.trim();
      let results;

      try {
        const parsed = JSON.parse(text);
        results = parsed.results;
      } catch (parseError) {
        console.error('Failed to parse batch response:', text);
        // Fallback: return "Nenalezeno" for all
        results = queries.map(q => ({ query: q, value: 'Nenalezeno' }));
      }

      // Ensure all queries have results
      const resultMap = new Map(results.map(r => [r.query, r.value]));
      const completeResults = queries.map(q => ({
        query: q,
        value: resultMap.get(q) || 'Nenalezeno'
      }));

      console.log(`[API] Batch results: ${completeResults.length} položek`);
      return res.status(200).json({ results: completeResults });
    } else {
      console.error('Claude API error:', data);
      return res.status(500).json({ error: 'Chyba při vyhledávání', details: data.error });
    }
  } catch (error) {
    console.error('Batch search error:', error.message, error.stack);
    return res.status(500).json({ error: 'Chyba při vyhledávání', details: error.message });
  }
}
