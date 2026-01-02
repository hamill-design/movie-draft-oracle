import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Movie Drafter - Terms of Service</title>
        <meta name="description" content="Read Movie Drafter's Terms of Service to understand the rules and guidelines for using our movie draft platform." />
        <meta property="og:title" content="Movie Drafter - Terms of Service" />
        <meta property="og:description" content="Read Movie Drafter's Terms of Service to understand the rules and guidelines for using our movie draft platform." />
        <meta property="og:url" content="https://moviedrafter.com/terms-of-service" />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg" />
        <meta name="twitter:title" content="Movie Drafter - Terms of Service" />
        <meta name="twitter:description" content="Read Movie Drafter's Terms of Service to understand the rules and guidelines for using our movie draft platform." />
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
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose prose-gray dark:prose-invert max-w-none">
            <h2>Acceptance of Terms</h2>
            <p>
              By accessing and using this movie draft application, you accept and agree to be bound 
              by the terms and provision of this agreement.
            </p>

            <h2>Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials on this application 
              for personal, non-commercial transitory viewing only.
            </p>

            <h2>Service Description</h2>
            <p>
              Our service allows users to create and participate in movie drafts, track scores, 
              and share results with friends.
            </p>

            <h2>User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account and password 
              and for restricting access to your account.
            </p>

            <h2>Prohibited Uses</h2>
            <p>You may not use our service:</p>
            <ul>
              <li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
              <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
              <li>To transmit, or procure the sending of, any advertising or promotional material without our prior written consent</li>
              <li>To impersonate or attempt to impersonate the company, a company employee, another user, or any other person or entity</li>
            </ul>

            <h2>Content</h2>
            <p>
              Our service may contain content that is not appropriate for all audiences. 
              You acknowledge that you use the service at your own risk.
            </p>

            <h2>Termination</h2>
            <p>
              We may terminate or suspend your account and bar access to the service immediately, 
              without prior notice or liability, under our sole discretion, for any reason whatsoever.
            </p>

            <h2>Disclaimer</h2>
            <p>
              The information on this application is provided on an 'as is' basis. To the fullest extent 
              permitted by law, this company excludes all representations, warranties, conditions and terms.
            </p>

            <h2>Limitations</h2>
            <p>
              In no event shall Movie Draft Oracle or its suppliers be liable for any damages 
              arising out of the use or inability to use the materials on this application.
            </p>

            <h2>Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws 
              and you irrevocably submit to the exclusive jurisdiction of the courts in that state or location.
            </p>

            <h2>Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us through our support channels.
            </p>

            <h2>Third-Party Services and Attribution</h2>
            <p>
              This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
            </p>
            <p>
              Movie data, images, and related content are provided by{' '}
              <a 
                href="https://www.themoviedb.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 underline"
              >
                The Movie Database (TMDB)
              </a>
              {' '}and are used in accordance with their{' '}
              <a 
                href="https://www.themoviedb.org/api-terms-of-use" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 underline"
              >
                API Terms of Use
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

export default TermsOfService;