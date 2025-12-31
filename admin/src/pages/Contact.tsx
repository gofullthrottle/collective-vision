import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MessageSquare, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Footer from '@/components/landing/Footer';

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would send to an API
    console.log('Contact form submitted:', formData);
    setSubmitted(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

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

      {/* Content */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Get in touch
            </h1>
            <p className="text-xl text-gray-400">
              Have questions? We'd love to hear from you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <div className="bg-[#141414] rounded-xl p-6 card-glow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <Mail className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Email</h3>
                    <a href="mailto:support@collectivevision.ai" className="text-blue-400 hover:text-blue-300">
                      support@collectivevision.ai
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-[#141414] rounded-xl p-6 card-glow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Community</h3>
                    <p className="text-gray-400">Join our Discord for support and discussions</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#141414] rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
                <ul className="space-y-2 text-gray-400">
                  <li>
                    <a href="#" className="hover:text-white transition-colors">Documentation</a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white transition-colors">API Reference</a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white transition-colors">GitHub</a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-[#141414] rounded-xl p-8 card-glow">
              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Message sent!</h3>
                  <p className="text-gray-400 mb-6">
                    We'll get back to you as soon as possible.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: '', email: '', subject: '', message: '' });
                    }}
                    className="border-gray-600 text-white hover:bg-gray-800"
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500"
                      placeholder="Your name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500"
                      placeholder="you@company.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-white">Subject</Label>
                    <Input
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500"
                      placeholder="What's this about?"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-white">Message</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 resize-none"
                      placeholder="Tell us more..."
                    />
                  </div>

                  <Button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
