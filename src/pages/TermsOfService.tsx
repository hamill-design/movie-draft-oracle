import { Helmet } from "react-helmet-async";

const TermsOfService = () => {
  return (
    <>
      <Helmet>
        <title>Movie Drafter - Terms of Service</title>
        <meta name="description" content="Read Movie Drafter's Terms of Service to understand the rules and guidelines for using our movie draft platform." />
        <meta property="og:title" content="Movie Drafter - Terms of Service" />
        <meta property="og:description" content="Read Movie Drafter's Terms of Service to understand the rules and guidelines for using our movie draft platform." />
        <meta property="og:url" content="https://moviedrafter.com/terms-of-service" />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
        <meta name="twitter:title" content="Movie Drafter - Terms of Service" />
        <meta name="twitter:description" content="Read Movie Drafter's Terms of Service to understand the rules and guidelines for using our movie draft platform." />
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
                  Terms of Service
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
                  Last updated: {new Date().toLocaleDateString()}
                </div>
              </div>

              {/* Content */}
              <div className="w-full flex flex-col justify-center">
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
                  Acceptance of Terms
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
                  By accessing and using this movie draft application, you accept and agree to be bound by the terms and provision of this agreement.
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
                  Use License
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
                  Permission is granted to temporarily download one copy of the materials on this application for personal, non-commercial transitory viewing only.
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
                  Service Description
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
                  Our service allows users to create and participate in movie drafts, track scores, and share results with friends.
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
                  User Accounts
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
                  You are responsible for maintaining the confidentiality of your account and password and for restricting access to your account.
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
                  Prohibited Uses
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
                  You may not use our service:
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em',
                    paddingLeft: '1em'
                  }}
                >
                  • For any unlawful purpose or to solicit others to perform unlawful acts
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em',
                    paddingLeft: '1em'
                  }}
                >
                  • To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '0.5em',
                    paddingLeft: '1em'
                  }}
                >
                  • To transmit, or procure the sending of, any advertising or promotional material without our prior written consent
                </p>
                <p 
                  style={{
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px',
                    marginBottom: '1em',
                    paddingLeft: '1em'
                  }}
                >
                  • To impersonate or attempt to impersonate the company, a company employee, another user, or any other person or entity
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
                  Content
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
                  Our service may contain content that is not appropriate for all audiences. You acknowledge that you use the service at your own risk.
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
                  Termination
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
                  We may terminate or suspend your account and bar access to the service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever.
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
                  Disclaimer
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
                  The information on this application is provided on an 'as is' basis. To the fullest extent permitted by law, this company excludes all representations, warranties, conditions and terms.
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
                  Limitations
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
                  In no event shall Movie Draft Oracle or its suppliers be liable for any damages arising out of the use or inability to use the materials on this application.
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
                  Governing Law
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
                  These terms and conditions are governed by and construed in accordance with the laws and you irrevocably submit to the exclusive jurisdiction of the courts in that state or location.
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
                  Contact Information
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
                  If you have any questions about these Terms of Service, please contact us through our support channels.
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
                  Third-Party Services and Attribution
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
                  This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
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
                  Movie data, images, and related content are provided by{" "}
                  <a 
                    href="https://www.themoviedb.org/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--Text-Primary, #FCFFFF)',
                      textDecoration: 'underline'
                    }}
                  >
                    The Movie Database (TMDB)
                  </a>
                  {" "}and are used in accordance with their{" "}
                  <a 
                    href="https://www.themoviedb.org/api-terms-of-use" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--Text-Primary, #FCFFFF)',
                      textDecoration: 'underline'
                    }}
                  >
                    API Terms of Use
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TermsOfService;
