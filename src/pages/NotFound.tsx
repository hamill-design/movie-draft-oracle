import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4" style={{color: 'var(--Text-Primary, #FCFFFF)'}}>404</h1>
        <p className="text-xl mb-4" style={{color: 'var(--Text-Primary, #FCFFFF)'}}>Oops! Page not found</p>
        <a href="/" className="text-purple-300 hover:text-purple-400 underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
