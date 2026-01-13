import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

const About = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Movie Drafter - About</title>
        <meta name="description" content="Learn about Movie Drafter - a competitive fantasy movie drafting platform where strategy meets cinema." />
        <meta property="og:title" content="Movie Drafter - About" />
        <meta property="og:description" content="Learn about Movie Drafter - a competitive fantasy movie drafting platform where strategy meets cinema." />
        <meta property="og:url" content="https://moviedrafter.com/about" />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg" />
        <meta name="twitter:title" content="Movie Drafter - About" />
        <meta name="twitter:description" content="Learn about Movie Drafter - a competitive fantasy movie drafting platform where strategy meets cinema." />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg" />
      </Helmet>
      <div className="min-h-screen p-4" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">About Movie Drafter</CardTitle>
            <p className="text-muted-foreground">Where Strategy Meets Cinema</p>
          </CardHeader>
          <CardContent className="prose prose-gray dark:prose-invert max-w-none">
            <p>
              Movie Drafter is a competitive fantasy movie drafting platform that transforms your love of cinema into an engaging, strategic game. Whether you're a casual movie fan or a cinephile, Movie Drafter challenges you to curate the perfect collection of films and compete with friends.
            </p>

            <h2>Our Mission</h2>
            <p>
              We believe that movie taste is more than just trivia—it's a reflection of strategy, knowledge, and personal preference. Movie Drafter brings together friends and film enthusiasts to compete in drafting the best movie collections based on real-world metrics like box office performance, critical acclaim, and audience ratings.
            </p>

            <h2>How It Works</h2>
            <p>
              Movie Drafter allows you to create custom movie drafts with your friends. Choose from themes like drafting movies by a specific actor, director, or year. Select your scoring categories—from IMDb ratings to box office revenue to critic scores—and compete to build the highest-scoring collection.
            </p>
            <p>
              The platform combines the excitement of fantasy sports with the passion of film discussion, creating a unique social gaming experience that celebrates cinema.
            </p>

            <h2>Features</h2>
            <ul>
              <li><strong>Custom Drafts:</strong> Create drafts based on actors, directors, or years</li>
              <li><strong>Flexible Scoring:</strong> Choose from multiple scoring categories including IMDb ratings, box office, and critic scores</li>
              <li><strong>Real-Time Competition:</strong> Draft with friends in real-time or asynchronously</li>
              <li><strong>Comprehensive Movie Database:</strong> Powered by TMDB, access thousands of films</li>
              <li><strong>Detailed Analytics:</strong> Track your performance and see how your picks stack up</li>
            </ul>

            <h2>Powered by TMDB</h2>
            <p>
              Movie Drafter uses data from{" "}
              <a 
                href="https://www.themoviedb.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 underline"
              >
                The Movie Database (TMDB)
              </a>
              {" "}to provide comprehensive movie information, ratings, and metadata. We're grateful for their open API that makes this platform possible.
            </p>

            <h2>Get Started</h2>
            <p>
              Ready to start drafting?{" "}
              <a 
                href="/learn-more" 
                className="text-blue-500 hover:text-blue-700 underline"
              >
                Learn more about how to play
              </a>
              {" "}or create your first draft and invite your friends to compete!
            </p>

            <h2>Contact Us</h2>
            <p>
              Have questions, feedback, or suggestions? We'd love to hear from you! Reach out through our{" "}
              <button
                onClick={() => navigate("/contact")}
                className="text-blue-500 hover:text-blue-700 underline bg-transparent border-none cursor-pointer p-0"
              >
                Contact Support
              </button>
              {" "}page or follow us on{" "}
              <a 
                href="https://www.instagram.com/moviedrafter/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 underline"
              >
                Instagram
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default About;
