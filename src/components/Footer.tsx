import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import InlineAd from "@/components/ads/InlineAd";
import ContactModal from "@/components/ContactModal";
import { useState } from "react";
import { InstagramIcon } from "@/components/icons";

const Footer = () => {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <>
      <InlineAd className="py-4" />
      <footer className="border-t border-brand-primary bg-greyscale-blue-900 backdrop-blur-sm">
      <div className="w-full px-6 py-6">
        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start sm:gap-x-6">
          <div className="min-w-0 flex flex-col items-start justify-start">
            <p className="text-sm font-brockmann font-normal text-greyscale-blue-200 leading-5">
              © 2024 Movie Drafter. All rights reserved.
            </p>
            {/* TMDB Attribution */}
            <p className="text-xs font-brockmann font-normal text-greyscale-blue-300 leading-4 mt-2">
              Powered by{' '}
              <a 
                href="https://www.themoviedb.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-greyscale-blue-200 transition-colors underline"
              >
                TMDB
              </a>
              .{' '}
              <Link 
                to="/terms-of-service" 
                className="hover:text-greyscale-blue-200 transition-colors underline"
              >
                See attribution
              </Link>
            </p>
          </div>
          
          <div className="flex justify-center sm:pt-0.5">
            <a
              href="https://www.instagram.com/moviedrafter/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-greyscale-blue-200 hover:text-greyscale-blue-100 transition-colors"
              aria-label="Follow us on Instagram"
            >
              <InstagramIcon className="w-6 h-6" />
            </a>
          </div>
          
          <div className="flex min-w-0 flex-col items-end justify-end gap-3 sm:justify-self-end">
            <div className="flex w-full max-w-lg flex-wrap items-center justify-end gap-x-3 gap-y-2">
              <Link 
                to="/about" 
                className="text-sm font-brockmann font-medium text-greyscale-blue-200 hover:text-greyscale-blue-100 transition-colors leading-5"
              >
                About
              </Link>
              <Separator orientation="vertical" className="hidden md:block h-4 bg-greyscale-blue-200" />
              <Link
                to="/special-draft"
                className="text-sm font-brockmann font-medium text-greyscale-blue-200 hover:text-greyscale-blue-100 transition-colors leading-5"
              >
                Special drafts
              </Link>
              <Separator orientation="vertical" className="hidden md:block h-4 bg-greyscale-blue-200" />
              <Link
                to="/how-to-draft"
                className="text-sm font-brockmann font-medium text-greyscale-blue-200 hover:text-greyscale-blue-100 transition-colors leading-5"
              >
                How to draft
              </Link>
              <Separator orientation="vertical" className="hidden md:block h-4 bg-greyscale-blue-200" />
              <Link 
                to="/privacy-policy" 
                className="text-sm font-brockmann font-medium text-greyscale-blue-200 hover:text-greyscale-blue-100 transition-colors leading-5"
              >
                Privacy Policy
              </Link>
              <Separator orientation="vertical" className="hidden md:block h-4 bg-greyscale-blue-200" />
              <Link 
                to="/terms-of-service" 
                className="text-sm font-brockmann font-medium text-greyscale-blue-200 hover:text-greyscale-blue-100 transition-colors leading-5"
              >
                Terms of Service
              </Link>
              <Separator orientation="vertical" className="hidden md:block h-4 bg-greyscale-blue-200" />
              <button
                onClick={() => setIsContactModalOpen(true)}
                className="text-sm font-brockmann font-medium text-greyscale-blue-200 hover:text-greyscale-blue-100 transition-colors leading-5 cursor-pointer"
              >
                Contact Support
              </button>
            </div>
            <a
              href="https://www.producthunt.com/products/movie-drafter?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-movie-drafter"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <img
                alt="Movie Drafter - The web-app for playing Movie Draft games | Product Hunt"
                width={250}
                height={54}
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1120116&theme=dark&t=1776086005783"
                className="max-w-full h-auto"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
    <ContactModal open={isContactModalOpen} onOpenChange={setIsContactModalOpen} />
    </>
  );
};

export default Footer;