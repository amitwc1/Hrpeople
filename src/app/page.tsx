import {
  Navbar,
  Hero,
  TrustSection,
  Features,
  HowItWorks,
  WhyChooseUs,
  Pricing,
  Testimonials,
  CtaSection,
  Footer,
} from "@/components/landing";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <TrustSection />
        <Features />
        <HowItWorks />
        <WhyChooseUs />
        <Pricing />
        <Testimonials />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
