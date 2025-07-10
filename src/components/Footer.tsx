import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

const Footer = () => {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2024 Movie Draft Oracle. All rights reserved.
          </p>
          
          <div className="flex flex-col items-center gap-4 md:flex-row">
            <div className="flex items-center gap-4 text-sm">
              <Link 
                to="/privacy-policy" 
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Separator orientation="vertical" className="h-4" />
              <Link 
                to="/terms-of-service" 
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Separator orientation="vertical" className="h-4 hidden md:block" />
              <a 
                href="mailto:support@moviedraftoracle.com" 
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;