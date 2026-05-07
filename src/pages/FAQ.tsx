import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { breadcrumbListNode, faqPageNode, graphJsonLd, webPageNode } from '@/components/seo/jsonLd';

const SITE = 'https://moviedrafter.com';

const faqs: { question: string; answer: string }[] = [
  {
    question: 'What is Movie Drafter?',
    answer:
      'Movie Drafter is a free online movie draft game for friends. Players take turns picking films into category slots — like a fantasy sports draft, but for cinema. Whoever builds the best-scoring roster of movies wins.',
  },
  {
    question: 'How does the movie draft game work?',
    answer:
      'You choose a draft format (by actor/director filmography, by release year, or a special curated theme), add your friends as participants, then take turns selecting movies into category slots. Movie Drafter automatically scores each roster using real data like box office, IMDb ratings, and award wins.',
  },
  {
    question: 'Is Movie Drafter free to play?',
    answer:
      'Yes — Movie Drafter is completely free. You can start a draft without creating an account. Create a free account to save your draft history and access multiplayer features.',
  },
  {
    question: 'Can I play Movie Drafter online with friends who are not in the same room?',
    answer:
      'Yes. Multiplayer mode lets you invite friends via email. Each person receives a link to make their picks remotely. The draft progresses asynchronously so everyone can pick on their own schedule.',
  },
  {
    question: 'What draft formats are available?',
    answer:
      'Movie Drafter offers three main formats: Draft by Filmography (pick movies from a specific actor, director, or writer\'s catalog), Draft by Year (pick from all films released in a chosen year), and Special Drafts (curated pools with themes like 80s action, A24 films, Oscar winners, rom-coms, and more).',
  },
  {
    question: 'What is Draft by Filmography?',
    answer:
      'Draft by Filmography lets you search for any actor, director, or writer and draft movies from their complete body of work. It\'s a great format for fans of auteur filmmakers — everyone competes to claim the best titles from the same filmography before their opponents do.',
  },
  {
    question: 'What is Draft by Year?',
    answer:
      'Draft by Year lets you choose any year in cinema history and draft from every film released that year. It\'s perfect for groups who love debating whether 1994, 1999, or 2007 was the greatest year in movies — now you can settle it with a draft.',
  },
  {
    question: 'How is scoring calculated?',
    answer:
      'Movies are scored across categories you choose before the draft, such as IMDb rating, Rotten Tomatoes score, worldwide box office gross, Oscar nominations, or audience ratings. Each category rewards the highest-performing film in that slot. The player with the most points across all their category slots wins.',
  },
  {
    question: 'How many players can join a draft?',
    answer:
      'Movie Drafter supports 2 or more players. Local drafts (everyone on one device) work great for groups of 2–6. Multiplayer (online) drafts can accommodate more participants through email invitations.',
  },
  {
    question: 'Do I need a movie account or subscription to play?',
    answer:
      'No subscription is required. You can start and complete a draft without signing up. Creating a free account lets you save and revisit past drafts and invite friends to multiplayer games via email.',
  },
  {
    question: 'What kinds of movies can I draft?',
    answer:
      'Any film in Movie Drafter\'s database — which pulls from a comprehensive movie database covering thousands of films across every genre, decade, and country. The eligible pool depends on your chosen format: filmography drafts are limited to one person\'s credits, year drafts to a single release year, and special drafts to a curated hand-picked list.',
  },
  {
    question: 'Is Movie Drafter suitable for movie night or film club?',
    answer:
      'Absolutely. Movie Drafter is designed exactly for group movie nights, film clubs, and any social setting where everyone has opinions about cinema. A draft typically takes 10–20 minutes and generates plenty of debate about picks, strategy, and which films deserve their scores.',
  },
];

const FAQ = () => {
  const pageTitle = 'Movie Drafter FAQ – Movie draft game questions answered';
  const pageDesc =
    'Answers to common questions about Movie Drafter: how the movie draft game works, scoring rules, multiplayer, draft formats, and how to play with friends online.';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={`${SITE}/faq`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={`${SITE}/faq`} />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              webPageNode({ path: '/faq', name: pageTitle, description: pageDesc }),
              breadcrumbListNode([
                { name: 'Home', path: '/' },
                { name: 'FAQ', path: '/faq' },
              ]),
              faqPageNode(faqs)
            )
          )}
        </script>
      </Helmet>

      <div
        className="min-h-screen w-full"
        style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-10">
          <header className="flex flex-col gap-4">
            <p className="m-0 text-sm font-brockmann text-purple-300">
              <Link to="/" className="underline hover:text-purple-200">
                ← Back to Movie Drafter
              </Link>
            </p>
            <h1 className="m-0 font-chaney text-3xl sm:text-5xl text-greyscale-blue-50 leading-tight">
              Frequently asked questions
            </h1>
            <p className="m-0 text-greyscale-blue-100 font-brockmann text-base sm:text-lg leading-relaxed">
              Everything you need to know about the Movie Drafter movie draft game — how it works, how to
              play online with friends, scoring, and more.
            </p>
          </header>

          <div className="flex flex-col gap-8">
            {faqs.map(({ question, answer }) => (
              <div key={question} className="flex flex-col gap-3 border-b border-greyscale-purp-850 pb-8 last:border-0">
                <h2 className="m-0 font-brockmann font-semibold text-lg text-greyscale-blue-50">
                  {question}
                </h2>
                <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
                  {answer}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <h2 className="m-0 font-brockmann font-bold text-xl text-greyscale-blue-50">
              Ready to start drafting?
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Jump straight into the movie draft game — no account required.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/"
                className="inline-block bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 font-brockmann font-semibold px-6 py-3 text-sm rounded-[2px] tracking-wide transition-colors"
              >
                Start a draft
              </Link>
              <Link
                to="/how-to-draft"
                className="inline-block bg-greyscale-purp-850 hover:bg-greyscale-purp-800 text-greyscale-blue-100 font-brockmann font-semibold px-6 py-3 text-sm rounded-[2px] tracking-wide transition-colors"
                style={{ outline: '1px solid #49474B', outlineOffset: '-1px' }}
              >
                How to draft movies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FAQ;
