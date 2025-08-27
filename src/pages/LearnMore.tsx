
import React from 'react';

const LearnMore = () => {
  return (
    <div className="w-full min-h-screen pb-16 bg-ui-primary flex flex-col items-center gap-16">
        {/* Hero Section */}
        <section className="self-stretch px-6 py-20 bg-gradient-to-br from-ui-primary via-purple-50 to-ui-primary flex flex-col items-center">
          <div className="w-full max-w-7xl px-6 flex flex-col items-center gap-6">
            <div className="self-stretch flex flex-col items-center">
              <h1 className="self-stretch text-center text-text-primary text-6xl font-chaney font-normal leading-18 tracking-normal">
                This isn't TRivia.
              </h1>
            </div>
            <div className="self-stretch flex flex-col items-center">
              <h2 className="self-stretch text-center text-brand-primary text-6xl font-chaney font-normal leading-18 tracking-normal">
                It's Taste.
              </h2>
            </div>
            <div className="w-full max-w-3xl pt-2 flex flex-col items-center">
              <p className="max-w-2xl text-center text-text-primary text-lg font-brockmann font-medium leading-6 tracking-normal">
                Movie Draft challenges you to curate the perfect collection of films. Strategy meets cinema in this competitive drafting experience.
              </p>
            </div>
          </div>
        </section>

        {/* How to Play Section */}
        <section className="w-full max-w-4xl px-6 flex flex-col items-start gap-12">
          <div className="self-stretch flex flex-col items-center">
            <h2 className="text-center text-brand-primary text-3xl font-brockmann font-bold leading-9 tracking-normal">
              How to Play
            </h2>
          </div>
          
          <div className="self-stretch flex flex-col items-start gap-8">
            {/* What is Movie Draft */}
            <div className="self-stretch flex flex-col items-start">
              <div className="self-stretch flex flex-col items-start gap-4">
                <div className="self-stretch flex flex-col items-start">
                  <h3 className="self-stretch text-brand-primary text-lg font-brockmann font-normal leading-7 tracking-normal">
                    What is a Movie Draft?
                  </h3>
                </div>
                <div className="self-stretch flex flex-col items-start">
                  <p className="self-stretch text-text-primary text-sm font-brockmann font-normal leading-5 tracking-normal">
                    Movie Draft is a competitive game where players take turns selecting movies based on a chosen theme. The goal is to build the highest-scoring collection of films!
                  </p>
                </div>
              </div>
            </div>

            {/* How to Set Up */}
            <div className="self-stretch flex flex-col items-start">
              <div className="self-stretch flex flex-col items-start gap-4">
                <div className="self-stretch flex flex-col items-start">
                  <h3 className="self-stretch text-brand-primary text-lg font-brockmann font-normal leading-7 tracking-normal">
                    How to Set Up
                  </h3>
                </div>
                <div className="self-stretch flex flex-col items-start gap-2">
                  <ol className="self-stretch text-text-primary text-sm font-brockmann font-normal leading-5 tracking-normal space-y-2 list-decimal list-inside">
                    <li>Choose a draft theme (by Person or by Year)</li>
                    <li>Select your specific option (actor/director or year)</li>
                    <li>Add all players who will participate</li>
                    <li>Choose your scoring categories and draft style</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* How to Draft */}
            <div className="self-stretch flex flex-col items-start">
              <div className="self-stretch flex flex-col items-start gap-4">
                <div className="self-stretch flex flex-col items-start">
                  <h3 className="self-stretch text-brand-primary text-lg font-brockmann font-normal leading-7 tracking-normal">
                    How to Draft
                  </h3>
                </div>
                <div className="self-stretch flex flex-col items-start gap-2">
                  <div className="self-stretch text-text-primary text-sm font-brockmann font-normal leading-5 tracking-normal">
                    Players take turns in order selecting movies<br/>
                    Search and pick movies that match your theme<br/>
                    Each player builds their roster of films<br/>
                    Continue until everyone has selected their movies
                  </div>
                </div>
              </div>
            </div>

            {/* Scoring */}
            <div className="self-stretch flex flex-col items-start">
              <div className="self-stretch flex flex-col items-start gap-4">
                <div className="self-stretch flex flex-col items-start">
                  <h3 className="self-stretch text-brand-primary text-lg font-brockmann font-normal leading-7 tracking-normal">
                    Scoring
                  </h3>
                </div>
                <div className="self-stretch flex flex-col items-start">
                  <p className="self-stretch text-text-primary text-sm font-brockmann font-normal leading-5 tracking-normal">
                    Movies are scored based on the categories you selected (IMDb rating, box office, critics scores, etc.). The player with the highest total score wins!
                  </p>
                </div>
              </div>
            </div>

            {/* Pro Tips */}
            <div className="self-stretch flex flex-col items-start gap-4">
              <div className="self-stretch flex flex-col items-start">
                <h3 className="self-stretch text-brand-primary text-lg font-brockmann font-normal leading-7 tracking-normal">
                  Pro Tips
                </h3>
              </div>
              <div className="self-stretch flex items-start gap-4">
                <div className="flex-1 text-text-primary text-sm font-brockmann font-normal leading-5 tracking-normal">
                  Balance popular hits with hidden gems<br/>
                  Pay attention to what others are selecting<br/>
                  Have fun and discover new movies!
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
};

export default LearnMore;
