# Test Examples for AI Search

## Testovací dokument

Toto je testovací dokument pro vyhledávání různých typů údajů.

### Osobní údaje
- Prodávající: **Jan Novák**, rodné číslo: 940919/1022
- Kupující: Marie Svobodová, RČ: 850623/3456
- Svědek: Pavel Dvořák, datum narození: 15.3.1978

### Finanční údaje  
- Kupní cena: 7 850 000 Kč
- Záloha: 785 000 CZK
- RPSN: 5,9%
- Úroková sazba: 3.45 %
- Poplatek za zpracování: 12 500 Kč

### Bankovní údaje
- Číslo účtu prodávajícího: 123456789/0800
- IBAN kupujícího: CZ6508000000192000145399
- Variabilní symbol: 2024001

### Nemovitost
- Parcelní číslo: 234/5
- Katastrální území: Vinohrady
- List vlastnictví: 1234
- Výměra pozemku: 856 m²

### Důležitá data
- Datum podpisu smlouvy: 15.12.2024
- Datum splatnosti: 31/01/2025
- Termín předání: 2025-02-15

## Testovací dotazy

### 1. Rodné číslo
- "Najdi rodné číslo prodávajícího"
- "Jaké je RČ kupujícího"
- "Ukaž všechna rodná čísla"

### 2. Částky
- "Jaká je kupní cena"
- "Kolik činí záloha"
- "Najdi všechny částky v Kč"

### 3. RPSN a procenta
- "Jaká je RPSN"
- "Najdi úrokovou sazbu"
- "Ukaž všechny procentuální hodnoty"

### 4. Bankovní účty
- "Číslo účtu prodávajícího"
- "Najdi IBAN"
- "Ukaž bankovní spojení"

### 5. Data
- "Kdy byla podepsána smlouva"
- "Termín splatnosti"
- "Najdi všechna data v dokumentu"

### 6. Parcelní čísla
- "Jaké je parcelní číslo"
- "Najdi číslo parcely"

### 7. Jména
- "Kdo je prodávající"
- "Jméno kupujícího"
- "Seznam všech osob"

## Očekávané výsledky

Pro každý typ hodnoty by měl systém:
1. Správně identifikovat typ hodnoty
2. Validovat formát (např. rodné číslo má správný formát)
3. Najít všechny výskyty v dokumentu
4. Zvýraznit přesně danou hodnotu (ne víc, ne míň)
5. Při nenalezení zobrazit varování
6. Logovat validaci a případné nesrovnalosti