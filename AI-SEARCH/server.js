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
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
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

app.post('/api/search', async (req, res) => {
  const { query, document } = req.body;

  if (!query || !document) {
    return res.status(400).json({ error: 'Query a document jsou povinné' });
  }

  console.log(`[API] Vyhledávání: "${query.substring(0, 50)}..."`);

  const result = await callClaudeAPI(query, document);

  if (result.success) {
    console.log(`[API] Odpověď: "${result.answer.substring(0, 100)}..."`);
    res.json({ answer: result.answer, confidence: 0.95 });
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