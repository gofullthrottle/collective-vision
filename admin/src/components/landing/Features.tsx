import {
  MessageSquare,
  Sparkles,
  Zap,
  Layers,
  Shield,
  Plug,
} from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: 'Embeddable Widget',
    description:
      'Drop a single script tag into your site. Works like Disqus, but for product feedback.',
  },
  {
    icon: Sparkles,
    title: 'AI Deduplication',
    description:
      'Automatically detect and merge similar feedback across all channels using semantic analysis.',
  },
  {
    icon: Zap,
    title: 'Edge-First Architecture',
    description:
      'Runs on Cloudflare Workers. Sub-100ms response times globally for pennies per month.',
  },
  {
    icon: Layers,
    title: 'Multi-Board Support',
    description:
      'Organize feedback into boards. Different surfaces for product ideas, bug reports, and internal roadmaps.',
  },
  {
    icon: Shield,
    title: 'Built-in Moderation',
    description:
      'Approve, reject, or hide feedback. Keep your public boards clean and professional.',
  },
  {
    icon: Plug,
    title: 'MCP Integration',
    description:
      'Expose your feedback as an MCP server. Let AI agents query and analyze user insights.',
  },
];

export default function Features() {
  return (
    <section className="py-24 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Everything you need to understand your users
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Built for modern product teams who want simplicity without
            sacrificing power
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-[#141414] rounded-xl p-8 card-glow-hover transition-all duration-300 hover:scale-105"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
                }}
              >
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
