# BreatheLocal

BreatheLocal turns a city air-quality forecast into a practical plan for a household. It helps families decide when to move an activity indoors, how to reduce pollution at home, and which solo car trips they could avoid. A shareable brief gives neighbours the local outlook and an action they can coordinate.

## Vertical and persona

**Urban household and community resilience.** The primary persona is a parent or caregiver in a city affected by winter smog. They may have children or other sensitive people at home, limited access to a purifier, and a commute they cannot easily reschedule. New Delhi is the default scenario. The challenge brief supplied here did not list named verticals, so this project uses the household and community focus directly from the problem statement.

## Run locally

Use Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Open [localhost on port 3000](http://127.0.0.1:3000/). The winter example, action plan, community brief, impact calculator, and rule-based coach work immediately. Choose **Load current forecast** or select a different city to retrieve current modeled conditions.

### API and environment settings

| Setting | Use |
| --- | --- |
| `GEMINI_API_KEY` | A [Google AI Studio API key](https://aistudio.google.com/app/apikey) enables the generative coach. The API project needs access to Gemini 2.5 Flash. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-2.5-flash`. |
| Open-Meteo | Air quality and city search use the public, no-key endpoints for this non-commercial challenge demo. [Open-Meteo terms](https://open-meteo.com/en/terms) |

To enable the generative coach locally, copy `.env.example` to `.env`, fill in `GEMINI_API_KEY`, and restart the server. Keep the key in `.env` or your hosting environment variables. The repository tracks only the sample file.

## How decisions are made

- **City outlook.** Open-Meteo geocodes a city and provides CAMS model data. The brief labels its source and local valid time. It displays the U.S. AQI and PM₂.₅ in µg/m³ as separate readings. The chart reserves eight three-hour slots and marks missing readings without shifting the timeline. The window check compares all available, complete three-hour blocks between 07:00 and 19:00 local time, preferring the lowest peak AQI and then the lowest mean. Even the lowest window can be unhealthy.
- **Household action plan.** Shared rules use current AQI, the forecast window, travel mode, schedule flexibility, household sensitivity, and access to a HEPA cleaner. Each card explains the action, its direct effect, and its source. At high AQI the plan prioritizes exposure, and gives an alternative to vigorous outdoor travel.
- **Generative coach.** The user chooses a question. The server sends AQI categories, four household settings, and a short list of relevant action-and-explanation pairs to Gemini 2.5 Flash. Gemini selects one pair using a structured response. The app supplies the selected explanation, safety guidance, and impact from its own vetted rules. Missing credentials, an invalid model response, timeout, or throttling trigger a labeled rule-based answer.
- **Weekly impact.** Displaced car-kilometres equal round-trip distance × avoided trips. The estimate uses the EPA typical gasoline passenger car factor of about 400 g CO₂ per mile, equivalent to about 0.249 kg per kilometre. For example, avoiding two 12 km round trips displaces 24 car-km and about 6.0 kg of tailpipe CO₂. This scenario excludes emissions from replacement travel, lifecycle emissions, and changes to local AQI. [EPA factor](https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle)
- **Community brief.** Copy the city, data source, time, AQI, daytime outlook, and a practical group action. The shared text uses general public guidance and contains no saved household settings.

## Assumptions and design choices

- The January New Delhi scenario is illustrative. Forecasts are city-level modeled estimates and can differ from conditions near schools, roads, or homes. Local alerts and school policies take priority. The app uses U.S. AQI categories consistently, including for Indian cities.
- The daytime window assumes outdoor routines generally occur between 07:00 and 19:00. Indoor recommendations assume household ventilation needs and local safety guidance are followed. The app does not infer an indoor AQI or a personal dose.
- Household settings and the last successful city are saved in the current browser. No account or database is needed. City searches send the query to Open-Meteo. AI calls send the bounded context described above to Google Gemini.
- The coach key stays server-side. API routes validate inputs, time out upstream requests, and cache successful data lookups. The coach runs on explicit request, caps output, and allows 20 Gemini calls per rolling minute per server instance. If Gemini signals exhausted quota, that instance serves rule-based guidance for one minute. On Vercel, the Gemini project quota applies across instances.
- Responsive panels, keyboard-operable controls, labeled dialogs, forecast values with category names, and reduced-motion support make the dashboard usable in different settings.
- The New Delhi hero is an AI-generated illustration of winter smog, used for visual context. [Hero image](public/assets/delhi-winter.jpg)

## Project structure and checks

| Path | Purpose |
| --- | --- |
| `public/` | Dashboard, styles and images, AQI calculations, and household rules |
| `api/` | Vercel-compatible routes for forecasts, city search, and coaching |
| `lib/` | HTTP helpers, coach context, and Gemini response validation |
| `scripts/` | Local server and static build |
| `test/` | Forecast, planning, impact, and route tests |

```sh
npm test
npm run build
```

The tests cover AQI thresholds, local time and missing chart slots, changes to household rules, trip calculations, request validation, the AI fallback, and rejection of unsupported Gemini output against a mocked provider. The production build writes the dashboard to `dist/`. Vercel serves the API routes separately.

## GitHub, Vercel, and submission

1. Copy the source to your other laptop. Create an empty **public** GitHub repository and push the project on a single branch, such as `main`. Keep `.env`, generated builds, and dependency folders out of Git. The included `.gitignore` covers these.
2. Import the repository into Vercel. Keep the repository root as the project root and select **Other** if Vercel asks for a framework. The included `vercel.json` sets the build command, output folder, and headers.
3. Add `GEMINI_API_KEY` in the Vercel project's **Settings → Environment Variables** for Production. `GEMINI_MODEL` is optional. Deploy or redeploy after setting the key.
4. Check the deployed site in a signed-out browser. Load a current forecast, change a household setting, request a coach response marked **AI recommendation**, and preview the share text.
5. Submit the public GitHub URL and the video link if requested by the submission form. Use an unlisted YouTube link or a Drive link that the evaluator can open. Confirm the repository has one branch and is under 10 MB before using one of the three submission attempts.

### Suggested demo

Start with the winter example and explain why the lowest forecast window still needs care. Change **Usual travel** to **Walk or cycle** and show how the action changes. Ask the AI coach about indoor air, adjust the trip scenario, and preview the neighbourhood brief. Finish by loading a current forecast for a different city.

## Data and guidance

- [Open-Meteo Air Quality API and Copernicus CAMS attribution](https://open-meteo.com/en/docs/air-quality-api)
- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- [AirNow air quality and health](https://www.airnow.gov/air-quality-and-health/)
- [AirNow school outdoor activity guide](https://www.airnow.gov/publications/activity-guides-publications/air-quality-and-outdoor-activity-guidance-for-schools/)
- [EPA home air cleaners and air filters](https://www.epa.gov/indoor-air-quality-iaq/air-cleaners-and-air-filters-home)
- [EPA improving indoor air quality](https://www.epa.gov/indoor-air-quality-iaq/improving-indoor-air-quality)


<details>
<summary>Hero image generation prompt</summary>

The hero image was created with the built-in image generator and optimized as a JPEG.

> Create a photorealistic documentary editorial photograph for a civic air-quality dashboard hero, panoramic landscape approximately 3:2. New Delhi, India, during winter smog at dusk, seen from a mid-rise rooftop, with layered densely packed flat rooftops, faint silhouettes of trees, a small muted golden-orange sun glowing through thick atmosphere in the right third toward the top half, and a distant hazy city horizon. Atmospheric warm amber, taupe, olive brown, muted graphite; calm, real, slightly grainy photojournalistic, carefully exposed, no heavy orange grading. Lower half detailed urban silhouettes, above the horizon deep hazy sky. Left half quieter and darker with muted haze for a future UI overlay. No words, no logos, no watermarks, no UI elements.

</details>