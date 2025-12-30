import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import InlineAd from "@/components/ads/InlineAd";

const Footer = () => {
  return (
    <>
      <InlineAd className="py-4" />
      <footer className="border-t border-brand-primary bg-greyscale-blue-900 backdrop-blur-sm">
      <div className="w-full px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-80 flex flex-col items-center justify-center">
            <p className="text-sm font-brockmann font-normal text-greyscale-blue-200 leading-5">
              © 2024 Movie Drafter. All rights reserved.
            </p>
          </div>
          
          <div className="flex-1 min-w-80 flex items-center justify-center gap-4">
            <div className="w-80 min-w-80 flex items-center justify-center gap-4 flex-nowrap whitespace-nowrap">
              <Link 
                to="/privacy-policy" 
                className="text-sm font-brockmann font-medium text-greyscale-blue-200 hover:text-greyscale-blue-100 transition-colors leading-5"
              >
                Privacy Policy
              </Link>
              <Separator orientation="vertical" className="h-4 bg-greyscale-blue-200" />
              <Link 
                to="/terms-of-service" 
                className="text-sm font-brockmann font-medium text-greyscale-blue-200 hover:text-greyscale-blue-100 transition-colors leading-5"
              >
                Terms of Service
              </Link>
              <Separator orientation="vertical" className="h-4 bg-greyscale-blue-200" />
              <a 
                href="mailto:support@moviedrafter.com" 
                className="text-sm font-brockmann font-medium text-greyscale-blue-200 hover:text-greyscale-blue-100 transition-colors leading-5"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
    </>
  );
};

export default Footer;