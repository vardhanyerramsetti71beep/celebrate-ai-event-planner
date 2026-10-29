// Template-based plan used when the AI service is unavailable,
// so the app always gives the user something useful.
import { EVENT_TYPES, sanitizePlan, weeksUntil } from './plan-core.js';

const TEMPLATES = {
  wedding: {
    budget: [
      ['Venue & rentals', 25], ['Catering & drinks', 28], ['Decor & flowers', 10],
      ['Photography & video', 10], ['Outfits & styling', 9], ['Music & entertainment', 5],
      ['Invitations & stationery', 2], ['Gifts & favours', 3], ['Transport & stay', 3], ['Contingency', 5],
    ],
    vendors: ['Venue', 'Caterer', 'Photographer & videographer', 'Decorator / florist', 'Makeup artist', 'DJ or live band', 'Officiant / priest', 'Invitation designer'],
    ideas: [
      ['Personalised welcome wall', 'A photo timeline of the couple at the entrance that doubles as a guestbook.'],
      ['Live food counters', 'Interactive stations (chaat, pasta, dessert) keep guests moving and engaged.'],
      ['Signature drinks', 'Two drinks named after the couple, one non-alcoholic.'],
      ['Memory lanterns', 'Guests write wishes on lanterns or cards that become a keepsake.'],
    ],
    schedule: [['4:00 PM', 'Guest arrival & welcome drinks'], ['5:00 PM', 'Ceremony'], ['6:00 PM', 'Family photos'], ['6:30 PM', 'Cocktail hour & snacks'], ['7:30 PM', 'Couple entrance & toasts'], ['8:00 PM', 'Dinner'], ['9:00 PM', 'First dance & open dance floor'], ['10:30 PM', 'Send-off']],
  },
  birthday: {
    budget: [
      ['Venue', 20], ['Food & cake', 35], ['Decorations', 12], ['Entertainment & games', 12],
      ['Return gifts', 8], ['Photography', 5], ['Invitations', 2], ['Contingency', 6],
    ],
    vendors: ['Venue / party hall', 'Caterer', 'Cake baker', 'Decorator', 'Entertainer / DJ', 'Photographer'],
    ideas: [
      ['Theme photo booth', 'Props and a backdrop matching the theme, with instant prints.'],
      ['Memory jar', 'Guests drop a favourite memory or wish to read out later.'],
      ['Custom playlist', 'Songs from each year of the birthday person\'s life.'],
      ['DIY dessert bar', 'Cupcakes with toppings so guests decorate their own.'],
    ],
    schedule: [['5:00 PM', 'Guests arrive, welcome snacks'], ['5:30 PM', 'Games & activities'], ['6:30 PM', 'Cake cutting'], ['6:45 PM', 'Speeches & photos'], ['7:00 PM', 'Dinner'], ['8:00 PM', 'Music & dancing'], ['9:00 PM', 'Return gifts & goodbyes']],
  },
  community: {
    budget: [
      ['Venue & permits', 18], ['Food & refreshments', 25], ['Stage, sound & lighting', 15],
      ['Marketing & signage', 10], ['Activities & performers', 12], ['Safety & first aid', 5],
      ['Volunteer kits', 5], ['Cleanup & waste', 4], ['Contingency', 6],
    ],
    vendors: ['Venue / local authority', 'Food stalls / caterer', 'Sound & stage', 'Printing & signage', 'Performers', 'Security & first aid', 'Cleanup crew'],
    ideas: [
      ['Local talent hour', 'An open stage slot for residents to perform.'],
      ['Zero-waste stalls', 'Reusable plates and sorting bins run by volunteers.'],
      ['Kids\' activity zone', 'Face painting and craft corner so families stay longer.'],
      ['Community wall', 'A board where people pin ideas for the neighbourhood.'],
    ],
    schedule: [['8:00 AM', 'Volunteer briefing & setup'], ['10:00 AM', 'Gates open'], ['10:30 AM', 'Opening address'], ['11:00 AM', 'Activities & stalls'], ['1:00 PM', 'Lunch break'], ['2:00 PM', 'Performances'], ['4:30 PM', 'Prize draw & thanks'], ['5:00 PM', 'Close & cleanup']],
  },
};
TEMPLATES.corporate = TEMPLATES.community;
TEMPLATES.other = TEMPLATES.birthday;

const TIMELINE = [
  [1.0, 'Set the budget, guest list draft and priorities', 'Planning'],
  [0.95, 'Shortlist and book the venue', 'Venue'],
  [0.85, 'Book key vendors (catering, photography)', 'Vendors'],
  [0.75, 'Decide the theme, colours and decor style', 'Design'],
  [0.65, 'Send save-the-dates or announcements', 'Guests'],
  [0.55, 'Book entertainment and remaining vendors', 'Vendors'],
  [0.45, 'Finalise menu and tasting', 'Food'],
  [0.4, 'Send invitations and open RSVPs', 'Guests'],
  [0.3, 'Order outfits, decor items and favours', 'Shopping'],
  [0.2, 'Confirm headcount with caterer', 'Food'],
  [0.12, 'Create the day-of schedule and share with vendors', 'Planning'],
  [0.06, 'Confirm every vendor: time, address, payment', 'Vendors'],
  [0.03, 'Prepare emergency kit and final payments', 'Planning'],
  [0, 'Event day — enjoy it!', 'Event'],
];

export function fallbackPlan(input) {
  const t = TEMPLATES[input.type] || TEMPLATES.other;
  const weeks = Math.min(weeksUntil(input.date), 52);
  const label = EVENT_TYPES[input.type];
  const raw = {
    title: input.name,
    summary: `A ${weeks}-week plan for a ${label.toLowerCase()} for ${input.guests} guests${input.location ? ' in ' + input.location : ''}, with a total budget of ${input.budget.toLocaleString()} ${input.currency}.${input.theme ? ' Theme: ' + input.theme + '.' : ''}`,
    ideas: t.ideas.map(([title, description]) => ({ title, description })),
    budget: t.budget.map(([category, pct]) => ({ category, amount: (input.budget * pct) / 100, notes: `${pct}% of total` })),
    timeline: TIMELINE.map(([f, task, category]) => ({ weeks_before: Math.round(f * weeks), task, category })),
    vendors: t.vendors.map((type, i) => ({
      type,
      questions: ['Are you available on our date?', 'What is included in the price, and what costs extra?', 'What are the payment and cancellation terms?'],
      book_weeks_before: Math.round(weeks * Math.max(0.4, 0.95 - i * 0.08)),
      est_cost: 'Get 2-3 quotes',
    })),
    schedule: t.schedule.map(([time, activity]) => ({ time, activity })),
    tips: [
      'Keep 5-10% of the budget aside for surprises.',
      'Get every vendor agreement in writing, including cancellation terms.',
      'Ask friends or family to own small tasks on the day.',
      'Weekday or off-season dates are often much cheaper.',
      'Share one schedule with all vendors a week before.',
    ],
  };
  return sanitizePlan(raw, input);
}
