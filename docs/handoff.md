# Nextep — tilanne ja seuraavat askeleet

Päivitetty 2026-10-09. Tämä tiedosto on jatkoa varten: lue tämä, sitten `README.md`, `docs/idea.md` ja `docs/proposal.md`.

## Missä ollaan (v0.1.0-alpha)

Valmiina:

- SvelteKit (SSR) + PostgreSQL/PostGIS + Drizzle. Moduulit `src/lib/server/modules/*` (identity, churchtools, organizations, taxonomy, events, discovery, featuring, media, calendar, seo), jokaisella README.
- Tapahtumat iCalendar-mallissa (RRULE, EXDATE, TZID), DST-turvallinen toisto, ICS-syötteet.
- Kirjautuminen: sähköposti + salasana **ja** ChurchTools-OAuth (seurakunnan oma instanssi). Seurakunta rekisteröityy itse (`/register`) → organisaatio `in_review` → ylläpito vahvistaa. ChurchToolsin sähköposteihin ei luoteta: ei linkitystä sähköpostilla, liittäminen Oma tili -sivulla. `ADMIN_EMAILS` vain salasanakirjautumisessa, `npm run create-admin` uudelle asennukselle.
- **Etusivu ilman manuaalista nostoa** (2026-09-29): tapahtuma pääsee etusivulle automaattisesti, jos sillä on kuva ja ≥200 merkin kuvaus. Organisaatiolta enintään `front_page_limit` (oletus 5, admin 0–10) tapahtumaa samalta viikolta; mitkä, ratkaistaan kävijäkohtaisesti rankingilla (`row_number() over (partition by org …)` `discovery/search.ts`:ssä). `event_features`-taulu ja Nosta-painikkeet poistettu (migraatio 0005). Hallinnassa näkyy tapahtumakohtaisesti, mitä etusivulta puuttuu.
- Kuvat (JPEG/PNG/WebP, max 3 Mt) Postgresissa `bytea`, pienennys selaimessa.
- Palautechat kirjautuneille (`FEEDBACK_CHAT_URL`, `FEEDBACK_SECRET`), pois päältä ilman niitä.
- Vaalea teema. Yksikkötestit (`npm test`), svelte-check ja lint.

### Haun uudistus (tehty 2026-09-29)

- **Yksi näkymä:** haku on etusivulla (`SEARCH_PATH = '/'`). `/search` ohjaa 308:lla etusivulle parametreineen. `/vertailu` ja `FlatListSearch` poistettu.
- **Porrastettu haku** (`discovery/tiered.ts`, `tieredSearch`):
  1. nostetut, jotka täyttävät suodattimet → nostoruudukko + painike "Näytä myös muut tapahtumat (n kpl)" (`?muut=1` listaa muut osumat nostojen alle, sivutettuna);
  2. ei nostettuja osumia → kaikki osumat + ilmoitus "Nostetuista ei löytynyt osumia — alla tulokset kaikista tapahtumista.";
  3. ei mitään → "Mitään ei löytynyt" + ehdotuksina tämän viikon nostot mieltymysten mukaan (ei suodattimia; sijainti vain painottaa).
- **Nostoviikko** tulee päiväsuodattimesta (`featuredWeekFor` → `featuring.weekStartOfDate`), muuten tämä viikko. Otsikko: "Tällä viikolla" / "Ensi viikolla" / "Viikolla d.m.–d.m.".
- `searchEvents` palauttaa `{ events, total }` (`count(*) over ()`) ja tuntee valinnat `frontPageWeek` (vain viikon etusivutapahtumat) ja `excludeIds` (muut-lista = kaikki osumat miinus ruudukossa näkyvät).
- **Suodattimet vs. mieltymykset:** `buildPills` palauttaa `{ filters, prefs }`. Suodattimet ovat pillereinä palkissa; mieltymykset omalla rivillään ja "Mieltymykset"-paneelissa palkin alla (valinnat ovat linkkejä). Kategoriat eivät ole enää "Lisää suodatin" -valikossa.
- **Pikavalinnat** (Lähelläni, Tänään, Viikonloppuna) aina palkin yläpuolella; suodatinvalikko aukeaa palkin alle muiden rivien päälle. Jos sijaintia ei saa (esim. http-lähiverkko), dev-tilassa käytetään Helsinkiä, tuotannossa avataan paikkavalinta; `showQuickPicks`- ja `onChange`-propit poistettu.
- Ylätunnisteen "Kaikki tapahtumat" → `/?muut=1`.

Ei vielä testattu: nostoviikon vaihtuminen päiväsuodattimella oikealla datalla (demodatassa ei ole ensi viikon nostoja; logiikka yksikkötestattu).

Ei vielä: ei CI:tä (GitHub Actions -työnkulku poistettiin ennen julkaisua), ei kirjautumisyritysten rajoitusta, ei salasanan vaihtoa/unohtunut salasana, ei ICS-tuontia, ei i18n:ää.

## Seuraava tehtävä

Ei sovittu. Ehdokkaita: haun ulkoasun hienosäätö käyttäjän palautteen perusteella, kirjautumisyritysten rajoitus, salasanan palautus.

## Ympäristöt

- Staging: https://staging.nextep.cloudgood.dev (`main`, demodata, rakennetaan uudelleen jokaisen mergen jälkeen).
- PR-esikatselut: `https://pr<n>.nextep.cloudgood.dev`, kukin omalla kopiollaan stagingin datasta.
- Tuotanto: ei vielä. Asetukset: [`coolify.md`](coolify.md).

## Repo

https://github.com/Goodboy-Innovations/nextep (julkinen, haara `main`). Muutokset PR:inä, jonka hyväksyy joku muu kuin tekijä. Paikallinen kehitys: `README.md`.
