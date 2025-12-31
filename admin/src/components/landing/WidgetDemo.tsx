import { useEffect, useRef } from 'react';

// Get API URL from environment or default to worker dev server
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8788';

export default function WidgetDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-mount
    if (scriptLoadedRef.current) return;
    if (!containerRef.current) return;

    // Check if widget already exists
    if (containerRef.current.querySelector('#cv-feedback-widget')) return;

    scriptLoadedRef.current = true;

    // Create script element for widget
    const script = document.createElement('script');
    script.src = `${API_URL}/widget.js`;
    script.setAttribute('data-workspace', 'demo-workspace');
    script.setAttribute('data-board', 'main');
    script.setAttribute('data-api-base', API_URL);
    script.async = true;

    containerRef.current.appendChild(script);

    return () => {
      // Clean up widget completely on unmount
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      scriptLoadedRef.current = false;
    };
  }, []);

  return (
    <section id="widget-demo" className="py-24 bg-[#0a0a0a] relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            See it in action
          </h2>
          <p className="text-xl text-gray-400">
            Try our feedback widget right here
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-[#141414] rounded-2xl p-8 card-glow">
            {/* Widget container */}
            <div ref={containerRef} className="min-h-[400px]" />

            <div className="mt-6 text-center text-sm text-gray-500">
              This is a live demo of the Collective Vision widget
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
