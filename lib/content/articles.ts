/**
 * Education content. Written in plain language from NHS, ACOG and FIGO
 * guidance and linked to those sources.
 *
 * REVIEW STATUS: every article is `pending` until a qualified clinician has
 * reviewed it. The app shows that status to readers. Before launch each one
 * needs a named reviewer and a review date (see docs/LAUNCH.md).
 */

export type ArticleCategory = 'Basics' | 'Symptoms' | 'Mood' | 'Fertility' | 'Menopause' | 'Care';

export interface Article {
  slug: string;
  title: string;
  category: ArticleCategory;
  minutes: number;
  summary: string;
  sections: { heading?: string; paragraphs?: string[]; bullets?: string[] }[];
  sources: { label: string; url: string }[];
  review: { status: 'pending' } | { status: 'reviewed'; by: string; on: string };
}

export const ARTICLES: Article[] = [
  {
    slug: 'cycle-phases',
    title: 'Your cycle, phase by phase',
    category: 'Basics',
    minutes: 4,
    summary: 'What happens in your body across a cycle, and why you might feel different from week to week.',
    sections: [
      {
        paragraphs: [
          'A menstrual cycle starts on the first day of a period and ends the day before the next one. Hormones — mainly oestrogen and progesterone — rise and fall across it, and many people notice changes in energy, mood, skin or sleep along the way.',
          'Bloom describes the cycle in four phases. The boundaries are estimates based on your history; your body does not switch from one to the next on a fixed day.',
        ],
      },
      {
        heading: 'Menstrual phase',
        paragraphs: [
          'Your period. The lining of the uterus is shed, and hormone levels are at their lowest. Cramps and tiredness are common in the first days.',
        ],
      },
      {
        heading: 'Follicular phase',
        paragraphs: [
          'Strictly, this phase begins on day one and runs until ovulation. Bloom shows it as the days after your period, when rising oestrogen rebuilds the uterine lining and an egg matures. Many people feel more energetic now.',
        ],
      },
      {
        heading: 'Ovulation',
        paragraphs: [
          'An egg is released, usually around 14 days before your next period — so in a 28-day cycle it is often around day 14, but in a 35-day cycle it is closer to day 21. Some people notice clear, stretchy discharge or a mild ache on one side.',
        ],
      },
      {
        heading: 'Luteal phase',
        paragraphs: [
          'After ovulation, progesterone rises. If pregnancy does not happen, hormone levels fall again and the next period begins. In the days before it, some people get premenstrual symptoms such as bloating, tender breasts or mood changes.',
        ],
      },
    ],
    sources: [
      { label: 'NHS — Periods', url: 'https://www.nhs.uk/conditions/periods/' },
      { label: 'ACOG — Your first period', url: 'https://www.acog.org/womens-health/faqs/your-first-period' },
    ],
    review: { status: 'pending' },
  },
  {
    slug: 'typical-cycle',
    title: "What's a typical cycle?",
    category: 'Basics',
    minutes: 3,
    summary: 'The ranges doctors use, why 28 days is just an average, and when variation is normal.',
    sections: [
      {
        paragraphs: [
          'Only a minority of people have a cycle of exactly 28 days. For adults, cycles between 24 and 38 days are considered within the usual range, and a period usually lasts up to 8 days.',
          'Cycles also vary from month to month. A difference of up to about 7–9 days between your shortest and longest cycle is generally considered regular.',
        ],
      },
      {
        heading: 'When cycles vary more',
        bullets: [
          'In the first few years after periods start, cycles are often irregular.',
          'In the years before menopause (perimenopause), cycles commonly become less predictable.',
          'Stress, illness, travel, changes in weight or exercise, breastfeeding and some medicines can all shift a cycle.',
          'Hormonal contraception changes bleeding patterns — a withdrawal bleed on the pill is not the same as a natural period.',
        ],
      },
      {
        heading: 'How Bloom uses this',
        paragraphs: [
          'Bloom compares your recent cycles with these ranges. If yours fall outside them for several cycles, it will let you know gently — not as a diagnosis, but as something you might want to mention to a healthcare professional.',
        ],
      },
    ],
    sources: [
      { label: 'FIGO — Abnormal uterine bleeding systems (Munro et al., 2018)', url: 'https://doi.org/10.1002/ijgo.12666' },
      { label: 'NHS — Irregular periods', url: 'https://www.nhs.uk/conditions/irregular-periods/' },
    ],
    review: { status: 'pending' },
  },
  {
    slug: 'period-pain',
    title: 'Period pain: what helps',
    category: 'Symptoms',
    minutes: 4,
    summary: 'Common, often manageable — and sometimes a sign worth getting checked.',
    sections: [
      {
        paragraphs: [
          'Cramping in the lower tummy, sometimes spreading to the back or thighs, is very common in the first days of a period. It happens as the muscles of the uterus contract.',
        ],
      },
      {
        heading: 'Things many people find help',
        bullets: [
          'Heat — a heat pad or hot-water bottle on your tummy, or a warm bath.',
          'Gentle exercise such as walking, swimming or stretching.',
          'Over-the-counter pain relief such as ibuprofen or paracetamol. Follow the label, and ask a pharmacist if you have other conditions or take other medicines.',
          'Some hormonal contraceptives reduce period pain — a doctor or nurse can talk through options.',
        ],
      },
      {
        heading: 'When to get it checked',
        bullets: [
          'Pain that stops you going to work, school or doing everyday things.',
          'Pain that has recently become much worse, or that happens between periods.',
          'Pain during or after sex, or with bowel movements or passing urine.',
          'Pain with heavy bleeding, bleeding between periods, or unusual discharge.',
        ],
      },
      {
        paragraphs: [
          'Severe period pain can have causes such as endometriosis or fibroids, which are treatable. You do not have to put up with pain that affects your life.',
        ],
      },
    ],
    sources: [
      { label: 'NHS — Period pain', url: 'https://www.nhs.uk/conditions/period-pain/' },
      { label: 'ACOG — Dysmenorrhea: painful periods', url: 'https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods' },
      { label: 'NHS — Endometriosis', url: 'https://www.nhs.uk/conditions/endometriosis/' },
    ],
    review: { status: 'pending' },
  },
  {
    slug: 'heavy-periods',
    title: 'Heavy periods',
    category: 'Symptoms',
    minutes: 3,
    summary: 'How to tell if your periods are heavy, and why it is worth mentioning.',
    sections: [
      {
        paragraphs: [
          'What counts as heavy is partly about how bleeding affects your life. Doctors take heavy periods seriously because they can cause low iron, and because there is often a treatable cause.',
        ],
      },
      {
        heading: 'Signs your periods may be heavy',
        bullets: [
          'Needing to change a pad or tampon every 1–2 hours, or using two at once.',
          'Passing blood clots larger than about 2.5 cm.',
          'Bleeding through to clothes or bedding.',
          'A period lasting more than 7–8 days.',
          'Feeling tired, short of breath or dizzy — possible signs of low iron.',
        ],
      },
      {
        heading: 'What you can do',
        paragraphs: [
          'Log your flow in Bloom so you can show a clear picture at an appointment. A GP or gynaecologist can check your iron levels and talk through treatments, which range from tablets to hormonal options.',
        ],
      },
    ],
    sources: [
      { label: 'NHS — Heavy periods', url: 'https://www.nhs.uk/conditions/heavy-periods/' },
      { label: 'ACOG — Heavy menstrual bleeding', url: 'https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding' },
    ],
    review: { status: 'pending' },
  },
  {
    slug: 'pms-pmdd',
    title: 'PMS and PMDD',
    category: 'Mood',
    minutes: 4,
    summary: 'Premenstrual changes are common. When they are severe, real help exists.',
    sections: [
      {
        paragraphs: [
          'Premenstrual syndrome (PMS) describes physical and emotional symptoms in the days or weeks before a period — such as bloating, breast tenderness, irritability, low mood or anxiety — that ease once bleeding starts.',
          'Premenstrual dysphoric disorder (PMDD) is a more severe form, where mood symptoms seriously affect relationships, work or daily life. It is a recognised medical condition, not a personal failing.',
        ],
      },
      {
        heading: 'Things that may help',
        bullets: [
          'Tracking symptoms for two or three cycles, to see whether they follow your cycle.',
          'Regular exercise, sleep and meals; cutting down on alcohol, caffeine and salt.',
          'Talking therapies such as CBT.',
          'Medical treatments, including some antidepressants and hormonal options, prescribed by a doctor.',
        ],
      },
      {
        heading: 'Get support',
        paragraphs: [
          'If premenstrual symptoms are affecting your life, talk to a healthcare professional and bring your Bloom history. If you ever have thoughts of harming yourself, contact a doctor, a local crisis line or emergency services straight away.',
        ],
      },
    ],
    sources: [
      { label: 'NHS — Premenstrual syndrome', url: 'https://www.nhs.uk/conditions/pre-menstrual-syndrome/' },
      { label: 'ACOG — Premenstrual syndrome', url: 'https://www.acog.org/womens-health/faqs/premenstrual-syndrome' },
    ],
    review: { status: 'pending' },
  },
  {
    slug: 'fertile-window',
    title: 'Understanding the fertile window',
    category: 'Fertility',
    minutes: 4,
    summary: 'How estimates work, how precise they are, and why they are not contraception.',
    sections: [
      {
        paragraphs: [
          'Pregnancy is possible on about six days of each cycle: the five days before ovulation and the day of ovulation itself, because sperm can survive for several days.',
          'Bloom estimates ovulation as about 14 days before your next expected period, and widens the window when your cycles vary. These dates are calculated from the calendar — they are not a measurement of ovulation.',
        ],
      },
      {
        heading: 'Not a method of contraception',
        paragraphs: [
          'Calendar estimates can be wrong by several days, especially when cycles vary or something like illness or stress delays ovulation. Do not use Bloom to prevent pregnancy. A doctor, nurse or sexual-health clinic can help you choose reliable contraception.',
        ],
      },
      {
        heading: 'If you are trying to conceive',
        bullets: [
          'Having sex every two to three days through the cycle means you do not need to pinpoint ovulation.',
          'Ovulation predictor tests and observing cervical mucus give more direct signs than a calendar.',
          'Taking folic acid before and in early pregnancy is recommended.',
          'If you have not conceived after a year of trying (or six months if you are 35 or over), or have irregular cycles, talk to a doctor.',
        ],
      },
    ],
    sources: [
      {
        label: 'Wilcox et al., NEJM 1995 — Timing of intercourse in relation to ovulation',
        url: 'https://doi.org/10.1056/NEJM199512073332301',
      },
      { label: 'NHS — Trying to get pregnant', url: 'https://www.nhs.uk/pregnancy/trying-for-a-baby/' },
    ],
    review: { status: 'pending' },
  },
  {
    slug: 'perimenopause',
    title: 'Perimenopause: what to expect',
    category: 'Menopause',
    minutes: 4,
    summary: 'The years before your last period: what changes, how long it lasts, and when to talk to a GP.',
    sections: [
      {
        paragraphs: [
          'Perimenopause is the time when your hormones start to change before your periods stop for good. It usually begins in your 40s, but can start earlier, and it often lasts several years. Menopause is when you haven’t had a period for 12 months.',
          'Everyone’s experience is different. Some people have few symptoms; for others they affect sleep, work and relationships.',
        ],
      },
      {
        heading: 'Common changes',
        bullets: [
          'Periods that come closer together or further apart, or get lighter or heavier.',
          'Hot flushes and night sweats.',
          'Trouble sleeping, low mood, anxiety or feeling irritable.',
          'Problems with memory or concentration (“brain fog”).',
          'Joint aches, headaches, palpitations, and vaginal dryness or discomfort.',
        ],
      },
      {
        heading: 'Tracking helps',
        paragraphs: [
          'Logging periods and symptoms in Bloom builds a picture you can show a GP. Turn on perimenopause in Cycle settings to add these symptoms to your check-in. Predictions become a rougher guide, because cycles naturally vary more now.',
          'You can still get pregnant until you’ve had no periods for a year (two years if you’re under 50), so keep using contraception if you don’t want to get pregnant.',
        ],
      },
      {
        heading: 'See a GP if',
        bullets: [
          'Symptoms are affecting your daily life — treatments, including HRT, can help.',
          'You have symptoms before the age of 45.',
          'Periods are very heavy, come more often than every 3 weeks, or you bleed between periods or after sex.',
          'You have any bleeding after 12 months without a period.',
        ],
      },
    ],
    sources: [
      { label: 'NHS — Menopause', url: 'https://www.nhs.uk/conditions/menopause/' },
      { label: 'NHS — Symptoms of menopause and perimenopause', url: 'https://www.nhs.uk/conditions/menopause/symptoms/' },
      { label: 'NICE NG23 — Menopause: identification and management', url: 'https://www.nice.org.uk/guidance/ng23' },
    ],
    review: { status: 'pending' },
  },
  {
    slug: 'hot-flushes',
    title: 'Hot flushes and night sweats',
    category: 'Menopause',
    minutes: 3,
    summary: 'Simple things that help, and the treatments a GP can talk through.',
    sections: [
      {
        paragraphs: [
          'Hot flushes are short, sudden feelings of heat, often in the face, neck and chest, sometimes with sweating or a racing heart. Night sweats are hot flushes during sleep. They’re among the most common symptoms of perimenopause and menopause.',
        ],
      },
      {
        heading: 'Things you can try',
        bullets: [
          'Wear light layers you can take off, and keep your bedroom cool.',
          'Notice triggers — caffeine, alcohol, spicy food and smoking are common ones.',
          'Keep a fan or a glass of cold water nearby.',
          'Regular exercise and keeping a healthy weight can help.',
          'Cognitive behavioural therapy (CBT) can help with how much they bother you.',
        ],
      },
      {
        heading: 'Treatments',
        paragraphs: [
          'Hormone replacement therapy (HRT) is the main treatment and works well for most people. There are also non-hormonal options. A GP can talk through benefits and risks for you.',
          'Log hot flushes in your check-in and Bloom’s symptom trends will show how often they happen — useful to bring to that appointment.',
        ],
      },
    ],
    sources: [
      {
        label: 'NHS — Things you can do to help with menopause symptoms',
        url: 'https://www.nhs.uk/conditions/menopause/things-you-can-do/',
      },
      { label: 'NHS — Treatment for menopause and perimenopause', url: 'https://www.nhs.uk/conditions/menopause/treatment/' },
      { label: 'NHS — Hormone replacement therapy (HRT)', url: 'https://www.nhs.uk/medicines/hormone-replacement-therapy-hrt/' },
    ],
    review: { status: 'pending' },
  },
  {
    slug: 'when-to-seek-care',
    title: 'When to talk to a healthcare professional',
    category: 'Care',
    minutes: 3,
    summary: 'Changes worth getting checked, and the ones that need urgent help.',
    sections: [
      {
        heading: 'Make an appointment if',
        bullets: [
          'Your periods stop for three months or more and you are not pregnant.',
          'You bleed between periods, after sex, or after menopause.',
          'Your periods are very heavy, last more than 7–8 days, or are much more painful than usual.',
          'Your cycles are regularly shorter than 24 or longer than 38 days, or suddenly change pattern.',
          'Premenstrual symptoms seriously affect your life.',
        ],
      },
      {
        heading: 'Get urgent help if',
        bullets: [
          'You have sudden, severe pain in your tummy or pelvis.',
          'You are bleeding very heavily — soaking a pad or tampon every hour for several hours — or feel faint.',
          'You have a high temperature, rash and feel very unwell while using a tampon or menstrual cup — this can be toxic shock syndrome.',
          'You could be pregnant and have pain or bleeding.',
        ],
      },
    ],
    sources: [
      { label: 'NHS — Stopped or missed periods', url: 'https://www.nhs.uk/conditions/stopped-or-missed-periods/' },
      { label: 'NHS — Toxic shock syndrome', url: 'https://www.nhs.uk/conditions/toxic-shock-syndrome/' },
      { label: 'NHS — Irregular periods', url: 'https://www.nhs.uk/conditions/irregular-periods/' },
    ],
    review: { status: 'pending' },
  },
  {
    slug: 'appointments',
    title: 'Getting the most from an appointment',
    category: 'Care',
    minutes: 2,
    summary: 'How your Bloom history can help you explain what is going on.',
    sections: [
      {
        paragraphs: [
          'Describing months of symptoms from memory is hard. A record of your cycle dates, flow and symptoms helps a clinician understand your pattern quickly.',
        ],
      },
      {
        heading: 'Before you go',
        bullets: [
          'Open Insights to see your average cycle and period length, and how much they vary.',
          'Note your most common symptoms and when in the cycle they happen.',
          'Write down your questions, and anything that worries you most.',
          'From Profile, you can export your data if you want to share it.',
        ],
      },
    ],
    sources: [{ label: 'NHS — Periods', url: 'https://www.nhs.uk/conditions/periods/' }],
    review: { status: 'pending' },
  },
];

export function articleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
