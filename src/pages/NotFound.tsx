import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <>
      <Helmet>
        <title>Movie Drafter - Page Not Found</title>
        <meta name="description" content="The page you're looking for doesn't exist. Return to Movie Drafter home to create or join a movie draft." />
        <link rel="canonical" href="https://moviedrafter.com/" />
        <meta property="og:title" content="Movie Drafter - Page Not Found" />
        <meta property="og:description" content="The page you're looking for doesn't exist. Return to Movie Drafter home to create or join a movie draft." />
        <meta property="og:url" content="https://moviedrafter.com/404" />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
        <meta name="twitter:title" content="Movie Drafter - Page Not Found" />
        <meta name="twitter:description" content="The page you're looking for doesn't exist. Return to Movie Drafter home to create or join a movie draft." />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4" style={{color: 'var(--Text-Primary, #FCFFFF)'}}>404</h1>
        <p className="text-xl mb-4" style={{color: 'var(--Text-Primary, #FCFFFF)'}}>Oops! Page not found</p>
        <a href="/" className="text-purple-300 hover:text-purple-400 underline">
          Return to Home
        </a>
      </div>
    </div>
    </>
  );
};

export default NotFound;
