import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Movie Drafter - Privacy Policy</title>
        <meta name="description" content="Read Movie Drafter's Privacy Policy to understand how we collect, use, and protect your personal information." />
        <meta property="og:title" content="Movie Drafter - Privacy Policy" />
        <meta property="og:description" content="Read Movie Drafter's Privacy Policy to understand how we collect, use, and protect your personal information." />
        <meta property="og:url" content="https://moviedrafter.com/privacy-policy" />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
        <meta name="twitter:title" content="Movie Drafter - Privacy Policy" />
        <meta name="twitter:description" content="Read Movie Drafter's Privacy Policy to understand how we collect, use, and protect your personal information." />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
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
            <CardTitle className="text-3xl">Privacy Policy for Movie Drafter</CardTitle>
            <p className="text-muted-foreground">Effective Date: January 2026</p>
          </CardHeader>
          <CardContent className="prose prose-gray dark:prose-invert max-w-none">
            <p>
              At Movie Drafter (accessible from{" "}
              <a 
                href="https://moviedrafter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 underline"
              >
                https://moviedrafter.com
              </a>
              ), the privacy of our visitors is one of our main priorities. This Privacy Policy document contains types of information that is collected and recorded by Movie Drafter and how we use it.
            </p>

            <h2>1. Information We Collect</h2>
            <p>We collect information in two ways:</p>
            <p>
              <strong>Voluntary Information:</strong> If you contact us through our Support link or contact form, we collect your name, email address, and the contents of your message to provide assistance.
            </p>
            <p>
              <strong>Automated Information:</strong> Like most websites, we automatically collect certain data via cookies and log files, including IP addresses, browser type, and time stamps.
            </p>

            <h2>2. Google AdSense & Third-Party Cookies</h2>
            <p>
              Google is a third-party vendor on our site. It uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to www.moviedrafter.com and other sites on the internet.
            </p>
            <p>
              <strong>Opt-Out:</strong> Visitors may choose to decline the use of DART cookies by visiting the{" "}
              <a 
                href="https://policies.google.com/technologies/ads" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 underline"
              >
                Google Ad and Content Network Privacy Policy
              </a>
              {" "}at the following URL:{" "}
              <a 
                href="https://policies.google.com/technologies/ads" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 underline"
              >
                https://policies.google.com/technologies/ads
              </a>
            </p>
            <p>
              <strong>Other Partners:</strong> Other third-party ad servers or ad networks use technology like cookies, JavaScript, or Web Beacons that are used in their respective advertisements and links that appear on Movie Drafter. We have no access to or control over these cookies.
            </p>

            <h2>3. Data Attribution & API Usage</h2>
            <p>
              Movie Drafter provides data-driven insights using third-party APIs (such as TMDB). While we fetch movie data from these services, no personal user data is shared with these movie database providers.
            </p>

            <h2>4. US State Privacy Rights (Updated 2026)</h2>
            <p>
              In accordance with the CCPA/CPRA and new 2026 privacy regulations in states including Indiana, Kentucky, and Rhode Island, users have the following rights:
            </p>
            <ul>
              <li><strong>Right to Know:</strong> You may request a disclosure of the personal data we collect.</li>
              <li><strong>Right to Delete:</strong> You may request that we delete any personal data collected (such as support emails).</li>
              <li><strong>Right to Opt-Out:</strong> You have the right to opt-out of the "sale" or "sharing" of personal information for targeted advertising.</li>
            </ul>
            <p>To exercise these rights, please contact us via our Support page.</p>

            <h2>5. GDPR Data Protection Rights (EEA/UK)</h2>
            <p>
              If you are located in the European Economic Area (EEA) or the UK, we comply with the IAB TCF v2.3 framework. You have the right to access, rectify, or erase your data. We ensure that our consent management platform allows you to customize your ad preferences.
            </p>

            <h2>6. Children's Information</h2>
            <p>
              Movie Drafter does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you think your child provided this kind of information on our website, please contact us immediately.
            </p>

            <h2>7. Contact Us</h2>
            <p>
              If you have additional questions or require more information about our Privacy Policy, do not hesitate to reach out via our Support link in the footer of our website.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default PrivacyPolicy;