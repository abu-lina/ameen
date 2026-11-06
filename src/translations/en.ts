export const en = {
  common: {
    loading: 'Loading…',
    error: 'Something went wrong',
    submit: 'Submit',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    save: 'Save',
    close: 'Close',
    back: 'Back',
  },
  feed: {
    title: 'Discover',
    empty: 'No duas right now. Check back later.',
    onboarding: {
      title: 'Welcome to Ameen',
      subtitle: 'Swipe right to say Ameen. Swipe left to pass.',
      start: 'Start',
    },
    cover: {
      title: 'Ameen',
      subtitle: 'Someone needs your dua',
    },
    breathing: {
      title: 'Take a moment',
    },
    summary: {
      title: 'Session complete',
      ameenCount: 'You said Ameen {{count}} times',
      passCount: 'You passed {{count}} times',
      done: 'Done',
      keepGoing: 'Keep going',
    },
  },
  card: {
    categories: {
      general: 'General',
      health: 'Health',
      family: 'Family',
      finances: 'Finances',
      guidance: 'Guidance',
      forgiveness: 'Forgiveness',
      deceased: 'Deceased',
      hardship: 'Hardship',
    },
    swipe: {
      ameen: 'Ameen',
      pass: 'Pass',
    },
  },
  create: {
    title: 'Share a Dua',
    placeholder: 'Write your dua here…',
    categoryLabel: 'Category',
    submitting: 'Submitting…',
    reviewNote: 'Your dua will be reviewed before it goes live.',
  },
  myDuas: {
    title: 'My Duas',
    empty: "You haven't shared any duas yet.",
    ameenCount: '{{count}} Ameen',
    status: {
      pending: 'Pending review',
      approved: 'Live',
      rejected: 'Rejected',
    },
    deleteConfirm: 'Are you sure you want to delete this dua?',
    editReviewNote: 'Editing will send your dua back for review.',
  },
  review: {
    title: 'Review Queue',
    empty: 'No duas to review.',
    approve: 'Approve',
    reject: 'Reject',
  },
  nav: {
    feed: 'Feed',
    myDuas: 'My Duas',
    review: 'Review',
  },
} as const
