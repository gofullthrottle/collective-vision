import Hero from '@/components/landing/Hero';
import WidgetDemo from '@/components/landing/WidgetDemo';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import Comparison from '@/components/landing/Comparison';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import FinalCTA from '@/components/landing/FinalCTA';
import Footer from '@/components/landing/Footer';

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] dark">
      <Hero />
      <WidgetDemo />
      <Features />
      <HowItWorks />
      <Comparison />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
