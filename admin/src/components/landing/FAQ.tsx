import { Link } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'How does Collective Vision compare to UserVoice or Canny?',
    answer:
      'Collective Vision offers the same core features (widget, voting, commenting) at a fraction of the cost. We add AI-powered deduplication, MCP integration for agent access, and the option to self-host on Cloudflare Workers for pennies per month. UserVoice starts at $699/mo, Canny at $79/mo we start at $0.',
  },
  {
    question: 'What is AI deduplication?',
    answer:
      'Our AI analyzes feedback semantically to detect duplicates even when worded differently. If users say add dark mode, need dark theme, and support night mode, we will flag them as similar and suggest merging. This saves you from manually sifting through redundant requests.',
  },
  {
    question: 'Can I self-host Collective Vision?',
    answer:
      'Yes! The platform runs on modern edge infrastructure, so you can deploy to your own cloud account. You pay only for usage (typically less than $10/mo for small projects). We also offer managed hosting if you prefer a hands-off approach.',
  },
  {
    question: 'What is MCP integration?',
    answer:
      'Model Context Protocol (MCP) lets AI agents query your feedback database directly. You can expose Collective Vision as an MCP server so agents can answer questions like What are the top 5 feature requests or Show me feedback about mobile performance. Infrastructure for agent-powered product decisions.',
  },
  {
    question: 'How do you handle moderation and spam?',
    answer:
      'Every feedback item has a moderation state (pending/approved/rejected) and visibility flag. Widget submissions can auto-approve or require review you decide. We also track feedback source (widget/API/import) so you can apply different rules. Spam detection and AI-powered moderation are on the roadmap.',
  },
  {
    question: 'Can I migrate from another feedback tool?',
    answer:
      'Yes. We provide import scripts for UserVoice, Canny, and other common platforms. You can bulk-import feedback items with votes, comments, and tags. If you need help migrating, our team will assist (free on Pro/Enterprise plans).',
  },
];

export default function FAQ() {
  return (
    <section className="py-24 bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Frequently asked questions
          </h2>
          <p className="text-xl text-gray-400">
            Everything you need to know about Collective Vision
          </p>
        </div>

        <div className="bg-[#141414] rounded-2xl p-8 card-glow">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-gray-800">
                <AccordionTrigger className="text-left text-white hover:text-blue-400">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-400 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400">
            Still have questions?{' '}
            <Link to="/contact" className="text-blue-500 hover:text-blue-400">
              Contact our team
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
