# Membership Proof

Yksinkertainen ja yksityisyyttä kunnioittava jäsenyyden todentamisjärjestelmä urheiluseuroille ja yhdistyksille.

## Mikä tämä on?

Järjestelmä, jolla seura voi todentaa jäsenyyden **ilman henkilötietojen käsittelyä**. Jokainen jäsen saa 6-numeroisen koodin (esim. `847291`), jonka voi muistaa ulkoa. Tarkistaja näkee vain "JÄSEN" tai "EI JÄSEN" – ei nimiä, ei henkilötietoja.

**Kenelle sopii:**
- Urheiluseurat (harjoituksiin sisäänkirjautuminen)
- Yhdistykset (tapahtumien kulunvalvonta)
- Kerhot (jäsenetujen tarkistus)

## Miten toimii?

### Vaihe 1: Koodien luonti (seuran ylläpitäjä)

1. Valmistele CSV-tiedosto jäsennimillä (yksi nimi per rivi)
2. Avaa sovellus ja valitse "Generate Codes"
3. Syötä:
   - **Club ID**: Seuran tunniste, esim. `URHEILUSEURA-2025`
   - **Admin Password**: Salainen salasana (vähintään 8 merkkiä)
4. Raahaa CSV-tiedosto lomakkeelle
5. Klikkaa "Generate Member Codes"

**Tuloksena saat:**
- **Club Key**: Pitkä avain, joka jaetaan tarkistajille
- **Jäsenkoodit**: Lista 6-numeroisia koodeja, yksi per jäsen

### Vaihe 2: Koodien jakelu

| Kenelle | Mitä jaetaan | Esimerkki |
|---------|--------------|-----------|
| Valmentajat/tarkistajat | Club Key + Club ID | `vD8kL2...` + `URHEILUSEURA-2025` |
| Jäsenet | 6-numeroinen koodi | `847291` |

### Vaihe 3: Tarkistus (valmentaja/ovimies)

1. Avaa sovellus ja valitse "Verify Member"
2. Syötä Club Key ja Club ID (voi tallentaa selaimen muistiin)
3. Jäsen sanoo koodinsa: "kahdeksan neljä seitsemän kaksi yhdeksän yksi"
4. Syötä koodi → näet VALID MEMBER tai INVALID

## Esimerkki käytännössä

**Tilanne:** Uimaseuran harjoitukset alkavat. Valmentaja tarkistaa jäsenyydet ovella.

```
Valmentaja: "Jäsenkoodi?"
Uimari: "Neljä viisi kuusi kolme kaksi yksi"
Valmentaja: [syöttää 456321] → "VALID MEMBER" ✓
Valmentaja: "Tervetuloa harjoituksiin!"
```

**Toinen tilanne:** Henkilö yrittää päästä sisään ilman jäsenyyttä.

```
Valmentaja: "Jäsenkoodi?"
Henkilö: "Öö... 123456?"
Valmentaja: [syöttää 123456] → "INVALID" ✗
Valmentaja: "Koodi ei kelpaa. Oletko jäsen?"
```

## Koodin rakenne

Jäsenkoodi on **6 numeroa**, esim. `847291`:

```
847 291
 │   │
 │   └── Kryptografinen allekirjoitus (lasketaan avaimella)
 └────── Satunnainen tunniste (000-999)
```

Koodi on sidottu seuran avaimeen. Sama koodi ei toimi toisessa seurassa.

## Tietoturva ja GDPR

### Miksi tämä on GDPR-yhteensopiva?

| Vaatimus | Miten toteutettu |
|----------|------------------|
| **Tietojen minimointi** | Tarkistuksessa ei käsitellä henkilötietoja |
| **Käyttötarkoitussidonnaisuus** | Koodi todistaa vain jäsenyyden |
| **Säilytyksen rajoittaminen** | CSV käsitellään vain muistissa, ei tallenneta |

**6-numeroinen koodi EI ole henkilötieto koska:**
- Se ei sisällä tunnistetietoja
- Sitä ei voi yhdistää henkilöön ilman erillistä rekisteriä
- Seura ei voi selvittää koodin haltijaa

### Turvallisuus

- **Väärennysriski ilman avainta:** 0.1% per yritys
- **Koodit sidottu seuraan:** Väärä Club ID → koodi ei toimi
- **Vuosittainen uusiminen:** Vaihda salasana → uudet koodit

### Rajoitukset

- Maksimi 1000 jäsentä per Club ID
- Isommille seuroille: käytä useita ID:itä (`SEURA-A`, `SEURA-B`)
- Ei sovi korkean turvallisuuden sovelluksiin (pankit, terveydenhuolto)

## Asennus ja käyttö

### Verkkosivuna (GitHub Pages)

Sovellus toimii suoraan selaimessa: **[trotor.github.io/membership-proof](https://trotor.github.io/membership-proof/)**

### Paikallisesti

```bash
git clone https://github.com/trotor/membership-proof.git
cd membership-proof
npm install
npm run dev
```

Avaa `http://localhost:5173` selaimessa.

### Tuotantoversio

```bash
npm run build
```

Staattiset tiedostot `dist/`-kansiossa. Voit kopioida ne mille tahansa web-palvelimelle.

## Usein kysytyt kysymykset

**K: Mitä jos jäsen unohtaa koodinsa?**
V: Generoi uudet koodit samalla salasanalla ja jaa uusi koodi.

**K: Voiko tarkistaja tunnistaa jäsenen koodista?**
V: Ei. Koodi on vain kryptografinen todiste, ei tunniste.

**K: Kuinka usein koodit pitää uusia?**
V: Suositus: vuosittain. Vaihda admin-salasana uuden kauden alussa.

**K: Entä jos meillä on yli 1000 jäsentä?**
V: Käytä useita Club ID:itä, esim. `SEURA-AIKUISET` ja `SEURA-JUNIORIT`.

**K: Toimiiko ilman nettiyhteyttä?**
V: Kyllä, kun sivu on kerran ladattu. Kaikki laskenta tapahtuu selaimessa.

## Tekniset tiedot

- **Avainten johtaminen:** PBKDF2-SHA256 (100 000 iteraatiota)
- **Allekirjoitus:** HMAC-SHA256, katkaistuna 3 numeroon
- **Toteutus:** TypeScript, Vite, Web Crypto API
- **Palvelinriippuvuudet:** Ei mitään – 100% selainpohjainen

## Lisenssi

MIT License

## Tekijä

**Tero Rönkkö**
- GitHub: [github.com/trotor](https://github.com/trotor)
