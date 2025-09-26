// Test data specifically for Czech language and diacritics handling

export const czechTestDocument = `
Smlouva o koupi nemovitosti

Prodávající: Ing. Jan Novák, rodné číslo: 940919/1022, bytem Praha 2, Vinohrady, 
ul. Míru 123/45, PSČ 120 00.
Číslo účtu: 123456789/0800, IBAN: CZ6508000000192000145399

Kupující: Marie Svobodová (rozená Černá), narozena 23.6.1985, RČ: 850623/3456, 
bytem Brno, Štýřice, Kosmonautů 78, PSČ 615 00.
Bankovní spojení: 987654321/2700

Předmět koupě:
- Pozemek parcelní číslo: 234/5 v k.ú. Vinohrady
- List vlastnictví č. LV 1234/Vinohrady  
- Výměra: 856 m²

Kupní cena a platební podmínky:
- Celková kupní cena: 7 850 000 Kč (slovy: sedm milionů osm set padesát tisíc korun českých)
- Záloha při podpisu: 785 000 CZK
- RPSN: 5,9%
- Úroková sazba: 3.45 % p.a.
- Poplatek za zpracování úvěru: 12 500 Kč

Důležitá data:
- Datum podpisu smlouvy: 15.12.2024
- Datum splatnosti zálohky: 31/01/2025  
- Termín předání nemovitosti: 2025-02-15

Další účastníci:
- Realitní makléř: Ing. Pavel Dvořák, tel.: +420 603 123 456
- Právník kupujícího: JUDr. Kateřina Nováková, mob.: 724 987 654
- Znalec: Ing. Tomáš Procházka, Ph.D., kontakt: tprocházka@znalci.cz
`

export const diacriticsTestCases = [
  // Czech characters with their ASCII equivalents
  { original: 'ěščřžýáíéúůďťň', normalized: 'escrzyaieuudtn' },
  { original: 'ĚŠČŘŽÝÁÍÉÚŮĎŤŇ', normalized: 'escrzyaieuudtn' },
  { original: 'příliš žluťoučký kůň', normalized: 'prilis zlutoucky kun' },
  { original: 'PŘÍLIŠ ŽLUŤOUČKÝ KŮŇ', normalized: 'prilis zlutoucky kun' },
  { original: 'čeština', normalized: 'cestina' },
  { original: 'ČEŠTINA', normalized: 'cestina' }
]

export const validationTestCases = {
  birthNumbers: [
    // Valid formats
    { value: '940919/1022', valid: true },
    { value: '850623/3456', valid: true },
    { value: '123456/7890', valid: true },
    { value: '000101/123', valid: true },
    // Invalid formats
    { value: '94091/1022', valid: false },
    { value: '940919-1022', valid: false },
    { value: '940919/10222', valid: false },
    { value: 'abcdef/1234', valid: false }
  ],
  
  amounts: [
    // Valid formats
    { value: '7 850 000 Kč', valid: true },
    { value: '785 000 CZK', valid: true },
    { value: '12 500 Kč', valid: true },
    { value: '1,234.56 EUR', valid: true },
    { value: '999.99', valid: true },
    // Invalid formats  
    { value: '7,850,000 Kč', valid: false },
    { value: 'abc Kč', valid: false },
    { value: '123,456.789 EUR', valid: false }
  ],
  
  rpsn: [
    // Valid formats
    { value: '5,9%', valid: true },
    { value: '3.45%', valid: true },
    { value: '12%', valid: true },
    { value: '0.5%', valid: true },
    // Invalid formats
    { value: '5,9', valid: false },
    { value: '123.4%', valid: false },
    { value: 'abc%', valid: false }
  ],
  
  bankAccounts: [
    // Valid formats
    { value: '123456789/0800', valid: true },
    { value: '987654321/2700', valid: true },
    { value: '19-2000145399/0800', valid: true },
    // Invalid formats
    { value: '123456789-0800', valid: false },
    { value: '123456789/08000', valid: false },
    { value: 'abcd/1234', valid: false }
  ],
  
  ibans: [
    // Valid formats  
    { value: 'CZ6508000000192000145399', valid: true },
    { value: 'CZ65 0800 0000 1920 0014 5399', valid: false }, // spaces not handled in basic validation
    { value: 'SK3112000000198742637541', valid: true },
    // Invalid formats
    { value: 'CZ650800000019200014539', valid: false },
    { value: '6508000000192000145399', valid: false },
    { value: 'CZ65abcd0000192000145399', valid: false }
  ]
}

export const fuzzySearchTestCases = [
  // Exact matches
  { 
    query: 'Jan Novák', 
    document: czechTestDocument,
    expectedMatches: ['Jan Novák'],
    matchType: 'exact'
  },
  
  // Case insensitive
  {
    query: 'jan novák',
    document: czechTestDocument, 
    expectedMatches: ['Jan Novák'],
    matchType: 'case_insensitive'
  },
  
  // Diacritics insensitive
  {
    query: 'jan novak',
    document: czechTestDocument,
    expectedMatches: ['Jan Novák'], 
    matchType: 'diacritics_insensitive'
  },
  
  // Birth number patterns
  {
    query: '940919/1022',
    document: czechTestDocument,
    expectedMatches: ['940919/1022'],
    matchType: 'exact'
  },
  
  // Amount patterns
  {
    query: '7 850 000',
    document: czechTestDocument,
    expectedMatches: ['7 850 000 Kč'],
    matchType: 'partial'
  },
  
  // Percentage patterns
  {
    query: 'RPSN',
    document: czechTestDocument,
    expectedMatches: ['5,9%'],
    matchType: 'contextual'
  }
]

export const performanceTestData = {
  small: 'A'.repeat(1000), // 1KB
  medium: 'A'.repeat(100000), // 100KB  
  large: 'A'.repeat(1000000), // 1MB
  huge: 'A'.repeat(10000000) // 10MB
}

export const edgeCaseTestData = {
  empty: '',
  whitespace: '   \n\t  ',
  unicode: '🔍 Search test with emojis 💯 and unicode ñáéíóú',
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  mixedContent: `
    HTML tags: <div>test</div> <script>alert('xss')</script>
    Markdown: **bold** *italic* [link](http://example.com)
    Czech: žluťoučký kůň úpěl ďábelské ódy
    Numbers: 123 456.789 €50,000
    Birth numbers: 940919/1022 850623/3456
  `,
  longLines: 'This is a very long line that exceeds typical text width limits and should test how the search algorithm handles extremely long single lines without breaking or causing performance issues. '.repeat(100),
  deepNesting: `Level 1
    Level 2
      Level 3
        Level 4
          Level 5
            Level 6
              Level 7
                Level 8
                  Level 9
                    Level 10 - nested content test`
}

export const highlightingTestCases = [
  {
    name: 'Single match',
    text: 'Jan Novák je prodávající',
    query: 'Jan Novák', 
    expectedRanges: [{ start: 0, end: 8 }]
  },
  {
    name: 'Multiple matches',
    text: 'Jan Novák a Pavel Novák jsou bratři',
    query: 'Novák',
    expectedRanges: [{ start: 4, end: 9 }, { start: 18, end: 23 }]
  },
  {
    name: 'Overlapping ranges',
    text: 'Jan Novák Novák',
    query: 'Novák', 
    expectedRanges: [{ start: 4, end: 9 }, { start: 10, end: 15 }]
  },
  {
    name: 'Case insensitive highlighting',
    text: 'JAN NOVÁK je prodávající',
    query: 'jan novák',
    expectedRanges: [{ start: 0, end: 9 }]
  },
  {
    name: 'Diacritics insensitive highlighting', 
    text: 'Žluťoučký kůň úpěl',
    query: 'zlutoucky kun',
    expectedRanges: [{ start: 0, end: 9 }, { start: 10, end: 13 }]
  }
]