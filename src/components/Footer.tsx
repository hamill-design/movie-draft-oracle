import { Link } from "react-router-dom";
import { useState } from "react";
import InlineAd from "@/components/ads/InlineAd";
import ContactModal from "@/components/ContactModal";
import { InstagramIcon } from "@/components/icons";
import shortTallLogo from "@/assets/logos/Property 1=Short Tall, _hover=false.svg";

type FooterLink = {
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
};

type FooterColumn = {
  title: string;
  links: FooterLink[];
};

const footerColumns: FooterColumn[] = [
  {
    title: "Get Started",
    links: [
      { label: "Start a Draft", to: "/draft" },
      { label: "About", to: "/about" },
      { label: "How To Play", to: "/how-to-draft" },
      { label: "Create League", to: "/league/create" },
    ],
  },
  {
    title: "Strategy",
    links: [
      { label: "Filmography Guide", to: "/draft-by-filmography" },
      { label: "Year Guide", to: "/draft-by-year" },
      { label: "Special Drafts", to: "/special-draft" },
    ],
  },
  {
    title: "Learn More",
    links: [
      { label: "Blog", to: "/blog" },
      { label: "Movie News", to: "/news" },
      { label: "FAQs", to: "/faq" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy-policy" },
      { label: "Terms of Service", to: "/terms-of-service" },
    ],
  },
];

const linkClassName =
  "text-sm font-brockmann font-medium text-[#BDC3C2] leading-5 transition-colors hover:text-greyscale-blue-100";

function FooterLinkItem({ link }: { link: FooterLink }) {
  if (link.onClick) {
    return (
      <button type="button" onClick={link.onClick} className={`${linkClassName} text-left`}>
        {link.label}
      </button>
    );
  }

  if (link.href) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        {link.label}
      </a>
    );
  }

  if (link.to) {
    return (
      <Link to={link.to} className={linkClassName}>
        {link.label}
      </Link>
    );
  }

  return null;
}

const Footer = () => {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const columns = footerColumns.map((column) =>
    column.title === "Legal"
      ? {
          ...column,
          links: [...column.links, { label: "Support", onClick: () => setIsContactModalOpen(true) }],
        }
      : column,
  );

  return (
    <>
      <InlineAd className="py-4" />
      <footer className="border-t border-brand-primary bg-[hsl(var(--section-container))] backdrop-blur-sm">
        <div className="flex w-full flex-col gap-10 px-6 pb-12 pt-6">
          <div className="flex min-w-[320px] items-start justify-center gap-8 md:gap-12">
            <div className="flex flex-col items-center gap-6">
              <Link to="/" aria-label="Movie Drafter home">
                <img src={shortTallLogo} alt="Movie Drafter" className="h-[57px] w-[45px]" />
              </Link>
              <a
                href="https://www.instagram.com/moviedrafter/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-greyscale-blue-100 transition-colors hover:text-greyscale-blue-200"
                aria-label="Follow us on Instagram"
              >
                <InstagramIcon className="h-6 w-6" />
              </a>
            </div>

            <div className="flex max-w-[526px] flex-1 flex-wrap content-start gap-8">
              {columns.map((column) => (
                <div key={column.title} className="flex flex-col gap-3">
                  <span className="text-base font-brockmann font-semibold leading-6 tracking-[0.32px] text-greyscale-blue-100">
                    {column.title}
                  </span>
                  {column.links.map((link) => (
                    <FooterLinkItem key={link.label} link={link} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-w-[320px] flex-col items-center">
            <div className="flex max-w-[277px] flex-wrap items-end justify-center gap-x-1 gap-y-1 text-center">
              <p className="text-sm font-brockmann font-normal leading-5 text-[#D6DBDB]">
                © 2026 Movie Drafter. All rights reserved.
              </p>
              <p className="text-xs font-brockmann font-normal leading-4 text-[#BBC3BF]">
                Powered by{" "}
                <a
                  href="https://www.themoviedb.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline transition-colors hover:text-greyscale-blue-200"
                >
                  TMDB
                </a>
                .{" "}
                <Link
                  to="/terms-of-service"
                  className="underline transition-colors hover:text-greyscale-blue-200"
                >
                  See attribution
                </Link>
              </p>
            </div>
          </div>
        </div>
      </footer>
      <ContactModal open={isContactModalOpen} onOpenChange={setIsContactModalOpen} />
    </>
  );
};

export default Footer;
