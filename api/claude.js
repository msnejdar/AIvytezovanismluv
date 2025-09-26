// Enhanced Claude API for super intelligent contract document analysis
const CONTRACT_ANALYSIS_PROMPT = `Jste expert na analýzu smluv a právních dokumentů. Vaším úkolem je najít v textu přesně to, co uživatel hledá, s 100% přesností.

SPECIALIZACE:
- Kupní smlouvy a převody nemovitostí
- Smlouvy o dílo, dodávky a služby  
- Nájemní smlouvy a pronájmy
- Úvěrové smlouvy a hypotéky
- Pracovní smlouvy a dohody
- České právní dokumenty a úřední spisy

PŘESNÉ VYHLEDÁVÁNÍ:
1. OSOBNÍ ÚDAJE: jména, příjmení, rodná čísla, adresy, telefony
2. FINANČNÍ ÚDAJE: kupní ceny, částky, úroky, poplatky, účty  
3. NEMOVITOSTI: parcelní čísla, čísla popisná, adresy objektů
4. DATUMY: podpisy smluv, lhůty, termíny, narození
5. IDENTIFIKÁTORY: čísla smluv, spisové značky, evidenční čísla
6. PRÁVNÍ KLAUZULE: podmínky, závazky, práva a povinnosti

FORMÁT ODPOVĚDI - POUZE JSON:
{
  "results": [
    {
      "label": "Přesný popis nalezeného",
      "value": "Přesná hodnota z dokumentu", 
      "start": pozice_zacatku_v_textu,
      "end": pozice_konce_v_textu,
      "confidence": 0.95,
      "type": "typ_udaje",
      "context": "Okolní kontext pro porozumění"
    }
  ]
}

DŮLEŽITÉ:
- Vraťte POUZE přesný text z dokumentu
- Indexy start/end musí být naprosto přesné
- Neinterpretujte, nepřeformulujte, nekracte
- Pokud něco nenajdete, vraťte prázdné results: []
- Vždy uveďte confidence score (0.0-1.0)`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, document } = req.body;

  if (!query || !document) {
    return res.status(400).json({ error: 'Query and document are required' });
  }

  try {
    // Detect query intent and enhance for contract analysis
    const enhancedQuery = enhanceQueryForContracts(query);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.VITE_CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        temperature: 0.1, // Low temperature for precise extraction
        messages: [{
          role: 'user',
          content: `${CONTRACT_ANALYSIS_PROMPT}

UŽIVATELSKÝ DOTAZ: "${enhancedQuery}"

DOKUMENT K ANALÝZE:
${document}

Analyzujte dokument a najděte vše související s dotazem. Vraťte pouze JSON odpověď s přesnými pozicemi a hodnotami.`
        }]
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      // Validate and enhance the response
      const processedData = validateAndProcessResponse(data, document, query);
      res.status(200).json(processedData);
    } else {
      console.error('Claude API Error:', data);
      res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

/**
 * Enhance query for better contract analysis
 */
function enhanceQueryForContracts(query) {
  const enhancements = {
    // Personal data patterns
    'jméno': 'jméno, příjmení, celé jméno osoby, prodávající, kupující, nájemce, pronajímatel',
    'osoba': 'jméno a příjmení, fyzická osoba, právnická osoba, smluvní strana',
    'rodné': 'rodné číslo, RC, identifikační číslo osoby',
    'telefon': 'telefonní číslo, mobil, kontakt, telefon',
    'adresa': 'adresa bydliště, adresa sídla, ulice, město, PSČ, kontaktní adresa',
    
    // Financial patterns  
    'cena': 'kupní cena, prodejní cena, cena díla, celková cena, konečná cena',
    'částka': 'peněžní částka, suma, hodnota, finanční závazek, dlužná částka',
    'úrok': 'úroková sazba, úrok z prodlení, RPSN, roční procento',
    'poplatek': 'správní poplatek, poplatek za službu, bankovní poplatek',
    'účet': 'bankovní účet, číslo účtu, IBAN, platební účet',
    
    // Property patterns
    'nemovitost': 'pozemek, stavba, byt, dům, nemovitá věc, objekt',
    'parcela': 'parcelní číslo, pozemková parcela, stavební parcela',
    'popisné': 'číslo popisné, číslo evidenční, adresa objektu',
    
    // Date and time
    'datum': 'datum podpisu, datum uzavření, termín, lhůta, den',
    'lhůta': 'termín plnění, lhůta splatnosti, doba trvání',
    
    // Legal terms
    'smlouva': 'smluvní ujednání, kontrakt, dohoda, právní vztah',
    'podmínka': 'smluvní podmínka, předpoklad, požadavek, omezení',
    'právo': 'právní nárok, oprávnění, vlastnické právo',
    'povinnost': 'závazek, povinnost, odpovědnost, břemeno'
  };

  let enhanced = query;
  for (const [key, expansion] of Object.entries(enhancements)) {
    if (query.toLowerCase().includes(key)) {
      enhanced = `${query} (hledat také: ${expansion})`;
      break;
    }
  }
  
  return enhanced;
}

/**
 * Validate and process Claude's response for accuracy
 */
function validateAndProcessResponse(data, document, originalQuery) {
  try {
    if (!data.content || !data.content[0]?.text) {
      return data;
    }

    const responseText = data.content[0].text.trim();
    
    // Try to parse as JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      // If not valid JSON, try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          console.warn('Could not parse JSON from response');
          return data;
        }
      } else {
        console.warn('No JSON found in response');
        return data;
      }
    }

    if (parsedResponse.results && Array.isArray(parsedResponse.results)) {
      // Validate each result
      parsedResponse.results = parsedResponse.results
        .map(result => validateResult(result, document))
        .filter(result => result !== null);
      
      // Update the response
      return {
        ...data,
        content: [{
          ...data.content[0],
          text: JSON.stringify(parsedResponse)
        }]
      };
    }

    return data;
  } catch (error) {
    console.error('Error processing response:', error);
    return data;
  }
}

/**
 * Validate individual result for accuracy
 */
function validateResult(result, document) {
  if (!result.value || typeof result.start !== 'number' || typeof result.end !== 'number') {
    return null;
  }

  const { start, end, value } = result;
  
  // Check if indices are valid
  if (start < 0 || end > document.length || start >= end) {
    console.warn('Invalid indices for result:', result);
    return null;
  }

  // Extract actual text from document
  const actualText = document.slice(start, end);
  
  // Check if extracted text matches the claimed value
  if (actualText.trim() !== value.trim()) {
    console.warn('Text mismatch:', { expected: value, actual: actualText });
    
    // Try to find the correct position
    const correctMatch = findCorrectPosition(value, document, start);
    if (correctMatch) {
      return {
        ...result,
        start: correctMatch.start,
        end: correctMatch.end,
        value: correctMatch.text,
        confidence: Math.max(0.5, (result.confidence || 0.8) - 0.2) // Reduce confidence for corrections
      };
    }
    return null;
  }

  return result;
}

/**
 * Find correct position of text in document
 */
function findCorrectPosition(searchText, document, hintPosition) {
  const normalizedSearch = searchText.trim();
  
  // Try exact match first
  let index = document.indexOf(normalizedSearch);
  if (index !== -1) {
    return {
      start: index,
      end: index + normalizedSearch.length,
      text: normalizedSearch
    };
  }

  // Try case insensitive match
  const lowerDoc = document.toLowerCase();
  const lowerSearch = normalizedSearch.toLowerCase();
  index = lowerDoc.indexOf(lowerSearch);
  if (index !== -1) {
    const actualText = document.slice(index, index + normalizedSearch.length);
    return {
      start: index,
      end: index + normalizedSearch.length,
      text: actualText
    };
  }

  // Try fuzzy match near hint position
  const radius = 100;
  const searchStart = Math.max(0, hintPosition - radius);
  const searchEnd = Math.min(document.length, hintPosition + radius);
  const vicinity = document.slice(searchStart, searchEnd);
  
  const fuzzyIndex = vicinity.toLowerCase().indexOf(lowerSearch);
  if (fuzzyIndex !== -1) {
    const actualIndex = searchStart + fuzzyIndex;
    return {
      start: actualIndex,
      end: actualIndex + normalizedSearch.length,
      text: document.slice(actualIndex, actualIndex + normalizedSearch.length)
    };
  }

  return null;
}