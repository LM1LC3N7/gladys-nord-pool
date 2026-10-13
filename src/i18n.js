// -----------------------------------------------------------------------------
// Runtime texts shown in Gladys (connection status, action results, widget).
// Every text is a { en, fr } object: Gladys picks the user's language.
// -----------------------------------------------------------------------------

export const T = {
  starting: {
    en: 'Reading the Nord Pool prices…',
    fr: 'Lecture des prix Nord Pool…',
  },
  ok: (areas, tomorrow) => ({
    en: `Prices of ${areas.join(', ')} for today${tomorrow ? ' and tomorrow' : ''}.`,
    fr: `Prix de ${areas.join(', ')} pour aujourd'hui${tomorrow ? ' et demain' : ''}.`,
  }),
  noPrices: (areas) => ({
    en: `Nord Pool publishes no price for ${areas.join(', ')} today: check the areas in the configuration.`,
    fr: `Nord Pool ne publie aucun prix pour ${areas.join(', ')} aujourd'hui : vérifiez les zones dans la configuration.`,
  }),
  unreachable: (message) => ({
    en: `Nord Pool is unreachable: ${message}. Retrying in a few minutes.`,
    fr: `Nord Pool est injoignable : ${message}. Nouvel essai dans quelques minutes.`,
  }),
  stale: (areas, message) => ({
    en: `Showing the last prices read for ${areas.join(', ')}; Nord Pool is unreachable: ${message}.`,
    fr: `Affichage des derniers prix lus pour ${areas.join(', ')} ; Nord Pool est injoignable : ${message}.`,
  }),
  level: {
    very_cheap: { en: 'Very cheap', fr: 'Très bon marché' },
    cheap: { en: 'Cheap', fr: 'Bon marché' },
    normal: { en: 'Normal', fr: 'Normal' },
    expensive: { en: 'Expensive', fr: 'Cher' },
    very_expensive: { en: 'Very expensive', fr: 'Très cher' },
  },
  widget: {
    now: { en: 'Now', fr: 'Maintenant' },
    next: { en: 'Next', fr: 'Ensuite' },
    today: { en: 'Today avg.', fr: 'Moy. du jour' },
    tomorrow: { en: 'Tomorrow avg.', fr: 'Moy. de demain' },
    levelRow: { en: 'Price level', fr: 'Niveau de prix' },
    cheapest: (hours) => ({
      en: `Cheapest ${hours} h`,
      fr: `${hours} h les moins chères`,
    }),
    tomorrowRow: { en: "Tomorrow's prices", fr: 'Prix de demain' },
    published: { en: 'Published', fr: 'Publiés' },
    notYet: { en: 'Not yet (around 13:00 CET)', fr: 'Pas encore (vers 13 h CET)' },
    chart: { en: 'Day-ahead price', fr: 'Prix du lendemain' },
    noData: {
      en: 'No price yet: the integration reads Nord Pool every hour.',
      fr: "Pas encore de prix : l'intégration lit Nord Pool toutes les heures.",
    },
    min: { en: 'min', fr: 'min' },
    max: { en: 'max', fr: 'max' },
  },
};

/** The text of the test_connection action, a { en, fr } object. */
export function connectionReport({ areas, currency, now, tomorrow }) {
  const lines = { en: [], fr: [] };
  for (const area of areas) {
    const state = now.get(area);
    if (!state) {
      lines.en.push(`${area}: no price`);
      lines.fr.push(`${area} : aucun prix`);
      continue;
    }
    const price = state.slot.price.toFixed(4);
    const avg = state.stats.avg.toFixed(4);
    lines.en.push(
      `${area}: ${price} ${currency}/kWh now (${T.level[state.level].en.toLowerCase()}), ${avg} on average today`,
    );
    lines.fr.push(
      `${area} : ${price} ${currency}/kWh maintenant (${T.level[state.level].fr.toLowerCase()}), ${avg} en moyenne aujourd'hui`,
    );
  }
  const tomorrowText = tomorrow
    ? { en: "tomorrow's prices are published", fr: 'les prix de demain sont publiés' }
    : {
        en: "tomorrow's prices are not published yet",
        fr: 'les prix de demain ne sont pas encore publiés',
      };
  return {
    en: `Nord Pool OK. ${lines.en.join('; ')}; ${tomorrowText.en}.`,
    fr: `Nord Pool OK. ${lines.fr.join(' ; ')} ; ${tomorrowText.fr}.`,
  };
}
