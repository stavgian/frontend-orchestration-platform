/** Where the scenario configuration is served from; resolved against `<base href>` so GitHub Pages sub-paths work. */
export const scenarioUrl = new URL('assets/scenario.json', document.baseURI).toString();
