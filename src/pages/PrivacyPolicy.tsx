import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4">
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
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose prose-gray dark:prose-invert max-w-none">
            <h2>Information We Collect</h2>
            <p>
              We collect information you provide directly to us, such as when you create an account, 
              participate in movie drafts, or contact us for support.
            </p>

            <h2>How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide and maintain our service</li>
              <li>Process your movie draft participations</li>
              <li>Send you technical notices and support messages</li>
              <li>Improve our service</li>
            </ul>

            <h2>Information Sharing</h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal information to third parties 
              without your consent, except as described in this policy.
            </p>

            <h2>Third-Party Advertising</h2>
            <p>
              We use Google AdSense to serve advertisements on our website. Google AdSense uses cookies 
              and other tracking technologies to serve personalized ads based on your interests and browsing behavior.
            </p>
            <p>
              Google, as a third-party vendor, uses cookies to serve ads on our site. Google's use of the 
              DART cookie enables it to serve ads to our users based on their visit to our site and other 
              sites on the Internet. Users may opt out of the use of the DART cookie by visiting the 
              Google Ad and Content Network privacy policy.
            </p>
            <p>
              For more information about how Google uses data when you use our site, please visit:{" "}
              <a 
                href="https://policies.google.com/technologies/partner-sites" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 underline"
              >
                Google's Privacy & Terms
              </a>
            </p>

            <h2>Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar tracking technologies to track activity on our service and hold 
              certain information. Cookies are files with a small amount of data which may include an 
              anonymous unique identifier. We use cookies for advertising purposes, including Google AdSense.
            </p>
            <p>
              You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. 
              However, if you do not accept cookies, you may not be able to use some portions of our service.
            </p>

            <h2>Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information against 
              unauthorized access, alteration, disclosure, or destruction.
            </p>

            <h2>Your Rights</h2>
            <p>
              You have the right to access, update, or delete your personal information. 
              You can do this through your account settings or by contacting us.
            </p>

            <h2>Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of any changes 
              by posting the new policy on this page.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have any questions about this privacy policy, please contact us through our support channels.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;