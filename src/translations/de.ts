import type { TranslationKeys } from './index'

export const de: TranslationKeys = {
  common: {
    loading: 'Laden…',
    error: 'Etwas ist schiefgelaufen',
    submit: 'Absenden',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    save: 'Speichern',
    close: 'Schließen',
    back: 'Zurück',
  },
  feed: {
    title: 'Entdecken',
    empty: 'Gerade keine Duas. Schau später nochmal vorbei.',
    onboarding: {
      title: 'Willkommen bei Ameen',
      subtitle: 'Wische nach rechts für Ameen. Wische nach links zum Überspringen.',
      start: 'Los geht’s',
    },
    cover: {
      title: 'Ameen',
      subtitle: 'Jemand braucht dein Dua',
    },
    breathing: {
      title: 'Nimm dir einen Moment',
    },
    summary: {
      title: 'Sitzung beendet',
      ameenCount: 'Du hast {{count}} Mal Ameen gesagt',
      passCount: 'Du hast {{count}} Mal übersprungen',
      done: 'Fertig',
      keepGoing: 'Weitermachen',
    },
  },
  card: {
    categories: {
      general: 'Allgemein',
      health: 'Gesundheit',
      family: 'Familie',
      finances: 'Finanzen',
      guidance: 'Rechtleitung',
      forgiveness: 'Vergebung',
      deceased: 'Verstorbene',
      hardship: 'Prüfung',
    },
    swipe: {
      ameen: 'Ameen',
      pass: 'Überspringen',
    },
  },
  create: {
    title: 'Dua teilen',
    placeholder: 'Schreib dein Dua hier…',
    categoryLabel: 'Kategorie',
    submitting: 'Wird gesendet…',
    reviewNote: 'Dein Dua wird geprüft, bevor es veröffentlicht wird.',
  },
  myDuas: {
    title: 'Meine Duas',
    empty: 'Du hast noch keine Duas geteilt.',
    ameenCount: '{{count}} Ameen',
    status: {
      pending: 'Wird geprüft',
      approved: 'Veröffentlicht',
      rejected: 'Abgelehnt',
    },
    deleteConfirm: 'Bist du sicher, dass du dieses Dua löschen möchtest?',
    editReviewNote: 'Bearbeiten schickt dein Dua zurück zur Prüfung.',
  },
  review: {
    title: 'Prüfwarteschlange',
    empty: 'Keine Duas zur Prüfung.',
    approve: 'Genehmigen',
    reject: 'Ablehnen',
  },
  nav: {
    feed: 'Feed',
    myDuas: 'Meine Duas',
    review: 'Prüfen',
  },
}
