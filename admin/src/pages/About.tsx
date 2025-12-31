import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Zap, Heart, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Footer from '@/components/landing/Footer';

const values = [
  {
    icon: Users,
    title: 'User-Centric',
    description: 'We build tools that help teams understand and serve their users better.',
  },
  {
    icon: Zap,
    title: 'AI-Native',
    description: 'Leverage AI to surface insights, deduplicate feedback, and prioritize what matters.',
  },
  {
    icon: Heart,
    title: 'Open & Accessible',
    description: 'Self-hostable, affordable, and built on open standards like MCP for maximum flexibility.',
  },
  {
    icon: Target,
    title: 'Product-Led',
    description: 'We eat our own dogfood. Collective Vision is built using feedback from Collective Vision.',
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] dark">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to home</span>
            </Link>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-lg mr-2" />
              <span className="text-xl font-bold text-white">Collective Vision</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Building the future of<br />
            <span className="text-gradient">product feedback</span>
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed">
            Collective Vision was born from a simple observation: existing feedback tools are either
            too expensive, too complex, or too disconnected from the AI-powered workflows modern
            teams are adopting.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 bg-[#141414]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Our Mission</h2>
          <div className="bg-[#0a0a0a] rounded-2xl p-8 card-glow">
            <p className="text-lg text-gray-300 leading-relaxed text-center">
              To democratize product feedback by creating an AI-native platform that's cheap to host,
              easy to embed, and deeply integrated with the agent-powered future of product development.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <div key={value.title} className="bg-[#141414] rounded-xl p-6 card-glow">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{value.title}</h3>
                  <p className="text-gray-400">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#141414]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-gray-400 mb-8">
            Join the teams building better products with Collective Vision.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-blue-500 hover:bg-blue-600 text-white">
              <Link to="/login">Start Free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-gray-600 text-white hover:bg-gray-800">
              <Link to="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
