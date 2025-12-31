import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for side projects and small teams',
    features: [
      'Up to 1,000 feedback items',
      '1 workspace',
      '3 boards',
      'Basic AI deduplication',
      'Email support',
    ],
    cta: 'Start Free',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'per month',
    description: 'For growing products that need more power',
    features: [
      'Unlimited feedback items',
      'Unlimited workspaces',
      'Unlimited boards',
      'Advanced AI analysis',
      'MCP server access',
      'Priority support',
      'Custom branding',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    description: 'For teams that need dedicated support',
    features: [
      'Everything in Pro',
      'Dedicated infrastructure',
      'SSO & advanced security',
      'SLA guarantee',
      'Dedicated support',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section className="py-24 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-xl text-gray-400">
            Start free, scale when you're ready
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-[#141414] rounded-2xl p-8 ${
                plan.popular ? 'ring-2 ring-blue-500 card-glow' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline mb-2">
                  <span className="text-5xl font-bold text-white">
                    {plan.price}
                  </span>
                  {plan.price !== 'Custom' && (
                    <span className="text-gray-400 ml-2">/{plan.period}</span>
                  )}
                </div>
                <p className="text-gray-400 text-sm">{plan.description}</p>
              </div>

              <Button
                className={`w-full mb-6 ${
                  plan.popular
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
              >
                {plan.cta}
              </Button>

              <ul className="space-y-3">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <Check className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-400">
            All plans include SSL, CDN, and automatic backups.{' '}
            <a href="#" className="text-blue-500 hover:text-blue-400">
              See full feature comparison
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
