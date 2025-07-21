
import React from 'react';

const LearnMore = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-yellow-400 mb-6">
            This isn't about knowledge.
          </h1>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
            It's About Taste.
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Movie Draft challenges you to curate the perfect collection of films. 
            Strategy meets cinema in this competitive drafting experience.
          </p>
        </div>
      </section>

      {/* How to Play Content */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-yellow-400 mb-12 text-center">How to Play Movie Draft</h2>
          
          <div className="grid grid-cols-1 gap-8">
            {/* What is Movie Draft */}
            <div className="mb-8">
              <h3 className="text-xl text-yellow-400 mb-4">What is Movie Draft?</h3>
              <p className="text-gray-300">
                Movie Draft is a competitive game where players take turns selecting movies based on a chosen theme. 
                The goal is to build the highest-scoring collection of films!
              </p>
            </div>

            {/* How to Set Up */}
            <div className="mb-8">
              <h3 className="text-xl text-yellow-400 mb-4">How to Set Up</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Choose a draft theme (by Person or by Year)</li>
                <li>Select your specific option (actor/director or year)</li>
                <li>Add all players who will participate</li>
                <li>Choose your scoring categories and draft style</li>
              </ol>
            </div>

            {/* How to Draft */}
            <div className="mb-8">
              <h3 className="text-xl text-yellow-400 mb-4">How to Draft</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Players take turns in order selecting movies</li>
                <li>Search and pick movies that match your theme</li>
                <li>Each player builds their roster of films</li>
                <li>Continue until everyone has selected their movies</li>
              </ol>
            </div>

            {/* Scoring */}
            <div className="mb-8">
              <h3 className="text-xl text-yellow-400 mb-4">Scoring</h3>
              <p className="text-gray-300">
                Movies are scored based on the categories you selected (IMDb rating, box office, critics scores, etc.). 
                The player with the highest total score wins!
              </p>
            </div>
          </div>

          {/* Pro Tips */}
          <div className="mt-8">
            <h3 className="text-xl text-yellow-400 mb-4">Pro Tips</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-300 columns-1 md:columns-2 gap-8">
              <li>Consider all scoring categories when picking</li>
              <li>Balance popular hits with hidden gems</li>
              <li>Pay attention to what others are selecting</li>
              <li>Have fun and discover new movies!</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LearnMore;
