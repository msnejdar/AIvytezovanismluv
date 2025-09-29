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
          'x-api-key': process.env.VITE_CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{
            role: 'user',
          content: `Analyzuj následující text a nalezni přesně to, co požaduje dotaz. Vrať odpověď v JSON formátu s jednotlivými výsledky jako klikatelnými položkami.

DOTAZ: "${query}"

TEXT DOKUMENTU:
${document}

INSTRUKCE:
- Vrať odpověď ve formátu: {"results": [{"label": "popis", "value": "hodnota", "highlight": "text k zvýraznění", "start": 123, "end": 456}]}
- start a end jsou integer indexy (0-based) do původního TEXTU DOKUMENTU.
- highlight musí být přesný úsek textu mezi indexy start a end (ověřit, že text.substring(start, end) === highlight).
- label: krátký popis co to je (např. "Rodné číslo Jana Dvořáka")
- value: čistá hodnota (např. "123456/7890")
- Pokud nic nenajdeš: {"results": []}

Příklady:
Dotaz "rodné číslo Jana Dvořáka" → {"results": [{"label": "Rodné číslo Jana Dvořáka", "value": "123456/7890", "highlight": "123456/7890", "start": 234, "end": 246}]}
Dotaz "celková kupní cena" → {"results": [{"label": "Celková kupní cena", "value": "7 850 000 Kč", "highlight": "7 850 000", "start": 1234, "end": 1242}]}`
          }]
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        return { success: true, data };
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

app.post('/api/search', async (req, res) => {
  const { query, document } = req.body;

  if (!query || !document) {
    return res.status(400).json({ error: 'Query and document are required' });
  }

  const result = await callClaudeAPI(query, document);
  
  if (result.success) {
    res.json(result.data);
  } else {
    const status = result.status || 500;
    res.status(status).json({ error: result.error });
  }
});

app.listen(PORT, () => {
  console.log(`Server běží na portu ${PORT}`);
});