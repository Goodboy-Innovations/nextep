# Nextep — tilanne ja seuraavat askeleet

Päivitetty 2026-09-29. Tämä tiedosto on jatkoa varten: lue tämä, sitten `README.md`, `docs/idea.md` ja `docs/proposal.md`.

## Missä ollaan (v0.1.0-alpha)

Valmiina ja testattuna upotettua Postgresia (PGlite + PostGIS) vasten:

- SvelteKit (SSR) + PostgreSQL/PostGIS + Drizzle. Moduulit `src/lib/server/modules/*` (identity, organizations, taxonomy, events, discovery, featuring, media, calendar, seo), jokaisella README.
- Tapahtumat iCalendar-mallissa (RRULE, EXDATE, TZID), DST-turvallinen toisto, ICS-syötteet.
- Kirjautuminen: sähköposti + salasana **ja** ChurchTools-OAuth (seurakunnan oma instanssi). Seurakunta rekisteröityy itse (`/register`) → organisaatio `in_review` → ylläpito vahvistaa. ChurchToolsin sähköposteihin ei luoteta: ei linkitystä sähköpostilla, liittäminen Oma tili -sivulla. `ADMIN_EMAILS` vain salasanakirjautumisessa, `npm run create-admin` uudelle asennukselle.
- **Etusivu ilman manuaalista nostoa** (2026-09-29): tapahtuma pääsee etusivulle automaattisesti, jos sillä on kuva ja ≥200 merkin kuvaus. Organisaatiolta enintään `front_page_limit` (oletus 5, admin 0–10) tapahtumaa samalta viikolta; mitkä, ratkaistaan kävijäkohtaisesti rankingilla (`row_number() over (partition by org …)` `discovery/search.ts`:ssä). `event_features`-taulu ja Nosta-painikkeet poistettu (migraatio 0005). Hallinnassa näkyy tapahtumakohtaisesti, mitä etusivulta puuttuu.
- Kuvat (JPEG/PNG/WebP, max 3 Mt) Postgresissa `bytea`, pienennys selaimessa.
- Vaalea teema. 38 yksikkötestiä, svelte-check ja lint puhtaina.

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

Ei vielä testattu: nostoviikon vaihtuminen päiväsuodattimella oikealla datalla (demodatassa ei ole ensi viikon nostoja; logiikka yksikkötestattu). Selainta ei ole käytössä, joten käyttöliittymä on tarkistettu vain SSR-HTML:stä — katso ulkoasu itse.

Ei vielä: Docker-pinoa ei ole ajettu kertaakaan (WSL-integraatio puuttui), ei CI:tä (GitHub Actions -työnkulku poistettiin ennen julkaisua), ei kirjautumisyritysten rajoitusta, ei salasanan vaihtoa/unohtunut salasana, ei ICS-tuontia, ei i18n:ää.

## Seuraava tehtävä

Ei sovittu. Ehdokkaita: haun ulkoasun hienosäätö käyttäjän palautteen perusteella, kirjautumisyritysten rajoitus, salasanan palautus.

## Repo

Julkinen: https://github.com/Jakeksii/nextep (haara `main`).

## Ympäristö (tämä kone, WSL)

- Projekti: `/home/claude/Work/nextep`. Docker ei ole käytettävissä WSL:ssä (NAT-verkko, integraatio pois).
- Kehitystietokanta: PGlite-palvelin scratch-kansiossa (`…/scratchpad/pg/server-persistent.mjs`, data `…/pg/data`), portti 55432, **vain yksi yhteys** → aja dev-palvelin `DATABASE_POOL_MAX=1`. Scratch-kansio on istuntokohtainen: uudessa istunnossa luo uusi (kopioi skripti) tai käytä Dockeria, kun se toimii.
  ```sh
  DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres DATABASE_POOL_MAX=1 npm run db:migrate
  DATABASE_URL=… DATABASE_POOL_MAX=1 npm run db:seed          # tyhjään kantaan, tai täydentää demot
  DATABASE_URL=… DATABASE_POOL_MAX=1 npx vite dev --host 0.0.0.0 --port 5173
  ```
- Lähiverkko: Windowsissa porttiohjaus `netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=<WSL-IP>` + palomuurisääntö. WSL-IP vaihtuu uudelleenkäynnistyksessä (`ip -4 addr show eth0`).
- Demotunnukset: `admin@example.com` / `nextep-admin`, `jarjestaja@example.com` / `nextep-demo`.
- Varoitus: `timeout N node build` ei sammuta tuotantopalvelinta luotettavasti — tarkista `pgrep -af "node build"` testien jälkeen.
