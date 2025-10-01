import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Testovací endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Porsche Search API Server je spuštěný!', 
    timestamp: new Date().toISOString(),
    endpoints: ['/api/search']
  });
});

async function callClaudeAPI(query, document, retries = 3, delay = 1000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Detect yes/no questions (support multiple formats)
      const isYesNoQuestion = /\b(ano\s+nebo\s+ne|yes\s+or\s+no|ano\/ne|yes\/no|ano\s*\/\s*ne|yes\s*\/\s*no)\b/i.test(query);

      if (isYesNoQuestion) {
        console.log('🎯 YES/NO question detected in query:', query);
      }

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
            content: isYesNoQuestion ? `Analyzuj následující text a odpověz na ano/ne otázku uživatele.

KRITICKY DŮLEŽITÉ: Vrať JSON ve formátu níže. "fullContext" MUSÍ obsahovat CELÝ relevantní text z dokumentu, NE jen "Ano/Ne"!

Uživatel se ptá: "${query}"

Text dokumentu:
${document}

INSTRUKCE PRO "answer":
- Vrať POUZE "Ano" nebo "Ne"
- Žádný další text

INSTRUKCE PRO "fullContext":
- Pokud je odpověď "Ano": najdi v dokumentu CELOU sekci/odstavec/článek, který potvrzuje odpověď
- NIKDY nevracej jen "Ano" nebo "Ne" do fullContext
- Zkopíruj KOMPLETNÍ relevantní text z dokumentu (může být dlouhý, to je OK)
- Pokud je odpověď "Ne": zkopíruj část dokumentu, která to dokládá, NEBO prázdný string ""

ŠPATNĚ ❌:
{"answer": "Ano", "fullContext": "Ano"}

SPRÁVNĚ ✅:
{"answer": "Ano", "fullContext": "Článek III - Zastavní právo\n\nDlužník se zavazuje zřídit ve prospěch věřitele zastavní právo k následujícím nemovitostem:\n- Parcela č. 123/45 v k.ú. Praha\n- Budova čp. 678 na parcele č. 123/45\n\nZastavní právo bude zapsáno do katastru nemovitostí..."}

PŘÍKLADY:
Dotaz: "Je tam zastavní právo? Ano nebo ne"
Odpověď: {"answer": "Ano", "fullContext": "[CELÝ text článku/sekce o zastavním právu z dokumentu - i když je to 10 řádků]"}

Dotaz: "Je prodávající fyzická osoba? Ano nebo ne"
Odpověď: {"answer": "Ne", "fullContext": "Prodávající: ACME s.r.o., IČO: 12345678, se sídlem Praha 1"}

Tvoje odpověď (pouze validní JSON):` : `Analyzuj následující text a najdi PŘESNĚ to, co požaduje uživatel.

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
        const rawText = data.content?.[0]?.text?.trim() || 'Nenalezeno';

        console.log('🔍 Claude raw response:', rawText.substring(0, 200));

        // Try to parse as JSON (for yes/no questions)
        if (rawText.startsWith('{')) {
          try {
            const parsed = JSON.parse(rawText);
            console.log('✅ JSON parsed successfully');
            console.log('   answer:', parsed.answer);
            console.log('   fullContext length:', parsed.fullContext?.length || 0);
            console.log('   fullContext preview:', parsed.fullContext?.substring(0, 100) || 'EMPTY');

            if (parsed.answer && parsed.fullContext !== undefined) {
              // Yes/No question response
              return {
                success: true,
                answer: parsed.answer,
                fullContext: parsed.fullContext
              };
            }
          } catch (e) {
            // If JSON parsing fails, treat as normal answer
            console.log('❌ JSON parse failed, treating as normal answer:', e.message);
          }
        }

        // Normal question response (backward compatible)
        console.log('📝 Normal answer (not JSON)');
        return { success: true, answer: rawText };
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

app.post('/api/categorize', async (req, res) => {
  const { queries } = req.body;

  if (!queries || !Array.isArray(queries)) {
    return res.status(400).json({ error: 'Queries must be an array' });
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
      res.json({ categories });
    } else {
      console.error('Claude API error:', data);
      res.status(500).json({ error: 'Chyba při kategorizaci' });
    }
  } catch (error) {
    console.error('Categorization error:', error);
    res.status(500).json({ error: 'Chyba při kategorizaci' });
  }
});

app.post('/api/batch-search', async (req, res) => {
  const { queries, document } = req.body;

  if (!queries || !Array.isArray(queries) || queries.length === 0) {
    return res.status(400).json({ error: 'Queries must be a non-empty array' });
  }

  if (!document) {
    return res.status(400).json({ error: 'Document is required' });
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
      res.json({ results: completeResults });
    } else {
      console.error('Claude API error:', data);
      res.status(500).json({ error: 'Chyba při vyhledávání' });
    }
  } catch (error) {
    console.error('Batch search error:', error);
    res.status(500).json({ error: 'Chyba při vyhledávání' });
  }
});

app.post('/api/search', async (req, res) => {
  const { query, document } = req.body;

  if (!query || !document) {
    return res.status(400).json({ error: 'Query a document jsou povinné' });
  }

  console.log(`[API] Vyhledávání: "${query.substring(0, 50)}..."`);

  const result = await callClaudeAPI(query, document);

  if (result.success) {
    console.log(`[API] Odpověď: "${result.answer.substring(0, 100)}..."`);

    // Include fullContext if present (for yes/no questions)
    const response = {
      answer: result.answer,
      confidence: 0.95
    };

    if (result.fullContext !== undefined) {
      console.log(`[API] 🎯 fullContext detected! Length: ${result.fullContext.length}`);
      console.log(`[API] 🎯 fullContext preview: "${result.fullContext.substring(0, 150)}..."`);
      response.fullContext = result.fullContext;
    } else {
      console.log(`[API] ⚠️ No fullContext in response`);
    }

    res.json(response);
  } else {
    const status = result.status || 500;
    console.error(`[API] Chyba:`, result.error);
    res.status(status).json({
      error: result.error?.message || 'Chyba při vyhledávání',
      answer: null
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server běží na portu ${PORT}`);
});