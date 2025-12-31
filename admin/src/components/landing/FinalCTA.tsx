import { Button } from '@/components/ui/button';
import { ArrowRight, Mail } from 'lucide-react';

export default function FinalCTA() {
  return (
    <section className="py-24 bg-[#0a0a0a] relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] gradient-orb" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
          Ready to build products{' '}
          <span className="text-gradient">your users will love?</span>
        </h2>

        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          Join teams using Collective Vision to turn user feedback into product
          decisions that matter.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-6 text-lg rounded-lg"
          >
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="border-gray-700 text-white hover:bg-gray-900 px-8 py-6 text-lg rounded-lg"
          >
            <Mail className="mr-2 h-5 w-5" />
            Talk to Sales
          </Button>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>No credit card required • Deploy in under 5 minutes</p>
        </div>
      </div>
    </section>
  );
}
