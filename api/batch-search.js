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
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Analyzuj následující dokument a najdi PŘESNĚ tyto údaje.

DŮLEŽITÉ: Vrať POUZE JSON ve formátu níže, nic víc.

Dokument:
${document}

Hledané údaje:
${queries.map((q, i) => `${i+1}. ${q}`).join('\n')}

Vrať JSON ve formátu:
{
  "results": [
    {"query": "Rodné číslo", "type": "single", "value": "940819/1011"},
    {"query": "Všechna parcelní čísla", "type": "multiple", "values": [
      {"label": "Parcela 1", "value": "123/45"},
      {"label": "Parcela 2", "value": "678/90"}
    ]},
    ...
  ]
}

PRAVIDLA:
- Pokud dotaz hledá JEDNU hodnotu (např. "rodné číslo Petra"), vrať: {"query": "...", "type": "single", "value": "hodnota"}
- Pokud dotaz hledá VÍCE hodnot (např. "všechna parcelní čísla", "všechny strany"), vrať: {"query": "...", "type": "multiple", "values": [{"label": "popisek", "value": "hodnota"}, ...]}
- Pokud hodnotu nenajdeš, vrať "type": "single", "value": "Nenalezeno"
- Vrať POUZE JSON, žádný další text
- Zachovej PŘESNÉ názvy dotazů jak jsou uvedeny výše`
        }]
      })
    });

    const data = await response.json();

    if (response.ok) {
      const text = data.content?.[0]?.text?.trim();
      let parsedResults;

      try {
        const parsed = JSON.parse(text);
        parsedResults = parsed.results;
      } catch (parseError) {
        console.error('Failed to parse batch response:', text);
        // Fallback: return "Nenalezeno" for all
        parsedResults = queries.map(q => ({ query: q, type: 'single', value: 'Nenalezeno' }));
      }

      // Process results - convert to flat array with type info
      const processedResults = [];

      parsedResults.forEach(result => {
        if (result.type === 'multiple' && result.values && Array.isArray(result.values)) {
          // Multiple values - create separate entry for each
          result.values.forEach(item => {
            processedResults.push({
              query: result.query,
              type: 'multiple',
              label: item.label,
              value: item.value
            });
          });
        } else {
          // Single value
          processedResults.push({
            query: result.query,
            type: 'single',
            value: result.value || 'Nenalezeno'
          });
        }
      });

      // Ensure all queries have at least one result
      queries.forEach(q => {
        const hasResult = processedResults.some(r => r.query === q);
        if (!hasResult) {
          processedResults.push({
            query: q,
            type: 'single',
            value: 'Nenalezeno'
          });
        }
      });

      console.log(`[API] Batch results: ${processedResults.length} položek`);
      return res.status(200).json({ results: processedResults });
    } else {
      console.error('Claude API error:', data);
      return res.status(500).json({ error: 'Chyba při vyhledávání', details: data.error });
    }
  } catch (error) {
    console.error('Batch search error:', error.message, error.stack);
    return res.status(500).json({ error: 'Chyba při vyhledávání', details: error.message });
  }
}
