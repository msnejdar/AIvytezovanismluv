// Vercel Serverless Function for Claude AI Search
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, document } = req.body;

  if (!query || !document) {
    return res.status(400).json({ error: 'Query a document jsou povinné' });
  }

  console.log(`[Vercel API] Vyhledávání: "${query.substring(0, 50)}..."`);

  try {
    const result = await callClaudeAPI(query, document);

    if (result.success) {
      console.log(`[Vercel API] Odpověď: "${result.answer.substring(0, 100)}..."`);
      return res.status(200).json({
        answer: result.answer,
        confidence: 0.95
      });
    } else {
      console.error(`[Vercel API] Chyba:`, result.error);
      return res.status(500).json({
        error: result.error?.message || 'Chyba při vyhledávání',
        answer: null
      });
    }
  } catch (error) {
    console.error(`[Vercel API] Exception:`, error);
    return res.status(500).json({
      error: error.message || 'Neočekávaná chyba',
      answer: null
    });
  }
}

async function callClaudeAPI(query, document, retries = 3, delay = 1000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY není nastavený v environment variables');
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: `Analyzuj následující text a najdi PŘESNĚ to, co požaduje uživatel.

DŮLEŽITÉ: Vrať POUZE samotnou odpověď, nic víc. Žádný vysvětlující text.

Uživatel hledá: "${query}"

Text dokumentu:
${document}

INSTRUKCE:
- Pokud hledá konkrétní údaj (rodné číslo, datum, částku, jméno, atd.), vrať POUZE ten údaj
- Pokud hledá větu nebo kontext, vrať přesnou větu z textu
- Pokud nic nenajdeš, vrať "Nenalezeno"
- NIKDY nevysvětluj, jen vrať výsledek

PŘÍKLADY:
Dotaz: "rodné číslo Tomáše Vokouna" → Odpověď: "920515/1234"
Dotaz: "celková cena" → Odpověď: "7 850 000 Kč"
Dotaz: "datum podpisu" → Odpověď: "15.1.2024"
Dotaz: "kdo je prodávající" → Odpověď: "Jan Novák"

Tvoje odpověď:`
          }]
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Extract answer from Claude response
        const answer = data.content?.[0]?.text?.trim() || 'Nenalezeno';
        return { success: true, answer };
      } else {
        // Pokud je API přetížené a máme ještě pokusy, zkusíme znovu
        if (data.error?.type === 'overloaded_error' && attempt < retries - 1) {
          console.log(`Pokus ${attempt + 1}/${retries} - API přetížené, čekám ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponenciální backoff
          continue;
        }

        console.error('Claude API error:', data);
        return { success: false, error: data.error, status: response.status };
      }
    } catch (error) {
      if (attempt === retries - 1) {
        console.error('Network error:', error);
        return { success: false, error: { type: 'network_error', message: error.message } };
      }

      console.log(`Pokus ${attempt + 1}/${retries} - Síťová chyba, čekám ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}