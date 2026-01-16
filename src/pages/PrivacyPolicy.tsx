import { Helmet } from "react-helmet-async";

const PrivacyPolicy = () => {
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
      <div 
        className="min-h-screen w-full flex flex-col items-center justify-start"
        style={{
          paddingLeft: '24px',
          paddingRight: '24px',
          paddingTop: '48px',
          paddingBottom: '32px',
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'
        }}
      >
        <div className="w-full max-w-[880px] flex flex-col items-start justify-start gap-5">
          {/* Main Content */}
          <div className="w-full flex flex-col items-start justify-start gap-10">
            {/* Header Section */}
            <div className="w-full flex flex-col items-start justify-start gap-5">
              <div className="w-full flex flex-col items-center justify-start gap-1.5">
                <div 
                  className="w-full flex flex-col justify-center text-center"
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '48px',
                    fontFamily: 'CHANEY',
                    fontWeight: 400,
                    lineHeight: '50px'
                  }}
                >
                  Privacy Policy
                </div>
                <div 
                  className="flex flex-col justify-center text-center"
                  style={{
                    color: 'hsl(var(--purple-300))',
                    fontSize: '20px',
                    fontFamily: 'Brockmann',
                    fontWeight: 500,
                    lineHeight: '28px'
                  }}
                >
                  Effective Date: January 2026
                </div>
              </div>

              {/* Content */}
              <div className="w-full flex flex-col justify-center">
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  At Movie Drafter (accessible from{" "}
                  <a 
                    href="https://moviedrafter.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--Text-Primary, #FCFFFF)',
                      textDecoration: 'underline'
                    }}
                  >
                    https://moviedrafter.com
                  </a>
                  ), the privacy of our visitors is one of our main priorities. This Privacy Policy document contains types of information that is collected and recorded by Movie Drafter and how we use it.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em',
                    marginTop: '1em'
                  }}
                >
                  1. Information We Collect
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  We collect information in two ways:
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Voluntary Information:</span> If you contact us through our Support link or contact form, we collect your name, email address, and the contents of your message to provide assistance.
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Automated Information:</span> Like most websites, we automatically collect certain data via cookies and log files, including IP addresses, browser type, and time stamps.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  2. Google AdSense & Third-Party Cookies
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  Google is a third-party vendor on our site. It uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to www.moviedrafter.com and other sites on the internet.
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Opt-Out:</span> Visitors may choose to decline the use of DART cookies by visiting the{" "}
                  <a 
                    href="https://policies.google.com/technologies/ads" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--Text-Primary, #FCFFFF)',
                      textDecoration: 'underline'
                    }}
                  >
                    Google Ad and Content Network Privacy Policy
                  </a>
                  {" "}at the following URL:{" "}
                  <a 
                    href="https://policies.google.com/technologies/ads" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--Text-Primary, #FCFFFF)',
                      textDecoration: 'underline'
                    }}
                  >
                    https://policies.google.com/technologies/ads
                  </a>
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Other Partners:</span> Other third-party ad servers or ad networks use technology like cookies, JavaScript, or Web Beacons that are used in their respective advertisements and links that appear on Movie Drafter. We have no access to or control over these cookies.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  3. Data Attribution & API Usage
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  Movie Drafter provides data-driven insights using third-party APIs (such as TMDB). While we fetch movie data from these services, no personal user data is shared with these movie database providers.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  4. US State Privacy Rights (Updated 2026)
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  In accordance with the CCPA/CPRA and new 2026 privacy regulations in states including Indiana, Kentucky, and Rhode Island, users have the following rights:
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Right to Know:</span> You may request a disclosure of the personal data we collect.
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Right to Delete:</span> You may request that we delete any personal data collected (such as support emails).
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Right to Opt-Out:</span> You have the right to opt-out of the "sale" or "sharing" of personal information for targeted advertising.
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  To exercise these rights, please contact us via our Support page.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  5. GDPR Data Protection Rights (EEA/UK)
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  If you are located in the European Economic Area (EEA) or the UK, we comply with the IAB TCF v2.3 framework. You have the right to access, rectify, or erase your data. We ensure that our consent management platform allows you to customize your ad preferences.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  6. Children's Information
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em'
                  }}
                >
                  Movie Drafter does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you think your child provided this kind of information on our website, please contact us immediately.
                </p>

                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 700,
                    lineHeight: '20px',
                    marginBottom: '0.5em'
                  }}
                >
                  7. Contact Us
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px'
                  }}
                >
                  If you have additional questions or require more information about our Privacy Policy, do not hesitate to reach out via our Support link in the footer of our website.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;
