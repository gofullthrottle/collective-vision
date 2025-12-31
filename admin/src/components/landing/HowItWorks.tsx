import { Code, Upload, BarChart3 } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Code,
    title: 'Embed the widget',
    description: 'Add one script tag to your site. Configure workspace and board.',
  },
  {
    number: '02',
    icon: Upload,
    title: 'Collect feedback',
    description: 'Users submit ideas, vote, and comment. All data syncs to Cloudflare D1.',
  },
  {
    number: '03',
    icon: BarChart3,
    title: 'Analyze & act',
    description: 'AI surfaces themes, sentiment, and priority. Build what matters.',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            How it works
          </h2>
          <p className="text-xl text-gray-400">
            From zero to production in under 5 minutes
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-full mb-6">
                  <Icon className="h-8 w-8 text-blue-500" />
                </div>
                <div className="text-sm font-mono text-blue-500 mb-3">
                  {step.number}
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Code snippet */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#141414] rounded-xl p-8 card-glow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-mono text-gray-400">
                index.html
              </span>
              <button className="text-sm text-blue-500 hover:text-blue-400">
                Copy
              </button>
            </div>
            <pre className="text-sm text-gray-300 font-mono overflow-x-auto">
              <code>{`<script
  src="https://feedback.yoursite.com/widget.js"
  data-workspace="your-product"
  data-board="main"
></script>`}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
