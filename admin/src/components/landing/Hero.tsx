import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function Hero() {
  const scrollToDemo = () => {
    const demoSection = document.getElementById('widget-demo');
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      {/* Gradient orb background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] gradient-orb" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] gradient-orb" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 grid-pattern opacity-10" />

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
          Feedback that builds{' '}
          <span className="text-gradient">products people love</span>
        </h1>

        <p className="text-xl sm:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto font-light leading-relaxed">
          The AI-native feedback platform that's cheap to host, easy to embed,
          and understands your users.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            asChild
            size="lg"
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-6 text-lg rounded-lg"
          >
            <Link to="/login">
              Start Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          <Button
            size="lg"
            onClick={scrollToDemo}
            className="bg-transparent border border-gray-600 text-white hover:bg-gray-800 hover:border-gray-500 px-8 py-6 text-lg rounded-lg"
          >
            See it in action
          </Button>
        </div>

        <div className="mt-12 text-sm text-gray-500">
          <p>Deploy in under 5 minutes • No credit card required</p>
        </div>
      </div>
    </section>
  );
}
